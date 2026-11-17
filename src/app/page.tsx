import { BlogShell } from "@/components/BlogShell";
import { HomeView } from "@/components/HomeView";
import {
  getPublicSiteSettings,
  getPublishedPosts,
  getAllMoments,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [site, posts, moments] = await Promise.all([
    getPublicSiteSettings(),
    getPublishedPosts(),
    getAllMoments(),
  ]);

  return (
    <BlogShell site={site}>
      <HomeView
        introZh={site.introZh}
        introEn={site.introEn}
        nowStatus={site.nowStatus}
        posts={posts}
        latestMoment={moments[0] ?? null}
      />
    </BlogShell>
  );
}
