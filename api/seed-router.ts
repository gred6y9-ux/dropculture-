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

      // Create all tables
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          telegram_id BIGINT UNIQUE NOT NULL,
          username VARCHAR(255),
          first_name VARCHAR(255),
          avatar VARCHAR(500),
          coins INT DEFAULT 100,
          stars INT DEFAULT 0,
          streak_days INT DEFAULT 0,
          last_claim_at TIMESTAMP NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS collections (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          image_url VARCHAR(500),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS item_templates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          collection_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          grade VARCHAR(50) NOT NULL,
          description TEXT,
          image_url VARCHAR(500),
          base_price_min INT DEFAULT 0,
          base_price_max INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          template_id INT NOT NULL,
          float_val FLOAT DEFAULT 0,
          pattern_seed INT DEFAULT 0,
          serial_num INT DEFAULT 0,
          market_price INT DEFAULT 0,
          is_listed BOOLEAN DEFAULT FALSE,
          obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS market_listings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          item_id INT NOT NULL,
          seller_id INT NOT NULL,
          price INT NOT NULL,
          currency VARCHAR(20) DEFAULT 'coins',
          listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sold_at TIMESTAMP NULL
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pack_opens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          pack_type VARCHAR(50),
          items_count INT DEFAULT 0,
          opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS daily_claims (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          streak_day INT DEFAULT 1,
          claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Check if already seeded
      const existing = await db.select().from(schema.collections);
      if (existing.length > 0) {
        return { message: "Tables created, already seeded", collections: existing.length };
      }

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

      return { message: "Database initialized!", collectionId: collection.id };
    }),
});
