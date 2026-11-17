"use client";

import React, { useState, useEffect } from "react";
import { Camera, MapPin, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSite } from "./SiteProvider";
import type { GalleryItem } from "@/db/schema";

export function GalleryView({ items }: { items: GalleryItem[] }) {
  const { t } = useSite();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIndex(null);
      if (e.key === "ArrowRight") {
        setActiveIndex((prev) =>
          prev === null ? null : (prev + 1) % items.length
        );
      }
      if (e.key === "ArrowLeft") {
        setActiveIndex((prev) =>
          prev === null ? null : (prev - 1 + items.length) % items.length
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, items.length]);

  const activeItem = activeIndex !== null ? items[activeIndex] : null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight ink-primary">
          {t("光影影集", "Monochrome Gallery")}
        </h1>
        <p className="mt-1.5 text-xs ink-muted">
          {t(
            "剥离色彩之后，光线、阴影与建筑结构本身成为叙事",
            "When color steps aside, light, shadow, and geometry tell the story."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {items.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => setActiveIndex(idx)}
            className={`group cursor-pointer overflow-hidden rounded-2xl surface-block p-3 transition-all hover:surface-block-strong ${
              item.featured && idx === 0 ? "sm:col-span-2" : ""
            }`}
          >
            <div className="overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className={`w-full object-cover grayscale contrast-110 transition-transform duration-700 group-hover:scale-[1.02] ${
                  item.featured && idx === 0 ? "h-64 sm:h-80" : "h-52"
                }`}
              />
            </div>

            <div className="px-2 pt-3.5 pb-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold ink-primary">
                  {item.title}
                </h2>
                <time className="font-mono-num text-[11px] ink-muted shrink-0">
                  {item.takenAt}
                </time>
              </div>
              {item.caption && (
                <p className="text-xs leading-relaxed ink-secondary line-clamp-2">
                  {item.caption}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] ink-muted">
                {item.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </span>
                )}
                {item.cameraSpec && (
                  <span className="inline-flex items-center gap-1 font-mono-num">
                    <Camera className="h-3 w-3" />
                    {item.cameraSpec}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl surface-block p-8 text-center text-sm ink-muted">
          {t(
            "影集暂无照片，可在 Studio 后台添加摄影作品。",
            "No photos yet. Add works from Studio."
          )}
        </div>
      )}

      {/* Fullscreen Theater Lightbox */}
      {activeItem && activeIndex !== null && (
        <div
          onClick={() => setActiveIndex(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 p-5 sm:p-10 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="fixed top-6 right-6 rounded-full bg-white/15 p-2.5 text-white transition-opacity hover:opacity-80 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(
                    (activeIndex - 1 + items.length) % items.length
                  );
                }}
                className="fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 rounded-full bg-white/12 p-3 text-white transition-opacity hover:bg-white/25 cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((activeIndex + 1) % items.length);
                }}
                className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 rounded-full bg-white/12 p-3 text-white transition-opacity hover:bg-white/25 cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full flex flex-col items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeItem.imageUrl}
              alt={activeItem.title}
              className="max-h-[72vh] w-auto rounded-xl object-contain grayscale contrast-110"
            />
            <div className="mt-5 text-center space-y-1.5 text-white">
              <h3 className="text-base font-medium">{activeItem.title}</h3>
              {activeItem.caption && (
                <p className="text-xs text-white/70 max-w-xl">
                  {activeItem.caption}
                </p>
              )}
              <p className="font-mono-num text-[11px] text-white/45 pt-1">
                {[activeItem.location, activeItem.cameraSpec, activeItem.takenAt]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
