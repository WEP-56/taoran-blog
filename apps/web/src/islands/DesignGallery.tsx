import { useState } from "react";
import {
  ClayAvatar,
  ClayButton,
  ClayCard,
  ClayDivider,
  ClayInput,
  ClayProgress,
  ClaySkeleton,
  ClayTag,
  ClayTextarea,
  ClayToggle,
} from "@taoran/ui";

/** 组件预览页（M1 验收基线，docs/09-roadmap.md）。每个区块对应 docs/03-design-system.md §5 的一行规格。 */
export function DesignGallery() {
  const [progress, setProgress] = useState(62);
  const [likes, setLikes] = useState(0);

  return (
    <div className="gallery">
      <section>
        <h2>ClayButton</h2>
        <ClayButton variant="primary" onClick={() => setLikes((n) => n + 1)}>
          捏一下 {likes > 0 && `× ${likes}`}
        </ClayButton>
        <ClayButton
          onClick={() => {
            const root = document.documentElement;
            const next = root.dataset.theme === "dark" ? "light" : "dark";
            root.dataset.theme = next;
            localStorage.setItem("taoran:theme", next);
          }}
        >
          窑变（切换主题）
        </ClayButton>
        <ClayButton variant="ghost">幽灵按钮</ClayButton>
        <ClayButton variant="primary" disabled>
          禁用态
        </ClayButton>
      </section>

      <section>
        <h2>ClayCard</h2>
        <div className="row">
          <ClayCard hoverable>
            <strong>可悬停卡片</strong>
            <p>hover 抬升 + 1° 微倾（仅指针设备）。</p>
          </ClayCard>
          <ClayCard>
            <strong>静态卡片</strong>
            <p>用于不可点击的内容容器。</p>
          </ClayCard>
        </div>
      </section>

      <section>
        <h2>ClayTag</h2>
        {["设计", "webgpu", "astro", "随笔", "陶艺", "性能"].map((t) => (
          <ClayTag key={t} style={{ marginRight: "0.5em" }}>
            {t}
          </ClayTag>
        ))}
        <p className="hint">色相由标签名哈希决定，同名永远同色。</p>
      </section>

      <section>
        <h2>ClayInput / ClayTextarea</h2>
        <ClayInput placeholder="在泥上写点什么……" style={{ marginBottom: "1rem" }} />
        <ClayTextarea placeholder="多行的泥槽……" />
      </section>

      <section>
        <h2>ClayToggle</h2>
        <ClayToggle label="演示开关" defaultChecked />
        <p className="hint">按住试试——泥球会被压扁。</p>
      </section>

      <section>
        <h2>ClayAvatar</h2>
        <ClayAvatar src="/favicon.svg" alt="陶然头像" size={80} />
      </section>

      <section>
        <h2>ClayDivider</h2>
        <ClayDivider />
      </section>

      <section>
        <h2>ClayProgress</h2>
        <ClayProgress value={progress} label="演示进度" />
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          aria-label="调整进度"
          style={{ width: "100%", marginTop: "1rem" }}
        />
      </section>

      <section>
        <h2>ClaySkeleton</h2>
        <div className="row">
          <ClaySkeleton style={{ width: 180, height: 20 }} />
          <ClaySkeleton shape="blob" style={{ width: 72, height: 72 }} />
        </div>
      </section>
    </div>
  );
}
