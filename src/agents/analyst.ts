import type { AnalysisResult, AuditResult } from "../types.js";
import { getVerticalAdapter } from "../verticals/index.js";

export class Analyst {
  run(audit: AuditResult): AnalysisResult {
    const adapter = getVerticalAdapter(audit.venue.vertical);
    const impact = adapter.buildImpact(audit);
    return { impact, pricing: adapter.buildPricing(audit, impact) };
  }
}
