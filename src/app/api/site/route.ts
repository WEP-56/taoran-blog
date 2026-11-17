import { hashPassword } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

async function handleGET(_request: Request) {
  try {
    await ensureDatabaseReady();
    const [settings] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    // Strip passcode value from public GET, expose only whether passcode exists
    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    const { adminPasscode, ...publicSettings } = settings;
    return NextResponse.json({
      ...publicSettings,
      hasPasscode: Boolean(adminPasscode),
    });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/site error:", error);
    return NextResponse.json(
      { error: "Failed to load site settings" },
      { status: 500 }
    );
  }
}

async function handlePUT(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json();


    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    const allowedStringFields = [
      "siteName",
      "siteTagline",
      "introZh",
      "introEn",
      "authorName",
      "authorRole",
      "footerText",
      "aboutMarkdown",
      "nowStatus",
      "shaderMode",
      "adminPasscode",
    ] as const;

    for (const key of allowedStringFields) {
      if (typeof body[key] === "string") {
        if (key === "adminPasscode") {
          if (body[key]) updatePayload[key] = hashPassword(body[key]);
        } else updatePayload[key] = body[key];
      }
    }

    if (Array.isArray(body.socialLinks)) {
      updatePayload.socialLinks = body.socialLinks;
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(siteSettings).set(updatePayload).where(eq(siteSettings.id, 1)).returning();
      if (updatePayload.adminPasscode) await tx.execute(sql`DELETE FROM admin_sessions`);
      return row;
    });
    const { adminPasscode, ...safe } = updated;
    return NextResponse.json({
      ...safe,
      hasPasscode: Boolean(adminPasscode),
    });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("PUT /api/site error:", error);
    return NextResponse.json(
      { error: "Failed to update site settings" },
      { status: 500 }
    );
  }
}

export const GET = api(handleGET);
export const PUT = api(handlePUT);
