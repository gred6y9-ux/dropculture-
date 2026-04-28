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

      // Price guardrails: ±50% from market price for coins
      if (input.currency === "coins") {
        const marketPrice = item.marketPrice ?? 0;
        if (marketPrice > 0) {
          const minPrice = Math.floor(marketPrice * 0.5);
          const maxPrice = Math.floor(marketPrice * 1.5);
          if (input.price < minPrice) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Мінімум: ${minPrice.toLocaleString()}₵ (50% від ринку)` });
          }
          if (input.price > maxPrice) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Максимум: ${maxPrice.toLocaleString()}₵ (150% від ринку)` });
          }
        }
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

      // Log transaction so both seller and buyer see it in history
      await db.execute(sql`
        INSERT INTO transactions (item_id, seller_id, buyer_id, price, currency, fee)
        VALUES (${listing.itemId}, ${listing.sellerId}, ${user.id}, ${listing.price}, ${listing.currency}, ${fee})
      `);

      return { success: true, itemId: listing.itemId, coinsSpent: listing.price, fee };
    }),

  // ── Get my transaction history (sales + purchases) ─────────────
  getMyTransactions: publicQuery.query(async ({ ctx }) => {
    const user = await getUser(ctx.req.headers);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = getDb();
    const result = await db.execute(sql`
      SELECT
        t.id, t.item_id, t.seller_id, t.buyer_id, t.price, t.currency, t.fee, t.created_at,
        ut.user_id as current_owner_id,
        it.name as item_name, it.grade as item_grade,
        seller_user.username as seller_username, seller_user.first_name as seller_first_name,
        buyer_user.username as buyer_username, buyer_user.first_name as buyer_first_name
      FROM transactions t
      LEFT JOIN user_items ut ON ut.id = t.item_id
      LEFT JOIN item_templates it ON it.id = ut.template_id
      LEFT JOIN users seller_user ON seller_user.id = t.seller_id
      LEFT JOIN users buyer_user ON buyer_user.id = t.buyer_id
      WHERE t.seller_id = ${user.id} OR t.buyer_id = ${user.id}
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

    const rows = (result[0] as any[]) ?? [];
    return rows.map(r => ({
      id: r.id,
      type: Number(r.seller_id) === Number(user.id) ? "sold" : "bought",
      itemName: r.item_name ?? "Невідомий предмет",
      itemGrade: r.item_grade ?? "Stock",
      price: r.price,
      currency: r.currency,
      fee: r.fee,
      received: Number(r.seller_id) === Number(user.id) ? r.price - r.fee : 0,
      otherUser: Number(r.seller_id) === Number(user.id)
        ? (r.buyer_first_name ?? r.buyer_username ?? "Гравець")
        : (r.seller_first_name ?? r.seller_username ?? "Гравець"),
      createdAt: r.created_at,
    }));
  }),
});
