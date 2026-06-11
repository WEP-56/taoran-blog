// 一次性工具：为测试文章生成纯色占位封面（正式封面由 admin 上传管线产出）
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../../../content/posts/2026");

const covers = [
  ["hello-clay", "#e07856"],
  ["clay-typography-test", "#9caf88"],
  ["shiki-kiln-test", "#f2c94c"],
];

for (const [slug, color] of covers) {
  const dir = path.join(root, slug);
  mkdirSync(dir, { recursive: true });
  await sharp({
    create: { width: 1200, height: 630, channels: 3, background: color },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1200" height="630"><circle cx="600" cy="315" r="180" fill="rgba(255,249,240,0.35)"/><circle cx="600" cy="315" r="120" fill="rgba(255,249,240,0.45)"/></svg>`,
        ),
      },
    ])
    .jpeg({ quality: 80 })
    .toFile(path.join(dir, "cover.jpg"));
  console.log(`✓ ${slug}/cover.jpg`);
}
