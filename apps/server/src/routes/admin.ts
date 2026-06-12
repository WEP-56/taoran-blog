import path from "node:path";
import { postFrontmatterSchema } from "@taoran/content";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import sharp from "sharp";
import { z } from "zod";
import { audit, createSession, destroySession, requireAuth, verifyPassword } from "../auth/session";
import { addFriend, deleteFriend, friendSchema, listFriends } from "../content/friends-admin";
import { validatePostMdx } from "../content/mdx-validate";
import { addMoment, deleteMoment, listMoments } from "../content/moments-admin";
import { findPostFile, listPostFiles, trashPostFile, writePostFile } from "../content/posts-admin";
import { db } from "../db/client";
import { assets, comments, posts, viewsDaily } from "../db/schema";
import { enqueueRebuild, getRebuildStatus } from "../jobs/rebuild";
import { ipHash } from "../lib/hash";
import { clientIp, rateLimit } from "../lib/ratelimit";

/** 管理接口 /api/admin/*（docs/06-site-admin.md §4） */
export const adminRoutes = new Hono();

/* ── 鉴权（登录本身不需要会话） ── */
adminRoutes.post(
  "/auth/login",
  rateLimit({ name: "login", max: 5, windowMs: 60_000, keyOf: (c) => ipHash(clientIp(c)) }),
  async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { password?: string };
    if (!body.password || !(await verifyPassword(body.password))) {
      audit("login.fail", null, c);
      return c.json({ error: { code: "bad_credentials", message: "口令不对" } }, 401);
    }
    createSession(c);
    audit("login.ok", null, c);
    return c.json({ ok: true });
  },
);

adminRoutes.use("/*", async (c, next) => {
  // login 之外全部走守卫
  if (c.req.path.endsWith("/auth/login")) return next();
  return requireAuth(c, next);
});

adminRoutes.get("/auth/me", (c) => c.json({ ok: true }));
adminRoutes.post("/auth/logout", (c) => {
  destroySession(c);
  return c.json({ ok: true });
});

/* ── 文章 ── */
adminRoutes.get("/posts", (c) => {
  const stats = new Map(db.select().from(posts).all().map((p) => [p.slug, p]));
  const list = listPostFiles().map((fm) => ({
    slug: fm.slug,
    title: fm.title,
    date: fm.date,
    status: fm.status,
    pinned: fm.pinned,
    tags: fm.tags,
    views: stats.get(fm.slug)?.viewsCount ?? 0,
    likes: stats.get(fm.slug)?.likesCount ?? 0,
    comments: stats.get(fm.slug)?.commentsCount ?? 0,
  }));
  return c.json({ posts: list });
});

adminRoutes.get("/posts/:slug", (c) => {
  const found = findPostFile(c.req.param("slug") ?? "");
  if (!found) return c.json({ error: { code: "not_found", message: "文章不存在" } }, 404);
  return c.json({ frontmatter: found.frontmatter, body: found.body });
});

const savePostSchema = z.object({
  frontmatter: postFrontmatterSchema,
  body: z.string().max(200_000),
});

adminRoutes.put("/posts/:slug", async (c) => {
  const slug = c.req.param("slug") ?? "";
  const parsed = savePostSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid", message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") } },
      400,
    );
  }
  if (parsed.data.frontmatter.slug !== slug) {
    return c.json({ error: { code: "slug_mismatch", message: "slug 与 URL 不一致（发布后不可改，docs/07-data.md）" } }, 400);
  }

  const before = findPostFile(slug);
  const mdxIssue = await validatePostMdx(parsed.data.body);
  if (mdxIssue) {
    const where =
      mdxIssue.line && mdxIssue.column
        ? `第 ${mdxIssue.line} 行，第 ${mdxIssue.column} 列`
        : mdxIssue.line
          ? `第 ${mdxIssue.line} 行`
          : "正文";
    return c.json(
      {
        error: {
          code: "invalid_mdx",
          message: `MDX 检查未通过：${where}，${mdxIssue.reason}`,
        },
      },
      400,
    );
  }

  const file = writePostFile(parsed.data.frontmatter, parsed.data.body);
  audit("post.save", { slug, file }, c);

  // 已发布内容变动 → 重建（草稿不触发，docs/02-architecture.md §4）
  const touchesPublished = parsed.data.frontmatter.status === "published" || before?.frontmatter.status === "published";
  if (touchesPublished) enqueueRebuild();

  return c.json({ ok: true, rebuild: touchesPublished });
});

adminRoutes.delete("/posts/:slug", (c) => {
  const slug = c.req.param("slug") ?? "";
  if (!trashPostFile(slug)) return c.json({ error: { code: "not_found", message: "文章不存在" } }, 404);
  audit("post.trash", { slug }, c);
  enqueueRebuild();
  return c.json({ ok: true });
});

/* ── 动态：content/moments/*.jsonl ── */
const saveMomentSchema = z.object({
  text: z.string().min(1).max(2000),
  mood: z.string().max(8).optional().or(z.literal("")),
  location: z.string().max(60).optional().or(z.literal("")),
  createdAt: z.coerce.date(),
});

adminRoutes.get("/moments", (c) => c.json({ moments: listMoments() }));

adminRoutes.post("/moments", async (c) => {
  const parsed = saveMomentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "invalid", message: parsed.error.issues.map((i) => i.message).join("; ") } }, 400);
  }
  const moment = addMoment({
    ...parsed.data,
    mood: parsed.data.mood || undefined,
    location: parsed.data.location || undefined,
    images: [],
  });
  audit("moment.add", { id: moment.id }, c);
  enqueueRebuild();
  return c.json({ ok: true, moment });
});

