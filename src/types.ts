export type LeakCategory =
  | "booking_funnel"
  | "discovery"
  | "conversion"
  | "fill_rate"
  | "revenue";

export type VerticalId = "event_venue" | "salon" | "restaurant";

export type VenueStatus =
  | "discovered"
  | "audited"
  | "qualified"
  | "disqualified"
  | "contacted"
  | "replied"
  | "interested"
  | "checkout_sent"
  | "paid"
  | "fulfilled"
  | "closed_lost";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type ContactKind = "email" | "contact_form" | "phone";
export type ContactStatus = "active" | "invalid" | "suppressed";
export type OutreachThreadStatus = "drafted" | "queued" | "sent" | "replied" | "interested" | "not_now" | "unsubscribed" | "bounced" | "closed";
export type MessageDirection = "outbound" | "inbound";
export type OfferStatus = "drafted" | "checkout_created" | "sent" | "paid" | "closed";
export type DeliveryStatus = "packaged" | "sent" | "viewed" | "failed";
export type ReplyIntent = "interested" | "not_now" | "wrong_contact" | "unsubscribe" | "bounced" | "question" | "unknown";

export interface VenueCandidate {
  name: string;
  url: string;
  city?: string;
  category?: string;
  vertical?: VerticalId;
  source: "seed" | "search" | "direct";
  discoveryConfidence?: number;
  discoveryNotes?: string[];
}

export interface EventCandidate {
  title: string;
  dateText: string;
  link?: string;
}

export interface VenueProfile {
  name: string;
  slug: string;
  url: string;
  finalUrl: string;
  city?: string;
  category?: string;
  vertical: VerticalId;
  title?: string;
  metaDescription?: string;
  h1?: string;
  address?: string;
  phone?: string;
  emails: string[];
  hasForm: boolean;
  hasBookCTA: boolean;
  hasRentalInfo: boolean;
  hasCalendar: boolean;
  hasTickets: boolean;
  hasUpcomingEvents: boolean;
  hasArtistSubmission: boolean;
  hasNewsletter: boolean;
  hasEventSchema: boolean;
  hasOnlineBooking: boolean;
  hasServiceMenu: boolean;
  hasTeamPage: boolean;
  hasReviews: boolean;
  hasReservations: boolean;
  hasOrderingLink: boolean;
  hasPrivateDining: boolean;
  hasMenuPage: boolean;
  imageCount: number;
  totalImageBytes: number;
  estimatedPageWeight: number;
  wordCount: number;
  genres: string[];
  keywords: string[];
  eventCandidates: EventCandidate[];
  rawTextSample: string;
  notes: string[];
  fetchSucceeded: boolean;
}

export interface Leak {
  key: string;
  category: LeakCategory;
  title: string;
  severity: number;
  whyItMatters: string;
  fix: string;
  evidence?: string;
}

export interface AuditResult {
  venue: VenueProfile;
  score: number;
  summaryBullets: string[];
  leaks: Leak[];
  topLeaks: Leak[];
}

export interface ImpactEstimate {
  inquiriesPerMonth: string;
  eventsPerMonth: string;
  assumptions: string[];
}

export interface PricingOption {
  label: string;
  details: string;
}

export interface AnalysisResult {
  impact: ImpactEstimate;
  pricing: PricingOption[];
}

export interface GeneratedAsset {
  type: string;
  path: string;
  description: string;
}

export interface BuildResult {
  outputDir: string;
  fixAssets: GeneratedAsset[];
  reportPath: string;
}

export interface OutreachDraft {
  subject: string;
  email: string;
  emailHtml: string;
  dm: string;
}

export interface QualificationDecision {
  qualified: boolean;
  autoSendEligible: boolean;
  reason: string;
  rationale: string[];
  scoreThreshold: number;
  minLeakSeverity: number;
}

export interface ContactRecord {
  id: string;
  venueId: string;
  kind: ContactKind;
  value: string;
  source: string;
  roleHint?: string;
  confidence: number;
  isPrimary: boolean;
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StageEvent {
  id: string;
  venueId?: string;
  jobId?: string;
  stage: string;
  eventType: string;
  decision?: string;
  detailsJson: string;
  createdAt: string;
}

export interface OutreachThread {
  id: string;
  venueId: string;
  contactId: string;
  auditRunId?: string;
  status: OutreachThreadStatus;
  subject?: string;
  lastMessageAt?: string;
  replyIntent?: ReplyIntent;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachMessage {
  id: string;
  threadId: string;
  direction: MessageDirection;
  providerMessageId?: string;
  inReplyTo?: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  status: string;
  classificationJson?: string;
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
}

export interface OfferRecord {
  id: string;
  venueId: string;
  threadId?: string;
  pricingModel: string;
  amountCents?: number;
  currency: string;
  termsJson: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutRecord {
  id: string;
  venueId: string;
  offerId: string;
  stripeCheckoutId?: string;
  checkoutUrl?: string;
  status: string;
  webhookPayloadJson?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRecord {
  id: string;
  venueId: string;
  auditRunId?: string;
  checkoutSessionId?: string;
  deliveryUrl?: string;
  zipPath?: string;
  status: DeliveryStatus;
  sentAt?: string;
  viewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VenueRecord {
  id: string;
  slug: string;
  name: string;
  canonicalUrl?: string;
  city?: string;
  category?: string;
  vertical?: VerticalId;
  status: VenueStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VenueProfileRecord {
  id: string;
  venueId: string;
  sourceUrl: string;
  finalUrl?: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  address?: string;
  phone?: string;
  emailsJson: string;
  genresJson: string;
  eventCandidatesJson: string;
  rawTextSample?: string;
  fetchSucceeded: number;
  profileJson: string;
  createdAt: string;
}

export interface AuditRunRecord {
  id: string;
  venueId: string;
  jobId?: string;
  score: number;
  qualified: number;
  qualificationReason?: string;
  auditJson: string;
  analysisJson: string;
  reportPath?: string;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  kind: string;
  label: string;
  status: JobStatus;
  inputJson: string;
  resultJson?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VenueSummary {
  id: string;
  slug: string;
  name: string;
  status: VenueStatus;
  score?: number;
  city?: string;
  vertical?: VerticalId;
  topLeaks: string[];
  latestAuditRunId?: string;
}

export interface VenueDossier {
  venue: VenueRecord;
  latestProfile?: VenueProfile;
  latestAudit?: AuditResult;
  latestAnalysis?: AnalysisResult;
  latestQualification?: QualificationDecision;
  latestAuditRunId?: string;
  latestReportPath?: string;
  assets: GeneratedAsset[];
  contacts: ContactRecord[];
  threads: OutreachThread[];
  messages: OutreachMessage[];
  offers: OfferRecord[];
  checkouts: CheckoutRecord[];
  deliveries: DeliveryRecord[];
  stageEvents: StageEvent[];
}

export interface PipelineResult {
  venueId: string;
  auditRunId: string;
  jobId?: string;
  audit: AuditResult;
  analysis: AnalysisResult;
  build: BuildResult;
  outreach: OutreachDraft;
  qualification: QualificationDecision;
  contacts: ContactRecord[];
  threadId?: string;
  offerId?: string;
  deliveryId?: string;
}
