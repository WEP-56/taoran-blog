import { useEffect, useState } from "react";

/**
 * 轻量 hash 路由（#/posts、#/posts/:slug 等）。
 * 务实取舍：文档规划的 TanStack Router 在当前页面量下收益有限，M5 后视复杂度再迁移。
 */
export function useHashRoute(): string {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "/dashboard");
  useEffect(() => {
    const onChange = () => setRoute(location.hash.slice(1) || "/dashboard");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string): void {
  location.hash = to;
}
