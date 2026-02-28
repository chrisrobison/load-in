export type LeakCategory =
  | "booking_funnel"
  | "discovery"
  | "conversion"
  | "fill_rate"
  | "revenue";

export interface VenueCandidate {
  name: string;
  url: string;
  city?: string;
  category?: string;
  source: "seed" | "search" | "direct";
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
  imageCount: number;
  totalImageBytes: number;
  estimatedPageWeight: number;
  wordCount: number;
  genres: string[];
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

export interface OutreachResult {
  email: string;
  dm: string;
}

export interface PipelineResult {
  audit: AuditResult;
  analysis: AnalysisResult;
  build: BuildResult;
  outreach: OutreachResult;
}
