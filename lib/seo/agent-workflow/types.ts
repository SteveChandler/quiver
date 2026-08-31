export const SEO_DASHBOARD_VERSION = 1 as const;

export const SEO_STATUS_VALUES = [
  "covered",
  "queued",
  "refresh-needed",
  "blocked",
] as const;

export const SEO_RECOMMENDATION_SOURCE_VALUES = [
  "keyword-research",
  "gsc-decay",
  "gsc-indexing",
  "technical-audit",
  "metadata-audit",
  "vercel-analytics",
  "posthog-behavior",
  "ahrefs-audit",
  "manual",
] as const;

export const SEO_PRIORITY_VALUES = ["critical", "high", "medium", "low"] as const;

export type SeoStatus = (typeof SEO_STATUS_VALUES)[number];
export type SeoRecommendationSource =
  (typeof SEO_RECOMMENDATION_SOURCE_VALUES)[number];
export type SeoPriority = (typeof SEO_PRIORITY_VALUES)[number];

export interface SeoKeywordCluster {
  primaryKeyword: string;
  secondarySemantics: string[];
  intendedHeadings: string[];
  linkedUrls: string[];
}

export interface SeoRecommendation {
  id: string;
  createdAt: string;
  source: SeoRecommendationSource;
  priority: SeoPriority;
  canonicalPath: string;
  targetKeyword?: string;
  summary: string;
  evidence: string[];
  status: "open" | "resolved" | "dismissed";
}

export interface SeoDashboardEntry {
  id: string;
  canonicalPath: string;
  pageType: string;
  targetKeyword: string;
  status: SeoStatus;
  cluster: SeoKeywordCluster;
  recommendations: SeoRecommendation[];
}

export interface SeoProposal {
  id: string;
  createdAt: string;
  source: SeoRecommendationSource;
  priority: SeoPriority;
  targetKeyword: string;
  pageType: string;
  canonicalPath: string;
  reason: string;
  competingUrls: string[];
  status: "open" | "accepted" | "dismissed";
}

export interface SeoDashboard {
  version: typeof SEO_DASHBOARD_VERSION;
  site: string;
  updatedAt: string;
  entries: SeoDashboardEntry[];
  proposals: SeoProposal[];
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
}

export interface GscCtrWatchItem {
  canonicalPath: string;
  label: string;
  monitorUntil: string;
  reason: string;
}

export interface GscIndexingStatus {
  canonicalPath: string;
  label?: string;
  verdict?: string;
  coverageState?: string;
  indexingState?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  lastCrawlTime?: string;
  sitemap?: string[];
  referringUrls?: string[];
  error?: string;
}

export interface GscIndexingExport {
  generatedAt: string;
  watchlistPath: string;
  results: GscIndexingStatus[];
  missing?: string[];
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
}

export interface GscDeviceRow {
  device: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
}

export interface GscCountryRow {
  country: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
}

export interface GscRefreshInput {
  last7d: GscPageRow[];
  prior7d: GscPageRow[];
  last28d: GscPageRow[];
  sitemapPaths: string[];
  dataThrough?: string;
  ctrWatchlist?: GscCtrWatchItem[];
  indexing?: GscIndexingExport;
}

export interface GscExportInput extends GscRefreshInput {
  generatedAt: string;
  siteUrl: string;
  dateRanges: {
    last7d: { start: string; end: string };
    prior7d: { start: string; end: string };
    last28d: { start: string; end: string };
  };
  topQueries: GscQueryRow[];
  topPages: GscPageRow[];
  byDevice: GscDeviceRow[];
  byCountry: GscCountryRow[];
}

export interface TechnicalAuditPageInput {
  url: string;
  status: number;
  html: string;
  outgoingLinks?: Array<{ href: string; status?: number }>;
}

export interface TechnicalAuditInput {
  robotsTxt: string;
  sitemapXml: string;
  pages: TechnicalAuditPageInput[];
  unavailablePages?: Array<{ url: string; error: string }>;
}

