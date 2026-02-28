import path from "node:path";
import type { AnalysisResult, AuditResult, BuildResult, GeneratedAsset } from "../types.js";
import { ensureDir, writeJson, writeText } from "../utils/fs.js";

export class Builder {
  async run(audit: AuditResult, analysis: AnalysisResult): Promise<BuildResult> {
    const outputDir = path.resolve(process.cwd(), "out", audit.venue.slug);
    const fixDir = path.join(outputDir, "fix");
    await ensureDir(fixDir);

    const fixAssets: GeneratedAsset[] = [];

    const bookingPagePath = path.join(fixDir, "booking_page.html");
    await writeText(bookingPagePath, this.renderBookingPage(audit));
    fixAssets.push({
      type: "booking inquiry landing page",
      path: bookingPagePath,
      description: "Standalone booking page with a request-a-date CTA and inquiry form."
    });

    const artistSubmissionPath = path.join(fixDir, "artist_submission.html");
    await writeText(artistSubmissionPath, this.renderArtistSubmissionPage(audit));
    fixAssets.push({
      type: "artist submission intake form",
      path: artistSubmissionPath,
      description: "Promoter and artist intake form for filling open nights."
    });

    const eventSchemaPath = path.join(fixDir, "event_schema.json");
    await writeJson(eventSchemaPath, this.buildEventSchema(audit));
    fixAssets.push({
      type: "event schema snippet",
      path: eventSchemaPath,
      description: "JSON-LD event schema or a reusable template."
    });

    const seoPath = path.join(fixDir, "seo_suggestions.json");
    await writeJson(seoPath, this.buildSeoBundle(audit));
    fixAssets.push({
      type: "SEO quick-fix bundle",
      path: seoPath,
      description: "Suggested title, meta description, H1, and OpenGraph tags."
    });

    const outreachListPath = path.join(fixDir, "fill_the_night_outreach_list.json");
    await writeJson(outreachListPath, this.buildOutreachList(audit));
    fixAssets.push({
      type: "fill-the-night outreach list",
      path: outreachListPath,
      description: "Stub list of local promoter and artist targets inferred from genre signals."
    });

    const reportPath = path.join(outputDir, "report.md");
    await writeText(reportPath, this.renderReport(audit, analysis, fixAssets));

    return {
      outputDir,
      fixAssets,
      reportPath
    };
  }

