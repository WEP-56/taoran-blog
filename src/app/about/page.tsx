import { BlogShell } from "@/components/BlogShell";
import { AboutView } from "@/components/AboutView";
import { getPublicSiteSettings, getAllFriendLinks } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [site, friends] = await Promise.all([
    getPublicSiteSettings(),
    getAllFriendLinks(),
  ]);

  return (
    <BlogShell site={site}>
      <AboutView
        authorName={site.authorName}
        authorRole={site.authorRole}
        nowStatus={site.nowStatus}
        aboutMarkdown={site.aboutMarkdown}
        socialLinks={site.socialLinks}
        friends={friends}
      />
    </BlogShell>
  );
}
