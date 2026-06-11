import { useRef, useState } from "react";
import { api } from "../lib/api";

/** 「捏一下」：按住持续压扁，松手弹回并喷泥点（docs/04-motion.md §3）；上限 9 次 */
export function LikeButton({ slug }: { slug: string }) {
  const [likes, setLikes] = useState<number | null>(null);
  const [maxed, setMaxed] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [burst, setBurst] = useState(0);
  const busy = useRef(false);

  async function squeeze() {
    setPressing(false);
    if (busy.current || maxed) return;
    busy.current = true;
    try {
      const r = await api.like(slug);
      setLikes(r.likes);
      setMaxed(r.maxed);
      setBurst((b) => b + 1); // 重新触发粒子动画
    } catch {
      // 限流或离线：静默
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="like-wrap">
      <button
        type="button"
        className="clay-btn like-btn"
        data-variant="primary"
        data-pressing={pressing}
        disabled={maxed}
        onPointerDown={() => setPressing(true)}
        onPointerLeave={() => setPressing(false)}
        onPointerUp={squeeze}
        onKeyDown={(e) => e.key === "Enter" && squeeze()}
        aria-label="给这篇文章捏一下（点赞）"
      >
        🤏 {maxed ? "捏扁了" : "捏一下"}
        {likes !== null && <span className="like-count">{likes}</span>}
      </button>
      {burst > 0 && (
        <span key={burst} className="mud-burst" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
      )}
    </div>
  );
}
