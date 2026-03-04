import type { VerticalAdapter } from "./base.js";
import type { AnalysisResult, AuditResult, BuildResult, ImpactEstimate, Leak, OutreachDraft, VenueProfile } from "../types.js";

function detectLeaks(profile: VenueProfile): Leak[] {
  const leaks: Leak[] = [];

  if (!profile.hasOnlineBooking) {
    leaks.push({
      key: "missing-online-booking",
      category: "booking_funnel",
      title: "No clear online booking CTA",
      severity: 18,
      whyItMatters: "Prospects comparing salons expect to book immediately. If they cannot, they often bounce to a competitor.",
      fix: "Add a primary 'Book now' CTA with service and stylist selection on the homepage and service pages.",
      evidence: "No obvious online booking language or booking provider link was detected."
    });
  }

  if (!profile.hasServiceMenu) {
    leaks.push({
      key: "missing-service-menu",
      category: "booking_funnel",
      title: "Service menu is unclear or missing",
      severity: 14,
      whyItMatters: "Clients hesitate when they cannot see services, pricing anchors, or appointment types.",
      fix: "Publish a clear services page with categories, starting prices, timing, and add-ons.",
      evidence: "No strong service-menu language or treatment breakdown was detected."
    });
  }

  if (!profile.hasForm && profile.emails.length === 0 && !profile.phone) {
    leaks.push({
      key: "missing-consult-form",
      category: "booking_funnel",
      title: "No consultation or inquiry path",
      severity: 12,
      whyItMatters: "Higher-value services like color correction or bridal styling need a structured inquiry path to convert.",
      fix: "Add a consultation page with intake fields for service type, date, hair goals, and budget.",
      evidence: "No form, public email, or phone number was detected."
    });
  }

  if (!profile.title || !profile.metaDescription) {
    leaks.push({
      key: "weak-local-seo",
      category: "discovery",
      title: "Weak local SEO metadata",
      severity: 10,
      whyItMatters: "Salon discovery depends heavily on branded search and local-intent searches around cuts, color, and extensions.",
      fix: "Write local-intent title and meta tags around services and neighborhood/city.",
      evidence: `Title present: ${Boolean(profile.title)}. Meta description present: ${Boolean(profile.metaDescription)}.`
    });
  }

  if (!profile.hasReviews) {
    leaks.push({
      key: "missing-social-proof",
      category: "discovery",
      title: "Low visible review proof",
      severity: 8,
      whyItMatters: "Salons rely on trust signals. Weak review proof lowers conversion from first-time clients.",
      fix: "Add a review section with Google review snippets and before/after proof.",
      evidence: "No strong review or testimonial language was detected."
    });
  }

  if (profile.estimatedPageWeight > 700_000 || profile.imageCount > 35) {
    leaks.push({
      key: "heavy-gallery",
      category: "conversion",
      title: "Image-heavy site likely slows booking",
      severity: 8,
      whyItMatters: "Salon sites often overuse unoptimized galleries, which hurts mobile conversion.",
      fix: "Compress gallery images, lazy-load below-the-fold media, and prioritize booking links above image grids.",
      evidence: `Estimated page weight ${Math.round(profile.estimatedPageWeight / 1024)} KB with ${profile.imageCount} images.`
    });
  }

  if (!profile.hasNewsletter) {
    leaks.push({
      key: "missing-retention-capture",
      category: "conversion",
      title: "No rebooking or promotion capture",
      severity: 7,
      whyItMatters: "Owned audience capture is useful for openings, seasonal promotions, bridal packages, and retail promos.",
      fix: "Add an email or SMS capture block with a first-visit offer or styling updates hook.",
      evidence: "No subscribe, text club, or mailing list prompt was detected."
    });
  }

  if (!profile.hasTeamPage) {
    leaks.push({
      key: "missing-stylist-proof",
      category: "fill_rate",
      title: "Stylist roster is hard to evaluate",
      severity: 9,
      whyItMatters: "Clients often choose salons based on stylist fit. Weak team pages reduce match confidence and appointment volume.",
      fix: "Add a stylist grid with specialties, booking links, and Instagram handles.",
      evidence: "No clear team, stylist, or artist roster language was detected."
    });
  }

  if (!profile.hasOnlineBooking && !profile.hasReviews) {
    leaks.push({
      key: "retail-upsell-messaging",
      category: "revenue",
      title: "Retail and package upsells are not visible",
      severity: 6,
      whyItMatters: "Color care, memberships, and bridal packages lift revenue, but only if they are surfaced during discovery.",
      fix: "Add a section for memberships, package services, and recommended retail bundles.",
      evidence: "No strong product, package, or membership messaging was detected."
    });
  }

  return leaks.sort((left, right) => right.severity - left.severity);
}

