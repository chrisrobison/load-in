import * as cheerio from "cheerio";
import { fetchPage } from "../utils/http.js";
import { cleanWhitespace, estimateGenreKeywords, extractEmails, extractPhone, toSlug, truncate } from "../utils/text.js";
import type { AuditResult, EventCandidate, Leak, VenueCandidate, VenueProfile } from "../types.js";

export class Auditor {
  async run(candidate: VenueCandidate): Promise<AuditResult> {
    const profile = await this.buildProfile(candidate);
    const leaks = this.detectLeaks(profile);
    const score = Math.max(15, 100 - leaks.reduce((sum, leak) => sum + leak.severity, 0));
    const summaryBullets = this.buildSummary(profile, leaks);

    return {
      venue: profile,
      score,
      summaryBullets,
      leaks,
      topLeaks: leaks.slice(0, 5)
    };
  }

  private async buildProfile(candidate: VenueCandidate): Promise<VenueProfile> {
    try {
      const fetched = await fetchPage(candidate.url);
      const $ = cheerio.load(fetched.html);
      const text = cleanWhitespace($("body").text());
      const title = cleanWhitespace($("title").first().text());
      const metaDescription = cleanWhitespace($("meta[name='description']").attr("content") ?? "");
      const h1 = cleanWhitespace($("h1").first().text());
      const address = this.extractAddress($, text);
      const emails = Array.from(new Set([
        ...extractEmails(fetched.html),
        ...$("a[href^='mailto:']").map((_, el) => ($(el).attr("href") ?? "").replace(/^mailto:/, "")).get()
      ])).filter(Boolean);
      const forms = $("form");
      const linksText = cleanWhitespace($("a, button").text().toLowerCase());
      const eventCandidates = this.extractEvents($);
      const imageBytes = $("img").map((_, el) => Number($(el).attr("width")) * Number($(el).attr("height")) * 0.2 || 0).get();
      const rawJsonLd = $("script[type='application/ld+json']").text();

      return {
        name: this.resolveVenueName(candidate, title, h1),
        slug: toSlug(this.resolveVenueName(candidate, title, h1)),
        url: candidate.url,
        finalUrl: fetched.url,
        city: candidate.city ?? this.inferCity(`${title} ${metaDescription}`),
        category: candidate.category,
        title: title || undefined,
        metaDescription: metaDescription || undefined,
        h1: h1 || undefined,
        address,
        phone: extractPhone(text),
        emails,
        hasForm: forms.length > 0,
        hasBookCTA: /(book|rent|private event|request a date|inquire)/i.test(linksText) || /(book|rent|private event)/i.test(text),
        hasRentalInfo: /(capacity|floor plan|tech specs|private event|rental|venue specs)/i.test(text),
        hasCalendar: /(calendar|schedule)/i.test(text),
        hasTickets: /(tickets|ticketmaster|eventbrite|seetickets)/i.test(text),
        hasUpcomingEvents: eventCandidates.length > 0 || /(upcoming events|shows this week|calendar)/i.test(text),
        hasArtistSubmission: /(submit your band|artist submission|promoter|booking inquiry|submit)/i.test(text),
        hasNewsletter: /(newsletter|mailing list|subscribe)/i.test(text),
        hasEventSchema: /Event/i.test(rawJsonLd),
        imageCount: $("img").length,
        totalImageBytes: imageBytes.reduce((sum, bytes) => sum + bytes, 0),
        estimatedPageWeight: fetched.html.length + imageBytes.reduce((sum, bytes) => sum + bytes, 0),
        wordCount: text.split(/\s+/).filter(Boolean).length,
        genres: estimateGenreKeywords(text),
        eventCandidates,
        rawTextSample: truncate(text, 800),
        notes: [
          fetched.status >= 400 ? `Site returned HTTP ${fetched.status}` : `Fetched successfully with HTTP ${fetched.status}`,
          eventCandidates.length > 0 ? `Detected ${eventCandidates.length} possible event listings.` : "No clear event cards detected."
        ],
        fetchSucceeded: true
      };
    } catch (error) {
      const fallbackName = candidate.name && candidate.name !== "venue" ? candidate.name : candidate.url;
      return {
        name: fallbackName,
        slug: toSlug(fallbackName),
        url: candidate.url,
        finalUrl: candidate.url,
        city: candidate.city,
        category: candidate.category,
        emails: [],
        hasForm: false,
        hasBookCTA: false,
        hasRentalInfo: false,
        hasCalendar: false,
        hasTickets: false,
        hasUpcomingEvents: false,
        hasArtistSubmission: false,
        hasNewsletter: false,
        hasEventSchema: false,
        imageCount: 0,
        totalImageBytes: 0,
        estimatedPageWeight: 0,
        wordCount: 0,
        genres: ["indie", "punk", "metal", "edm", "comedy"],
        eventCandidates: [],
        rawTextSample: "",
        notes: [`Fetch failed: ${error instanceof Error ? error.message : "unknown error"}`],
        fetchSucceeded: false
      };
    }
  }

