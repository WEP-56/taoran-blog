import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { momentSchema, type Moment } from "@taoran/content";

/** 构建期读取 content/moments/*.jsonl（docs/07-data.md §2.2），校验失败硬报错 */
export function loadMoments(): Moment[] {
  const dir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../content/moments",
  );

  const moments: Moment[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    const lines = readFileSync(path.join(dir, file), "utf-8").split("\n").filter(Boolean);
    for (const [i, line] of lines.entries()) {
      const parsed = momentSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`moments/${file} 第 ${i + 1} 行校验失败：${parsed.error.message}`);
      }
      moments.push(parsed.data);
    }
  }
  return moments.sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf());
}
