import { getDb } from "../queries/connection";
import { sql } from "drizzle-orm";
import { sendBotNotification } from "./telegram-notify";
import { env } from "./env";

let tableEnsured = false;
async function ensureErrorsTable() {
  if (tableEnsured) return;
  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS error_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        endpoint VARCHAR(255),
        message TEXT NOT NULL,
        stack TEXT,
        user_id BIGINT UNSIGNED,
        telegram_id BIGINT,
        meta JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX created_idx (created_at),
        INDEX source_idx (source)
      )
    `);
    tableEnsured = true;
  } catch (err) {
    console.error("[error-tracker] failed to create table:", err);
  }
}

// Track which errors we've already notified about to avoid spam
const notifiedSignatures = new Map<string, number>();

/**
 * Log an error to DB and optionally notify owner via bot.
 * Never throws — silently fails if logging itself errors.
 */
export async function trackError(opts: {
  source: "api" | "frontend" | "tool";
  endpoint?: string;
  error: Error | string;
  userId?: number;
  telegramId?: number;
  meta?: Record<string, any>;
}) {
  try {
    await ensureErrorsTable();
    const db = getDb();
    const message = typeof opts.error === "string" ? opts.error : opts.error?.message ?? "Unknown error";
    const stack = typeof opts.error === "string" ? null : opts.error?.stack ?? null;

    await db.execute(sql`
      INSERT INTO error_logs (source, endpoint, message, stack, user_id, telegram_id, meta)
      VALUES (
        ${opts.source},
        ${opts.endpoint ?? null},
        ${message.substring(0, 1000)},
        ${stack?.substring(0, 5000) ?? null},
        ${opts.userId ?? null},
        ${opts.telegramId ?? null},
        ${opts.meta ? JSON.stringify(opts.meta) : null}
      )
    `);

    // Notify owner if this is a new error signature (debounce 1 hour per signature)
    const ownerTgId = process.env.OWNER_TELEGRAM_ID;
    if (ownerTgId && env.botToken) {
      const signature = `${opts.source}:${opts.endpoint ?? ""}:${message.substring(0, 100)}`;
      const lastNotified = notifiedSignatures.get(signature) ?? 0;
      const now = Date.now();
      if (now - lastNotified > 3600 * 1000) {
        notifiedSignatures.set(signature, now);
        sendBotNotification(Number(ownerTgId),
          `🚨 <b>New error in DropCulture</b>\n\n` +
          `<b>Source:</b> ${opts.source}\n` +
          `<b>Endpoint:</b> ${opts.endpoint ?? "—"}\n` +
          `<b>Message:</b> <code>${message.substring(0, 200)}</code>\n` +
          (opts.userId ? `<b>User ID:</b> ${opts.userId}\n` : "") +
          `<b>Time:</b> ${new Date().toISOString()}`,
          { disableNotification: true }
        ).catch(() => {});
      }
    }
  } catch (err) {
    // Logging itself failed — write to console as last resort
    console.error("[trackError] LOGGING FAILED:", err);
    console.error("[trackError] ORIGINAL ERROR:", opts);
  }
}

/**
 * Get recent errors (for admin panel)
 */
export async function getRecentErrors(limit: number = 50, source?: string) {
  await ensureErrorsTable();
  const db = getDb();
  const result = source
    ? await db.execute(sql`
        SELECT * FROM error_logs WHERE source = ${source}
        ORDER BY created_at DESC LIMIT ${limit}
      `)
    : await db.execute(sql`
        SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ${limit}
      `);
  return (result[0] as any[]) ?? [];
}

/**
 * Get error statistics — count per hour for last 24h
 */
export async function getErrorStats() {
  await ensureErrorsTable();
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as count,
      MAX(created_at) as last_seen
    FROM error_logs
    WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY source
    ORDER BY count DESC
  `);
  return (result[0] as any[]) ?? [];
}
