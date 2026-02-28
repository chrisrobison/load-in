import type Database from "better-sqlite3";
import type {
  CheckoutRecord,
  DeliveryRecord,
  OfferRecord,
  OutreachMessage,
  OutreachThread,
  ReplyIntent
} from "../../types.js";
import { createId } from "../../lib/ids.js";

export class OutreachRepository {
  constructor(private readonly db: Database.Database) {}

  createThread(input: { venueId: string; contactId: string; auditRunId?: string; subject?: string; status?: string }): OutreachThread {
    const now = new Date().toISOString();
    const record: OutreachThread = {
      id: createId("thr"),
      venueId: input.venueId,
      contactId: input.contactId,
      auditRunId: input.auditRunId,
      status: (input.status ?? "drafted") as OutreachThread["status"],
      subject: input.subject,
      createdAt: now,
      updatedAt: now
    };
    this.db.prepare(`
      INSERT INTO outreach_threads (id, venue_id, contact_id, audit_run_id, status, subject, last_message_at, reply_intent, created_at, updated_at)
      VALUES (@id, @venueId, @contactId, @auditRunId, @status, @subject, NULL, NULL, @createdAt, @updatedAt)
    `).run(record);
    return record;
  }

  updateThread(id: string, patch: { status?: string; replyIntent?: ReplyIntent; lastMessageAt?: string }): void {
    this.db.prepare(`
      UPDATE outreach_threads
      SET status = COALESCE(?, status), reply_intent = COALESCE(?, reply_intent), last_message_at = COALESCE(?, last_message_at), updated_at = ?
      WHERE id = ?
    `).run(patch.status ?? null, patch.replyIntent ?? null, patch.lastMessageAt ?? null, new Date().toISOString(), id);
  }

  addMessage(input: Omit<OutreachMessage, "id" | "createdAt">): OutreachMessage {
    const record: OutreachMessage = {
      id: createId("msg"),
      threadId: input.threadId,
      direction: input.direction,
      providerMessageId: input.providerMessageId,
      inReplyTo: input.inReplyTo,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      status: input.status,
      classificationJson: input.classificationJson,
      sentAt: input.sentAt,
      receivedAt: input.receivedAt,
      createdAt: new Date().toISOString()
    };
    this.db.prepare(`
      INSERT INTO outreach_messages (
        id, thread_id, direction, provider_message_id, in_reply_to, subject, body_text, body_html,
        status, classification_json, sent_at, received_at, created_at
      ) VALUES (
        @id, @threadId, @direction, @providerMessageId, @inReplyTo, @subject, @bodyText, @bodyHtml,
        @status, @classificationJson, @sentAt, @receivedAt, @createdAt
      )
    `).run({
      ...record,
      providerMessageId: record.providerMessageId ?? null,
      inReplyTo: record.inReplyTo ?? null,
      subject: record.subject ?? null,
      bodyHtml: record.bodyHtml ?? null,
      classificationJson: record.classificationJson ?? null,
      sentAt: record.sentAt ?? null,
      receivedAt: record.receivedAt ?? null
    });
    this.updateThread(record.threadId, { lastMessageAt: record.sentAt ?? record.receivedAt ?? record.createdAt });
    return record;
  }

