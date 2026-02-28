import type Database from "better-sqlite3";
import type { JobRecord, JobStatus } from "../../types.js";
import { createId } from "../../lib/ids.js";

export class JobRepository {
  constructor(private readonly db: Database.Database) {}

  create(kind: string, label: string, input: unknown): JobRecord {
    const now = new Date().toISOString();
    const record: JobRecord = {
      id: createId("job"),
      kind,
      label,
      status: "queued",
      inputJson: JSON.stringify(input),
      createdAt: now,
      updatedAt: now
    };
    this.db.prepare(`
      INSERT INTO jobs (id, kind, label, status, input_json, result_json, error, created_at, updated_at)
      VALUES (@id, @kind, @label, @status, @inputJson, NULL, NULL, @createdAt, @updatedAt)
    `).run(record);
    return record;
  }

  update(id: string, patch: { status?: JobStatus; result?: unknown; error?: string | null }): JobRecord | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }
    const next: JobRecord = {
      ...existing,
      status: patch.status ?? existing.status,
      resultJson: patch.result === undefined ? existing.resultJson : JSON.stringify(patch.result),
      error: patch.error === undefined ? existing.error : patch.error ?? undefined,
      updatedAt: new Date().toISOString()
    };
    this.db.prepare(`
      UPDATE jobs
      SET status = @status, result_json = @resultJson, error = @error, updated_at = @updatedAt
      WHERE id = @id
    `).run(next);
    return next;
  }

  get(id: string): JobRecord | undefined {
    return this.db.prepare(`
      SELECT id, kind, label, status, input_json as inputJson, result_json as resultJson, error, created_at as createdAt, updated_at as updatedAt
      FROM jobs WHERE id = ?
    `).get(id) as JobRecord | undefined;
  }

  list(limit = 25): JobRecord[] {
    return this.db.prepare(`
      SELECT id, kind, label, status, input_json as inputJson, result_json as resultJson, error, created_at as createdAt, updated_at as updatedAt
      FROM jobs ORDER BY created_at DESC LIMIT ?
    `).all(limit) as JobRecord[];
  }
}
