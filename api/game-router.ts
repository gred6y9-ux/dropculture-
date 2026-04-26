
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import {
  getUserItems,
  getUserItemById,
  createUserItem,
  getTemplatesByGrade,
} from "./queries/items";
import {
  createPackOpen,
  getLastDailyClaim,
  createDailyClaim,
  getDailyClaimsCount,
} from "./queries/game";
import { updateUser, findUserById } from "./queries/users";
import { verifyTelegramSessionToken } from "./telegram-session";

// Drop rates for grades
const GRADE_CHANCES: Record<string, number> = {
  Stock: 0.60,
  Refined: 0.25,
  Rare: 0.10,
  Exotic: 0.04,
  Legacy: 0.01,
};

const GRADES = ["Stock", "Refined", "Rare", "Exotic", "Legacy"] as const;

function rollGrade(): string {
  const rand = Math.random();
  let cumulative = 0;
  for (const grade of GRADES) {
    cumulative += GRADE_CHANCES[grade];
    if (rand <= cumulative) return grade;
  }
  return "Stock";
}

function generateFloat(): number {
  return Math.round(Math.random() * 100) / 100;
}

function generatePatternSeed(): number {
  return Math.floor(Math.random() * 1000) + 1;
}

function calculateItemPrice(baseMin: number, baseMax: number, floatVal: number, grade: string): number {
  let multiplier = 1.0;
  if (floatVal <= 0.01) multiplier = 1.5 + Math.random();
  else if (floatVal <= 0.15) multiplier = 1.1 + Math.random() * 0.2;
  else if (floatVal <= 0.38) multiplier = 1.0;
  else if (floatVal <= 0.50) multiplier = 0.85;
  else multiplier = 0.6;

  if (grade === "Legacy") multiplier *= 5;
  else if (grade === "Exotic") multiplier *= 2;
  else if (grade === "Rare") multiplier *= 1.5;

  const base = baseMin + Math.random() * (baseMax - baseMin);
  return Math.floor(base * multiplier);
}

async function getUserFromHeader(headers: Headers) {
  const authHeader = headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const payload = await verifyTelegramSessionToken(token);
  if (!payload || !payload.sub) return null;
  return findUserById(Number(payload.sub));
}

export const gameRouter = createRouter({
  openPack: publicQuery
    .input(z.object({ packType: z.enum(["daily", "premium", "vip"]).default("daily") }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const userId = user.id;

      // Cost check
      const cost = input.packType === "premium" ? 100 : input.packType === "vip" ? 500 : 0;
      if (user.coins < cost) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough coins" });
      }

      if (cost > 0) {
        await updateUser(userId, { coins: user.coins - cost });
      }

      // Generate 5 items
      const items = [];
      for (let i = 0; i < 5; i++) {
        const grade = rollGrade();
        // Boost last card for daily packs
        const finalGrade = (i === 4 && input.packType === "daily" && Math.random() > 0.7)
          ? (Math.random() > 0.5 ? "Rare" : "Exotic")
          : grade;

        const templates = await getTemplatesByGrade(finalGrade as "Stock" | "Refined" | "Rare" | "Exotic" | "Legacy");
        if (templates.length === 0) continue;

        const template = templates[Math.floor(Math.random() * templates.length)];
        const floatVal = generateFloat();
        const patternSeed = generatePatternSeed();
        const serialNum = Math.floor(Math.random() * 1000) + 1;
        const marketPrice = calculateItemPrice(
          template.basePriceMin,
          template.basePriceMax,
          floatVal,
          finalGrade
        );

        const userItem = await createUserItem({
          userId,
          templateId: template.id,
          floatVal,
          patternSeed,
          serialNum,
          marketPrice,
          isListed: false,
        });

        const fullItem = await getUserItemById(userItem!.id);
        items.push(fullItem);
      }

      await createPackOpen({
        userId,
        packType: input.packType,
        itemsCount: items.length,
      });

      return { items, userId };
    }),

  getInventory: publicQuery
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const userId = input.userId ?? user.id;
      return getUserItems(userId);
    }),

  getDailyPack: publicQuery
    .mutation(async ({ ctx }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const userId = user.id;
      const lastClaim = await getLastDailyClaim(userId);

      const now = new Date();
      if (lastClaim) {
        const hoursSince = (now.getTime() - lastClaim.claimedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 20) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Wait ${Math.ceil(20 - hoursSince)} hours`,
          });
        }
      }

      const [count] = await getDailyClaimsCount(userId, now);
      const hasClaimedToday = (count?.count ?? 0) > 0;
      if (hasClaimedToday) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already claimed today" });
      }

      let streak = 1;
      if (lastClaim) {
        const daysSince = Math.floor((now.getTime() - lastClaim.claimedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= 2) {
          streak = (user.streakDays || 0) + 1;
        }
      }

      await createDailyClaim({ userId, streakDay: streak });
      await updateUser(userId, { streakDays: streak, lastClaimAt: now });

      // Bonus coins for streak
      const bonusCoins = Math.min(streak * 50, 500);
      await updateUser(userId, { coins: user.coins + bonusCoins });

      return { streak, bonusCoins, canClaim: true };
    }),

  checkDailyStatus: publicQuery
    .query(async ({ ctx }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) {
        return { canClaim: false, streak: 0, hoursRemaining: 0 };
      }

      const lastClaim = await getLastDailyClaim(user.id);

      if (!lastClaim) {
        return { canClaim: true, streak: user.streakDays ?? 0, hoursRemaining: 0 };
      }

      const now = new Date();
      const hoursSince = (now.getTime() - lastClaim.claimedAt.getTime()) / (1000 * 60 * 60);
      const canClaim = hoursSince >= 20;

      return {
        canClaim,
        streak: user.streakDays ?? 0,
        hoursRemaining: canClaim ? 0 : Math.max(0, Math.ceil(20 - hoursSince)),
      };
    }),

  getProfile: publicQuery
    .query(async ({ ctx }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const items = await getUserItems(user.id);
      const totalValue = items.reduce((sum, item) => sum + (item.marketPrice || 0), 0);
      const legacyCount = items.filter((i) => i.template?.grade === "Legacy").length;

      return {
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          coins: user.coins,
          stars: user.stars,
          streakDays: user.streakDays,
          avatar: user.avatar,
        },
        stats: {
          totalItems: items.length,
          totalValue,
          legacyCount,
        },
      };
    }),
});
