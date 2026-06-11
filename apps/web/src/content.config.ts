import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/**
 * 内容集合：从仓库根 content/posts 读取（docs/02-architecture.md §2）。
 * 注意：此 schema 是 packages/content 中 postFrontmatterSchema 的镜像——
 * Astro 内置 zod 与包内 zod 4 实例不互通，两处必须人工保持同步。
 */
const posts = defineCollection({
  loader: glob({ pattern: "**/index.mdx", base: "../../content/posts" }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1).max(120),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      summary: z.string().max(300).optional(),
      tags: z.array(z.string().min(1).max(24)).max(8).default([]),
      cover: image().optional(),
      status: z.enum(["draft", "published", "scheduled"]).default("draft"),
      publishAt: z.coerce.date().nullable().default(null),
      pinned: z.boolean().default(false),
      toc: z.boolean().default(true),
      comments: z.boolean().default(true),
      aliases: z.array(z.string()).default([]),
    }),
});

export const collections = { posts };
