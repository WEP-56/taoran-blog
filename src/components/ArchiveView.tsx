"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Orbit, List } from "lucide-react";
import { useSite } from "./SiteProvider";
import { InkMonolith3D } from "./InkMonolith3D";
import { extractYear } from "@/lib/utils";
import type { Post } from "@/db/schema";

export function ArchiveView({ posts }: { posts: Post[] }) {
  const { t } = useSite();
  const [show3D, setShow3D] = useState(false);

  const groupedByYear = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      const year = extractYear(post.publishedAt);
      const list = map.get(year) || [];
      list.push(post);
      map.set(year, list);
    }
    return Array.from(map.entries());
  }, [posts]);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight ink-primary">
            {t("文章归档", "Archive")}
          </h1>
          <p className="mt-1.5 text-xs ink-muted">
            {t(
              `共收录 ${posts.length} 篇落笔文字`,
              `${posts.length} published writings in chronological order`
            )}
          </p>
        </div>

        <div className="surface-block inline-flex items-center gap-1 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setShow3D(false)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all cursor-pointer ${
              !show3D ? "surface-invert font-medium" : "ink-secondary"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>{t("编年", "Timeline")}</span>
          </button>
          <button
            type="button"
            onClick={() => setShow3D(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all cursor-pointer ${
              show3D ? "surface-invert font-medium" : "ink-secondary"
            }`}
          >
            <Orbit className="h-3.5 w-3.5" />
            <span>{t("三维墨轨", "3D Orbit")}</span>
          </button>
        </div>
      </div>

      {show3D && (
        <InkMonolith3D
          variant="constellation"
          posts={posts.map((p) => ({
            slug: p.slug,
            title: p.title,
            publishedAt: p.publishedAt,
            category: p.category,
          }))}
        />
      )}

      <div className="space-y-12">
        {groupedByYear.map(([year, yearPosts]) => (
          <section key={year} className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="font-mono-num text-2xl font-semibold tracking-tight ink-primary">
                {year}
              </h2>
              <span className="rounded-md surface-block px-2 py-0.5 font-mono-num text-xs ink-muted">
                {yearPosts.length}
              </span>
            </div>

            <div className="space-y-1">
              {yearPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.slug}`}
                  className="group -mx-3 flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:surface-block"
                >
                  <div className="flex items-baseline gap-5 min-w-0">
                    <time className="w-14 shrink-0 font-mono-num text-xs ink-muted">
                      {post.publishedAt.slice(5) || post.publishedAt}
                    </time>
                    <span className="truncate text-[15px] ink-primary">
                      {post.title}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-md surface-block px-2 py-0.5 text-[11px] ink-muted group-hover:surface-canvas">
                    {post.category}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