function buildSummary(profile: VenueProfile, leaks: Leak[]): string[] {
  return [
    leaks[0]
      ? `${profile.name} is losing high-intent clients because ${leaks[0].title.toLowerCase()}.`
      : `${profile.name} has a usable web presence with room to tighten conversion.`,
    !profile.hasServiceMenu
      ? "Core services are not laid out clearly enough for new clients to self-qualify before booking."
      : "The fastest gains likely come from moving more visitors into a low-friction booking or consultation flow.",
    !profile.hasReviews
      ? "Review and proof signals look thin, which matters in a trust-heavy category like salons."
      : "Local search visibility can improve further with stronger service- and city-specific SEO."
  ];
}

function buildImpact(audit: AuditResult): ImpactEstimate {
  const bookingLeakCount = audit.leaks.filter((leak) => leak.category === "booking_funnel").length;
  const conversionLeakCount = audit.leaks.filter((leak) => leak.category === "conversion").length;
  const inquiryLow = Math.max(2, bookingLeakCount + (audit.venue.hasOnlineBooking ? 0 : 2));
  const inquiryHigh = inquiryLow + 3 + conversionLeakCount;
  const eventsLow = Math.max(1, audit.venue.hasTeamPage ? 1 : 2);
  const eventsHigh = eventsLow + 2;

  return {
    inquiriesPerMonth: `${inquiryLow}-${inquiryHigh} additional bookings or consultation requests/month`,
    eventsPerMonth: `${eventsLow}-${eventsHigh} additional repeat-visit or package-service opportunities/month`,
    assumptions: [
      "Ranges assume the salon already gets local search or Instagram traffic but leaks first-time clients before booking.",
      "Booking uplift increases when services, stylist fit, and consultation paths are visible without calling first.",
      "Repeat-visit uplift assumes capture plus package or membership messaging improves rebooking cadence."
    ]
  };
}

function buildPricing(): AnalysisResult["pricing"] {
  return [
    {
      label: "Performance-based",
      details: "10% of incremental booked-service revenue for 60 days, measured against the prior 60-day baseline and tracked through tagged booking links."
    },
    {
      label: "Flat setup + monthly",
      details: "$900 setup + $249/mo for booking funnel pages, local SEO updates, offer testing, and monthly optimization."
    }
  ];
}

function buildOutreach(audit: AuditResult, analysis: AnalysisResult, build: BuildResult): OutreachDraft {
  const observations = [
    audit.topLeaks[0] ? `I noticed ${audit.topLeaks[0].title.toLowerCase()} on ${audit.venue.finalUrl}.` : undefined,
    audit.topLeaks[1] ? `I also saw ${audit.topLeaks[1].title.toLowerCase()}, which likely makes new-client conversion harder.` : undefined
  ].filter(Boolean) as string[];

  const assetList = build.fixAssets.slice(0, 3).map((asset) => asset.type).join(", ");
  const subject = `A few client-booking fixes I already mapped out for ${audit.venue.name}`;
  const email = [
    "",
    `Hi ${audit.venue.name} team,`,
    "",
    `I ran a public-site audit on ${audit.venue.finalUrl} and found a few quick wins that could lift new-client bookings.`,
    ...observations,
    "",
    `To make it concrete, I already built a Fix Pack for you: ${assetList}.`,
    `The likely upside is ${analysis.impact.inquiriesPerMonth}.`,
    "",
    "Two ways to work together:",
    `1. ${analysis.pricing[0].label}: ${analysis.pricing[0].details}`,
    `2. ${analysis.pricing[1].label}: ${analysis.pricing[1].details}`,
    "",
    "If helpful, I can send the booking page link and a screenshot so you can review it in 30 seconds.",
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

export const salonAdapter: VerticalAdapter = {
  id: "salon",
  label: "Salon",
  defaultCategory: "hair salon",
  scoutKeywords: ["hair salon", "salon", "blowout bar", "color studio"],
  detectLeaks,
  buildSummary,
  buildImpact,
  buildPricing: () => buildPricing(),
  buildOutreach
};

