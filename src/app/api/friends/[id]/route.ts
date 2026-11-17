import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { friendLinks } from "@/db/schema";
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
    if (typeof body.name === "string") updateData.name = body.name.trim();
    if (typeof body.url === "string") updateData.url = body.url.trim();
    if (typeof body.description === "string")
      updateData.description = body.description.trim();
    if (typeof body.avatarUrl === "string")
      updateData.avatarUrl = body.avatarUrl.trim();
    if (typeof body.sortOrder === "number")
      updateData.sortOrder = body.sortOrder;

    const [updated] = await db
      .update(friendLinks)
      .set(updateData)
      .where(eq(friendLinks.id, Number(id)))
      .returning();

    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("PUT /api/friends/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update friend link" },
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
    await db.delete(friendLinks).where(eq(friendLinks.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("DELETE /api/friends/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete friend link" },
      { status: 500 }
    );
  }
}

export const PUT = api(handlePUT);
export const DELETE = api(handleDELETE);
