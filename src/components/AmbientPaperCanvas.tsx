"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useSite } from "./SiteProvider";

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uMouseSpeed;
  uniform float uDark;
  uniform float uIntensity;
  uniform float uScroll;

  // 3D Simplex Noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float heightField(vec2 p) {
    float t = uTime * 0.075;
    vec2 scrolled = p + vec2(0.0, uScroll * 0.35);

    // Slow breathing silk waves
    float n1 = snoise(vec3(scrolled * 1.35, t));
    float n2 = snoise(vec3(scrolled * 2.85 - vec2(t * 0.4, t * 0.25), t * 1.3)) * 0.45;
    float n3 = snoise(vec3(scrolled * 5.8 + vec2(t * 0.15), t * 0.8)) * 0.16;

    // Subtle cursor fluid depression + concentric breath wave
    float dist = distance(p, uMouse);
    float wake = exp(-dist * dist * 10.5);
    float ripple = sin(dist * 26.0 - uTime * 2.4) * exp(-dist * 5.5) * (0.18 + uMouseSpeed * 0.55);

    return (n1 + n2 + n3) * 0.5 - wake * (0.42 + uMouseSpeed * 0.4) + ripple * 0.22;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
    vec2 m = vec2((uMouse.x - 0.5) * aspect, uMouse.y - 0.5);

    // Recompute height around pixel for grazing normal lighting
    float eps = 0.004;
    float t = uTime * 0.075;
    vec2 sp = p + vec2(0.0, uScroll * 0.35);

    float hCenter = snoise(vec3(sp * 1.35, t)) + 0.45 * snoise(vec3(sp * 2.85, t * 1.25));
    float dist = distance(p, m);
    float cursorBasin = -exp(-dist * dist * 11.0) * (0.48 + uMouseSpeed * 0.65);
    float cursorWave = sin(dist * 28.0 - uTime * 2.2) * exp(-dist * 4.8) * (0.12 + uMouseSpeed * 0.45);
    float h = hCenter * 0.55 + cursorBasin + cursorWave;

    vec2 spX = sp + vec2(eps, 0.0);
    vec2 spY = sp + vec2(0.0, eps);
    float distX = distance(p + vec2(eps, 0.0), m);
    float distY = distance(p + vec2(0.0, eps), m);

    float hX = (snoise(vec3(spX * 1.35, t)) + 0.45 * snoise(vec3(spX * 2.85, t * 1.25))) * 0.55
               - exp(-distX * distX * 11.0) * (0.48 + uMouseSpeed * 0.65)
               + sin(distX * 28.0 - uTime * 2.2) * exp(-distX * 4.8) * (0.12 + uMouseSpeed * 0.45);

    float hY = (snoise(vec3(spY * 1.35, t)) + 0.45 * snoise(vec3(spY * 2.85, t * 1.25))) * 0.55
               - exp(-distY * distY * 11.0) * (0.48 + uMouseSpeed * 0.65)
               + sin(distY * 28.0 - uTime * 2.2) * exp(-distY * 4.8) * (0.12 + uMouseSpeed * 0.45);

    vec3 normal = normalize(vec3(-(hX - h) / eps * 0.045, -(hY - h) / eps * 0.045, 1.0));
    vec3 lightDir = normalize(vec3(0.68, 0.52, 0.51));
    float diff = dot(normal, lightDir);
    float baseDiff = dot(vec3(0.0, 0.0, 1.0), lightDir);
    float deltaLight = (diff - baseDiff) * uIntensity;

    // Ultra-delicate topographic whisper bands near cursor or wave crests
    float iso = abs(fract(h * 4.5) - 0.5);
    float contour = smoothstep(0.035, 0.0, iso) * exp(-dist * 2.6) * 0.018 * uIntensity;

    // Fine archival cotton paper grain
    float grain = (hash12(gl_FragCoord.xy + fract(uTime * 0.01)) - 0.5) * 0.018;

    vec3 lightPaper = vec3(0.961, 0.961, 0.953); // #F5F5F3
    vec3 darkPaper  = vec3(0.043, 0.043, 0.047); // #0B0B0C
    vec3 baseColor = mix(lightPaper, darkPaper, uDark);

    float shadeOffset = deltaLight * (uDark > 0.5 ? 0.16 : 0.13) - contour * (uDark > 0.5 ? -1.0 : 1.0) + grain;
    vec3 finalColor = clamp(baseColor + vec3(shadeOffset), 0.0, 1.0);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export function AmbientPaperCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme, shaderMode } = useSite();

  const targetDarkRef = useRef(theme === "dark" ? 1 : 0);
  const targetIntensityRef = useRef(
    shaderMode === "off" ? 0 : shaderMode === "expressive" ? 2.1 : 1.0
  );

  useEffect(() => {
    targetDarkRef.current = theme === "dark" ? 1 : 0;
  }, [theme]);

  useEffect(() => {
    targetIntensityRef.current =
      shaderMode === "off" ? 0 : shaderMode === "expressive" ? 2.1 : 1.0;
  }, [shaderMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      uMouse: { value: new THREE.Vector2(0.65, 0.6) },
      uMouseSpeed: { value: 0 },
      uDark: { value: targetDarkRef.current },
      uIntensity: { value: targetIntensityRef.current },
      uScroll: { value: 0 },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const pointerTarget = { x: 0.65, y: 0.6 };
    const pointerCurrent = { x: 0.65, y: 0.6 };
    let scrollTarget = 0;
    let scrollCurrent = 0;

    const onPointerMove = (e: PointerEvent) => {
      pointerTarget.x = e.clientX / Math.max(window.innerWidth, 1);
      pointerTarget.y = 1.0 - e.clientY / Math.max(window.innerHeight, 1);
    };

    const onScroll = () => {
      scrollTarget = window.scrollY / Math.max(window.innerHeight, 1);
    };

    const onResize = () => {
      if (!renderer) return;
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    let rafId = 0;
    const startedAt = performance.now();

    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      if (document.hidden) return;
      const elapsed = (performance.now() - startedAt) / 1000;

      const dx = pointerTarget.x - pointerCurrent.x;
      const dy = pointerTarget.y - pointerCurrent.y;
      pointerCurrent.x += dx * 0.045;
      pointerCurrent.y += dy * 0.045;

      const speed = Math.min(Math.hypot(dx, dy) * 8.0, 1.2);
      uniforms.uMouseSpeed.value +=
        (speed - uniforms.uMouseSpeed.value) * 0.08;

      scrollCurrent += (scrollTarget - scrollCurrent) * 0.06;

      uniforms.uTime.value = elapsed;
      uniforms.uMouse.value.set(pointerCurrent.x, pointerCurrent.y);
      uniforms.uScroll.value = scrollCurrent;
      uniforms.uDark.value +=
        (targetDarkRef.current - uniforms.uDark.value) * 0.08;
      uniforms.uIntensity.value +=
        (targetIntensityRef.current - uniforms.uIntensity.value) * 0.08;

      renderer?.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    />
  );
}
