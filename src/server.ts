import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { Pipeline } from "./pipeline.js";
import { Reconnaissance } from "./agents/reconnaissance.js";
import type { ScoutInput } from "./agents/scout.js";
import type { PipelineResult, VenueCandidate } from "./types.js";

interface DashboardVenueSummary {
  slug: string;
  name: string;
  score: number;
  topLeaks: string[];
}

interface JobRecord {
  id: string;
  kind: "reconnaissance" | "audit";
  label: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  input: ScoutInput;
  error?: string;
  result?: {
    candidateCount?: number;
    candidates?: VenueCandidate[];
    venues?: DashboardVenueSummary[];
  };
}

const jobs = new Map<string, JobRecord>();

async function listVenueDirectories(outDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(outDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function readAuditSummary(outDir: string, slug: string): Promise<DashboardVenueSummary | null> {
  try {
    const raw = await fs.readFile(path.join(outDir, slug, "audit.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      audit: {
        venue: { name: string; slug: string; finalUrl?: string; url?: string };
        score: number;
        topLeaks: Array<{ title: string }>;
      };
    };
    const name = parsed.audit.venue.name;
    const lowerName = name.toLowerCase();
    const hostLike = (parsed.audit.venue.finalUrl ?? parsed.audit.venue.url ?? "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(".")[0]
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    if (["redirecting", "redirecting…", "upcoming shows", "san francisco", "san francisco, ca"].includes(lowerName) || name.length > 60) {
      return null;
    }
    if (!name.includes(" ") && lowerName.replace(/[^a-z0-9]/g, "") === hostLike) {
      return null;
    }

    return {
      slug: parsed.audit.venue.slug,
      name,
      score: parsed.audit.score,
      topLeaks: parsed.audit.topLeaks.slice(0, 3).map((leak) => leak.title)
    };
  } catch {
    return null;
  }
}

async function readVenueSummaries(outDir: string): Promise<DashboardVenueSummary[]> {
  const slugs = await listVenueDirectories(outDir);
  const items = (await Promise.all(slugs.map((slug) => readAuditSummary(outDir, slug)))).filter(Boolean) as DashboardVenueSummary[];
  return items.sort((left, right) => left.name.localeCompare(right.name));
}

function createJob(kind: JobRecord["kind"], label: string, input: ScoutInput): JobRecord {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const record: JobRecord = {
    id,
    kind,
    label,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input
  };
  jobs.set(id, record);
  return record;
}

function updateJob(id: string, patch: Partial<JobRecord>): void {
  const existing = jobs.get(id);
  if (!existing) {
    return;
  }
  jobs.set(id, {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

function normalizeLaunchInput(body: Record<string, unknown>): ScoutInput {
  const asString = (value: unknown): string | undefined => {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  };
  const limitValue = Number(body.limit);
  return {
    url: asString(body.url),
    name: asString(body.name),
    city: asString(body.city),
    category: asString(body.category),
    limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined
  };
}

async function main(): Promise<void> {
  const app = express();
  const outDir = path.resolve(process.cwd(), "out");
  const publicDir = path.resolve(process.cwd(), "public");
  const pipeline = new Pipeline();
  const reconnaissance = new Reconnaissance();

  app.use(express.json());
  app.use("/files", express.static(outDir));
  app.use(express.static(publicDir));

  app.get("/api/venues", async (_req, res) => {
    res.json(await readVenueSummaries(outDir));
  });

  app.get("/api/venues/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const [auditJson, report, email, dm] = await Promise.all([
        fs.readFile(path.join(outDir, slug, "audit.json"), "utf8"),
        fs.readFile(path.join(outDir, slug, "report.md"), "utf8"),
        fs.readFile(path.join(outDir, slug, "outreach_email.txt"), "utf8"),
        fs.readFile(path.join(outDir, slug, "outreach_dm.txt"), "utf8")
      ]);
      const parsed = JSON.parse(auditJson);
      const fixDir = path.join(outDir, slug, "fix");
      const fixFiles = await fs.readdir(fixDir);

      res.json({
        ...parsed,
        report,
        outreach: { email, dm },
        fixFiles: fixFiles.map((file) => ({
          name: file,
          url: `/files/${slug}/fix/${file}`
        }))
      });
    } catch {
      res.status(404).json({ error: "Venue not found" });
    }
  });

  app.post("/api/reconnaissance", async (req, res) => {
    const input = normalizeLaunchInput(req.body as Record<string, unknown>);
    if (!input.city || !input.category) {
      res.status(400).json({ error: "Provide city and category for reconnaissance." });
      return;
    }

    try {
      const candidates = await reconnaissance.run({ city: input.city, category: input.category, limit: input.limit ?? 8 });
      res.json({ candidates, count: candidates.length });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Reconnaissance failed" });
    }
  });

  app.get("/api/jobs", (_req, res) => {
    const items = Array.from(jobs.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    res.json(items);
  });

  app.get("/api/jobs/:id", (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(job);
  });

  app.post("/api/audits", async (req, res) => {
    const input = normalizeLaunchInput(req.body as Record<string, unknown>);
    const hasSingleVenueInput = Boolean(input.url || input.name);
    const hasBatchInput = Boolean(input.city && input.category);
    if (!hasSingleVenueInput && !hasBatchInput) {
      res.status(400).json({ error: "Provide a venue url/name or a city + category." });
      return;
    }

    const label = hasBatchInput
      ? `City audit: ${input.city} ${input.category ?? ""}`.trim()
      : `Venue audit: ${input.name ?? input.url}`;
    const job = createJob("audit", label, input);
    res.status(202).json(job);

    void (async () => {
      updateJob(job.id, { status: "running" });
      try {
        let candidates: VenueCandidate[] | undefined;
        if (hasBatchInput) {
          candidates = await reconnaissance.run({ city: input.city, category: input.category, limit: input.limit ?? 8 });
          updateJob(job.id, {
            status: "running",
            result: {
              candidateCount: candidates.length,
              candidates
            }
          });
        }

        const results = await pipeline.run({
          url: input.url,
          name: input.name,
          city: input.city,
          category: input.category,
          limit: input.limit ?? 8
        });

        const summaries = await readVenueSummaries(outDir);
        const created = selectJobVenues(results, summaries);
        updateJob(job.id, {
          status: "completed",
          result: {
            candidateCount: candidates?.length ?? results.length,
            candidates,
            venues: created
          }
        });
      } catch (error) {
        updateJob(job.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Audit failed"
        });
      }
    })();
  });

  const port = 3030;
  app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
  });
}

function selectJobVenues(results: PipelineResult[], summaries: DashboardVenueSummary[]): DashboardVenueSummary[] {
  const slugs = new Set(results.map((result) => result.audit.venue.slug));
  return summaries.filter((summary) => slugs.has(summary.slug));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
