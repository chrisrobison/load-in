import type Database from "better-sqlite3";
import type {
  AnalysisResult,
  AuditResult,
  AuditRunRecord,
  ContactRecord,
  GeneratedAsset,
  QualificationDecision,
  StageEvent,
  VenueDossier,
  VenueProfile,
  VenueProfileRecord,
  VenueRecord,
  VenueStatus,
  VenueSummary
} from "../../types.js";
import { createId } from "../../lib/ids.js";
import { parseJson, toSqlBool } from "./shared.js";

export class VenueRepository {
  constructor(private readonly db: Database.Database) {}

  findByCanonicalUrlOrName(input: { canonicalUrl?: string; name: string; city?: string; vertical?: VenueRecord["vertical"] }): VenueRecord | undefined {
    if (input.canonicalUrl) {
      const byUrl = this.db.prepare(`
        SELECT id, slug, name, canonical_url as canonicalUrl, city, category, vertical, status, created_at as createdAt, updated_at as updatedAt
        FROM venues
        WHERE canonical_url = ?
        LIMIT 1
      `).get(input.canonicalUrl) as VenueRecord | undefined;
      if (byUrl) {
        return byUrl;
      }
    }

    return this.db.prepare(`
      SELECT id, slug, name, canonical_url as canonicalUrl, city, category, vertical, status, created_at as createdAt, updated_at as updatedAt
      FROM venues
      WHERE lower(name) = lower(?)
        AND coalesce(city, '') = coalesce(?, '')
        AND coalesce(vertical, '') IN ('', coalesce(?, ''))
      LIMIT 1
    `).get(input.name, input.city ?? null, input.vertical ?? null) as VenueRecord | undefined;
  }

