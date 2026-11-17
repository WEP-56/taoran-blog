"use client";

import React from "react";
import Link from "next/link";
import { Pin, ArrowUpRight } from "lucide-react";
import { useSite } from "./SiteProvider";
import { InkMonolith3D } from "./InkMonolith3D";
import type { Post, Moment } from "@/db/schema";

interface HomeViewProps {
  introZh: string;
  introEn: string;
  nowStatus: string;
  posts: Post[];
  latestMoment: Moment | null;
}

export function HomeView({
  introZh,
  introEn,
  nowStatus,
  posts,
  latestMoment,
}: HomeViewProps) {
  const { lang, t } = useSite();

  return (
    <div className="space-y-14">
      {/* Intro Manifesto + Subtle 3D Halftone Ink Monolith */}
      <section className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-8">
        <div className="flex-1 space-y-4">
          <p className="text-[15px] leading-[1.95] ink-secondary">
            {lang === "zh" ? introZh : introEn || introZh}
          </p>

          {nowStatus && (
            <div className="inline-flex items-center gap-2.5 rounded-xl surface-block px-3.5 py-2 text-xs ink-secondary">
              <span className="h-1.5 w-1.5 rounded-full surface-invert animate-pulse shrink-0" />
              <span className="line-clamp-1">{nowStatus}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 self-center sm:self-auto">
          <InkMonolith3D
            variant="compact"
            posts={posts.map((p) => ({
              slug: p.slug,
              title: p.title,
              publishedAt: p.publishedAt,
              category: p.category,
            }))}
          />
        </div>
      </section>

      {/* Whisper Latest Moment Tonal Block */}
      {latestMoment && (
        <section>
          <Link
            href="/moments"
            className="group block rounded-2xl surface-block px-5 py-4 transition-all hover:surface-block-strong"
          >
            <div className="flex items-center justify-between gap-3 text-xs ink-muted mb-1.5">
              <span className="inline-flex items-center gap-2">
                <span className="rounded-md surface-canvas px-2 py-0.5 font-medium ink-primary">
                  {t("近期动态", "Latest Note")}
                </span>
                <span>{latestMoment.tag}</span>
                {latestMoment.location && <span>· {latestMoment.location}</span>}
              </span>
              <span className="font-mono-num inline-flex items-center gap-1">
                {latestMoment.publishedAt.slice(0, 10)}
                <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </div>
            <p className="text-[14px] leading-relaxed ink-primary line-clamp-2">
              {latestMoment.content}
            </p>
          </Link>
        </section>
      )}

      {/* Recent Articles List — Pure Typography & Tonal Hover Blocks */}
      <section>
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold tracking-tight ink-primary">
            {t("近期文章", "Recent Writing")}
          </h2>
          <Link
            href="/archive"
            className="rounded-lg px-2.5 py-1 text-xs ink-muted transition-colors hover:surface-block hover:ink-primary"
          >
            {t("全部归档", "All Archive")} ({posts.length})
          </Link>
        </div>

        <div className="space-y-1">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.slug}`}
              className="group -mx-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-5 rounded-xl px-3 py-2.5 transition-colors hover:surface-block"
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6 min-w-0">
                <time className="w-28 shrink-0 font-mono-num text-[13.5px] ink-muted">
                  {post.publishedAt}
                </time>

                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span
                    className={`text-[15.5px] leading-snug transition-opacity ${
                      post.pinned
                        ? "font-semibold ink-primary"
                        : "ink-primary group-hover:opacity-90"
                    }`}
                  >
                    {post.title}
                  </span>

                  {post.pinned && (
                    <span className="surface-invert inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium">
                      <Pin className="h-2.5 w-2.5" />
                      <span>{t("置顶", "Pinned")}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden md:flex shrink-0 items-center gap-2 text-xs ink-muted opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-md surface-canvas px-2 py-0.5">
                  {post.category}
                </span>
                <span className="font-mono-num">{post.readingMinutes}m</span>
              </div>
            </Link>
          ))}

          {posts.length === 0 && (
            <div className="rounded-2xl surface-block p-8 text-center text-sm ink-muted">
              {t(
                "尚无已发布文章，可前往右上角 Studio 开始创作。",
                "No published articles yet. Visit Studio to start writing."
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
