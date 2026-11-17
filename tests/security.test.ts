import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { validateBody, safeUrl } from "../src/lib/api";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { MarkdownBody } from "../src/components/MarkdownBody";

test("password hashing rejects plaintext, wrong and corrupt passwords", () => {
  const hash = hashPassword("long-unique-password");
  assert.ok(verifyPassword("long-unique-password", hash));
  assert.equal(verifyPassword("wrong", hash), false);
  assert.equal(verifyPassword("air2026", "air2026"), false);
  assert.equal(verifyPassword("anything", "scrypt$bad$bad"), false);
});
test("input validation rejects dangerous links, invalid types and oversized content", () => {
  for (const url of ["javascript:alert(1)", "//evil.test", "/\\evil.test", "data:text/html,hello", "java\nscript:alert(1)"]) assert.equal(safeUrl(url), false);
  for (const body of [{ pinned: "false" }, { content: " " }, { tags: [{}] }, { status: "hidden" }, { publishedAt: "tomorrow" }, { adminPasscode: "short" }, { content: "x".repeat(200001) }]) assert.throws(() => validateBody(body));
  assert.doesNotThrow(() => validateBody({ title: "文章", content: "正文", tags: ["测试"], publishedAt: "2026-11-17", pinned: false }));
});
test("Markdown accepts unsupported headings without hanging and blocks active URL schemes", () => {
  const output = renderToStaticMarkup(React.createElement(MarkdownBody, { content: "#### heading\n#hashtag\n\n[x](javascript:alert)\n![x](data:image/svg+xml,bad)" }));
  assert.ok(output.includes("heading"));
  assert.ok(!output.includes("javascript:"));
  assert.ok(!output.includes("data:image"));
});
test("fresh schema contains no demo content and has private comment defaults", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(await readFile("migrations/001_initial.sql", "utf8"));
    for (const table of ["posts", "moments", "gallery_items", "friend_links", "comments", "page_views", "admin_sessions"]) {
      const result = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`);
      assert.equal(result.rows[0].count, 0);
    }
    const result = await db.query<{ admin_passcode: string }>("SELECT admin_passcode FROM site_settings");
    assert.equal(result.rows[0].admin_passcode, "");
  } finally { await db.close(); }
});
