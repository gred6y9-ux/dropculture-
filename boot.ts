import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";

// ── Run startup migrations ──────────────────────────────────────
async function runMigrations() {
  const db = getDb();
  const migrations = [
    `ALTER TABLE users ADD COLUMN inventory_slots INT NOT NULL DEFAULT 100`,
  ];
  for (const m of migrations) {
    try {
      await db.execute(sql.raw(m));
      console.log(`[migrate] OK: ${m}`);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("Duplicate") || msg.includes("already exists") || msg.includes("1060")) {
        console.log(`[migrate] SKIP (already applied): ${m}`);
      } else {
        console.error(`[migrate] FAILED: ${m}`, msg);
      }
    }
  }
}

const app = new Hono<{ Bindings: HttpBindings }>();
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  // Run migrations BEFORE accepting requests
  await runMigrations();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
