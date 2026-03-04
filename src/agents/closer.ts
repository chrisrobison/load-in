import type { AnalysisResult, AuditResult, BuildResult, OutreachDraft } from "../types.js";
import { getVerticalAdapter } from "../verticals/index.js";

export class Closer {
  run(audit: AuditResult, analysis: AnalysisResult, build: BuildResult): OutreachDraft {
    return getVerticalAdapter(audit.venue.vertical).buildOutreach(audit, analysis, build);
  }
}
