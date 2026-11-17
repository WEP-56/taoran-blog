import type { Metadata } from "next";
import { BlogShell } from "@/components/BlogShell";
import { SupportView } from "@/components/SupportView";
import { getPublicSiteSettings, getSupportSettings } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "打赏 · Buy me a coffee",
  description: "支持独立写作，感谢每一份阅读、陪伴与赞助。",
  alternates: { canonical: "/support" },
};

export default async function SupportPage() {
  const [site, support] = await Promise.all([getPublicSiteSettings(), getSupportSettings()]);
  return <BlogShell site={site}><SupportView content={support} /></BlogShell>;
}
