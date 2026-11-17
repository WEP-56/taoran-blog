import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "@/db";

export const sessionCookie = "studio-session";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(value, salt, 64).toString("hex")}`;
}
export function verifyPassword(value: string, hash: string) {
  const [algorithm, salt, key] = hash.split("$");
  if (algorithm !== "scrypt" || !salt || !key || !/^[a-f0-9]{128}$/.test(key)) return false;
  return timingSafeEqual(scryptSync(value, salt, 64), Buffer.from(key, "hex"));
}
export async function isAdmin() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const result = await pool.query("SELECT 1 FROM admin_sessions WHERE token_hash=$1 AND expires_at>now()", [digest(token)]);
  return Boolean(result.rowCount);
}
export async function createSession() {
  const token = randomBytes(32).toString("hex");
  await pool.query("DELETE FROM admin_sessions WHERE expires_at <= now()");
  await pool.query("INSERT INTO admin_sessions VALUES ($1, now()+interval '8 hours')", [digest(token)]);
  (await cookies()).set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 28800 });
}
export async function logout() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (token) await pool.query("DELETE FROM admin_sessions WHERE token_hash=$1", [digest(token)]);
  (await cookies()).delete(sessionCookie);
}
