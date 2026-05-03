import { env } from "./env";

/**
 * Create a Telegram Stars invoice link via Bot API.
 * Returns the invoice URL that opens payment dialog in Telegram.
 *
 * Docs: https://core.telegram.org/bots/api#createinvoicelink
 */
export async function createStarsInvoice(opts: {
  title: string;
  description: string;
  payload: string; // our internal payment ID, returned in successful_payment
  starsAmount: number; // amount in Telegram Stars (XTR)
  photoUrl?: string;
}): Promise<string | null> {
  if (!env.botToken) {
    console.error("[telegram-payments] BOT_TOKEN missing");
    return null;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${env.botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: opts.title.substring(0, 32),
        description: opts.description.substring(0, 255),
        payload: opts.payload,
        provider_token: "", // empty for Stars
        currency: "XTR",
        prices: [{ label: opts.title.substring(0, 32), amount: opts.starsAmount }],
        photo_url: opts.photoUrl,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("[telegram-payments] createInvoiceLink failed:", data);
      return null;
    }
    return data.result as string;
  } catch (err) {
    console.error("[telegram-payments] error:", err);
    return null;
  }
}

/**
 * Answer a pre_checkout_query (must be called within 10s of receiving query).
 * Telegram sends this just before the user pays — we say OK or reject.
 */
export async function answerPreCheckout(queryId: string, ok: boolean, errorMessage?: string): Promise<boolean> {
  if (!env.botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.botToken}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_checkout_query_id: queryId,
        ok,
        error_message: ok ? undefined : (errorMessage ?? "Payment cannot be processed"),
      }),
    });
    return (await res.json()).ok === true;
  } catch (err) {
    console.error("[answerPreCheckout] error:", err);
    return false;
  }
}

/**
 * Refund a Stars payment if needed.
 */
export async function refundStarsPayment(userTelegramId: number, telegramPaymentChargeId: string): Promise<boolean> {
  if (!env.botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.botToken}/refundStarPayment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userTelegramId,
        telegram_payment_charge_id: telegramPaymentChargeId,
      }),
    });
    return (await res.json()).ok === true;
  } catch (err) {
    console.error("[refundStarsPayment] error:", err);
    return false;
  }
}

/**
 * Set bot webhook URL for receiving updates (one-time setup).
 */
export async function setWebhook(url: string): Promise<boolean> {
  if (!env.botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        allowed_updates: ["pre_checkout_query", "successful_payment", "message"],
      }),
    });
    return (await res.json()).ok === true;
  } catch (err) {
    console.error("[setWebhook] error:", err);
    return false;
  }
}
