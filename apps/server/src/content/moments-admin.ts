import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { momentSchema, type Moment } from "@taoran/content";
import { contentDir } from "./sync";

const momentsDir = () => path.join(contentDir, "moments");

function fileFor(date: Date): string {
  return path.join(momentsDir(), `${date.toISOString().slice(0, 7)}.jsonl`);
}

export function listMoments(): Moment[] {
  const dir = momentsDir();
  if (!existsSync(dir)) return [];
  const out: Moment[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    const lines = readFileSync(path.join(dir, file), "utf-8").split("\n").filter(Boolean);
    for (const [i, line] of lines.entries()) {
      const parsed = momentSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`moments/${file} 第 ${i + 1} 行校验失败：${parsed.error.issues.map((x) => x.message).join("; ")}`);
      }
      out.push(parsed.data);
    }
  }
  return out.sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf());
}

export function addMoment(input: Omit<Moment, "id"> & { id?: string }): Moment {
  const moment = momentSchema.parse({
    ...input,
    id: input.id || `m-${new Date(input.createdAt).toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`,
  });
  const all = listMoments();
  if (all.some((m) => m.id === moment.id)) {
    throw new Error("动态 id 已存在，请稍后再试");
  }
  mkdirSync(momentsDir(), { recursive: true });
  const file = fileFor(moment.createdAt);
  const line = `${JSON.stringify({
    ...moment,
    createdAt: moment.createdAt.toISOString(),
  })}\n`;
  writeFileSync(file, line, { encoding: "utf-8", flag: "a" });
  return moment;
}

export function deleteMoment(id: string): boolean {
  const all = listMoments();
  const next = all.filter((m) => m.id !== id);
  if (next.length === all.length) return false;
  writeAllMoments(next);
  return true;
}

function writeAllMoments(moments: Moment[]): void {
  const dir = momentsDir();
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".jsonl")) unlinkSync(path.join(dir, file));
  }
  const byFile = new Map<string, Moment[]>();
  for (const m of moments) {
    const file = fileFor(m.createdAt);
    byFile.set(file, [...(byFile.get(file) ?? []), m]);
  }
  for (const [file, rows] of byFile) {
    const body = rows
      .sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf())
      .map((m) => JSON.stringify({ ...m, createdAt: m.createdAt.toISOString() }))
      .join("\n");
    writeFileSync(file, `${body}\n`, "utf-8");
  }
}
