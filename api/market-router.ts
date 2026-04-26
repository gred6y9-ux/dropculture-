import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { getUserItemById } from "./queries/items";
import { createMarketListing, getActiveListings, getListingById, markListingSold } from "./queries/game";
import { updateUser, findUserById } from "./queries/users";
import { verifyTelegramSessionToken } from "./telegram-session";

async function getUserFromHeader(headers: Headers) {
  const authHeader = headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const payload = await verifyTelegramSessionToken(token);
  if (!payload || !payload.sub) return null;
  return findUserById(Number(payload.sub));
}

export const marketRouter = createRouter({
  listItems: publicQuery
    .input(z.object({ itemId: z.number(), price: z.number().min(1), currency: z.enum(["coins", "stars", "ton"]).default("coins") }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const sellerId = user.id;
      const item = await getUserItemById(input.itemId);
      if (!item || item.userId !== sellerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Item not found or not owned" });
      }
      if (item.isListed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Item already listed" });
      }

      const listing = await createMarketListing({
        itemId: input.itemId,
        sellerId,
        price: input.price,
        currency: input.currency,
      });

      return { success: true, listingId: listing?.id };
    }),

  getListings: publicQuery
    .query(async () => {
      return getActiveListings();
    }),

  buyItem: publicQuery
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserFromHeader(ctx.req.headers);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      const buyerId = user.id;
      const listing = await getListingById(input.listingId);
      if (!listing || listing.soldAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found or already sold" });
      }
      if (listing.sellerId === buyerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot buy your own item" });
      }

      const buyer = await findUserById(buyerId);
      const seller = await findUserById(listing.sellerId);
      if (!buyer || !seller) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (listing.currency === "coins" && buyer.coins < listing.price) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough coins" });
      }
      if (listing.currency === "stars" && buyer.stars < listing.price) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough stars" });
      }

      const fee = Math.floor(listing.price * 0.02);
      const sellerAmount = listing.price - fee;

      if (listing.currency === "coins") {
        await updateUser(buyerId, { coins: buyer.coins - listing.price });
        await updateUser(listing.sellerId, { coins: seller.coins + sellerAmount });
      } else if (listing.currency === "stars") {
        await updateUser(buyerId, { stars: buyer.stars - listing.price });
        await updateUser(listing.sellerId, { stars: seller.stars + sellerAmount });
      }

      await markListingSold(listing.id);

      return { success: true, itemId: listing.itemId };
    }),
});
