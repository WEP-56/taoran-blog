"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useSite } from "./SiteProvider";
import { MarkdownBody } from "./MarkdownBody";
import type { SocialLink, FriendLink } from "@/db/schema";

interface AboutViewProps {
  authorName: string;
  authorRole: string;
  nowStatus: string;
  aboutMarkdown: string;
  socialLinks: SocialLink[];
  friends: FriendLink[];
}

export function AboutView({
  authorName,
  authorRole,
  nowStatus,
  aboutMarkdown,
  socialLinks,
  friends,
}: AboutViewProps) {
  const { shaderMode, setShaderMode, t } = useSite();

  return (
    <div className="space-y-12">
      {/* Author Tonal Identity Card */}
      <section className="rounded-2xl surface-block p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight ink-primary">
              {authorName}
            </h1>
            {authorRole && (
              <p className="mt-1 text-xs ink-secondary">{authorRole}</p>
            )}
          </div>

          <Link
            href="/admin"
            className="surface-canvas rounded-xl px-3.5 py-2 text-xs font-medium ink-primary transition-opacity hover:opacity-80"
          >
            {t("在 Studio 编辑此页 →", "Edit in Studio →")}
          </Link>
        </div>

        {nowStatus && (
          <div className="rounded-xl surface-canvas px-4 py-3 text-xs leading-relaxed ink-secondary">
            <span className="font-semibold ink-primary mr-2">
              {t("近况 Now ·", "Now ·")}
            </span>
            {nowStatus}
          </div>
        )}

        {socialLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {socialLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target={link.url.startsWith("http") ? "_blank" : undefined}
                rel={
                  link.url.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                className="surface-invert inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-85"
              >
                <span>{link.label}</span>
                <ArrowUpRight className="h-3 w-3 opacity-75" />
              </a>
            ))}
          </div>
        )}

        {friends.length > 0 && (
          <div className="rounded-xl surface-canvas px-4 py-3">
            <div className="mb-2 text-[11px] uppercase tracking-widest ink-muted">
              {t("友好链接", "Friend Links")}
            </div>
            <div className="flex flex-wrap gap-2">
              {friends.slice(0, 8).map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg surface-block px-2.5 py-1 text-[11px] ink-secondary transition-colors hover:ink-primary"
                >
                  {f.name}
                </a>
              ))}
              <Link
                href="/links"
                className="rounded-lg surface-block px-2.5 py-1 text-[11px] ink-secondary transition-colors hover:ink-primary"
              >
                {t("全部友链 →", "All friends →")}
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Editable Markdown Bio */}
      <section>
        <MarkdownBody content={aboutMarkdown} />
      </section>

      {/* Interactive Three.js Paper Shader Inspector Tonal Block */}
      <section className="rounded-2xl surface-block p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold ink-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            {t(
              "底层 WebGL 纸面微地形 · 实时预览调节",
              "Ambient WebGL Paper Heightfield · Live Intensity"
            )}
          </span>
        </div>
        <p className="text-xs leading-relaxed ink-secondary">
          {t(
            "默认以「克制微风」运行，仅在凝视或轻移光标时显现丝绸般的侧光涟漪。你也可切换至更鲜明的起伏肌理感受三维法线光影。",
            "Runs in Subtle mode by default so typography stays sovereign. Switch to Expressive to observe the 3D raking-light heightfield more distinctly."
          )}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(
            [
              { id: "subtle", zh: "克制微风 (默认)", en: "Subtle Breath" },
              { id: "expressive", zh: "深邃肌理 (明显)", en: "Expressive Relief" },
              { id: "off", zh: "纯静素纸 (关闭)", en: "Static Paper" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setShaderMode(opt.id)}
              className={`rounded-xl px-3.5 py-2 text-xs transition-all cursor-pointer ${
                shaderMode === opt.id
                  ? "surface-invert font-medium"
                  : "surface-canvas ink-secondary hover:ink-primary"
              }`}
            >
              {t(opt.zh, opt.en)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
