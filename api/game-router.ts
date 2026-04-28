import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import {
  getUserItems, getUserItemById, createUserItem, getTemplatesByGrade, updateUserItem,
} from "./queries/items";
import { createPackOpen, getLastDailyClaim, createDailyClaim } from "./queries/game";
import { updateUser, findUserById } from "./queries/users";
import { verifyTelegramSessionToken } from "./telegram-session";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

// ── Pack configurations ──────────────────────────────────────────
export const PACK_CONFIGS = {
  flowers:  { name: "🌸 Flowers Pack", cost: 250, currency: "coins", items: 3, grades: { Stock: 0.65, Refined: 0.25, Rare: 0.08, Exotic: 0.02, Legacy: 0.00 } },
  planets:  { name: "🪐 Planets Pack", cost: 300, currency: "coins", items: 3, grades: { Stock: 0.60, Refined: 0.28, Rare: 0.10, Exotic: 0.02, Legacy: 0.00 } },
  starter:  { name: "🌑 Starter Pack",  cost: 150,  currency: "coins", items: 3, grades: { Stock: 0.70, Refined: 0.25, Rare: 0.05, Exotic: 0.00, Legacy: 0.00 } },
  standard: { name: "💎 Standard Pack", cost: 600,  currency: "coins", items: 5, grades: { Stock: 0.50, Refined: 0.30, Rare: 0.15, Exotic: 0.05, Legacy: 0.00 } },
  premium:  { name: "✨ Premium Pack",  cost: 2500, currency: "coins", items: 5, grades: { Stock: 0.00, Refined: 0.40, Rare: 0.35, Exotic: 0.20, Legacy: 0.05 } },
  elite:    { name: "🔮 Elite Pack",    cost: 6000, currency: "coins", items: 5, grades: { Stock: 0.00, Refined: 0.00, Rare: 0.25, Exotic: 0.40, Legacy: 0.10 } },
  vip:      { name: "⭐ VIP Pack",      cost: 50,   currency: "stars", items: 5, grades: { Stock: 0.00, Refined: 0.20, Rare: 0.45, Exotic: 0.28, Legacy: 0.07 } },
  legendary:{ name: "🔥 Legendary",    cost: 200,  currency: "stars", items: 5, grades: { Stock: 0.00, Refined: 0.00, Rare: 0.35, Exotic: 0.50, Legacy: 0.15 } },
  mythic:   { name: "👑 Mythic Drop",  cost: 500,  currency: "stars", items: 1, grades: { Stock: 0.00, Refined: 0.00, Rare: 0.00, Exotic: 0.00, Legacy: 1.00 } },
} as const;

// Item base prices (LOWER than pack costs so opening packs drains coins)
const ITEM_BASE_PRICES: Record<string, { min: number; max: number }> = {
  Stock:   { min: 10,   max: 40   },  // avg ~25
  Refined: { min: 60,   max: 150  },  // avg ~100
  Rare:    { min: 300,  max: 800  },  // avg ~500
  Exotic:  { min: 1200, max: 3500 },  // avg ~2000
  Legacy:  { min: 5000, max: 15000 }, // avg ~8000
};

// Upgrade costs (coin sink)
const UPGRADE_COSTS: Record<string, number> = {
  Stock: 80, Refined: 300, Rare: 1200, Exotic: 4000,
};

const GRADES = ["Stock", "Refined", "Rare", "Exotic", "Legacy"] as const;
const GRADE_ORDER: Record<string, number> = { Stock: 0, Refined: 1, Rare: 2, Exotic: 3, Legacy: 4 };
const NEXT_GRADE: Record<string, string> = { Stock: "Refined", Refined: "Rare", Rare: "Exotic", Exotic: "Legacy" };

function rollGrade(grades: Record<string, number>): string {
  const rand = Math.random();
  let cum = 0;
  for (const grade of GRADES) {
    cum += grades[grade] ?? 0;
    if (rand <= cum) return grade;
  }
  return "Stock";
}

function generateFloat(): number { return Math.round(Math.random() * 10000) / 10000; }
function generateSeed(): number { return Math.floor(Math.random() * 1000) + 1; }

