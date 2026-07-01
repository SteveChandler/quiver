import {
  makeSeoId,
  normalizeKeyword,
  normalizeSeoPath,
} from "./dashboard";
import type {
  GscQueryRow,
  SeoDashboard,
  SeoDashboardEntry,
  SeoPriority,
} from "./types";

export type TrendRadarSource = "gsc-query" | "manual-trends";
export type TrendRadarAction = "refresh" | "new-guide" | "module" | "ignore";

export interface ManualTrendRow {
  query: string;
  traffic?: number;
  region?: string;
  source?: "google-trends-csv" | "google-trends-rss" | "manual";
  url?: string;
}

export interface TrendRadarInput {
  generatedAt: string;
  dashboard: SeoDashboard;
  gsc?: {
    currentQueries: GscQueryRow[];
    priorQueries?: GscQueryRow[];
  };
  manualTrends?: ManualTrendRow[];
}

export interface TrendCandidate {
  id: string;
  query: string;
  normalizedQuery: string;
  action: Exclude<TrendRadarAction, "ignore">;
  canonicalPath: string;
  priority: SeoPriority;
  score: number;
  sources: TrendRadarSource[];
  relatedQueries: string[];
  evidence: string[];
}

export interface IgnoredTrendCandidate {
  query: string;
  reason: string;
  sources: TrendRadarSource[];
}

export interface TrendRadarReport {
  generatedAt: string;
  sources: {
    gscQueries: number;
    priorGscQueries: number;
    manualTrends: number;
  };
  candidates: TrendCandidate[];
  ignored: IgnoredTrendCandidate[];
  guardrails: string[];
}

const MIN_GSC_IMPRESSIONS = 50;
const MIN_GSC_IMPRESSION_DELTA = 50;
const HIGH_PRIORITY_SCORE = 70;
const SURF_TERMS = [
  "beach",
  "beginner",
  "break",
  "dawn patrol",
  "el nino",
  "forecast",
  "hurricane",
  "longboard",
  "ocean",
  "storm",
  "surf",
  "swell",
  "tide",
  "water temp",
  "wave",
  "wetsuit",
  "wind",
] as const;

export function buildTrendRadarReport(input: TrendRadarInput): TrendRadarReport {
  const candidates: TrendCandidate[] = [];
  const ignored: IgnoredTrendCandidate[] = [];
  const priorByQuery = new Map(
    (input.gsc?.priorQueries ?? []).map((row) => [normalizeTrendQuery(row.query), row]),
  );

  for (const row of input.gsc?.currentQueries ?? []) {
    const normalizedQuery = normalizeTrendQuery(row.query);
    const prior = priorByQuery.get(normalizedQuery);
    const delta = row.impressions - (prior?.impressions ?? 0);

    if (
      row.impressions < MIN_GSC_IMPRESSIONS &&
      delta < MIN_GSC_IMPRESSION_DELTA
    ) {
      continue;
    }

    const trendInput = {
      query: row.query,
      normalizedQuery,
      source: "gsc-query" as const,
      current: row,
      prior,
    };
    const result = buildCandidate(input.dashboard, trendInput);
    if (result.action === "ignore") {
      ignored.push({
        query: row.query,
        reason: result.reason,
        sources: ["gsc-query"],
      });
      continue;
    }
    candidates.push(result.candidate);
  }

  for (const row of input.manualTrends ?? []) {
    const normalizedQuery = normalizeTrendQuery(row.query);
    const result = buildCandidate(input.dashboard, {
      query: row.query,
      normalizedQuery,
      source: "manual-trends",
      manual: row,
    });
    if (result.action === "ignore") {
      ignored.push({
        query: row.query,
        reason: result.reason,
        sources: ["manual-trends"],
      });
      continue;
    }
    candidates.push(result.candidate);
  }

  return {
    generatedAt: input.generatedAt,
    sources: {
      gscQueries: input.gsc?.currentQueries.length ?? 0,
      priorGscQueries: input.gsc?.priorQueries?.length ?? 0,
      manualTrends: input.manualTrends?.length ?? 0,
    },
    candidates: sortCandidates(mergeCandidates(candidates)),
    ignored,
    guardrails: [
      "Report-only output; do not publish pages directly from trend candidates.",
      "DataForSEO is intentionally excluded from this radar.",
      "Create or refresh content only after manual review, source citation checks, and thin-content review.",
      "Prefer refreshing existing canonical Quiver pages before creating new URLs.",
    ],
  };
}

