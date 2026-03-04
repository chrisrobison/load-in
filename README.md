# Autonomous Fixer for Local Businesses

Autonomous revenue-recovery MVP for focused local-business verticals. The current adapters cover:

- `event_venue`
- `salon`
- `restaurant`

The system scouts businesses, audits public-site revenue leaks, generates concrete fix assets, estimates impact, drafts outreach, and serves a local ops dashboard.

## Quick start

```bash
npm install
npm run migrate
npm run audit -- --url "https://www.theindependentsf.com/" --vertical event_venue
npm run audit -- --name "Spoke & Weal" --city "San Francisco" --vertical salon
npm run audit -- --name "Zuni Cafe" --city "San Francisco" --vertical restaurant
npm run dashboard
```

Open `http://localhost:3030`.

From the dashboard you can now:

- launch a single audit by business name or URL
- preview reconnaissance candidates for a city and vertical/category
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

The MVP uses a simple multi-agent pipeline plus vertical adapters:

- `Scout`: accepts `--url` or `--city` plus `--category`/`--vertical`, returns business candidates from direct input, seeds, and a best-effort public web search fallback.
- `Reconnaissance`: exposes Scout as a dedicated discovery agent for city-wide business research and dashboard previews.
- `Auditor`: fetches public HTML with a timeout and user-agent, extracts normalized signals, and applies the selected vertical adapter's leak heuristics.
- `Builder`: generates a vertical-specific fix pack into `./out/{venue_slug}/fix/`.
- `Analyst`: estimates inquiry/event uplift and pricing options with transparent assumptions.
- `Closer`: writes a personalized outreach email and DM variant from the audit and generated fixes.
- `Vertical adapters`: niche-specific discovery defaults, leak detection rules, impact assumptions, and outreach copy for venues, salons, and restaurants.
- `Dashboard`: local Express app that reads SQLite plus `./out/` and presents reports, impact, outreach, and downloadable assets.
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
│   │   ├── reconnaissance.ts
│   │   └── scout.ts
│   ├── cli.ts
│   ├── db
│   ├── lib
│   ├── pipeline.ts
│   ├── services
│   ├── server.ts
│   ├── types.ts
│   ├── verticals
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
npm run audit -- --url "https://bottomofthehill.com/" --vertical event_venue
npm run audit -- --name "Spoke & Weal" --city "San Francisco" --vertical salon
npm run audit -- --city "San Francisco" --vertical restaurant --limit 3
```

Outputs are written to `./out/{venue_slug}/`.
