import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { galleryItems } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

async function handleGET(_request: Request) {
  try {
    await ensureDatabaseReady();
    const rows = await db
      .select()
      .from(galleryItems)
      .orderBy(desc(galleryItems.featured), desc(galleryItems.takenAt), desc(galleryItems.id));
    return NextResponse.json(rows);
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/gallery error:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json();
    const title = String(body.title || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: "作品标题与图片地址不能为空" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const [created] = await db
      .insert(galleryItems)
      .values({
        title,
        caption: String(body.caption || "").trim(),
        imageUrl,
        location: String(body.location || "").trim(),
        cameraSpec: String(body.cameraSpec || "").trim(),
        takenAt: String(body.takenAt || today).trim() || today,
        featured: Boolean(body.featured),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("POST /api/gallery error:", error);
    return NextResponse.json(
      { error: "Failed to create gallery item" },
      { status: 500 }
    );
  }
}

export const GET = api(handleGET);
export const POST = api(handlePOST);
