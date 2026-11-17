"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { useSite } from "./SiteProvider";

export interface MonolithPostNode {
  slug: string;
  title: string;
  publishedAt: string;
  category?: string;
}

const INK_CORE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  // Compact trigonometric organic displacement
  float wave(vec3 p, float t) {
    float w1 = sin(p.x * 2.6 + t * 0.7) * cos(p.y * 2.3 - t * 0.55) * sin(p.z * 2.5 + t * 0.45);
    float w2 = sin(p.y * 4.8 - t * 1.1) * cos(p.z * 4.4 + t * 0.85) * 0.35;
    return (w1 + w2);
  }

  void main() {
    float amp = 0.11 + uHover * 0.085;
    float d = wave(position, uTime);
    vec3 displaced = position + normal * d * amp;

    // Approximate perturbed normal
    float e = 0.02;
    float dx = wave(position + vec3(e, 0.0, 0.0), uTime) - d;
    float dy = wave(position + vec3(0.0, e, 0.0), uTime) - d;
    float dz = wave(position + vec3(0.0, 0.0, e), uTime) - d;
    vec3 pertNormal = normalize(normal - vec3(dx, dy, dz) * (amp / e) * 0.32);

    vNormal = normalize(normalMatrix * pertNormal);
    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
    vViewPos = -mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const INK_CORE_FRAG = /* glsl */ `
  precision highp float;
  uniform float uDark;
  uniform float uHover;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  // 4x4 Bayer dithering matrix for lithographic halftone stipple look
  float bayer4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int idx = y * 4 + x;
    if (idx == 0) return 0.0 / 16.0;
    if (idx == 1) return 8.0 / 16.0;
    if (idx == 2) return 2.0 / 16.0;
    if (idx == 3) return 10.0 / 16.0;
    if (idx == 4) return 12.0 / 16.0;
    if (idx == 5) return 4.0 / 16.0;
    if (idx == 6) return 14.0 / 16.0;
    if (idx == 7) return 6.0 / 16.0;
    if (idx == 8) return 3.0 / 16.0;
    if (idx == 9) return 11.0 / 16.0;
    if (idx == 10) return 1.0 / 16.0;
    if (idx == 11) return 9.0 / 16.0;
    if (idx == 12) return 15.0 / 16.0;
    if (idx == 13) return 7.0 / 16.0;
    if (idx == 14) return 13.0 / 16.0;
    return 5.0 / 16.0;
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPos);
    vec3 L = normalize(vec3(0.75, 0.85, 0.65));

    float ndotl = dot(N, L) * 0.5 + 0.5;
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.4);

    // Ink density: darker in shadows and grazing rim
    float inkDensity = clamp((1.0 - ndotl) * 0.88 + fresnel * 0.48 + 0.08 + uHover * 0.08, 0.0, 1.0);

    float threshold = bayer4x4(gl_FragCoord.xy * 0.75);
    if (inkDensity < threshold * 0.92) {
      discard;
    }

    vec3 lightInk = vec3(0.08, 0.08, 0.08);
    vec3 darkInk  = vec3(0.91, 0.91, 0.89);
    vec3 inkColor = mix(lightInk, darkInk, uDark);

    gl_FragColor = vec4(inkColor, 0.92);
  }
`;

export function InkMonolith3D({
  posts,
  variant = "compact",
}: {
  posts: MonolithPostNode[];
  variant?: "compact" | "constellation";
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { theme, shaderMode, t } = useSite();
  const router = useRouter();

  const [hoveredPost, setHoveredPost] = useState<MonolithPostNode | null>(null);

  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const darkRef = useRef(theme === "dark" ? 1 : 0);
  useEffect(() => {
    darkRef.current = theme === "dark" ? 1 : 0;
  }, [theme]);

  useEffect(() => {
    if (shaderMode === "off") return;
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
    } catch {
      return;
    }

    const width = container.clientWidth || (variant === "compact" ? 168 : 640);
    const height = container.clientHeight || (variant === "compact" ? 168 : 400);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      36,
      width / Math.max(height, 1),
      0.1,
      100
    );
    camera.position.set(0, 0, variant === "compact" ? 4.35 : 5.4);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Core Halftone Morphing Monolith
    const coreGeo = new THREE.IcosahedronGeometry(
      variant === "compact" ? 0.96 : 0.88,
      5
    );
    const coreUniforms = {
      uTime: { value: 0 },
      uDark: { value: darkRef.current },
      uHover: { value: 0 },
    };
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: INK_CORE_VERT,
      fragmentShader: INK_CORE_FRAG,
      uniforms: coreUniforms,
      transparent: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    rootGroup.add(coreMesh);

    // Subtle dust cloud around core
    const dustCount = variant === "compact" ? 48 : 140;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r =
        (variant === "compact" ? 1.25 : 1.35) +
        Math.pow(Math.random(), 0.8) * (variant === "compact" ? 0.55 : 1.75);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dustPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPositions[i * 3 + 1] = r * Math.cos(phi) * 0.68;
      dustPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(dustPositions, 3)
    );
    const dustMat = new THREE.PointsMaterial({
      size: variant === "compact" ? 0.032 : 0.036,
      color: theme === "dark" ? 0x999994 : 0x555550,
      transparent: true,
      opacity: 0.48,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    rootGroup.add(dustPoints);

    // Article Satellite Nodes
    const satellitesGroup = new THREE.Group();
    rootGroup.add(satellitesGroup);

    const satGeo = new THREE.SphereGeometry(
      variant === "compact" ? 0.062 : 0.078,
      16,
      16
    );
    const satMeshes: THREE.Mesh[] = [];
    const activeNodes = postsRef.current.slice(
      0,
      variant === "compact" ? 8 : 24
    );

    activeNodes.forEach((post, idx) => {
      const mat = new THREE.MeshBasicMaterial({
        color: theme === "dark" ? 0xefefec : 0x161616,
      });
      const m = new THREE.Mesh(satGeo, mat);
      const total = Math.max(activeNodes.length, 1);
      const goldenAngle = idx * 2.3999632;
      const orbitRadius =
        variant === "compact"
          ? 1.32 + (idx % 3) * 0.14
          : 1.48 + (idx / total) * 1.35;
      const yOffset =
        variant === "compact"
          ? ((idx / total) - 0.5) * 1.1
          : Math.sin(idx * 1.3) * 0.92;

      m.position.set(
        Math.cos(goldenAngle) * orbitRadius,
        yOffset,
        Math.sin(goldenAngle) * orbitRadius
      );
      m.userData = {
        post,
        baseRadius: orbitRadius,
        angle: goldenAngle,
        yOffset,
        speed: 0.08 + (idx % 5) * 0.018,
      };
      satellitesGroup.add(m);
      satMeshes.push(m);
    });

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2(-10, -10);

    let isDragging = false;
    let dragMoved = false;
    let prevX = 0;
    let prevY = 0;
    let rotVelX = 0;
    let rotVelY = 0.0022;
    let hoverTarget = 0;
    let currentHoveredSlug: string | null = null;

    const updateNDC = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      pointerNDC.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      pointerNDC.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragMoved = false;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      updateNDC(e.clientX, e.clientY);
      hoverTarget = 1;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
        rotVelY = dx * 0.0065;
        rotVelX = dy * 0.0065;
        rootGroup.rotation.y += rotVelY;
        rootGroup.rotation.x = Math.max(
          -0.9,
          Math.min(0.9, rootGroup.rotation.x + rotVelX)
        );
        prevX = e.clientX;
        prevY = e.clientY;
      }
    };

    const onPointerUp = () => {
      if (isDragging && !dragMoved && currentHoveredSlug) {
        router.push(`/posts/${currentHoveredSlug}`);
      }
      isDragging = false;
    };

    const onPointerLeave = () => {
      isDragging = false;
      hoverTarget = 0;
      pointerNDC.set(-10, -10);
      currentHoveredSlug = null;
      setHoveredPost(null);
    };

    const onResize = () => {
      if (!renderer || !container) return;
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", onResize);

    let rafId = 0;
    const startedAt = performance.now();

    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      if (document.hidden) return;
      const tElapsed = (performance.now() - startedAt) / 1000;

      coreUniforms.uTime.value = tElapsed;
      coreUniforms.uDark.value +=
        (darkRef.current - coreUniforms.uDark.value) * 0.1;
      coreUniforms.uHover.value +=
        (hoverTarget - coreUniforms.uHover.value) * 0.07;

      const targetInkHex = darkRef.current > 0.5 ? 0xefefec : 0x161616;
      const mutedInkHex = darkRef.current > 0.5 ? 0x777772 : 0x6e6e69;
      dustMat.color.setHex(mutedInkHex);

      if (!isDragging) {
        // Gentle breathing rotation
        rotVelY += (0.0022 - rotVelY) * 0.03;
        rotVelX *= 0.94;
        rootGroup.rotation.y += rotVelY;
        rootGroup.rotation.x += rotVelX;
      }

      // Orbit satellites very calmly
      satMeshes.forEach((m) => {
        const { baseRadius, angle, yOffset, speed } = m.userData;
        const a = angle + tElapsed * speed * (hoverTarget > 0.5 ? 0.25 : 0.65);
        m.position.x = Math.cos(a) * baseRadius;
        m.position.z = Math.sin(a) * baseRadius;
        m.position.y = yOffset + Math.sin(tElapsed * 0.7 + angle) * 0.06;
      });

      // Raycast satellites when cursor is inside
      if (pointerNDC.x > -2) {
        raycaster.setFromCamera(pointerNDC, camera);
        const hits = raycaster.intersectObjects(satMeshes, false);
        if (hits.length > 0) {
          const hitMesh = hits[0].object as THREE.Mesh;
          const post = hitMesh.userData.post as MonolithPostNode;
          if (currentHoveredSlug !== post.slug) {
            currentHoveredSlug = post.slug;
            setHoveredPost(post);
          }
          satMeshes.forEach((m) => {
            const mat = m.material as THREE.MeshBasicMaterial;
            if (m === hitMesh) {
              m.scale.lerp(new THREE.Vector3(1.85, 1.85, 1.85), 0.2);
              mat.color.setHex(targetInkHex);
            } else {
              m.scale.lerp(new THREE.Vector3(0.85, 0.85, 0.85), 0.2);
              mat.color.setHex(mutedInkHex);
            }
          });
          container.style.cursor = "pointer";
        } else {
          if (currentHoveredSlug !== null) {
            currentHoveredSlug = null;
            setHoveredPost(null);
          }
          satMeshes.forEach((m) => {
            m.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15);
            (m.material as THREE.MeshBasicMaterial).color.setHex(targetInkHex);
          });
          container.style.cursor = isDragging ? "grabbing" : "grab";
        }
      }

      renderer?.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      coreGeo.dispose();
      coreMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      satGeo.dispose();
      satMeshes.forEach((m) => (m.material as THREE.Material).dispose());
      renderer?.dispose();
    };
  }, [variant, shaderMode, router, theme]);

  if (shaderMode === "off") {
    return null;
  }

  if (variant === "compact") {
    return (
      <div className="relative flex flex-col items-center select-none">
        <div
          ref={mountRef}
          className="h-36 w-36 cursor-grab transition-transform duration-500 active:cursor-grabbing sm:h-40 sm:w-40"
        />
        <div className="flex min-h-[26px] w-full items-start justify-center pt-1">
          {hoveredPost && (
            <button
              type="button"
              onClick={() => router.push(`/posts/${hoveredPost.slug}`)}
              className="surface-invert inline-block cursor-pointer rounded-md px-2.5 py-1 text-[11px] leading-tight transition-opacity hover:opacity-90"
            >
              <span className="font-mono-num opacity-70">
                {hoveredPost.publishedAt.slice(0, 4)}
              </span>
              <span className="mx-1.5 opacity-50">·</span>
              <span>{hoveredPost.title}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="surface-block relative w-full rounded-2xl p-5 sm:p-7 select-none overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <span className="text-xs font-medium tracking-widest uppercase ink-muted">
            {t("三维时间墨轨 · 实时着色器演算", "3D CHRONICLE ORBIT · GLSL")}
          </span>
        </div>
        <span className="surface-canvas rounded-full px-3 py-1 text-xs font-mono-num ink-secondary">
          {posts.length} {t("枚微粒", "nodes")}
        </span>
      </div>

      <div ref={mountRef} className="h-[320px] sm:h-[380px] w-full" />

      <div className="flex min-h-2 items-center justify-end pt-1">
        {hoveredPost && (
          <button
            type="button"
            onClick={() => router.push(`/posts/${hoveredPost.slug}`)}
            className="surface-invert flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-left text-xs transition-transform"
          >
            <span className="font-mono-num opacity-75">
              {hoveredPost.publishedAt}
            </span>
            <span className="font-medium">{hoveredPost.title}</span>
            <span className="opacity-70">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