export type SeoEnrichmentSource = "vercel" | "posthog" | "ahrefs";

export interface VercelSeoPageMetric {
  path: string;
  visits?: number;
  previousVisits?: number;
  p75LcpMs?: number;
  p75InpMs?: number;
  cls?: number;
}

export interface VercelReferrerMetric {
  referrer: string;
  visits: number;
}

export interface VercelExportInput {
  generatedAt: string;
  dateRange: { from: string; to: string };
  rawPageViews: number;
  adjustedPageViews: number;
  botPageViews: number;
  uniqueVisitors?: number;
  bounceRate?: number;
  pages: VercelSeoPageMetric[];
  referrers: VercelReferrerMetric[];
  countries: Array<{ country: string; visits: number }>;
  devices: Array<{ device: string; visits: number }>;
  missing?: string[];
}

export interface PostHogSeoPageMetric {
  path: string;
  landingSessions?: number;
  multiPageRate?: number;
  landingSignupRate?: number;
  assistedSignupRate?: number;
  topNextPaths?: Array<{ path: string; count: number }>;
  topExitPaths?: Array<{ path: string; count: number }>;
}

export interface NativeFunnelMetric {
  platform: "native-ios" | "native-android" | "unknown";
  events: Record<string, number>;
}

export interface PostHogExportInput {
  generatedAt: string;
  dateRange: { from: string; to: string };
  pages: PostHogSeoPageMetric[];
  nativeFunnels: NativeFunnelMetric[];
  missing?: string[];
}

export interface AhrefsSeoIssue {
  path: string;
  type: string;
  priority?: SeoPriority;
  summary: string;
  evidence?: string[];
}

export interface AhrefsKeywordOpportunity {
  path: string;
  keyword: string;
  volume?: number;
  difficulty?: number;
  reason?: string;
}

export interface SeoEnrichmentInput {
  source: SeoEnrichmentSource;
  pages?: Array<VercelSeoPageMetric | PostHogSeoPageMetric>;
  issues?: AhrefsSeoIssue[];
  keywordOpportunities?: AhrefsKeywordOpportunity[];
}

export interface SeoEnrichmentContext {
  gsc?: {
    last28d?: GscPageRow[];
    topPages?: GscPageRow[];
  };
  vercel?: {
    pages?: VercelSeoPageMetric[];
  };
  posthog?: {
    pages?: PostHogSeoPageMetric[];
  };
}

export interface StoreListingSnapshot {
  app: string;
  platform: "ios" | "android" | "web";
  url: string;
  title?: string;
  version?: string;
  releaseDate?: string;
  rating?: number;
  ratingCount?: number;
  priceEvidence: string[];
  keywordRanks?: Array<{
    keyword: string;
    rank: number | null;
    source: "sampled-app-store-search";
  }>;
  metadataDrift?: string[];
}

export interface StoreSnapshotInput {
  generatedAt: string;
  listings: StoreListingSnapshot[];
  competitorDeltas: CompetitorDelta[];
  missing?: string[];
}

export interface CompetitorDelta {
  source: "competitor-report";
  runId: string;
  summary: string;
}

export interface DataForSeoSerpRanking {
  keyword: string;
  location: string;
  locationCode?: number;
  languageCode: string;
  device: "desktop" | "mobile";
  depth: number;
  quiverRank: number | null;
  quiverUrl?: string;
  serpFeatures?: DataForSeoSerpFeature[];
  topCompetitors: Array<{
    domain: string;
    url?: string;
    title?: string;
    rank: number;
  }>;
}

export interface DataForSeoSerpFeature {
  type: string;
  rank?: number;
  title?: string;
  url?: string;
  domain?: string;
}

export interface DataForSeoAsoRanking {
  keyword: string;
  platform: "ios" | "android";
  location: string;
  depth: number;
  quiverRank: number | null;
  topCompetitors: Array<{
    app: string;
    appId?: string;
    rank: number;
  }>;
}

