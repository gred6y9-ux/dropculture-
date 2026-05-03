import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { upsertTelegramUser } from "./queries/users";
import { createTelegramSessionToken, verifyTelegramSessionToken } from "./telegram-session";
import { findUserById } from "./queries/users";
import { TRPCError } from "@trpc/server";

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

        const telegramId = Number(userData.id);
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
