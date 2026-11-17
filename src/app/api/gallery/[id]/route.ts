import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { galleryItems } from "@/db/schema";
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
    if (typeof body.title === "string") updateData.title = body.title.trim();
    if (typeof body.caption === "string")
      updateData.caption = body.caption.trim();
    if (typeof body.imageUrl === "string")
      updateData.imageUrl = body.imageUrl.trim();
    if (typeof body.location === "string")
      updateData.location = body.location.trim();
    if (typeof body.cameraSpec === "string")
      updateData.cameraSpec = body.cameraSpec.trim();
    if (typeof body.takenAt === "string")
      updateData.takenAt = body.takenAt.trim();
    if (typeof body.featured === "boolean") updateData.featured = body.featured;

    const [updated] = await db
      .update(galleryItems)
      .set(updateData)
      .where(eq(galleryItems.id, Number(id)))
      .returning();

    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("PUT /api/gallery/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update gallery item" },
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
    await db.delete(galleryItems).where(eq(galleryItems.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("DELETE /api/gallery/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete gallery item" },
      { status: 500 }
    );
  }
}

export const PUT = api(handlePUT);
export const DELETE = api(handleDELETE);
