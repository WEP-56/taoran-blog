import { pool } from "@/db";
import { api } from "@/lib/api";
import { createSession, isAdmin, logout, verifyPassword, hashPassword } from "@/lib/auth";

export const GET = api(async () => Response.json({ valid: await isAdmin() }));
export const DELETE = api(async () => { await logout(); return Response.json({ ok: true }); });
export const POST = api(async (request: Request) => {
  const { passcode } = await request.json();
  if (typeof passcode !== "string" || passcode.length > 128) return Response.json({ valid: false }, { status: 400 });
  const { rows } = await pool.query("SELECT admin_passcode FROM site_settings WHERE id=1");
  const stored = rows[0]?.admin_passcode || "";
  const initial = process.env.ADMIN_PASSWORD;
  let valid = false;
  if (stored.startsWith("scrypt$")) valid = verifyPassword(passcode, stored);
  else if (initial && initial.length >= 12) valid = verifyPassword(passcode, hashPassword(initial));
  if (!valid) return Response.json({ valid: false }, { status: 401 });
  if (!stored.startsWith("scrypt$")) await pool.query("UPDATE site_settings SET admin_passcode=$1 WHERE id=1", [hashPassword(passcode)]);
  await createSession();
  return Response.json({ valid: true });
});
