/**
 * 动态层 schema · 真源
 * 表结构与隐私约定见 docs/07-data.md §4。
 * 文章标题等展示字段不在这里——内容真源是 content/ 下的 MDX。
 */
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const now = () => new Date();

export const posts = sqliteTable("posts", {
  slug: text("slug").primaryKey(),
  status: text("status", { enum: ["draft", "published", "scheduled"] })
    .notNull()
    .default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  // 反范式计数，事务内维护
  likesCount: integer("likes_count").notNull().default(0),
  viewsCount: integer("views_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
});

export const comments = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postSlug: text("post_slug")
      .notNull()
      .references(() => posts.slug),
    parentId: integer("parent_id"),
    authorName: text("author_name").notNull(),
    authorEmailHash: text("author_email_hash").notNull(),
    authorSite: text("author_site"),
    bodyMd: text("body_md").notNull(),
    state: text("state", { enum: ["pending", "ok", "spam", "trash"] })
      .notNull()
      .default("pending"),
    ipHash: text("ip_hash").notNull(),
    ua: text("ua"),
    notify: integer("notify", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
  },
  (t) => [index("idx_comments_queue").on(t.postSlug, t.state, t.createdAt)],
);

export const reactions = sqliteTable(
  "reactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postSlug: text("post_slug")
      .notNull()
      .references(() => posts.slug),
    visitorHash: text("visitor_hash").notNull(),
    // 一人最多捏 9 次（docs/07-data.md）
    count: integer("count").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("uq_reactions_visitor").on(t.postSlug, t.visitorHash)],
);

export const viewsDaily = sqliteTable(
  "views_daily",
  {
    postSlug: text("post_slug").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD，只存日聚合
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postSlug, t.date] })],
);

export const momentsMeta = sqliteTable("moments_meta", {
  id: text("id").primaryKey(), // 与 content/moments jsonl 的 id 对应
  likesCount: integer("likes_count").notNull().default(0),
});

export const friends = sqliteTable("friends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  avatar: text("avatar"),
  desc: text("desc"),
  sort: integer("sort").notNull().default(0),
  state: text("state", { enum: ["ok", "lost"] }).notNull().default("ok"),
  checkedAt: integer("checked_at", { mode: "timestamp" }),
});

export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull().unique(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes").notNull(),
  format: text("format").notNull(),
  lqip: text("lqip"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});

export const site = sqliteTable("site", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});

export const webauthnCredentials = sqliteTable("webauthn_credentials", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  detail: text("detail", { mode: "json" }),
  ipHash: text("ip_hash"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});
