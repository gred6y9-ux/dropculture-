import { telegramAuthRouter } from "./telegram-auth-router";
import { gameRouter } from "./game-router";
import { marketRouter } from "./market-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  telegramAuth: telegramAuthRouter,
  game: gameRouter,
  market: marketRouter,
});

export type AppRouter = typeof appRouter;
