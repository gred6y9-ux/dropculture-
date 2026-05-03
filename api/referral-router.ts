import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { findUserById, updateUser } from "./queries/users";
import { verifyTelegramSessionToken } from "./telegram-session";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { sendBotNotification } from "./lib/telegram-notify";
import { trackEvent } from "./lib/analytics";

async function getUser(headers: Headers) {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = await verifyTelegramSessionToken(auth.replace("Bearer ", ""));
  if (!payload?.sub) return null;
  return findUserById(Number(payload.sub));
}

let tablesEnsured = false;
async function ensureReferralTables() {
  if (tablesEnsured) return;
  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referrals (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        referrer_id BIGINT UNSIGNED NOT NULL,
        referred_id BIGINT UNSIGNED NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        bonus_paid TINYINT(1) NOT NULL DEFAULT 0,
        total_earned INT NOT NULL DEFAULT 0,
        INDEX referrer_idx (referrer_id)
      )
    `);
    tablesEnsured = true;
  } catch (err) {
    console.error("[referral] table create failed:", err);
  }
}

export const referralRouter = createRouter({
  // Apply a referral code (called once after user login if start_param exists)
  applyReferral: publicQuery
    .input(z.object({ refCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      await ensureReferralTables();
      const db = getDb();

      // Parse "ref_123" -> 123
      const match = input.refCode.match(/^ref_(\d+)$/);
      if (!match) return { applied: false, reason: "Invalid code" };

      const referrerId = Number(match[1]);
      if (referrerId === user.id) return { applied: false, reason: "Cannot refer yourself" };

      const referrer = await findUserById(referrerId);
      if (!referrer) return { applied: false, reason: "Referrer not found" };

      // Check if already has referrer
      const existing = await db.execute(
        sql`SELECT id FROM referrals WHERE referred_id = ${user.id}`
      );
      if (((existing[0] as any[]) ?? []).length > 0) {
        return { applied: false, reason: "Already referred" };
      }

      // Apply: bonus 500 to referrer, 200 to user (welcome bonus)
      await db.execute(sql`
        INSERT INTO referrals (referrer_id, referred_id, bonus_paid)
        VALUES (${referrerId}, ${user.id}, 1)
      `);
      await updateUser(referrerId, { coins: referrer.coins + 500 });
      await updateUser(user.id, { coins: user.coins + 200 });

      // Notify referrer
      if (referrer.telegramId) {
        sendBotNotification(referrer.telegramId,
          `🎉 <b>Новий друг приєднався!</b>\n\n` +
          `${user.firstName ?? user.username ?? "Гравець"} зареєструвався за твоїм посиланням.\n` +
          `💰 Тобі нараховано <b>500 монет</b>\n\n` +
          `Ти ще отримуватимеш 1% від кожної покупки друга назавжди!`
        ).catch(() => {});
      }

      trackEvent({
        event: "referral_applied",
        userId: user.id,
        properties: { referrerId, bonus: 200 },
      });

      return { applied: true, referrerName: referrer.firstName ?? referrer.username, bonus: 200 };
    }),

  // Get my referral stats
  getMyStats: publicQuery.query(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    await ensureReferralTables();
    const db = getDb();

    const [referredRes, earnedRes] = await Promise.all([
      db.execute(sql`
        SELECT
          r.id, r.created_at, r.total_earned,
          u.username, u.first_name
        FROM referrals r
        LEFT JOIN users u ON u.id = r.referred_id
        WHERE r.referrer_id = ${user.id}
        ORDER BY r.created_at DESC
        LIMIT 50
      `),
      db.execute(sql`
        SELECT
          COUNT(*) as total_referrals,
          SUM(total_earned) as total_earned
        FROM referrals
        WHERE referrer_id = ${user.id}
      `),
    ]);

    const stats = (earnedRes[0] as any[])?.[0] ?? {};
    const referrals = ((referredRes[0] as any[]) ?? []).map(r => ({
      id: r.id,
      username: r.username,
      firstName: r.first_name,
      totalEarned: Number(r.total_earned ?? 0),
      createdAt: r.created_at,
    }));

    return {
      myCode: `ref_${user.id}`,
      myLink: `https://t.me/DropCulture_bot/app?startapp=ref_${user.id}`,
      totalReferrals: Number(stats.total_referrals ?? 0),
      totalEarned: Number(stats.total_earned ?? 0),
      bonusPerReferral: 500,
      bonusForFriend: 200,
      commissionPct: 1,
      referrals,
    };
  }),

  // Top referrers (leaderboard)
  getLeaderboard: publicQuery.query(async () => {
    await ensureReferralTables();
    const db = getDb();
    const result = await db.execute(sql`
      SELECT
        r.referrer_id,
        u.username, u.first_name, u.avatar,
        COUNT(*) as referral_count,
        SUM(r.total_earned) as total_earned
      FROM referrals r
      LEFT JOIN users u ON u.id = r.referrer_id
      GROUP BY r.referrer_id, u.username, u.first_name, u.avatar
      ORDER BY referral_count DESC
      LIMIT 20
    `);
    return ((result[0] as any[]) ?? []).map((r, i) => ({
      rank: i + 1,
      userId: Number(r.referrer_id),
      username: r.username,
      firstName: r.first_name,
      avatar: r.avatar,
      referralCount: Number(r.referral_count ?? 0),
      totalEarned: Number(r.total_earned ?? 0),
    }));
  }),
});
