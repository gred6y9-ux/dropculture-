import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { getUserItemById, updateUserItem } from "./queries/items";
import { createMarketListing, getActiveListings, getListingById, markListingSold } from "./queries/game";
import { updateUser, findUserById } from "./queries/users";
import { verifyTelegramSessionToken } from "./telegram-session";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";

async function getUser(headers: Headers) {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = await verifyTelegramSessionToken(auth.replace("Bearer ", ""));
  if (!payload?.sub) return null;
  return findUserById(Number(payload.sub));
}

export const marketRouter = createRouter({

  // List item on market
  listItems: publicQuery
    .input(z.object({
      itemId: z.number(),
      price: z.number().min(1),
      currency: z.enum(["coins", "stars", "ton"]).default("coins"),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const item = await getUserItemById(input.itemId);
      if (!item || item.userId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Предмет не знайдено або не твій" });
      }
      if (item.isListed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Вже на маркеті" });
      }

      // Mark item as listed
      await updateUserItem(input.itemId, { isListed: true, marketPrice: input.price });

      const listing = await createMarketListing({
        itemId: input.itemId,
        sellerId: user.id,
        price: input.price,
        currency: input.currency,
      });

      return { success: true, listingId: listing?.id };
    }),

  // Remove listing
  removeListing: publicQuery
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const listing = await getListingById(input.listingId);
      if (!listing || listing.soldAt) throw new TRPCError({ code: "NOT_FOUND" });
      if (listing.sellerId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });

      await markListingSold(listing.id);
      await updateUserItem(listing.itemId, { isListed: false });

      return { success: true };
    }),

  // Get all active listings
  getListings: publicQuery.query(async () => {
    return getActiveListings();
  }),

  // Buy item
  buyItem: publicQuery
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUser(ctx.req.headers);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const listing = await getListingById(input.listingId);
      if (!listing || listing.soldAt) throw new TRPCError({ code: "NOT_FOUND", message: "Лот не знайдено або вже продано" });
      if (listing.sellerId === user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Не можна купити свій лот" });

      const seller = await findUserById(listing.sellerId);
      if (!seller) throw new TRPCError({ code: "NOT_FOUND" });

      // Check balance
      if (listing.currency === "coins" && user.coins < listing.price) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Потрібно ${listing.price} монет, у тебе ${user.coins}` });
      }
      if (listing.currency === "stars" && user.stars < listing.price) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Потрібно ${listing.price} Stars` });
      }

      const fee = Math.floor(listing.price * 0.05); // 5% commission
      const sellerAmount = listing.price - fee;

      if (listing.currency === "coins") {
        await updateUser(user.id, { coins: user.coins - listing.price });
        await updateUser(listing.sellerId, { coins: seller.coins + sellerAmount });
      } else {
        await updateUser(user.id, { stars: user.stars - listing.price });
        await updateUser(listing.sellerId, { stars: seller.stars + sellerAmount });
      }

      // Transfer item ownership
      const db = getDb();
      await db.execute(sql`UPDATE user_items SET user_id = ${user.id}, is_listed = false WHERE id = ${listing.itemId}`);
      await markListingSold(listing.id);

      return { success: true, itemId: listing.itemId, coinsSpent: listing.price, fee };
    }),
});
