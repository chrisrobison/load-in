import express from "express";
import path from "node:path";
import Stripe from "stripe";
import { getAppContext } from "./app.js";
import { Pipeline } from "./pipeline.js";
import { Reconnaissance } from "./agents/reconnaissance.js";
import type { ScoutInput, Scout } from "./agents/scout.js";
import type { JobRecord, VenueCandidate } from "./types.js";

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
  const context = getAppContext();
  const { venueRepository, jobRepository, dossierRepository, outreachRepository } = context.repositories;
  const { dossierService, inboxPoller, businessService } = context.services;
  const pipeline = new Pipeline();
  const reconnaissance = new Reconnaissance();
  const stripe = context.env.STRIPE_SECRET_KEY ? new Stripe(context.env.STRIPE_SECRET_KEY) : null;

  app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      let event: Stripe.Event | Record<string, any>;
      if (stripe && context.env.STRIPE_WEBHOOK_SECRET) {
        const signature = req.headers["stripe-signature"];
        if (!signature) {
          res.status(400).json({ error: "Missing Stripe signature" });
          return;
        }
        event = stripe.webhooks.constructEvent(req.body, signature, context.env.STRIPE_WEBHOOK_SECRET);
      } else {
        event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body));
      }

      const object = (event as any).data?.object;
      if ((event as any).type === "checkout.session.completed" && object?.id) {
        const checkout = outreachRepository.findCheckoutByStripeId(object.id);
        if (checkout) {
          outreachRepository.updateCheckout(checkout.id, {
            status: "paid",
            webhookPayloadJson: JSON.stringify(event)
          });
          const venue = venueRepository.getVenueByIdOrSlug(checkout.venueId);
          if (venue) {
            venueRepository.upsertVenue({
              slug: venue.slug,
              name: venue.name,
              canonicalUrl: venue.canonicalUrl,
              city: venue.city,
              category: venue.category,
              status: "paid"
            });
          }
          dossierRepository.append({
            venueId: checkout.venueId,
            stage: "payment_confirmed",
            eventType: "checkout_paid",
            decision: "paid",
            details: { checkoutId: checkout.id, stripeCheckoutId: object.id }
          });
          await businessService.fulfillPaidVenue(checkout.venueId, checkout.id);
        }
      }

      res.json({ received: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Webhook failed" });
    }
  });

  app.use(express.json());
  app.use("/files", express.static(outDir));
  app.use(express.static(publicDir));

  app.get("/api/venues", (_req, res) => {
    res.json(venueRepository.listVenueSummaries());
  });

  app.get("/api/venues/:id", async (req, res) => {
    const dossier = venueRepository.getVenueDossier(req.params.id);
    if (!dossier) {
      res.status(404).json({ error: "Venue not found" });
      return;
    }

    const report = dossier.latestReportPath ? await dossierService.readTextIfExists(dossier.latestReportPath) : undefined;
    const latestEmail = dossier.messages.find((message) => message.direction === "outbound" && (message.subject ?? "").toLowerCase().includes("quick revenue fixes"));
    const latestDm = await dossierService.readTextIfExists(path.resolve(process.cwd(), "out", dossier.venue.slug, "outreach_dm.txt"));
    res.json({
      venue: dossier.venue,
      profile: dossier.latestProfile,
      audit: dossier.latestAudit,
      analysis: dossier.latestAnalysis,
      qualification: dossier.latestQualification,
      report,
      outreach: {
        email: latestEmail?.bodyText,
        dm: latestDm
      },
      assets: dossier.assets.map((asset) => ({
        ...asset,
        url: asset.path.startsWith(path.resolve(process.cwd(), "out"))
          ? `/files/${path.relative(path.resolve(process.cwd(), "out"), asset.path).replaceAll(path.sep, "/")}`
          : undefined
      })),
      contacts: dossier.contacts,
      threads: dossier.threads,
      messages: dossier.messages,
      offers: dossier.offers,
      checkouts: dossier.checkouts,
      deliveries: dossier.deliveries,
      stageEvents: dossier.stageEvents.map((event) => ({
        ...event,
        details: safeParse(event.detailsJson)
      }))
    });
  });

  app.get("/api/venues/:id/dossier", (req, res) => {
    const dossier = venueRepository.getVenueDossier(req.params.id);
    if (!dossier) {
      res.status(404).json({ error: "Venue not found" });
      return;
    }
    res.json({
      venue: dossier.venue,
      stageEvents: dossier.stageEvents.map((event) => ({
        ...event,
        details: safeParse(event.detailsJson)
      }))
    });
  });

  app.post("/api/reconnaissance", async (req, res) => {
    const input = normalizeLaunchInput(req.body as Record<string, unknown>);
    if (!input.city || !input.category) {
      res.status(400).json({ error: "Provide city and category for reconnaissance." });
      return;
    }
    try {
      const candidates = await reconnaissance.run({ city: input.city, category: input.category, limit: input.limit ?? 8 });
      for (const candidate of candidates) {
        const venue = venueRepository.upsertVenue({
          slug: slugFromCandidate(candidate),
          name: candidate.name,
          canonicalUrl: candidate.url,
          city: candidate.city,
          category: candidate.category,
          status: "discovered"
        });
        dossierRepository.append({
          venueId: venue.id,
          stage: "reconnaissance",
          eventType: "candidate_found",
          decision: candidate.source,
          details: candidate
        });
      }
      res.json({ candidates, count: candidates.length });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Reconnaissance failed" });
    }
  });

  app.get("/api/jobs", (_req, res) => {
    res.json(jobRepository.list().map(deserializeJob));
  });

  app.get("/api/jobs/:id", (req, res) => {
    const job = jobRepository.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(deserializeJob(job));
  });

  app.post("/api/jobs/:id/retry", async (req, res) => {
    const job = jobRepository.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const input = safeParse<ScoutInput>(job.inputJson, {}) ?? {};
    const retry = jobRepository.create(job.kind, `${job.label} (retry)`, input);
    res.status(202).json(deserializeJob(retry));
    void runAuditJob(retry.id, input);
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
    const job = jobRepository.create("audit", label, input);
    res.status(202).json(deserializeJob(job));
    void runAuditJob(job.id, input);
  });

  app.post("/api/outreach/send", async (req, res) => {
    const threadId = typeof req.body.threadId === "string" ? req.body.threadId : undefined;
    if (!threadId) {
      res.status(400).json({ error: "threadId is required" });
      return;
    }
    try {
      await businessService.sendDraft(threadId);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Send failed" });
    }
  });

  app.get("/api/threads", (_req, res) => {
    res.json(outreachRepository.listThreads());
  });

  app.get("/api/checkouts", (_req, res) => {
    res.json(outreachRepository.listCheckouts());
  });

  app.post("/api/checkouts/:id/mark-paid", async (req, res) => {
    const checkout = outreachRepository.getCheckoutById(req.params.id);
    if (!checkout) {
      res.status(404).json({ error: "Checkout not found" });
      return;
    }
    outreachRepository.updateCheckout(checkout.id, {
      status: "paid",
      webhookPayloadJson: JSON.stringify({ source: "manual_mark_paid" })
    });
    const venue = venueRepository.getVenueByIdOrSlug(checkout.venueId);
    if (venue) {
      venueRepository.upsertVenue({
        slug: venue.slug,
        name: venue.name,
        canonicalUrl: venue.canonicalUrl,
        city: venue.city,
        category: venue.category,
        status: "paid"
      });
    }
    dossierRepository.append({
      venueId: checkout.venueId,
      stage: "payment_confirmed",
      eventType: "checkout_paid",
      decision: "manual_mark_paid",
      details: { checkoutId: checkout.id }
    });
    await businessService.fulfillPaidVenue(checkout.venueId, checkout.id);
    res.json({ ok: true });
  });

  app.post("/api/venues/:id/offers", async (req, res) => {
    const dossier = venueRepository.getVenueDossier(req.params.id);
    if (!dossier) {
      res.status(404).json({ error: "Venue not found" });
      return;
    }
    const thread = dossier.threads[0];
    if (!thread) {
      res.status(400).json({ error: "No outreach thread available for this venue" });
      return;
    }
    try {
      await businessService.createOfferAndCheckoutForThread(thread.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Offer creation failed" });
    }
  });

  app.post("/api/offers/:id/checkout", async (req, res) => {
    const offer = outreachRepository.getOfferById(req.params.id);
    if (!offer) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }
    const venue = venueRepository.getVenueByIdOrSlug(offer.venueId);
    if (!venue) {
      res.status(404).json({ error: "Venue not found for offer" });
      return;
    }
    const checkout = await context.services.billingService.createCheckout(offer, venue.name);
    const checkoutRecord = outreachRepository.createCheckout({
      venueId: offer.venueId,
      offerId: offer.id,
      stripeCheckoutId: checkout.stripeCheckoutId,
      checkoutUrl: checkout.checkoutUrl,
      status: checkout.simulated ? "simulated" : "created"
    });
    outreachRepository.updateOffer(offer.id, { status: "checkout_created" });
    res.json(checkoutRecord);
  });

  app.get("/deliveries/:deliveryId", async (req, res) => {
    const delivery = outreachRepository.getDeliveryById(req.params.deliveryId);
    const venueDossier = delivery ? venueRepository.getVenueDossier(delivery.venueId) : undefined;
    if (!venueDossier) {
      res.status(404).send("Delivery not found");
      return;
    }
    res.type("html").send(renderDeliveryPortal(venueDossier));
  });

  app.get("/deliveries/success", (_req, res) => {
    res.type("html").send("<h1>Payment received</h1><p>You can close this tab and wait for the delivery email.</p>");
  });

  inboxPoller.start();
  setInterval(() => {
    void businessService.processInterestedThreads();
  }, 30000);

  const port = 3030;
  app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
  });

  async function runAuditJob(jobId: string, input: ScoutInput): Promise<void> {
    jobRepository.update(jobId, { status: "running", result: { stage: "reconnaissance" } });
    try {
      let candidates: VenueCandidate[] | undefined;
      if (input.city && input.category) {
        candidates = await reconnaissance.run({ city: input.city, category: input.category, limit: input.limit ?? 8 });
        jobRepository.update(jobId, { status: "running", result: { stage: "audit", candidateCount: candidates.length, candidates } });
      }

      const results = await pipeline.run(input, { jobId, candidates });
      const summaries = venueRepository.listVenueSummaries();
      const created = summaries.filter((summary) => results.some((result) => result.venueId === summary.id));
      jobRepository.update(jobId, {
        status: "completed",
        result: {
          stage: "completed",
          candidateCount: candidates?.length ?? results.length,
          candidates,
          venues: created
        }
      });
    } catch (error) {
      jobRepository.update(jobId, { status: "failed", error: error instanceof Error ? error.message : "Audit failed" });
    }
  }
}

