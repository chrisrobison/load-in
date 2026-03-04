import path from "node:path";
import { getAppContext } from "./app.js";
import { Analyst } from "./agents/analyst.js";
import { Auditor } from "./agents/auditor.js";
import { Builder } from "./agents/builder.js";
import { Closer } from "./agents/closer.js";
import { Scout, type ScoutInput } from "./agents/scout.js";
import { writeJson, writeText } from "./utils/fs.js";
import type { ContactRecord, GeneratedAsset, PipelineResult, QualificationDecision, VenueCandidate, VenueRecord } from "./types.js";

export class Pipeline {
  private readonly scout = new Scout();
  private readonly auditor = new Auditor();
  private readonly builder = new Builder();
  private readonly analyst = new Analyst();
  private readonly closer = new Closer();
  private readonly app = getAppContext();

  async run(input: ScoutInput, options?: { jobId?: string; candidates?: VenueCandidate[] }): Promise<PipelineResult[]> {
    const candidates = options?.candidates ?? await this.scout.run(input);
    const results: PipelineResult[] = [];

    for (const candidate of candidates) {
      const result = await this.runCandidate(candidate, input, options?.jobId);
      results.push(result);
    }

    return results;
  }

  private async runCandidate(candidate: VenueCandidate, input: ScoutInput, jobId?: string): Promise<PipelineResult> {
    const { venueRepository, dossierRepository, outreachRepository } = this.app.repositories;
    const { contactFinder, qualificationService, dossierService, mailerService } = this.app.services;

    const discoveredVenue = venueRepository.upsertVenue({
      slug: this.slugFromCandidate(candidate),
      name: candidate.name,
      canonicalUrl: candidate.url,
      city: candidate.city ?? input.city,
      category: candidate.category ?? input.category,
      vertical: candidate.vertical ?? input.vertical,
      status: "discovered"
    });

    dossierRepository.append({
      venueId: discoveredVenue.id,
      jobId,
      stage: "reconnaissance",
      eventType: "venue_discovered",
      decision: candidate.source,
      details: candidate
    });

    const audit = await this.auditor.run(candidate);
    venueRepository.upsertVenue({
      slug: audit.venue.slug,
      name: audit.venue.name,
      canonicalUrl: audit.venue.finalUrl,
      city: audit.venue.city ?? candidate.city ?? input.city,
      category: audit.venue.category ?? candidate.category ?? input.category,
      vertical: audit.venue.vertical,
      status: "audited"
    });
    const venue = venueRepository.getVenueByIdOrSlug(audit.venue.slug) ?? discoveredVenue;
    if (discoveredVenue.id !== venue.id) {
      venueRepository.deleteVenue(discoveredVenue.id);
      dossierRepository.append({
        venueId: venue.id,
        jobId,
        stage: "reconnaissance",
        eventType: "venue_canonicalized",
        decision: `${discoveredVenue.slug} -> ${venue.slug}`,
        details: { from: discoveredVenue, to: venue }
      });
    }

    venueRepository.saveVenueProfile(venue.id, audit.venue);
    dossierRepository.append({
      venueId: venue.id,
      jobId,
      stage: "audit_fetch",
      eventType: "profile_saved",
      details: audit.venue
    });
    dossierRepository.append({
      venueId: venue.id,
      jobId,
      stage: "audit_classify",
      eventType: "audit_scored",
      decision: String(audit.score),
      details: { summaryBullets: audit.summaryBullets, leaks: audit.topLeaks }
    });

    const analysis = this.analyst.run(audit);
    dossierRepository.append({
      venueId: venue.id,
      jobId,
      stage: "pricing_analysis",
      eventType: "analysis_computed",
      details: analysis
    });

    const contactsDraft = await contactFinder.run(venue.id, audit.venue);
    const contacts = venueRepository.replaceContacts(venue.id, contactsDraft);
    dossierRepository.append({
      venueId: venue.id,
      jobId,
      stage: "contact_resolution",
      eventType: "contacts_resolved",
      decision: contacts[0]?.value,
      details: contacts
    });

    const primaryReachable = contacts.find((contact) => contact.isPrimary && contact.kind !== "phone")
      ?? contacts.find((contact) => contact.kind !== "phone");
    const primaryEmail = contacts.find((contact) => contact.isPrimary && contact.kind === "email")
      ?? contacts.find((contact) => contact.kind === "email");
    const hasSuppression = primaryEmail ? outreachRepository.isSuppressed(primaryEmail.value) : false;
    const contactedRecently = outreachRepository.hasRecentOutboundForVenue(
      venue.id,
      new Date(Date.now() - this.app.env.AUTO_SEND_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
    );
    const qualification = qualificationService.decide(audit.score, audit.topLeaks[0]?.severity, contacts, hasSuppression, contactedRecently);

    venueRepository.upsertVenue({
      slug: audit.venue.slug,
      name: audit.venue.name,
      canonicalUrl: audit.venue.finalUrl,
      city: audit.venue.city ?? candidate.city ?? input.city,
      category: audit.venue.category ?? candidate.category ?? input.category,
      vertical: audit.venue.vertical,
      status: qualification.qualified ? "qualified" : "disqualified"
    });
    dossierRepository.append({
      venueId: venue.id,
      jobId,
      stage: "qualification",
      eventType: "qualification_decision",
      decision: qualification.reason,
      details: qualification
    });

    const build = await this.builder.run(audit, analysis);
    dossierRepository.append({
      venueId: venue.id,
      jobId,
      stage: "build_fix_pack",
      eventType: "assets_generated",
      details: build.fixAssets
    });

    const outreach = this.closer.run(audit, analysis, build);
    dossierRepository.append({
      venueId: venue.id,
      jobId,
      stage: "outreach_generation",
      eventType: "outreach_drafted",
      details: { subject: outreach.subject, dm: outreach.dm }
    });

    const auditRun = venueRepository.saveAuditRun({
      venueId: venue.id,
      jobId,
      audit,
      analysis,
      qualification,
      reportPath: build.reportPath
    });
    venueRepository.replaceAssets(venue.id, auditRun.id, build.fixAssets);

    const outputDir = build.outputDir;
    await writeJson(path.join(outputDir, "audit.json"), {
      venue,
      auditRunId: auditRun.id,
      audit,
      analysis,
      build,
      qualification,
      contacts
    });
    await writeText(path.join(outputDir, "outreach_email.txt"), `Subject: ${outreach.subject}\n${outreach.email}`);
    await writeText(path.join(outputDir, "outreach_dm.txt"), outreach.dm);

    let threadId: string | undefined;
    if (primaryReachable) {
      const thread = outreachRepository.createThread({
        venueId: venue.id,
        contactId: primaryReachable.id,
        auditRunId: auditRun.id,
        subject: outreach.subject,
        status: qualification.autoSendEligible ? "queued" : "drafted"
      });
      threadId = thread.id;
      outreachRepository.addMessage({
        threadId: thread.id,
        direction: "outbound",
        subject: outreach.subject,
        bodyText: outreach.email,
        bodyHtml: outreach.emailHtml,
        status: qualification.autoSendEligible ? "queued" : "draft",
        classificationJson: JSON.stringify({ generated: true, autoSendEligible: qualification.autoSendEligible })
      });

      dossierRepository.append({
        venueId: venue.id,
        jobId,
        stage: "send_decision",
        eventType: "send_gate_evaluated",
        decision: qualification.autoSendEligible ? "auto_send" : "hold",
        details: {
          reason: qualification.reason,
          primaryContact: primaryReachable.value,
          mailerConfigured: mailerService.isConfigured()
        }
      });

      if (qualification.autoSendEligible && primaryEmail) {
        const sendResult = await mailerService.send({
          to: primaryEmail.value,
          subject: outreach.subject,
          text: outreach.email,
          html: outreach.emailHtml
        });
        outreachRepository.addMessage({
          threadId: thread.id,
          direction: "outbound",
          providerMessageId: sendResult.messageId,
          subject: outreach.subject,
          bodyText: outreach.email,
          bodyHtml: outreach.emailHtml,
          status: sendResult.simulated ? "simulated" : "sent",
          sentAt: new Date().toISOString()
        });
        outreachRepository.updateThread(thread.id, {
          status: "sent",
          lastMessageAt: new Date().toISOString()
        });
        venueRepository.upsertVenue({
          slug: audit.venue.slug,
          name: audit.venue.name,
          canonicalUrl: audit.venue.finalUrl,
          city: audit.venue.city ?? candidate.city ?? input.city,
          category: audit.venue.category ?? candidate.category ?? input.category,
          vertical: audit.venue.vertical,
          status: "contacted"
        });
        dossierRepository.append({
          venueId: venue.id,
          jobId,
          stage: "send_email",
          eventType: "outreach_sent",
          decision: sendResult.simulated ? "simulated" : "sent",
          details: { to: primaryEmail.value, messageId: sendResult.messageId }
        });
      }
    }

    const dossier = venueRepository.getVenueDossier(venue.id);
    if (dossier) {
      const dossierPath = await dossierService.writeVenueDossier(dossier);
      const assets = [...build.fixAssets, { type: "venue dossier", path: dossierPath, description: "Timeline and decision log for the venue." }];
      venueRepository.replaceAssets(venue.id, auditRun.id, assets);
    }

    return {
      venueId: venue.id,
      auditRunId: auditRun.id,
      jobId,
      audit,
      analysis,
      build,
      outreach,
      qualification,
      contacts,
      threadId
    };
  }

  private slugFromCandidate(candidate: VenueCandidate): string {
    return candidate.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  }
}
