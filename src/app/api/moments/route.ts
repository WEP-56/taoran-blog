import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { moments } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

async function handleGET(_request: Request) {
  try {
    await ensureDatabaseReady();
    const rows = await db
      .select()
      .from(moments)
      .orderBy(desc(moments.publishedAt), desc(moments.id));
    return NextResponse.json(rows);
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/moments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch moments" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json();
    const content = String(body.content || "").trim();
    if (!content) {
      return NextResponse.json({ error: "动态内容不能为空" }, { status: 400 });
    }

    const now = new Date();
    const defaultPublishedAt = `${now.toISOString().slice(0, 10)} ${now
      .toTimeString()
      .slice(0, 5)}`;

    const [created] = await db
      .insert(moments)
      .values({
        content,
        tag: String(body.tag || "日常").trim() || "日常",
        location: String(body.location || "").trim(),
        imageUrl: String(body.imageUrl || "").trim(),
        publishedAt:
          String(body.publishedAt || defaultPublishedAt).trim() ||
          defaultPublishedAt,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("POST /api/moments error:", error);
    return NextResponse.json(
      { error: "Failed to create moment" },
      { status: 500 }
    );
  }
}

export const GET = api(handleGET);
export const POST = api(handlePOST);
