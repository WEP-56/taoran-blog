import { BlogShell } from "@/components/BlogShell";
import { ArchiveView } from "@/components/ArchiveView";
import { getPublicSiteSettings, getChronologicalPosts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const [site, posts] = await Promise.all([
    getPublicSiteSettings(),
    getChronologicalPosts(),
  ]);

  return (
    <BlogShell site={site}>
      <ArchiveView posts={posts} />
    </BlogShell>
  );
}
