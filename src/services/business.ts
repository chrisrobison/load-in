import type { AppEnv } from "../lib/env.js";
import { DossierRepository } from "../db/repositories/dossierRepository.js";
import { OutreachRepository } from "../db/repositories/outreachRepository.js";
import { VenueRepository } from "../db/repositories/venueRepository.js";
import { BillingService } from "./billing.js";
import { DeliveryService } from "./delivery.js";
import { DossierService } from "./dossier.js";
import { MailerService } from "./mailer.js";

export class BusinessService {
  constructor(
    private readonly env: AppEnv,
    private readonly venueRepository: VenueRepository,
    private readonly outreachRepository: OutreachRepository,
    private readonly dossierRepository: DossierRepository,
    private readonly mailerService: MailerService,
    private readonly billingService: BillingService,
    private readonly deliveryService: DeliveryService,
    private readonly dossierService: DossierService
  ) {}

  async sendDraft(threadId: string): Promise<void> {
    const thread = this.outreachRepository.getThread(threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    const dossier = this.venueRepository.getVenueDossier(thread.venueId);
    if (!dossier) {
      throw new Error("Venue dossier not found");
    }
    const contact = dossier.contacts.find((item) => item.id === thread.contactId && item.kind === "email");
    if (!contact) {
      throw new Error("Email contact not found for thread");
    }
    if (this.outreachRepository.isSuppressed(contact.value)) {
      throw new Error("Contact is suppressed");
    }
    const draftMessage = dossier.messages.find((message) => message.threadId === thread.id && message.status === "draft");
    if (!draftMessage) {
      throw new Error("Draft message not found");
    }

    const sendResult = await this.mailerService.send({
      to: contact.value,
      subject: thread.subject ?? draftMessage.subject ?? "Venue Fix Pack",
      text: draftMessage.bodyText,
      html: draftMessage.bodyHtml
    });

    this.outreachRepository.addMessage({
      threadId: thread.id,
      direction: "outbound",
      providerMessageId: sendResult.messageId,
      subject: thread.subject ?? draftMessage.subject,
      bodyText: draftMessage.bodyText,
      bodyHtml: draftMessage.bodyHtml,
      status: sendResult.simulated ? "simulated" : "sent",
      sentAt: new Date().toISOString()
    });
    this.outreachRepository.updateThread(thread.id, {
      status: "sent",
      lastMessageAt: new Date().toISOString()
    });
    const venue = dossier.venue;
    this.venueRepository.upsertVenue({
      slug: venue.slug,
      name: venue.name,
      canonicalUrl: venue.canonicalUrl,
      city: venue.city,
      category: venue.category,
      status: "contacted"
    });
    this.dossierRepository.append({
      venueId: venue.id,
      stage: "send_email",
      eventType: "outreach_sent",
      decision: sendResult.simulated ? "simulated" : "sent",
      details: { threadId, to: contact.value, messageId: sendResult.messageId }
    });
  }

  async processInterestedThreads(): Promise<void> {
    const threads = this.outreachRepository.listThreadsByStatus("interested");
    for (const thread of threads) {
      if (this.outreachRepository.findOfferByThread(thread.id)) {
        continue;
      }
      await this.createOfferAndCheckoutForThread(thread.id);
    }
  }

  async createOfferAndCheckoutForThread(threadId: string): Promise<void> {
    const thread = this.outreachRepository.getThread(threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    const dossier = this.venueRepository.getVenueDossier(thread.venueId);
    if (!dossier) {
      throw new Error("Venue dossier not found");
    }
    const contact = dossier.contacts.find((item) => item.id === thread.contactId && item.kind === "email");
    if (!contact) {
      throw new Error("No email contact available for checkout");
    }

    const offer = this.outreachRepository.createOffer({
      venueId: dossier.venue.id,
      threadId: thread.id,
      pricingModel: "flat_setup_monthly",
      amountCents: 150000,
      currency: "usd",
      status: "checkout_created",
      terms: {
        setup: "$1,500 setup",
        monthly: "$350/mo",
        notes: "Performance-based option remains available as a manual follow-up."
      }
    });
    const checkout = await this.billingService.createCheckout(offer, dossier.venue.name);
    const checkoutRecord = this.outreachRepository.createCheckout({
      venueId: dossier.venue.id,
      offerId: offer.id,
      stripeCheckoutId: checkout.stripeCheckoutId,
      checkoutUrl: checkout.checkoutUrl,
      status: checkout.simulated ? "simulated" : "created"
    });
    this.outreachRepository.updateThread(thread.id, {
      status: "interested",
      lastMessageAt: new Date().toISOString()
    });
    this.venueRepository.upsertVenue({
      slug: dossier.venue.slug,
      name: dossier.venue.name,
      canonicalUrl: dossier.venue.canonicalUrl,
      city: dossier.venue.city,
      category: dossier.venue.category,
      status: "checkout_sent"
    });
    this.dossierRepository.append({
      venueId: dossier.venue.id,
      stage: "checkout_created",
      eventType: "checkout_created",
      decision: checkout.simulated ? "simulated" : "stripe",
      details: { threadId, offerId: offer.id, checkoutId: checkoutRecord.id, checkoutUrl: checkout.checkoutUrl }
    });

    const subject = `Payment link for ${dossier.venue.name} Fix Pack`;
    const text = [
      `Hi ${dossier.venue.name} team,`,
      "",
      "You said this looked interesting, so here is the fastest path to get started.",
      `Checkout link: ${checkout.checkoutUrl}`,
      "",
      "Included in the first delivery:",
      "- booking page",
      "- artist intake form",
      "- SEO and schema fixes",
      "- venue dossier and delivery portal",
      "",
      "Reply if you want the performance-based option instead."
    ].join("\n");
    const sendResult = await this.mailerService.send({
      to: contact.value,
      subject,
      text,
      html: text.split("\n").map((line) => line.length > 0 ? `<p>${line}</p>` : "<br>").join("")
    });
    this.outreachRepository.addMessage({
      threadId: thread.id,
      direction: "outbound",
      providerMessageId: sendResult.messageId,
      subject,
      bodyText: text,
      status: sendResult.simulated ? "simulated" : "sent",
      sentAt: new Date().toISOString()
    });
  }

  async fulfillPaidVenue(venueId: string, checkoutSessionId?: string): Promise<void> {
    const dossier = this.venueRepository.getVenueDossier(venueId);
    if (!dossier) {
      throw new Error("Venue dossier not found");
    }
    if (this.outreachRepository.getLatestDeliveryForVenue(venueId)) {
      return;
    }

    const latestAuditRunId = dossier.latestAuditRunId;
    const packaged = await this.deliveryService.packageVenue(dossier);
    const delivery = this.outreachRepository.createDelivery({
      venueId,
      auditRunId: latestAuditRunId,
      checkoutSessionId,
      deliveryUrl: `${this.env.APP_BASE_URL}/deliveries/pending`,
      zipPath: packaged.zipPath,
      status: "packaged"
    });
    const deliveryUrl = `${this.env.APP_BASE_URL}/deliveries/${delivery.id}`;
    this.outreachRepository.updateDelivery(delivery.id, {
      deliveryUrl
    });

    this.dossierRepository.append({
      venueId,
      stage: "delivery_packaged",
      eventType: "delivery_packaged",
      details: {
        ...packaged,
        deliveryUrl
      }
    });

    const contact = dossier.contacts.find((item) => item.isPrimary && item.kind === "email") ?? dossier.contacts.find((item) => item.kind === "email");
    if (contact) {
      const text = [
        `Hi ${dossier.venue.name} team,`,
        "",
        "Payment is in. Your fix pack is ready.",
        `Delivery portal: ${deliveryUrl}`,
        `ZIP download: ${this.env.APP_BASE_URL}/files/${dossier.venue.slug}/${pathBase(packaged.zipPath)}`,
        "",
        "Approve and we deploy in 24 hours."
      ].join("\n");
      const sendResult = await this.mailerService.send({
        to: contact.value,
        subject: `${dossier.venue.name} Fix Pack delivery`,
        text,
        html: text.split("\n").map((line) => line.length > 0 ? `<p>${line}</p>` : "<br>").join("")
      });
      const thread = dossier.threads[0];
      if (thread) {
        this.outreachRepository.addMessage({
          threadId: thread.id,
          direction: "outbound",
          providerMessageId: sendResult.messageId,
          subject: `${dossier.venue.name} Fix Pack delivery`,
          bodyText: text,
          status: sendResult.simulated ? "simulated" : "sent",
          sentAt: new Date().toISOString()
        });
      }
      this.outreachRepository.updateDelivery(delivery.id, {
        status: "sent",
        sentAt: new Date().toISOString()
      });
    }

    this.venueRepository.upsertVenue({
      slug: dossier.venue.slug,
      name: dossier.venue.name,
      canonicalUrl: dossier.venue.canonicalUrl,
      city: dossier.venue.city,
      category: dossier.venue.category,
      status: "fulfilled"
    });
    this.dossierRepository.append({
      venueId,
      stage: "delivery_sent",
      eventType: "delivery_sent",
      details: { deliveryId: delivery.id, deliveryUrl }
    });
    await this.dossierService.writeVenueDossier(this.venueRepository.getVenueDossier(venueId)!);
  }
}

function pathBase(filePath: string): string {
  return filePath.split("/").at(-1) ?? filePath;
}
