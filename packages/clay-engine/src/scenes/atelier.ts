import * as THREE from "three/webgpu";
import { color, normalView, positionViewDirection } from "three/tsl";

/**
 * 实验室「捏泥工坊」/lab/atelier（docs/08-webgpu.md §3.2）。
 *
 * 与首页 hero（scenes/hero.ts）共享同一套渲染/材质/生命周期骨架，差异在形变：
 * - hero 的凹痕会自愈、是「装饰」；这里形变**持久累积**，是「雕刻」。
 * - 工具：推(凹)/拉(凸)/抹平/戳洞 + 转盘旋转（拉坯机手感）。
 *
 * 关键数据结构：`SphereGeometry(1, W, H)` 的顶点本身就是一张经纬网格
 * （顶点序 idx = iy*(W+1)+ix，ix=经度、iy=纬度）。形变量 `dents` 按这张网格组织，
 * 让「抹平」（邻域松弛）与「分享短码」（降/升采样）都变成纯网格操作。
 *
 * 渲染走 Three WebGPURenderer，WebGPU 不可用时自动落 WebL2，一套代码覆盖 T0/T1。
 */

export type ClayTool = "push" | "pull" | "smooth" | "poke";

export interface ClayAtelierHandle {
  backend: "WebGPU" | "WebGL2";
  setTool: (tool: ClayTool) => void;
  setBrush: (level: number) => void; // 0=小 1=中 2=大
  setColor: (index: number) => void;
  setSpin: (active: boolean) => void; // 转盘踏板：按住加速
  reset: () => void;
  snapshot: () => string; // 当前画面 PNG dataURL（原始 3D canvas）
  getShareCode: () => string; // URL hash 分享短码（base64url）
  dispose: () => void;
}

/** 四款陶土色（与设计系统色板同源，docs/03 / tokens.css）：陶橘 / 青瓷 / 胭脂 / 深陶 */
export const ATELIER_COLORS = [0xe07856, 0x9caf88, 0xefa48b, 0xc9603f];
const RIM_COLOR = 0xffa078;

// 形变量钳制范围（凹为负、凸为正）；分享短码量化用同一区间，保证编解码对称
const DENT_MIN = -0.45;
const DENT_MAX = 0.3;
const BRUSH_RAD = [0.16, 0.27, 0.42]; // 小/中/大画笔角半径（弧度）

// 分享短码：把经纬网格降采样到这个分辨率（长度 vs 细节的折中，可调）
const SHARE_W = 32;
const SHARE_H = 16;

