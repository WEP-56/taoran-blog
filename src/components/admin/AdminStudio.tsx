"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  FileText,
  MessageSquareQuote,
  MessageCircle,
  Settings,
  Sun,
  Moon,
  RefreshCw,
  Download,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit3,
  Check,
  Eye,
  EyeOff,
  Reply,
  ArrowLeft,
  Link2,
  ExternalLink,
} from "lucide-react";
import { useSite } from "@/components/SiteProvider";
import { ArticleEditorPanel } from "./ArticleEditorPanel";
import { MarkdownBody } from "@/components/MarkdownBody";
import type {
  Post,
  Moment,
  CommentItem,
  SocialLink,
  FriendLink,
} from "@/db/schema";

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface TelemetryData {
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    publishedCount: number;
    draftCount: number;
    momentsCount: number;
    commentsCount: number;
    totalWords: number;
    totalLikes: number;
  };
  dailySeries: {
    date: string;
    label: string;
    views: number;
    uniques: number;
  }[];
  deviceCounts: Record<string, number>;
  topPosts: {
    id: number;
    slug: string;
    title: string;
    views: number;
    likes: number;
    category: string;
    status: string;
  }[];
  recentVisits: {
    id: number;
    path: string;
    device: string;
    referrer: string;
    createdAt: string;
  }[];
}

interface SiteFormState {
  siteName: string;
  siteTagline: string;
  introZh: string;
  introEn: string;
  authorName: string;
  authorRole: string;
  footerText: string;
  nowStatus: string;
  aboutMarkdown: string;
  socialLinks: SocialLink[];
  shaderMode: "subtle" | "expressive" | "off";
  adminPasscode: string;
}

type StudioTab =
  | "overview"
  | "posts"
  | "moments"
  | "friends"
  | "comments"
  | "settings";

