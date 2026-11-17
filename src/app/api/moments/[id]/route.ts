import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { moments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

async function handlePUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { id } = await context.params;
    if (!id || id.length > 200) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const numericId = Number(id);
    const body = await request.json();

    if (body.action === "like") {
      const [updated] = await db
        .update(moments)
        .set({ likes: sql`${moments.likes} + 1` })
        .where(eq(moments.id, numericId))
        .returning({ likes: moments.likes });
      return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof body.content === "string")
      updateData.content = body.content.trim();
    if (typeof body.tag === "string")
      updateData.tag = body.tag.trim() || "日常";
    if (typeof body.location === "string")
      updateData.location = body.location.trim();
    if (typeof body.imageUrl === "string")
      updateData.imageUrl = body.imageUrl.trim();
    if (typeof body.publishedAt === "string" && body.publishedAt.trim()) {
      updateData.publishedAt = body.publishedAt.trim();
    }

    const [updated] = await db
      .update(moments)
      .set(updateData)
      .where(eq(moments.id, numericId))
      .returning();

    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("PUT /api/moments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update moment" },
      { status: 500 }
    );
  }
}

async function handleDELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { id } = await context.params;
    if (!id || id.length > 200) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    await db.delete(moments).where(eq(moments.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("DELETE /api/moments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete moment" },
      { status: 500 }
    );
  }
}

export const PUT = api(handlePUT);
export const DELETE = api(handleDELETE);
