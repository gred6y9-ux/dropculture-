import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { upsertTelegramUser } from "./queries/users";
import { createTelegramSessionToken, verifyTelegramSessionToken } from "./telegram-session";
import { findUserById, findUserByTelegramId } from "./queries/users";
import { TRPCError } from "@trpc/server";
import { trackEvent } from "./lib/analytics";
import { trackError } from "./lib/error-tracker";
import { validateTelegramInitData } from "./lib/telegram-validator";
import { checkRateLimit } from "./lib/rate-limiter";

function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

function getUserFromInitData(initData: string) {
  const data = parseInitData(initData);
  const userStr = data.user;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

function getStartParam(initData: string): string | null {
  const data = parseInitData(initData);
  return data.start_param ?? null;
}

export const telegramAuthRouter = createRouter({
  login: publicQuery
    .input(z.object({ initData: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const userData = getUserFromInitData(input.initData);
        if (!userData || !userData.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid init data",
          });
        }

        // Rate limit by telegram ID first (before any DB operations)
        checkRateLimit(`tg:${userData.id}`, "login");

        // Validate Telegram InitData signature (cryptographic check)
        const validation = validateTelegramInitData(input.initData);
        if (!validation.valid) {
          trackError({
            source: "api",
            endpoint: "telegramAuth.login",
            error: `InitData validation failed: ${validation.reason}`,
            telegramId: Number(userData.id),
          });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: `Invalid Telegram credentials: ${validation.reason}`,
          });
        }

        const telegramId = Number(userData.id);
        const existingUser = await findUserByTelegramId(telegramId);
        const isNewUser = !existingUser;

        // Check if user is banned
        if (existingUser && (existingUser as any).banned) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Аккаунт заблокований. ${(existingUser as any).banReason ?? ""}`.trim(),
          });
        }

        const user = await upsertTelegramUser({
          telegramId,
          username: userData.username || null,
          firstName: userData.first_name || null,
          lastName: userData.last_name || null,
          avatar: userData.photo_url || null,
        });

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });
        }

        // Analytics
        trackEvent({
          event: isNewUser ? "user_registered" : "user_login",
          userId: user.id,
          telegramId: user.telegramId ?? undefined,
          properties: {
            username: user.username,
            firstName: user.firstName,
          },
        });

        const token = await createTelegramSessionToken(user.id);

        return {
          token,
          user: {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
            coins: user.coins,
            stars: user.stars,
            streakDays: user.streakDays,
            role: user.role,
          },
        };
      } catch (err: any) {
        // Surface the actual error so we can debug
        const errMsg = err?.message ?? String(err);
        const errStack = err?.stack ?? "";
        console.error("[telegramAuth.login] FAILED:", errMsg);
        console.error("[telegramAuth.login] STACK:", errStack);

        // Track to DB for admin to see
        trackError({
          source: "api",
          endpoint: "telegramAuth.login",
          error: err,
        });

        // Re-throw with detailed message so it shows in HTTP response
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Login failed: ${errMsg}`,
        });
      }
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.replace("Bearer ", "");
    try {
      const payload = await verifyTelegramSessionToken(token);
      if (!payload || !payload.sub) return null;

      const user = await findUserById(Number(payload.sub));
      if (!user) return null;

      return {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        coins: user.coins,
        stars: user.stars,
        streakDays: user.streakDays,
        role: user.role,
      };
    } catch {
      return null;
    }
  }),
});
