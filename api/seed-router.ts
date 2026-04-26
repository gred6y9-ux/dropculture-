import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { env } from "./lib/env";

export const seedRouter = createRouter({
  init: publicQuery
    .input(z.object({ secret: z.string() }))
    .mutation(async ({ input }) => {
      if (input.secret !== env.appSecret) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Wrong secret" });
      }

      const db = getDb();

      const existing = await db.select().from(schema.collections);
      if (existing.length > 0) {
        return { message: "Already seeded", collections: existing.length };
      }

      const [collection] = await db.insert(schema.collections).values({
        name: "Digital Souls",
        description: "Glass spheres with trapped energy.",
        imageUrl: "/assets/digital-souls-cover.jpg",
        isActive: true,
      }).$returningId();

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

      return { message: "Seeded successfully", collection: collection.id };
    }),
});
