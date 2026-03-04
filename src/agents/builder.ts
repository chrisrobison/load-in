import path from "node:path";
import type { AnalysisResult, AuditResult, BuildResult, GeneratedAsset } from "../types.js";
import { ensureDir, writeJson, writeText } from "../utils/fs.js";

export class Builder {
  async run(audit: AuditResult, analysis: AnalysisResult): Promise<BuildResult> {
    const outputDir = path.resolve(process.cwd(), "out", audit.venue.slug);
    const fixDir = path.join(outputDir, "fix");
    await ensureDir(fixDir);

    const fixAssets = await this.buildAssetsByVertical(fixDir, audit);
    const reportPath = path.join(outputDir, "report.md");
    await writeText(reportPath, this.renderReport(audit, analysis, fixAssets));

    return {
      outputDir,
      fixAssets,
      reportPath
    };
  }

  private async buildAssetsByVertical(fixDir: string, audit: AuditResult): Promise<GeneratedAsset[]> {
    switch (audit.venue.vertical) {
      case "salon":
        return this.buildSalonAssets(fixDir, audit);
      case "restaurant":
        return this.buildRestaurantAssets(fixDir, audit);
      case "event_venue":
      default:
        return this.buildVenueAssets(fixDir, audit);
    }
  }

  private async buildVenueAssets(fixDir: string, audit: AuditResult): Promise<GeneratedAsset[]> {
    const assets: GeneratedAsset[] = [];

    const bookingPagePath = path.join(fixDir, "booking_page.html");
    await writeText(bookingPagePath, this.renderVenueBookingPage(audit));
    assets.push({
      type: "booking inquiry landing page",
      path: bookingPagePath,
      description: "Standalone booking page with a request-a-date CTA and inquiry form."
    });

    const artistSubmissionPath = path.join(fixDir, "artist_submission.html");
    await writeText(artistSubmissionPath, this.renderArtistSubmissionPage(audit));
    assets.push({
      type: "artist submission intake form",
      path: artistSubmissionPath,
      description: "Promoter and artist intake form for filling open nights."
    });

    const eventSchemaPath = path.join(fixDir, "event_schema.json");
    await writeJson(eventSchemaPath, this.buildVenueEventSchema(audit));
    assets.push({
      type: "event schema snippet",
      path: eventSchemaPath,
      description: "JSON-LD event schema or a reusable template."
    });

    const seoPath = path.join(fixDir, "seo_suggestions.json");
    await writeJson(seoPath, this.buildVenueSeoBundle(audit));
    assets.push({
      type: "SEO quick-fix bundle",
      path: seoPath,
      description: "Suggested title, meta description, H1, and OpenGraph tags."
    });

    const outreachListPath = path.join(fixDir, "fill_the_night_outreach_list.json");
    await writeJson(outreachListPath, this.buildVenueOutreachList(audit));
    assets.push({
      type: "fill-the-night outreach list",
      path: outreachListPath,
      description: "Stub list of local promoter and artist targets inferred from genre signals."
    });

    return assets;
  }

  private async buildSalonAssets(fixDir: string, audit: AuditResult): Promise<GeneratedAsset[]> {
    const assets: GeneratedAsset[] = [];

    const bookingPagePath = path.join(fixDir, "booking_page.html");
    await writeText(bookingPagePath, this.renderSalonBookingPage(audit));
    assets.push({
      type: "client booking landing page",
      path: bookingPagePath,
      description: "Standalone booking page with clear service and consultation CTAs."
    });

    const consultationPath = path.join(fixDir, "consultation_form.html");
    await writeText(consultationPath, this.renderSalonConsultationPage(audit));
    assets.push({
      type: "consultation intake form",
      path: consultationPath,
      description: "Intake form for color correction, bridal, extensions, and higher-value services."
    });

    const seoPath = path.join(fixDir, "seo_suggestions.json");
    await writeJson(seoPath, this.buildSalonSeoBundle(audit));
    assets.push({
      type: "SEO quick-fix bundle",
      path: seoPath,
      description: "Suggested title, meta description, H1, and OpenGraph tags for local search."
    });

    const schemaPath = path.join(fixDir, "offer_schema.json");
    await writeJson(schemaPath, this.buildSalonOfferSchema(audit));
    assets.push({
      type: "offer schema template",
      path: schemaPath,
      description: "Template structured data for special offers, bridal consults, or seasonal promos."
    });

    return assets;
  }