function calcPrice(grade: string, floatVal: number): number {
  const base = ITEM_BASE_PRICES[grade] ?? ITEM_BASE_PRICES.Stock;
  const range = base.min + Math.random() * (base.max - base.min);
  let mult = 1.0;
  if (floatVal <= 0.01) mult = 1.8 + Math.random() * 0.4;
  else if (floatVal <= 0.15) mult = 1.1 + Math.random() * 0.2;
  else if (floatVal <= 0.38) mult = 1.0;
  else if (floatVal <= 0.50) mult = 0.8;
  else mult = 0.55;
  return Math.floor(range * mult);
}

async function getUser(headers: Headers) {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = await verifyTelegramSessionToken(auth.replace("Bearer ", ""));
  if (!payload?.sub) return null;
  return findUserById(Number(payload.sub));
}

async function generateItems(userId: number, grades: Record<string, number>, count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const grade = rollGrade(grades);
    const templates = await getTemplatesByGrade(grade as any);
    if (!templates.length) continue;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const floatVal = generateFloat();
    const item = await createUserItem({
      userId, templateId: template.id, floatVal,
      patternSeed: generateSeed(), serialNum: Math.floor(Math.random() * 9999) + 1,
      marketPrice: calcPrice(grade, floatVal), isListed: false,
    });
    items.push(await getUserItemById(item!.id));
  }
  return items.filter(Boolean);
}

