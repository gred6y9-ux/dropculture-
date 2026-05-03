import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { findUserById, updateUser } from "./queries/users";
import { verifyTelegramSessionToken } from "./telegram-session";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { createStarsInvoice } from "./lib/telegram-payments";
import { trackEvent } from "./lib/analytics";
import { trackError } from "./lib/error-tracker";
import { sendBotNotification } from "./lib/telegram-notify";
import { checkRateLimit } from "./lib/rate-limiter";

async function getUser(headers: Headers) {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = await verifyTelegramSessionToken(auth.replace("Bearer ", ""));
  if (!payload?.sub) return null;
  return findUserById(Number(payload.sub));
}

let tablesEnsured = false;
async function ensurePaymentsTable() {
  if (tablesEnsured) return;
  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS star_payments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        telegram_id BIGINT NOT NULL,
        product_type VARCHAR(50) NOT NULL,
        product_id VARCHAR(100) NOT NULL,
        stars_amount INT NOT NULL,
        status ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
        payload VARCHAR(100) NOT NULL UNIQUE,
        telegram_charge_id VARCHAR(255) NULL,
        provider_charge_id VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        meta JSON NULL,
        INDEX user_idx (user_id, created_at),
        INDEX status_idx (status)
      )
    `);
    tablesEnsured = true;
  } catch (err) {
    console.error("[payments] table create failed:", err);
  }
}

// ── Star products catalog ────────────────────────────────────────
export const STAR_PRODUCTS = {
  // Stars packs (buy Stars currency for cash)
  stars_50:    { type: "stars",  name: "50 Stars",       starsAmount: 50,   bonus: 0,   description: "Базовий пакет Stars" },
  stars_200:   { type: "stars",  name: "200 Stars",      starsAmount: 200,  bonus: 20,  description: "+10% бонус" },
  stars_500:   { type: "stars",  name: "500 Stars",      starsAmount: 500,  bonus: 75,  description: "+15% бонус" },
  stars_1000:  { type: "stars",  name: "1000 Stars",     starsAmount: 1000, bonus: 200, description: "+20% бонус 🔥" },

  // VIP packs (instant pack delivery for Stars)
  pack_vip:        { type: "pack", packType: "vip",       name: "VIP Pack",         starsAmount: 50,  description: "Rare+ гарантовано · 5 предметів" },
  pack_legendary:  { type: "pack", packType: "legendary", name: "Legendary Pack",   starsAmount: 200, description: "Exotic+ гарантовано · 5 предметів" },
  pack_mythic:     { type: "pack", packType: "mythic",    name: "Mythic Drop",      starsAmount: 500, description: "Legacy 100% · 1 предмет 👑" },

  // VIP wheel
  wheel_spin_vip:  { type: "wheel", name: "VIP колесо",   starsAmount: 10,  description: "Один спін VIP колеса" },

  // Battle Pass premium
  battle_pass_premium: { type: "battlepass", name: "Premium Battle Pass", starsAmount: 200, description: "Сезон 1 · Legacy на 50 рівні" },

  // Inventory expansion
  slots_500: { type: "slots", slots: 500, name: "+500 інвентарних слотів", starsAmount: 100, description: "Назавжди" },
} as const;

type ProductId = keyof typeof STAR_PRODUCTS;

export const paymentsRouter = createRouter({
  // ── List products ──────────────────────────────────────────────
  getProducts: publicQuery.query(() => {
    return Object.entries(STAR_PRODUCTS).map(([id, p]) => ({ id, ...p }));
  }),

  // ── Create invoice (returns invoice URL to open in Telegram) ───
  createInvoice: publicQuery
    .input(z.object({
      productId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if ((user as any).banned) throw new TRPCError({ code: "FORBIDDEN", message: "Аккаунт заблокований" });
      checkRateLimit(user.id, "createInvoice");
      if (!user.telegramId) throw new TRPCError({ code: "BAD_REQUEST", message: "Telegram ID required" });

      const product = STAR_PRODUCTS[input.productId as ProductId];
      if (!product) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product" });

      await ensurePaymentsTable();
      const db = getDb();

      // Generate unique payload
      const payload = `pmt_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Save pending payment
      await db.execute(sql`
        INSERT INTO star_payments (user_id, telegram_id, product_type, product_id, stars_amount, payload, status)
        VALUES (${user.id}, ${user.telegramId}, ${(product as any).type}, ${input.productId}, ${product.starsAmount}, ${payload}, 'pending')
      `);

      // Create Telegram invoice link
      const invoiceUrl = await createStarsInvoice({
        title: product.name,
        description: (product as any).description ?? "DropCulture purchase",
        payload,
        starsAmount: product.starsAmount,
      });

      if (!invoiceUrl) {
        trackError({
          source: "api",
          endpoint: "payments.createInvoice",
          error: `Failed to create invoice for ${input.productId}`,
          userId: user.id,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create invoice. Try again later.",
        });
      }

      trackEvent({
        event: "invoice_created",
        userId: user.id,
        telegramId: user.telegramId ?? undefined,
        properties: { productId: input.productId, starsAmount: product.starsAmount },
      });

      return { invoiceUrl, payload };
    }),

  // ── Get my payment history ────────────────────────────────────
  getMyPayments: publicQuery.query(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    await ensurePaymentsTable();
    const db = getDb();
    const result = await db.execute(sql`
      SELECT id, product_type, product_id, stars_amount, status, created_at, completed_at
      FROM star_payments
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return ((result[0] as any[]) ?? []).map(r => ({
      id: Number(r.id),
      productType: r.product_type,
      productId: r.product_id,
      starsAmount: Number(r.stars_amount),
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    }));
  }),
});

// ─────────────────────────────────────────────────────────────────
// PAYMENT FULFILLMENT — called from webhook handler
// ─────────────────────────────────────────────────────────────────

/**
 * Process a successful Stars payment.
 * Called from webhook when Telegram sends `successful_payment` update.
 */
export async function fulfillPayment(opts: {
  payload: string;
  telegramChargeId: string;
  providerChargeId: string;
  starsAmount: number;
  telegramId: number;
}) {
  await ensurePaymentsTable();
  const db = getDb();

  // Find pending payment by payload
  const result = await db.execute(
    sql`SELECT * FROM star_payments WHERE payload = ${opts.payload} LIMIT 1`
  );
  const row = (result[0] as any[])?.[0];

  if (!row) {
    console.error(`[fulfillPayment] Payment not found for payload: ${opts.payload}`);
    trackError({
      source: "api",
      endpoint: "payments.fulfill",
      error: `Payment not found: ${opts.payload}`,
      meta: opts,
    });
    return { success: false, reason: "Payment not found" };
  }

  if (row.status === "completed") {
    console.log(`[fulfillPayment] Already completed: ${opts.payload}`);
    return { success: true, alreadyCompleted: true };
  }

  // Validate amount
  if (Number(row.stars_amount) !== opts.starsAmount) {
    trackError({
      source: "api",
      endpoint: "payments.fulfill",
      error: `Amount mismatch: expected ${row.stars_amount}, got ${opts.starsAmount}`,
      userId: Number(row.user_id),
    });
    return { success: false, reason: "Amount mismatch" };
  }

  const userId = Number(row.user_id);
  const productId = row.product_id as ProductId;
  const product = STAR_PRODUCTS[productId];

  if (!product) {
    trackError({
      source: "api",
      endpoint: "payments.fulfill",
      error: `Unknown product: ${productId}`,
      userId,
    });
    return { success: false, reason: "Unknown product" };
  }

  const user = await findUserById(userId);
  if (!user) return { success: false, reason: "User not found" };

  try {
    // Apply product effect based on type
    switch ((product as any).type) {
      case "stars": {
        // Add Stars to user balance + bonus
        const totalStars = product.starsAmount + ((product as any).bonus ?? 0);
        await updateUser(userId, { stars: user.stars + totalStars });
        if (user.telegramId) {
          sendBotNotification(user.telegramId,
            `⭐ <b>Покупка успішна!</b>\n\n` +
            `Тобі нараховано <b>${totalStars} Stars</b>` +
            (((product as any).bonus ?? 0) > 0 ? `\n(${product.starsAmount} + ${(product as any).bonus} бонус)` : "")
          ).catch(() => {});
        }
        break;
      }

      case "pack": {
        // Mark product as ready to redeem on next pack open
        // The actual pack opening happens on user click in UI, but we credit them with Stars equivalent
        await updateUser(userId, { stars: user.stars + product.starsAmount });
        if (user.telegramId) {
          sendBotNotification(user.telegramId,
            `🎁 <b>Покупка успішна!</b>\n\n` +
            `Натисни <a href="https://t.me/DropCulture_bot/app">тут</a> щоб відкрити <b>${product.name}</b>`
          ).catch(() => {});
        }
        break;
      }

      case "wheel": {
        await updateUser(userId, { stars: user.stars + product.starsAmount });
        if (user.telegramId) {
          sendBotNotification(user.telegramId,
            `🎡 Доступний 1 спін VIP колеса. Заходь у грі!`
          ).catch(() => {});
        }
        break;
      }

      case "battlepass": {
        // Set premium battle pass flag
        try {
          await db.execute(sql`ALTER TABLE users ADD COLUMN battle_pass_premium TINYINT(1) NOT NULL DEFAULT 0`);
        } catch { /* exists */ }
        await db.execute(sql`UPDATE users SET battle_pass_premium = 1 WHERE id = ${userId}`);
        if (user.telegramId) {
          sendBotNotification(user.telegramId,
            `🏆 <b>Premium Battle Pass активовано!</b>\n\nОтримуй ексклюзивні нагороди до кінця сезону.`
          ).catch(() => {});
        }
        break;
      }

      case "slots": {
        const slotsToAdd = (product as any).slots ?? 100;
        await db.execute(sql`UPDATE users SET inventory_slots = inventory_slots + ${slotsToAdd} WHERE id = ${userId}`);
        if (user.telegramId) {
          sendBotNotification(user.telegramId,
            `📦 <b>+${slotsToAdd} слотів інвентаря!</b>\n\nТепер можна збирати ще більше предметів.`
          ).catch(() => {});
        }
        break;
      }

      default:
        trackError({
          source: "api",
          endpoint: "payments.fulfill",
          error: `Unhandled product type: ${(product as any).type}`,
          userId,
        });
        return { success: false, reason: "Unhandled product type" };
    }

    // Mark payment as completed
    await db.execute(sql`
      UPDATE star_payments
      SET status = 'completed',
          completed_at = NOW(),
          telegram_charge_id = ${opts.telegramChargeId},
          provider_charge_id = ${opts.providerChargeId}
      WHERE id = ${row.id}
    `);

    trackEvent({
      event: "payment_completed",
      userId,
      telegramId: opts.telegramId,
      properties: {
        productId,
        productType: (product as any).type,
        starsAmount: opts.starsAmount,
      },
    });

    return { success: true };
  } catch (err: any) {
    trackError({
      source: "api",
      endpoint: "payments.fulfill",
      error: err,
      userId,
      meta: { productId, payload: opts.payload },
    });
    // Mark payment as failed for manual intervention
    await db.execute(sql`UPDATE star_payments SET status = 'failed' WHERE id = ${row.id}`);
    return { success: false, reason: "Fulfillment error" };
  }
}
