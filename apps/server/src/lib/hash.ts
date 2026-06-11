import { createHash, randomUUID } from "node:crypto";

const secret = process.env.SESSION_SECRET ?? "dev-secret";

/** 隐私约定（docs/07-data.md §4）：不存明文 IP，盐每日轮换，哈希仅用于限流/去重 */
export function ipHash(ip: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${secret}|${day}`).digest("hex").slice(0, 32);
}

/** 邮箱哈希：持久（用于"既往通过"信任判定），不可反推 */
export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** 访客标识 = 匿名 cookie（uuid）+ ip 哈希，无指纹采集 */
export function visitorHash(cookieId: string, ip: string): string {
  return createHash("sha256").update(`${cookieId}|${ipHash(ip)}`).digest("hex").slice(0, 32);
}

export function newVisitorId(): string {
  return randomUUID();
}
