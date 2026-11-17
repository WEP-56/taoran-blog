import { db } from "@/db";
import {
  siteSettings,
  posts,
  moments,
  galleryItems,
  comments,
  friendLinks,
} from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { ensureDatabaseReady } from "./bootstrap";
import { normalizeDateSortKey } from "./utils";

export async function getPublicSiteSettings() {
  await ensureDatabaseReady();
  const [settings] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);

  return {
    siteName: settings?.siteName ?? "Air",
    siteTagline: settings?.siteTagline ?? "",
    introZh: settings?.introZh ?? "",
    introEn: settings?.introEn ?? "",
    authorName: settings?.authorName ?? "Su",
    authorRole: settings?.authorRole ?? "",
    footerText: settings?.footerText ?? "",
    aboutMarkdown: settings?.aboutMarkdown ?? "",
    nowStatus: settings?.nowStatus ?? "",
    socialLinks: settings?.socialLinks ?? [],
    shaderMode: (settings?.shaderMode ?? "subtle") as
      | "subtle"
      | "expressive"
      | "off",
  };
}

export async function getPublishedPosts() {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"));

  rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (
      normalizeDateSortKey(b.publishedAt) - normalizeDateSortKey(a.publishedAt)
    );
  });

  return rows;
}

export async function getChronologicalPosts() {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"));

  rows.sort(
    (a, b) =>
      normalizeDateSortKey(b.publishedAt) - normalizeDateSortKey(a.publishedAt)
  );

  return rows;
}

export async function getPostBySlug(slug: string) {
  await ensureDatabaseReady();
  const decoded = slug;
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, decoded), eq(posts.status, "published")))
    .limit(1);
  return post || null;
}

export async function getApprovedComments(postSlug: string) {
  await ensureDatabaseReady();
  const decoded = postSlug;
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.postSlug, decoded), eq(comments.approved, true)))
    .orderBy(desc(comments.createdAt));
  return rows.map(row => ({ ...row, authorEmail: "" }));
}

export async function getAllMoments() {
  await ensureDatabaseReady();
  return db
    .select()
    .from(moments)
    .orderBy(desc(moments.publishedAt), desc(moments.id));
}

export async function getAllGalleryItems() {
  await ensureDatabaseReady();
  return db
    .select()
    .from(galleryItems)
    .orderBy(
      desc(galleryItems.featured),
      desc(galleryItems.takenAt),
      desc(galleryItems.id)
    );
}

export async function getAllFriendLinks() {
  await ensureDatabaseReady();
  return db
    .select()
    .from(friendLinks)
    .orderBy(asc(friendLinks.sortOrder), asc(friendLinks.id));
}
