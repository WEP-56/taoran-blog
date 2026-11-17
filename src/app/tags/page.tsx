import { BlogShell } from "@/components/BlogShell";
import { TagsView } from "@/components/TagsView";
import { getPublicSiteSettings, getChronologicalPosts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const [site, posts] = await Promise.all([
    getPublicSiteSettings(),
    getChronologicalPosts(),
  ]);

  return (
    <BlogShell site={site}>
      <TagsView posts={posts} initialTag={tag || ""} />
    </BlogShell>
  );
}
