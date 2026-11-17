import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import {
  estimateReadingMinutes,
  makeSlug,
  normalizeDateSortKey,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  try {
    await ensureDatabaseReady();
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "1";
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const tag = (searchParams.get("tag") || "").trim();
    const category = (searchParams.get("category") || "").trim();

    let rows = await db.select().from(posts).where(includeAll ? undefined : eq(posts.status, "published"));

    if (!includeAll) {
      rows = rows.filter((p) => p.status === "published");
    }

    if (tag) {
      rows = rows.filter(
        (p) => Array.isArray(p.tags) && p.tags.some((t) => t === tag)
      );
    }

    if (category) {
      rows = rows.filter((p) => p.category === category);
    }

    if (query) {
      rows = rows.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.summary.toLowerCase().includes(query) ||
          p.content.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          (Array.isArray(p.tags) &&
            p.tags.some((t) => t.toLowerCase().includes(query)))
      );
    }

    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (
        normalizeDateSortKey(b.publishedAt) -
        normalizeDateSortKey(a.publishedAt)
      );
    });

    return NextResponse.json(rows);
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/posts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json();

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();

    if (!title || !content) {
      return NextResponse.json(
        { error: "标题与正文不能为空" },
        { status: 400 }
      );
    }

    let slug = makeSlug(body.slug ? String(body.slug) : title);
    const existing = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const tagsArray = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
      : String(body.tags || "")
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean);

    const today = new Date().toISOString().slice(0, 10);
    const summary =
      String(body.summary || "").trim() ||
      content
        .replace(/[#>*`\[\]\-_]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

    const [created] = await db
      .insert(posts)
      .values({
        slug,
        title,
        summary,
        content,
        category: String(body.category || "随笔").trim() || "随笔",
        tags: tagsArray,
        coverImage: String(body.coverImage || "").trim(),
        pinned: Boolean(body.pinned),
        status: body.status === "draft" ? "draft" : "published",
        publishedAt: String(body.publishedAt || today).trim() || today,
        readingMinutes: estimateReadingMinutes(content),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("POST /api/posts error:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

export const GET = api(handleGET);
export const POST = api(handlePOST);