  private async buildRestaurantAssets(fixDir: string, audit: AuditResult): Promise<GeneratedAsset[]> {
    const assets: GeneratedAsset[] = [];

    const reservationPagePath = path.join(fixDir, "booking_page.html");
    await writeText(reservationPagePath, this.renderRestaurantReservationPage(audit));
    assets.push({
      type: "reservation landing page",
      path: reservationPagePath,
      description: "Direct reservation page with reservation, order, and group dining CTAs."
    });

    const privateDiningPath = path.join(fixDir, "private_dining.html");
    await writeText(privateDiningPath, this.renderRestaurantPrivateDiningPage(audit));
    assets.push({
      type: "private dining inquiry page",
      path: privateDiningPath,
      description: "Inquiry flow for private dining, catering, and large-party bookings."
    });

    const seoPath = path.join(fixDir, "seo_suggestions.json");
    await writeJson(seoPath, this.buildRestaurantSeoBundle(audit));
    assets.push({
      type: "SEO quick-fix bundle",
      path: seoPath,
      description: "Suggested title, meta description, H1, and OpenGraph tags for reservations and menu intent."
    });

    const schemaPath = path.join(fixDir, "event_schema.json");
    await writeJson(schemaPath, this.buildRestaurantEventSchema(audit));
    assets.push({
      type: "events/promotions schema template",
      path: schemaPath,
      description: "Structured-data snippet for tastings, brunches, happy hours, or chef dinners."
    });

    return assets;
  }

