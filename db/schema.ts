import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  float,
  int,
  boolean,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable(
  "users",
  {
    id: serial("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).unique(),
    unionId: varchar("unionId", { length: 255 }).unique(),
    username: varchar("username", { length: 255 }),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 320 }),
    avatar: text("avatar"),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    coins: int("coins").default(500).notNull(),
    stars: int("stars").default(0).notNull(),
    streakDays: int("streak_days").default(0).notNull(),
    lastClaimAt: timestamp("last_claim_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    lastSignInAt: timestamp("last_sign_in_at").defaultNow().notNull(),
  },
  (table) => ({
    telegramIdx: index("telegram_idx").on(table.telegramId),
    unionIdx: index("union_idx").on(table.unionId),
  })
);

export const collections = mysqlTable("collections", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const itemTemplates = mysqlTable("item_templates", {
  id: serial("id").primaryKey(),
  collectionId: bigint("collection_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  grade: mysqlEnum("grade", ["Stock", "Refined", "Rare", "Exotic", "Legacy"]).notNull(),
  imageUrl: text("image_url"),
  description: text("description"),
  basePriceMin: int("base_price_min").default(10).notNull(),
  basePriceMax: int("base_price_max").default(50).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userItems = mysqlTable(
  "user_items",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    templateId: bigint("template_id", { mode: "number", unsigned: true }).notNull(),
    floatVal: float("float_val").default(0.15).notNull(),
    patternSeed: int("pattern_seed").default(1).notNull(),
    serialNum: int("serial_num").default(1).notNull(),
    marketPrice: int("market_price").default(0).notNull(),
    isListed: boolean("is_listed").default(false).notNull(),
    acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_idx").on(table.userId),
    templateIdx: index("template_idx").on(table.templateId),
    listedIdx: index("listed_idx").on(table.isListed),
  })
);

export const packOpens = mysqlTable("pack_opens", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  packType: mysqlEnum("pack_type", ["daily", "premium", "vip"]).default("daily").notNull(),
  itemsCount: int("items_count").default(5).notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
});

export const dailyClaims = mysqlTable(
  "daily_claims",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    claimedAt: timestamp("claimed_at").defaultNow().notNull(),
    streakDay: int("streak_day").default(1).notNull(),
  },
  (table) => ({
    userClaimedIdx: index("user_claimed_idx").on(table.userId, table.claimedAt),
  })
);

export const marketListings = mysqlTable(
  "market_listings",
  {
    id: serial("id").primaryKey(),
    itemId: bigint("item_id", { mode: "number", unsigned: true }).notNull(),
    sellerId: bigint("seller_id", { mode: "number", unsigned: true }).notNull(),
    price: int("price").notNull(),
    currency: mysqlEnum("currency", ["coins", "stars", "ton"]).default("coins").notNull(),
    listedAt: timestamp("listed_at").defaultNow().notNull(),
    soldAt: timestamp("sold_at"),
  },
  (table) => ({
    sellerIdx: index("seller_idx").on(table.sellerId),
    itemIdx: index("item_idx").on(table.itemId),
  })
);

export const transactions = mysqlTable("transactions", {
  id: serial("id").primaryKey(),
  itemId: bigint("item_id", { mode: "number", unsigned: true }).notNull(),
  sellerId: bigint("seller_id", { mode: "number", unsigned: true }).notNull(),
  buyerId: bigint("buyer_id", { mode: "number", unsigned: true }).notNull(),
  price: int("price").notNull(),
  currency: mysqlEnum("currency", ["coins", "stars", "ton"]).default("coins").notNull(),
  fee: int("fee").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  items: many(userItems),
  packOpens: many(packOpens),
  dailyClaims: many(dailyClaims),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  templates: many(itemTemplates),
}));

export const itemTemplatesRelations = relations(itemTemplates, ({ one, many }) => ({
  collection: one(collections, {
    fields: [itemTemplates.collectionId],
    references: [collections.id],
  }),
  userItems: many(userItems),
}));

export const userItemsRelations = relations(userItems, ({ one }) => ({
  user: one(users, {
    fields: [userItems.userId],
    references: [users.id],
  }),
  template: one(itemTemplates, {
    fields: [userItems.templateId],
    references: [itemTemplates.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;
export type ItemTemplate = typeof itemTemplates.$inferSelect;
export type InsertItemTemplate = typeof itemTemplates.$inferInsert;
export type UserItem = typeof userItems.$inferSelect;
export type InsertUserItem = typeof userItems.$inferInsert;
export type PackOpen = typeof packOpens.$inferSelect;
export type InsertPackOpen = typeof packOpens.$inferInsert;
export type DailyClaim = typeof dailyClaims.$inferSelect;
export type InsertDailyClaim = typeof dailyClaims.$inferInsert;
export type MarketListing = typeof marketListings.$inferSelect;
export type InsertMarketListing = typeof marketListings.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
