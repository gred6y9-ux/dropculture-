import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { verifyTelegramSessionToken } from "./telegram-session";
import { findUserById } from "./queries/users";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    const authHeader = opts.req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const payload = await verifyTelegramSessionToken(token);
      if (payload?.sub) {
        const user = await findUserById(Number(payload.sub));
        if (user) ctx.user = user;
      }
    }
  } catch {
    // Auth is optional — each route checks independently
  }
  return ctx;
}
