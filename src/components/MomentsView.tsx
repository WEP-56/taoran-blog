"use client";

import React, { useMemo, useState } from "react";
import { Heart, MapPin } from "lucide-react";
import { useSite } from "./SiteProvider";
import type { Moment } from "@/db/schema";

export function MomentsView({ initialMoments }: { initialMoments: Moment[] }) {
  const { t } = useSite();
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [likedIds, setLikedIds] = useState<Record<number, boolean>>({});

  const tags = useMemo(() => {
    const set = new Set<string>();
    moments.forEach((m) => {
      if (m.tag) set.add(m.tag);
    });
    return Array.from(set);
  }, [moments]);

  const filtered = useMemo(() => {
    if (!selectedTag) return moments;
    return moments.filter((m) => m.tag === selectedTag);
  }, [moments, selectedTag]);

  const handleLike = async (id: number) => {
    if (likedIds[id]) return;
    setLikedIds((prev) => ({ ...prev, [id]: true }));
    setMoments((prev) =>
      prev.map((m) => (m.id === id ? { ...m, likes: m.likes + 1 } : m))
    );

    try {
      await fetch(`/api/moments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "like" }),
      });
    } catch {
      // optimistic UI preserved
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight ink-primary">
            {t("片刻动态", "Moments & Notes")}
          </h1>
          <p className="mt-1.5 text-xs ink-muted">
            {t(
              "未成篇的吉光片羽、骑行里程与深夜随记",
              "Short fragments, cycling logs, and fleeting observations."
            )}
          </p>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTag("")}
              className={`rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer ${
                !selectedTag
                  ? "surface-invert font-medium"
                  : "surface-block ink-secondary"
              }`}
            >
              {t("全部", "All")}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                className={`rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer ${
                  selectedTag === tag
                    ? "surface-invert font-medium"
                    : "surface-block ink-secondary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {filtered.map((item) => {
          const isLiked = Boolean(likedIds[item.id]);
          return (
            <div
              key={item.id}
              className="rounded-2xl surface-block p-5 sm:p-6 space-y-3.5 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs ink-muted">
                <div className="flex items-center gap-2">
                  <span className="rounded-md surface-canvas px-2 py-0.5 font-medium ink-primary">
                    {item.tag}
                  </span>
                  {item.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {item.location}
                    </span>
                  )}
                </div>
                <time className="font-mono-num">{item.publishedAt}</time>
              </div>

              <p className="text-[15px] leading-[1.85] ink-primary whitespace-pre-line">
                {item.content}
              </p>

              {item.imageUrl && (
                <div className="pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.tag}
                    className="max-h-72 w-full rounded-xl object-cover grayscale contrast-110"
                  />
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleLike(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer ${
                    isLiked
                      ? "surface-invert"
                      : "surface-canvas ink-secondary hover:ink-primary"
                  }`}
                >
                  <Heart
                    className={`h-3 w-3 ${isLiked ? "fill-current" : ""}`}
                  />
                  <span className="font-mono-num">{item.likes}</span>
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl surface-block p-8 text-center text-sm ink-muted">
            {t("暂无动态记录。", "No moments yet.")}
          </div>
        )}
      </div>
    </div>
  );
}
