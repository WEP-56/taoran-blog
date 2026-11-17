"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, ArrowLeft, Eye, Clock, BookOpen, Send } from "lucide-react";
import { useSite } from "./SiteProvider";
import { MarkdownBody, extractHeadings } from "./MarkdownBody";
import { countWords } from "@/lib/utils";
import type { Post, CommentItem } from "@/db/schema";

interface ArticleDetailViewProps {
  post: Post;
  prevPost: { slug: string; title: string } | null;
  nextPost: { slug: string; title: string } | null;
  initialComments: CommentItem[];
}

export function ArticleDetailView({
  post,
  prevPost,
  nextPost,
  initialComments,
}: ArticleDetailViewProps) {
  const { t } = useSite();
  const [likes, setLikes] = useState(post.likes);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [comments, setComments] = useState<CommentItem[]>(initialComments);

  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const headings = useMemo(() => extractHeadings(post.content), [post.content]);
  const wordCount = useMemo(() => countWords(post.content), [post.content]);

  useEffect(() => {
    const likedKey = `air-liked-${post.slug}`;
    if (window.localStorage.getItem(likedKey) === "1") {
      queueMicrotask(() => setLiked(true));
    }

    const onScroll = () => {
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setProgress(100);
        return;
      }
      setProgress(Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [post.slug]);

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikes((prev) => prev + 1);
    window.localStorage.setItem(`air-liked-${post.slug}`, "1");

    try {
      await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "like" }),
      });
    } catch {
      // optimistic UI preserved
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !commentText.trim() || submitting) return;

    setSubmitting(true);
    setFeedback("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postSlug: post.slug,
          authorName: authorName.trim(),
          authorEmail: authorEmail.trim(),
          content: commentText.trim(),
        }),
      });
      if (res.ok) {
        const created: CommentItem = await res.json();
        if (created.approved) setComments((prev) => [created, ...prev]);
        setCommentText("");
        setFeedback(t("感谢留言，审核后将公开显示。", "Thank you. Your comment awaits review."));
      } else {
        setFeedback(t("发送失败，请稍后重试。", "Failed to post comment."));
      }
    } catch {
      setFeedback(t("网络异常，请稍后重试。", "Network error."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="relative">
      {/* Subtle monochrome reading progress block at viewport top */}
      <div className="fixed top-0 left-0 z-40 h-1 w-full pointer-events-none">
        <div
          className="h-full surface-invert transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Desktop Margin Table of Contents (Zero lines, pure tonal pills) */}
      {headings.length > 1 && (
        <aside className="hidden xl:block fixed top-36 left-[calc(50%+390px)] w-52 space-y-1.5">
          <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-widest ink-muted">
            {t("目录", "Contents")}
          </div>
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className={`block truncate rounded-lg px-2.5 py-1 text-xs transition-colors hover:surface-block ink-muted hover:ink-primary ${
                h.level === 3 ? "pl-5 text-[11px]" : ""
              }`}
            >
              {h.text}
            </a>
          ))}
        </aside>
      )}

      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg surface-block px-3 py-1.5 text-xs ink-secondary transition-opacity hover:ink-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t("返回列表", "Back")}</span>
        </Link>
      </div>

      <header className="mb-10 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs ink-muted">
          <span className="rounded-md surface-block px-2.5 py-1 font-medium ink-primary">
            {post.category}
          </span>
          <time className="font-mono-num px-1">{post.publishedAt}</time>
          <span>·</span>
          <span className="inline-flex items-center gap-1 font-mono-num">
            <Clock className="h-3 w-3" />
            {post.readingMinutes} {t("分钟", "min")}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 font-mono-num">
            <BookOpen className="h-3 w-3" />
            {wordCount} {t("字", "words")}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 font-mono-num">
            <Eye className="h-3 w-3" />
            {post.views + 1}
          </span>
        </div>

        <h1 className="text-2xl sm:text-[29px] font-semibold leading-[1.35] tracking-tight ink-primary">
          {post.title}
        </h1>

        {post.summary && (
          <p className="rounded-xl surface-block px-5 py-4 text-[14.5px] leading-relaxed ink-secondary">
            {post.summary}
          </p>
        )}

        {post.coverImage && (
          <div className="pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImage}
              alt={post.title}
              className="max-h-[380px] w-full rounded-2xl object-cover surface-block grayscale contrast-105"
            />
          </div>
        )}
      </header>

      <MarkdownBody content={post.content} />

      {/* Tags & Resonance Action */}
      <div className="mt-14 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(post.tags || []).map((tag) => (
            <Link
              key={tag}
              href={`/tags?tag=${encodeURIComponent(tag)}`}
              className="rounded-lg surface-block px-3 py-1.5 text-xs ink-secondary transition-colors hover:surface-block-strong hover:ink-primary"
            >
              # {tag}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={handleLike}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-transform active:scale-95 cursor-pointer ${
            liked
              ? "surface-invert"
              : "surface-block ink-primary hover:surface-block-strong"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          <span>{liked ? t("已共鸣", "Resonated") : t("共鸣", "Resonate")}</span>
          <span className="font-mono-num opacity-80">{likes}</span>
        </button>
      </div>

      {/* Previous & Next Tonal Navigation Blocks */}
      {(prevPost || nextPost) && (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prevPost ? (
            <Link
              href={`/posts/${prevPost.slug}`}
              className="rounded-2xl surface-block p-5 transition-colors hover:surface-block-strong"
            >
              <div className="text-[11px] uppercase tracking-widest ink-muted mb-1.5">
                ← {t("上一篇", "Previous")}
              </div>
              <div className="text-sm font-medium ink-primary line-clamp-1">
                {prevPost.title}
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextPost ? (
            <Link
              href={`/posts/${nextPost.slug}`}
              className="rounded-2xl surface-block p-5 text-left sm:text-right transition-colors hover:surface-block-strong"
            >
              <div className="text-[11px] uppercase tracking-widest ink-muted mb-1.5">
                {t("下一篇", "Next")} →
              </div>
              <div className="text-sm font-medium ink-primary line-clamp-1">
                {nextPost.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Reader Comments & Guestbook */}
      <section className="mt-20 space-y-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold ink-primary">
            {t("读者回响", "Responses")}
            <span className="ml-2 font-mono-num text-xs ink-muted">
              {comments.length}
            </span>
          </h3>
        </div>

        <form
          onSubmit={handleCommentSubmit}
          className="rounded-2xl surface-block p-5 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={t("你的称呼 *", "Your name *")}
              className="rounded-xl surface-canvas px-3.5 py-2.5 text-sm ink-primary placeholder:opacity-50"
            />
            <input
              type="email"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              placeholder={t("邮箱（选填，不公开）", "Email (optional)")}
              className="rounded-xl surface-canvas px-3.5 py-2.5 text-sm ink-primary placeholder:opacity-50"
            />
          </div>

          <textarea
            rows={3}
            required
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t(
              "写下你的思考或回响...",
              "Leave a quiet thought..."
            )}
            className="w-full resize-none rounded-xl surface-canvas px-3.5 py-3 text-sm leading-relaxed ink-primary placeholder:opacity-50"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs ink-muted">{feedback}</span>
            <button
              type="submit"
              disabled={submitting}
              className="surface-invert inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-3 w-3" />
              <span>{submitting ? t("投递中...", "Sending...") : t("投递回响", "Post")}</span>
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl surface-block px-5 py-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold ink-primary">
                    {c.authorName}
                  </span>
                  {c.isAdmin && (
                    <span className="surface-invert rounded-md px-1.5 py-0.5 text-[10px] font-medium">
                      {t("作者", "Author")}
                    </span>
                  )}
                </div>
                <time className="font-mono-num ink-muted">
                  {new Date(c.createdAt).toISOString().slice(0, 10)}
                </time>
              </div>
              <p className="text-sm leading-relaxed ink-secondary">
                {c.content}
              </p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
