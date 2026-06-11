import { z } from "zod";

/**
 * 文章 frontmatter schema · 真源
 * 规格见 docs/07-data.md §2.1。构建期校验失败必须硬报错。
 */
export const postFrontmatterSchema = z.object({
  title: z.string().min(1).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 仅允许小写字母、数字与连字符"),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  summary: z.string().max(300).optional(),
  tags: z.array(z.string().min(1).max(24)).max(8).default([]),
  cover: z.string().optional(),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  publishAt: z.coerce.date().nullable().default(null),
  pinned: z.boolean().default(false),
  toc: z.boolean().default(true),
  comments: z.boolean().default(true),
  aliases: z.array(z.string()).default([]),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

/** 动态（moments）单条记录，存于 content/moments/YYYY-MM.jsonl */
export const momentSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(2000),
  images: z.array(z.string()).max(9).default([]),
  mood: z.string().max(8).optional(),
  location: z.string().max(60).optional(),
  createdAt: z.coerce.date(),
});

export type Moment = z.infer<typeof momentSchema>;
