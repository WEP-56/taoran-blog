import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteProvider } from "@/components/SiteProvider";
import { AmbientPaperCanvas } from "@/components/AmbientPaperCanvas";
import { CommandPalette } from "@/components/CommandPalette";
import { getPublicSiteSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const site = await getPublicSiteSettings();
    return {
      metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
      alternates: { types: { "application/rss+xml": "/rss.xml" } },
      title: `${site.siteName} — ${site.siteTagline || "Minimalist Journal"}`,
      description: site.introZh,
    };
  } catch {
    return {
      title: "Air — 少即是多的无界博客",
      description: "极简黑白无分割线独立博客与创作后台",
    };
  }
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  let shaderMode: "subtle" | "expressive" | "off" = "subtle";
  try {
    const site = await getPublicSiteSettings();
    shaderMode = site.shaderMode;
  } catch {
    shaderMode = "subtle";
  }

  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <body className="antialiased selection:bg-black selection:text-white">
        <SiteProvider initialShaderMode={shaderMode}>
          <AmbientPaperCanvas />
          <CommandPalette />
          {children}
        </SiteProvider>
      </body>
    </html>
  );
}