adminRoutes.delete("/moments/:id", (c) => {
  const id = c.req.param("id") ?? "";
  if (!deleteMoment(id)) return c.json({ error: { code: "not_found", message: "动态不存在" } }, 404);
  audit("moment.delete", { id }, c);
  enqueueRebuild();
  return c.json({ ok: true });
});

/* ── 友链：content/friends.json ── */
adminRoutes.get("/friends", (c) => c.json({ friends: listFriends() }));

adminRoutes.post("/friends", async (c) => {
  const parsed = friendSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "invalid", message: parsed.error.issues.map((i) => i.message).join("; ") } }, 400);
  }
  const friend = addFriend(parsed.data);
  audit("friend.add", { url: friend.url }, c);
  enqueueRebuild();
  return c.json({ ok: true, friend });
});

adminRoutes.delete("/friends", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { url?: string };
  if (!body.url || !deleteFriend(body.url)) {
    return c.json({ error: { code: "not_found", message: "友链不存在" } }, 404);
  }
  audit("friend.delete", { url: body.url }, c);
  enqueueRebuild();
  return c.json({ ok: true });
});

/* ── 图片上传：原图 → WebP 落到文章目录（docs/06-site-admin.md §3.2） ── */
adminRoutes.post("/uploads/:slug", async (c) => {
  const slug = c.req.param("slug") ?? "";
  const post = findPostFile(slug);
  if (!post) return c.json({ error: { code: "not_found", message: "先保存文章再传图" } }, 404);

  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: { code: "invalid", message: "缺少 file 字段" } }, 400);
  if (file.size > 20 * 1024 * 1024) return c.json({ error: { code: "too_large", message: "图片超过 20MB" } }, 413);

  const base = (path.parse(file.name).name.replace(/[^\w-]+/g, "-").slice(0, 40) || "img") + `-${Date.now().toString(36)}`;
  const name = `${base}.webp`;

  const image = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" });
  const meta = await image.metadata();
  const out = await image.rotate().webp({ quality: 82 }).toBuffer();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path.join(post.dir, name), out);

  db.insert(assets)
    .values({
      path: path.relative(process.cwd(), path.join(post.dir, name)),
      width: meta.width ?? null,
      height: meta.height ?? null,
      bytes: out.byteLength,
      format: "webp",
    })
    .onConflictDoNothing()
    .run();

  audit("upload", { slug, name, bytes: out.byteLength }, c);
  // 相对引用，构建期走 Astro 图片管线（docs/07-data.md §3）
  return c.json({ file: name, markdown: `![](./${name})` });
});

/* ── 评论审核 ── */
adminRoutes.get("/comments", (c) => {
  const state = c.req.query("state") ?? "pending";
  const rows = db
    .select()
    .from(comments)
    .where(eq(comments.state, state as "pending" | "ok" | "spam" | "trash"))
    .orderBy(desc(comments.createdAt))
    .limit(100)
    .all();
  const counts = Object.fromEntries(
    db
      .select({ state: comments.state, n: sql<number>`count(*)` })
      .from(comments)
      .groupBy(comments.state)
      .all()
      .map((r) => [r.state, r.n]),
  );
  return c.json({ comments: rows, counts });
});

adminRoutes.patch("/comments/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { state: next } = (await c.req.json().catch(() => ({}))) as { state?: string };
  if (!["ok", "pending", "spam", "trash"].includes(next ?? "")) {
    return c.json({ error: { code: "invalid", message: "非法状态" } }, 400);
  }
  const row = db.select().from(comments).where(eq(comments.id, id)).get();
  if (!row) return c.json({ error: { code: "not_found", message: "评论不存在" } }, 404);

  db.transaction((tx) => {
    tx.update(comments).set({ state: next as typeof row.state }).where(eq(comments.id, id)).run();
    const delta = (next === "ok" ? 1 : 0) - (row.state === "ok" ? 1 : 0);
    if (delta !== 0) {
      tx.update(posts)
        .set({ commentsCount: sql`${posts.commentsCount} + ${delta}` })
        .where(eq(posts.slug, row.postSlug))
        .run();
    }
  });
  audit("comment.moderate", { id, from: row.state, to: next }, c);
  // 评论由主站岛屿实时拉取，不需要重建静态页
  return c.json({ ok: true });
});

/* ── 仪表盘统计 ── */
adminRoutes.get("/stats/overview", (c) => {
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const pvSince = (since: string) =>
    db
      .select({ n: sql<number>`coalesce(sum(${viewsDaily.count}), 0)` })
      .from(viewsDaily)
      .where(gte(viewsDaily.date, since))
      .get()?.n ?? 0;

  const postRows = db.select().from(posts).all();
  return c.json({
    pv: { today: pvSince(day(0)), week: pvSince(day(6)), month: pvSince(day(29)) },
    posts: {
      published: postRows.filter((p) => p.status === "published").length,
      draft: postRows.filter((p) => p.status === "draft").length,
    },
    likes: postRows.reduce((s, p) => s + p.likesCount, 0),
    pendingComments:
      db
        .select({ n: sql<number>`count(*)` })
        .from(comments)
        .where(and(eq(comments.state, "pending")))
        .get()?.n ?? 0,
    trend: db
      .select({ date: viewsDaily.date, n: sql<number>`sum(${viewsDaily.count})` })
      .from(viewsDaily)
      .where(gte(viewsDaily.date, day(29)))
      .groupBy(viewsDaily.date)
      .all(),
  });
});

/* ── 运维 ── */
adminRoutes.post("/ops/rebuild", (c) => {
  enqueueRebuild();
  audit("ops.rebuild", null, c);
  return c.json({ ok: true });
});
adminRoutes.get("/ops/rebuild", (c) => c.json(getRebuildStatus()));
