import type { AnalysisResult, AuditResult, BuildResult, OutreachResult } from "../types.js";

export class Closer {
  run(audit: AuditResult, analysis: AnalysisResult, build: BuildResult): OutreachResult {
    const observations = [
      audit.topLeaks[0] ? `I noticed ${audit.topLeaks[0].title.toLowerCase()} on ${audit.venue.finalUrl}.` : undefined,
      audit.topLeaks[1] ? `I also saw ${audit.topLeaks[1].title.toLowerCase()}, which is likely costing direct bookings.` : undefined
    ].filter(Boolean) as string[];

    const assetList = build.fixAssets.slice(0, 3).map((asset) => asset.type).join(", ");
    const email = [
      `Subject: Quick revenue fixes I already mocked up for ${audit.venue.name}`,
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
      "Want me to send the booking page link and a screenshot?"
    ].join("\n");

    const dm = [
      `Ran a quick audit on ${audit.venue.name} and spotted ${audit.topLeaks[0]?.title.toLowerCase() ?? "a few booking leaks"}.`,
      `I already mocked up ${assetList}.`,
      "Want me to send the booking page link and a screenshot?"
    ].join(" ");

    return { email, dm };
  }
}
