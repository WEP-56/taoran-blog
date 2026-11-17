"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pin,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  Columns2,
  PenLine,
  Check,
  Search,
} from "lucide-react";
import { MarkdownBody } from "@/components/MarkdownBody";
import { countWords, estimateReadingMinutes } from "@/lib/utils";
import type { Post } from "@/db/schema";

interface ArticleEditorPanelProps {
  posts: Post[];
  onRefresh: () => Promise<void>;
  notify: (msg: string) => void;
}

interface DraftForm {
  id: number | null;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  tagsText: string;
  coverImage: string;
  publishedAt: string;
  pinned: boolean;
  status: "published" | "draft";
}

const emptyForm = (): DraftForm => ({
  id: null,
  title: "",
  slug: "",
  summary: "",
  content: "## 章节标题\n\n在这里开始落笔写作...\n\n> 引用将自动渲染为纯粹的灰阶色块。\n",
  category: "随笔",
  tagsText: "随笔, 思考",
  coverImage: "",
  publishedAt: new Date().toISOString().slice(0, 10),
  pinned: false,
  status: "published",
});

export function ArticleEditorPanel({
  posts,
  onRefresh,
  notify,
}: ArticleEditorPanelProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [viewMode, setViewMode] = useState<"split" | "write" | "preview">(
    "split"
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft" | "pinned"
  >("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter === "published" && p.status !== "published")
        return false;
      if (statusFilter === "draft" && p.status !== "draft") return false;
      if (statusFilter === "pinned" && !p.pinned) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [posts, statusFilter, search]);

  const openNew = () => {
    setForm(emptyForm());
    setEditing(true);
  };

  const openEdit = (post: Post) => {
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content: post.content,
      category: post.category,
      tagsText: (post.tags || []).join(", "),
      coverImage: post.coverImage || "",
      publishedAt: post.publishedAt,
      pinned: post.pinned,
      status: post.status === "draft" ? "draft" : "published",
    });
    setEditing(true);
  };

  const insertSnippet = (snippet: string) => {
    setForm((prev) => ({
      ...prev,
      content: `${prev.content}\n${snippet}`,
    }));
  };

  const handleSave = async (overrideStatus?: "published" | "draft") => {
    if (!form.title.trim() || !form.content.trim()) {
      notify("请填写文章标题与正文内容");
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim(),
      content: form.content,
      category: form.category.trim() || "随笔",
      tags: form.tagsText
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      coverImage: form.coverImage.trim(),
      publishedAt: form.publishedAt.trim(),
      pinned: form.pinned,
      status: overrideStatus || form.status,
    };

    try {
      const url = form.id ? `/api/posts/${form.id}` : "/api/posts";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onRefresh();
        setEditing(false);
        notify(form.id ? "文章已保存更新" : "新文章已发布");
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.error || "保存失败");
      }
    } catch {
      notify("网络请求异常");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickTogglePin = async (post: Post) => {
    const response = await fetch(`/api/posts/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !post.pinned }),
    }).catch(() => null);
    if (!response?.ok) { notify("操作失败，请检查登录状态后重试"); return; }
    await onRefresh();
    notify(post.pinned ? "已取消置顶" : "已设为置顶");
  };

  const handleQuickToggleStatus = async (post: Post) => {
    const nextStatus = post.status === "published" ? "draft" : "published";
    const response = await fetch(`/api/posts/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => null);
    if (!response?.ok) { notify("操作失败，请检查登录状态后重试"); return; }
    await onRefresh();
    notify(nextStatus === "published" ? "文章已公开" : "已转为草稿");
  };

  const handleDelete = async (id: number) => {
    const response = await fetch(`/api/posts/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { notify("操作失败，请检查登录状态后重试"); return; }
    setConfirmDeleteId(null);
    await onRefresh();
    notify("文章已删除");
  };

  if (editing) {
    const words = countWords(form.content);
    const mins = estimateReadingMinutes(form.content);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl surface-block p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl surface-canvas px-3.5 py-2 text-xs font-medium ink-primary cursor-pointer"
            >
              ← 返回文章列表
            </button>
            <span className="text-xs font-mono-num ink-muted">
              {words} 字 · 预计阅读 {mins} 分钟
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="surface-canvas inline-flex rounded-xl p-1">
              <button
                type="button"
                onClick={() => setViewMode("write")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs cursor-pointer ${
                  viewMode === "write"
                    ? "surface-invert font-medium"
                    : "ink-secondary"
                }`}
              >
                <PenLine className="h-3 w-3" />
                编辑
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`hidden md:inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs cursor-pointer ${
                  viewMode === "split"
                    ? "surface-invert font-medium"
                    : "ink-secondary"
                }`}
              >
                <Columns2 className="h-3 w-3" />
                分栏
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs cursor-pointer ${
                  viewMode === "preview"
                    ? "surface-invert font-medium"
                    : "ink-secondary"
                }`}
              >
                <Eye className="h-3 w-3" />
                预览
              </button>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave("draft")}
              className="rounded-xl surface-canvas px-3.5 py-2 text-xs font-medium ink-secondary hover:ink-primary cursor-pointer"
            >
              存为草稿
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave("published")}
              className="surface-invert inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{saving ? "保存中..." : "立即发布"}</span>
            </button>
          </div>
        </div>

        {/* Metadata Block */}
        <div className="rounded-2xl surface-block p-5 space-y-4">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="输入文章标题..."
            className="w-full rounded-xl surface-canvas px-4 py-3 text-lg font-semibold ink-primary placeholder:opacity-45"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] ink-muted mb-1 px-1">
                自定义路径 Slug（留空自动生成）
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="如 leaving-for-horizon"
                className="w-full rounded-xl surface-canvas px-3.5 py-2 text-xs font-mono-num ink-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] ink-muted mb-1 px-1">
                发布日期（支持任意历史年份）
              </label>
              <input
                type="text"
                value={form.publishedAt}
                onChange={(e) =>
                  setForm({ ...form, publishedAt: e.target.value })
                }
                placeholder="YYYY-MM-DD"
                className="w-full rounded-xl surface-canvas px-3.5 py-2 text-xs font-mono-num ink-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] ink-muted mb-1 px-1">
                分类专栏
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="随笔 / 技术 / 骑行"
                className="w-full rounded-xl surface-canvas px-3.5 py-2 text-xs ink-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] ink-muted mb-1 px-1">
                标签（逗号分隔）
              </label>
              <input
                type="text"
                value={form.tagsText}
                onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
                placeholder="极简主义, 排版, 远行"
                className="w-full rounded-xl surface-canvas px-3.5 py-2 text-xs ink-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-[11px] ink-muted mb-1 px-1">
                摘要导读（选填，留空将自动截取正文前段）
              </label>
              <input
                type="text"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="一句话概括这篇文章的气质或脉络..."
                className="w-full rounded-xl surface-canvas px-3.5 py-2 text-xs ink-primary"
              />
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl surface-canvas px-3.5 py-2">
              <span className="text-xs ink-secondary">首页置顶展示</span>
              <button
                type="button"
                onClick={() => setForm({ ...form, pinned: !form.pinned })}
                className={`rounded-lg px-3 py-1 text-xs font-medium cursor-pointer ${
                  form.pinned
                    ? "surface-invert"
                    : "surface-block ink-secondary"
                }`}
              >
                {form.pinned ? "已置顶" : "未置顶"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] ink-muted mb-1 px-1">
              题图链接 URL（选填，文章页自动以高反差黑白影调呈现）
            </label>
            <input
              type="text"
              value={form.coverImage}
              onChange={(e) =>
                setForm({ ...form, coverImage: e.target.value })
              }
              placeholder="https://images.pexels.com/..."
              className="w-full rounded-xl surface-canvas px-3.5 py-2 text-xs font-mono-num ink-primary"
            />
          </div>
        </div>

        {/* Markdown Quick Insert Bar */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl surface-block px-3 py-2 text-xs">
          <span className="ink-muted mr-1">快捷排版:</span>
          {[
            { label: "二级标题", code: "\n## 小节标题\n" },
            { label: "三级标题", code: "\n### 细节标题\n" },
            { label: "引用色块", code: "\n> 这里是一段无边框灰阶色块引用。\n" },
            {
              label: "代码块",
              code: "\n```ts\nconst minimalism = 'less is more';\n```\n",
            },
            {
              label: "无界表格",
              code: "\n| 维度 | 说明 |\n| --- | --- |\n| 色彩 | 纯粹黑白灰阶 |\n| 结构 | 色块与留白 |\n",
            },
            { label: "段落停顿", code: "\n---\n" },
          ].map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => insertSnippet(tool.code)}
              className="rounded-lg surface-canvas px-2.5 py-1 text-xs ink-secondary hover:ink-primary cursor-pointer"
            >
              {tool.label}
            </button>
          ))}
        </div>

        {/* Editor & Live Preview Workspace */}
        <div
          className={`grid gap-5 ${
            viewMode === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {(viewMode === "write" || viewMode === "split") && (
            <div className="rounded-2xl surface-block p-4">
              <div className="text-[11px] uppercase tracking-widest ink-muted mb-2 px-1">
                Markdown 原文
              </div>
              <textarea
                rows={22}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full resize-y rounded-xl surface-canvas p-4 font-mono-num text-[13.5px] leading-relaxed ink-primary"
              />
            </div>
          )}

          {(viewMode === "preview" || viewMode === "split") && (
            <div className="rounded-2xl surface-block p-6">
              <div className="text-[11px] uppercase tracking-widest ink-muted mb-3">
                实时排版预览
              </div>
              <div className="rounded-xl surface-canvas p-6 max-h-[620px] overflow-y-auto">
                <h1 className="text-2xl font-semibold ink-primary mb-4">
                  {form.title || "未命名文章"}
                </h1>
                <MarkdownBody content={form.content} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: `全部 (${posts.length})` },
              {
                id: "published",
                label: `已发布 (${
                  posts.filter((p) => p.status === "published").length
                })`,
              },
              {
                id: "draft",
                label: `草稿 (${
                  posts.filter((p) => p.status === "draft").length
                })`,
              },
              {
                id: "pinned",
                label: `置顶 (${posts.filter((p) => p.pinned).length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? "surface-invert font-medium"
                  : "surface-block ink-secondary hover:ink-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="surface-block flex items-center gap-2 rounded-xl px-3 py-1.5">
            <Search className="h-3.5 w-3.5 ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="筛选标题或分类..."
              className="w-36 sm:w-48 bg-transparent text-xs ink-primary placeholder:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={openNew}
            className="surface-invert inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>写新文章</span>
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl surface-block p-4 sm:px-5 transition-colors hover:surface-block-strong"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-num text-xs ink-muted">
                  {post.publishedAt}
                </span>
                <span className="rounded-md surface-canvas px-2 py-0.5 text-[11px] ink-secondary">
                  {post.category}
                </span>
                {post.status === "draft" && (
                  <span className="rounded-md surface-canvas px-2 py-0.5 text-[11px] font-medium ink-muted">
                    草稿
                  </span>
                )}
                {post.pinned && (
                  <span className="surface-invert rounded-md px-2 py-0.5 text-[10.5px] font-medium">
                    置顶
                  </span>
                )}
              </div>

              <div className="truncate text-[15px] font-medium ink-primary">
                {post.title}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-num ink-muted">
                <span>/{post.slug}</span>
                <span>·</span>
                <span>浏览 {post.views}</span>
                <span>·</span>
                <span>共鸣 {post.likes}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleQuickTogglePin(post)}
                title={post.pinned ? "取消置顶" : "置顶"}
                className={`rounded-lg px-2.5 py-1.5 text-xs cursor-pointer ${
                  post.pinned
                    ? "surface-invert"
                    : "surface-canvas ink-secondary hover:ink-primary"
                }`}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickToggleStatus(post)}
                className="rounded-lg surface-canvas px-2.5 py-1.5 text-xs ink-secondary hover:ink-primary cursor-pointer"
              >
                {post.status === "published" ? "转草稿" : "发布"}
              </button>

              <button
                type="button"
                onClick={() => openEdit(post)}
                className="inline-flex items-center gap-1 rounded-lg surface-canvas px-3 py-1.5 text-xs font-medium ink-primary cursor-pointer"
              >
                <Edit3 className="h-3 w-3" />
                <span>编辑</span>
              </button>

              <Link
                href={`/posts/${post.slug}`}
                className="inline-flex items-center gap-1 rounded-lg surface-canvas px-2.5 py-1.5 text-xs ink-secondary hover:ink-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>

              {confirmDeleteId === post.id ? (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    className="surface-invert rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    确认删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg surface-canvas px-2 py-1.5 text-xs ink-muted cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(post.id)}
                  className="rounded-lg surface-canvas px-2.5 py-1.5 text-xs ink-muted hover:ink-primary cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
