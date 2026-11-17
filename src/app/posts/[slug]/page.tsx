import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlogShell } from "@/components/BlogShell";
import { ArticleDetailView } from "@/components/ArticleDetailView";
import {
  getPublicSiteSettings,
  getPostBySlug,
  getChronologicalPosts,
  getApprovedComments,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [site, post] = await Promise.all([
    getPublicSiteSettings(),
    getPostBySlug(slug),
  ]);
  if (!post) {
    return { title: `Not Found — ${site.siteName}` };
  }
  return {
    title: `${post.title} — ${site.siteName}`,
    description: post.summary,
    alternates: { canonical: `/posts/${encodeURIComponent(post.slug)}` },
    openGraph: { type: "article", title: post.title, description: post.summary },
  };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [site, post, allPosts, comments] = await Promise.all([
    getPublicSiteSettings(),
    getPostBySlug(slug),
    getChronologicalPosts(),
    getApprovedComments(slug),
  ]);

  if (!post) {
    notFound();
  }

  const idx = allPosts.findIndex((p) => p.slug === post.slug);
  const prevPost =
    idx > 0
      ? { slug: allPosts[idx - 1].slug, title: allPosts[idx - 1].title }
      : null;
  const nextPost =
    idx >= 0 && idx < allPosts.length - 1
      ? { slug: allPosts[idx + 1].slug, title: allPosts[idx + 1].title }
      : null;

  return (
    <BlogShell site={site}>
      <ArticleDetailView
        post={post}
        prevPost={prevPost}
        nextPost={nextPost}
        initialComments={comments}
      />
    </BlogShell>
  );
}
