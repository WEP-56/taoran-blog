import { useEffect, useState } from "react";
import { api, type PostListItem } from "../lib/api";

export function PostsList() {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [error, setError] = useState("");

  const load = () => api.posts().then((r) => setPosts(r.posts)).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  async function trash(slug: string, title: string) {
    if (!confirm(`把「${title}」移入回收站？（content/.trash 可手动找回）`)) return;
    await api.trashPost(slug);
    load();
  }

  if (error) return <p className="error">{error}</p>;
  if (!posts) return <p>加载中……</p>;

  const shown = posts.filter((p) => filter === "all" || p.status === filter);

  return (
    <>
      <div className="page-head">
        <h1>文章</h1>
        <a className="clay-btn" data-variant="primary" href="#/posts/new">＋ 新文章</a>
      </div>

      <p className="filters">
        {(["all", "published", "draft"] as const).map((f) => (
          <button key={f} className="clay-btn" data-variant={filter === f ? "primary" : "ghost"} onClick={() => setFilter(f)}>
            {f === "all" ? "全部" : f === "published" ? "已发布" : "草稿"}
          </button>
        ))}
      </p>

      <table className="clay-card data-table">
        <thead>
          <tr><th>标题</th><th>状态</th><th>日期</th><th>PV</th><th>捏</th><th>评</th><th></th></tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.slug}>
              <td>
                <a href={`#/posts/edit/${p.slug}`}>{p.pinned && "📌 "}{p.title}</a>
                <div className="muted">{p.tags.map((t) => `#${t}`).join(" ")}</div>
              </td>
              <td><span className={`badge badge-${p.status}`}>{p.status === "published" ? "已发布" : p.status === "draft" ? "草稿" : "定时"}</span></td>
              <td className="muted">{new Date(p.date).toLocaleDateString("zh-CN")}</td>
              <td>{p.views}</td>
              <td>{p.likes}</td>
              <td>{p.comments}</td>
              <td>
                <button className="clay-btn danger-btn" data-variant="ghost" onClick={() => trash(p.slug, p.title)}>删</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p className="muted">这个筛选下没有文章。</p>}
    </>
  );
}
