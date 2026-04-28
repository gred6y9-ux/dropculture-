import { env } from "./env";

/**
 * Send notification message to user via DropCulture bot.
 * Silently fails if bot token missing or user blocked the bot.
 */
export async function sendBotNotification(telegramId: number | string, text: string, options: {
  parseMode?: "HTML" | "Markdown";
  disableNotification?: boolean;
} = {}): Promise<boolean> {
  if (!env.botToken) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${env.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: options.parseMode ?? "HTML",
        disable_notification: options.disableNotification ?? false,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[telegram-notify] failed:", err);
    return false;
  }
}
