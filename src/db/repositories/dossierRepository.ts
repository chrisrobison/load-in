import type Database from "better-sqlite3";
import type { StageEvent } from "../../types.js";
import { createId } from "../../lib/ids.js";

export class DossierRepository {
  constructor(private readonly db: Database.Database) {}

  append(input: { venueId?: string; jobId?: string; stage: string; eventType: string; decision?: string; details: unknown }): StageEvent {
    const record: StageEvent = {
      id: createId("evt"),
      venueId: input.venueId,
      jobId: input.jobId,
      stage: input.stage,
      eventType: input.eventType,
      decision: input.decision,
      detailsJson: JSON.stringify(input.details),
      createdAt: new Date().toISOString()
    };
    this.db.prepare(`
      INSERT INTO stage_events (id, venue_id, job_id, stage, event_type, decision, details_json, created_at)
      VALUES (@id, @venueId, @jobId, @stage, @eventType, @decision, @detailsJson, @createdAt)
    `).run(record);
    return record;
  }

  listByJobId(jobId: string): StageEvent[] {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, job_id as jobId, stage, event_type as eventType, decision, details_json as detailsJson, created_at as createdAt
      FROM stage_events
      WHERE job_id = ?
      ORDER BY created_at ASC
    `).all(jobId) as StageEvent[];
  }
}
