import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 重建队列（docs/02-architecture.md §4）：防抖合并连续保存，串行执行，保留日志尾部 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEBOUNCE_MS = 10_000;
const LOG_TAIL = 60;

type BuildState = "idle" | "queued" | "building" | "ok" | "fail";

const status: { state: BuildState; queuedAt?: string; finishedAt?: string; log: string[] } = {
  state: "idle",
  log: [],
};

let timer: ReturnType<typeof setTimeout> | null = null;
let rerunAfter = false;

export function getRebuildStatus() {
  return { ...status, log: status.log.slice(-LOG_TAIL) };
}

export function enqueueRebuild(): void {
  if (status.state === "building") {
    rerunAfter = true; // 构建中又有保存：完成后再跑一轮
    return;
  }
  status.state = "queued";
  status.queuedAt = new Date().toISOString();
  if (timer) clearTimeout(timer);
  timer = setTimeout(runBuild, DEBOUNCE_MS);
}

function runBuild(): void {
  timer = null;
  status.state = "building";
  status.log = [`[${new Date().toISOString()}] 开始构建主站……`];

  const cmd = process.env.REBUILD_CMD ?? "pnpm --filter @taoran/web build";
  const child = spawn(cmd, { cwd: repoRoot, shell: true });

  const push = (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) status.log.push(line.trimEnd());
    }
    if (status.log.length > 400) status.log.splice(0, status.log.length - 400);
  };
  child.stdout.on("data", push);
  child.stderr.on("data", push);

  child.on("close", (code) => {
    status.state = code === 0 ? "ok" : "fail";
    status.finishedAt = new Date().toISOString();
    status.log.push(`[${status.finishedAt}] 构建${code === 0 ? "完成 ✓" : `失败（exit ${code}）`}`);
    if (rerunAfter) {
      rerunAfter = false;
      enqueueRebuild();
    }
  });
}
