import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";
import { fulfillPayment } from "./payments-router";
import { answerPreCheckout } from "./lib/telegram-payments";

// ── Run startup migrations ──────────────────────────────────────
async function runMigrations() {
  const db = getDb();
  const migrations = [
    `ALTER TABLE users ADD COLUMN inventory_slots INT NOT NULL DEFAULT 100`,
    `ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN ban_reason VARCHAR(500) NULL`,
    `ALTER TABLE users ADD COLUMN battle_pass_premium TINYINT(1) NOT NULL DEFAULT 0`,
  ];
  for (const m of migrations) {
    try {
      await db.execute(sql.raw(m));
      console.log(`[migrate] OK: ${m}`);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("Duplicate") || msg.includes("already exists") || msg.includes("1060")) {
        console.log(`[migrate] SKIP (already applied): ${m.substring(0, 60)}...`);
      } else {
        console.error(`[migrate] FAILED: ${m}`, msg);
      }
    }
  }
}

const app = new Hono<{ Bindings: HttpBindings }>();
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// ── Telegram Bot Webhook ───────────────────────────────────────
// Setup once: POST https://api.telegram.org/bot<TOKEN>/setWebhook with
//   { url: "https://YOUR_DOMAIN/api/webhook/telegram" }
app.post("/api/webhook/telegram", async (c) => {
  try {
    const update = await c.req.json();

    // Handle pre_checkout_query — must respond within 10s
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      console.log(`[webhook] pre_checkout_query: ${q.invoice_payload}`);
      // Always approve — we'll validate in successful_payment
      await answerPreCheckout(q.id, true);
      return c.json({ ok: true });
    }

    // Handle successful_payment — actually grant the goods
    if (update.message?.successful_payment) {
      const pay = update.message.successful_payment;
      const fromId = update.message.from?.id;
      console.log(`[webhook] successful_payment from ${fromId}: ${pay.invoice_payload}, ${pay.total_amount} XTR`);

      const result = await fulfillPayment({
        payload: pay.invoice_payload,
        telegramChargeId: pay.telegram_payment_charge_id,
        providerChargeId: pay.provider_payment_charge_id ?? "",
        starsAmount: pay.total_amount,
        telegramId: fromId,
      });

      if (!result.success) {
        console.error(`[webhook] fulfillment failed:`, result);
      }
      return c.json({ ok: true });
    }

    // Handle /start command (for ref_ deeplinks via bot)
    if (update.message?.text === "/start" || update.message?.text?.startsWith("/start ")) {
      const fromId = update.message.from?.id;
      const startParam = update.message.text.replace("/start", "").trim();

      // Send welcome message with WebApp button
      if (env.botToken && fromId) {
        const welcomeText = startParam
          ? `🎉 <b>Ласкаво просимо в DropCulture!</b>\n\nТебе запросив друг — отримай 200 монет бонусу. Натисни кнопку нижче щоб почати.`
          : `🎮 <b>DropCulture</b>\n\nВідкривай паки · Колекціонуй · Торгуй\n\nНатисни кнопку нижче щоб запустити гру.`;

        const webAppUrl = startParam
          ? `https://t.me/DropCulture_bot/app?startapp=${encodeURIComponent(startParam)}`
          : `https://t.me/DropCulture_bot/app`;

        fetch(`https://api.telegram.org/bot${env.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: fromId,
            text: welcomeText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "🚀 Запустити DropCulture", url: webAppUrl }
              ]],
            },
          }),
        }).catch(() => {});
      }
      return c.json({ ok: true });
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("[webhook] error:", err);
    return c.json({ ok: false }, 500);
  }
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  // Run migrations BEFORE accepting requests
  await runMigrations();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