type CandidateBuildInput =
  | {
    query: string;
    normalizedQuery: string;
    source: "gsc-query";
    current: GscQueryRow;
    prior?: GscQueryRow;
  }
  | {
    query: string;
    normalizedQuery: string;
    source: "manual-trends";
    manual: ManualTrendRow;
  };

type CandidateBuildResult =
  | { action: "ignore"; reason: string }
  | { action: "candidate"; candidate: TrendCandidate };

function buildCandidate(
  dashboard: SeoDashboard,
  input: CandidateBuildInput,
): CandidateBuildResult {
  const surfScore = scoreSurfRelevance(input.normalizedQuery);
  if (surfScore === 0) {
    return { action: "ignore", reason: "not surf/ocean relevant" };
  }

  const dashboardMatch = findDashboardMatch(dashboard, input.normalizedQuery);
  const routeMatch = dashboardMatch ? undefined : inferExistingRouteMatch(input.normalizedQuery);
  const action = dashboardMatch || routeMatch
    ? "refresh"
    : inferNewContentAction(input.normalizedQuery);
  const canonicalPath = dashboardMatch?.canonicalPath ??
    routeMatch?.canonicalPath ??
    inferCanonicalPath(input.normalizedQuery);
  const growthScore = scoreGrowth(input);
  const score = surfScore + growthScore + (dashboardMatch ? 10 : 0);
  const priority = score >= HIGH_PRIORITY_SCORE ? "high" : "medium";
  const evidence = buildEvidence(input, dashboardMatch, routeMatch);

  return {
    action: "candidate",
    candidate: {
      id: makeSeoId(`trend-${input.source}`, `${canonicalPath}-${input.normalizedQuery}`),
      query: input.query,
      normalizedQuery: input.normalizedQuery,
      action,
      canonicalPath,
      priority,
      score,
      sources: [input.source],
      relatedQueries: [input.query],
      evidence,
    },
  };
}

function inferNewContentAction(normalizedQuery: string): Exclude<TrendRadarAction, "ignore" | "refresh"> {
  if (/\b(forecast|storm|hurricane|el nino|swell)\b/.test(normalizedQuery)) {
    return "new-guide";
  }
  return "module";
}

function inferCanonicalPath(normalizedQuery: string): string {
  if (/\bel nino\b/.test(normalizedQuery)) {
    return "/learn/el-nino-surf-impact";
  }

  const slug = normalizedQuery
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalizeSeoPath(`/learn/${slug || "surf-trend"}`);
}

function scoreSurfRelevance(normalizedQuery: string): number {
  const matched = SURF_TERMS.filter((term) => normalizedQuery.includes(term));
  if (matched.length === 0) return 0;
  return Math.min(45, 20 + matched.length * 8);
}

function scoreGrowth(input: CandidateBuildInput): number {
  if (input.source === "manual-trends") {
    const traffic = input.manual.traffic ?? 0;
    if (traffic >= 2000) return 45;
    if (traffic >= 1000) return 35;
    if (traffic >= 500) return 25;
    return 15;
  }

  const priorImpressions = input.prior?.impressions ?? 0;
  const delta = input.current.impressions - priorImpressions;
  const ratio = priorImpressions > 0
    ? input.current.impressions / priorImpressions
    : input.current.impressions >= MIN_GSC_IMPRESSIONS
      ? 3
      : 1;

  return Math.min(45, Math.max(15, Math.round(delta / 10) + Math.min(15, Math.round(ratio * 3))));
}

interface ExistingRouteMatch {
  canonicalPath: string;
  family: string;
}

