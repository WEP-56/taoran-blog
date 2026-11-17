import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { eq } from "drizzle-orm";
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
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (typeof body.approved === "boolean") updateData.approved = body.approved;
    if (typeof body.content === "string")
      updateData.content = body.content.trim();

    const [updated] = await db
      .update(comments)
      .set(updateData)
      .where(eq(comments.id, Number(id)))
      .returning();

    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("PUT /api/comments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
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
    await db.delete(comments).where(eq(comments.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("DELETE /api/comments/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}

export const PUT = api(handlePUT);
export const DELETE = api(handleDELETE);
