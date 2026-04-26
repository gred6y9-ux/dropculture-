import { getDb } from "../api/queries/connection";
import * as schema from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Create Digital Souls collection
  const [collection] = await db.insert(schema.collections).values({
    name: "Digital Souls",
    description: "Glass spheres with trapped energy. Abstract art meets rarity.",
    imageUrl: "/assets/digital-souls-cover.jpg",
    isActive: true,
  }).$returningId();

  console.log("Created collection:", collection.id);

  // Seed item templates
  await db.insert(schema.itemTemplates).values([
    {
      collectionId: collection.id,
      name: "Void Sphere",
      grade: "Stock",
      description: "Dark empty sphere with minimal glow",
      basePriceMin: 10,
      basePriceMax: 50,
    },
    {
      collectionId: collection.id,
      name: "Static Core",
      grade: "Refined",
      description: "Blue lightning bolts inside",
      basePriceMin: 50,
      basePriceMax: 200,
    },
    {
      collectionId: collection.id,
      name: "Nebula Heart",
      grade: "Rare",
      description: "Nebula in galaxy colors",
      basePriceMin: 200,
      basePriceMax: 1000,
    },
    {
      collectionId: collection.id,
      name: "Plasma Cage",
      grade: "Exotic",
      description: "Pulsing pink liquid energy",
      basePriceMin: 1000,
      basePriceMax: 5000,
    },
    {
      collectionId: collection.id,
      name: "Eternal Flame",
      grade: "Legacy",
      description: "Golden core with fire crown",
      basePriceMin: 5000,
      basePriceMax: 15000,
    },
    {
      collectionId: collection.id,
      name: "Glitch Shell",
      grade: "Exotic",
      description: "Broken texture, glitch aesthetics",
      basePriceMin: 1000,
      basePriceMax: 5000,
    },
    {
      collectionId: collection.id,
      name: "Mirror Drop",
      grade: "Rare",
      description: "Mirror surface, reflects surroundings",
      basePriceMin: 200,
      basePriceMax: 1000,
    },
    {
      collectionId: collection.id,
      name: "Crystal Shard",
      grade: "Refined",
      description: "Crystalline geometry inside",
      basePriceMin: 50,
      basePriceMax: 200,
    },
    {
      collectionId: collection.id,
      name: "Abyss Eye",
      grade: "Legacy",
      description: "Black sphere with galaxy pupil",
      basePriceMin: 5000,
      basePriceMax: 20000,
    },
    {
      collectionId: collection.id,
      name: "Prism Light",
      grade: "Exotic",
      description: "Rainbow shimmer on movement",
      basePriceMin: 1000,
      basePriceMax: 5000,
    },
  ]);

  console.log("Created 10 item templates");
  console.log("Done.");
  process.exit(0);
}

seed();
