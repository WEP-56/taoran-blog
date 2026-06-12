/// <reference types="@webgpu/types" />

/**
 * 实验室「泥点雨」/lab/rain（docs/08-webgpu.md §3.4）。
 *
 * 裸 WebGPU compute shader 玩具：十万颗粘土泥点受指针引力场影响，手写 WGSL，**不走 Three**
 * （§2：为"手写过 WGSL"的炫技完整性保留的裸玩具）。T0 专属——岛屿在非 t0-webgpu 档不会
 * 加载本模块（capability.ts）。
 *
 * 管线：每帧 compute pass 更新粒子（指针引力 + 阻尼 + 环绕）→ render pass 把每颗粒子
 * 实例化成一个小四边形、片元里裁成圆形软边泥点。粒子位置存于 storage buffer，compute 可写、
 * render 只读。
 */

export interface ClayRainHandle {
  particleCount: number;
  wgsl: { compute: string; render: string };
  dispose: () => void;
}

const PARTICLE_COUNT = 100_000;
const WORKGROUP = 64;

const COMPUTE_WGSL = /* wgsl */ `
struct Particle { pos: vec2f, vel: vec2f };
// a = (pointerX, pointerY, dt, aspect)；b = (attract, count, time, _)
struct Uniforms { a: vec4f, b: vec4f };

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> U: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  let count = u32(U.b.y);
  if (i >= count) { return; }

  var p = particles[i];
  let ptr = U.a.xy;
  let dt = U.a.z;
  let attract = U.b.x;

  // 指针引力：方向 / 距离²（带软化项防奇点），即 ~ normalize(d)/dist
  let d = ptr - p.pos;
  let dist2 = dot(d, d) + 0.02;
  let force = d / dist2 * attract;

  p.vel = (p.vel + force * dt) * 0.985;   // 阻尼
  let sp = length(p.vel);                 // 限速防数值爆
  if (sp > 2.5) { p.vel = p.vel / sp * 2.5; }
  p.pos = p.pos + p.vel * dt;

  // 越界环绕 [-1, 1]
  if (p.pos.x >  1.0) { p.pos.x = p.pos.x - 2.0; }
  if (p.pos.x < -1.0) { p.pos.x = p.pos.x + 2.0; }
  if (p.pos.y >  1.0) { p.pos.y = p.pos.y - 2.0; }
  if (p.pos.y < -1.0) { p.pos.y = p.pos.y + 2.0; }

  particles[i] = p;
}
`.trim();

const RENDER_WGSL = /* wgsl */ `
struct Particle { pos: vec2f, vel: vec2f };
struct Uniforms { a: vec4f, b: vec4f };

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> U: Uniforms;

struct VSOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,    // 四边形局部坐标 [-1,1]，用于裁圆
  @location(1) tint: vec3f,
};

const SIZE: f32 = 0.0065;    // 泥点半径（clip 空间 x 向；y 向乘 aspect 保持圆）

fn corner(vi: u32) -> vec2f {
  var c = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
  );
  return c[vi];
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let p = particles[ii];
  let q = corner(vi);
  let aspect = U.a.w;
  let offset = vec2f(q.x * SIZE, q.y * SIZE * aspect);

  // 颜色随速度在 陶橘 → 胭脂 → 暖黄 间偏移，制造飞溅的"温度"
  let speed = clamp(length(p.vel) * 0.6, 0.0, 1.0);
  let clay = vec3f(0.878, 0.471, 0.337);   // #e07856
  let blush = vec3f(0.937, 0.643, 0.545);  // 胭脂暖
  let sun = vec3f(0.949, 0.788, 0.298);    // #f2c94c
  var col = mix(clay, blush, speed);
  col = mix(col, sun, clamp(speed * speed, 0.0, 1.0) * 0.6);

  var out: VSOut;
  out.clip = vec4f(p.pos + offset, 0.0, 1.0);
  out.uv = q;
  out.tint = col;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let r = length(in.uv);
  if (r > 1.0) { discard; }
  let alpha = smoothstep(1.0, 0.3, r);  // 圆形软边
  return vec4f(in.tint * alpha, alpha); // premultiplied alpha
}
`.trim();

