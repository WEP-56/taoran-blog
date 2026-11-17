import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { supportSettings } from "@/db/schema";
import { api, ApiError } from "@/lib/api";
import { getSupportSettings } from "@/lib/data";
import { parseSupport } from "@/lib/support-validation";

export const GET = api(async () => Response.json(await getSupportSettings()));

export const PUT = api(async (request: Request) => {
  const { revision, ...content } = parseSupport(await request.json());
  const [row] = await db.update(supportSettings).set({ content, revision: sql`${supportSettings.revision} + 1`, updatedAt: new Date() })
    .where(and(eq(supportSettings.id, 1), eq(supportSettings.revision, revision))).returning();
  if (!row) throw new ApiError(409, "其他窗口已更新打赏页，请保留当前文案，重新加载后再编辑");
  return Response.json({ ...row.content, revision: row.revision });
}, { validate: body => { parseSupport(body); } });
