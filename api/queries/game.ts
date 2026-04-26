import { eq, and, gte, desc, sql, isNull } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertPackOpen, InsertDailyClaim, InsertMarketListing, InsertTransaction } from "@db/schema";
import { getDb } from "./connection";

// Pack Opens
export async function createPackOpen(data: InsertPackOpen) {
  const [{ id }] = await getDb()
    .insert(schema.packOpens)
    .values(data)
    .$returningId();
  return getDb().query.packOpens.findFirst({
    where: eq(schema.packOpens.id, id),
  });
}

export async function getUserPackOpens(userId: number, limit = 50) {
  return getDb().query.packOpens.findMany({
    where: eq(schema.packOpens.userId, userId),
    orderBy: [desc(schema.packOpens.openedAt)],
    limit,
  });
}

// Daily Claims
export async function getLastDailyClaim(userId: number) {
  return getDb().query.dailyClaims.findFirst({
    where: eq(schema.dailyClaims.userId, userId),
    orderBy: [desc(schema.dailyClaims.claimedAt)],
  });
}

export async function getDailyClaimsCount(userId: number, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  return getDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.dailyClaims)
    .where(
      and(
        eq(schema.dailyClaims.userId, userId),
        gte(schema.dailyClaims.claimedAt, startOfDay)
      )
    );
}

export async function createDailyClaim(data: InsertDailyClaim) {
  const [{ id }] = await getDb()
    .insert(schema.dailyClaims)
    .values(data)
    .$returningId();
  return getDb().query.dailyClaims.findFirst({
    where: eq(schema.dailyClaims.id, id),
  });
}

// Market
export async function createMarketListing(data: InsertMarketListing) {
  const [{ id }] = await getDb()
    .insert(schema.marketListings)
    .values(data)
    .$returningId();
  return getDb().query.marketListings.findFirst({
    where: eq(schema.marketListings.id, id),
  });
}

export async function getActiveListings() {
  return getDb().query.marketListings.findMany({
    where: isNull(schema.marketListings.soldAt),
    with: {
      item: {
        with: { template: true },
      },
      seller: true,
    },
    orderBy: [desc(schema.marketListings.listedAt)],
  });
}

export async function getListingById(id: number) {
  return getDb().query.marketListings.findFirst({
    where: eq(schema.marketListings.id, id),
    with: {
      item: {
        with: { template: true },
      },
      seller: true,
    },
  });
}

export async function markListingSold(id: number) {
  await getDb()
    .update(schema.marketListings)
    .set({ soldAt: new Date() })
    .where(eq(schema.marketListings.id, id));
}

// Transactions
export async function createTransaction(data: InsertTransaction) {
  const [{ id }] = await getDb()
    .insert(schema.transactions)
    .values(data)
    .$returningId();
  return getDb().query.transactions.findFirst({
    where: eq(schema.transactions.id, id),
  });
}
