import { pool } from "@/db";
import { digest, isAdmin } from "./auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function databaseError(error: unknown): Response | null {
  const failure = error as { code?: string; cause?: { code?: string } };
  const code = failure?.code || failure?.cause?.code;
  if (code === "23505") return Response.json({ error: "该标识已被使用，请更换后重试" }, { status: 409 });
  if (["22P02", "22003", "23502"].includes(code || "")) return Response.json({ error: "字段格式无效" }, { status: 400 });
  return null;
}
export function safeUrl(value: string, mail = false) {
  if (!value) return true;
  if (/[\u0000-\u0020\\]/.test(value)) return false;
  return /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) || (mail && /^mailto:[^@]+@[^@]+$/.test(value));
}
export async function rateLimit(request: Request, scope: string, maximum: number, seconds: number) {
  // Only trust this header when the app is reachable exclusively through our proxy.
  const ip = process.env.TRUST_PROXY === "1" ? request.headers.get("x-real-ip") || "unknown" : "local";
  const key = digest(`${scope}:${ip}`);
  await pool.query("DELETE FROM rate_limits WHERE expires_at < now()");
  const result = await pool.query(`INSERT INTO rate_limits VALUES ($1, 1, now()+$2*interval '1 second')
    ON CONFLICT (key) DO UPDATE SET count=rate_limits.count+1 RETURNING count`, [key, seconds]);
  if (result.rows[0].count > maximum) throw new ApiError(429, "请求过于频繁，请稍后重试");
}
async function readBody(request: Request) {
  const reader = request.clone().body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 524288) { void reader.cancel(); throw new ApiError(413, "请求内容过大"); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new ApiError(400, "JSON 格式错误"); }
}
export function validateBody(body: Record<string, unknown>) {
  const bools = new Set(["pinned", "featured", "approved", "isAdmin"]);
  for (const [key, value] of Object.entries(body)) {
    if (key === "id" && (value === null || Number.isSafeInteger(value))) continue;
    if (bools.has(key)) { if (typeof value !== "boolean") throw new ApiError(400, `${key} 必须是布尔值`); continue; }
    if (key === "sortOrder") { if (!Number.isSafeInteger(value)) throw new ApiError(400, "排序值无效"); continue; }
    if (key === "tags") {
      if (!(typeof value === "string" && value.length < 1000) && !(Array.isArray(value) && value.length <= 30 && value.every(v => typeof v === "string" && v.length <= 80))) throw new ApiError(400, "标签格式错误");
      continue;
    }
    if (key === "socialLinks") {
      if (!Array.isArray(value) || value.length > 20 || !value.every(v => v && typeof v.label === "string" && v.label.length <= 100 && typeof v.url === "string" && v.url.length <= 2048 && safeUrl(v.url, true))) throw new ApiError(400, "社交链接无效");
      continue;
    }
    if (typeof value !== "string") throw new ApiError(400, `${key} 必须是字符串`);
    const max = ["content", "aboutMarkdown"].includes(key) ? 200000 : 4096;
    if (value.length > max) throw new ApiError(400, `${key} 过长`);
    if (["url", "authorUrl", "avatarUrl", "imageUrl", "coverImage"].includes(key) && !safeUrl(value)) throw new ApiError(400, "链接格式无效");
    if (["title", "name", "content"].includes(key) && !value.trim()) throw new ApiError(400, `${key} 不能为空`);
    if (["publishedAt", "takenAt"].includes(key) && value && (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?Z?)?)?$/.test(value) || Number.isNaN(Date.parse(value)))) throw new ApiError(400, "日期格式无效");
    if (key === "status" && !["draft", "published"].includes(value)) throw new ApiError(400, "文章状态无效");
    if (key === "shaderMode" && !["off", "subtle", "expressive"].includes(value)) throw new ApiError(400, "背景模式无效");
    if (key === "adminPasscode" && value && (value.length < 12 || value.length > 128)) throw new ApiError(400, "口令需为 12–128 位");
  }
}
// Every route handler invokes this boundary; authorization does not depend on middleware.
export function api<C>(handler: (request: Request, context: C) => Promise<Response>, options: { binary?: boolean; validate?: (body: Record<string, unknown>) => void } = {}) {
  return async (request: Request, context: C) => {
    try {
      const url = new URL(request.url), path = url.pathname;
      const writing = !["GET", "HEAD"].includes(request.method);
      let body: Record<string, unknown> = {};
      if (writing) {
        const origin = request.headers.get("origin");
        const expected = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : url.origin;
        if (origin && origin !== expected) throw new ApiError(403, "来源不受信任");
        if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "来源不受信任");
        if (request.method !== "DELETE" && !options.binary) {
          if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "需要 JSON 内容");
          body = await readBody(request); (options.validate ?? validateBody)(body);
        }
      }
      const publicLike = request.method === "PUT" && /^\/api\/(posts|moments)\/[^/]+$/.test(path) && body.action === "like" && Object.keys(body).length === 1;
      const publicWrite = request.method === "POST" && ["/api/comments", "/api/telemetry", "/api/auth"].includes(path);
      const privateRead = url.searchParams.get("all") === "1" || (path === "/api/telemetry" && !writing);
      if ((privateRead || (writing && !publicLike && !publicWrite && path !== "/api/auth")) && !await isAdmin()) throw new ApiError(401, "请先登录创作台");
      if (writing && (publicLike || publicWrite)) await rateLimit(request, path === "/api/auth" ? "login" : publicLike ? path : path, path === "/api/auth" ? 10 : path === "/api/comments" ? 10 : 60, 600);
      const result = await handler(request, context);
      result.headers.set("Cache-Control", "no-store");
      return result;
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.status === 429 ? { "Retry-After": "600" } : {}) } });
      console.error("API request failed", error);
      return Response.json({ error: "服务暂时不可用" }, { status: 503 });
    }
  };
}
