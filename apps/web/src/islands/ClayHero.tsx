import { useEffect, useRef, useState } from "react";

/**
 * 首页粘土球岛屿：能力分级加载（docs/08-webgpu.md §2）。
 * T0/T1 → clay-engine（three 代码块按需加载）；T2 / 加载失败 → CSS 呼吸 blob。
 */
export function ClayHero() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "static">("loading");

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;

    (async () => {
      const { detectClayTier } = await import("@taoran/clay-engine");
      const tier = await detectClayTier();
      if (tier === "t2-static") {
        setState("static");
        return;
      }
      const { mountClayHero } = await import("@taoran/clay-engine/hero");
      if (cancelled || !hostRef.current) return;
      const handle = await mountClayHero(hostRef.current);
      if (cancelled) {
        handle.dispose();
        return;
      }
      dispose = handle.dispose;
      setState("ready");
      // 炫技的一部分是让同行看到降级链（docs/08-webgpu.md §2）
      console.info(
        `%c🏺 陶然 clay-engine · ${handle.backend} 后端${handle.backend === "WebGL2" ? "（WebGPU 不可用，已自动降档）" : ""}`,
        "color:#e07856;font-weight:bold",
      );
    })().catch((err) => {
      console.warn("[clay-engine] 初始化失败，回退静态展示：", err);
      setState("static");
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div className="clay-hero">
      <div ref={hostRef} className="clay-hero-canvas" data-state={state} aria-hidden="true" />
      {state !== "ready" && <div className="clay-hero-blob" aria-hidden="true" />}
      <p className="clay-hero-hint">
        {state === "ready" ? "按住搓一搓，双击戳个洞——它会慢慢记仇地复原" : "一颗安静呼吸的泥球"}
      </p>
    </div>
  );
}
