import { BlogShell } from "@/components/BlogShell";
import { GalleryView } from "@/components/GalleryView";
import { getPublicSiteSettings, getAllGalleryItems } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [site, items] = await Promise.all([
    getPublicSiteSettings(),
    getAllGalleryItems(),
  ]);

  return (
    <BlogShell site={site}>
      <GalleryView items={items} />
    </BlogShell>
  );
}
