/**
 * 能力分级检测 · 规格见 docs/08-webgpu.md §2
 * T0 = WebGPU 全特效 / T1 = WebGL2 降档 / T2 = 静态图
 * 结果缓存于 sessionStorage，整个会话只测一次。
 */

export type ClayTier = "t0-webgpu" | "t1-webgl" | "t2-static";

const CACHE_KEY = "taoran:clay-tier";

export async function detectClayTier(): Promise<ClayTier> {
  const cached = sessionStorage.getItem(CACHE_KEY) as ClayTier | null;
  if (cached) return cached;

  const tier = await probe();
  sessionStorage.setItem(CACHE_KEY, tier);
  return tier;
}

async function probe(): Promise<ClayTier> {
  // 用户偏好与设备约束优先于一切能力（docs/04-motion.md §6）
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "t2-static";

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "t2-static";
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return "t2-static";

  if ("gpu" in navigator) {
    try {
      const adapter = await (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter();
      if (adapter) return "t0-webgpu";
    } catch {
      // 落入 WebGL 探测
    }
  }

  const canvas = document.createElement("canvas");
  if (canvas.getContext("webgl2")) return "t1-webgl";

  return "t2-static";
}
