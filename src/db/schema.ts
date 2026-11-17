import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export interface SocialLink {
  label: string;
  url: string;
}

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  siteName: text("site_name").notNull().default("Air"),
  siteTagline: text("site_tagline")
    .notNull()
    .default("少即是多 · 以文字与色块构筑的数字留白"),
  introZh: text("intro_zh")
    .notNull()
    .default(
      "Air 是一处为独立写作者与思考者构筑的极简数字栖居。摒弃一切繁复的线条与装饰，仅凭字距、留白与克制的灰阶色块承载阅读。若你凝视片刻，会察觉纸面之下正随呼吸缓慢起伏的微光流体。"
    ),
  introEn: text("intro_en")
    .notNull()
    .default(
      "Air is a quiet digital sanctuary crafted for independent writers and thinkers. Stripped of every dividing line and ornament, it relies solely on typography, negative space, and monochrome tonal blocks—with a living WebGL topographic field breathing softly beneath the surface."
    ),
  authorName: text("author_name").notNull().default("Su"),
  authorRole: text("author_role").notNull().default("独立写作者 / 极简主义实践者"),
  footerText: text("footer_text").notNull().default("以留白盛放思想"),
  aboutMarkdown: text("about_markdown").notNull().default(""),
  nowStatus: text("now_status")
    .notNull()
    .default("正在整理秋日骑行手记，打磨无边框数字排版与微地形着色器实验。"),
  socialLinks: jsonb("social_links")
    .$type<SocialLink[]>()
    .notNull()
    .default([]),
  shaderMode: text("shader_mode").notNull().default("subtle"),
  adminPasscode: text("admin_passcode").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("随笔"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  coverImage: text("cover_image").default(""),
  pinned: boolean("pinned").notNull().default(false),
  status: text("status").notNull().default("published"), // "published" | "draft"
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  readingMinutes: integer("reading_minutes").notNull().default(3),
  publishedAt: text("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const moments = pgTable("moments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  tag: text("tag").notNull().default("日常"),
  location: text("location").default(""),
  imageUrl: text("image_url").default(""),
  likes: integer("likes").notNull().default(0),
  publishedAt: text("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const galleryItems = pgTable("gallery_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  caption: text("caption").notNull(),
  imageUrl: text("image_url").notNull(),
  location: text("location").notNull().default(""),
  cameraSpec: text("camera_spec").notNull().default(""),
  takenAt: text("taken_at").notNull(),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const friendLinks = pgTable("friend_links", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull().default(""),
  avatarUrl: text("avatar_url").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  postSlug: text("post_slug").notNull(),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").default(""),
  authorUrl: text("author_url").default(""),
  content: text("content").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  postSlug: text("post_slug").default(""),
  visitorHash: text("visitor_hash").notNull(),
  device: text("device").notNull().default("Desktop"),
  referrer: text("referrer").default("direct"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Moment = typeof moments.$inferSelect;
export type GalleryItem = typeof galleryItems.$inferSelect;
export type FriendLink = typeof friendLinks.$inferSelect;
export type CommentItem = typeof comments.$inferSelect;
export type PageView = typeof pageViews.$inferSelect;
