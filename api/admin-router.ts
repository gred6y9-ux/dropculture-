import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { findUserById, findUserByTelegramId, updateUser } from "./queries/users";
import { verifyTelegramSessionToken } from "./telegram-session";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { sendBotNotification } from "./lib/telegram-notify";
import { trackEvent, getActiveUsers, getTopEvents, getHourlyActivity, getFunnel, getRevenueStats } from "./lib/analytics";
import { trackError, getRecentErrors, getErrorStats } from "./lib/error-tracker";

// ── Get authenticated user ───────────────────────────────────────
async function getUser(headers: Headers) {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = await verifyTelegramSessionToken(auth.replace("Bearer ", ""));
  if (!payload?.sub) return null;
  return findUserById(Number(payload.sub));
}

// ── Admin auth check ─────────────────────────────────────────────
async function requireAdmin(headers: Headers) {
  const user = await getUser(headers);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Login required" });

  const ownerTgId = process.env.OWNER_TELEGRAM_ID;
  const isOwner = ownerTgId && Number(user.telegramId) === Number(ownerTgId);
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }

  return user;
}

// ── Ensure ban column exists ─────────────────────────────────────
let banColumnEnsured = false;
async function ensureBanColumn() {
  if (banColumnEnsured) return;
  const db = getDb();
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0`);
  } catch { /* exists */ }
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN ban_reason VARCHAR(500) NULL`);
  } catch { /* exists */ }
  banColumnEnsured = true;
}

