import { api, databaseError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import {
  pageViews,
  posts,
  moments,
  comments,
} from "@/db/schema";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { countWords } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function handlePOST(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json().catch(() => ({}));
    const path = String(body.path || "/").slice(0, 200);
    const postSlug = String(body.postSlug || "").trim();
    const ua = request.headers.get("user-agent") || "";
    const device = /ipad|tablet/i.test(ua)
      ? "Tablet"
      : /mobile|iphone|android/i.test(ua)
      ? "Mobile"
      : "Desktop";

    const visitorHash =
      String(body.visitorId || "").slice(0, 64) ||
      `anon-${new Date().toISOString().slice(0, 10)}`;

    const referrer = String(body.referrer || "direct").slice(0, 120) || "direct";

    await db.insert(pageViews).values({
      path,
      postSlug,
      visitorHash,
      device,
      referrer,
    });

    if (postSlug) {
      await db
        .update(posts)
        .set({ views: sql`${posts.views} + 1` })
        .where(and(eq(posts.slug, postSlug), eq(posts.status, "published")));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("POST /api/telemetry error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function handleGET(_request: Request) {
  try {
    await ensureDatabaseReady();

    const [allPosts, allMoments, allComments, allViews] = await Promise.all([
      db.select().from(posts),
      db.select().from(moments),
      db.select().from(comments).orderBy(desc(comments.createdAt)),
      db.select().from(pageViews).where(gte(pageViews.createdAt, new Date(Date.now() - 14 * 86400000))).orderBy(desc(pageViews.createdAt)),
    ]);

    const publishedPosts = allPosts.filter((p) => p.status === "published");
    const draftPosts = allPosts.filter((p) => p.status === "draft");
    const totalPostViews = allPosts.reduce((acc, p) => acc + (p.views || 0), 0);
    const totals = await pool.query("SELECT count(*)::int AS views, count(DISTINCT visitor_hash)::int AS visitors FROM page_views");
    const totalViews = Math.max(totals.rows[0].views, totalPostViews);
    const uniqueVisitors = totals.rows[0].visitors;
    const totalWords = allPosts.reduce(
      (acc, p) => acc + countWords(p.content),
      0
    );
    const totalLikes =
      allPosts.reduce((acc, p) => acc + (p.likes || 0), 0) +
      allMoments.reduce((acc, m) => acc + (m.likes || 0), 0);

    // Build 14-day daily trend
    const dailyMap = new Map<
      string,
      { date: string; views: number; visitors: Set<string> }
    >();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, views: 0, visitors: new Set() });
    }

    for (const v of allViews) {
      const key = new Date(v.createdAt).toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.views += 1;
        bucket.visitors.add(v.visitorHash);
      }
    }

    const dailySeries = Array.from(dailyMap.values()).map((b) => ({
      date: b.date,
      label: b.date.slice(5),
      views: b.views,
      uniques: b.visitors.size,
    }));

    // Device distribution
    const deviceCounts: Record<string, number> = {
      Desktop: 0,
      Mobile: 0,
      Tablet: 0,
    };
    for (const v of allViews) {
      deviceCounts[v.device] = (deviceCounts[v.device] || 0) + 1;
    }

    // Top posts
    const topPosts = [...allPosts]
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        views: p.views,
        likes: p.likes,
        category: p.category,
        status: p.status,
      }));

    // Recent visits
    const recentVisits = allViews.slice(0, 16).map((v) => ({
      id: v.id,
      path: v.path,
      device: v.device,
      referrer: v.referrer,
      createdAt: v.createdAt,
    }));

    return NextResponse.json({
      summary: {
        totalViews,
        uniqueVisitors,
        publishedCount: publishedPosts.length,
        draftCount: draftPosts.length,
        momentsCount: allMoments.length,
        commentsCount: allComments.length,
        totalWords,
        totalLikes,
      },
      dailySeries,
      deviceCounts,
      topPosts,
      recentVisits,
    });
  } catch (error) {
    const response = databaseError(error);
    if (response) return response;
    console.error("GET /api/telemetry error:", error);
    return NextResponse.json(
      { error: "Failed to load telemetry" },
      { status: 500 }
    );
  }
}

export const POST = api(handlePOST);
export const GET = api(handleGET);
