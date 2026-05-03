import { getDb } from "../queries/connection";
import { sql } from "drizzle-orm";

let tableEnsured = false;
async function ensureEventsTable() {
  if (tableEnsured) return;
  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event VARCHAR(100) NOT NULL,
        user_id BIGINT UNSIGNED,
        telegram_id BIGINT,
        properties JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX event_idx (event, created_at),
        INDEX user_idx (user_id, created_at),
        INDEX created_idx (created_at)
      )
    `);
    tableEnsured = true;
  } catch (err) {
    console.error("[analytics] failed to create table:", err);
  }
}

/**
 * Track an event. Fire-and-forget, never throws.
 */
export async function trackEvent(opts: {
  event: string;
  userId?: number;
  telegramId?: number;
  properties?: Record<string, any>;
}) {
  try {
    await ensureEventsTable();
    const db = getDb();
    await db.execute(sql`
      INSERT INTO analytics_events (event, user_id, telegram_id, properties)
      VALUES (
        ${opts.event},
        ${opts.userId ?? null},
        ${opts.telegramId ?? null},
        ${opts.properties ? JSON.stringify(opts.properties) : null}
      )
    `);
  } catch (err) {
    console.error("[analytics.trackEvent] failed:", err);
  }
}

/**
 * Get DAU/WAU/MAU for admin dashboard
 */
export async function getActiveUsers() {
  await ensureEventsTable();
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)) as dau,
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) as wau,
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)) as mau
  `);
  const row = (result[0] as any[])?.[0];
  return {
    dau: Number(row?.dau ?? 0),
    wau: Number(row?.wau ?? 0),
    mau: Number(row?.mau ?? 0),
  };
}

/**
 * Top events for admin
 */
export async function getTopEvents(hours: number = 24) {
  await ensureEventsTable();
  const db = getDb();
  const result = await db.execute(sql`
    SELECT event, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
    FROM analytics_events
    WHERE created_at > DATE_SUB(NOW(), INTERVAL ${hours} HOUR)
    GROUP BY event
    ORDER BY count DESC
    LIMIT 30
  `);
  return ((result[0] as any[]) ?? []).map(r => ({
    event: r.event,
    count: Number(r.count),
    uniqueUsers: Number(r.unique_users),
  }));
}

/**
 * Active users by hour for last 24h (for chart)
 */
export async function getHourlyActivity() {
  await ensureEventsTable();
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as hour,
      COUNT(DISTINCT user_id) as users,
      COUNT(*) as events
    FROM analytics_events
    WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY hour
    ORDER BY hour ASC
  `);
  return ((result[0] as any[]) ?? []).map(r => ({
    hour: r.hour,
    users: Number(r.users),
    events: Number(r.events),
  }));
}

/**
 * Funnel — registration → first pack → first sale
 */
export async function getFunnel() {
  await ensureEventsTable();
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE event = 'user_registered') as registered,
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE event = 'pack_opened') as opened_pack,
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE event = 'item_listed') as listed_item,
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE event = 'item_bought' OR event = 'item_sold') as completed_trade
  `);
  const row = (result[0] as any[])?.[0];
  return {
    registered: Number(row?.registered ?? 0),
    openedPack: Number(row?.opened_pack ?? 0),
    listedItem: Number(row?.listed_item ?? 0),
    completedTrade: Number(row?.completed_trade ?? 0),
  };
}

/**
 * Revenue stats — total volume, fees collected
 */
export async function getRevenueStats(days: number = 7) {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as transactions,
      SUM(price) as volume,
      SUM(fee) as fees,
      SUM(CASE WHEN currency = 'stars' THEN price ELSE 0 END) as stars_volume
    FROM transactions
    WHERE created_at > DATE_SUB(NOW(), INTERVAL ${days} DAY)
  `);
  const row = (result[0] as any[])?.[0];
  return {
    transactions: Number(row?.transactions ?? 0),
    volume: Number(row?.volume ?? 0),
    fees: Number(row?.fees ?? 0),
    starsVolume: Number(row?.stars_volume ?? 0),
  };
}