export const adminRouter = createRouter({
  // ── Check if current user is admin ─────────────────────────────
  whoami: publicQuery.query(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) return { isAdmin: false };

    const ownerTgId = process.env.OWNER_TELEGRAM_ID;
    const isOwner = ownerTgId && Number(user.telegramId) === Number(ownerTgId);
    const isAdmin = user.role === "admin";

    return {
      isAdmin: !!(isOwner || isAdmin),
      isOwner: !!isOwner,
      userId: user.id,
      telegramId: user.telegramId,
    };
  }),

  // ── DASHBOARD STATS ────────────────────────────────────────────
  getDashboard: publicQuery.query(async ({ ctx }) => {
    await requireAdmin(ctx.req.headers);
    await ensureBanColumn();
    const db = getDb();

    const [usersResult, itemsResult, listingsResult, txResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as total, SUM(coins) as total_coins, SUM(stars) as total_stars FROM users`),
      db.execute(sql`SELECT COUNT(*) as total FROM user_items`),
      db.execute(sql`SELECT COUNT(*) as total FROM market_listings WHERE sold_at IS NULL`),
      db.execute(sql`SELECT COUNT(*) as total, SUM(price) as volume, SUM(fee) as fees FROM transactions WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`),
    ]);

    const usersRow = (usersResult[0] as any[])?.[0] ?? {};
    const itemsRow = (itemsResult[0] as any[])?.[0] ?? {};
    const listingsRow = (listingsResult[0] as any[])?.[0] ?? {};
    const txRow = (txResult[0] as any[])?.[0] ?? {};

    const activeUsers = await getActiveUsers();
    const errors = await getErrorStats();

    return {
      users: {
        total: Number(usersRow.total ?? 0),
        totalCoinsInCirculation: Number(usersRow.total_coins ?? 0),
        totalStarsInCirculation: Number(usersRow.total_stars ?? 0),
        ...activeUsers,
      },
      items: {
        total: Number(itemsRow.total ?? 0),
      },
      market: {
        activeListings: Number(listingsRow.total ?? 0),
      },
      revenue: {
        transactions30d: Number(txRow.total ?? 0),
        volume30d: Number(txRow.volume ?? 0),
        fees30d: Number(txRow.fees ?? 0),
      },
      errors: errors,
    };
  }),

  // ── USER MANAGEMENT ────────────────────────────────────────────
  searchUsers: publicQuery
    .input(z.object({ query: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.req.headers);
      await ensureBanColumn();
      const db = getDb();

      const q = input.query?.trim();
      const result = q
        ? await db.execute(sql`
            SELECT id, telegram_id, username, first_name, coins, stars, banned, role, created_at, last_sign_in_at
            FROM users
            WHERE telegram_id LIKE ${`%${q}%`}
              OR username LIKE ${`%${q}%`}
              OR first_name LIKE ${`%${q}%`}
              OR id = ${isNaN(Number(q)) ? -1 : Number(q)}
            ORDER BY last_sign_in_at DESC
            LIMIT ${input.limit}
          `)
        : await db.execute(sql`
            SELECT id, telegram_id, username, first_name, coins, stars, banned, role, created_at, last_sign_in_at
            FROM users
            ORDER BY last_sign_in_at DESC
            LIMIT ${input.limit}
          `);

      return ((result[0] as any[]) ?? []).map(r => ({
        id: Number(r.id),
        telegramId: r.telegram_id ? Number(r.telegram_id) : null,
        username: r.username,
        firstName: r.first_name,
        coins: Number(r.coins),
        stars: Number(r.stars),
        banned: !!Number(r.banned ?? 0),
        role: r.role,
        createdAt: r.created_at,
        lastSignInAt: r.last_sign_in_at,
      }));
    }),

  getUserDetails: publicQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.req.headers);
      const db = getDb();

      const user = await findUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      // Get item stats
      const itemsRes = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN it.grade = 'Legacy' THEN 1 ELSE 0 END) as legacy,
          SUM(ui.market_price) as total_value
        FROM user_items ui
        LEFT JOIN item_templates it ON it.id = ui.template_id
        WHERE ui.user_id = ${input.userId}
      `);
      const items = (itemsRes[0] as any[])?.[0] ?? {};

      // Get tx stats
      const txRes = await db.execute(sql`
        SELECT
          SUM(CASE WHEN seller_id = ${input.userId} THEN price - fee ELSE 0 END) as earned,
          SUM(CASE WHEN buyer_id = ${input.userId} THEN price ELSE 0 END) as spent,
          COUNT(*) as total_transactions
        FROM transactions
        WHERE seller_id = ${input.userId} OR buyer_id = ${input.userId}
      `);
      const tx = (txRes[0] as any[])?.[0] ?? {};

      return {
        user,
        stats: {
          totalItems: Number(items.total ?? 0),
          legacyItems: Number(items.legacy ?? 0),
          totalValue: Number(items.total_value ?? 0),
          earned: Number(tx.earned ?? 0),
          spent: Number(tx.spent ?? 0),
          totalTransactions: Number(tx.total_transactions ?? 0),
        },
      };
    }),

  giveCoins: publicQuery
    .input(z.object({
      userId: z.number(),
      amount: z.number().int(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const admin = await requireAdmin(ctx.req.headers);
      const target = await findUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });

      const newBalance = Math.max(0, target.coins + input.amount);
      await updateUser(input.userId, { coins: newBalance });

      // Notify user via bot
      if (target.telegramId) {
        const action = input.amount >= 0 ? "💰 Тобі нараховано" : "⚠️ З тебе списано";
        const amount = Math.abs(input.amount);
        sendBotNotification(target.telegramId,
          `${action} <b>${amount.toLocaleString()} монет</b>` +
          (input.reason ? `\n\n<i>Причина: ${input.reason}</i>` : "")
        ).catch(() => {});
      }

      trackEvent({
        event: "admin_give_coins",
        userId: admin.id,
        properties: { targetUserId: input.userId, amount: input.amount, reason: input.reason },
      });

      return { success: true, newBalance };
    }),

  giveStars: publicQuery
    .input(z.object({
      userId: z.number(),
      amount: z.number().int(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const admin = await requireAdmin(ctx.req.headers);
      const target = await findUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });

      const newBalance = Math.max(0, target.stars + input.amount);
      await updateUser(input.userId, { stars: newBalance });

      if (target.telegramId) {
        const action = input.amount >= 0 ? "⭐ Тобі нараховано" : "⚠️ З тебе списано";
        sendBotNotification(target.telegramId,
          `${action} <b>${Math.abs(input.amount)} Stars</b>` +
          (input.reason ? `\n\n<i>Причина: ${input.reason}</i>` : "")
        ).catch(() => {});
      }

      trackEvent({
        event: "admin_give_stars",
        userId: admin.id,
        properties: { targetUserId: input.userId, amount: input.amount, reason: input.reason },
      });

      return { success: true, newBalance };
    }),

  banUser: publicQuery
    .input(z.object({
      userId: z.number(),
      banned: z.boolean(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const admin = await requireAdmin(ctx.req.headers);
      await ensureBanColumn();
      const target = await findUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });

      const db = getDb();
      await db.execute(sql`
        UPDATE users SET banned = ${input.banned ? 1 : 0}, ban_reason = ${input.reason ?? null}
        WHERE id = ${input.userId}
      `);

      trackEvent({
        event: input.banned ? "admin_user_banned" : "admin_user_unbanned",
        userId: admin.id,
        properties: { targetUserId: input.userId, reason: input.reason },
      });

      return { success: true };
    }),

  // ── ANALYTICS ──────────────────────────────────────────────────
  getAnalytics: publicQuery
    .input(z.object({ hours: z.number().default(24) }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.req.headers);
      const [activeUsers, topEvents, hourlyActivity, funnel, revenue] = await Promise.all([
        getActiveUsers(),
        getTopEvents(input.hours),
        getHourlyActivity(),
        getFunnel(),
        getRevenueStats(7),
      ]);
      return { activeUsers, topEvents, hourlyActivity, funnel, revenue };
    }),

  // ── ERROR LOGS ─────────────────────────────────────────────────
  getErrors: publicQuery
    .input(z.object({ limit: z.number().default(50), source: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.req.headers);
      const errors = await getRecentErrors(input.limit, input.source);
      return errors;
    }),

  // ── BROADCAST ANNOUNCEMENT ─────────────────────────────────────
  broadcast: publicQuery
    .input(z.object({
      message: z.string().min(1).max(2000),
      onlyActive: z.boolean().default(false), // active = signed in last 7 days
    }))
    .mutation(async ({ ctx, input }) => {
      const admin = await requireAdmin(ctx.req.headers);
      const db = getDb();

      const result = input.onlyActive
        ? await db.execute(sql`
            SELECT telegram_id FROM users
            WHERE telegram_id IS NOT NULL AND banned = 0
              AND last_sign_in_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
          `)
        : await db.execute(sql`
            SELECT telegram_id FROM users
            WHERE telegram_id IS NOT NULL AND banned = 0
          `);

      const recipients = ((result[0] as any[]) ?? [])
        .map(r => Number(r.telegram_id))
        .filter(Boolean);

      // Send in batches with delay to avoid Telegram rate limits
      let sent = 0, failed = 0;
      for (const tgId of recipients) {
        const ok = await sendBotNotification(tgId, input.message);
        if (ok) sent++; else failed++;
        await new Promise(r => setTimeout(r, 50)); // 20 msg/sec
      }

      trackEvent({
        event: "admin_broadcast",
        userId: admin.id,
        properties: { recipients: recipients.length, sent, failed, onlyActive: input.onlyActive },
      });

      return { total: recipients.length, sent, failed };
    }),

  // ── GAME SETTINGS (key-value) ──────────────────────────────────
  getSettings: publicQuery.query(async ({ ctx }) => {
    await requireAdmin(ctx.req.headers);
    const db = getDb();
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS game_settings (
          key_name VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    } catch { /* exists */ }
    const result = await db.execute(sql`SELECT key_name, value FROM game_settings`);
    const rows = (result[0] as any[]) ?? [];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key_name] = r.value;
    return settings;
  }),

  setSetting: publicQuery
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const admin = await requireAdmin(ctx.req.headers);
      const db = getDb();
      await db.execute(sql`
        INSERT INTO game_settings (key_name, value) VALUES (${input.key}, ${input.value})
        ON DUPLICATE KEY UPDATE value = ${input.value}
      `);
      trackEvent({
        event: "admin_setting_changed",
        userId: admin.id,
        properties: { key: input.key, value: input.value },
      });
      return { success: true };
    }),
});
