import { useEffect, useRef, useState } from "react";
import type { ClayRainHandle } from "@taoran/clay-engine/rain";

/**
 * 泥点雨岛屿（docs/08-webgpu.md §3.4）：T0 专属。
 * 仅 tier === "t0-webgpu" 时加载裸 WebGPU 场景；其余档位 / 初始化失败 → 说明卡 + 录屏占位。
 * 附"查看着色器源码"折叠块（原生 <details>，零额外 JS）。
 */
export function ClayRain() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ClayRainHandle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported">("loading");
  const [wgsl, setWgsl] = useState<{ compute: string; render: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { detectClayTier } = await import("@taoran/clay-engine");
      const tier = await detectClayTier();
      if (tier !== "t0-webgpu") {
        setState("unsupported");
        return;
      }
      const { mountClayRain } = await import("@taoran/clay-engine/rain");
      if (cancelled || !hostRef.current) return;
      const handle = await mountClayRain(hostRef.current);
      if (cancelled) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      setWgsl(handle.wgsl);
      setState("ready");
      console.info(
        `%c🏺 陶然 clay-engine · 泥点雨 · WebGPU compute · ${handle.particleCount.toLocaleString()} 粒子`,
        "color:#e07856;font-weight:bold",
      );
    })().catch((err) => {
      console.warn("[clay-engine] 泥点雨初始化失败，回退说明卡：", err);
      setState("unsupported");
    });

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  if (state === "unsupported") {
    return (
      <div className="rain-fallback">
        <p className="rain-fallback-emoji" aria-hidden="true">🔥🏺</p>
        <h2>你的浏览器还烧不了这窑</h2>
        <p>
          泥点雨是个<strong>裸 WebGPU compute shader</strong> 玩具——十万颗泥点的运动每帧都在 GPU 上现算。
          它需要支持 WebGPU 的浏览器（较新的 Chrome / Edge，且硬件允许）。别的场景（粘土球、捏泥工坊）会自动
          降级到 WebGL，但这个纯炫技位只对 WebGPU 开放。
        </p>
        <div className="rain-video-slot" role="img" aria-label="泥点雨录屏占位">
          {/* TODO: T0 跑通后补录屏，放 apps/web/public/lab/rain.mp4 并用 <video> 替换此占位 */}
          <span>录屏待补 · 想看效果，换一个支持 WebGPU 的浏览器亲手玩最直接</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rain" data-state={state}>
      <div ref={hostRef} className="rain-canvas" aria-hidden="true" />
      <p className="rain-hint" role="status">
        {state === "ready" ? "移动鼠标，十万颗泥点会追着指针打转" : "正在生火烧窑……"}
      </p>
      {wgsl && (
        <details className="rain-source">
          <summary>查看着色器源码（手写 WGSL）</summary>
          <div className="rain-source-body">
            <p className="rain-source-label">compute · 每帧更新十万粒子</p>
            <pre>
              <code>{wgsl.compute}</code>
            </pre>
            <p className="rain-source-label">render · 实例化四边形 → 圆形泥点</p>
            <pre>
              <code>{wgsl.render}</code>
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
