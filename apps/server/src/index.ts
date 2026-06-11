import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { syncPostsFromContent } from "./content/sync";
import { runMigrations } from "./db/client";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";

runMigrations();

const sync = syncPostsFromContent();
console.log(`[taoran-server] content sync: ${sync.synced} posts`);
if (sync.errors.length) console.warn("[taoran-server] frontmatter 校验失败：", sync.errors);

const app = new Hono();

app.use(logger());
app.use(
  "/api/*",
  cors({
    origin: [
      process.env.SITE_URL ?? "http://localhost:4321",
      process.env.ADMIN_URL ?? "http://localhost:5173",
    ],
    credentials: true,
  }),
);

app.get("/api/health", (c) =>
  c.json({ ok: true, name: "taoran-server", version: "0.0.1" }),
);

// 公开接口（docs/07-data.md §5）
app.route("/api/v1", publicRoutes);

// 管理接口（docs/06-site-admin.md §4）
app.route("/api/admin", adminRoutes);

const port = Number(process.env.SERVER_PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[taoran-server] listening on http://localhost:${info.port}`);
});