  private renderVenueBookingPage(audit: AuditResult): string {
    const location = audit.venue.address ?? audit.venue.city ?? "Event venue";
    const capacity = audit.venue.rawTextSample.match(/\b\d{2,4}\s*(cap|capacity|people|guests)\b/i)?.[0] ?? "Capacity available on request";

    return this.renderSplitLayout({
      title: `Book ${audit.venue.name}`,
      eyebrow: "Private Events + Venue Rentals",
      intro: `Fast path for planners, promoters, and private-event clients who want real answers quickly. This page gives ${audit.venue.name} a clear booking CTA instead of leaving inquiries to chance.`,
      ctaLabel: "Request a date",
      facts: [
        { label: "Location", value: location },
        { label: "Capacity", value: capacity },
        { label: "Best for", value: "Concerts, private events, release parties, branded activations" }
      ],
      formAction: "https://example.com/venue-inquiry",
      formTitle: "Request a date",
      fields: `
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
      `
    });
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

  private buildVenueEventSchema(audit: AuditResult): unknown {
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

  private buildVenueSeoBundle(audit: AuditResult): unknown {
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

  private buildVenueOutreachList(audit: AuditResult): unknown {
    const genres = audit.venue.genres.length > 0 ? audit.venue.genres.slice(0, 5) : ["punk", "indie", "metal", "edm", "comedy"];
    const entries = Array.from({ length: 10 }, (_, index) => {
      const genre = genres[index % genres.length];
      return {
        name: `${genre.toUpperCase()} lead ${index + 1}`,
        type: index % 2 === 0 ? "band" : "promoter",
        fitReason: `Genre inferred from site text: ${genre}.`,
        contactStub: `research-${genre.replace(/\s+/g, "-")}-${index + 1}@example.com`
      };
    });

    return { genres, entries };
  }

  private renderSalonBookingPage(audit: AuditResult): string {
    const services = audit.venue.keywords.filter((keyword) => /(balayage|extensions|color|cut|blowout|bridal)/i.test(keyword));
    return this.renderSplitLayout({
      title: `Book ${audit.venue.name}`,
      eyebrow: "New Client Booking + Consultation",
      intro: `${audit.venue.name} needs a no-friction path for first-time clients. This landing page makes booking, consultation, and package-service discovery immediate.`,
      ctaLabel: "Book now",
      facts: [
        { label: "Location", value: audit.venue.address ?? audit.venue.city ?? "Salon location" },
        { label: "Best-fit services", value: services.join(", ") || "Cut, color, blowout, extensions" },
        { label: "Conversion goal", value: "Book an appointment or request a consultation" }
      ],
      formAction: "https://example.com/salon-booking",
      formTitle: "Request an appointment",
      fields: `
        <label>Name<input name="name" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Phone<input name="phone"></label>
        <label>Service
          <select name="service">
            <option>Haircut</option>
            <option>Color service</option>
            <option>Balayage / highlights</option>
            <option>Extensions</option>
            <option>Bridal / event styling</option>
            <option>Consultation first</option>
          </select>
        </label>
        <label>Preferred stylist<input name="stylist" placeholder="Optional"></label>
        <label>Preferred dates<input name="dates" placeholder="Weeknights / Saturday morning"></label>
        <label class="full">Hair goals<textarea name="notes" placeholder="Current color, goals, inspiration links, timing, budget"></textarea></label>
      `
    });
  }

  private renderSalonConsultationPage(audit: AuditResult): string {
    return this.renderDarkPanelPage({
      title: `${audit.venue.name} consultation intake`,
      intro: "Use this page to capture higher-value services that need more than a basic booking widget. It gives the salon a structured way to qualify and quote premium work.",
      action: "https://example.com/salon-consultation",
      fields: `
        <label>Client name<input name="name" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Service type
          <select name="serviceType">
            <option>Color correction</option>
            <option>Balayage / blonding</option>
            <option>Extensions</option>
            <option>Bridal styling</option>
            <option>Full transformation</option>
          </select>
        </label>
        <label>Target date<input name="targetDate" placeholder="Wedding on Sept 14"></label>
        <label>Budget range<input name="budget" placeholder="$300-$600"></label>
        <label>Reference links<input name="links" placeholder="Instagram, Pinterest, current hair photos"></label>
        <label class="full">Notes<textarea name="notes" placeholder="Current history, goals, allergies, urgency"></textarea></label>
      `
    });
  }

  private buildSalonSeoBundle(audit: AuditResult): unknown {
    const city = audit.venue.city ?? "your city";
    return {
      title: `${audit.venue.name} | Hair Salon and Color Services in ${city}`,
      metaDescription: `${audit.venue.name} offers haircuts, color, blonding, extensions, and consultation-based services in ${city}. Book online or request a styling consult.`,
      h1: `${audit.venue.name}: book cuts, color, and consultation services`,
      og: {
        "og:title": `${audit.venue.name} in ${city}`,
        "og:description": "Book hair appointments, styling consultations, and premium salon services.",
        "og:type": "website",
        "og:url": audit.venue.finalUrl
      }
    };
  }

  private buildSalonOfferSchema(audit: AuditResult): unknown {
    return {
      instructions: "Adapt this Offer schema for a first-visit promotion, bridal consult, or seasonal package and embed it on the relevant landing page.",
      "@context": "https://schema.org",
      "@type": "Offer",
      name: `${audit.venue.name} first-visit consultation`,
      url: audit.venue.finalUrl,
      description: "Consultation-based salon offer with service planning and next-step booking.",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "HairSalon",
        name: audit.venue.name,
        address: audit.venue.address ?? audit.venue.city ?? "Salon address"
      }
    };
  }

  private renderRestaurantReservationPage(audit: AuditResult): string {
    return this.renderSplitLayout({
      title: `Reserve ${audit.venue.name}`,
      eyebrow: "Reservations + Direct Ordering",
      intro: `${audit.venue.name} should make it effortless for guests to reserve, order direct, or ask about private dining. This page centralizes those conversion paths.`,
      ctaLabel: "Reserve a table",
      facts: [
        { label: "Location", value: audit.venue.address ?? audit.venue.city ?? "Restaurant location" },
        { label: "Best for", value: "Dinner reservations, group dining, direct pickup, special nights" },
        { label: "Menu flow", value: audit.venue.hasMenuPage ? "Menu detected" : "Menu should be surfaced more clearly" }
      ],
      formAction: "https://example.com/reservations",
      formTitle: "Request a table",
      fields: `
        <label>Name<input name="name" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Phone<input name="phone"></label>
        <label>Party size<input name="partySize" placeholder="4" required></label>
        <label>Date<input name="date" placeholder="Friday, June 12"></label>
        <label>Time<input name="time" placeholder="7:30 pm"></label>
        <label class="full">Notes<textarea name="notes" placeholder="Birthday, dietary needs, private room, cocktail package, direct order question"></textarea></label>
      `
    });
  }

  private renderRestaurantPrivateDiningPage(audit: AuditResult): string {
    return this.renderDarkPanelPage({
      title: `${audit.venue.name} private dining intake`,
      intro: "Use this page to capture large-party, catering, and private dining demand before it leaks into phone tag. It turns high-margin group demand into a clear intake flow.",
      action: "https://example.com/private-dining",
      fields: `
        <label>Organizer name<input name="name" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Event type
          <select name="eventType">
            <option>Private dining</option>
            <option>Birthday dinner</option>
            <option>Corporate meal</option>
            <option>Catering</option>
            <option>Buyout inquiry</option>
          </select>
        </label>
        <label>Date range<input name="dateRange" placeholder="Flexible week of Oct 7"></label>
        <label>Guest count<input name="guestCount" placeholder="18"></label>
        <label>Estimated spend<input name="budget" placeholder="$1,500"></label>
        <label class="full">Notes<textarea name="notes" placeholder="Food style, drink package, AV, allergies, seating preferences"></textarea></label>
      `
    });
  }

  private buildRestaurantSeoBundle(audit: AuditResult): unknown {
    const city = audit.venue.city ?? "your city";
    return {
      title: `${audit.venue.name} | Reservations, Menu, and Private Dining in ${city}`,
      metaDescription: `${audit.venue.name} offers reservations, menu highlights, direct ordering, and private dining in ${city}. Reserve a table or inquire about group dining.`,
      h1: `${audit.venue.name}: reserve, order direct, and book private dining`,
      og: {
        "og:title": `${audit.venue.name} in ${city}`,
        "og:description": "Reservations, menu highlights, direct ordering, and private dining inquiries.",
        "og:type": "website",
        "og:url": audit.venue.finalUrl
      }
    };
  }

  private buildRestaurantEventSchema(audit: AuditResult): unknown {
    const candidate = audit.venue.eventCandidates[0];
    if (candidate) {
      return {
        "@context": "https://schema.org",
        "@type": "Event",
        name: candidate.title || `${audit.venue.name} featured night`,
        startDate: candidate.dateText,
        location: {
          "@type": "Restaurant",
          name: audit.venue.name,
          address: audit.venue.address ?? audit.venue.city ?? "Restaurant location"
        },
        offers: {
          "@type": "Offer",
          url: candidate.link ? new URL(candidate.link, audit.venue.finalUrl).toString() : audit.venue.finalUrl,
          availability: "https://schema.org/InStock"
        }
      };
    }

    return {
      instructions: "Adapt this for wine dinners, brunch events, happy hours, or chef tastings.",
      "@context": "https://schema.org",
      "@type": "Event",
      name: `${audit.venue.name} chef tasting night`,
      startDate: "2026-06-01T19:00:00-07:00",
      location: {
        "@type": "Restaurant",
        name: audit.venue.name,
        address: audit.venue.address ?? "Restaurant address"
      },
      offers: {
        "@type": "Offer",
        url: audit.venue.finalUrl,
        availability: "https://schema.org/InStock"
      }
    };
  }

  private renderReport(audit: AuditResult, analysis: AnalysisResult, fixAssets: GeneratedAsset[]): string {
    return [
      `# ${audit.venue.name} Audit Report`,
      "",
      "## Summary",
      ...audit.summaryBullets.map((bullet) => `- ${bullet}`),
      "",
      "## Top Leaks",
      ...audit.topLeaks.map((leak, index) => `${index + 1}. **${leak.title}**\nWhy it matters: ${leak.whyItMatters}\nFix: ${leak.fix}${leak.evidence ? `\nEvidence: ${leak.evidence}` : ""}`),
      "",
      "## Generated Fix Pack",
      ...fixAssets.map((asset) => `- ${asset.type}: ${asset.path}`),
      "",
      "## Estimated impact",
      `- ${analysis.impact.inquiriesPerMonth}`,
      `- ${analysis.impact.eventsPerMonth}`,
      ...analysis.impact.assumptions.map((assumption) => `- Assumption: ${assumption}`),
      "",
      "## Next steps",
      "Approve and we deploy in 24 hours."
    ].join("\n");
  }

  private renderSplitLayout(input: {
    title: string;
    eyebrow: string;
    intro: string;
    ctaLabel: string;
    facts: Array<{ label: string; value: string }>;
    formAction: string;
    formTitle: string;
    fields: string;
  }): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${input.title}</title>
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
      <div class="eyebrow">${input.eyebrow}</div>
      <h1>${input.title}</h1>
      <p>${input.intro}</p>
      <a class="cta" href="#request-date">${input.ctaLabel}</a>
      <div class="meta">
        ${input.facts.map((fact) => `<div><strong>${fact.label}</strong><br>${fact.value}</div>`).join("")}
      </div>
    </section>
    <section class="card" id="request-date">
      <h2>${input.formTitle}</h2>
      <form method="post" action="${input.formAction}">
        ${input.fields}
        <div class="full"><button type="submit">Send inquiry</button></div>
      </form>
      <p class="stub">Stub endpoint in MVP. Replace the form action with your CRM, Zapier, Airtable, or email webhook.</p>
    </section>
  </div>
</body>
</html>`;
  }

  private renderDarkPanelPage(input: { title: string; intro: string; action: string; fields: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${input.title}</title>
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
      <h1>${input.title}</h1>
      <p>${input.intro}</p>
      <form method="post" action="${input.action}">
        ${input.fields}
        <div class="full"><button type="submit">Submit for review</button></div>
      </form>
    </div>
  </div>
</body>
</html>`;
  }
}
