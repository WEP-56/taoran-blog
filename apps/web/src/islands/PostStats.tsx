import { useEffect, useState } from "react";
import { api, type PostMeta } from "../lib/api";

/** 文章头部的动态统计；挂载后页面停留 5s 上报一次浏览（docs/05-site-web.md §3） */
export function PostStats({ slug }: { slug: string }) {
  const [meta, setMeta] = useState<PostMeta | null>(null);

  useEffect(() => {
    api.meta(slug).then(setMeta).catch(() => setMeta(null));
    const timer = setTimeout(() => {
      if (document.visibilityState === "visible") {
        api.reportView(slug).then(({ counted }) => {
          if (counted) setMeta((m) => (m ? { ...m, views: m.views + 1 } : m));
        }).catch(() => {});
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [slug]);

  if (!meta) return null; // server 未启动时静默降级，不影响阅读
  return (
    <span className="post-stats">
      {meta.views} 次阅读 · {meta.likes} 次捏 · {meta.comments} 条评论
    </span>
  );
}
