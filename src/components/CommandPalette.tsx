"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Sparkles,
  Sun,
  Moon,
  Languages,
  LayoutDashboard,
  Rss,
  MessageSquareQuote,
} from "lucide-react";
import { useSite } from "./SiteProvider";

interface SearchPost {
  id: number;
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  category: string;
  tags: string[];
}

interface SearchMoment {
  id: number;
  content: string;
  tag: string;
  publishedAt: string;
}

export function CommandPalette() {
  const {
    commandOpen,
    setCommandOpen,
    theme,
    toggleTheme,
    toggleLang,
    shaderMode,
    setShaderMode,
    t,
  } = useSite();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [moments, setMoments] = useState<SearchMoment[]>([]);

  useEffect(() => {
    if (!commandOpen) return;
    Promise.all([
      fetch("/api/posts").then((r) => r.json()),
      fetch("/api/moments").then((r) => r.json()),
    ])
      .then(([pData, mData]) => {
        if (Array.isArray(pData)) setPosts(pData);
        if (Array.isArray(mData)) setMoments(mData);
      })
      .catch(() => {});
  }, [commandOpen]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts.slice(0, 5);
    return posts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.summary.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.tags || []).some((tag) => tag.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [posts, query]);

  const filteredMoments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return moments
      .filter(
        (m) =>
          m.content.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [moments, query]);

  if (!commandOpen) return null;

  const go = (href: string) => {
    setCommandOpen(false);
    setQuery("");
    router.push(href);
  };

  const cycleShader = () => {
    const next =
      shaderMode === "subtle"
        ? "expressive"
        : shaderMode === "expressive"
        ? "off"
        : "subtle";
    setShaderMode(next);
  };

  return (
    <div
      onClick={() => setCommandOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-4 pt-[12vh] backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-elevated w-full max-w-xl rounded-2xl p-4 sm:p-5 transition-all"
      >
        <div className="surface-block flex items-center gap-3 rounded-xl px-4 py-3">
          <Search className="h-4 w-4 ink-muted shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "搜索文章标题、标签、随想，或输入快捷指令...",
              "Search articles, tags, moments, or run actions..."
            )}
            className="w-full bg-transparent text-sm ink-primary placeholder:opacity-50"
          />
          <button
            type="button"
            onClick={() => setCommandOpen(false)}
            className="surface-canvas rounded-md px-2 py-0.5 text-[11px] font-mono-num ink-muted cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-5 pr-1">
          {filteredPosts.length > 0 && (
            <div>
              <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-widest ink-muted">
                {t("文章", "Articles")}
              </div>
              <div className="space-y-1">
                {filteredPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => go(`/posts/${post.slug}`)}
                    className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:surface-block cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-3.5 w-3.5 shrink-0 ink-muted" />
                      <span className="truncate text-sm ink-primary">
                        {post.title}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono-num text-xs ink-muted">
                      {post.publishedAt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredMoments.length > 0 && (
            <div>
              <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-widest ink-muted">
                {t("动态随想", "Moments")}
              </div>
              <div className="space-y-1">
                {filteredMoments.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => go("/moments")}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:surface-block cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquareQuote className="h-3.5 w-3.5 shrink-0 ink-muted" />
                      <span className="truncate text-sm ink-secondary">
                        {m.content}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono-num text-xs ink-muted">
                      {m.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-widest ink-muted">
              {t("空间控制与入口", "Controls & Studio")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => go("/admin")}
                className="surface-block flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs ink-primary transition-opacity hover:opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-medium">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  {t("进入后台管理站 (Admin)", "Open Admin Studio")}
                </span>
                <span className="ink-muted">→</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="surface-block flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs ink-primary transition-opacity hover:opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {theme === "light" ? (
                    <Moon className="h-3.5 w-3.5" />
                  ) : (
                    <Sun className="h-3.5 w-3.5" />
                  )}
                  {t("切换黑白昼夜模式", "Toggle Dark / Light")}
                </span>
                <span className="font-mono-num ink-muted">
                  {theme === "light" ? "Light" : "Dark"}
                </span>
              </button>

              <button
                type="button"
                onClick={cycleShader}
                className="surface-block flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs ink-primary transition-opacity hover:opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("3D 纸面着色器强度", "3D Shader Field")}
                </span>
                <span className="font-mono-num ink-muted">
                  {shaderMode === "subtle"
                    ? t("克制", "Subtle")
                    : shaderMode === "expressive"
                    ? t("明显", "Deep")
                    : t("关闭", "Off")}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleLang}
                className="surface-block flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs ink-primary transition-opacity hover:opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Languages className="h-3.5 w-3.5" />
                  {t("切换界面语言", "Switch UI Language")}
                </span>
                <span className="font-mono-num ink-muted">中 / EN</span>
              </button>

              <a
                href="/rss.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="surface-block flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs ink-primary transition-opacity hover:opacity-85"
              >
                <span className="flex items-center gap-2">
                  <Rss className="h-3.5 w-3.5" />
                  {t("查看 RSS 2.0 订阅源", "Open RSS 2.0 Feed")}
                </span>
                <span className="font-mono-num ink-muted">XML</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
