import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { updateUser, findUserById } from "./queries/users";
import { getTemplatesByGrade, createUserItem } from "./queries/items";
import { verifyTelegramSessionToken } from "./telegram-session";

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

function spinWheel() {
  const total = WHEEL_SECTORS.reduce((s, x) => s + x.weight, 0);
  let rand = Math.random() * total;
  for (const s of WHEEL_SECTORS) { rand -= s.weight; if (rand <= 0) return s; }
  return WHEEL_SECTORS[0];
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

  spin: publicQuery.mutation(async ({ ctx }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    await ensureTable();
    const db = getDb();

    const result = await db.execute(
      sql`SELECT last_spin_at FROM wheel_spins WHERE user_id = ${user.id} ORDER BY last_spin_at DESC LIMIT 1`
    );
    const rows = result[0] as any[];
    const lastSpin = rows?.[0]?.last_spin_at;

    if (lastSpin) {
      const hoursSince = (Date.now() - new Date(lastSpin).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 12) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Зачекай ще ${Math.ceil(12 - hoursSince)} год` });
      }
    }

    const sector = spinWheel();
    let rewardDescription = "";
    let itemWon = null;

    if (sector.type === "coins") {
      await updateUser(user.id, { coins: user.coins + (sector.value as number) });
      rewardDescription = `+${sector.value} монет`;
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

    await db.execute(
      sql`INSERT INTO wheel_spins (user_id, sector_id, reward_type, reward_value) VALUES (${user.id}, ${sector.id}, ${sector.type}, ${String(sector.value)})`
    );

    return { sector, rewardDescription, itemWon };
  }),
});