  upsertVenue(input: { slug: string; name: string; canonicalUrl?: string; city?: string; category?: string; vertical?: VenueRecord["vertical"]; status: VenueStatus }): VenueRecord {
    const now = new Date().toISOString();
    const existing = this.findByCanonicalUrlOrName({
      canonicalUrl: input.canonicalUrl,
      name: input.name,
      city: input.city,
      vertical: input.vertical
    }) ?? this.db.prepare("SELECT * FROM venues WHERE slug = ?").get(input.slug) as VenueRecord | undefined;
    if (existing) {
      const mergedStatus = pickVenueStatus(existing.status, input.status);
      this.db.prepare(`
        UPDATE venues
        SET name = ?, canonical_url = ?, city = ?, category = ?, vertical = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(input.name, input.canonicalUrl ?? null, input.city ?? null, input.category ?? null, input.vertical ?? existing.vertical ?? null, mergedStatus, now, existing.id);
      return {
        ...existing,
        name: input.name,
        canonicalUrl: input.canonicalUrl,
        city: input.city,
        category: input.category,
        vertical: input.vertical ?? existing.vertical,
        status: mergedStatus,
        updatedAt: now
      };
    }

    const record: VenueRecord = {
      id: createId("ven"),
      slug: input.slug,
      name: input.name,
      canonicalUrl: input.canonicalUrl,
      city: input.city,
      category: input.category,
      vertical: input.vertical,
      status: input.status,
      createdAt: now,
      updatedAt: now
    };
    this.db.prepare(`
      INSERT INTO venues (id, slug, name, canonical_url, city, category, vertical, status, created_at, updated_at)
      VALUES (@id, @slug, @name, @canonicalUrl, @city, @category, @vertical, @status, @createdAt, @updatedAt)
    `).run(record);
    return record;
  }

  getVenueByIdOrSlug(idOrSlug: string): VenueRecord | undefined {
    const row = this.db.prepare(`
      SELECT id, slug, name, canonical_url as canonicalUrl, city, category, vertical, status, created_at as createdAt, updated_at as updatedAt
      FROM venues WHERE id = ? OR slug = ? LIMIT 1
    `).get(idOrSlug, idOrSlug) as VenueRecord | undefined;
    return row;
  }

  deleteVenue(id: string): void {
    this.db.prepare("DELETE FROM stage_events WHERE venue_id = ?").run(id);
    this.db.prepare("DELETE FROM contacts WHERE venue_id = ?").run(id);
    this.db.prepare("DELETE FROM venues WHERE id = ?").run(id);
  }

  saveVenueProfile(venueId: string, profile: VenueProfile): VenueProfileRecord {
    const record: VenueProfileRecord = {
      id: createId("vpr"),
      venueId,
      sourceUrl: profile.url,
      finalUrl: profile.finalUrl,
      title: profile.title,
      metaDescription: profile.metaDescription,
      h1: profile.h1,
      address: profile.address,
      phone: profile.phone,
      emailsJson: JSON.stringify(profile.emails),
      genresJson: JSON.stringify(profile.genres),
      eventCandidatesJson: JSON.stringify(profile.eventCandidates),
      rawTextSample: profile.rawTextSample,
      fetchSucceeded: toSqlBool(profile.fetchSucceeded),
      profileJson: JSON.stringify(profile),
      createdAt: new Date().toISOString()
    };

    this.db.prepare(`
      INSERT INTO venue_profiles (
        id, venue_id, source_url, final_url, title, meta_description, h1, address, phone, emails_json, genres_json,
        event_candidates_json, raw_text_sample, fetch_succeeded, profile_json, created_at
      ) VALUES (
        @id, @venueId, @sourceUrl, @finalUrl, @title, @metaDescription, @h1, @address, @phone, @emailsJson, @genresJson,
        @eventCandidatesJson, @rawTextSample, @fetchSucceeded, @profileJson, @createdAt
      )
    `).run(record);
    return record;
  }

  saveAuditRun(input: {
    venueId: string;
    jobId?: string;
    audit: AuditResult;
    analysis: AnalysisResult;
    qualification: QualificationDecision;
    reportPath?: string;
  }): AuditRunRecord {
    const record: AuditRunRecord = {
      id: createId("aud"),
      venueId: input.venueId,
      jobId: input.jobId,
      score: input.audit.score,
      qualified: toSqlBool(input.qualification.qualified),
      qualificationReason: input.qualification.reason,
      auditJson: JSON.stringify(input.audit),
      analysisJson: JSON.stringify(input.analysis),
      reportPath: input.reportPath,
      createdAt: new Date().toISOString()
    };
    this.db.prepare(`
      INSERT INTO audit_runs (id, venue_id, job_id, score, qualified, qualification_reason, audit_json, analysis_json, report_path, created_at)
      VALUES (@id, @venueId, @jobId, @score, @qualified, @qualificationReason, @auditJson, @analysisJson, @reportPath, @createdAt)
    `).run(record);

    this.db.prepare("DELETE FROM venue_leaks WHERE audit_run_id = ?").run(record.id);
    const insertLeak = this.db.prepare(`
      INSERT INTO venue_leaks (id, audit_run_id, venue_id, key, category, title, severity, why_it_matters, fix, evidence)
      VALUES (@id, @auditRunId, @venueId, @key, @category, @title, @severity, @whyItMatters, @fix, @evidence)
    `);
    for (const leak of input.audit.leaks) {
      insertLeak.run({
        id: createId("leak"),
        auditRunId: record.id,
        venueId: input.venueId,
        key: leak.key,
        category: leak.category,
        title: leak.title,
        severity: leak.severity,
        whyItMatters: leak.whyItMatters,
        fix: leak.fix,
        evidence: leak.evidence ?? null
      });
    }

    return record;
  }

  replaceAssets(venueId: string, auditRunId: string, assets: GeneratedAsset[]): void {
    this.db.prepare("DELETE FROM generated_assets WHERE venue_id = ? AND audit_run_id = ?").run(venueId, auditRunId);
    const stmt = this.db.prepare(`
      INSERT INTO generated_assets (id, venue_id, audit_run_id, asset_type, path, description, created_at)
      VALUES (@id, @venueId, @auditRunId, @assetType, @path, @description, @createdAt)
    `);
    const createdAt = new Date().toISOString();
    for (const asset of assets) {
      stmt.run({
        id: createId("asset"),
        venueId,
        auditRunId,
        assetType: asset.type,
        path: asset.path,
        description: asset.description,
        createdAt
      });
    }
  }

  replaceContacts(venueId: string, contacts: Omit<ContactRecord, "id" | "createdAt" | "updatedAt" | "venueId">[]): ContactRecord[] {
    this.db.prepare("DELETE FROM contacts WHERE venue_id = ?").run(venueId);
    const stmt = this.db.prepare(`
      INSERT INTO contacts (id, venue_id, kind, value, source, role_hint, confidence, is_primary, status, created_at, updated_at)
      VALUES (@id, @venueId, @kind, @value, @source, @roleHint, @confidence, @isPrimary, @status, @createdAt, @updatedAt)
    `);
    const created: ContactRecord[] = [];
    const now = new Date().toISOString();
    for (const contact of contacts) {
      const record: ContactRecord = {
        id: createId("con"),
        venueId,
        kind: contact.kind,
        value: contact.value,
        source: contact.source,
        roleHint: contact.roleHint,
        confidence: contact.confidence,
        isPrimary: contact.isPrimary,
        status: contact.status,
        createdAt: now,
        updatedAt: now
      };
      stmt.run({
        ...record,
        isPrimary: toSqlBool(record.isPrimary)
      });
      created.push(record);
    }
    return created;
  }

  listVenueSummaries(): VenueSummary[] {
    const rows = this.db.prepare(`
      SELECT
        v.id,
        v.slug,
        v.name,
        v.status,
        v.city,
        v.vertical,
        ar.score,
        ar.id AS latestAuditRunId,
        ar.qualification_reason as qualificationReason,
        ar.audit_json AS auditJson
      FROM venues v
      LEFT JOIN audit_runs ar ON ar.id = (
        SELECT id FROM audit_runs WHERE venue_id = v.id ORDER BY created_at DESC LIMIT 1
      )
      ORDER BY v.updated_at DESC
    `).all() as Array<{ id: string; slug: string; name: string; status: VenueStatus; city?: string; vertical?: VenueRecord["vertical"]; score?: number; latestAuditRunId?: string; qualificationReason?: string; auditJson?: string }>;

    const summaries = rows.map((row) => {
      const audit = parseJson<AuditResult | null>(row.auditJson, null);
      const effectiveStatus = row.status === "discovered" && row.qualificationReason
        ? row.qualificationReason.startsWith("qualified")
          ? "qualified"
          : "disqualified"
        : row.status;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: effectiveStatus,
        city: row.city,
        vertical: row.vertical,
        score: row.score,
        latestAuditRunId: row.latestAuditRunId,
        topLeaks: audit?.topLeaks?.slice(0, 3).map((leak) => leak.title) ?? []
      };
    });

    const deduped = new Map<string, VenueSummary>();
    for (const summary of summaries) {
      const key = `${summary.name.toLowerCase()}::${summary.city?.toLowerCase() ?? ""}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, summary);
        continue;
      }
      const existingScore = existing.score ?? -1;
      const nextScore = summary.score ?? -1;
      if (nextScore > existingScore || (nextScore === existingScore && existing.status === "discovered" && summary.status !== "discovered")) {
        deduped.set(key, summary);
      }
    }

