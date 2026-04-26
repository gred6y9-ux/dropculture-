import { eq, desc } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertItemTemplate, InsertUserItem, InsertCollection } from "@db/schema";
import { getDb } from "./connection";

// Collections
export async function getActiveCollections() {
  return getDb().query.collections.findMany({
    where: eq(schema.collections.isActive, true),
  });
}

export async function getCollectionById(id: number) {
  return getDb().query.collections.findFirst({
    where: eq(schema.collections.id, id),
  });
}

export async function createCollection(data: InsertCollection) {
  const [{ id }] = await getDb()
    .insert(schema.collections)
    .values(data)
    .$returningId();
  return getCollectionById(id);
}

// Item Templates
export async function getTemplatesByCollection(collectionId: number) {
  return getDb().query.itemTemplates.findMany({
    where: eq(schema.itemTemplates.collectionId, collectionId),
  });
}

export async function getTemplateById(id: number) {
  return getDb().query.itemTemplates.findFirst({
    where: eq(schema.itemTemplates.id, id),
    with: { collection: true },
  });
}

export async function getTemplatesByGrade(grade: "Stock" | "Refined" | "Rare" | "Exotic" | "Legacy") {
  return getDb().query.itemTemplates.findMany({
    where: eq(schema.itemTemplates.grade, grade),
  });
}

export async function createItemTemplate(data: InsertItemTemplate) {
  const [{ id }] = await getDb()
    .insert(schema.itemTemplates)
    .values(data)
    .$returningId();
  return getTemplateById(id);
}

// User Items (Inventory)
export async function getUserItems(userId: number) {
  return getDb().query.userItems.findMany({
    where: eq(schema.userItems.userId, userId),
    with: { template: true },
    orderBy: [desc(schema.userItems.acquiredAt)],
  });
}

export async function getUserItemById(id: number) {
  return getDb().query.userItems.findFirst({
    where: eq(schema.userItems.id, id),
    with: { template: true, user: true },
  });
}

export async function createUserItem(data: InsertUserItem) {
  const [{ id }] = await getDb()
    .insert(schema.userItems)
    .values(data)
    .$returningId();
  return getUserItemById(id);
}

export async function getUserItemsByGrade(userId: number, grade: string) {
  const items = await getDb().query.userItems.findMany({
    where: eq(schema.userItems.userId, userId),
    with: { template: true },
  });
  return items.filter((item) => item.template.grade === grade);
}

export async function getListedItems() {
  return getDb().query.userItems.findMany({
    where: eq(schema.userItems.isListed, true),
    with: { template: true, user: true },
  });
}
