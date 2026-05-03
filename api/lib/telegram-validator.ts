import crypto from "crypto";
import { env } from "./env";

/**
 * Validate Telegram InitData via HMAC.
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Process:
 * 1. Parse query string into key=value pairs
 * 2. Take the `hash` value, remove from pairs
 * 3. Sort remaining pairs alphabetically by key
 * 4. Build data_check_string: "key1=value1\nkey2=value2\n..."
 * 5. secret_key = HMAC_SHA256("WebAppData", BOT_TOKEN)
 * 6. computed_hash = HMAC_SHA256(secret_key, data_check_string)
 * 7. Compare with provided hash (constant time)
 *
 * Also checks auth_date is within 24 hours.
 */
export function validateTelegramInitData(initData: string, maxAgeHours: number = 24): {
  valid: boolean;
  reason?: string;
} {
  if (!env.botToken) {
    // Without bot token we can't validate. In dev — allow. In prod — fail.
    if (env.isProduction) return { valid: false, reason: "BOT_TOKEN missing" };
    return { valid: true };
  }

  if (!initData) return { valid: false, reason: "Empty initData" };

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false, reason: "Missing hash" };

    // Check auth_date freshness
    const authDate = Number(params.get("auth_date"));
    if (!authDate || isNaN(authDate)) return { valid: false, reason: "Missing auth_date" };
    const ageSec = Math.floor(Date.now() / 1000) - authDate;
    if (ageSec > maxAgeHours * 3600) {
      return { valid: false, reason: `InitData too old (${Math.floor(ageSec / 3600)} hours)` };
    }
    if (ageSec < -300) {
      return { valid: false, reason: "InitData from future (clock skew)" };
    }

    // Build data check string (without hash)
    params.delete("hash");
    const sorted: string[] = [];
    for (const [key, value] of params) {
      sorted.push(`${key}=${value}`);
    }
    sorted.sort();
    const dataCheckString = sorted.join("\n");

    // Compute HMAC
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(env.botToken).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    // Constant-time compare
    if (computedHash.length !== hash.length) return { valid: false, reason: "Hash length mismatch" };
    const ok = crypto.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(hash, "hex"));

    return ok ? { valid: true } : { valid: false, reason: "Invalid signature" };
  } catch (err: any) {
    return { valid: false, reason: `Validation error: ${err?.message ?? "unknown"}` };
  }
}
