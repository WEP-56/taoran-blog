import { commentInputSchema } from "@taoran/content";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { db } from "../db/client";
import { comments, posts, reactions, viewsDaily } from "../db/schema";
import { emailHash, ipHash, newVisitorId, visitorHash } from "../lib/hash";
import { clientIp, rateLimit } from "../lib/ratelimit";

/** 公开接口 /api/v1/*（docs/07-data.md §5） */
export const publicRoutes = new Hono();

const MAX_LIKES_PER_VISITOR = 9;
const VISITOR_COOKIE = "taoran_v";

function getVisitor(c: Context): string {
  let id = getCookie(c, VISITOR_COOKIE);
  if (!id) {
    id = newVisitorId();
    setCookie(c, VISITOR_COOKIE, id, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return visitorHash(id, clientIp(c));
}

function publishedPost(slug: string) {
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
    .get();
}

/* ── meta ── */
publicRoutes.get("/posts/:slug/meta", (c) => {
  const post = publishedPost(c.req.param("slug"));
  if (!post) return c.json({ error: { code: "not_found", message: "文章不存在" } }, 404);
  return c.json({
    views: post.viewsCount,
    likes: post.likesCount,
    comments: post.commentsCount,
  });
});

/* ── 浏览上报：同访客同文章当日去重 ──
   去重集仅存内存（重启清零；views_daily 只存日聚合，丢一次去重无伤大雅——docs/07-data.md §4）。 */
const seenToday = new Set<string>();
let seenDay = "";

publicRoutes.post(
  "/posts/:slug/view",
  rateLimit({ name: "view", max: 60, windowMs: 60_000, keyOf: (c) => ipHash(clientIp(c)) }),
  (c) => {
    const slug = c.req.param("slug") ?? "";
    if (!publishedPost(slug)) return c.json({ error: { code: "not_found", message: "文章不存在" } }, 404);

    const day = new Date().toISOString().slice(0, 10);
    if (day !== seenDay) {
      seenToday.clear();
      seenDay = day;
    }
    const key = `${getVisitor(c)}:${slug}`;
    if (seenToday.has(key)) return c.json({ counted: false });
    seenToday.add(key);

    db.transaction((tx) => {
      tx.insert(viewsDaily)
        .values({ postSlug: slug, date: day, count: 1 })
        .onConflictDoUpdate({
          target: [viewsDaily.postSlug, viewsDaily.date],
          set: { count: sql`${viewsDaily.count} + 1` },
        })
        .run();
      tx.update(posts)
        .set({ viewsCount: sql`${posts.viewsCount} + 1` })
        .where(eq(posts.slug, slug))
        .run();
    });
    return c.json({ counted: true });
  },
);

/* ── 捏一下（点赞）：一人最多 9 次 ── */
publicRoutes.post(
  "/posts/:slug/like",
  rateLimit({ name: "like", max: 30, windowMs: 60_000, keyOf: (c) => ipHash(clientIp(c)) }),
  (c) => {
    const slug = c.req.param("slug") ?? "";
    const post = publishedPost(slug);
    if (!post) return c.json({ error: { code: "not_found", message: "文章不存在" } }, 404);
    const visitor = getVisitor(c);

    const result = db.transaction((tx) => {
      const existing = tx
        .select()
        .from(reactions)
        .where(and(eq(reactions.postSlug, slug), eq(reactions.visitorHash, visitor)))
        .get();

      if (existing && existing.count >= MAX_LIKES_PER_VISITOR) {
        return { likes: post.likesCount, mine: existing.count, maxed: true };
      }
      if (existing) {
        tx.update(reactions)
          .set({ count: existing.count + 1 })
          .where(eq(reactions.id, existing.id))
          .run();
      } else {
        tx.insert(reactions).values({ postSlug: slug, visitorHash: visitor, count: 1 }).run();
      }
      tx.update(posts)
        .set({ likesCount: sql`${posts.likesCount} + 1` })
        .where(eq(posts.slug, slug))
        .run();

      const mine = (existing?.count ?? 0) + 1;
      return { likes: post.likesCount + 1, mine, maxed: mine >= MAX_LIKES_PER_VISITOR };
    });
    return c.json(result);
  },
);

/* ── 评论 ── */
publicRoutes.get("/posts/:slug/comments", (c) => {
  const slug = c.req.param("slug") ?? "";
  const rows = db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      authorName: comments.authorName,
      authorEmailHash: comments.authorEmailHash,
      authorSite: comments.authorSite,
      bodyMd: comments.bodyMd,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(and(eq(comments.postSlug, slug), eq(comments.state, "ok")))
    .orderBy(asc(comments.createdAt))
    .all();

  const top = rows.filter((r) => !r.parentId).map((r) => ({ ...r, replies: [] as typeof rows }));
  const byId = new Map(top.map((t) => [t.id, t]));
  for (const r of rows) {
    if (r.parentId) byId.get(r.parentId)?.replies.push(r);
  }
  return c.json({ comments: top });
});

const LINK_RE = /https?:\/\//g;

publicRoutes.post(
  "/posts/:slug/comments",
  rateLimit({ name: "comment", max: 3, windowMs: 3_600_000, keyOf: (c) => ipHash(clientIp(c)) }),
  async (c) => {
    const slug = c.req.param("slug") ?? "";
    const post = publishedPost(slug);
    if (!post) return c.json({ error: { code: "not_found", message: "文章不存在" } }, 404);

    const parsed = commentInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "invalid", message: "评论内容不合法" } }, 400);
    }
    const input = parsed.data;

    // 蜜罐命中：装作成功，直接进垃圾箱（docs/07-data.md §5）
    const isHoneypot = input.website2 !== undefined && input.website2 !== "";

    const eHash = emailHash(input.authorEmail);
    // 信任判定：既往通过 ≥ 2 条且本条无可疑链接 → 直接可见（docs/06-site-admin.md §3.4）
    const okBefore =
      db
        .select({ n: sql<number>`count(*)` })
        .from(comments)
        .where(and(eq(comments.authorEmailHash, eHash), eq(comments.state, "ok")))
        .get()?.n ?? 0;
    const linkCount = input.body.match(LINK_RE)?.length ?? 0;
    const state = isHoneypot ? "spam" : okBefore >= 2 && linkCount <= 2 ? "ok" : "pending";

    const inserted = db.transaction((tx) => {
      const row = tx
        .insert(comments)
        .values({
          postSlug: slug,
          parentId: input.parentId,
          authorName: input.authorName,
          authorEmailHash: eHash,
          authorSite: input.authorSite || null,
          bodyMd: input.body,
          state,
          ipHash: ipHash(clientIp(c)),
          ua: c.req.header("user-agent")?.slice(0, 200) ?? null,
          notify: input.notify,
        })
        .returning()
        .get();
      if (state === "ok") {
        tx.update(posts)
          .set({ commentsCount: sql`${posts.commentsCount} + 1` })
          .where(eq(posts.slug, slug))
          .run();
      }
      return row;
    });

    return c.json(
      {
        id: inserted.id,
        state: isHoneypot ? "pending" : state, // 不向蜜罐命中者泄露判定
        message: state === "ok" ? "已晾干上架。" : "已提交，晾干（审核）后可见。",
      },
      201,
    );
  },
);
