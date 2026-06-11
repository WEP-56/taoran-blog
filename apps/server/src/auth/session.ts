import { randomBytes } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { eq, lt } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db } from "../db/client";
import { auditLog, sessions } from "../db/schema";
import { ipHash } from "../lib/hash";
import { clientIp } from "../lib/ratelimit";

/** 鉴权（docs/06-site-admin.md §2）：口令 Argon2id + 服务端 session + 滑动过期。Passkey 在 M4.5 接入。 */

const SESSION_COOKIE = "taoran_s";
const SESSION_TTL_MS = 7 * 24 * 3600_000;
const DEV_PASSWORD = "taoran-dev";

const passwordHash = process.env.ADMIN_PASSWORD_HASH;
if (!passwordHash) {
  console.warn(
    `[taoran-server] ⚠ 未设置 ADMIN_PASSWORD_HASH，启用开发口令 "${DEV_PASSWORD}"。` +
      `生产环境务必运行 scripts/hash-password.mjs 生成并配置。`,
  );
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (passwordHash) return verify(passwordHash, password).catch(() => false);
  if (process.env.NODE_ENV === "production") return false; // 生产环境无哈希=锁死
  return password === DEV_PASSWORD;
}

export function audit(action: string, detail: unknown, c?: Context): void {
  db.insert(auditLog)
    .values({ action, detail, ipHash: c ? ipHash(clientIp(c)) : null })
    .run();
}

export function createSession(c: Context): void {
  const id = randomBytes(32).toString("hex");
  db.insert(sessions).values({ id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) }).run();
  // 顺手清理过期会话
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
  setCookie(c, SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export function destroySession(c: Context): void {
  const id = getCookie(c, SESSION_COOKIE);
  if (id) db.delete(sessions).where(eq(sessions.id, id)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** /api/admin/* 守卫：会话有效性 + 滑动续期 + 写请求 CSRF 自定义头双保险 */
export async function requireAuth(c: Context, next: Next) {
  const id = getCookie(c, SESSION_COOKIE);
  const session = id
    ? db.select().from(sessions).where(eq(sessions.id, id)).get()
    : undefined;

  if (!session || session.expiresAt.valueOf() < Date.now()) {
    return c.json({ error: { code: "unauthorized", message: "请先登录" } }, 401);
  }
  if (c.req.method !== "GET" && c.req.header("x-requested-with") !== "taoran-admin") {
    return c.json({ error: { code: "csrf", message: "缺少防伪标头" } }, 403);
  }

  db.update(sessions)
    .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .where(eq(sessions.id, session.id))
    .run();
  await next();
}