  listThreads(): OutreachThread[] {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, contact_id as contactId, audit_run_id as auditRunId, status, subject,
      last_message_at as lastMessageAt, reply_intent as replyIntent, created_at as createdAt, updated_at as updatedAt
      FROM outreach_threads ORDER BY updated_at DESC
    `).all() as OutreachThread[];
  }

  listThreadsByStatus(status: string): OutreachThread[] {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, contact_id as contactId, audit_run_id as auditRunId, status, subject,
      last_message_at as lastMessageAt, reply_intent as replyIntent, created_at as createdAt, updated_at as updatedAt
      FROM outreach_threads WHERE status = ? ORDER BY updated_at DESC
    `).all(status) as OutreachThread[];
  }

  getThread(id: string): OutreachThread | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, contact_id as contactId, audit_run_id as auditRunId, status, subject,
      last_message_at as lastMessageAt, reply_intent as replyIntent, created_at as createdAt, updated_at as updatedAt
      FROM outreach_threads WHERE id = ?
    `).get(id) as OutreachThread | undefined;
  }

  createOffer(input: { venueId: string; threadId?: string; pricingModel: string; amountCents?: number; currency?: string; terms: unknown; status?: string }): OfferRecord {
    const now = new Date().toISOString();
    const record: OfferRecord = {
      id: createId("off"),
      venueId: input.venueId,
      threadId: input.threadId,
      pricingModel: input.pricingModel,
      amountCents: input.amountCents,
      currency: input.currency ?? "usd",
      termsJson: JSON.stringify(input.terms),
      status: (input.status ?? "drafted") as OfferRecord["status"],
      createdAt: now,
      updatedAt: now
    };
    this.db.prepare(`
      INSERT INTO offers (id, venue_id, thread_id, pricing_model, amount_cents, currency, terms_json, status, created_at, updated_at)
      VALUES (@id, @venueId, @threadId, @pricingModel, @amountCents, @currency, @termsJson, @status, @createdAt, @updatedAt)
    `).run(record);
    return record;
  }

  findOfferByThread(threadId: string): OfferRecord | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, thread_id as threadId, pricing_model as pricingModel, amount_cents as amountCents,
      currency, terms_json as termsJson, status, created_at as createdAt, updated_at as updatedAt
      FROM offers WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(threadId) as OfferRecord | undefined;
  }

  getOfferById(id: string): OfferRecord | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, thread_id as threadId, pricing_model as pricingModel, amount_cents as amountCents,
      currency, terms_json as termsJson, status, created_at as createdAt, updated_at as updatedAt
      FROM offers WHERE id = ? LIMIT 1
    `).get(id) as OfferRecord | undefined;
  }

  updateOffer(id: string, patch: { status?: string }): void {
    this.db.prepare(`
      UPDATE offers SET status = COALESCE(?, status), updated_at = ? WHERE id = ?
    `).run(patch.status ?? null, new Date().toISOString(), id);
  }

  createCheckout(input: { venueId: string; offerId: string; stripeCheckoutId?: string; checkoutUrl?: string; status: string; webhookPayloadJson?: string }): CheckoutRecord {
    const now = new Date().toISOString();
    const record: CheckoutRecord = {
      id: createId("chk"),
      venueId: input.venueId,
      offerId: input.offerId,
      stripeCheckoutId: input.stripeCheckoutId,
      checkoutUrl: input.checkoutUrl,
      status: input.status,
      webhookPayloadJson: input.webhookPayloadJson,
      createdAt: now,
      updatedAt: now
    };
    this.db.prepare(`
      INSERT INTO checkout_sessions (id, venue_id, offer_id, stripe_checkout_id, checkout_url, status, webhook_payload_json, created_at, updated_at)
      VALUES (@id, @venueId, @offerId, @stripeCheckoutId, @checkoutUrl, @status, @webhookPayloadJson, @createdAt, @updatedAt)
    `).run(record);
    return record;
  }

  updateCheckout(id: string, patch: { status?: string; webhookPayloadJson?: string }): void {
    this.db.prepare(`
      UPDATE checkout_sessions
      SET status = COALESCE(?, status), webhook_payload_json = COALESCE(?, webhook_payload_json), updated_at = ?
      WHERE id = ?
    `).run(patch.status ?? null, patch.webhookPayloadJson ?? null, new Date().toISOString(), id);
  }

  listCheckouts(): CheckoutRecord[] {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, offer_id as offerId, stripe_checkout_id as stripeCheckoutId, checkout_url as checkoutUrl,
      status, webhook_payload_json as webhookPayloadJson, created_at as createdAt, updated_at as updatedAt
      FROM checkout_sessions ORDER BY created_at DESC
    `).all() as CheckoutRecord[];
  }

  findCheckoutByOfferId(offerId: string): CheckoutRecord | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, offer_id as offerId, stripe_checkout_id as stripeCheckoutId, checkout_url as checkoutUrl,
      status, webhook_payload_json as webhookPayloadJson, created_at as createdAt, updated_at as updatedAt
      FROM checkout_sessions WHERE offer_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(offerId) as CheckoutRecord | undefined;
  }

  getCheckoutById(id: string): CheckoutRecord | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, offer_id as offerId, stripe_checkout_id as stripeCheckoutId, checkout_url as checkoutUrl,
      status, webhook_payload_json as webhookPayloadJson, created_at as createdAt, updated_at as updatedAt
      FROM checkout_sessions WHERE id = ? LIMIT 1
    `).get(id) as CheckoutRecord | undefined;
  }

  findCheckoutByStripeId(stripeCheckoutId: string): CheckoutRecord | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, offer_id as offerId, stripe_checkout_id as stripeCheckoutId, checkout_url as checkoutUrl,
      status, webhook_payload_json as webhookPayloadJson, created_at as createdAt, updated_at as updatedAt
      FROM checkout_sessions WHERE stripe_checkout_id = ? LIMIT 1
    `).get(stripeCheckoutId) as CheckoutRecord | undefined;
  }

  getLatestDeliveryForVenue(venueId: string): DeliveryRecord | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, audit_run_id as auditRunId, checkout_session_id as checkoutSessionId, delivery_url as deliveryUrl,
      zip_path as zipPath, status, sent_at as sentAt, viewed_at as viewedAt, created_at as createdAt, updated_at as updatedAt
      FROM deliveries WHERE venue_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(venueId) as DeliveryRecord | undefined;
  }

  createDelivery(input: { venueId: string; auditRunId?: string; checkoutSessionId?: string; deliveryUrl?: string; zipPath?: string; status: DeliveryRecord["status"] }): DeliveryRecord {
    const now = new Date().toISOString();
    const record: DeliveryRecord = {
      id: createId("del"),
      venueId: input.venueId,
      auditRunId: input.auditRunId,
      checkoutSessionId: input.checkoutSessionId,
      deliveryUrl: input.deliveryUrl,
      zipPath: input.zipPath,
      status: input.status,
      createdAt: now,
      updatedAt: now
    };
    this.db.prepare(`
      INSERT INTO deliveries (id, venue_id, audit_run_id, checkout_session_id, delivery_url, zip_path, status, sent_at, viewed_at, created_at, updated_at)
      VALUES (@id, @venueId, @auditRunId, @checkoutSessionId, @deliveryUrl, @zipPath, @status, NULL, NULL, @createdAt, @updatedAt)
    `).run(record);
    return record;
  }

  updateDelivery(id: string, patch: Partial<DeliveryRecord>): void {
    this.db.prepare(`
      UPDATE deliveries
      SET status = COALESCE(?, status), delivery_url = COALESCE(?, delivery_url), zip_path = COALESCE(?, zip_path),
      sent_at = COALESCE(?, sent_at), viewed_at = COALESCE(?, viewed_at), updated_at = ?
      WHERE id = ?
    `).run(
      patch.status ?? null,
      patch.deliveryUrl ?? null,
      patch.zipPath ?? null,
      patch.sentAt ?? null,
      patch.viewedAt ?? null,
      new Date().toISOString(),
      id
    );
  }

  addSuppression(email: string, reason: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO suppression_list (id, email, domain, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(createId("sup"), email, email.split("@")[1] ?? null, reason, new Date().toISOString());
  }

  isSuppressed(email: string): boolean {
    const row = this.db.prepare("SELECT 1 FROM suppression_list WHERE email = ? LIMIT 1").get(email) as { 1: number } | undefined;
    return Boolean(row);
  }

  hasRecentOutboundForVenue(venueId: string, sinceIso: string): boolean {
    const row = this.db.prepare(`
      SELECT 1
      FROM outreach_messages om
      INNER JOIN outreach_threads ot ON ot.id = om.thread_id
      WHERE ot.venue_id = ? AND om.direction = 'outbound' AND COALESCE(om.sent_at, om.created_at) >= ?
      LIMIT 1
    `).get(venueId, sinceIso) as { 1: number } | undefined;
    return Boolean(row);
  }

  getDeliveryById(id: string): DeliveryRecord | undefined {
    return this.db.prepare(`
      SELECT id, venue_id as venueId, audit_run_id as auditRunId, checkout_session_id as checkoutSessionId, delivery_url as deliveryUrl,
      zip_path as zipPath, status, sent_at as sentAt, viewed_at as viewedAt, created_at as createdAt, updated_at as updatedAt
      FROM deliveries WHERE id = ? LIMIT 1
    `).get(id) as DeliveryRecord | undefined;
  }
}