function buildEvidence(
  input: CandidateBuildInput,
  dashboardMatch?: SeoDashboardEntry,
  routeMatch?: ExistingRouteMatch,
): string[] {
  const evidence: string[] = [];

  if (input.source === "manual-trends") {
    const region = input.manual.region ? ` in ${input.manual.region}` : "";
    const traffic = input.manual.traffic !== undefined
      ? `${input.manual.traffic} traffic`
      : "manual trend import";
    evidence.push(`manualTrend=${traffic}${region}`);
    if (input.manual.url) evidence.push(`sourceUrl=${input.manual.url}`);
  } else {
    const prior = input.prior;
    const priorClicks = prior?.clicks ?? 0;
    const priorImpressions = prior?.impressions ?? 0;
    const delta = input.current.impressions - priorImpressions;
    evidence.push(`gscCurrent=${input.current.clicks} clicks/${input.current.impressions} impressions`);
    evidence.push(`gscPrior=${priorClicks} clicks/${priorImpressions} impressions`);
    evidence.push(`gscImpressionDelta=${delta >= 0 ? "+" : ""}${delta}`);
  }

  if (dashboardMatch) {
    evidence.push(`existingCanonical=${dashboardMatch.canonicalPath}`);
  }
  if (routeMatch) {
    evidence.push(`existingRouteFamily=${routeMatch.family}`);
  }

  return evidence;
}

function inferExistingRouteMatch(normalizedQuery: string): ExistingRouteMatch | undefined {
  const waterTempCity = extractLocationSlug(normalizedQuery, [
    "water temperature",
    "water temp",
    "ocean temperature",
    "ocean temp",
  ]);
  if (waterTempCity) {
    return {
      canonicalPath: `/water-temp/${waterTempCity}`,
      family: "water-temp",
    };
  }

  const tideCity = extractLocationSlug(normalizedQuery, ["tide times", "tides", "tide"]);
  if (tideCity) {
    return {
      canonicalPath: `/tide/${tideCity}`,
      family: "tide",
    };
  }

  const beginnerCity = extractLocationSlug(normalizedQuery, ["beginner surf spots", "beginner surf", "beginner"]);
  if (beginnerCity) {
    return {
      canonicalPath: `/beginner/${beginnerCity}`,
      family: "beginner",
    };
  }

  return undefined;
}

function extractLocationSlug(normalizedQuery: string, phrases: string[]): string | undefined {
  for (const phrase of phrases) {
    if (!normalizedQuery.includes(phrase)) continue;
    const rawLocation = normalizedQuery
      .replace(phrase, " ")
      .replace(/\b(today|near me|surf|surfing|forecast|report|for|in|at|the)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawLocation) continue;
    return rawLocation
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return undefined;
}

function findDashboardMatch(
  dashboard: SeoDashboard,
  normalizedQuery: string,
): SeoDashboardEntry | undefined {
  const queryTokens = tokenSet(normalizedQuery);
  let bestMatch: { entry: SeoDashboardEntry; score: number } | undefined;

  for (const entry of dashboard.entries) {
    const haystack = [
      entry.targetKeyword,
      entry.cluster.primaryKeyword,
      ...entry.cluster.secondarySemantics,
    ].map(normalizeTrendQuery).join(" ");
    const haystackTokens = tokenSet(haystack);
    const overlap = [...queryTokens].filter((token) => haystackTokens.has(token)).length;
    const denominator = Math.max(1, Math.min(queryTokens.size, haystackTokens.size));
    const score = overlap / denominator;

    if (score >= 0.6 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { entry, score };
    }
  }

  return bestMatch?.entry;
}

function sortCandidates(candidates: TrendCandidate[]): TrendCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) return scoreDelta;
    return a.query.localeCompare(b.query);
  });
}

