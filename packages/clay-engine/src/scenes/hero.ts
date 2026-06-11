import * as THREE from "three/webgpu";
import { color, normalView, positionViewDirection } from "three/tsl";

/**
 * 首页 hero：会记仇的粘土球（docs/08-webgpu.md §3.1）。
 *
 * 实现取舍（与文档 §3.1 的差异已回写文档）：
 * - 渲染：Three WebGPURenderer——WebGPU 不可用时自动落 WebGL2，一套代码覆盖 T0/T1。
 * - 形变：CPU 端逐顶点形变场 + 交互帧重算法线（索引球面 ~1.2 万顶点，交互帧 ~2ms）。
 *   比 compute 纹理方案慢一点，但两档后端行为完全一致、无兼容雷区。
 * - TSL 用在材质上：菲涅尔边缘透光近似次表面散射（粘土的"暖边"）。
 */

export interface ClayHeroHandle {
  backend: "WebGPU" | "WebGL2";
  dispose: () => void;
}

const CLAY_COLOR = 0xe07856;
const RIM_COLOR = 0xffa078;
const MAX_DENT = 0.32;

export async function mountClayHero(container: HTMLElement): Promise<ClayHeroHandle> {
  /* ── 渲染器与场景 ── */
  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
  await renderer.init();
  const backend: "WebGPU" | "WebGL2" =
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2";
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, backend === "WebGPU" ? 2 : 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0.15, 3.4);

  scene.add(new THREE.AmbientLight(0xfff1e0, 0.7));
  const key = new THREE.DirectionalLight(0xfff3e2, 2.2);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9b8ff, 0.5);
  fill.position.set(-3, -1, 2);
  scene.add(fill);

  /* ── 粘土球 ── */
  const geometry = new THREE.SphereGeometry(1, 144, 104); // 索引网格：computeVertexNormals 平滑
  const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const count = posAttr.count;
  const baseDirs = new Float32Array(posAttr.array); // 单位球：位置即方向
  const dents = new Float32Array(count);

  const material = new THREE.MeshStandardNodeMaterial({
    color: CLAY_COLOR,
    roughness: 0.74,
    metalness: 0,
  });
  // TSL：边缘透光（次表面散射近似，docs/08-webgpu.md §3.1）
  const fresnel = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(2.5);
  material.emissiveNode = color(RIM_COLOR).mul(fresnel).mul(0.38);

  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);

  /* ── 形变场 ── */
  const tmp = new THREE.Vector3();
  let fieldDirty = true;
  let fieldActive = false; // 形变场是否非零（为零时跳过逐顶点循环）

  function stamp(dir: THREE.Vector3, radiusRad: number, depth: number): void {
    const cosR = Math.cos(radiusRad);
    for (let i = 0; i < count; i++) {
      const dot = dir.x * baseDirs[i * 3]! + dir.y * baseDirs[i * 3 + 1]! + dir.z * baseDirs[i * 3 + 2]!;
      if (dot <= cosR) continue;
      const t = (dot - cosR) / (1 - cosR); // 0..1
      const w = t * t * (3 - 2 * t); // smoothstep
      dents[i] = Math.max(-MAX_DENT, Math.min(0.2, dents[i]! + depth * w));
    }
    fieldDirty = true;
    fieldActive = true;
  }

  const hoverDir = new THREE.Vector3();
  let hovering = false;

  function applyField(): void {
    const cosHover = Math.cos(0.55);
    for (let i = 0; i < count; i++) {
      let d = dents[i]!;
      if (hovering) {
        const dot =
          hoverDir.x * baseDirs[i * 3]! + hoverDir.y * baseDirs[i * 3 + 1]! + hoverDir.z * baseDirs[i * 3 + 2]!;
        if (dot > cosHover) {
          const t = (dot - cosHover) / (1 - cosHover);
          d += 0.035 * t * t * (3 - 2 * t); // 朝指针轻微鼓起
        }
      }
      const r = 1 + d;
      posAttr.setXYZ(i, baseDirs[i * 3]! * r, baseDirs[i * 3 + 1]! * r, baseDirs[i * 3 + 2]! * r);
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    fieldDirty = false;
  }

  /* ── 指针交互 ── */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pressing = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velX = 0;
  let velY = 0;
  let squash = 0; // 0..1 按压挤扁量
  let wobbleV = 0;
  let wobble = 0;
  let lastInteract = performance.now();

  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  /** 求指针与球的交点方向（mesh 本地系） */
  function hitDir(e: PointerEvent): THREE.Vector3 | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(mesh, false)[0];
    if (!hit) return null;
    return tmp.copy(hit.point).applyMatrix4(mesh.matrixWorld.clone().invert()).normalize().clone();
  }

  function onPointerMove(e: PointerEvent): void {
    lastInteract = performance.now();
    const dir = hitDir(e);
    hovering = !!dir && !pressing;
    if (dir) hoverDir.copy(dir);
    fieldDirty = true;

    if (dragging) {
      velX = (e.clientX - lastX) * 0.006;
      velY = (e.clientY - lastY) * 0.006;
      group.rotation.y += velX;
      group.rotation.x += velY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    if (pressing && dir) stamp(dir, 0.32, -0.045); // 按住持续加深
  }

  function onPointerDown(e: PointerEvent): void {
    lastInteract = performance.now();
    canvas.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
    dragging = true; // 任意位置可拖；按在球上则同时凹陷（按住移动 = "搓泥"）
    const dir = hitDir(e);
    if (dir) {
      pressing = true;
      hovering = false;
      stamp(dir, 0.3, -0.06);
    }
    canvas.style.cursor = "grabbing";
  }

  function onPointerUp(): void {
    pressing = false;
    dragging = false;
    canvas.style.cursor = "grab";
  }

  function onDblClick(e: MouseEvent): void {
    const dir = hitDir(e as unknown as PointerEvent);
    if (!dir) return;
    stamp(dir, 0.42, -0.22); // 戳个洞
    wobbleV += 0.9; // 全身一颤
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", () => {
    hovering = false;
    fieldDirty = true;
  });
  canvas.addEventListener("dblclick", onDblClick);

  /* ── 帧循环 ── */
  const clock = new THREE.Clock();

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();

    // 闲置自愈：松手后缓慢回弹，闲置 10s 后加速（docs/08-webgpu.md §3.1）
    if (fieldActive && !pressing) {
      const heal = now - lastInteract > 10_000 ? 0.972 : 0.992;
      let maxAbs = 0;
      for (let i = 0; i < count; i++) {
        dents[i]! *= heal;
        const a = Math.abs(dents[i]!);
        if (a > maxAbs) maxAbs = a;
      }
      if (maxAbs < 0.0015) {
        dents.fill(0);
        fieldActive = false;
      }
      fieldDirty = true;
    }
    if (fieldDirty) applyField();

    // 惯性旋转 + 阻尼
    if (!dragging) {
      group.rotation.y += velX;
      group.rotation.x += velY;
      velX *= 0.95;
      velY *= 0.95;
      group.rotation.y += dt * 0.12; // idle 慢转
    }
    group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x));

    // 按压挤扁 + 戳洞抖动（弹簧）
    squash += ((pressing ? 1 : 0) - squash) * Math.min(1, dt * 12);
    wobbleV += -wobble * 90 * dt - wobbleV * 8 * dt;
    wobble += wobbleV * dt;
    const breathe = 1 + Math.sin(now * 0.0012) * 0.012;
    const sy = (1 - squash * 0.07 + wobble * 0.05) * breathe;
    const sxz = (1 + squash * 0.05 - wobble * 0.04) * breathe;
    group.scale.set(sxz, sy, sxz);

    renderer.render(scene, camera);
  }

  /* ── 可见性与尺寸 ── */
  function resize(): void {
    const w = container.clientWidth || 320;
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

  container.appendChild(canvas);
  resize();
  applyField();
  renderer.setAnimationLoop(frame);

  return {
    backend,
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
