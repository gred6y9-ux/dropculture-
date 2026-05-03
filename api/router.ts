import { telegramAuthRouter } from "./telegram-auth-router";
import { gameRouter } from "./game-router";
import { marketRouter } from "./market-router";
import { seedRouter } from "./seed-router";
import { wheelRouter } from "./wheel-router";
import { adminRouter } from "./admin-router";
import { referralRouter } from "./referral-router";
import { paymentsRouter } from "./payments-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  telegramAuth: telegramAuthRouter,
  game: gameRouter,
  market: marketRouter,
  seed: seedRouter,
  wheel: wheelRouter,
  admin: adminRouter,
  referral: referralRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