export async function mountClayAtelier(
  container: HTMLElement,
  opts: { share?: string } = {},
): Promise<ClayAtelierHandle> {
  /* ── 渲染器与场景（同 hero）── */
  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
  await renderer.init();
  const backend: "WebGPU" | "WebGL2" = (renderer.backend as { isWebGPUBackend?: boolean })
    .isWebGPUBackend
    ? "WebGPU"
    : "WebGL2";
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, backend === "WebGPU" ? 2 : 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0.15, 3.4);

  scene.add(new THREE.AmbientLight(0xfff1e0, 0.7));
  const keyLight = new THREE.DirectionalLight(0xfff3e2, 2.2);
  keyLight.position.set(2.5, 3, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xc9b8ff, 0.5);
  fillLight.position.set(-3, -1, 2);
  scene.add(fillLight);

  /* ── 泥球（雕刻分段比 hero 高；WebGL2 档降一档省算力）── */
  const W = backend === "WebGPU" ? 160 : 120;
  const H = backend === "WebGPU" ? 120 : 90;
  const W1 = W + 1;
  const geometry = new THREE.SphereGeometry(1, W, H);
  const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const count = posAttr.count;
  const baseDirs = new Float32Array(posAttr.array); // 单位球：位置即方向
  const dents = new Float32Array(count);
  const scratch = new Float32Array(count); // 抹平时的只读快照，避免边写边读偏置

  const material = new THREE.MeshStandardNodeMaterial({ color: ATELIER_COLORS[0]!, roughness: 0.74, metalness: 0 });
  // TSL：菲涅尔边缘透光（次表面散射近似，同 hero）
  const fresnel = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(2.5);
  material.emissiveNode = color(RIM_COLOR).mul(fresnel).mul(0.38);

  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);

  let colorIndex = 0;
  let tool: ClayTool = "push";
  let brushLevel = 1;
  let fieldDirty = true;

  /* ── 形变场 ──
   * 经纬网格的接缝（ix=0 与 ix=W 同一点）与极点（iy=0 / iy=H 各 W1 个重复顶点）
   * 必须保持同值，否则同一点的副本半径不同会撕裂。stamp 基于方向天然一致，
   * 抹平按网格邻域则需显式修复——统一在 applyField 里收口。 */
  function gridIdx(ix: number, iy: number): number {
    return iy * W1 + ix;
  }

  function sealPolesAndSeam(): void {
    // 极点：整行取均值
    for (const iy of [0, H]) {
      let sum = 0;
      for (let ix = 0; ix < W1; ix++) sum += dents[gridIdx(ix, iy)]!;
      const avg = sum / W1;
      for (let ix = 0; ix < W1; ix++) dents[gridIdx(ix, iy)] = avg;
    }
    // 接缝：末列对齐首列
    for (let iy = 0; iy <= H; iy++) dents[gridIdx(W, iy)] = dents[gridIdx(0, iy)]!;
  }

  function applyField(): void {
    sealPolesAndSeam();
    for (let i = 0; i < count; i++) {
      const r = 1 + dents[i]!;
      posAttr.setXYZ(i, baseDirs[i * 3]! * r, baseDirs[i * 3 + 1]! * r, baseDirs[i * 3 + 2]! * r);
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    fieldDirty = false;
  }

  /** 推/拉/戳洞：基于方向的角度核（同 hero.stamp），跨接缝/极点无忧 */
  function stamp(dir: THREE.Vector3, radiusRad: number, depth: number): void {
    const cosR = Math.cos(radiusRad);
    for (let i = 0; i < count; i++) {
      const dot = dir.x * baseDirs[i * 3]! + dir.y * baseDirs[i * 3 + 1]! + dir.z * baseDirs[i * 3 + 2]!;
      if (dot <= cosR) continue;
      const t = (dot - cosR) / (1 - cosR);
      const w = t * t * (3 - 2 * t); // smoothstep
      dents[i] = Math.max(DENT_MIN, Math.min(DENT_MAX, dents[i]! + depth * w));
    }
    fieldDirty = true;
  }

  /** 抹平：画笔范围内向网格邻域均值松弛（从 scratch 只读快照取邻居） */
  function smoothAt(dir: THREE.Vector3, radiusRad: number, strength: number): void {
    const cosR = Math.cos(radiusRad);
    scratch.set(dents);
    for (let iy = 0; iy <= H; iy++) {
      for (let ix = 0; ix < W; ix++) {
        // 跳过末列（接缝副本，统一由首列代表）
        const i = gridIdx(ix, iy);
        const dot =
          dir.x * baseDirs[i * 3]! + dir.y * baseDirs[i * 3 + 1]! + dir.z * baseDirs[i * 3 + 2]!;
        if (dot <= cosR) continue;
        const t = (dot - cosR) / (1 - cosR);
        const w = t * t * (3 - 2 * t);
        const left = scratch[gridIdx((ix - 1 + W) % W, iy)]!; // 经度环绕
        const right = scratch[gridIdx((ix + 1) % W, iy)]!;
        const up = scratch[gridIdx(ix, Math.max(0, iy - 1))]!;
        const down = scratch[gridIdx(ix, Math.min(H, iy + 1))]!;
        const avg = (left + right + up + down) / 4;
        dents[i] = dents[i]! + (avg - dents[i]!) * strength * w;
      }
    }
    fieldDirty = true;
  }

  /** 当前工具落到一次"描边" */
  function applyTool(dir: THREE.Vector3): void {
    const r = BRUSH_RAD[brushLevel]!;
    switch (tool) {
      case "push":
        stamp(dir, r, -0.05);
        break;
      case "pull":
        stamp(dir, r, 0.05);
        break;
      case "poke":
        stamp(dir, r * 0.5, -0.16);
        break;
      case "smooth":
        smoothAt(dir, r, 0.5);
        break;
    }
  }

  /* ── 指针交互 ── */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "crosshair";

  let sculpting = false; // 在球面上按住雕刻
  let orbiting = false; // 在球外按住转视角
  let lastX = 0;
  let lastY = 0;
  let velX = 0;
  let velY = 0;
  let spinUp = false; // 转盘踏板按住中
  let spinVel = 0;

  /** 指针与球的交点方向（mesh 本地系）；未命中返回 null */
  function hitDir(e: PointerEvent): THREE.Vector3 | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(mesh, false)[0];
    if (!hit) return null;
    return tmp.copy(hit.point).applyMatrix4(mesh.matrixWorld.clone().invert()).normalize().clone();
  }

  function onPointerDown(e: PointerEvent): void {
    canvas.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
    const dir = hitDir(e);
    if (dir) {
      sculpting = true;
      applyTool(dir);
    } else {
      orbiting = true; // 点空白处 = 转视角
      canvas.style.cursor = "grabbing";
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (sculpting) {
      const dir = hitDir(e);
      if (dir) applyTool(dir);
      else sculpting = false; // 划出球面则停笔
    } else if (orbiting) {
      velX = (e.clientX - lastX) * 0.006;
      velY = (e.clientY - lastY) * 0.006;
      group.rotation.y += velX;
      group.rotation.x += velY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }

  function onPointerUp(): void {
    sculpting = false;
    orbiting = false;
    canvas.style.cursor = "crosshair";
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  /* ── 帧循环 ── */
  const clock = new THREE.Clock();

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (fieldDirty) applyField();

    // 转盘：踏板按住时角速度爬升，松开带阻尼衰减（拉坯机手感）
    spinVel = spinUp ? Math.min(spinVel + dt * 3.5, 3.2) : spinVel * 0.96;
    group.rotation.y += spinVel * dt;

    // 拖拽惯性
    if (!orbiting) {
      group.rotation.y += velX;
      group.rotation.x += velY;
      velX *= 0.92;
      velY *= 0.92;
    }
    group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x));

    renderer.render(scene, camera);
  }

  /* ── 尺寸与可见性（同 hero）── */
  function resize(): void {
    const w = container.clientWidth || 360;
    const h = container.clientHeight || w;
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    renderer.setAnimationLoop(visible && !document.hidden ? frame : null);
  });
  io.observe(container);
  const onVis = () => renderer.setAnimationLoop(visible && !document.hidden ? frame : null);
  document.addEventListener("visibilitychange", onVis);

  /* ── 分享短码：经纬网格 → 32×16 量化 → RLE → base64url ── */
  function toB64url(bytes: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64url(code: string): Uint8Array {
    const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  /** 段长编码：连续相同字节折叠为 [run≤255, value] 对 */
  function rleEncode(data: Uint8Array): Uint8Array {
    const out: number[] = [];
    for (let i = 0; i < data.length; ) {
      const v = data[i]!;
      let run = 1;
      while (i + run < data.length && data[i + run] === v && run < 255) run++;
      out.push(run, v);
      i += run;
    }
    return new Uint8Array(out);
  }
  function rleDecode(data: Uint8Array, expected: number): Uint8Array {
    const out = new Uint8Array(expected);
    let o = 0;
    for (let i = 0; i + 1 < data.length && o < expected; i += 2) {
      const run = data[i]!;
      const val = data[i + 1]!;
      for (let k = 0; k < run && o < expected; k++) out[o++] = val;
    }
    return out;
  }

  function sampleGrid(grid: Float32Array, gw: number, gh: number, u: number, v: number): number {
    const fx = u * (gw - 1);
    const fy = v * (gh - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, gw - 1);
    const y1 = Math.min(y0 + 1, gh - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = grid[y0 * gw + x0]! * (1 - tx) + grid[y0 * gw + x1]! * tx;
    const b = grid[y1 * gw + x0]! * (1 - tx) + grid[y1 * gw + x1]! * tx;
    return a * (1 - ty) + b * ty;
  }

  function getShareCode(): string {
    const grid = new Uint8Array(SHARE_W * SHARE_H);
    for (let gy = 0; gy < SHARE_H; gy++) {
      for (let gx = 0; gx < SHARE_W; gx++) {
        const d = sampleGrid(dents, W1, H + 1, gx / (SHARE_W - 1), gy / (SHARE_H - 1));
        const q = Math.round(((Math.max(DENT_MIN, Math.min(DENT_MAX, d)) - DENT_MIN) / (DENT_MAX - DENT_MIN)) * 255);
        grid[gy * SHARE_W + gx] = q;
      }
    }
    // RLE 压缩：未捏区域量化值相同，成片段折叠，几百字符 → 几十字符。
    // 方案字节 1=稠密原始（兼容旧码 / RLE 反而更长时兜底），2=RLE。
    const rle = rleEncode(grid);
    const dense = rle.length >= grid.length;
    const payload = dense ? grid : rle;
    const bytes = new Uint8Array(2 + payload.length);
    bytes[0] = dense ? 1 : 2;
    bytes[1] = colorIndex;
    bytes.set(payload, 2);
    return toB64url(bytes);
  }

  function loadShareCode(code: string): void {
    const bytes = fromB64url(code);
    if (bytes.length < 3) throw new Error("bad share code");
    const scheme = bytes[0];
    colorIndex = Math.min(ATELIER_COLORS.length - 1, bytes[1]!);
    material.color.set(ATELIER_COLORS[colorIndex]!);
    const body = bytes.subarray(2);
    const cells = scheme === 2 ? rleDecode(body, SHARE_W * SHARE_H) : body.subarray(0, SHARE_W * SHARE_H);
    if (cells.length < SHARE_W * SHARE_H) throw new Error("bad share code");
    const grid = new Float32Array(SHARE_W * SHARE_H);
    for (let k = 0; k < SHARE_W * SHARE_H; k++) grid[k] = DENT_MIN + (cells[k]! / 255) * (DENT_MAX - DENT_MIN);
    for (let iy = 0; iy <= H; iy++) {
      for (let ix = 0; ix < W1; ix++) {
        dents[gridIdx(ix, iy)] = sampleGrid(grid, SHARE_W, SHARE_H, ix / W, iy / H);
      }
    }
    fieldDirty = true;
  }

  /* ── 初始化：可选载入分享码，首帧建场 ── */
  container.appendChild(canvas);
  resize();
  if (opts.share) {
    try {
      loadShareCode(opts.share);
    } catch (err) {
      console.warn("[clay-engine] 分享码解析失败，从空泥开始：", err);
    }
  }
  applyField();
  renderer.setAnimationLoop(frame);

  return {
    backend,
    setTool: (t) => {
      tool = t;
    },
    setBrush: (level) => {
      brushLevel = Math.max(0, Math.min(BRUSH_RAD.length - 1, level));
    },
    setColor: (index) => {
      colorIndex = Math.max(0, Math.min(ATELIER_COLORS.length - 1, index));
      material.color.set(ATELIER_COLORS[colorIndex]!);
    },
    setSpin: (active) => {
      spinUp = active;
    },
    reset: () => {
      dents.fill(0);
      fieldDirty = true;
    },
    snapshot: () => {
      renderer.render(scene, camera); // 同一 tick 渲染后回读，规避 WebGPU 合成后缓冲丢失
      return canvas.toDataURL("image/png");
    },
    getShareCode,
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
