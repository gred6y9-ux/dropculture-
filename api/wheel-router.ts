import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { updateUser, findUserById } from "./queries/users";
import { getTemplatesByGrade } from "./queries/items";
import { createUserItem } from "./queries/items";
import { verifyTelegramSessionToken } from "./telegram-session";

async function getUserFromHeader(headers: Headers) {
  const authHeader = headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const payload = await verifyTelegramSessionToken(token);
  if (!payload || !payload.sub) return null;
  return findUserById(Number(payload.sub));
}

// Wheel sectors with weights
const WHEEL_SECTORS = [
  { id: 1, label: "50 монет",    type: "coins",  value: 50,   weight: 35, color: "#6366f1" },
  { id: 2, label: "100 монет",   type: "coins",  value: 100,  weight: 25, color: "#8b5cf6" },
  { id: 3, label: "250 монет",   type: "coins",  value: 250,  weight: 15, color: "#a855f7" },
  { id: 4, label: "500 монет",   type: "coins",  value: 500,  weight: 10, color: "#d946ef" },
  { id: 5, label: "Stock предмет", type: "item", value: "Stock",  weight: 8,  color: "#64748b" },
  { id: 6, label: "Refined предмет", type: "item", value: "Refined", weight: 5, color: "#3b82f6" },
  { id: 7, label: "1000 монет",  type: "coins",  value: 1000, weight: 1.5, color: "#f59e0b" },
  { id: 8, label: "Rare предмет", type: "item",  value: "Rare",   weight: 0.5, color: "#a855f7" },
];

function spinWheel(): typeof WHEEL_SECTORS[0] {
  const totalWeight = WHEEL_SECTORS.reduce((s, x) => s + x.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const sector of WHEEL_SECTORS) {
    rand -= sector.weight;
    if (rand <= 0) return sector;
  }
  return WHEEL_SECTORS[0];
}

export const wheelRouter = createRouter({
  // Get wheel status (can spin or not)
  status: publicQuery.query(async ({ ctx }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) return { canSpin: false, hoursRemaining: 12, sectors: WHEEL_SECTORS };

    const db = getDb();
    const result = await db.execute(
      sql`SELECT last_spin_at FROM wheel_spins WHERE user_id = ${user.id} ORDER BY last_spin_at DESC LIMIT 1`
    );
    const rows = result[0] as any[];
    const lastSpin = rows?.[0]?.last_spin_at;

    if (!lastSpin) return { canSpin: true, hoursRemaining: 0, sectors: WHEEL_SECTORS };

    const hoursSince = (Date.now() - new Date(lastSpin).getTime()) / (1000 * 60 * 60);
    const canSpin = hoursSince >= 12;

    return {
      canSpin,
      hoursRemaining: canSpin ? 0 : Math.ceil(12 - hoursSince),
      sectors: WHEEL_SECTORS,
    };
  }),

  // Spin the wheel
  spin: publicQuery.mutation(async ({ ctx }) => {
    const user = await getUserFromHeader(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = getDb();

    // Ensure table exists
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

    // Check cooldown
    const result = await db.execute(
      sql`SELECT last_spin_at FROM wheel_spins WHERE user_id = ${user.id} ORDER BY last_spin_at DESC LIMIT 1`
    );
    const rows = result[0] as any[];
    const lastSpin = rows?.[0]?.last_spin_at;

    if (lastSpin) {
      const hoursSince = (Date.now() - new Date(lastSpin).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 12) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Зачекай ще ${Math.ceil(12 - hoursSince)} год`,
        });
      }
    }

    const sector = spinWheel();
    let rewardDescription = "";
    let itemWon = null;

    if (sector.type === "coins") {
      await updateUser(user.id, { coins: user.coins + (sector.value as number) });
      rewardDescription = `+${sector.value} монет`;
    } else {
      // Give item
      const grade = sector.value as string;
      const templates = await getTemplatesByGrade(grade as any);
      if (templates.length > 0) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        const floatVal = Math.round(Math.random() * 100) / 100;
        const patternSeed = Math.floor(Math.random() * 1000) + 1;
        const serialNum = Math.floor(Math.random() * 1000) + 1;
        const marketPrice = template.basePriceMin + Math.floor(Math.random() * (template.basePriceMax - template.basePriceMin));

        const newItem = await createUserItem({
          userId: user.id,
          templateId: template.id,
          floatVal,
          patternSeed,
          serialNum,
          marketPrice,
          isListed: false,
        });
        itemWon = { ...newItem, templateName: template.name, grade };
        rewardDescription = `${template.name} (${grade})`;
      }
    }

    // Record spin
    await db.execute(
      sql`INSERT INTO wheel_spins (user_id, sector_id, reward_type, reward_value) VALUES (${user.id}, ${sector.id}, ${sector.type}, ${String(sector.value)})`
    );

    return {
      sector,
      rewardDescription,
      itemWon,
      newCoins: sector.type === "coins" ? user.coins + (sector.value as number) : user.coins,
    };
  }),
});
