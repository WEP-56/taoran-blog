import { BlogShell } from "@/components/BlogShell";
import { MomentsView } from "@/components/MomentsView";
import { getPublicSiteSettings, getAllMoments } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MomentsPage() {
  const [site, moments] = await Promise.all([
    getPublicSiteSettings(),
    getAllMoments(),
  ]);

  return (
    <BlogShell site={site}>
      <MomentsView initialMoments={moments} />
    </BlogShell>
  );
}
