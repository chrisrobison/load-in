import * as cheerio from "cheerio";
import type { ContactRecord, VenueProfile } from "../types.js";
import { fetchPage } from "../utils/http.js";
import { extractEmails } from "../utils/text.js";

export class ContactFinder {
  async run(venueId: string, profile: VenueProfile): Promise<Omit<ContactRecord, "id" | "createdAt" | "updatedAt" | "venueId">[]> {
    const contacts: Array<Omit<ContactRecord, "id" | "createdAt" | "updatedAt" | "venueId">> = [];
    const seen = new Set<string>();

    const push = (contact: Omit<ContactRecord, "id" | "createdAt" | "updatedAt" | "venueId">) => {
      const key = `${contact.kind}:${contact.value}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      contacts.push(contact);
    };

    for (const email of profile.emails) {
      const lower = email.toLowerCase();
      const roleHint = /book|booking|events|private|rent/i.test(lower)
        ? "booking"
        : /info|hello|contact/i.test(lower)
          ? "general"
          : "unknown";
      push({
        kind: "email",
        value: email,
        source: "audit_profile",
        roleHint,
        confidence: roleHint === "booking" ? 0.95 : 0.8,
        isPrimary: roleHint === "booking",
        status: "active"
      });
    }

    try {
      const fetched = await fetchPage(profile.finalUrl);
      const $ = cheerio.load(fetched.html);
      const allEmails = extractEmails(fetched.html);
      for (const email of allEmails) {
        const lower = email.toLowerCase();
        push({
          kind: "email",
          value: email,
          source: profile.finalUrl,
          roleHint: /book|booking|events|private|rent/i.test(lower) ? "booking" : "general",
          confidence: /book|booking|events|private|rent/i.test(lower) ? 0.95 : 0.8,
          isPrimary: /book|booking|events|private|rent/i.test(lower),
          status: "active"
        });
      }

      $("a").each((_, element) => {
        const href = $(element).attr("href") ?? "";
        const text = $(element).text().trim().toLowerCase();
        if (/contact|book|private event|rent/i.test(text) && href && !href.startsWith("mailto:")) {
          const url = new URL(href, profile.finalUrl).toString();
          push({
            kind: "contact_form",
            value: url,
            source: profile.finalUrl,
            roleHint: /book|private event|rent/i.test(text) ? "booking" : "general",
            confidence: /book|private event|rent/i.test(text) ? 0.75 : 0.7,
            isPrimary: /book|private event|rent/i.test(text),
            status: "active"
          });
        }
      });
    } catch {
      // Best-effort fallback; profile-derived contacts remain usable.
    }

    if (profile.phone) {
      push({
        kind: "phone",
        value: profile.phone,
        source: "audit_profile",
        roleHint: "front-desk",
        confidence: 0.5,
        isPrimary: false,
        status: "active"
      });
    }

    return contacts.sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || right.confidence - left.confidence);
  }
}
