import { BlogShell } from "@/components/BlogShell";
import { FriendsView } from "@/components/FriendsView";
import { getPublicSiteSettings, getAllFriendLinks } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const [site, friends] = await Promise.all([
    getPublicSiteSettings(),
    getAllFriendLinks(),
  ]);

  return (
    <BlogShell site={site}>
      <FriendsView friends={friends} />
    </BlogShell>
  );
}
