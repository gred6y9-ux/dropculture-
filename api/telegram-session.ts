import * as jose from "jose";
import { env } from "./lib/env";

const JWT_ALG = "HS256";

export type TelegramSessionPayload = {
  sub: string;
  iat?: number;
  exp?: number;
};

export async function createTelegramSessionToken(userId: number): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret);
  return new jose.SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

export async function verifyTelegramSessionToken(token: string): Promise<TelegramSessionPayload | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
      clockTolerance: 60,
    });
    if (!payload.sub) return null;
    return { sub: String(payload.sub), iat: payload.iat, exp: payload.exp };
  } catch (error) {
    console.warn("[telegram session] JWT verification failed:", error);
    return null;
  }
}
