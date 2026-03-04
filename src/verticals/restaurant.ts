import type { VerticalAdapter } from "./base.js";
import type { AnalysisResult, AuditResult, BuildResult, ImpactEstimate, Leak, OutreachDraft, VenueProfile } from "../types.js";

function detectLeaks(profile: VenueProfile): Leak[] {
  const leaks: Leak[] = [];

  if (!profile.hasReservations) {
    leaks.push({
      key: "missing-reservation-cta",
      category: "booking_funnel",
      title: "No clear reservation CTA",
      severity: 17,
      whyItMatters: "Restaurants lose high-intent diners when reservations are buried or missing entirely.",
      fix: "Add a persistent reservation CTA in the header and hero, with direct links to booking.",
      evidence: "No obvious reservation or table-booking language was detected."
    });
  }

  if (!profile.hasMenuPage) {
    leaks.push({
      key: "missing-menu-surface",
      category: "booking_funnel",
      title: "Menu is hard to find or incomplete",
      severity: 14,
      whyItMatters: "Guests often decide where to eat based on menu clarity, price anchors, and dietary fit.",
      fix: "Publish a mobile-friendly menu page with food, drinks, and dietary tags.",
      evidence: "No clear menu language or structured menu page signals were detected."
    });
  }

  if (!profile.hasOrderingLink) {
    leaks.push({
      key: "weak-direct-ordering",
      category: "revenue",
      title: "No clear direct ordering path",
      severity: 12,
      whyItMatters: "Takeout and catering demand leaks to marketplaces when direct ordering is absent or inconsistent.",
      fix: "Add a direct order CTA and make it consistent across hero, menu, and footer.",
      evidence: "No strong online ordering or pickup CTA was detected."
    });
  }

  if (!profile.hasPrivateDining) {
    leaks.push({
      key: "missing-private-dining",
      category: "fill_rate",
      title: "Private dining or catering path is unclear",
      severity: 11,
      whyItMatters: "Restaurants often miss higher-margin group bookings when private dining is not surfaced.",
      fix: "Add a private dining and catering inquiry page with group size, date, and spend range fields.",
      evidence: "No private dining, catering, or group event language was detected."
    });
  }

  if (!profile.title || !profile.metaDescription) {
    leaks.push({
      key: "weak-seo-metadata",
      category: "discovery",
      title: "Weak SEO title or meta description",
      severity: 9,
      whyItMatters: "Restaurant discovery is heavily influenced by branded and local-intent search results.",
      fix: "Tighten title and meta tags around cuisine, city, and dining modes like brunch, dinner, or cocktails.",
      evidence: `Title present: ${Boolean(profile.title)}. Meta description present: ${Boolean(profile.metaDescription)}.`
    });
  }

  if (!profile.hasEventSchema) {
    leaks.push({
      key: "missing-structured-data",
      category: "discovery",
      title: "Structured event or local offer markup is missing",
      severity: 7,
      whyItMatters: "Special dinners, brunches, happy hours, and tasting events become easier to discover with structured data.",
      fix: "Publish JSON-LD for special events or offer templates for recurring dining promotions.",
      evidence: "No JSON-LD event schema was detected."
    });
  }

  if (profile.estimatedPageWeight > 750_000 || profile.imageCount > 30) {
    leaks.push({
      key: "heavy-restaurant-site",
      category: "conversion",
      title: "Site is likely too heavy on mobile",
      severity: 8,
      whyItMatters: "Many guests find restaurants on mobile and convert quickly; slow pages cut off that intent.",
      fix: "Compress hero imagery, lazy-load galleries, and keep reservation/order CTAs visible above the fold.",
      evidence: `Estimated page weight ${Math.round(profile.estimatedPageWeight / 1024)} KB with ${profile.imageCount} images.`
    });
  }

  if (!profile.hasNewsletter) {
    leaks.push({
      key: "missing-promotions-capture",
      category: "conversion",
      title: "No email capture for promotions and events",
      severity: 6,
      whyItMatters: "Owned audience capture helps fill slow nights, launches, wine dinners, and seasonal menus.",
      fix: "Add a newsletter capture with a clear hook like first access to specials or event nights.",
      evidence: "No newsletter or subscribe path was detected."
    });
  }

  if (!profile.hasUpcomingEvents) {
    leaks.push({
      key: "missing-events-nights",
      category: "fill_rate",
      title: "No visible event or promotion calendar",
      severity: 7,
      whyItMatters: "Recurring specials, live music, and tasting menus drive fill rate on slower nights when clearly promoted.",
      fix: "Publish a visible events or promotions section for specials, happy hour, and programming.",
      evidence: "No upcoming events or promotions listings were detected."
    });
  }

  return leaks.sort((left, right) => right.severity - left.severity);
}

