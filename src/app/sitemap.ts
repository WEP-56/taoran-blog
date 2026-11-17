import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.SITE_URL || "http://localhost:3000";
  const posts = await getPublishedPosts();
  return ["", "/archive", "/tags", "/moments", "/about", "/links", "/gallery"].map(path => ({ url: `${origin}${path}` })).concat(posts.map(post => ({ url: `${origin}/posts/${encodeURIComponent(post.slug)}`, lastModified: post.updatedAt })));
}
