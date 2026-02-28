import path from "node:path";
import { Analyst } from "./agents/analyst.js";
import { Auditor } from "./agents/auditor.js";
import { Builder } from "./agents/builder.js";
import { Closer } from "./agents/closer.js";
import { Scout, type ScoutInput } from "./agents/scout.js";
import { writeJson, writeText } from "./utils/fs.js";
import type { PipelineResult } from "./types.js";

export class Pipeline {
  private readonly scout = new Scout();
  private readonly auditor = new Auditor();
  private readonly builder = new Builder();
  private readonly analyst = new Analyst();
  private readonly closer = new Closer();

  async run(input: ScoutInput): Promise<PipelineResult[]> {
    const candidates = await this.scout.run(input);
    const results: PipelineResult[] = [];

    for (const candidate of candidates) {
      const audit = await this.auditor.run(candidate);
      const analysis = this.analyst.run(audit);
      const build = await this.builder.run(audit, analysis);
      const outreach = this.closer.run(audit, analysis, build);
      const outputDir = build.outputDir;

      await writeJson(path.join(outputDir, "audit.json"), {
        audit,
        analysis,
        build
      });
      await writeText(path.join(outputDir, "outreach_email.txt"), outreach.email);
      await writeText(path.join(outputDir, "outreach_dm.txt"), outreach.dm);

      results.push({ audit, analysis, build, outreach });
    }

    return results;
  }
}