function deserializeJob(job: JobRecord) {
  return {
    ...job,
    input: safeParse(job.inputJson),
    result: safeParse(job.resultJson)
  };
}

function safeParse<T = unknown>(value?: string, fallback?: T): T | undefined {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugFromCandidate(candidate: VenueCandidate): string {
  return candidate.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function renderDeliveryPortal(dossier: ReturnType<typeof getAppContext>["repositories"]["venueRepository"] extends { getVenueDossier(...args: any[]): infer T } ? NonNullable<T> : never): string {
  const assets = dossier.assets.map((asset) => {
    const relative = asset.path.startsWith(path.resolve(process.cwd(), "out"))
      ? `/files/${path.relative(path.resolve(process.cwd(), "out"), asset.path).replaceAll(path.sep, "/")}`
      : "#";
    return `<li><a href="${relative}" target="_blank" rel="noreferrer">${asset.type}</a></li>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${dossier.venue.name} Delivery</title>
  <style>
    body { font-family: Georgia, serif; margin: 0; background: #f1e9dd; color: #1f1b18; }
    main { max-width: 960px; margin: 0 auto; padding: 40px 20px 80px; }
    section { background: rgba(255,255,255,.72); border: 1px solid rgba(0,0,0,.08); border-radius: 20px; padding: 24px; margin-bottom: 18px; }
    h1,h2 { margin-top: 0; }
    a { color: #b5481d; }
  </style>
</head>
<body>
  <main>
    <section>
      <p>Autonomous Fixer Delivery</p>
      <h1>${dossier.venue.name}</h1>
      <p>Status: ${dossier.venue.status}</p>
    </section>
    <section>
      <h2>Audit summary</h2>
      <p>Score: ${dossier.latestAudit?.score ?? "N/A"}</p>
      <ul>${(dossier.latestAudit?.topLeaks ?? []).map((leak) => `<li>${leak.title}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Fix assets</h2>
      <ul>${assets}</ul>
    </section>
    <section>
      <h2>Next steps</h2>
      <p>Approve and we deploy in 24 hours.</p>
    </section>
  </main>
</body>
</html>`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
