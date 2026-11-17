"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSite } from "./SiteProvider";
import type { Post } from "@/db/schema";

export function TagsView({
  posts,
  initialTag = "",
}: {
  posts: Post[];
  initialTag?: string;
}) {
  const { t } = useSite();
  const [selectedTag, setSelectedTag] = useState<string>(initialTag);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const tag of p.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (selectedTag && !(p.tags || []).includes(selectedTag)) return false;
      return true;
    });
  }, [posts, selectedTag, selectedCategory]);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight ink-primary">
          {t("分类与标签", "Categories & Tags")}
        </h1>
        <p className="mt-1.5 text-xs ink-muted">
          {t(
            "轻点任意色块筛选相关主题文章",
            "Select any tonal block to filter writings by topic"
          )}
        </p>
      </div>

      {/* Categories Tonal Blocks */}
      <section className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-widest ink-muted">
          {t("专栏分类", "Categories")}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("");
              setSelectedTag("");
            }}
            className={`rounded-xl px-3.5 py-2 text-xs transition-all cursor-pointer ${
              !selectedCategory && !selectedTag
                ? "surface-invert font-medium"
                : "surface-block ink-secondary hover:ink-primary"
            }`}
          >
            {t("全部", "All")}{" "}
            <span className="ml-1 font-mono-num opacity-70">{posts.length}</span>
          </button>

          {categories.map(([cat, count]) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(active ? "" : cat);
                  setSelectedTag("");
                }}
                className={`rounded-xl px-3.5 py-2 text-xs transition-all cursor-pointer ${
                  active
                    ? "surface-invert font-medium"
                    : "surface-block ink-secondary hover:ink-primary"
                }`}
              >
                {cat}
                <span className="ml-1.5 font-mono-num opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tags Tonal Cloud */}
      <section className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-widest ink-muted">
          {t("主题标签", "Tags")}
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(([tag, count]) => {
            const active = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSelectedTag(active ? "" : tag);
                  setSelectedCategory("");
                }}
                className={`rounded-xl px-3 py-1.5 text-xs transition-all cursor-pointer ${
                  active
                    ? "surface-invert font-medium"
                    : "surface-block ink-secondary hover:surface-block-strong hover:ink-primary"
                }`}
              >
                # {tag}
                <span className="ml-1.5 font-mono-num opacity-65">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filtered Articles */}
      <section className="space-y-2 pt-2">
        <div className="text-xs ink-muted mb-4">
          {selectedTag
            ? `${t("标签", "Tag")}: #${selectedTag} (${filteredPosts.length})`
            : selectedCategory
            ? `${t("分类", "Category")}: ${selectedCategory} (${filteredPosts.length})`
            : `${t("全部文章", "All Writings")} (${filteredPosts.length})`}
        </div>

        {filteredPosts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.slug}`}
            className="block rounded-2xl surface-block p-5 transition-colors hover:surface-block-strong"
          >
            <div className="flex items-center justify-between gap-3 text-xs ink-muted mb-2">
              <time className="font-mono-num">{post.publishedAt}</time>
              <span className="rounded-md surface-canvas px-2 py-0.5 ink-secondary">
                {post.category}
              </span>
            </div>
            <h2 className="text-base font-medium ink-primary">{post.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed ink-secondary line-clamp-2">
              {post.summary}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
