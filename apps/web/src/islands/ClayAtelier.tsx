import { useEffect, useRef, useState } from "react";
import type { ClayAtelierHandle, ClayTool } from "@taoran/clay-engine/atelier";

/**
 * 捏泥工坊岛屿（docs/08-webgpu.md §3.2）：能力分级加载（同 ClayHero）。
 * T0/T1 → clay-engine/atelier；T2 / 加载失败 → 静态泥球 + 说明。
 * 工具栏渲染为 DOM，按钮调引擎 handle 的命令式方法；引擎保持 headless。
 */

const TOOLS: Array<{ id: ClayTool; label: string; hint: string }> = [
  { id: "push", label: "推", hint: "按住在球面拖动，把泥往里压" },
  { id: "pull", label: "拉", hint: "把泥往外鼓" },
  { id: "smooth", label: "抹平", hint: "抚平起伏" },
  { id: "poke", label: "戳洞", hint: "戳一个深坑" },
];
// 与 clay-engine/atelier 的 ATELIER_COLORS 对应（此处硬编码以免静态 import 触发 three 预载）
const SWATCHES = ["#e07856", "#9caf88", "#efa48b", "#c9603f"];
const BRUSHES = [
  { level: 0, label: "小" },
  { level: 1, label: "中" },
  { level: 2, label: "大" },
];

export function ClayAtelier() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ClayAtelierHandle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "static">("loading");
  const [tool, setTool] = useState<ClayTool>("push");
  const [colorIndex, setColorIndex] = useState(0);
  const [brush, setBrush] = useState(1);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { detectClayTier } = await import("@taoran/clay-engine");
      const tier = await detectClayTier();
      if (tier === "t2-static") {
        setState("static");
        return;
      }
      const { mountClayAtelier } = await import("@taoran/clay-engine/atelier");
      if (cancelled || !hostRef.current) return;
      const share = location.hash.slice(1) || undefined;
      const handle = await mountClayAtelier(hostRef.current, { share });
      if (cancelled) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      setState("ready");
      console.info(
        `%c🏺 陶然 clay-engine · 捏泥工坊 · ${handle.backend} 后端${handle.backend === "WebGL2" ? "（WebGPU 不可用，已自动降档）" : ""}`,
        "color:#e07856;font-weight:bold",
      );
    })().catch((err) => {
      console.warn("[clay-engine] 工坊初始化失败，回退静态展示：", err);
      setState("static");
    });

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  function flash(text: string): void {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2600);
  }

  function pickTool(t: ClayTool): void {
    setTool(t);
    handleRef.current?.setTool(t);
  }
  function pickColor(i: number): void {
    setColorIndex(i);
    handleRef.current?.setColor(i);
  }
  function pickBrush(level: number): void {
    setBrush(level);
    handleRef.current?.setBrush(level);
  }

  /** 导出：把 3D 画面叠粘土风边框 + "捏于陶然"水印后下载 */
  function exportPNG(): void {
    const handle = handleRef.current;
    if (!handle) return;
    const img = new Image();
    img.onload = () => {
      const pad = Math.round(img.width * 0.07);
      const footer = Math.round(img.width * 0.14);
      const c = document.createElement("canvas");
      c.width = img.width + pad * 2;
      c.height = img.height + pad + footer;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#f2e9db"; // --clay-bg（亮）
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, pad, pad);
      ctx.fillStyle = "#8a7263"; // --clay-ink-2
      ctx.textAlign = "center";
      ctx.font = `${Math.round(img.width * 0.055)}px "LXGW WenKai Screen", "Noto Sans SC", sans-serif`;
      ctx.fillText("捏于陶然", c.width / 2, img.height + pad + footer * 0.55);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = "捏于陶然.png";
      a.click();
    };
    img.onerror = () => flash("导出失败了，再试一次？");
    img.src = handle.snapshot();
  }

  /** 分享：写入 URL hash 并复制链接 */
  function share(): void {
    const handle = handleRef.current;
    if (!handle) return;
    location.hash = handle.getShareCode();
    const link = location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(
        () => flash("链接已复制，发给朋友吧"),
        () => flash("已写入地址栏，手动复制即可分享"),
      );
    } else {
      flash("已写入地址栏，手动复制即可分享");
    }
  }

  function reset(): void {
    handleRef.current?.reset();
    location.hash = "";
    flash("揉成一团，重新开始");
  }

  if (state === "static") {
    return (
      <div className="atelier">
        <div className="atelier-blob" aria-hidden="true" />
        <p className="atelier-static-note">
          当前设置下工坊以静态泥展示。若想动手捏，可在页脚「动效」开关里强制开启，或换用支持 WebGL 的浏览器。
        </p>
      </div>
    );
  }

  const busy = state !== "ready";
  return (
    <div className="atelier" data-state={state}>
      <div ref={hostRef} className="atelier-canvas" aria-hidden="true" />

      <div className="atelier-tools" data-busy={busy}>
        <div className="atelier-group" role="group" aria-label="工具">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="clay-btn"
              data-variant={tool === t.id ? "primary" : "soft"}
              aria-pressed={tool === t.id}
              title={t.hint}
              disabled={busy}
              onClick={() => pickTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="atelier-group" role="group" aria-label="泥色">
          {SWATCHES.map((hex, i) => (
            <button
              key={hex}
              type="button"
              className="atelier-swatch"
              style={{ background: hex }}
              aria-label={`泥色 ${i + 1}`}
              aria-pressed={colorIndex === i}
              data-active={colorIndex === i}
              disabled={busy}
              onClick={() => pickColor(i)}
            />
          ))}
        </div>

        <div className="atelier-group" role="group" aria-label="笔触大小">
          {BRUSHES.map((b) => (
            <button
              key={b.level}
              type="button"
              className="clay-btn"
              data-variant={brush === b.level ? "primary" : "soft"}
              aria-pressed={brush === b.level}
              disabled={busy}
              onClick={() => pickBrush(b.level)}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="atelier-group">
          <button
            type="button"
            className="clay-btn"
            data-variant="soft"
            title="按住让转盘转起来（拉坯机）"
            disabled={busy}
            onPointerDown={() => handleRef.current?.setSpin(true)}
            onPointerUp={() => handleRef.current?.setSpin(false)}
            onPointerLeave={() => handleRef.current?.setSpin(false)}
            onPointerCancel={() => handleRef.current?.setSpin(false)}
          >
            转盘
          </button>
          <button type="button" className="clay-btn" data-variant="soft" disabled={busy} onClick={reset}>
            重置
          </button>
          <button type="button" className="clay-btn" data-variant="soft" disabled={busy} onClick={exportPNG}>
            导出 PNG
          </button>
          <button type="button" className="clay-btn" data-variant="primary" disabled={busy} onClick={share}>
            分享
          </button>
        </div>
      </div>

      <p className="atelier-hint" role="status">
        {msg || (busy ? "正在生火烧窑……" : "在泥球上按住拖动来雕刻，空白处拖动转视角")}
      </p>
    </div>
  );
}
