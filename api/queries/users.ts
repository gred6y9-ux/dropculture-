import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function findUserByTelegramId(telegramId: number) {
  return getDb().query.users.findFirst({
    where: eq(schema.users.telegramId, telegramId),
  });
}

export async function findUserById(id: number) {
  return getDb().query.users.findFirst({
    where: eq(schema.users.id, id),
  });
}

export async function createUser(data: Omit<InsertUser, "id">) {
  const [{ id }] = await getDb()
    .insert(schema.users)
    .values(data)
    .$returningId();
  return findUserById(id);
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  await getDb()
    .update(schema.users)
    .set(data)
    .where(eq(schema.users.id, id));
  return findUserById(id);
}

export async function upsertTelegramUser(data: {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
}) {
  const existing = await findUserByTelegramId(data.telegramId);
  if (existing) {
    await getDb()
      .update(schema.users)
      .set({
        username: data.username ?? existing.username,
        firstName: data.firstName ?? existing.firstName,
        lastName: data.lastName ?? existing.lastName,
        avatar: data.avatar ?? existing.avatar,
        lastSignInAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existing.id));
    return findUserById(existing.id);
  }
  return createUser({
    telegramId: data.telegramId,
    username: data.username ?? null,
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    avatar: data.avatar ?? null,
    role: "user",
    coins: 500,
    stars: 0,
    streakDays: 0,
    lastClaimAt: null,
  });
}

export async function upsertUser(data: Partial<InsertUser> & { unionId: string }) {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    ...data,
  };

  if (
    values.role === undefined &&
    values.unionId &&
    values.unionId === env.ownerUnionId
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await getDb()
    .insert(schema.users)
    .values(values as InsertUser)
    .onDuplicateKeyUpdate({ set: updateSet });
}
