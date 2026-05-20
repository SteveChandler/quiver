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
  "technical-audit",
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
  visitors?: number;
  multiPageRate?: number;
  signupRate?: number;
  relatedPathCtr?: number;
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
  competitorDeltas: string[];
  missing?: string[];
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
  topCompetitors: Array<{
    domain: string;
    url?: string;
    title?: string;
    rank: number;
  }>;
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

export interface DataForSeoExportInput {
  generatedAt: string;
  googleRankings: DataForSeoSerpRanking[];
  asoRankings: DataForSeoAsoRanking[];
  competitorKeywords: DataForSeoCompetitorKeyword[];
  missing?: string[];
  estimatedCostUsd?: number;
}

export interface BacklinkProxyInput {
  generatedAt: string;
  referrers: VercelReferrerMetric[];
  embedReferrers: VercelReferrerMetric[];
  outreachStatuses: Array<{ target: string; status: string }>;
  manualExports: Array<{ source: string; path: string; rows: number }>;
  competitorDeltas: string[];
  missing?: string[];
}

export interface WeeklySeoReportInput {
  generatedAt: string;
  recommendations: SeoRecommendation[];
  gsc?: GscExportInput;
  vercel?: VercelExportInput;
  posthog?: PostHogExportInput;
  store?: StoreSnapshotInput;
  dataforseo?: DataForSeoExportInput;
  backlink?: BacklinkProxyInput;
  technical?: SeoRecommendation[];
  missing: string[];
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
