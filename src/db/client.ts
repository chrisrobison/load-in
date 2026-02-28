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
  }
  return db;
}
