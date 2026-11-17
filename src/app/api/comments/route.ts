import { isAdmin } from "@/lib/auth";
import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { comments, posts } from "@/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  try {
    await ensureDatabaseReady();
    const { searchParams } = new URL(request.url);
    const postSlug = searchParams.get("postSlug");
    const includeAll = searchParams.get("all") === "1";
    const publicFilter = and(eq(comments.approved, true), sql`exists (select 1 from posts where posts.id = ${comments.postId} and posts.status = 'published')`);

    if (postSlug) {
      const rows = await db
        .select()
        .from(comments)
        .where(
          includeAll
            ? eq(comments.postSlug, postSlug)
            : and(eq(comments.postSlug, postSlug), publicFilter)
        )
        .orderBy(desc(comments.createdAt));
      return NextResponse.json(includeAll ? rows : rows.map(row => ({ ...row, authorEmail: "" })));
    }

    const rows = includeAll
      ? await db.select().from(comments).orderBy(desc(comments.createdAt))
      : await db
          .select()
          .from(comments)
          .where(publicFilter)
          .orderBy(desc(comments.createdAt));

    return NextResponse.json(includeAll ? rows : rows.map(row => ({ ...row, authorEmail: "" })));
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/comments error:", error);
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json();

    const postSlug = String(body.postSlug || "").trim();
    const authorName = String(body.authorName || "").trim();
    const content = String(body.content || "").trim();

    if (!postSlug || !authorName || !content) {
      return NextResponse.json(
        { error: "昵称与评论内容不能为空" },
        { status: 400 }
      );
    }

    const [post] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.slug, postSlug), eq(posts.status, "published")))
      .limit(1);

    if (!post) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    if (authorName.length > 80 || content.length > 5000) return NextResponse.json({ error: "评论过长" }, { status: 400 });
    const admin = await isAdmin();
    const [created] = await db
      .insert(comments)
      .values({
        postId: post.id,
        postSlug,
        authorName,
        authorEmail: String(body.authorEmail || "").trim(),
        authorUrl: String(body.authorUrl || "").trim(),
        content,
        isAdmin: admin,
        approved: admin,
      })
      .returning();

    return NextResponse.json({ ...created, authorEmail: "" }, { status: 201 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("POST /api/comments error:", error);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }
}

export const GET = api(handleGET);
export const POST = api(handlePOST);
