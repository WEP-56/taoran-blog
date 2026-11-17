import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { friendLinks } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

async function handleGET(_request: Request) {
  try {
    await ensureDatabaseReady();
    const rows = await db
      .select()
      .from(friendLinks)
      .orderBy(asc(friendLinks.sortOrder), asc(friendLinks.id));
    return NextResponse.json(rows);
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/friends error:", error);
    return NextResponse.json(
      { error: "Failed to fetch friend links" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json();

    const name = String(body.name || "").trim();
    const url = String(body.url || "").trim();

    if (!name || !url) {
      return NextResponse.json(
        { error: "友链名称与链接地址不能为空" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(friendLinks)
      .values({
        name,
        url,
        description: String(body.description || "").trim(),
        avatarUrl: String(body.avatarUrl || "").trim(),
        sortOrder: Number(body.sortOrder || 0),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("POST /api/friends error:", error);
    return NextResponse.json(
      { error: "Failed to create friend link" },
      { status: 500 }
    );
  }
}

export const GET = api(handleGET);
export const POST = api(handlePOST);