  private resolveVenueName(candidate: VenueCandidate, title?: string, h1?: string): string {
    const genericNames = new Set([
      "home",
      "events",
      "upcoming shows",
      "calendar",
      "tickets",
      "redirecting",
      "redirecting…"
    ]);

    if (candidate.source === "seed" && candidate.name.trim().length > 0) {
      return cleanWhitespace(candidate.name);
    }

    const preferred = [h1, title, candidate.name].find((value) => {
      if (!value || value.trim().length === 0) {
        return false;
      }
      const normalizedValue = this.normalizeVenueName(value);
      return !genericNames.has(normalizedValue.toLowerCase()) && normalizedValue.length <= 60;
    });
    const normalized = this.normalizeVenueName(preferred ?? "Venue");
    return normalized || "Venue";
  }

  private normalizeVenueName(value: string): string {
    return cleanWhitespace(value)
      .split("|")[0]
      .split(" – ")[0]
      .split(" - ")[0]
      .trim();
  }

  private inferCity(source: string): string | undefined {
    const match = source.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:,\s*[A-Z][a-z]+)?\b/);
    return match ? cleanWhitespace(match[1]) : undefined;
  }

  private extractAddress($: cheerio.CheerioAPI, text: string): string | undefined {
    const addressNodeText = cleanWhitespace($("address, .address, [itemprop='address']").first().text());
    if (addressNodeText.length >= 10 && addressNodeText.length <= 120) {
      return addressNodeText;
    }

    const match = text.match(
      /\b\d{2,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Way|Lane|Ln)\b(?:,?\s+[A-Za-z.\s]+){0,4}(?:\s+\d{5})?/i
    );
    const value = cleanWhitespace(match?.[0] ?? "");
    return value.length >= 10 && value.length <= 120 ? value : undefined;
  }

  private extractEvents($: cheerio.CheerioAPI): EventCandidate[] {
    const nodes = $("article, .event, .event-card, li, .tribe-events-event, .show, .calendar-item");
    const results: EventCandidate[] = [];

    nodes.each((_, el) => {
      const text = cleanWhitespace($(el).text());
      if (text.length < 18) {
        return;
      }
      const dateText = text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i)?.[0]
        ?? text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)?.[0]
        ?? text.match(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0];

      if (!dateText) {
        return;
      }

      const title = text.replace(dateText, "").slice(0, 80).trim();
      results.push({
        title: truncate(title || "Upcoming event", 80),
        dateText,
        link: $(el).find("a").first().attr("href") || undefined
      });
    });

    return results.slice(0, 5);
  }

  private detectLeaks(profile: VenueProfile): Leak[] {
    const leaks: Leak[] = [];

    if (!profile.hasBookCTA) {
      leaks.push({
        key: "missing-booking-cta",
        category: "booking_funnel",
        title: "No clear booking CTA",
        severity: 18,
        whyItMatters: "Buyers cannot immediately see how to book the room, which increases drop-off from high-intent traffic.",
        fix: "Add a primary 'Request a date' CTA on the homepage and every private events page.",
        evidence: "No obvious 'book', 'rent', or private events CTA was detected."
      });
    }

    if (!profile.hasForm && !profile.phone && profile.emails.length === 0) {
      leaks.push({
        key: "contact-friction",
        category: "booking_funnel",
        title: "High inquiry friction",
        severity: 15,
        whyItMatters: "If prospects only see sparse contact information, fewer of them complete a booking inquiry.",
        fix: "Publish a short venue inquiry form with event type, preferred dates, and expected attendance.",
        evidence: "No inquiry form, phone number, or public booking email was found."
      });
    }

    if (!profile.hasRentalInfo) {
      leaks.push({
        key: "missing-rental-info",
        category: "booking_funnel",
        title: "Missing rental and spec details",
        severity: 12,
        whyItMatters: "Planners need capacity, room specs, and event-fit details before they reach out.",
        fix: "Add a concise private events section with capacity, amenities, and AV/spec highlights.",
        evidence: "Terms like capacity, rental, private event, or specs were not detected."
      });
    }

    if (!profile.title || !profile.metaDescription) {
      leaks.push({
        key: "weak-seo-metadata",
        category: "discovery",
        title: "Missing or weak SEO metadata",
        severity: 10,
        whyItMatters: "Search results underperform when the page title or description is generic or absent.",
        fix: "Ship tighter title/meta tags focused on bookings, events, and the venue's city.",
        evidence: `Title present: ${Boolean(profile.title)}. Meta description present: ${Boolean(profile.metaDescription)}.`
      });
    }

    if (!profile.hasEventSchema) {
      leaks.push({
        key: "missing-event-schema",
        category: "discovery",
        title: "No event schema markup detected",
        severity: 8,
        whyItMatters: "Structured event data improves search visibility and helps search engines understand upcoming shows.",
        fix: "Publish JSON-LD Event markup for upcoming shows or a reusable schema template.",
        evidence: "No JSON-LD Event schema was detected in the page source."
      });
    }

    if (profile.estimatedPageWeight > 700_000 || profile.imageCount > 25) {
      leaks.push({
        key: "heavy-page",
        category: "conversion",
        title: "Page likely too heavy",
        severity: 9,
        whyItMatters: "Slow pages depress ticket clicks and booking inquiries, especially on mobile.",
        fix: "Compress hero media, lazy-load secondary images, and reduce oversized assets.",
        evidence: `Estimated page weight ${Math.round(profile.estimatedPageWeight / 1024)} KB with ${profile.imageCount} images.`
      });
    }

    if (!profile.hasNewsletter) {
      leaks.push({
        key: "no-email-capture",
        category: "conversion",
        title: "No clear email capture",
        severity: 7,
        whyItMatters: "Without email capture, the venue loses repeat demand from fans, promoters, and private-event prospects.",
        fix: "Add a simple newsletter/signup block with one compelling incentive.",
        evidence: "No newsletter or subscribe language was detected."
      });
    }

    if (!profile.hasUpcomingEvents) {
      leaks.push({
        key: "no-upcoming-events",
        category: "fill_rate",
        title: "No obvious upcoming events feed",
        severity: 14,
        whyItMatters: "An empty events presence makes the venue look inactive and hurts both ticket sales and room demand.",
        fix: "Promote upcoming events prominently and keep a crawlable event list live.",
        evidence: "No event cards or strong upcoming-events signals were found."
      });
    }

    if (!profile.hasArtistSubmission) {
      leaks.push({
        key: "no-promoter-intake",
        category: "fill_rate",
        title: "No promoter or artist intake path",
        severity: 11,
        whyItMatters: "Without a submission flow, the venue misses inbound opportunities to fill weak nights.",
        fix: "Add a lightweight artist/promoter intake form with draw, genre, and date range.",
        evidence: "No artist submission or promoter intake terms were detected."
      });
    }

    if (!profile.hasTickets) {
      leaks.push({
        key: "weak-ticketing-signals",
        category: "revenue",
        title: "Ticketing or upsell path is unclear",
        severity: 10,
        whyItMatters: "Fans convert worse when ticket links are inconsistent and upsell messaging is absent.",
        fix: "Standardize ticket links and add pre-event upsell blocks for VIP, merch, or drink packages.",
        evidence: "No obvious ticketing provider or ticket CTA was detected."
      });
    }

    return leaks.sort((a, b) => b.severity - a.severity);
  }

  private buildSummary(profile: VenueProfile, leaks: Leak[]): string[] {
    const bullets = [
      leaks[0]
        ? `${profile.name} is leaking revenue first through ${leaks[0].title.toLowerCase()}.`
        : `${profile.name} has a relatively healthy public funnel, with only minor issues found.`,
      profile.fetchSucceeded
        ? `The audit used live public site data from ${profile.finalUrl}.`
        : "The audit used fallback assumptions because the site could not be fetched reliably.",
      profile.eventCandidates.length > 0
        ? `The site appears to list events, but ${leaks.filter((leak) => leak.category !== "fill_rate").length} other issues still limit conversions.`
        : "There is no strong public signal for upcoming events, which likely hurts both discovery and fill rate."
    ];

    return bullets;
  }
}
