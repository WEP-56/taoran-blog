import { db } from "@/db";
import { posts, siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { normalizeDateSortKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  await ensureDatabaseReady();
  const origin = new URL(process.env.SITE_URL || request.url).origin;

  const [settings] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);

  const allPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"));

  allPosts.sort(
    (a, b) =>
      normalizeDateSortKey(b.publishedAt) - normalizeDateSortKey(a.publishedAt)
  );

  const siteTitle = settings?.siteName || "Air";
  const siteDesc = settings?.introZh || "极简独立博客";

  const itemsXml = allPosts
    .map((post) => {
      const link = `${origin}/posts/${encodeURIComponent(post.slug)}`;
      const parsedDate = Date.parse(post.publishedAt);
      const pubDate = Number.isNaN(parsedDate)
        ? new Date(post.createdAt).toUTCString()
        : new Date(parsedDate).toUTCString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <description>${escapeXml(post.summary)}</description>
      <category>${escapeXml(post.category)}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${origin}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>zh-CN</language>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