function mergeCandidates(candidates: TrendCandidate[]): TrendCandidate[] {
  const grouped = new Map<string, TrendCandidate[]>();

  for (const candidate of candidates) {
    const key = `${candidate.action}\u0000${candidate.canonicalPath}`;
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }

  return [...grouped.values()].map((group) => {
    const sorted = sortCandidates(group);
    const primary = sorted[0];
    if (!primary) {
      throw new Error("Cannot merge an empty trend candidate group");
    }

    return {
      ...primary,
      sources: uniqueSortedByFirstSeen(sorted.flatMap((item) => item.sources)),
      relatedQueries: uniqueSortedByFirstSeen(sorted.flatMap((item) => item.relatedQueries)),
      evidence: uniqueSortedByFirstSeen(sorted.flatMap((item) => item.evidence)),
      priority: sorted.some((item) => item.priority === "high") ? "high" : primary.priority,
      score: Math.max(...sorted.map((item) => item.score)),
    };
  });
}

function uniqueSortedByFirstSeen<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeTrendQuery(value: string): string {
  return normalizeKeyword(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/g, "n"),
  );
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeTrendQuery(value)
      .split(/[^a-z0-9]+/)
      .map((token) => token.replace(/s$/, ""))
      .filter((token) => token.length > 2),
  );
}

export function parseManualTrendImportText(
  content: string,
  fileName: string,
): ManualTrendRow[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (fileName.endsWith(".json")) {
    return parseManualTrendJson(JSON.parse(trimmed));
  }

  if (fileName.endsWith(".csv")) {
    return parseManualTrendCsv(trimmed);
  }

  return parseManualTrendRss(trimmed);
}

function parseManualTrendJson(raw: unknown): ManualTrendRow[] {
  const rows = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.rows)
      ? raw.rows
      : isRecord(raw) && Array.isArray(raw.trends)
        ? raw.trends
        : [];

  return rows.map(parseManualTrendRecord).filter(isDefined);
}

function parseManualTrendCsv(content: string): ManualTrendRow[] {
  const [headerLine, ...lines] = parseCsvLines(content);
  if (!headerLine) return [];

  const headers = headerLine.map((header) => header.trim().toLowerCase());
  return lines.map((line) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = line[index] ?? "";
    });

    return parseManualTrendRecord({
      query: record.query || record.title || record.term,
      traffic: record.traffic || record.approx_traffic,
      region: record.region || record.geo,
      url: record.url || record.link,
      source: "google-trends-csv",
    });
  }).filter(isDefined);
}

function parseManualTrendRss(content: string): ManualTrendRow[] {
  const items = [...content.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  return items.map((item) => parseManualTrendRecord({
    query: readXmlTag(item, "title"),
    traffic: readXmlTag(item, "ht:approx_traffic") ?? readXmlTag(item, "approx_traffic"),
    url: readXmlTag(item, "ht:news_item_url") ?? readXmlTag(item, "link"),
    source: "google-trends-rss",
  })).filter(isDefined);
}

function parseManualTrendRecord(raw: unknown): ManualTrendRow | null {
  if (!isRecord(raw)) return null;
  const query = stringFromUnknown(raw.query ?? raw.title ?? raw.term);
  if (!query) return null;

  return {
    query,
    traffic: parseTraffic(raw.traffic ?? raw.approxTraffic ?? raw.approx_traffic),
    region: stringFromUnknown(raw.region ?? raw.geo),
    source: parseManualSource(raw.source),
    url: stringFromUnknown(raw.url ?? raw.link),
  };
}

function parseManualSource(raw: unknown): ManualTrendRow["source"] {
  if (
    raw === "google-trends-csv" ||
    raw === "google-trends-rss" ||
    raw === "manual"
  ) {
    return raw;
  }
  return "manual";
}

function parseTraffic(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return undefined;

  const normalized = raw.trim().replace(/,/g, "").replace(/\+$/, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!match) return undefined;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;

  const suffix = match[2]?.toLowerCase();
  if (suffix === "m") return Math.round(value * 1_000_000);
  if (suffix === "k") return Math.round(value * 1_000);
  return Math.round(value);
}

function parseCsvLines(content: string): string[][] {
  return content.split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((line) => line.some((cell) => cell.trim().length > 0));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function readXmlTag(content: string, tag: string): string | undefined {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : undefined;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function stringFromUnknown(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
