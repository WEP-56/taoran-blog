import { useEffect, useRef, useState } from "react";

/**
 * 404 碎陶罐（docs/08-webgpu.md §3.3 的 2D 轻量版）：
 * 进入页面陶罐碎片从顶部落下弹跳；可拖拽抛掷；全部拖回轮廓附近则磁吸拼回 → 彩蛋。
 * 务实取舍：自写 ~50 行 2D 物理替代 Rapier+3D（v2 进 Backlog），prefers-reduced-motion 时静态摆放。
 */

interface Shard {
  /** 拼回目标位（相对容器中心，px） */
  tx: number;
  ty: number;
  trot: number;
  w: number;
  h: number;
  radius: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  snapped: boolean;
}

const DEFS: Array<Pick<Shard, "tx" | "ty" | "trot" | "w" | "h" | "radius">> = [
  { tx: -52, ty: 10, trot: -10, w: 70, h: 58, radius: "45% 55% 60% 40% / 50% 45% 55% 50%" },
  { tx: 0, ty: -26, trot: 4, w: 90, h: 66, radius: "55% 45% 40% 60% / 45% 55% 45% 55%" },
  { tx: 50, ty: 16, trot: 12, w: 62, h: 50, radius: "50% 50% 65% 35% / 55% 45% 55% 45%" },
];

const GRAVITY = 1400;
const SNAP_DIST = 46;

export function BrokenPot() {
  const hostRef = useRef<HTMLDivElement>(null);
  const shardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [restored, setRestored] = useState(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = () => host.getBoundingClientRect();

    const shards: Shard[] = DEFS.map((d, i) => ({
      ...d,
      x: d.tx + (i - 1) * 30,
      y: reduced ? d.ty : -rect().height / 2 - 120 - i * 90, // 从顶上错峰掉落
      vx: (i - 1) * 60,
      vy: 0,
      rot: d.trot + (i - 1) * 50,
      vrot: (i - 1) * 120,
      snapped: reduced,
    }));
    if (reduced) restoredRef.current = true;
    if (reduced) setRestored(true);

    let dragging = -1;
    let grabDx = 0;
    let grabDy = 0;
    let lastPX = 0;
    let lastPY = 0;
    let pvx = 0;
    let pvy = 0;
    let raf = 0;
    let last = performance.now();

    function toLocal(e: PointerEvent): [number, number] {
      const r = rect();
      return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2];
    }

    function paint(): void {
      for (let i = 0; i < shards.length; i++) {
        const s = shards[i]!;
        const el = shardRefs.current[i];
        if (el) el.style.transform = `translate(${s.x - s.w / 2}px, ${s.y - s.h / 2}px) rotate(${s.rot}deg)`;
      }
    }

    function step(now: number): void {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      const r = rect();
      const floor = r.height / 2 - 36;
      const wall = r.width / 2 - 30;

      let allSnapped = true;
      for (let i = 0; i < shards.length; i++) {
        const s = shards[i]!;
        if (s.snapped) continue;
        allSnapped = false;
        if (i === dragging) continue;

        s.vy += GRAVITY * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.vrot * dt;

        if (s.y > floor) {
          s.y = floor;
          s.vy *= -0.42; // 摔在地上弹一下
          s.vx *= 0.8;
          s.vrot *= 0.7;
          if (Math.abs(s.vy) < 40) s.vy = 0;
        }
        if (Math.abs(s.x) > wall) {
          s.x = Math.sign(s.x) * wall;
          s.vx *= -0.5;
        }
      }

      if (allSnapped && !restoredRef.current) {
        restoredRef.current = true;
        setRestored(true);
      }
      paint();
      raf = requestAnimationFrame(step);
    }

    function onDown(e: PointerEvent): void {
      const [px, py] = toLocal(e);
      // 从最上层（数组尾部优先）找命中的碎片
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i]!;
        if (Math.abs(px - s.x) < s.w / 2 + 8 && Math.abs(py - s.y) < s.h / 2 + 8) {
          dragging = i;
          s.snapped = false;
          grabDx = s.x - px;
          grabDy = s.y - py;
          lastPX = px;
          lastPY = py;
          host!.setPointerCapture(e.pointerId);
          break;
        }
      }
    }

    function onMove(e: PointerEvent): void {
      if (dragging < 0) return;
      const [px, py] = toLocal(e);
      const s = shards[dragging]!;
      pvx = (px - lastPX) * 60;
      pvy = (py - lastPY) * 60;
      lastPX = px;
      lastPY = py;
      s.x = px + grabDx;
      s.y = py + grabDy;
      s.vx = 0;
      s.vy = 0;
      s.vrot = 0;
    }

    function onUp(): void {
      if (dragging < 0) return;
      const s = shards[dragging]!;
      const near = Math.hypot(s.x - s.tx, s.y - s.ty) < SNAP_DIST;
      if (near) {
        // 磁吸归位
        s.x = s.tx;
        s.y = s.ty;
        s.rot = s.trot;
        s.vx = s.vy = s.vrot = 0;
        s.snapped = true;
      } else {
        // 抛掷
        s.vx = pvx;
        s.vy = pvy;
        s.vrot = pvx * 0.6;
      }
      dragging = -1;
    }

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    paint();
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="pot-scene" data-restored={restored}>
      <div ref={hostRef} className="pot-stage">
        {/* 拼回目标轮廓 */}
        <div className="pot-ghost" aria-hidden="true" />
        {DEFS.map((d, i) => (
          <div
            key={i}
            ref={(el) => {
              shardRefs.current[i] = el;
            }}
            className="pot-shard"
            style={{ width: d.w, height: d.h, borderRadius: d.radius }}
            aria-hidden="true"
          />
        ))}
        {restored && <div className="pot-whole" aria-hidden="true">🏺</div>}
      </div>
      <p className="pot-caption" role="status">
        {restored ? "修补完成！这罐就送你了，去首页看看？" : "陶罐摔碎了……把三块碎片拖回中间虚线里试试"}
      </p>
    </div>
  );
}