  private renderBookingPage(audit: AuditResult): string {
    const location = audit.venue.address ?? audit.venue.city ?? "Event venue";
    const capacity = audit.venue.rawTextSample.match(/\b\d{2,4}\s*(cap|capacity|people|guests)\b/i)?.[0] ?? "Capacity available on request";

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Book ${audit.venue.name}</title>
  <style>
    :root { color-scheme: light; --bg:#f7f1e8; --ink:#182028; --accent:#bb4d00; --card:#fffdf9; --muted:#685f56; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, serif; background: radial-gradient(circle at top, #fff7e8 0, var(--bg) 55%, #efe2d0 100%); color: var(--ink); }
    .wrap { max-width: 980px; margin: 0 auto; padding: 48px 20px 72px; }
    .hero, .card { background: rgba(255,253,249,0.88); border: 1px solid rgba(24,32,40,0.1); border-radius: 24px; box-shadow: 0 16px 40px rgba(24,32,40,0.08); }
    .hero { padding: 36px; margin-bottom: 24px; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; color: var(--accent); font: 600 12px/1.2 Arial, sans-serif; }
    h1 { font-size: clamp(2.4rem, 6vw, 4.6rem); line-height: 0.95; margin: 12px 0 16px; }
    p { font-size: 1.05rem; line-height: 1.6; }
    .meta { display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 16px; margin-top: 28px; }
    .meta div { padding: 16px; background: var(--card); border-radius: 18px; }
    .cta { display:inline-block; margin-top: 20px; background: var(--accent); color:#fff; text-decoration:none; padding: 14px 18px; border-radius: 999px; font: 600 15px/1 Arial, sans-serif; }
    .card { padding: 28px; }
    form { display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 14px; }
    label { display:flex; flex-direction:column; gap:6px; font: 600 14px/1.3 Arial, sans-serif; }
    input, select, textarea { width:100%; padding:12px 13px; border-radius:12px; border:1px solid rgba(24,32,40,0.14); font: 16px/1.4 Arial, sans-serif; background:#fff; }
    textarea { min-height:120px; grid-column:1/-1; }
    .full { grid-column:1/-1; }
    button { border:0; border-radius:999px; background:var(--ink); color:#fff; padding:14px 18px; font:600 15px/1 Arial, sans-serif; cursor:pointer; }
    .stub { color: var(--muted); font-size: 0.95rem; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">Private Events + Venue Rentals</div>
      <h1>Book ${audit.venue.name}</h1>
      <p>Fast path for planners, promoters, and private-event clients who want real answers quickly. This page gives ${audit.venue.name} a clear booking CTA instead of leaving inquiries to chance.</p>
      <a class="cta" href="#request-date">Request a date</a>
      <div class="meta">
        <div><strong>Location</strong><br>${location}</div>
        <div><strong>Capacity</strong><br>${capacity}</div>
        <div><strong>Best for</strong><br>Concerts, private events, release parties, branded activations</div>
      </div>
    </section>
    <section class="card" id="request-date">
      <h2>Request a date</h2>
      <form method="post" action="https://example.com/venue-inquiry">
        <label>Name<input name="name" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Phone<input name="phone"></label>
        <label>Event type
          <select name="eventType">
            <option>Private event</option>
            <option>Concert</option>
            <option>Corporate event</option>
            <option>Birthday / celebration</option>
            <option>Brand activation</option>
          </select>
        </label>
        <label>Preferred dates<input name="dates" placeholder="May 12-14 or flexible"></label>
        <label>Expected attendance<input name="attendance" placeholder="120"></label>
        <label class="full">Notes<textarea name="notes" placeholder="Timeline, AV needs, ticketing, bar package, special requests"></textarea></label>
        <div class="full"><button type="submit">Send inquiry</button></div>
      </form>
      <p class="stub">Stub endpoint in MVP. Replace the form action with your CRM, Zapier, Airtable, or email webhook.</p>
    </section>
  </div>
</body>
</html>`;
  }

  private renderArtistSubmissionPage(audit: AuditResult): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${audit.venue.name} Artist Submission</title>
  <style>
    :root { --bg:#0e1a21; --panel:#13252f; --ink:#eff7fb; --muted:#9cb4c0; --accent:#c9ff45; }
    * { box-sizing:border-box; }
    body { margin:0; font-family: "Trebuchet MS", sans-serif; background: linear-gradient(135deg, #081217, #12212b 55%, #1a3140); color:var(--ink); }
    .wrap { max-width:900px; margin:0 auto; padding:40px 20px 72px; }
    .panel { background:rgba(19,37,47,.92); border:1px solid rgba(255,255,255,.08); border-radius:24px; padding:28px; box-shadow:0 18px 50px rgba(0,0,0,.28); }
    h1 { font-size: clamp(2rem, 5vw, 4rem); margin:0 0 14px; }
    p { color:var(--muted); line-height:1.6; }
    form { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin-top:24px; }
    label { display:flex; flex-direction:column; gap:6px; font-size:14px; font-weight:700; }
    input, select, textarea { border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:12px 14px; font:16px/1.4 inherit; color:var(--ink); background:#0b161c; }
    textarea { min-height:140px; grid-column:1/-1; }
    .full { grid-column:1/-1; }
    button { background:var(--accent); color:#081217; border:0; border-radius:999px; padding:14px 18px; font-size:15px; font-weight:800; cursor:pointer; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <h1>${audit.venue.name} promoter intake</h1>
      <p>Use this page to capture artist and promoter opportunities before they disappear into DMs. It creates a consistent pipeline for filling weak nights.</p>
      <form method="post" action="https://example.com/artist-submission">
        <label>Artist / promoter name<input name="name" required></label>
        <label>Contact email<input name="email" type="email" required></label>
        <label>Genre
          <select name="genre">
            ${audit.venue.genres.map((genre) => `<option>${genre}</option>`).join("")}
          </select>
        </label>
        <label>Preferred date range<input name="dateRange" placeholder="June to August"></label>
        <label>Expected draw<input name="draw" placeholder="150 paid"></label>
        <label>Links<input name="links" placeholder="Spotify, Instagram, ticket history"></label>
        <label class="full">Pitch<textarea name="notes" placeholder="Lineup, routing, local support, merch expectations"></textarea></label>
        <div class="full"><button type="submit">Submit for review</button></div>
      </form>
    </div>
  </div>
</body>
</html>`;
  }

  private buildEventSchema(audit: AuditResult): unknown {
    const event = audit.venue.eventCandidates[0];
    if (!event) {
      return {
        instructions: "No reliable event listing was detected, so this is a template. Replace placeholder values and embed on event pages as JSON-LD.",
        "@context": "https://schema.org",
        "@type": "Event",
        name: "Sample Event Name",
        startDate: "2026-06-01T20:00:00-07:00",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: {
          "@type": "Place",
          name: audit.venue.name,
          address: audit.venue.address ?? "Venue address"
        },
        offers: {
          "@type": "Offer",
          url: `${audit.venue.finalUrl}`,
          availability: "https://schema.org/InStock"
        }
      };
    }

    return {
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.title || "Upcoming Event",
      startDate: event.dateText,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: {
        "@type": "Place",
        name: audit.venue.name,
        address: audit.venue.address ?? audit.venue.city ?? "Venue location"
      },
      organizer: {
        "@type": "Organization",
        name: audit.venue.name,
        url: audit.venue.finalUrl
      },
      offers: {
        "@type": "Offer",
        url: event.link ? new URL(event.link, audit.venue.finalUrl).toString() : audit.venue.finalUrl,
        availability: "https://schema.org/InStock"
      }
    };
  }

  private buildSeoBundle(audit: AuditResult): unknown {
    const city = audit.venue.city ?? "your city";
    return {
      title: `${audit.venue.name} | Live Music, Private Events, and Venue Rental in ${city}`,
      metaDescription: `${audit.venue.name} hosts live shows, private events, and special rentals in ${city}. Book a date, see upcoming events, and contact the venue team fast.`,
      h1: `${audit.venue.name}: book shows, private events, and special nights`,
      og: {
        "og:title": `${audit.venue.name} in ${city}`,
        "og:description": `Upcoming shows, private event rentals, and booking inquiries for ${audit.venue.name}.`,
        "og:type": "website",
        "og:url": audit.venue.finalUrl
      }
    };
  }

  private buildOutreachList(audit: AuditResult): unknown {
    const genres = audit.venue.genres.slice(0, 5);
    const entries = Array.from({ length: 10 }, (_, index) => {
      const genre = genres[index % genres.length];
      return {
        name: `${genre.toUpperCase()} lead ${index + 1}`,
        type: index % 2 === 0 ? "band" : "promoter",
        fitReason: `Genre inferred from site text: ${genre}.`,
        contactStub: `research-${genre.replace(/\s+/g, "-")}-${index + 1}@example.com`
      };
    });

    return {
      note: "Stub outreach list for MVP. Replace with local booking research or API-backed enrichment.",
      entries
    };
  }

  private renderReport(audit: AuditResult, analysis: AnalysisResult, assets: GeneratedAsset[]): string {
    const topLeaks = audit.topLeaks.map((leak, index) => {
      return `## ${index + 1}. ${leak.title}

Why it matters: ${leak.whyItMatters}

Fix: ${leak.fix}
`;
    }).join("\n");

    const fixPack = assets.map((asset) => `- ${asset.type}: ${asset.path}`).join("\n");
    const assumptions = analysis.impact.assumptions.map((item) => `- ${item}`).join("\n");

    return `# Venue Audit Report: ${audit.venue.name}

## Summary
- ${audit.summaryBullets[0]}
- ${audit.summaryBullets[1]}
- ${audit.summaryBullets[2]}

## Top Leaks (ranked)
${topLeaks}

## Generated Fix Pack
${fixPack}

## Estimated impact
- ${analysis.impact.inquiriesPerMonth}
- ${analysis.impact.eventsPerMonth}
${assumptions}

## Next steps
Approve and we deploy in 24 hours.
`;
  }
}
