# Autonomous Fixer for Event Venues

Autonomous revenue-recovery MVP for live music venues and event spaces. It scouts venues, audits public-site revenue leaks, generates concrete fix assets, estimates impact, drafts outreach, and serves a local ops dashboard.

## Quick start

```bash
npm install
npm run migrate
npm run audit -- --url "https://www.theindependentsf.com/"
npm run dashboard
```

Open `http://localhost:3030`.

From the dashboard you can now:

- launch a single audit by venue name or URL
- preview reconnaissance candidates for a city and venue category
- launch a city-wide audit batch directly from the browser
- inspect dossier timelines, contacts, outreach threads, billing, and delivery state

## Environment

Copy `.env.example` to `.env` and fill in whichever providers you want to activate.

Groups:

- automation thresholds
- SMTP sending
- IMAP reply polling
- Stripe Checkout

## Architecture

The MVP uses a simple multi-agent pipeline:

- `Scout`: accepts `--url` or `--city` + `--category`, returns venue candidates from direct input, seeds, and a best-effort public web search fallback.
- `Reconnaissance`: exposes Scout as a dedicated discovery agent for city-wide venue research and dashboard previews.
- `Auditor`: fetches public HTML with a timeout and user-agent, extracts venue signals, detects revenue leaks, and creates a normalized `VenueProfile`.
- `Builder`: generates the fix pack into `./out/{venue_slug}/fix/`.
- `Analyst`: estimates inquiry/event uplift and pricing options with transparent assumptions.
- `Closer`: writes a personalized outreach email and DM variant from the audit and generated fixes.
- `Dashboard`: local Express app that reads `./out/` and presents reports, impact, outreach, and downloadable assets.
- `SQLite backend`: `data/autonomous_fixer.sqlite` stores venues, profiles, audit runs, contacts, jobs, stage events, outreach threads, offers, checkouts, and deliveries.
- `Dossier layer`: every venue gets a DB-backed stage ledger plus `out/{venue_slug}/dossier.md`.
- `Automation services`: SMTP outreach, IMAP reply polling, Stripe Checkout, and delivery packaging/portal.

## File tree

```text
.
├── DEMO.md
├── README.md
├── package.json
├── public
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── seeds.json
├── src
│   ├── agents
│   │   ├── analyst.ts
│   │   ├── auditor.ts
│   │   ├── builder.ts
│   │   ├── closer.ts
│   │   └── scout.ts
│   ├── cli.ts
│   ├── pipeline.ts
│   ├── server.ts
│   ├── types.ts
│   └── utils
│       ├── fs.ts
│       ├── http.ts
│       └── text.ts
├── out
│   └── {venue_slug}
│       ├── audit.json
│       ├── outreach_dm.txt
│       ├── outreach_email.txt
│       ├── report.md
│       └── fix
│           ├── artist_submission.html
│           ├── booking_page.html
│           ├── event_schema.json
│           ├── fill_the_night_outreach_list.json
│           └── seo_suggestions.json
└── tsconfig.json
```

## CLI examples

```bash
npm run audit -- --city "San Francisco" --category "music venue"
npm run audit -- --url "https://bottomofthehill.com/"
npm run audit -- --name "Bottom of the Hill" --city "San Francisco"
```

Outputs are written to `./out/{venue_slug}/`.
