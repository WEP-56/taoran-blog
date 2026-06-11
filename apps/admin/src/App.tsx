import { useEffect, useState } from "react";

type Health = "checking" | "ok" | "down";

export function App() {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? setHealth("ok") : setHealth("down")))
      .catch(() => setHealth("down"));
  }, []);

  return (
    <main className="panel">
      <h1>陶然 · 后台</h1>
      <p>M0 骨架。登录、编辑器等模块在 M4 落地（docs/06-site-admin.md）。</p>
      <p>
        接口层状态：
        {health === "checking" && <span className="status">探测中…</span>}
        {health === "ok" && <span className="status ok">在线</span>}
        {health === "down" && <span className="status down">未启动</span>}
      </p>
    </main>
  );
}
