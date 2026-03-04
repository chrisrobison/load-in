import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getDatabasePath } from "../lib/env.js";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const filePath = getDatabasePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    db = new Database(filePath);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA_SQL);
    ensureColumn(db, "venues", "vertical", "TEXT");
  }
  return db;
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string): void {
  const existing = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (existing.some((entry) => entry.name === column)) {
    return;
  }
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    if (error instanceof Error && /duplicate column name/i.test(error.message)) {
      return;
    }
    throw error;
  }
}
