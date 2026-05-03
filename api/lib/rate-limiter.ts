import { TRPCError } from "@trpc/server";

/**
 * In-memory rate limiter with sliding window.
 * Not perfect (resets on restart) but good for MVP — protects from spam.
 */

type Bucket = {
  hits: number;
  resetAt: number;
};

// userId -> action -> bucket
const buckets = new Map<string, Bucket>();

// Periodic cleanup (every 5 min) to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets.entries()) {
    if (b.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /** Maximum requests in window */
  max: number;
  /** Window in seconds */
  windowSec: number;
}

export const RATE_LIMITS: Record<string, RateLimitOptions> = {
  // Game mutations
  "openPack":          { max: 60, windowSec: 60 },     // 60 packs/min — generous
  "getDailyPack":      { max: 5,  windowSec: 86400 },  // 5/day max attempts
  "wheel.spin":        { max: 5,  windowSec: 3600 },   // 5/hour
  "burnItems":         { max: 30, windowSec: 60 },     // 30/min
  "buyInventorySlots": { max: 10, windowSec: 3600 },   // 10/hour

  // Market
  "listItems":     { max: 30, windowSec: 60 },         // 30 listings/min
  "buyItem":       { max: 30, windowSec: 60 },         // 30 buys/min
  "removeListing": { max: 30, windowSec: 60 },

  // Auth
  "login":         { max: 30, windowSec: 60 },         // 30 logins/min

  // Payments
  "createInvoice": { max: 10, windowSec: 60 },         // 10/min

  // Referral
  "applyReferral": { max: 5,  windowSec: 60 },         // 5 attempts/min

  // Admin (less strict)
  "admin.broadcast": { max: 5, windowSec: 600 },       // 5 broadcasts per 10 min

  // Default for unknown
  "default":       { max: 100, windowSec: 60 },
};

/**
 * Check rate limit. Throws TRPCError if exceeded.
 */
export function checkRateLimit(userId: number | string, action: string) {
  const config = RATE_LIMITS[action] ?? RATE_LIMITS.default;
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  let bucket = buckets.get(key);

  // Initialize or reset if window expired
  if (!bucket || bucket.resetAt < now) {
    bucket = { hits: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return;
  }

  // Check limit
  if (bucket.hits >= config.max) {
    const retryIn = Math.ceil((bucket.resetAt - now) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Занадто багато запитів. Спробуй через ${retryIn} секунд.`,
    });
  }

  bucket.hits++;
}

/**
 * Reset all rate limits for a user (e.g. after admin override)
 */
export function resetRateLimit(userId: number | string, action?: string) {
  if (action) {
    buckets.delete(`${userId}:${action}`);
  } else {
    for (const key of buckets.keys()) {
      if (key.startsWith(`${userId}:`)) buckets.delete(key);
    }
  }
}
