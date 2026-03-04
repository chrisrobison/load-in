import type { VerticalAdapter } from "./base.js";
import type { AnalysisResult, AuditResult, BuildResult, ImpactEstimate, Leak, OutreachDraft, VenueProfile } from "../types.js";

function detectLeaks(profile: VenueProfile): Leak[] {
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
      key: "missing-capture",
      category: "conversion",
      title: "No email capture path",
      severity: 7,
      whyItMatters: "Returning fans and private-event shoppers disappear if there is no owned audience capture.",
      fix: "Add a newsletter or lead capture form with a clear offer like presale access or venue updates.",
      evidence: "No newsletter, mailing list, or subscribe prompt was detected."
    });
  }

  if (!profile.hasUpcomingEvents) {
    leaks.push({
      key: "missing-events-list",
      category: "fill_rate",
      title: "No clear upcoming events list",
      severity: 11,
      whyItMatters: "An empty or hidden calendar makes the room feel inactive and weakens discovery for both fans and promoters.",
      fix: "Publish a visible upcoming events section with fresh links to tickets or event details.",
      evidence: "No event cards or upcoming events language was detected."
    });
  }

  if (!profile.hasArtistSubmission) {
    leaks.push({
      key: "missing-promoter-intake",
      category: "fill_rate",
      title: "No promoter or artist intake path",
      severity: 10,
      whyItMatters: "Open dates are harder to fill when bands and promoters have no clear path to pitch the venue.",
      fix: "Add a simple submission form for bands, promoters, and routed tours.",
      evidence: "No artist submission or promoter intake language was detected."
    });
  }

  if (!profile.hasTickets) {
    leaks.push({
      key: "weak-ticketing-links",
      category: "revenue",
      title: "Ticketing path is weak or inconsistent",
      severity: 8,
      whyItMatters: "Fans are less likely to convert when ticket links are hard to find or inconsistent across pages.",
      fix: "Use a consistent ticket CTA and link architecture across event cards and homepage modules.",
      evidence: "No obvious ticketing language or ticket platform reference was detected."
    });
  }

  return leaks.sort((left, right) => right.severity - left.severity);
}

function buildSummary(profile: VenueProfile, leaks: Leak[]): string[] {
  return [
    leaks[0]
      ? `${profile.name} is missing at least one high-intent conversion path: ${leaks[0].title.toLowerCase()}.`
      : `${profile.name} has a workable public presence but still shows optimization room.`,
    !profile.hasUpcomingEvents
      ? "The site does not surface upcoming events clearly, which makes the calendar feel less active than it should."
      : `The site appears to list events, but ${leaks.filter((leak) => leak.category !== "fill_rate").length} other issues still limit conversions.`,
    !profile.hasEventSchema
      ? "Search visibility is likely underpowered because structured event markup was not detected."
      : "The fastest uplift likely comes from reducing friction in the booking and inquiry funnel."
  ];
}

function buildImpact(audit: AuditResult): ImpactEstimate {
  const bookingLeakCount = audit.leaks.filter((leak) => leak.category === "booking_funnel").length;
  const fillRateLeakCount = audit.leaks.filter((leak) => leak.category === "fill_rate").length;
  const contactFriction = audit.venue.hasForm ? 0 : 1;
  const inquiryLow = Math.max(1, bookingLeakCount + contactFriction);
  const inquiryHigh = inquiryLow + 2 + Math.round(audit.score < 60 ? 2 : 1);
  const eventsLow = Math.max(1, fillRateLeakCount);
  const eventsHigh = eventsLow + (audit.venue.hasUpcomingEvents ? 1 : 2);

  return {
    inquiriesPerMonth: `${inquiryLow}-${inquiryHigh} additional qualified inquiries/month`,
    eventsPerMonth: `${eventsLow}-${eventsHigh} additional events/month`,
    assumptions: [
      "Ranges assume the venue already gets some direct traffic but loses intent at the booking step.",
      "Inquiry uplift increases when a visible booking CTA and low-friction form replace phone-only or buried contact flows.",
      "Event uplift assumes promoter intake plus a visible events surface help fill underbooked nights."
    ]
  };
}

function buildPricing(): AnalysisResult["pricing"] {
  return [
    {
      label: "Performance-based",
      details: "12% of incremental booking revenue for the first 90 days, measured against a 60-day pre-launch baseline and tagged inquiry sources."
    },
    {
      label: "Flat setup + monthly",
      details: "$1,500 setup + $350/mo for hosting, optimization, reporting, and monthly fix iterations."
    }
  ];
}

function buildOutreach(audit: AuditResult, analysis: AnalysisResult, build: BuildResult): OutreachDraft {
  const observations = [
    audit.topLeaks[0] ? `I noticed ${audit.topLeaks[0].title.toLowerCase()} on ${audit.venue.finalUrl}.` : undefined,
    audit.topLeaks[1] ? `I also saw ${audit.topLeaks[1].title.toLowerCase()}, which is likely costing direct bookings.` : undefined
  ].filter(Boolean) as string[];

  const assetList = build.fixAssets.slice(0, 3).map((asset) => asset.type).join(", ");
  const subject = `Quick revenue fixes I already mocked up for ${audit.venue.name}`;
  const email = [
    "",
    `Hi ${audit.venue.name} team,`,
    "",
    `I ran a public-site audit on ${audit.venue.finalUrl} and found a few easy wins.`,
    ...observations,
    "",
    `To make this concrete, I already created a Fix Pack for you: ${assetList}.`,
    `The biggest upside is likely ${analysis.impact.inquiriesPerMonth} plus ${analysis.impact.eventsPerMonth}.`,
    "",
    "Two ways to work together:",
    `1. ${analysis.pricing[0].label}: ${analysis.pricing[0].details}`,
    `2. ${analysis.pricing[1].label}: ${analysis.pricing[1].details}`,
    "",
    "If it helps, I can send over the booking page link and a screenshot so you can see the fixes before deciding.",
    "",
    "Want me to send the booking page link and a screenshot?",
    "",
    "If you'd prefer not to hear from me again, reply with unsubscribe."
  ].join("\n");

  const dm = [
    `Ran a quick audit on ${audit.venue.name} and spotted ${audit.topLeaks[0]?.title.toLowerCase() ?? "a few booking leaks"}.`,
    `I already mocked up ${assetList}.`,
    "Want me to send the booking page link and a screenshot?"
  ].join(" ");

  return {
    subject,
    email,
    emailHtml: email.split("\n").map((line) => line.length > 0 ? `<p>${line}</p>` : "<br>").join(""),
    dm
  };
}

export const eventVenueAdapter: VerticalAdapter = {
  id: "event_venue",
  label: "Event Venue",
  defaultCategory: "music venue",
  scoutKeywords: ["music venue", "live music", "event space", "concert venue"],
  detectLeaks,
  buildSummary,
  buildImpact,
  buildPricing: (audit, impact) => buildPricing(),
  buildOutreach
};