export interface DataForSeoCompetitorKeyword {
  competitor: string;
  domain: string;
  keyword: string;
  url?: string;
  rank?: number;
  searchVolume?: number;
  estimatedTraffic?: number;
}

export interface DataForSeoKeywordMetric {
  keyword: string;
  location: string;
  locationCode?: number;
  languageCode: string;
  searchVolume?: number;
  competitionLevel?: string;
  cpc?: number;
  trend?: {
    monthly?: number;
    quarterly?: number;
    yearly?: number;
  };
  intent?: {
    main?: string;
    foreign: string[];
  };
  monthlySearches?: Array<{
    year: number;
    month: number;
    searchVolume: number;
  }>;
}

export const DATAFORSEO_EXPORT_PHASE_VALUES = [
  "googleRankings",
  "keywordMetrics",
  "asoRankings",
  "competitorKeywords",
] as const;

export type DataForSeoExportPhase =
  (typeof DATAFORSEO_EXPORT_PHASE_VALUES)[number];

export type DataForSeoExportStatus = "complete" | "partial" | "timed_out";

export interface DataForSeoExportInput {
  generatedAt: string;
  googleRankings: DataForSeoSerpRanking[];
  asoRankings: DataForSeoAsoRanking[];
  competitorKeywords: DataForSeoCompetitorKeyword[];
  keywordMetrics?: DataForSeoKeywordMetric[];
  status?: DataForSeoExportStatus;
  completedPhases?: DataForSeoExportPhase[];
  failedPhases?: DataForSeoExportPhase[];
  deadlineReached?: boolean;
  watchlistMode?: "live" | "full";
  missing?: string[];
  estimatedCostUsd?: number;
}

export interface ManualBacklinkExport {
  source: string;
  path: string;
  rows: number;
  uniqueReferringDomains: number;
  sampleReferringDomains: string[];
  topTargetUrls: Array<{ url: string; links: number }>;
  spamRows?: number;
  nonSpamRows?: number;
  dofollowLinks?: number;
  topNonSpamDomains?: Array<{ domain: string; links: number; domainRating?: number }>;
  topCitationDomains?: Array<{ domain: string; links: number; domainRating?: number }>;
}

export interface BacklinkNarrativeTarget {
  target: string;
  sourceUrl?: string;
  status: string;
  nextAction?: string;
}

export interface BacklinkNarrativeReport {
  reportDate: string;
  reportPath: string;
  confirmed: BacklinkNarrativeTarget[];
  unverified: BacklinkNarrativeTarget[];
}

export interface BacklinkProxyInput {
  generatedAt: string;
  referrers: VercelReferrerMetric[];
  embedReferrers: VercelReferrerMetric[];
  outreachStatuses: Array<{ target: string; status: string }>;
  manualExports: ManualBacklinkExport[];
  narrativeTargets?: BacklinkNarrativeReport;
  missing?: string[];
}

export interface AeoCitationEngineSnapshot {
  engine: string;
  citations: number;
  pages: number;
}

export interface AeoCitationDomainSnapshot {
  domain: string;
  links: number;
  domainRating?: number;
}

export interface AeoLlmsFileSnapshot {
  path: string;
  exists: boolean;
  lines: number;
  bytes: number;
}

export interface AeoCitationBaselineSegment {
  segment: string;
  cited: number;
  total: number;
  rate: number;
}

export interface AeoCitationNarrativeBaseline {
  reportDate: string;
  reportPath: string;
  status?: string;
  overall?: AeoCitationBaselineSegment;
  segments: AeoCitationBaselineSegment[];
}

export interface AeoCitationInput {
  generatedAt: string;
  aiReferrers: VercelReferrerMetric[];
  engines: AeoCitationEngineSnapshot[];
  citationDomains: AeoCitationDomainSnapshot[];
  llmsFiles: AeoLlmsFileSnapshot[];
  narrativeBaseline?: AeoCitationNarrativeBaseline;
  missing?: string[];
}

export interface CompetitorTechnicalSurface {
  competitor: string;
  robotsStatus?: number;
  sitemapStatus?: number;
  sitemapCount?: number;
  schemaSupport?: "present" | "missing" | "unknown";
  notes: string[];
}

