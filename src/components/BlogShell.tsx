"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Languages, Sun, Moon, Rss } from "lucide-react";
import { useSite } from "./SiteProvider";

export interface PublicSiteMeta {
  siteName: string;
  authorName: string;
  footerText: string;
}

export function BlogShell({
  site,
  children,
}: {
  site: PublicSiteMeta;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme, toggleLang, setCommandOpen, t } = useSite();

  const navItems = [
    { href: "/", zh: "首页", en: "Home" },
    { href: "/archive", zh: "归档", en: "Archive" },
    { href: "/tags", zh: "标签", en: "Tags" },
    { href: "/moments", zh: "动态", en: "Moments" },
    { href: "/about", zh: "关于", en: "About" },
    { href: "/links", zh: "友链", en: "Friends" },
    { href: "/support", zh: "打赏", en: "Buy me a coffee" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[700px] flex-col px-6 py-12 sm:py-20">
      <header className="mb-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-editorial text-[26px] font-semibold tracking-tight ink-primary transition-opacity hover:opacity-75"
          >
            {site.siteName || "Air"}
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              title={t("搜索与指令 (⌘K)", "Search & Command (⌘K)")}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs ink-secondary transition-colors hover:surface-block hover:ink-primary cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline font-mono-num text-[11px] ink-muted">
                ⌘K
              </span>
            </button>

            <button
              type="button"
              onClick={toggleLang}
              title={t("切换中/英文", "Switch Language")}
              className="flex h-8 w-8 items-center justify-center rounded-lg ink-secondary transition-colors hover:surface-block hover:ink-primary cursor-pointer"
            >
              <Languages className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={t("切换昼夜主题", "Toggle Theme")}
              className="flex h-8 w-8 items-center justify-center rounded-lg ink-secondary transition-colors hover:surface-block hover:ink-primary cursor-pointer"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <Link
              href="/admin"
              className="ml-1 rounded-lg surface-block px-2.5 py-1.5 text-xs font-medium ink-primary transition-opacity hover:opacity-80"
            >
              Studio
            </Link>
          </div>
        </div>

        <nav className="mt-7 flex flex-wrap items-center gap-1.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-[14px] transition-all ${
                  active
                    ? "surface-invert font-medium"
                    : "ink-secondary hover:surface-block hover:ink-primary"
                }`}
              >
                {t(item.zh, item.en)}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs ink-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-num">© {new Date().getFullYear()}</span>
          <span>·</span>
          <span className="ink-secondary font-medium">
            {site.authorName || "Su"}
          </span>
          {site.footerText && (
            <>
              <span>·</span>
              <span>{site.footerText}</span>
            </>
          )}
          <span>·</span>
          <Link
            href="/admin"
            className="rounded-md surface-block px-2 py-0.5 text-[11px] ink-secondary transition-opacity hover:opacity-80"
          >
            {t("管理后台", "Admin")}
          </Link>
        </div>

        <a
          href="/rss.xml"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg surface-block px-2.5 py-1 text-xs ink-secondary transition-opacity hover:ink-primary"
        >
          <span>{t("通过", "Via")}</span>
          <Rss className="h-3 w-3" />
          <span className="font-mono-num font-medium ink-primary">RSS</span>
          <span>{t("订阅", "Feed")}</span>
        </a>
      </footer>
    </div>
  );
}
