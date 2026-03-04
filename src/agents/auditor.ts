import * as cheerio from "cheerio";
import { fetchPage } from "../utils/http.js";
import { cleanWhitespace, estimateGenreKeywords, extractEmails, extractPhone, toSlug, truncate } from "../utils/text.js";
import type { AuditResult, EventCandidate, VenueCandidate, VenueProfile } from "../types.js";
import { getVerticalAdapter, inferVertical } from "../verticals/index.js";

export class Auditor {
  async run(candidate: VenueCandidate): Promise<AuditResult> {
    const profile = await this.buildProfile(candidate);
    const adapter = getVerticalAdapter(profile.vertical);
    const leaks = adapter.detectLeaks(profile);
    const score = Math.max(15, 100 - leaks.reduce((sum, leak) => sum + leak.severity, 0));
    const summaryBullets = adapter.buildSummary(profile, leaks);

    return {
      venue: profile,
      score,
      summaryBullets,
      leaks,
      topLeaks: leaks.slice(0, 5)
    };
  }

  private async buildProfile(candidate: VenueCandidate): Promise<VenueProfile> {
    const vertical = candidate.vertical ?? inferVertical(candidate.category);
    const category = candidate.category ?? getVerticalAdapter(vertical).defaultCategory;

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
      const lowerText = text.toLowerCase();
      const eventCandidates = this.extractEvents($);
      const imageBytes = $("img").map((_, el) => Number($(el).attr("width")) * Number($(el).attr("height")) * 0.2 || 0).get();
      const rawJsonLd = $("script[type='application/ld+json']").text();
      const keywordMatches = Array.from(new Set((lowerText.match(/\b(?:bridal|balayage|extensions|color|cut|blowout|brunch|cocktails|private dining|catering|happy hour|live music|promoter|ticketing)\b/g) ?? [])));

      return {
        name: this.resolveVenueName(candidate, title, h1),
        slug: toSlug(this.resolveVenueName(candidate, title, h1)),
        url: candidate.url,
        finalUrl: fetched.url,
        city: candidate.city ?? this.inferCity(`${title} ${metaDescription}`),
        category,
        vertical,
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
        hasUpcomingEvents: eventCandidates.length > 0 || /(upcoming events|shows this week|calendar|specials|happy hour|upcoming classes|events)/i.test(text),
        hasArtistSubmission: /(submit your band|artist submission|promoter|booking inquiry|submit)/i.test(text),
        hasNewsletter: /(newsletter|mailing list|subscribe|text club|vip list)/i.test(text),
        hasEventSchema: /Event/i.test(rawJsonLd),
        hasOnlineBooking: /(book now|book online|reserve your appointment|book appointment|vagaro|glossgenius|square appointments|fresha|mindbody)/i.test(`${linksText} ${lowerText}`),
        hasServiceMenu: /(services|haircut|balayage|highlights|color correction|blowout|extensions|treatments|pricing|service menu)/i.test(text),
        hasTeamPage: /(our team|meet the team|stylists|artists|staff|barbers)/i.test(text),
        hasReviews: /(reviews|testimonials|what clients say|google reviews|five stars)/i.test(text),
        hasReservations: /(reserve|reservation|book a table|opentable|resy|tock)/i.test(`${linksText} ${lowerText}`),
        hasOrderingLink: /(order online|pickup|delivery|doordash|ubereats|grubhub|toasttab|caviar)/i.test(`${linksText} ${lowerText}`),
        hasPrivateDining: /(private dining|catering|group dining|large party|private events)/i.test(text),
        hasMenuPage: /(menu|wine list|cocktails|brunch|dinner|lunch|dessert)/i.test(text),
        imageCount: $("img").length,
        totalImageBytes: imageBytes.reduce((sum, bytes) => sum + bytes, 0),
        estimatedPageWeight: fetched.html.length + imageBytes.reduce((sum, bytes) => sum + bytes, 0),
        wordCount: text.split(/\s+/).filter(Boolean).length,
        genres: estimateGenreKeywords(text),
        keywords: keywordMatches,
        eventCandidates,
        rawTextSample: truncate(text, 800),
        notes: [
          fetched.status >= 400 ? `Site returned HTTP ${fetched.status}` : `Fetched successfully with HTTP ${fetched.status}`,
          eventCandidates.length > 0 ? `Detected ${eventCandidates.length} possible event or promotion listings.` : "No clear event cards detected.",
          `Vertical adapter: ${vertical}`
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
        category,
        vertical,
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
        hasOnlineBooking: false,
        hasServiceMenu: false,
        hasTeamPage: false,
        hasReviews: false,
        hasReservations: false,
        hasOrderingLink: false,
        hasPrivateDining: false,
        hasMenuPage: false,
        imageCount: 0,
        totalImageBytes: 0,
        estimatedPageWeight: 0,
        wordCount: 0,
        genres: ["indie", "punk", "metal", "edm", "comedy"],
        keywords: [],
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
      "redirecting…",
      "menu",
      "reservations"
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
    const normalized = this.normalizeVenueName(preferred ?? "Business");
    return normalized || "Business";
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
    const nodes = $("article, .event, .event-card, li, .tribe-events-event, .show, .calendar-item, .special, .promotion");
    const results: EventCandidate[] = [];

    nodes.each((_, el) => {
      const text = cleanWhitespace($(el).text());
      if (text.length < 18) {
        return;
      }
      const dateText = text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i)?.[0]
        ?? text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)?.[0]
        ?? text.match(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0]
        ?? text.match(/\b(?:happy hour|brunch|tasting menu|wine dinner)\b/i)?.[0];

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
}