function buildSummary(profile: VenueProfile, leaks: Leak[]): string[] {
  return [
    leaks[0]
      ? `${profile.name} is leaving dining demand on the table because ${leaks[0].title.toLowerCase()}.`
      : `${profile.name} has a usable dining site with room to tighten conversion.`,
    !profile.hasMenuPage
      ? "Guests cannot evaluate the menu quickly enough, which hurts both reservations and direct orders."
      : "The biggest gains likely come from making reservations, ordering, and private dining paths more obvious.",
    !profile.hasPrivateDining
      ? "Higher-margin group bookings are likely under-promoted because private dining and catering are hard to find."
      : "Search visibility can improve further with stronger local metadata and structured promotion/event data."
  ];
}

function buildImpact(audit: AuditResult): ImpactEstimate {
  const bookingLeakCount = audit.leaks.filter((leak) => leak.category === "booking_funnel").length;
  const fillRateLeakCount = audit.leaks.filter((leak) => leak.category === "fill_rate").length;
  const inquiryLow = Math.max(2, bookingLeakCount + (audit.venue.hasReservations ? 0 : 2));
  const inquiryHigh = inquiryLow + 3;
  const eventsLow = Math.max(1, fillRateLeakCount + (audit.venue.hasPrivateDining ? 0 : 1));
  const eventsHigh = eventsLow + 2;

  return {
    inquiriesPerMonth: `${inquiryLow}-${inquiryHigh} additional reservations, catering, or direct-order inquiries/month`,
    eventsPerMonth: `${eventsLow}-${eventsHigh} additional private dining or slow-night fill opportunities/month`,
    assumptions: [
      "Ranges assume the restaurant already gets direct search, map, or social traffic but leaks guests before booking.",
      "Reservation lift increases when reservations, menu access, and ordering are visible above the fold.",
      "Private-dining lift assumes a clear group-booking path and events/promotions calendar help monetize slower nights."
    ]
  };
}

function buildPricing(): AnalysisResult["pricing"] {
  return [
    {
      label: "Performance-based",
      details: "10% of incremental direct-booking and direct-order revenue for 60 days, measured against the prior 60-day baseline with tagged booking and ordering links."
    },
    {
      label: "Flat setup + monthly",
      details: "$1,200 setup + $299/mo for reservations funnel fixes, private dining pages, SEO updates, and monthly optimization."
    }
  ];
}

function buildOutreach(audit: AuditResult, analysis: AnalysisResult, build: BuildResult): OutreachDraft {
  const observations = [
    audit.topLeaks[0] ? `I noticed ${audit.topLeaks[0].title.toLowerCase()} on ${audit.venue.finalUrl}.` : undefined,
    audit.topLeaks[1] ? `I also saw ${audit.topLeaks[1].title.toLowerCase()}, which likely costs reservations or direct orders.` : undefined
  ].filter(Boolean) as string[];

  const assetList = build.fixAssets.slice(0, 3).map((asset) => asset.type).join(", ");
  const subject = `A few direct-booking fixes I already mocked up for ${audit.venue.name}`;
  const email = [
    "",
    `Hi ${audit.venue.name} team,`,
    "",
    `I ran a public-site audit on ${audit.venue.finalUrl} and found a few concrete wins around reservations, private dining, and direct orders.`,
    ...observations,
    "",
    `I already built a Fix Pack for you: ${assetList}.`,
    `The likely upside is ${analysis.impact.inquiriesPerMonth} plus ${analysis.impact.eventsPerMonth}.`,
    "",
    "Two ways to work together:",
    `1. ${analysis.pricing[0].label}: ${analysis.pricing[0].details}`,
    `2. ${analysis.pricing[1].label}: ${analysis.pricing[1].details}`,
    "",
    "If helpful, I can send the reservation/private dining page link and a screenshot so you can review it quickly.",
    "",
    "Want me to send the page link and a screenshot?",
    "",
    "If you'd prefer not to hear from me again, reply with unsubscribe."
  ].join("\n");

  const dm = [
    `Ran a quick audit on ${audit.venue.name} and spotted ${audit.topLeaks[0]?.title.toLowerCase() ?? "a few reservation leaks"}.`,
    `I already mocked up ${assetList}.`,
    "Want me to send the page link and a screenshot?"
  ].join(" ");

  return {
    subject,
    email,
    emailHtml: email.split("\n").map((line) => line.length > 0 ? `<p>${line}</p>` : "<br>").join(""),
    dm
  };
}

export const restaurantAdapter: VerticalAdapter = {
  id: "restaurant",
  label: "Restaurant",
  defaultCategory: "restaurant",
  scoutKeywords: ["restaurant", "bistro", "brunch", "cocktail bar"],
  detectLeaks,
  buildSummary,
  buildImpact,
  buildPricing: () => buildPricing(),
  buildOutreach
};