    return Array.from(deduped.values());
  }

  getVenueDossier(venueIdOrSlug: string): VenueDossier | undefined {
    const venue = this.getVenueByIdOrSlug(venueIdOrSlug);
    if (!venue) {
      return undefined;
    }

    const latestProfileRow = this.db.prepare(`
      SELECT id, venue_id as venueId, source_url as sourceUrl, final_url as finalUrl, title, meta_description as metaDescription,
      h1, address, phone, emails_json as emailsJson, genres_json as genresJson, event_candidates_json as eventCandidatesJson,
      raw_text_sample as rawTextSample, fetch_succeeded as fetchSucceeded, profile_json as profileJson, created_at as createdAt
      FROM venue_profiles WHERE venue_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(venue.id) as VenueProfileRecord | undefined;

    const latestAuditRow = this.db.prepare(`
      SELECT id, report_path as reportPath, audit_json as auditJson, analysis_json as analysisJson, qualification_reason as qualificationReason
      FROM audit_runs WHERE venue_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(venue.id) as { id: string; reportPath?: string; auditJson: string; analysisJson: string; qualificationReason?: string } | undefined;

    const assets = this.db.prepare(`
      SELECT asset_type as type, path, description
      FROM generated_assets WHERE venue_id = ? ORDER BY created_at DESC
    `).all(venue.id) as GeneratedAsset[];

    const contactsRows = this.db.prepare(`
      SELECT id, venue_id as venueId, kind, value, source, role_hint as roleHint, confidence,
      is_primary as isPrimary, status, created_at as createdAt, updated_at as updatedAt
      FROM contacts WHERE venue_id = ? ORDER BY confidence DESC
    `).all(venue.id) as Array<Omit<ContactRecord, "isPrimary"> & { isPrimary: number }>;

    const threads = this.db.prepare(`
      SELECT id, venue_id as venueId, contact_id as contactId, audit_run_id as auditRunId, status, subject,
      last_message_at as lastMessageAt, reply_intent as replyIntent, created_at as createdAt, updated_at as updatedAt
      FROM outreach_threads WHERE venue_id = ? ORDER BY updated_at DESC
    `).all(venue.id) as any[];

    const messages = this.db.prepare(`
      SELECT om.id, om.thread_id as threadId, om.direction, om.provider_message_id as providerMessageId,
      om.in_reply_to as inReplyTo, om.subject, om.body_text as bodyText, om.body_html as bodyHtml, om.status,
      om.classification_json as classificationJson, om.sent_at as sentAt, om.received_at as receivedAt, om.created_at as createdAt
      FROM outreach_messages om
      INNER JOIN outreach_threads ot ON ot.id = om.thread_id
      WHERE ot.venue_id = ?
      ORDER BY om.created_at DESC
    `).all(venue.id) as any[];

    const offers = this.db.prepare(`
      SELECT id, venue_id as venueId, thread_id as threadId, pricing_model as pricingModel, amount_cents as amountCents,
      currency, terms_json as termsJson, status, created_at as createdAt, updated_at as updatedAt
      FROM offers WHERE venue_id = ? ORDER BY created_at DESC
    `).all(venue.id) as any[];

    const checkouts = this.db.prepare(`
      SELECT id, venue_id as venueId, offer_id as offerId, stripe_checkout_id as stripeCheckoutId, checkout_url as checkoutUrl,
      status, webhook_payload_json as webhookPayloadJson, created_at as createdAt, updated_at as updatedAt
      FROM checkout_sessions WHERE venue_id = ? ORDER BY created_at DESC
    `).all(venue.id) as any[];

    const deliveries = this.db.prepare(`
      SELECT id, venue_id as venueId, audit_run_id as auditRunId, checkout_session_id as checkoutSessionId, delivery_url as deliveryUrl,
      zip_path as zipPath, status, sent_at as sentAt, viewed_at as viewedAt, created_at as createdAt, updated_at as updatedAt
      FROM deliveries WHERE venue_id = ? ORDER BY created_at DESC
    `).all(venue.id) as any[];

    const stageEvents = this.db.prepare(`
      SELECT id, venue_id as venueId, job_id as jobId, stage, event_type as eventType, decision, details_json as detailsJson, created_at as createdAt
      FROM stage_events WHERE venue_id = ? ORDER BY created_at ASC
    `).all(venue.id) as StageEvent[];

    const latestQualificationEvent = [...stageEvents].reverse().find((event) => event.stage === "qualification");

    return {
      venue,
      latestProfile: latestProfileRow ? parseJson<VenueProfile | undefined>(latestProfileRow.profileJson, undefined) : undefined,
      latestAudit: latestAuditRow ? parseJson<AuditResult | undefined>(latestAuditRow.auditJson, undefined) : undefined,
      latestAnalysis: latestAuditRow ? parseJson<AnalysisResult | undefined>(latestAuditRow.analysisJson, undefined) : undefined,
      latestQualification: latestQualificationEvent ? parseJson(latestQualificationEvent.detailsJson, undefined) : undefined,
      latestAuditRunId: latestAuditRow?.id,
      latestReportPath: latestAuditRow?.reportPath,
      assets,
      contacts: contactsRows.map((contact) => ({
        ...contact,
        isPrimary: Boolean(contact.isPrimary)
      })),
      threads,
      messages,
      offers,
      checkouts,
      deliveries,
      stageEvents
    };
  }
}

function pickVenueStatus(existing: VenueStatus, incoming: VenueStatus): VenueStatus {
  const rank: Record<VenueStatus, number> = {
    discovered: 0,
    audited: 1,
    qualified: 2,
    disqualified: 2,
    contacted: 3,
    replied: 4,
    interested: 5,
    checkout_sent: 6,
    paid: 7,
    fulfilled: 8,
    closed_lost: 8
  };
  return rank[incoming] >= rank[existing] ? incoming : existing;
}
