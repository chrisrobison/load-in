# Build Dossier

## Goal

Turn the current venue audit MVP into an end-to-end autonomous local-business platform with persistent dossiers, outbound outreach, payment handling, and automated delivery.

## Current Architecture

- Node.js + TypeScript + Express server
- File-based outputs in `out/`
- Scout, Auditor, Builder, Analyst, Closer pipeline
- Dashboard with launch controls for single-business and city-wide audits
- Vertical adapters for `event_venue`, `salon`, and `restaurant`

## Target Architecture

- SQLite system of record in `data/autonomous_fixer.sqlite`
- `out/` preserved as deliverable artifact storage
- Every pipeline stage recorded in `stage_events`
- DB-backed jobs, venues, contacts, outreach threads, billing, and deliveries
- Vertical-aware scouting, auditing, fix-pack generation, and outreach copy
- SMTP outbound sending, IMAP inbox polling, Stripe Checkout, and delivery portal

## Schema Decisions

- `venues` stores canonical business identity, lifecycle state, and vertical
- `venue_profiles` stores crawl/audit snapshots
- `audit_runs` stores audit outcomes and qualification result
- `stage_events` is the append-only per-venue dossier ledger
- `contacts`, `outreach_threads`, and `outreach_messages` power outreach automation
- `offers`, `checkout_sessions`, and `deliveries` power revenue collection and handoff

## Environment Contract

Required `.env` keys are defined in `.env.example`.

Primary groups:

- app and automation thresholds
- SMTP credentials
- IMAP credentials
- Stripe credentials

## Rollout Order

1. Baseline commit
2. SQLite foundation and dossier persistence
3. DB-backed pipeline and dashboard
4. SMTP sending + IMAP polling
5. Stripe Checkout + fulfillment portal
6. End-to-end smoke testing

## Known Risks

- Venue contact discovery from public pages is heuristic
- IMAP polling quality depends on mailbox provider behavior
- Stripe flow cannot be fully validated without real credentials
- Existing sample outputs include noisy exploratory venue folders from pre-DB runs

## Milestones

- [x] Baseline MVP committed
- [x] SQLite schema and repositories
- [x] Stage-aware dossier persistence
- [x] DB-backed dashboard
- [x] SMTP outreach automation scaffolding
- [x] IMAP reply ingestion scaffolding
- [x] Stripe Checkout integration scaffolding
- [x] Delivery portal and ZIP handoff scaffolding
- [x] Vertical adapter system for venues, salons, and restaurants

## Change Log

### 2026-02-28

- Baseline MVP committed as `Initial venue fixer MVP baseline`
- Began implementation of the SQLite-backed autonomous business refactor
- Added SQLite schema, repositories, stage-event dossier persistence, and DB-backed server APIs
- Added contact resolution, qualification rules, SMTP/IMAP service scaffolding, Stripe Checkout scaffolding, and delivery packaging
- Added dossier-aware dashboard views for contacts, threads, billing, and timeline data
- Refactored the audit pipeline behind vertical adapters and added salon and restaurant support
