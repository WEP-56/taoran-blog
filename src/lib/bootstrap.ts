import { db } from "@/db";
import { sql } from "drizzle-orm";
// Readiness only: schema changes are exclusively performed by npm run db:migrate.
export async function ensureDatabaseReady() {
  await db.execute(sql`select id from site_settings where id = 1`);
}