export interface CompetitorComparisonSignal {
  competitor: string;
  summary: string;
  url?: string;
}

export interface CompetitorIntelligenceInput {
  generatedAt: string;
  runId?: string;
  technicalSurfaces: CompetitorTechnicalSurface[];
  comparisonSignals: CompetitorComparisonSignal[];
  materialDeltas: string[];
  missing?: string[];
}

export interface SeoMetadataAuditIssue {
  path: string;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  priority: SeoPriority;
  problems: string[];
}

export interface SeoMetadataAuditInput {
  generatedAt: string;
  checkedPages: number;
  issues: SeoMetadataAuditIssue[];
  recommendations: SeoRecommendation[];
}

export const OUTREACH_ROTATION_CATEGORY_VALUES = [
  "surf-schools",
  "surf-bloggers",
  "coastal-businesses",
  "publications",
] as const;

export type OutreachRotationCategory =
  (typeof OUTREACH_ROTATION_CATEGORY_VALUES)[number];

export interface OutreachDraftCandidate {
  target: string;
  category: OutreachRotationCategory;
  website?: string;
  contact?: string;
  requiresContactResearch: boolean;
  nearestBeach?: string;
  angle?: string;
  notes?: string;
  subject: string;
  body: string;
}

export interface OutreachDigestInput {
  generatedAt: string;
  reportDate: string;
  rotationWeek: number;
  rotationCategory: OutreachRotationCategory;
  statusCounts: Record<string, number>;
  totalRows: number;
  candidates: OutreachDraftCandidate[];
  missing?: string[];
}

export type WeeklySeoSourceFreshnessStatus = "fresh" | "lagged" | "stale" | "missing";

export interface WeeklySeoSourceFreshness {
  source: string;
  observedAt?: string;
  status: WeeklySeoSourceFreshnessStatus;
  note: string;
}

export interface WeeklySeoMetricDelta {
  label: string;
  current: number;
  previous: number;
  unit: string;
}

export interface WeeklySeoComparison {
  previousAuditDate?: string;
  metrics: WeeklySeoMetricDelta[];
  missing?: string[];
}

export interface WeeklySeoReportInput {
  generatedAt: string;
  auditDate?: string;
  recommendations: SeoRecommendation[];
  gsc?: GscExportInput;
  vercel?: VercelExportInput;
  posthog?: PostHogExportInput;
  store?: StoreSnapshotInput;
  dataforseo?: DataForSeoExportInput;
  backlink?: BacklinkProxyInput;
  competitor?: CompetitorIntelligenceInput;
  aeo?: AeoCitationInput;
  outreach?: OutreachDigestInput;
  technical?: SeoRecommendation[];
  metadata?: SeoMetadataAuditInput;
  sourceFreshness?: WeeklySeoSourceFreshness[];
  weekOverWeek?: WeeklySeoComparison;
  missing: string[];
}

export type WeeklyActionSource = "seo" | "aso" | "competitor" | "aeo";

export type WeeklyActionCategory =
  | "content-refresh"
  | "ctr-improvement"
  | "internal-linking"
  | "listing-copy"
  | "pricing-verification"
  | "competitor-monitoring"
  | "comparison-response"
  | "citation-readiness"
  | "technical-fix";

export type WeeklyActionConfidence = "high" | "medium";

export interface WeeklyActionItem {
  source: WeeklyActionSource;
  category: WeeklyActionCategory;
  priority: Extract<SeoPriority, "critical" | "high" | "medium">;
  title: string;
  ownerSurface: string;
  nextStep: string;
  evidence: string[];
  confidence: WeeklyActionConfidence;
  whyNow: string;
}

export interface SeoDraftRequest {
  slug: string;
  title: string;
  targetKeyword: string;
  pageType: string;
  competingInternalUrls: string[];
  citations: Array<{ label: string; url: string }>;
  requiredInternalLinks: string[];
}