export function AdminStudio() {
  const { theme, toggleTheme, setShaderMode } = useSite();

  const [activeTab, setActiveTab] = useState<StudioTab>("overview");
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [lockError, setLockError] = useState("");

  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [friends, setFriends] = useState<FriendLink[]>([]);
  const [friendDraft, setFriendDraft] = useState({
    id: null as number | null,
    name: "",
    url: "",
    description: "",
    sortOrder: 0,
  });
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [siteForm, setSiteForm] = useState<SiteFormState>({
    siteName: "Air",
    siteTagline: "",
    introZh: "",
    introEn: "",
    authorName: "",
    authorRole: "",
    footerText: "",
    nowStatus: "",
    aboutMarkdown: "",
    socialLinks: [],
    shaderMode: "subtle",
    adminPasscode: "",
  });

  // Hover index for 14-day tonal chart
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  // Moments composer & edit state
  const [momentDraft, setMomentDraft] = useState({
    id: null as number | null,
    content: "",
    tag: "日常",
    location: "",
    imageUrl: "",
    publishedAt: "",
  });

  // Comments inline reply state
  const [replyTargetSlug, setReplyTargetSlug] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [aboutPreview, setAboutPreview] = useState(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? "" : prev));
    }, 2800);
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, pRes, mRes, fRes, cRes, sRes] = await Promise.all([
        fetch("/api/telemetry").then((r) => { if (!r.ok) { setLocked(true); throw new Error("Session expired"); } return r.json(); }),
        fetch("/api/posts?all=1").then((r) => r.json()),
        fetch("/api/moments").then((r) => r.json()),
        fetch("/api/friends").then((r) => r.json()),
        fetch("/api/comments?all=1").then((r) => r.json()),
        fetch("/api/site").then((r) => r.json()),
      ]);

      if (tRes && tRes.summary) setTelemetry(tRes);
      if (Array.isArray(pRes)) setPosts(pRes);
      if (Array.isArray(mRes)) setMoments(mRes);
      if (Array.isArray(fRes)) setFriends(fRes);
      if (Array.isArray(cRes)) setComments(cRes);
      if (sRes && sRes.siteName !== undefined) {
        setSiteForm({
          siteName: sRes.siteName || "Air",
          siteTagline: sRes.siteTagline || "",
          introZh: sRes.introZh || "",
          introEn: sRes.introEn || "",
          authorName: sRes.authorName || "",
          authorRole: sRes.authorRole || "",
          footerText: sRes.footerText || "",
          nowStatus: sRes.nowStatus || "",
          aboutMarkdown: sRes.aboutMarkdown || "",
          socialLinks: Array.isArray(sRes.socialLinks) ? sRes.socialLinks : [],
          shaderMode: sRes.shaderMode || "subtle",
          adminPasscode: "",
        });
      }
    } catch {
      notify("加载后台数据失败");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      setLocked(!data.valid);
      if (data.valid) void loadAllData();
    }).catch(() => setLocked(true)).finally(() => setReady(true));
  }, [loadAllData]);

  const handleLockToggle = () => {
    setLocked(true);
    setPasscodeInput("");
    setLockError("");
    void fetch("/api/auth", { method: "DELETE" });
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passcode: passcodeInput,
      }),
    }).catch(() => null);
    if (!res) { setLockError("网络异常，请稍后重试"); return; }
    const data = await res.json();
    if (data.valid) {
      setLocked(false);
      setPasscodeInput("");
      await loadAllData();
      notify("欢迎回到创作台");
    } else {
      setLockError("登录失败，请检查口令或稍后重试");
    }
  };

  const handleExportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      site: siteForm,
      posts,
      moments,
      friends,
      comments,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `air-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("全站数据 JSON 已导出");
  };

  // --- Moments CRUD ---
  const handleSaveMoment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!momentDraft.content.trim()) return;

    const url = momentDraft.id
      ? `/api/moments/${momentDraft.id}`
      : "/api/moments";
    const method = momentDraft.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(momentDraft),
    });

    if (res.ok) {
      setMomentDraft({
        id: null,
        content: "",
        tag: "日常",
        location: "",
        imageUrl: "",
        publishedAt: "",
      });
      await loadAllData();
      notify(momentDraft.id ? "动态已更新" : "新动态已发布");
    }
  };

  const handleDeleteMoment = async (id: number) => {
    const response = await fetch(`/api/moments/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { notify("操作失败，请检查登录状态后重试"); return; }
    await loadAllData();
    notify("动态已删除");
  };

  // --- Friends CRUD ---
  const handleSaveFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendDraft.name.trim() || !friendDraft.url.trim()) {
      notify("请填写友链名称与链接地址");
      return;
    }

    const url = friendDraft.id
      ? `/api/friends/${friendDraft.id}`
      : "/api/friends";
    const method = friendDraft.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(friendDraft),
    });

    if (res.ok) {
      setFriendDraft({
        id: null,
        name: "",
        url: "",
        description: "",
        sortOrder: 0,
      });
      await loadAllData();
      notify(friendDraft.id ? "友链已更新" : "友链已添加");
    } else {
      notify("保存友链失败");
    }
  };

  const handleDeleteFriend = async (id: number) => {
    const response = await fetch(`/api/friends/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { notify("操作失败，请检查登录状态后重试"); return; }
    await loadAllData();
    notify("友链已移除");
  };

  // --- Comments Moderation & Reply ---
  const handleToggleCommentApproval = async (c: CommentItem) => {
    const response = await fetch(`/api/comments/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !c.approved }),
    }).catch(() => null);
    if (!response?.ok) { notify("操作失败，请检查登录状态后重试"); return; }
    await loadAllData();
    notify(c.approved ? "该留言已隐藏" : "该留言已公开显示");
  };

  const handleDeleteComment = async (id: number) => {
    const response = await fetch(`/api/comments/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { notify("操作失败，请检查登录状态后重试"); return; }
    await loadAllData();
    notify("留言已删除");
  };

  const handleAdminReply = async (postSlug: string) => {
    if (!replyContent.trim()) return;
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postSlug,
        authorName: siteForm.authorName || "作者",
        content: replyContent.trim(),
        isAdmin: true,
      }),
    });
    if (res.ok) {
      setReplyTargetSlug(null);
      setReplyContent("");
      await loadAllData();
      notify("作者回复已发布");
    }
  };

  // --- Site Settings Save ---
  const handleSaveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      siteName: siteForm.siteName,
      siteTagline: siteForm.siteTagline,
      introZh: siteForm.introZh,
      introEn: siteForm.introEn,
      authorName: siteForm.authorName,
      authorRole: siteForm.authorRole,
      footerText: siteForm.footerText,
      nowStatus: siteForm.nowStatus,
      aboutMarkdown: siteForm.aboutMarkdown,
      socialLinks: siteForm.socialLinks.filter(
        (l) => l.label.trim() && l.url.trim()
      ),
      shaderMode: siteForm.shaderMode,
    };

    if (siteForm.adminPasscode.trim()) {
      payload.adminPasscode = siteForm.adminPasscode.trim();
    }

    const res = await fetch("/api/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShaderMode(siteForm.shaderMode);
      if (payload.adminPasscode) handleLockToggle();
      setSiteForm((prev) => ({ ...prev, adminPasscode: "" }));
      if (!payload.adminPasscode) await loadAllData();
      notify(payload.adminPasscode ? "口令已更新，请重新登录" : "全站设置与文案已更新生效");
    } else {
      notify("保存设置失败");
    }
  };

  if (!ready) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full surface-block-strong" />
      </div>
    );
  }

  // Locked Screen
  if (locked) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-3xl surface-block p-8 space-y-5"
        >
          <div className="flex items-center justify-between">
            <span className="font-editorial text-2xl font-semibold ink-primary">
              {siteForm.siteName || "WEP"} · Studio
            </span>
            <Lock className="h-4 w-4 ink-muted" />
          </div>
          <p className="text-xs leading-relaxed ink-secondary">
            创作台已启用口令鉴权。请输入管理口令解锁监控与内容管理。
          </p>
          <input
            type="password"
            autoFocus
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            placeholder="输入管理口令..."
            className="w-full rounded-xl surface-canvas px-4 py-3 text-sm ink-primary"
          />
          {lockError && <p className="text-xs ink-primary">{lockError}</p>}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Link
              href="/"
              className="rounded-xl surface-canvas px-4 py-2.5 text-xs ink-secondary hover:ink-primary"
            >
              ← 返回博客
            </Link>
            <button
              type="submit"
              className="surface-invert inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-medium cursor-pointer"
            >
              <Unlock className="h-3.5 w-3.5" />
              <span>解锁后台</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  const navTabs: {
    id: StudioTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }[] = [
    {
      id: "overview",
      label: "数据监控",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
    },
    {
      id: "posts",
      label: "文章创作",
      count: posts.length,
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    {
      id: "moments",
      label: "动态随想",
      count: moments.length,
      icon: <MessageSquareQuote className="h-3.5 w-3.5" />,
    },
    {
      id: "friends",
      label: "友链",
      count: friends.length,
      icon: <Link2 className="h-3.5 w-3.5" />,
    },
    {
      id: "comments",
      label: "读者回响",
      count: comments.length,
      icon: <MessageCircle className="h-3.5 w-3.5" />,
    },
    {
      id: "settings",
      label: "全站设置",
      icon: <Settings className="h-3.5 w-3.5" />,
    },
  ];

  const maxDailyViews = Math.max(
    ...(telemetry?.dailySeries.map((d) => d.views) || [1]),
    1
  );
  const activeDay =
    hoveredBarIdx !== null && telemetry?.dailySeries[hoveredBarIdx]
      ? telemetry.dailySeries[hoveredBarIdx]
      : telemetry?.dailySeries[telemetry.dailySeries.length - 1] || null;

  const totalDeviceHits = Math.max(
    Object.values(telemetry?.deviceCounts || {}).reduce((a, b) => a + b, 0),
    1
  );

  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-5 sm:px-8 py-8 sm:py-12">
      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl surface-invert px-4 py-2.5 text-xs font-medium shadow-lg transition-all">
          {toast}
        </div>
      )}

      {/* Top Studio Header */}
      <header className="mb-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl surface-block px-3 py-2 text-xs ink-secondary hover:ink-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>查看前台</span>
            </Link>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-editorial text-2xl font-semibold tracking-tight ink-primary">
                  {siteForm.siteName || "WEP"} · Studio
                </h1>
                <span className="rounded-md surface-block px-2 py-0.5 text-[11px] font-mono-num ink-secondary">
                  创作与监控中枢
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAllData}
              title="刷新实时数据"
              className="inline-flex items-center gap-1.5 rounded-xl surface-block px-3 py-2 text-xs ink-secondary hover:ink-primary cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">刷新</span>
            </button>

            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 rounded-xl surface-block px-3 py-2 text-xs ink-secondary hover:ink-primary cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">导出 JSON</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl surface-block p-2 ink-secondary hover:ink-primary cursor-pointer"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleLockToggle}
              className="inline-flex items-center gap-1.5 rounded-xl surface-block px-3 py-2 text-xs ink-secondary hover:ink-primary cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>锁定</span>
            </button>
          </div>
        </div>

        {/* Zero-Line Solid Block Navigation */}
        <nav className="flex flex-wrap gap-2 rounded-2xl surface-block p-1.5">
          {navTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs transition-all cursor-pointer ${
                  active
                    ? "surface-invert font-medium"
                    : "ink-secondary hover:surface-canvas hover:ink-primary"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="font-mono-num opacity-70">{tab.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* TAB 1: TELEMETRY & ANALYTICS OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 6 KPI Monochrome Tonal Blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: "总访问量 PV",
                value: telemetry?.summary.totalViews ?? 0,
                sub: "全站真实累计",
              },
              {
                label: "独立访客 UV",
                value: telemetry?.summary.uniqueVisitors ?? 0,
                sub: "去重访客标识",
              },
              {
                label: "已发文章",
                value: telemetry?.summary.publishedCount ?? 0,
                sub: `${telemetry?.summary.draftCount ?? 0} 篇草稿`,
              },
              {
                label: "累计落笔字数",
                value: (telemetry?.summary.totalWords ?? 0).toLocaleString(),
                sub: "中西文总计",
              },
              {
                label: "动态 / 友链",
                value: `${telemetry?.summary.momentsCount ?? 0} / ${friends.length}`,
                sub: "随想与站点连接",
              },
              {
                label: "共鸣 / 回响",
                value: `${telemetry?.summary.totalLikes ?? 0} / ${
                  telemetry?.summary.commentsCount ?? 0
                }`,
                sub: "读者互动总数",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl surface-block p-4 sm:p-5 flex flex-col justify-between gap-2"
              >
                <span className="text-[11px] ink-muted">{kpi.label}</span>
                <span className="font-mono-num text-2xl font-semibold tracking-tight ink-primary">
                  {kpi.value}
                </span>
                <span className="text-[11px] ink-secondary">{kpi.sub}</span>
              </div>
            ))}
          </div>

          {/* 14-Day Traffic Tonal Block Chart + Device Proportions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-2xl surface-block p-6 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold ink-primary">
                    近 14 日访问趋势（纯色块矩阵）
                  </h2>
                  <p className="text-xs ink-muted mt-0.5">
                    悬停任意日期柱块查看当日精确浏览量与独立访客
                  </p>
                </div>

                {activeDay && (
                  <div className="rounded-xl surface-canvas px-3.5 py-2 text-xs font-mono-num ink-primary">
                    <span>{activeDay.date}</span>
                    <span className="mx-2 ink-muted">·</span>
                    <span>PV {activeDay.views}</span>
                    <span className="mx-2 ink-muted">·</span>
                    <span>UV {activeDay.uniques}</span>
                  </div>
                )}
              </div>

              <div className="flex h-44 items-end gap-2 pt-4">
                {(telemetry?.dailySeries || []).map((d, idx) => {
                  const pct = Math.max(
                    10,
                    Math.round((d.views / maxDailyViews) * 100)
                  );
                  const active =
                    hoveredBarIdx === idx ||
                    (hoveredBarIdx === null &&
                      idx === (telemetry?.dailySeries.length || 1) - 1);
                  return (
                    <div
                      key={d.date}
                      onMouseEnter={() => setHoveredBarIdx(idx)}
                      onMouseLeave={() => setHoveredBarIdx(null)}
                      className="group flex h-full flex-1 flex-col items-center justify-end gap-2 cursor-pointer"
                    >
                      <div
                        className={`w-full rounded-lg transition-all duration-300 ${
                          active ? "surface-invert" : "surface-block-strong"
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                      <span className="font-mono-num text-[10px] ink-muted">
                        {d.label.slice(3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Device Breakdown & Quick Shortcuts */}
            <div className="rounded-2xl surface-block p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold ink-primary">
                  访问终端分布
                </h2>
                {["Desktop", "Mobile", "Tablet"].map((dev) => {
                  const count = telemetry?.deviceCounts[dev] || 0;
                  const ratio = Math.round((count / totalDeviceHits) * 100);
                  return (
                    <div key={dev} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="ink-secondary">{dev}</span>
                        <span className="font-mono-num ink-primary">
                          {ratio}% ({count})
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full surface-canvas overflow-hidden">
                        <div
                          className="h-full rounded-full surface-invert transition-all duration-500"
                          style={{ width: `${Math.max(ratio, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-[11px] uppercase tracking-widest ink-muted">
                  快捷创作
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("posts")}
                    className="surface-invert rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer"
                  >
                    + 撰写长文
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("moments")}
                    className="rounded-xl surface-canvas px-3 py-2.5 text-xs font-medium ink-primary cursor-pointer"
                  >
                    + 记录动态
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Top Articles & Live Telemetry Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl surface-block p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold ink-primary">
                  热门阅读排行
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab("posts")}
                  className="text-xs ink-muted hover:ink-primary cursor-pointer"
                >
                  管理全部 →
                </button>
              </div>
              <div className="space-y-2">
                {(telemetry?.topPosts || []).map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl surface-canvas px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md surface-block font-mono-num text-xs ink-primary">
                        {idx + 1}
                      </span>
                      <Link
                        href={`/posts/${p.slug}`}
                        className="truncate text-xs font-medium ink-primary hover:opacity-75"
                      >
                        {p.title}
                      </Link>
                    </div>
                    <div className="shrink-0 font-mono-num text-xs ink-muted">
                      {p.views} 读 · {p.likes} 赞
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl surface-block p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold ink-primary">
                  最近访客轨迹流
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[11px] ink-muted">
                  <span className="h-1.5 w-1.5 rounded-full surface-invert animate-pulse" />
                  实时记录中
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {(telemetry?.recentVisits || []).map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-xl surface-canvas px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded-md surface-block px-2 py-0.5 font-mono-num text-[10.5px] ink-secondary">
                        {v.device}
                      </span>
                      <span className="truncate font-mono-num ink-primary">
                        {v.path}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono-num text-[11px] ink-muted">
                      {new Date(v.createdAt).toISOString().slice(5, 16).replace("T", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ARTICLES CMS & SPLIT MARKDOWN STUDIO */}
      {activeTab === "posts" && (
        <ArticleEditorPanel
          posts={posts}
          onRefresh={loadAllData}
          notify={notify}
        />
      )}

      {/* TAB 3: MOMENTS / MICRO-THOUGHTS STUDIO */}
      {activeTab === "moments" && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveMoment}
            className="rounded-2xl surface-block p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold ink-primary">
                {momentDraft.id ? "编辑动态随想" : "发布新动态 / 骑行随记"}
              </h2>
              {momentDraft.id && (
                <button
                  type="button"
                  onClick={() =>
                    setMomentDraft({
                      id: null,
                      content: "",
                      tag: "日常",
                      location: "",
                      imageUrl: "",
                      publishedAt: "",
                    })
                  }
                  className="rounded-lg surface-canvas px-2.5 py-1 text-xs ink-muted cursor-pointer"
                >
                  取消编辑
                </button>
              )}
            </div>

            <textarea
              rows={3}
              required
              value={momentDraft.content}
              onChange={(e) =>
                setMomentDraft({ ...momentDraft, content: e.target.value })
              }
              placeholder="写下此刻的念头、摘抄或骑行路况..."
              className="w-full resize-y rounded-xl surface-canvas p-4 text-sm leading-relaxed ink-primary placeholder:opacity-50"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={momentDraft.tag}
                onChange={(e) =>
                  setMomentDraft({ ...momentDraft, tag: e.target.value })
                }
                placeholder="标签（如：日常 / 骑行 / 阅读）"
                className="rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
              />
              <input
                type="text"
                value={momentDraft.location}
                onChange={(e) =>
                  setMomentDraft({ ...momentDraft, location: e.target.value })
                }
                placeholder="地点或里程（选填，如：西湖西线 · 42km）"
                className="rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
              />
              <input
                type="text"
                value={momentDraft.imageUrl}
                onChange={(e) =>
                  setMomentDraft({ ...momentDraft, imageUrl: e.target.value })
                }
                placeholder="配图 URL（选填）"
                className="rounded-xl surface-canvas px-3.5 py-2.5 text-xs font-mono-num ink-primary"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="surface-invert inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-medium cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{momentDraft.id ? "保存动态修改" : "立即发布动态"}</span>
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {moments.map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-2xl surface-block p-5"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs ink-muted">
                    <span className="rounded-md surface-canvas px-2 py-0.5 font-medium ink-primary">
                      {m.tag}
                    </span>
                    {m.location && <span>{m.location}</span>}
                    <span>·</span>
                    <span className="font-mono-num">{m.publishedAt}</span>
                    <span>·</span>
                    <span className="font-mono-num">共鸣 {m.likes}</span>
                  </div>
                  <p className="text-sm leading-relaxed ink-primary whitespace-pre-line">
                    {m.content}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setMomentDraft({
                        id: m.id,
                        content: m.content,
                        tag: m.tag,
                        location: m.location || "",
                        imageUrl: m.imageUrl || "",
                        publishedAt: m.publishedAt,
                      })
                    }
                    className="rounded-lg surface-canvas px-3 py-1.5 text-xs ink-primary cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMoment(m.id)}
                    className="rounded-lg surface-canvas px-3 py-1.5 text-xs ink-muted hover:ink-primary cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FRIEND LINKS MANAGER */}
      {activeTab === "friends" && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveFriend}
            className="rounded-2xl surface-block p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold ink-primary">
                {friendDraft.id ? "编辑友链" : "新增友好链接"}
              </h2>
              {friendDraft.id && (
                <button
                  type="button"
                  onClick={() =>
                    setFriendDraft({
                      id: null,
                      name: "",
                      url: "",
                      description: "",
                      sortOrder: 0,
                    })
                  }
                  className="rounded-lg surface-canvas px-2.5 py-1 text-xs ink-muted cursor-pointer"
                >
                  取消编辑
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={friendDraft.name}
                onChange={(e) =>
                  setFriendDraft({ ...friendDraft, name: e.target.value })
                }
                placeholder="站点名称 *"
                className="rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
              />
              <input
                type="text"
                required
                value={friendDraft.url}
                onChange={(e) =>
                  setFriendDraft({ ...friendDraft, url: e.target.value })
                }
                placeholder="链接地址 *（如 https://example.com）"
                className="rounded-xl surface-canvas px-3.5 py-2.5 text-xs font-mono-num ink-primary"
              />
            </div>

            <input
              type="text"
              value={friendDraft.description}
              onChange={(e) =>
                setFriendDraft({ ...friendDraft, description: e.target.value })
              }
              placeholder="一句话描述（选填）"
              className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                className="surface-invert inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-medium cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{friendDraft.id ? "保存修改" : "添加友链"}</span>
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {friends.map((f) => (
              <div
                key={f.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl surface-block p-4 sm:px-5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium ink-primary">
                      {f.name}
                    </span>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] ink-muted hover:ink-primary"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="font-mono-num">{extractHost(f.url)}</span>
                    </a>
                  </div>
                  {f.description && (
                    <p className="truncate text-xs ink-secondary">
                      {f.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setFriendDraft({
                        id: f.id,
                        name: f.name,
                        url: f.url,
                        description: f.description,
                        sortOrder: f.sortOrder,
                      })
                    }
                    className="rounded-lg surface-canvas px-3 py-1.5 text-xs ink-primary cursor-pointer"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFriend(f.id)}
                    className="rounded-lg surface-canvas px-3 py-1.5 text-xs ink-muted hover:ink-primary cursor-pointer"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}

            {friends.length === 0 && (
              <div className="rounded-2xl surface-block p-8 text-center text-sm ink-muted">
                暂无友链记录，可在上方添加第一处友好链接。
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: COMMENTS MODERATION & AUTHOR REPLY */}
      {activeTab === "comments" && (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl surface-block p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold ink-primary">
                    {c.authorName}
                  </span>
                  {c.isAdmin && (
                    <span className="surface-invert rounded-md px-1.5 py-0.5 text-[10px]">
                      作者
                    </span>
                  )}
                  {!c.approved && (
                    <span className="rounded-md surface-canvas px-2 py-0.5 text-[10.5px] ink-muted">
                      已隐藏
                    </span>
                  )}
                  <Link
                    href={`/posts/${c.postSlug}`}
                    className="font-mono-num ink-muted hover:ink-primary"
                  >
                    文章: /{c.postSlug}
                  </Link>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setReplyTargetSlug(
                        replyTargetSlug === c.postSlug ? null : c.postSlug
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg surface-canvas px-2.5 py-1 text-xs ink-primary cursor-pointer"
                  >
                    <Reply className="h-3 w-3" />
                    回复
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCommentApproval(c)}
                    className="inline-flex items-center gap-1 rounded-lg surface-canvas px-2.5 py-1 text-xs ink-secondary cursor-pointer"
                  >
                    {c.approved ? (
                      <>
                        <EyeOff className="h-3 w-3" />
                        隐藏
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        显示
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(c.id)}
                    className="rounded-lg surface-canvas px-2.5 py-1 text-xs ink-muted hover:ink-primary cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-sm leading-relaxed ink-secondary">
                {c.content}
              </p>

              {replyTargetSlug === c.postSlug && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`以作者身份回复《${c.postSlug}》...`}
                    className="flex-1 rounded-xl surface-canvas px-3.5 py-2 text-xs ink-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdminReply(c.postSlug)}
                    className="surface-invert rounded-xl px-4 py-2 text-xs font-medium cursor-pointer"
                  >
                    发送回复
                  </button>
                </div>
              )}
            </div>
          ))}

          {comments.length === 0 && (
            <div className="rounded-2xl surface-block p-8 text-center text-sm ink-muted">
              暂无读者留言记录。
            </div>
          )}
        </div>
      )}

      {/* TAB 6: GLOBAL SITE CUSTOMIZATION ("具体内容我自己修改") */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSiteSettings} className="space-y-6">
          <div className="rounded-2xl surface-block p-6 space-y-4">
            <h2 className="text-sm font-semibold ink-primary">
              站点标识与首页双语导语
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] ink-muted mb-1 px-1">
                  左上角品牌站名（如 Air）
                </label>
                <input
                  type="text"
                  value={siteForm.siteName}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, siteName: e.target.value })
                  }
                  className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-sm font-medium ink-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] ink-muted mb-1 px-1">
                  浏览器标题副标语
                </label>
                <input
                  type="text"
                  value={siteForm.siteTagline}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, siteTagline: e.target.value })
                  }
                  className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-sm ink-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] ink-muted mb-1 px-1">
                首页中文导语（对应顶部主介绍段落）
              </label>
              <textarea
                rows={3}
                value={siteForm.introZh}
                onChange={(e) =>
                  setSiteForm({ ...siteForm, introZh: e.target.value })
                }
                className="w-full rounded-xl surface-canvas p-3.5 text-sm leading-relaxed ink-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] ink-muted mb-1 px-1">
                首页英文导语（切换右上角双语按钮时显示）
              </label>
              <textarea
                rows={3}
                value={siteForm.introEn}
                onChange={(e) =>
                  setSiteForm({ ...siteForm, introEn: e.target.value })
                }
                className="w-full rounded-xl surface-canvas p-3.5 text-sm leading-relaxed ink-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] ink-muted mb-1 px-1">
                当前近况状态 Now（展示在首页导语下方与关于页，留空则自动隐藏）
              </label>
              <input
                type="text"
                value={siteForm.nowStatus}
                onChange={(e) =>
                  setSiteForm({ ...siteForm, nowStatus: e.target.value })
                }
                className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-sm ink-primary"
              />
            </div>
          </div>

          {/* Author & About Page Markdown */}
          <div className="rounded-2xl surface-block p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold ink-primary">
                作者署名与「关于」页正文（支持完整 Markdown）
              </h2>
              <button
                type="button"
                onClick={() => setAboutPreview(!aboutPreview)}
                className="rounded-lg surface-canvas px-3 py-1 text-xs ink-primary cursor-pointer"
              >
                {aboutPreview ? "返回编辑 Markdown" : "预览渲染效果"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] ink-muted mb-1 px-1">
                  作者署名
                </label>
                <input
                  type="text"
                  value={siteForm.authorName}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, authorName: e.target.value })
                  }
                  className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] ink-muted mb-1 px-1">
                  身份简述
                </label>
                <input
                  type="text"
                  value={siteForm.authorRole}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, authorRole: e.target.value })
                  }
                  className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] ink-muted mb-1 px-1">
                  页脚尾注短句
                </label>
                <input
                  type="text"
                  value={siteForm.footerText}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, footerText: e.target.value })
                  }
                  className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
                />
              </div>
            </div>

            {aboutPreview ? (
              <div className="rounded-xl surface-canvas p-6">
                <MarkdownBody content={siteForm.aboutMarkdown} />
              </div>
            ) : (
              <textarea
                rows={12}
                value={siteForm.aboutMarkdown}
                onChange={(e) =>
                  setSiteForm({ ...siteForm, aboutMarkdown: e.target.value })
                }
                className="w-full rounded-xl surface-canvas p-4 font-mono-num text-xs leading-relaxed ink-primary"
              />
            )}
          </div>

          {/* Social Links + 3D Shader Mode + Security Passcode */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl surface-block p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold ink-primary">
                  社交与外部链接色块
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setSiteForm({
                      ...siteForm,
                      socialLinks: [
                        ...siteForm.socialLinks,
                        { label: "Link", url: "https://" },
                      ],
                    })
                  }
                  className="rounded-lg surface-canvas px-2.5 py-1 text-xs ink-primary cursor-pointer"
                >
                  + 添加链接
                </button>
              </div>

              <div className="space-y-2.5">
                {siteForm.socialLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const copy = [...siteForm.socialLinks];
                        copy[idx] = { ...copy[idx], label: e.target.value };
                        setSiteForm({ ...siteForm, socialLinks: copy });
                      }}
                      placeholder="名称"
                      className="w-28 rounded-xl surface-canvas px-3 py-2 text-xs ink-primary"
                    />
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => {
                        const copy = [...siteForm.socialLinks];
                        copy[idx] = { ...copy[idx], url: e.target.value };
                        setSiteForm({ ...siteForm, socialLinks: copy });
                      }}
                      placeholder="https://..."
                      className="flex-1 rounded-xl surface-canvas px-3 py-2 text-xs font-mono-num ink-primary"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSiteForm({
                          ...siteForm,
                          socialLinks: siteForm.socialLinks.filter(
                            (_, i) => i !== idx
                          ),
                        })
                      }
                      className="rounded-xl surface-canvas p-2 ink-muted hover:ink-primary cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl surface-block p-6 space-y-5">
              <div className="space-y-2.5">
                <h2 className="text-sm font-semibold ink-primary">
                  全站默认 Three.js 着色器模式
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "subtle", label: "克制微风" },
                      { id: "expressive", label: "深邃肌理" },
                      { id: "off", label: "纯静素纸" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setSiteForm({ ...siteForm, shaderMode: m.id })
                      }
                      className={`rounded-xl py-2.5 text-xs transition-all cursor-pointer ${
                        siteForm.shaderMode === m.id
                          ? "surface-invert font-medium"
                          : "surface-canvas ink-secondary"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] ink-muted mb-1.5 px-1">
                  修改后台解锁口令（留空则保持当前口令不变）
                </label>
                <input
                  type="password"
                  value={siteForm.adminPasscode}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, adminPasscode: e.target.value })
                  }
                  placeholder="输入新管理口令..."
                  className="w-full rounded-xl surface-canvas px-3.5 py-2.5 text-xs ink-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="surface-invert inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-xs font-medium cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>保存全部站点设置</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
