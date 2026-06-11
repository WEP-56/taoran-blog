import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { postFrontmatterSchema, type PostFrontmatter } from "@taoran/content";
import { eq } from "drizzle-orm";
import matter from "gray-matter";
import { db } from "../db/client";
import { posts } from "../db/schema";
import { contentDir } from "./sync";

/** admin 的 MDX 文件读写层（docs/06-site-admin.md §3.2；内容真源是文件——docs/07-data.md §1） */

const postsDir = () => path.join(contentDir, "posts");
const trashDir = () => path.join(contentDir, ".trash");

function* walkPostFiles(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walkPostFiles(full);
    else if (name === "index.mdx") yield full;
  }
}

export interface PostFile {
  frontmatter: PostFrontmatter;
  body: string;
  /** 文章目录（图片上传落点） */
  dir: string;
}

export function findPostFile(slug: string): PostFile | undefined {
  for (const file of walkPostFiles(postsDir())) {
    const { data, content } = matter(readFileSync(file, "utf-8"));
    const parsed = postFrontmatterSchema.safeParse(data);
    if (parsed.success && parsed.data.slug === slug) {
      return { frontmatter: parsed.data, body: content.trimStart(), dir: path.dirname(file) };
    }
  }
  return undefined;
}

export function listPostFiles(): Array<PostFrontmatter & { invalid?: string }> {
  const out: Array<PostFrontmatter & { invalid?: string }> = [];
  for (const file of walkPostFiles(postsDir())) {
    const parsed = postFrontmatterSchema.safeParse(matter(readFileSync(file, "utf-8")).data);
    if (parsed.success) out.push(parsed.data);
  }
  return out.sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

/** 写入（新建或覆盖）。frontmatter 必须已过 zod 校验。返回文件路径。 */
export function writePostFile(fm: PostFrontmatter, body: string): string {
  const existing = findPostFile(fm.slug);
  const dir =
    existing?.dir ?? path.join(postsDir(), String(fm.date.getFullYear()), fm.slug);
  mkdirSync(dir, { recursive: true });

  // Date → ISO 字符串，避免 yaml 序列化平台差异
  const fmOut: Record<string, unknown> = {
    ...fm,
    date: fm.date.toISOString(),
    updated: fm.updated?.toISOString(),
    publishAt: fm.publishAt?.toISOString() ?? null,
  };
  for (const key of Object.keys(fmOut)) if (fmOut[key] === undefined) delete fmOut[key];

  const file = path.join(dir, "index.mdx");
  writeFileSync(file, matter.stringify(`\n${body.trim()}\n`, fmOut), "utf-8");

  // 同步动态层（docs/07-data.md：slug 是连接两层的键）
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

  return file;
}

/** 软删除：目录移入 content/.trash/<slug>-<时间戳>，DB 状态改 draft（保留统计与评论外键） */
export function trashPostFile(slug: string): boolean {
  const found = findPostFile(slug);
  if (!found) return false;
  mkdirSync(trashDir(), { recursive: true });
  renameSync(found.dir, path.join(trashDir(), `${slug}-${Date.now()}`));
  db.update(posts).set({ status: "draft" }).where(eq(posts.slug, slug)).run();
  return true;
}
