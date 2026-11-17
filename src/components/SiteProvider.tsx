"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";

export type ThemeMode = "light" | "dark";
export type LangMode = "zh" | "en";
export type ShaderIntensity = "subtle" | "expressive" | "off";

interface SiteContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  lang: LangMode;
  toggleLang: () => void;
  shaderMode: ShaderIntensity;
  setShaderMode: (mode: ShaderIntensity) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  t: (zh: string, en: string) => string;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({
  children,
  initialShaderMode = "subtle",
}: {
  children: React.ReactNode;
  initialShaderMode?: ShaderIntensity;
}) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [lang, setLang] = useState<LangMode>("zh");
  const [shaderMode, setShaderMode] =
    useState<ShaderIntensity | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Storage is an external browser source; hydrate after the first paint.
    const frame = requestAnimationFrame(() => {
    const savedTheme = window.localStorage.getItem("air-theme") as ThemeMode | null;
    const savedLang = window.localStorage.getItem("air-lang") as LangMode | null;
    const savedShader = window.localStorage.getItem(
      "air-shader"
    ) as ShaderIntensity | null;

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }

    if (savedLang === "zh" || savedLang === "en") {
      setLang(savedLang);
    }

    if (
      savedShader === "subtle" ||
      savedShader === "expressive" ||
      savedShader === "off"
    ) {
      setShaderMode(savedShader);
    }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem("air-theme", next);
      return next;
    });
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "zh" ? "en" : "zh";
      window.localStorage.setItem("air-lang", next);
      return next;
    });
  }, []);

  const handleSetShaderMode = useCallback((mode: ShaderIntensity) => {
    setShaderMode(mode);
    window.localStorage.setItem("air-shader", mode);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Real-time telemetry beacon (skip /admin internal navigation noise)
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    let visitorId = window.localStorage.getItem("air-visitor-id");
    if (!visitorId) {
      visitorId = `v-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      window.localStorage.setItem("air-visitor-id", visitorId);
    }

    const postSlug = pathname.startsWith("/posts/")
      ? decodeURIComponent(pathname.replace("/posts/", "").split("/")[0] || "")
      : "";

    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        postSlug,
        visitorId,
        referrer: document.referrer
          ? new URL(document.referrer).hostname
          : "direct",
      }),
    }).catch(() => {});
  }, [pathname]);

  const t = useCallback(
    (zh: string, en: string) => (lang === "zh" ? zh : en),
    [lang]
  );

  return (
    <SiteContext.Provider
      value={{
        theme,
        toggleTheme,
        lang,
        toggleLang,
        shaderMode: shaderMode ?? initialShaderMode,
        setShaderMode: handleSetShaderMode,
        commandOpen,
        setCommandOpen,
        t,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error("useSite must be used inside SiteProvider");
  }
  return ctx;
}
