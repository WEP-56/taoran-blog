import { useEffect, useState } from "react";
import { api, type AdminComment } from "../lib/api";

const TABS = [
  { key: "pending", label: "待审" },
  { key: "ok", label: "已通过" },
  { key: "spam", label: "垃圾" },
  { key: "trash", label: "回收站" },
] as const;

export function Comments() {
  const [tab, setTab] = useState<string>("pending");
  const [rows, setRows] = useState<AdminComment[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = (state: string) =>
    api.comments(state).then((r) => {
      setRows(r.comments);
      setCounts(r.counts);
    }).catch((e) => setError(e.message));

  useEffect(() => void load(tab), [tab]);

  async function act(id: number, state: string) {
    await api.moderate(id, state);
    load(tab);
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <>
      <h1>评论审核</h1>
      <p className="filters">
        {TABS.map((t) => (
          <button key={t.key} className="clay-btn" data-variant={tab === t.key ? "primary" : "ghost"} onClick={() => setTab(t.key)}>
            {t.label} {counts[t.key] ? `(${counts[t.key]})` : ""}
          </button>
        ))}
      </p>

      {!rows && <p>加载中……</p>}
      {rows?.length === 0 && <p className="muted">这一栏是空的。</p>}

      <div className="comment-queue">
        {rows?.map((c) => (
          <div key={c.id} className="clay-card queue-item">
            <p className="queue-head">
              <b>{c.authorName}</b>
              {c.authorSite && <a href={c.authorSite} target="_blank" rel="noopener noreferrer nofollow"> 🔗</a>}
              <span className="muted"> 评于 「{c.postSlug}」 · {new Date(c.createdAt).toLocaleString("zh-CN")}</span>
              {c.parentId && <span className="muted">（回复 #{c.parentId}）</span>}
            </p>
            <p className="queue-body">{c.bodyMd}</p>
            <p className="queue-actions">
              {c.state !== "ok" && <button className="clay-btn" data-variant="primary" onClick={() => act(c.id, "ok")}>通过</button>}
              {c.state !== "pending" && <button className="clay-btn" data-variant="soft" onClick={() => act(c.id, "pending")}>待审</button>}
              {c.state !== "spam" && <button className="clay-btn" data-variant="ghost" onClick={() => act(c.id, "spam")}>垃圾</button>}
              {c.state !== "trash" && <button className="clay-btn danger-btn" data-variant="ghost" onClick={() => act(c.id, "trash")}>回收</button>}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
