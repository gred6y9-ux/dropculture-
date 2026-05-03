import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { updateUser, findUserById } from "./queries/users";
import { getTemplatesByGrade, createUserItem } from "./queries/items";
import { verifyTelegramSessionToken } from "./telegram-session";
import { checkRateLimit } from "./lib/rate-limiter";

async function getUserFromHeader(headers: Headers) {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = await verifyTelegramSessionToken(auth.replace("Bearer ", ""));
  if (!payload?.sub) return null;
  return findUserById(Number(payload.sub));
}

async function ensureTable() {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wheel_spins (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      sector_id INT NOT NULL,
      reward_type VARCHAR(20) NOT NULL,
      reward_value VARCHAR(100) NOT NULL,
      last_spin_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX user_spin_idx (user_id, last_spin_at)
    )
  `);
}

const WHEEL_SECTORS = [
  { id: 1, label: "50 монет",      type: "coins", value: 50,       weight: 35,  color: "#6366f1" },
  { id: 2, label: "100 монет",     type: "coins", value: 100,      weight: 25,  color: "#8b5cf6" },
  { id: 3, label: "250 монет",     type: "coins", value: 250,      weight: 15,  color: "#a855f7" },
  { id: 4, label: "500 монет",     type: "coins", value: 500,      weight: 10,  color: "#d946ef" },
  { id: 5, label: "Stock предмет", type: "item",  value: "Stock",  weight: 8,   color: "#64748b" },
  { id: 6, label: "Refined",       type: "item",  value: "Refined",weight: 5,   color: "#3b82f6" },
  { id: 7, label: "1000 монет 🎰", type: "coins", value: 1000,     weight: 1.5, color: "#f59e0b" },
  { id: 8, label: "Rare 🟣",       type: "item",  value: "Rare",   weight: 0.5, color: "#a855f7" },
];

const VIP_WHEEL_SECTORS = [
  { id: 11, label: "500 монет",    type: "coins", value: 500,      weight: 20,  color: "#10b981" },
  { id: 12, label: "Rare 🟣",       type: "item",  value: "Rare",   weight: 20,  color: "#a855f7" },
  { id: 13, label: "1000 монет",   type: "coins", value: 1000,     weight: 15,  color: "#f59e0b" },
  { id: 14, label: "Exotic 🌸",    type: "item",  value: "Exotic", weight: 15,  color: "#ec4899" },
  { id: 15, label: "2000 монет",   type: "coins", value: 2000,     weight: 10,  color: "#eab308" },
  { id: 16, label: "Refined",      type: "item",  value: "Refined",weight: 10,  color: "#3b82f6" },
  { id: 17, label: "5 Stars ⭐",   type: "stars", value: 5,        weight: 8,   color: "#f97316" },
  { id: 18, label: "Legacy 👑",    type: "item",  value: "Legacy", weight: 2,   color: "#facc15" },
];

function spinWheel(isVip: boolean = false) {
  const sectors = isVip ? VIP_WHEEL_SECTORS : WHEEL_SECTORS;
  const total = sectors.reduce((s, x) => s + x.weight, 0);
  let rand = Math.random() * total;
  for (const s of sectors) { rand -= s.weight; if (rand <= 0) return s; }
  return sectors[0];
}

export const wheelRouter = createRouter({
  status: publicQuery.query(async ({ ctx }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) return { canSpin: false, hoursRemaining: 12 };

    try {
      await ensureTable();
      const db = getDb();
      const result = await db.execute(
        sql`SELECT last_spin_at FROM wheel_spins WHERE user_id = ${user.id} ORDER BY last_spin_at DESC LIMIT 1`
      );
      const rows = result[0] as any[];
      const lastSpin = rows?.[0]?.last_spin_at;

      if (!lastSpin) return { canSpin: true, hoursRemaining: 0 };

      const hoursSince = (Date.now() - new Date(lastSpin).getTime()) / (1000 * 60 * 60);
      const canSpin = hoursSince >= 12;
      const hoursRemaining = canSpin ? 0 : Math.ceil(12 - hoursSince);

      return { canSpin, hoursRemaining };
    } catch {
      return { canSpin: true, hoursRemaining: 0 };
    }
  }),

  spin: publicQuery
    .input(z.object({ isVip: z.boolean().default(false) }).optional())
    .mutation(async ({ ctx, input }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if ((user as any).banned) throw new TRPCError({ code: "FORBIDDEN", message: "Аккаунт заблокований" });
    checkRateLimit(user.id, "wheel.spin");

    const isVip = input?.isVip ?? false;
    const VIP_COST_STARS = 10;

    await ensureTable();
    const db = getDb();

    if (isVip) {
      // VIP wheel: cost 10 Stars, no cooldown, better rewards
      if (user.stars < VIP_COST_STARS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Потрібно ${VIP_COST_STARS} ⭐ Stars. У тебе ${user.stars}.`,
        });
      }
      await updateUser(user.id, { stars: user.stars - VIP_COST_STARS });
    } else {
      // Free wheel: cooldown 12h
      const result = await db.execute(
        sql`SELECT last_spin_at FROM wheel_spins WHERE user_id = ${user.id} AND is_vip = 0 ORDER BY last_spin_at DESC LIMIT 1`
      );
      const rows = result[0] as any[];
      const lastSpin = rows?.[0]?.last_spin_at;

      if (lastSpin) {
        const hoursSince = (Date.now() - new Date(lastSpin).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 12) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Зачекай ще ${Math.ceil(12 - hoursSince)} год` });
        }
      }
    }

    const sector = spinWheel(isVip);
    let rewardDescription = "";
    let itemWon = null;

    if (sector.type === "coins") {
      await updateUser(user.id, { coins: user.coins + (sector.value as number) });
      rewardDescription = `+${sector.value} монет`;
    } else if (sector.type === "stars") {
      await updateUser(user.id, { stars: (user.stars - (isVip ? VIP_COST_STARS : 0)) + (sector.value as number) });
      rewardDescription = `+${sector.value} Stars`;
    } else {
      const grade = sector.value as string;
      const templates = await getTemplatesByGrade(grade as any);
      if (templates.length > 0) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        const floatVal = Math.round(Math.random() * 10000) / 10000;
        const newItem = await createUserItem({
          userId: user.id, templateId: template.id, floatVal,
          patternSeed: Math.floor(Math.random() * 1000) + 1,
          serialNum: Math.floor(Math.random() * 9999) + 1,
          marketPrice: template.basePriceMin + Math.floor(Math.random() * (template.basePriceMax - template.basePriceMin)),
          isListed: false,
        });
        itemWon = newItem;
        rewardDescription = `${template.name} (${grade})`;
      }
    }

    // Add is_vip column if needed
    try {
      await db.execute(sql`ALTER TABLE wheel_spins ADD COLUMN is_vip TINYINT(1) NOT NULL DEFAULT 0`);
    } catch { /* exists */ }

    await db.execute(
      sql`INSERT INTO wheel_spins (user_id, sector_id, reward_type, reward_value, is_vip) VALUES (${user.id}, ${sector.id}, ${sector.type}, ${String(sector.value)}, ${isVip ? 1 : 0})`
    );

    return { sector, rewardDescription, itemWon, isVip };
  }),
});