export async function mountClayRain(container: HTMLElement): Promise<ClayRainHandle> {
  if (!navigator.gpu) throw new Error("WebGPU 不可用");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("没有可用的 WebGPU adapter");
  const device = await adapter.requestDevice();

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("无法取得 webgpu canvas context");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });

  /* ── 粒子缓冲：CPU 随机初始化后上传 ── */
  const init = new Float32Array(PARTICLE_COUNT * 4);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    init[i * 4 + 0] = Math.random() * 2 - 1; // pos.x ∈ [-1,1]
    init[i * 4 + 1] = Math.random() * 2 - 1; // pos.y
    init[i * 4 + 2] = (Math.random() * 2 - 1) * 0.05; // vel.x
    init[i * 4 + 3] = (Math.random() * 2 - 1) * 0.05; // vel.y
  }
  const particleBuffer = device.createBuffer({
    size: init.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(particleBuffer, 0, init);

  const uniformData = new Float32Array(8); // a:vec4 + b:vec4 = 32B
  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  /* ── 两条 pipeline（各自 auto 布局）── */
  const computeModule = device.createShaderModule({ code: COMPUTE_WGSL });
  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module: computeModule, entryPoint: "main" },
  });

  const renderModule = device.createShaderModule({ code: RENDER_WGSL });
  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: renderModule, entryPoint: "vs" },
    fragment: {
      module: renderModule,
      entryPoint: "fs",
      targets: [
        {
          format,
          blend: {
            // premultiplied-alpha 的标准 over 混合
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });

  const computeBind = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });
  const renderBind = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });

  /* ── 指针引力点（clip 空间 [-1,1]）── */
  let pointerX = 0;
  let pointerY = 0;
  let hasPointer = false;
  let aspect = 1;
  let time = 0;

  function onPointerMove(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    hasPointer = true;
  }
  function onPointerLeave(): void {
    hasPointer = false;
  }
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  /* ── 尺寸 ── */
  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = Math.max(1, Math.floor((container.clientWidth || 360) * dpr));
    canvas.height = Math.max(1, Math.floor((container.clientHeight || 360) * dpr));
    aspect = canvas.width / canvas.height;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* ── 帧循环 ── */
  let raf = 0;
  let running = false;
  let last = performance.now();

  function frame(): void {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    // 无指针时引力点缓慢游走，保持"活着"
    const tx = hasPointer ? pointerX : Math.cos(time * 0.6) * 0.55;
    const ty = hasPointer ? pointerY : Math.sin(time * 0.5) * 0.55;
    uniformData[0] = tx;
    uniformData[1] = ty;
    uniformData[2] = dt;
    uniformData[3] = aspect;
    uniformData[4] = 1.2; // attract
    uniformData[5] = PARTICLE_COUNT;
    uniformData[6] = time;
    uniformData[7] = 0;
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const encoder = device.createCommandEncoder();

    const cpass = encoder.beginComputePass();
    cpass.setPipeline(computePipeline);
    cpass.setBindGroup(0, computeBind);
    cpass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / WORKGROUP));
    cpass.end();

    const rpass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    rpass.setPipeline(renderPipeline);
    rpass.setBindGroup(0, renderBind);
    rpass.draw(6, PARTICLE_COUNT);
    rpass.end();

    device.queue.submit([encoder.finish()]);
    raf = requestAnimationFrame(frame);
  }

  function start(): void {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* ── 可见性：离开视口 / 切后台即暂停 ── */
  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible && !document.hidden) start();
    else stop();
  });
  io.observe(container);
  const onVis = (): void => {
    if (visible && !document.hidden) start();
    else stop();
  };
  document.addEventListener("visibilitychange", onVis);

  container.appendChild(canvas);
  resize();
  start();

  return {
    particleCount: PARTICLE_COUNT,
    wgsl: { compute: COMPUTE_WGSL, render: RENDER_WGSL },
    dispose() {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      particleBuffer.destroy();
      uniformBuffer.destroy();
      canvas.remove();
    },
  };
}
