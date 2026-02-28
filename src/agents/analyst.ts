import type { AnalysisResult, AuditResult } from "../types.js";

export class Analyst {
  run(audit: AuditResult): AnalysisResult {
    const bookingLeakCount = audit.leaks.filter((leak) => leak.category === "booking_funnel").length;
    const fillRateLeakCount = audit.leaks.filter((leak) => leak.category === "fill_rate").length;
    const contactFriction = audit.venue.hasForm ? 0 : 1;
    const inquiryLow = Math.max(1, bookingLeakCount + contactFriction);
    const inquiryHigh = inquiryLow + 2 + Math.round(audit.score < 60 ? 2 : 1);
    const eventsLow = Math.max(1, fillRateLeakCount);
    const eventsHigh = eventsLow + (audit.venue.hasUpcomingEvents ? 1 : 2);

    return {
      impact: {
        inquiriesPerMonth: `${inquiryLow}-${inquiryHigh} additional qualified inquiries/month`,
        eventsPerMonth: `${eventsLow}-${eventsHigh} additional events/month`,
        assumptions: [
          "Ranges assume the venue currently gets meaningful direct traffic but lacks one or more conversion-critical paths.",
          "Inquiry uplift increases when a visible booking CTA and a low-friction form replace phone-only or buried contact flows.",
          "Event uplift assumes promoter intake plus a visible upcoming-events surface help fill underbooked nights."
        ]
      },
      pricing: [
        {
          label: "Performance-based",
          details: "12% of incremental booking revenue for the first 90 days, measured against a 60-day pre-launch baseline and tagged inquiry sources."
        },
        {
          label: "Flat setup + monthly",
          details: "$1,500 setup + $350/mo for hosting, optimization, reporting, and monthly fix iterations."
        }
      ]
    };
  }
}
