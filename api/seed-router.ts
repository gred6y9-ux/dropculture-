import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";

export const seedRouter = createRouter({
  init: publicQuery
    .input(z.object({ secret: z.string() }))
    .mutation(async ({ input }) => {
      if (input.secret !== env.appSecret) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Wrong secret" });
      }

      const db = getDb();

      // Drop all tables to start fresh
      await db.execute(sql`DROP TABLE IF EXISTS user_items`);
      await db.execute(sql`DROP TABLE IF EXISTS pack_opens`);
      await db.execute(sql`DROP TABLE IF EXISTS daily_claims`);
      await db.execute(sql`DROP TABLE IF EXISTS market_listings`);
      await db.execute(sql`DROP TABLE IF EXISTS transactions`);
      await db.execute(sql`DROP TABLE IF EXISTS item_templates`);
      await db.execute(sql`DROP TABLE IF EXISTS collections`);
      await db.execute(sql`DROP TABLE IF EXISTS users`);

      // Create users with all required columns
      await db.execute(sql`
        CREATE TABLE users (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          telegram_id BIGINT UNIQUE,
          unionId VARCHAR(255) UNIQUE,
          username VARCHAR(255),
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          name VARCHAR(255),
          email VARCHAR(320),
          avatar TEXT,
          role ENUM('user','admin') NOT NULL DEFAULT 'user',
          coins INT NOT NULL DEFAULT 500,
          stars INT NOT NULL DEFAULT 0,
          streak_days INT NOT NULL DEFAULT 0,
          last_claim_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_sign_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX telegram_idx (telegram_id),
          INDEX union_idx (unionId)
        )
      `);

      await db.execute(sql`
        CREATE TABLE collections (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          image_url TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE item_templates (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          collection_id BIGINT UNSIGNED NOT NULL,
          name VARCHAR(255) NOT NULL,
          grade ENUM('Stock','Refined','Rare','Exotic','Legacy') NOT NULL,
          image_url TEXT,
          description TEXT,
          base_price_min INT NOT NULL DEFAULT 10,
          base_price_max INT NOT NULL DEFAULT 50,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE user_items (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          template_id BIGINT UNSIGNED NOT NULL,
          float_val FLOAT NOT NULL DEFAULT 0.15,
          pattern_seed INT NOT NULL DEFAULT 1,
          serial_num INT NOT NULL DEFAULT 1,
          market_price INT NOT NULL DEFAULT 0,
          is_listed BOOLEAN NOT NULL DEFAULT FALSE,
          acquired_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX user_idx (user_id),
          INDEX template_idx (template_id),
          INDEX listed_idx (is_listed)
        )
      `);

      await db.execute(sql`
        CREATE TABLE pack_opens (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          pack_type ENUM('daily','premium','vip') NOT NULL DEFAULT 'daily',
          items_count INT NOT NULL DEFAULT 5,
          opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE daily_claims (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          claimed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          streak_day INT NOT NULL DEFAULT 1,
          INDEX user_claimed_idx (user_id, claimed_at)
        )
      `);

      await db.execute(sql`
        CREATE TABLE market_listings (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          item_id BIGINT UNSIGNED NOT NULL,
          seller_id BIGINT UNSIGNED NOT NULL,
          price INT NOT NULL,
          currency ENUM('coins','stars','ton') NOT NULL DEFAULT 'coins',
          listed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          sold_at TIMESTAMP NULL,
          INDEX seller_idx (seller_id),
          INDEX item_idx (item_id)
        )
      `);

      await db.execute(sql`
        CREATE TABLE transactions (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          item_id BIGINT UNSIGNED NOT NULL,
          seller_id BIGINT UNSIGNED NOT NULL,
          buyer_id BIGINT UNSIGNED NOT NULL,
          price INT NOT NULL,
          currency ENUM('coins','stars','ton') NOT NULL DEFAULT 'coins',
          fee INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert collection
      const [collection] = await db.insert(schema.collections).values({
        name: "Digital Souls",
        description: "Glass spheres with trapped energy.",
        imageUrl: "/assets/digital-souls-cover.jpg",
        isActive: true,
      }).$returningId();

      // Insert templates
      await db.insert(schema.itemTemplates).values([
        { collectionId: collection.id, name: "Void Sphere", grade: "Stock", description: "Dark empty sphere", basePriceMin: 10, basePriceMax: 50 },
        { collectionId: collection.id, name: "Static Core", grade: "Refined", description: "Blue lightning inside", basePriceMin: 50, basePriceMax: 200 },
        { collectionId: collection.id, name: "Nebula Heart", grade: "Rare", description: "Galaxy nebula", basePriceMin: 200, basePriceMax: 1000 },
        { collectionId: collection.id, name: "Plasma Cage", grade: "Exotic", description: "Pulsing pink liquid", basePriceMin: 1000, basePriceMax: 5000 },
        { collectionId: collection.id, name: "Eternal Flame", grade: "Legacy", description: "Golden core fire", basePriceMin: 5000, basePriceMax: 15000 },
        { collectionId: collection.id, name: "Glitch Shell", grade: "Exotic", description: "Glitch aesthetics", basePriceMin: 1000, basePriceMax: 5000 },
        { collectionId: collection.id, name: "Mirror Drop", grade: "Rare", description: "Mirror surface", basePriceMin: 200, basePriceMax: 1000 },
        { collectionId: collection.id, name: "Crystal Shard", grade: "Refined", description: "Crystal geometry", basePriceMin: 50, basePriceMax: 200 },
        { collectionId: collection.id, name: "Abyss Eye", grade: "Legacy", description: "Galaxy pupil", basePriceMin: 5000, basePriceMax: 20000 },
        { collectionId: collection.id, name: "Prism Light", grade: "Exotic", description: "Rainbow shimmer", basePriceMin: 1000, basePriceMax: 5000 },
      ]);

      return { message: "Database fully reinitialized!", collectionId: collection.id };
    }),
});
