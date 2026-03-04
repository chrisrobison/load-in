export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  canonical_url TEXT,
  city TEXT,
  category TEXT,
  vertical TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS venue_profiles (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  final_url TEXT,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  address TEXT,
  phone TEXT,
  emails_json TEXT NOT NULL,
  genres_json TEXT NOT NULL,
  event_candidates_json TEXT NOT NULL,
  raw_text_sample TEXT,
  fetch_succeeded INTEGER NOT NULL,
  profile_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_runs (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  job_id TEXT,
  score INTEGER NOT NULL,
  qualified INTEGER NOT NULL,
  qualification_reason TEXT,
  audit_json TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  report_path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS venue_leaks (
  id TEXT PRIMARY KEY,
  audit_run_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  key TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  severity INTEGER NOT NULL,
  why_it_matters TEXT NOT NULL,
  fix TEXT NOT NULL,
  evidence TEXT
);

CREATE TABLE IF NOT EXISTS generated_assets (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  audit_run_id TEXT,
  asset_type TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  role_hint TEXT,
  confidence REAL NOT NULL,
  is_primary INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stage_events (
  id TEXT PRIMARY KEY,
  venue_id TEXT,
  job_id TEXT,
  stage TEXT NOT NULL,
  event_type TEXT NOT NULL,
  decision TEXT,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_threads (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  audit_run_id TEXT,
  status TEXT NOT NULL,
  subject TEXT,
  last_message_at TEXT,
  reply_intent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  provider_message_id TEXT,
  in_reply_to TEXT,
  subject TEXT,
  body_text TEXT NOT NULL,
  body_html TEXT,
  status TEXT NOT NULL,
  classification_json TEXT,
  sent_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  thread_id TEXT,
  pricing_model TEXT NOT NULL,
  amount_cents INTEGER,
  currency TEXT NOT NULL,
  terms_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  stripe_checkout_id TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL,
  webhook_payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  audit_run_id TEXT,
  checkout_session_id TEXT,
  delivery_url TEXT,
  zip_path TEXT,
  status TEXT NOT NULL,
  sent_at TEXT,
  viewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppression_list (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  domain TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_venue_profiles_venue_id ON venue_profiles (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_runs_venue_id ON audit_runs (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_events_venue_id ON stage_events (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_venue_id ON contacts (venue_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_threads_venue_id ON outreach_threads (venue_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON outreach_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_venue_id ON offers (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkouts_venue_id ON checkout_sessions (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_venue_id ON deliveries (venue_id, created_at DESC);
`;
