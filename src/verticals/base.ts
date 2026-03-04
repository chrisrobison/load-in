import type {
  AnalysisResult,
  AuditResult,
  BuildResult,
  ImpactEstimate,
  Leak,
  OutreachDraft,
  PricingOption,
  VenueProfile,
  VerticalId
} from "../types.js";

export interface VerticalAdapter {
  id: VerticalId;
  label: string;
  defaultCategory: string;
  scoutKeywords: string[];
  detectLeaks(profile: VenueProfile): Leak[];
  buildSummary(profile: VenueProfile, leaks: Leak[]): string[];
  buildImpact(audit: AuditResult): ImpactEstimate;
  buildPricing(audit: AuditResult, impact: ImpactEstimate): PricingOption[];
  buildOutreach(audit: AuditResult, analysis: AnalysisResult, build: BuildResult): OutreachDraft;
}

