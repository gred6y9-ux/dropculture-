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

// ── Pack configurations ──────────────────────────────────────────
export const PACK_CONFIGS = {
  daily: {
    name: "🎁 Щоденний пак",
    cost: 0,
    currency: "free",
    items: 5,
    grades: { Stock: 0.60, Refined: 0.25, Rare: 0.10, Exotic: 0.04, Legacy: 0.01 },
  },
  starter: {
    name: "🌑 Starter Pack",
    cost: 100,
    currency: "coins",
    items: 3,
    grades: { Stock: 0.70, Refined: 0.25, Rare: 0.05, Exotic: 0.00, Legacy: 0.00 },
  },
  standard: {
    name: "💎 Standard Pack",
    cost: 500,
    currency: "coins",
    items: 5,
    grades: { Stock: 0.50, Refined: 0.30, Rare: 0.15, Exotic: 0.05, Legacy: 0.00 },
  },
  premium: {
    name: "✨ Premium Pack",
    cost: 2000,
    currency: "coins",
    items: 5,
    grades: { Stock: 0.00, Refined: 0.40, Rare: 0.35, Exotic: 0.20, Legacy: 0.05 },
  },
  vip: {
    name: "⭐ VIP Pack",
    cost: 50,
    currency: "stars",
    items: 5,
    grades: { Stock: 0.00, Refined: 0.20, Rare: 0.45, Exotic: 0.28, Legacy: 0.07 },
  },
  legendary: {
    name: "🔥 Legendary Pack",
    cost: 200,
    currency: "stars",
    items: 5,
    grades: { Stock: 0.00, Refined: 0.00, Rare: 0.35, Exotic: 0.50, Legacy: 0.15 },
  },
  mythic: {
    name: "👑 Mythic Drop",
    cost: 500,
    currency: "stars",
    items: 1,
    grades: { Stock: 0.00, Refined: 0.00, Rare: 0.00, Exotic: 0.00, Legacy: 1.00 },
  },
} as const;

export type PackType = keyof typeof PACK_CONFIGS;

const GRADES = ["Stock", "Refined", "Rare", "Exotic", "Legacy"] as const;

function rollGrade(grades: Record<string, number>): string {
  const rand = Math.random();
  let cumulative = 0;
  for (const grade of GRADES) {
    cumulative += grades[grade] ?? 0;
    if (rand <= cumulative) return grade;
  }
  return "Stock";
}

function generateFloat(): number {
  return Math.round(Math.random() * 10000) / 10000;
}

function generatePatternSeed(): number {
  return Math.floor(Math.random() * 1000) + 1;
}

function calculateItemPrice(baseMin: number, baseMax: number, floatVal: number, grade: string): number {
  let multiplier = 1.0;
  if (floatVal <= 0.01) multiplier = 2.0 + Math.random();
  else if (floatVal <= 0.15) multiplier = 1.2 + Math.random() * 0.3;
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
  // Get all available packs info
  getPackConfigs: publicQuery.query(() => {
    return Object.entries(PACK_CONFIGS).map(([key, cfg]) => ({
      id: key,
      name: cfg.name,
      cost: cfg.cost,
      currency: cfg.currency,
      items: cfg.items,
      grades: cfg.grades,
    }));
  }),

  // Open a pack
  openPack: publicQuery
    .input(z.object({
      packType: z.enum(["daily", "starter", "standard", "premium", "vip", "legendary", "mythic"]).default("standard"),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });

      const config = PACK_CONFIGS[input.packType];
      const userId = user.id;

      // Cost check for coins packs
      if (config.currency === "coins" && config.cost > 0) {
        if (user.coins < config.cost) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Недостатньо монет" });
        }
        await updateUser(userId, { coins: user.coins - config.cost });
      }

      // Stars packs - handled separately via Telegram invoice
      if (config.currency === "stars") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Цей пак купується за Telegram Stars" });
      }

      // Generate items
      const items = [];
      for (let i = 0; i < config.items; i++) {
        const grade = rollGrade(config.grades as any);
        const templates = await getTemplatesByGrade(grade as any);
        if (templates.length === 0) continue;

        const template = templates[Math.floor(Math.random() * templates.length)];
        const floatVal = generateFloat();
        const patternSeed = generatePatternSeed();
        const serialNum = Math.floor(Math.random() * 10000) + 1;
        const marketPrice = calculateItemPrice(template.basePriceMin, template.basePriceMax, floatVal, grade);

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

      await createPackOpen({ userId, packType: "daily", itemsCount: items.length });

      return { items, packType: input.packType, packName: config.name };
    }),

  getInventory: publicQuery
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getUserItems(input.userId ?? user.id);
    }),

  getDailyPack: publicQuery.mutation(async ({ ctx }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const userId = user.id;
    const lastClaim = await getLastDailyClaim(userId);
    const now = new Date();

    if (lastClaim) {
      const hoursSince = (now.getTime() - lastClaim.claimedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 20) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Зачекай ${Math.ceil(20 - hoursSince)} год` });
      }
    }

    let streak = 1;
    if (lastClaim) {
      const daysSince = Math.floor((now.getTime() - lastClaim.claimedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 2) streak = (user.streakDays || 0) + 1;
    }

    await createDailyClaim({ userId, streakDay: streak });
    const bonusCoins = Math.min(streak * 50, 500);
    await updateUser(userId, { streakDays: streak, lastClaimAt: now, coins: user.coins + bonusCoins });

    return { streak, bonusCoins, canClaim: true };
  }),

  checkDailyStatus: publicQuery.query(async ({ ctx }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) return { canClaim: false, streak: 0, hoursRemaining: 0 };

    const lastClaim = await getLastDailyClaim(user.id);
    if (!lastClaim) return { canClaim: true, streak: user.streakDays ?? 0, hoursRemaining: 0 };

    const now = new Date();
    const hoursSince = (now.getTime() - lastClaim.claimedAt.getTime()) / (1000 * 60 * 60);
    const canClaim = hoursSince >= 20;

    return {
      canClaim,
      streak: user.streakDays ?? 0,
      hoursRemaining: canClaim ? 0 : Math.ceil(20 - hoursSince),
    };
  }),

  getProfile: publicQuery.query(async ({ ctx }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const items = await getUserItems(user.id);
    const totalValue = items.reduce((sum, item) => sum + (item.marketPrice || 0), 0);
    const legacyCount = items.filter((i) => (i as any).template?.grade === "Legacy").length;

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
      stats: { totalItems: items.length, totalValue, legacyCount },
    };
  }),
});
