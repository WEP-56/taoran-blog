import type { Context, Next } from "hono";

/**
 * 进程内滑动窗口限流（个人站流量足够；多实例部署时换 Redis——见 docs/01-tech-stack.md 风险表）。
 * key 维度由调用方决定（ip / visitor）。
 */
const buckets = new Map<string, number[]>();

// 防止 Map 无限增长：每 10 分钟清理过期桶
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    if (hits.every((t) => now - t > 3_600_000)) buckets.delete(key);
  }
}, 600_000).unref();

export function rateLimit(opts: { name: string; max: number; windowMs: number; keyOf: (c: Context) => string }) {
  return async (c: Context, next: Next) => {
    const key = `${opts.name}:${opts.keyOf(c)}`;
    const now = Date.now();
    const hits = (buckets.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (hits.length >= opts.max) {
      return c.json({ error: { code: "rate_limited", message: "捏得太快了，歇一会儿。" } }, 429);
    }
    hits.push(now);
    buckets.set(key, hits);
    await next();
  };
}

export function clientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "0.0.0.0"
  );
}
