import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postFrontmatterSchema } from "@taoran/content";
import { sql } from "drizzle-orm";
import matter from "gray-matter";
import { db } from "../db/client";
import { posts } from "../db/schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");

export const contentDir = process.env.CONTENT_DIR
  ? path.resolve(repoRoot, process.env.CONTENT_DIR)
  : path.join(repoRoot, "content");

function* walkPostFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walkPostFiles(full);
    else if (name === "index.mdx") yield full;
  }
}

/**
 * 内容同步：扫描 content/posts 的 frontmatter，upsert 到 posts 表
 * （动态层只关心 slug/状态/置顶，展示字段真源在 MDX——docs/07-data.md §4）。
 * 启动时执行；M4 起 admin 保存文章时也会调用。
 */
export function syncPostsFromContent(): { synced: number; errors: string[] } {
  const postsDir = path.join(contentDir, "posts");
  const errors: string[] = [];
  let synced = 0;

  for (const file of walkPostFiles(postsDir)) {
    const rel = path.relative(postsDir, file);
    const parsed = postFrontmatterSchema.safeParse(matter(readFileSync(file, "utf-8")).data);
    if (!parsed.success) {
      errors.push(`${rel}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    const fm = parsed.data;
    db.insert(posts)
      .values({
        slug: fm.slug,
        status: fm.status,
        publishedAt: fm.status === "published" ? fm.date : null,
        pinned: fm.pinned,
      })
      .onConflictDoUpdate({
        target: posts.slug,
        set: {
          status: fm.status,
          publishedAt: fm.status === "published" ? fm.date : null,
          pinned: fm.pinned,
        },
      })
      .run();
    synced++;
  }

  // 计数器自愈：以实际行数校正反范式计数（防御手工改库/历史漂移）
  db.run(sql`
    UPDATE posts SET
      comments_count = (SELECT COUNT(*) FROM comments WHERE comments.post_slug = posts.slug AND comments.state = 'ok'),
      likes_count = (SELECT COALESCE(SUM(count), 0) FROM reactions WHERE reactions.post_slug = posts.slug),
      views_count = (SELECT COALESCE(SUM(count), 0) FROM views_daily WHERE views_daily.post_slug = posts.slug)
  `);

  return { synced, errors };
}