export const gameRouter = createRouter({

  getPackConfigs: publicQuery.query(() =>
    Object.entries(PACK_CONFIGS).map(([id, cfg]) => ({ id, ...cfg }))
  ),

  // ── Open pack (coins only) ────────────────────────────────────
  openPack: publicQuery
    .input(z.object({
      packType: z.enum(["flowers", "planets", "starter", "standard", "premium", "elite"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const config = PACK_CONFIGS[input.packType];
      if (user.coins < config.cost) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Потрібно ${config.cost} монет. У тебе ${user.coins}.` });
      }

      // Deduct FIRST before generating (prevent double-spend)
      await updateUser(user.id, { coins: user.coins - config.cost });

      const items = await generateItems(user.id, config.grades as any, config.items);
      await createPackOpen({ userId: user.id, packType: "daily", itemsCount: items.length });
      return { items, packName: config.name, coinsSpent: config.cost };
    }),

  // ── Daily free pack (strict cooldown) ────────────────────────
  getDailyPack: publicQuery.mutation(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = getDb();

    // Ensure daily_locks table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_locks (
        user_id BIGINT UNSIGNED NOT NULL,
        locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
      )
    `);

    // Try to insert lock — if user already has one and < 20h, reject
    const existing = await db.execute(
      sql`SELECT locked_at FROM daily_locks WHERE user_id = ${user.id}`
    );
    const rows = (existing[0] as any[]);

    if (rows?.length > 0) {
      const lockedAt = new Date(rows[0].locked_at);
      const hoursSince = (Date.now() - lockedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 20) {
        const hoursLeft = Math.ceil(20 - hoursSince);
        throw new TRPCError({ code: "BAD_REQUEST", message: `Зачекай ще ${hoursLeft} год. Безкоштовний пак раз на 20 годин.` });
      }
      // Update timestamp
      await db.execute(sql`UPDATE daily_locks SET locked_at = NOW() WHERE user_id = ${user.id}`);
    } else {
      await db.execute(sql`INSERT INTO daily_locks (user_id) VALUES (${user.id})`);
    }

    // Streak logic
    const lastClaim = await getLastDailyClaim(user.id);
    let streak = 1;
    if (lastClaim) {
      const daysSince = (Date.now() - lastClaim.claimedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 2) streak = (user.streakDays || 0) + 1;
    }

    const bonusCoins = Math.min(streak * 30, 300);
    await createDailyClaim({ userId: user.id, streakDay: streak });
    await updateUser(user.id, { streakDays: streak, lastClaimAt: new Date(), coins: user.coins + bonusCoins });

    // 3 free items (mostly Stock/Refined)
    const freeGrades = { Stock: 0.65, Refined: 0.25, Rare: 0.08, Exotic: 0.02, Legacy: 0.00 };
    const items = await generateItems(user.id, freeGrades, 3);
    await createPackOpen({ userId: user.id, packType: "daily", itemsCount: items.length });

    return { items, streak, bonusCoins };
  }),

  checkDailyStatus: publicQuery.query(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) return { canClaim: false, streak: 0, hoursRemaining: 0 };

    const db = getDb();
    try {
      const res = await db.execute(sql`SELECT locked_at FROM daily_locks WHERE user_id = ${user.id}`);
      const rows = (res[0] as any[]);
      if (!rows?.length) return { canClaim: true, streak: user.streakDays ?? 0, hoursRemaining: 0 };

      const hoursSince = (Date.now() - new Date(rows[0].locked_at).getTime()) / (1000 * 60 * 60);
      const canClaim = hoursSince >= 20;
      return { canClaim, streak: user.streakDays ?? 0, hoursRemaining: canClaim ? 0 : Math.ceil(20 - hoursSince) };
    } catch {
      return { canClaim: true, streak: user.streakDays ?? 0, hoursRemaining: 0 };
    }
  }),

  // ── Upgrade item (COIN SINK) ──────────────────────────────────
  upgradeItem: publicQuery
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const item = await getUserItemById(input.itemId);
      if (!item || item.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (item.isListed) throw new TRPCError({ code: "BAD_REQUEST", message: "Зніми з маркету перед апгрейдом" });

      const currentGrade = (item as any).template?.grade ?? "Stock";
      if (currentGrade === "Legacy") throw new TRPCError({ code: "BAD_REQUEST", message: "Legacy вже максимальний рівень" });

      const cost = UPGRADE_COSTS[currentGrade];
      if (!cost) throw new TRPCError({ code: "BAD_REQUEST", message: "Апгрейд неможливий" });
      if (user.coins < cost) throw new TRPCError({ code: "BAD_REQUEST", message: `Потрібно ${cost} монет для апгрейду` });

      const nextGrade = NEXT_GRADE[currentGrade];

      // 40% chance success, 60% fail (coins always burned)
      const success = Math.random() < 0.40;
      await updateUser(user.id, { coins: user.coins - cost });

      if (success) {
        // Give new item of higher grade, burn old
        const templates = await getTemplatesByGrade(nextGrade as any);
        if (!templates.length) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const template = templates[Math.floor(Math.random() * templates.length)];
        const floatVal = generateFloat();
        const newItem = await createUserItem({
          userId: user.id, templateId: template.id, floatVal,
          patternSeed: generateSeed(), serialNum: Math.floor(Math.random() * 9999) + 1,
          marketPrice: calcPrice(nextGrade, floatVal), isListed: false,
        });
        // Delete old item
        const db = getDb();
        await db.execute(sql`DELETE FROM user_items WHERE id = ${item.id}`);
        return { success: true, newItem: await getUserItemById(newItem!.id), coinsSpent: cost, newGrade: nextGrade };
      } else {
        return { success: false, coinsSpent: cost, message: "Апгрейд не вдався, монети витрачено" };
      }
    }),

  // ── Buyout (sell to platform for coins) ──────────────────────
  sellToPlatform: publicQuery
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const item = await getUserItemById(input.itemId);
      if (!item || item.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (item.isListed) throw new TRPCError({ code: "BAD_REQUEST", message: "Зніми з маркету" });

      const price = Math.floor((item.marketPrice ?? 0) * 0.60); // 60% of market price
      await updateUser(user.id, { coins: user.coins + price });

      const db = getDb();
      await db.execute(sql`DELETE FROM user_items WHERE id = ${item.id}`);

      return { coinsReceived: price, itemName: (item as any).template?.name };
    }),

  // ── Burn 5 same grade → 1 higher (COIN SINK + item sink) ─────
  burnItems: publicQuery
    .input(z.object({ itemIds: z.array(z.number()).min(5).max(5) }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Verify all items belong to user
      const items = await Promise.all(input.itemIds.map(id => getUserItemById(id)));
      for (const item of items) {
        if (!item || item.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Не всі предмети твої" });
        if (item.isListed) throw new TRPCError({ code: "BAD_REQUEST", message: "Є предмет на маркеті — спочатку зніми" });
      }

      // All must be same grade
      const grades = items.map(i => (i as any).template?.grade ?? "Stock");
      if (new Set(grades).size > 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Всі 5 предметів мають бути одного рівня" });

      const grade = grades[0];
      if (grade === "Legacy") throw new TRPCError({ code: "BAD_REQUEST", message: "Legacy не можна спалити" });

      const burnFee = UPGRADE_COSTS[grade] ?? 50;
      if (user.coins < burnFee) throw new TRPCError({ code: "BAD_REQUEST", message: `Потрібно ${burnFee} монет за контракт спалення` });

      await updateUser(user.id, { coins: user.coins - burnFee });

      // Delete old items
      const db = getDb();
      for (const id of input.itemIds) {
        await db.execute(sql`DELETE FROM user_items WHERE id = ${id}`);
      }

      // Create 1 item of next grade
      const nextGrade = NEXT_GRADE[grade] ?? "Legacy";
      const templates = await getTemplatesByGrade(nextGrade as any);
      if (!templates.length) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const template = templates[Math.floor(Math.random() * templates.length)];
      const floatVal = generateFloat();
      const newItem = await createUserItem({
        userId: user.id, templateId: template.id, floatVal,
        patternSeed: generateSeed(), serialNum: Math.floor(Math.random() * 9999) + 1,
        marketPrice: calcPrice(nextGrade, floatVal), isListed: false,
      });

      return { newItem: await getUserItemById(newItem!.id), newGrade: nextGrade, burnFee };
    }),

  getInventory: publicQuery
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getUserItems(input.userId ?? user.id);
    }),

  getProfile: publicQuery.query(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const items = await getUserItems(user.id);
    const totalValue = items.reduce((s, i) => s + ((i as any).marketPrice ?? 0), 0);
    const legacyCount = items.filter((i: any) => i.template?.grade === "Legacy").length;
    return {
      user: { id: user.id, telegramId: user.telegramId, username: user.username, firstName: user.firstName, coins: user.coins, stars: user.stars, streakDays: user.streakDays, avatar: user.avatar },
      stats: { totalItems: items.length, totalValue, legacyCount },
    };
  }),

  // ── Get collections progress (which templates user owns) ─────
  getCollectionsProgress: publicQuery.query(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = getDb();
    // Get all unique template IDs the user owns
    const ownedRes = await db.execute(sql`
      SELECT DISTINCT template_id FROM user_items WHERE user_id = ${user.id}
    `);
    const ownedTemplateIds = new Set<number>(((ownedRes[0] as any[]) ?? []).map((r: any) => Number(r.template_id)));

    // Get all collections + their templates
    const collectionsRes = await db.execute(sql`
      SELECT
        c.id as collection_id, c.name as collection_name, c.description as collection_description,
        c.is_active,
        it.id as template_id, it.name as template_name, it.grade as template_grade
      FROM collections c
      LEFT JOIN item_templates it ON it.collection_id = c.id
      ORDER BY c.id, it.id
    `);

    const collections = new Map<number, any>();
    for (const r of ((collectionsRes[0] as any[]) ?? [])) {
      const cid = Number(r.collection_id);
      if (!collections.has(cid)) {
        collections.set(cid, {
          id: cid,
          name: r.collection_name,
          description: r.collection_description,
          isActive: !!r.is_active,
          templates: [],
          ownedCount: 0,
          totalCount: 0,
        });
      }
      if (r.template_id) {
        const c = collections.get(cid)!;
        const owned = ownedTemplateIds.has(Number(r.template_id));
        c.templates.push({
          id: Number(r.template_id),
          name: r.template_name,
          grade: r.template_grade,
          owned,
        });
        c.totalCount++;
        if (owned) c.ownedCount++;
      }
    }

    return Array.from(collections.values());
  }),
});
// export PACK_CONFIGS already done above

// Add test collections (flowers + planets)
// Call once via: POST /api/trpc/game.addTestCollections
// with body {"json":{"secret":"dropculture-secret-2024-xyz!!"}}
