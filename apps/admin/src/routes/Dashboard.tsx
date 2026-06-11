import { useEffect, useState } from "react";
import { api, type Overview } from "../lib/api";

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.overview().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>统计加载中……</p>;

  const max = Math.max(1, ...data.trend.map((t) => t.n));

  return (
    <>
      <h1>仪表盘</h1>
      <div className="stat-grid">
        <div className="clay-card stat"><b>{data.pv.today}</b><span>今日 PV</span></div>
        <div className="clay-card stat"><b>{data.pv.week}</b><span>7 日 PV</span></div>
        <div className="clay-card stat"><b>{data.pv.month}</b><span>30 日 PV</span></div>
        <div className="clay-card stat"><b>{data.posts.published}</b><span>已发布 / {data.posts.draft} 草稿</span></div>
        <div className="clay-card stat"><b>{data.likes}</b><span>总捏数</span></div>
        <a className="clay-card stat alert" href="#/comments">
          <b>{data.pendingComments}</b><span>待审评论 →</span>
        </a>
      </div>

      <h2>30 日浏览趋势</h2>
      <div className="clay-card trend" role="img" aria-label="30 日浏览趋势柱状图">
        {data.trend.length === 0 && <p className="muted">还没有浏览数据。</p>}
        <div className="bars">
          {data.trend.map((t) => (
            <span key={t.date} title={`${t.date}: ${t.n}`} style={{ height: `${(t.n / max) * 100}%` }} />
          ))}
        </div>
      </div>

      <p>
        <a className="clay-btn" data-variant="primary" href="#/posts/new">＋ 新文章</a>
      </p>
    </>
  );
}
