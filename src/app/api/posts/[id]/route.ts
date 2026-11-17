import { isAdmin } from "@/lib/auth";
import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { posts, comments } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { estimateReadingMinutes, makeSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function handleGET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseReady();
    const { id } = await context.params;
    if (!id || id.length > 200) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    const numericId = Number(id);

    const [post] = !Number.isNaN(numericId)
      ? await db.select().from(posts).where(eq(posts.id, numericId)).limit(1)
      : await db.select().from(posts).where(eq(posts.slug, id)).limit(1);

    if (!post || (post.status !== "published" && !await isAdmin())) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/posts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}

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

    const whereClause = !Number.isNaN(numericId)
      ? eq(posts.id, numericId)
      : eq(posts.slug, id);

    if (body.action === "like") {
      const [updated] = await db
        .update(posts)
        .set({ likes: sql`${posts.likes} + 1` })
        .where(and(whereClause, eq(posts.status, "published")))
        .returning({ likes: posts.likes });
      return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.title === "string") updateData.title = body.title.trim();
    if (typeof body.slug === "string" && body.slug.trim()) {
      updateData.slug = makeSlug(body.slug);
    }
    if (typeof body.summary === "string")
      updateData.summary = body.summary.trim();
    if (typeof body.content === "string") {
      updateData.content = body.content;
      updateData.readingMinutes = estimateReadingMinutes(body.content);
    }
    if (typeof body.category === "string")
      updateData.category = body.category.trim() || "随笔";
    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags)
        ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
        : String(body.tags)
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean);
    }
    if (typeof body.coverImage === "string")
      updateData.coverImage = body.coverImage.trim();
    if (typeof body.pinned === "boolean") updateData.pinned = body.pinned;
    if (body.status === "published" || body.status === "draft") {
      updateData.status = body.status;
    }
    if (typeof body.publishedAt === "string" && body.publishedAt.trim()) {
      updateData.publishedAt = body.publishedAt.trim();
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(posts).set(updateData).where(whereClause).returning();
      if (row && updateData.slug) await tx.update(comments).set({ postSlug: row.slug }).where(eq(comments.postId, row.id));
      return row;
    });

    if (!updated) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("PUT /api/posts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update post" },
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
    const numericId = Number(id);

    const [target] = !Number.isNaN(numericId)
      ? await db.select().from(posts).where(eq(posts.id, numericId)).limit(1)
      : await db.select().from(posts).where(eq(posts.slug, id)).limit(1);

    if (!target) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      await tx.delete(comments).where(eq(comments.postId, target.id));
      await tx.delete(posts).where(eq(posts.id, target.id));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("DELETE /api/posts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}

export const GET = api(handleGET);
export const PUT = api(handlePUT);
export const DELETE = api(handleDELETE);
