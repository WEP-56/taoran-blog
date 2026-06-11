import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");

const dataDir = process.env.DATA_DIR
  ? path.resolve(repoRoot, process.env.DATA_DIR)
  : path.join(repoRoot, "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(repoRoot, process.env.DATABASE_PATH)
  : path.join(dataDir, "taoran.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

export function runMigrations(): void {
  migrate(db, { migrationsFolder: path.resolve(here, "../../drizzle") });
}
