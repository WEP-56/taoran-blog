import { api } from "@/lib/api";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function handleGET(_request: Request) {
  try {
    await db.execute(sql`select id from site_settings where id = 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

export const GET = api(handleGET);
