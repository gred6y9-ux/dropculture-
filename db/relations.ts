import { relations } from "drizzle-orm";
import { users, itemTemplates, userItems, collections, packOpens, dailyClaims } from "./schema";

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
