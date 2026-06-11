import { useEffect, useState } from "react";
import { api, type RebuildStatus } from "../lib/api";

const STATE_LABEL: Record<RebuildStatus["state"], string> = {
  idle: "空闲",
  queued: "已排队（防抖 10s）",
  building: "构建中……",
  ok: "上次构建成功 ✓",
  fail: "上次构建失败 ✗",
};

export function Ops() {
  const [status, setStatus] = useState<RebuildStatus | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const poll = () => api.rebuildStatus().then(setStatus).catch(() => {});
    poll();
    timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <h1>运维</h1>
      <div className="clay-card side-card">
        <p>
          主站重建：<b>{status ? STATE_LABEL[status.state] : "……"}</b>
          {status?.finishedAt && <span className="muted">（{new Date(status.finishedAt).toLocaleTimeString("zh-CN")}）</span>}
        </p>
        <button className="clay-btn" data-variant="primary" onClick={() => api.rebuild()}>
          手动重建
        </button>
        <p className="muted">备份：服务器上由 deploy/backup.sh 每日打包 content/ + SQLite（docs/07-data.md §6）。</p>
      </div>

      {status && status.log.length > 0 && (
        <>
          <h2>构建日志</h2>
          <pre className="clay-card build-log">{status.log.join("\n")}</pre>
        </>
      )}
    </>
  );
}
