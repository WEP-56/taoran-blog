import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { runMigrations } from "./db/client";

runMigrations();

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

// 公开接口挂载点（/api/v1/*，M3 实现，见 docs/07-data.md §5）
app.get("/api/v1/ping", (c) => c.json({ pong: true }));

// 管理接口挂载点（/api/admin/*，M4 实现，见 docs/06-site-admin.md §4）

const port = Number(process.env.SERVER_PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[taoran-server] listening on http://localhost:${info.port}`);
});
