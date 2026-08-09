export const FORECAST_BENCHMARK_QUERY_CLASSES = [
  "spot-surf-forecast",
  "spot-surf-report",
  "spot-tomorrow",
  "best-time-to-surf-spot",
  "when-should-i-surf-spot",
  "spot-swell-tomorrow",
  "spot-wind-tomorrow",
  "spot-tide-tomorrow",
  "best-surf-region-tomorrow",
  "where-should-i-surf-region-tomorrow",
] as const;

export type ForecastBenchmarkQueryClass =
  (typeof FORECAST_BENCHMARK_QUERY_CLASSES)[number];

const SPOT_QUERY_CLASSES = [
  "spot-surf-forecast",
  "spot-surf-report",
  "spot-tomorrow",
  "best-time-to-surf-spot",
  "when-should-i-surf-spot",
  "spot-swell-tomorrow",
  "spot-wind-tomorrow",
  "spot-tide-tomorrow",
] as const;

export interface ForecastBenchmarkSpot {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  canonicalPath: string;
}

export interface ForecastBenchmarkQuery {
  queryId: string;
  queryClass: ForecastBenchmarkQueryClass;
  query: string;
  spotId: string | null;
  region: string;
  canonicalPath: string | null;
}

export interface ForecastRetrievalEvidence {
  queryId: string;
  selectedUrl: string | null;
  answerUrl: string | null;
  citedUrl: string | null;
  answerComplete: boolean;
  current: boolean;
}

export interface ForecastBenchmarkCompetitor {
  name: string;
  domains: string[];
}

export interface ForecastCompetitiveSourceResult {
  name: string;
  domains: string[];
  selectedShare: number | null;
  answerShare: number | null;
  citationShare: number | null;
}

export interface ForecastCompetitiveBenchmark {
  status: ForecastRetrievalBenchmark["status"];
  provider: string | null;
  competitors: ForecastCompetitiveSourceResult[];
  reason: string | null;
}

export interface ForecastRetrievalBenchmark {
  status: "measured" | "not-run" | "invalid";
  provider: string | null;
  expectedQueries: number;
  measuredQueries: number;
  retrievedShare: number | null;
  answerShare: number | null;
  currentAnswerShare: number | null;
  citationShare: number | null;
  canonicalSelectionShare: number | null;
  missingQueryIds: string[];
  unexpectedQueryIds: string[];
  duplicateQueryIds: string[];
  reason: string | null;
}

export const DEFAULT_FORECAST_BENCHMARK_COMPETITORS: ForecastBenchmarkCompetitor[] = [
  { name: "Surfline", domains: ["surfline.com"] },
  { name: "Surf Captain", domains: ["surfcaptain.com"] },
];

export const DEFAULT_QUIVER_BENCHMARK_ORIGIN = "https://www.quiversurf.app";

export interface ForecastAnswerContractFacts {
  answerLayer: boolean;
  forecastDate: boolean;
  surfFacts: boolean;
  bestWindow: boolean;
  reasoning: boolean;
  freshness: boolean;
  provenance: boolean;
  score: number;
}

const EAST_COAST_STATES = new Set([
  "ct", "de", "fl", "ga", "ma", "md", "me", "nc", "nh", "nj", "ny", "ri", "sc", "va",
]);
const GULF_STATES = new Set(["al", "la", "ms", "tx"]);
const WEST_COAST_STATES = new Set(["or", "wa"]);

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function classifyForecastBenchmarkRegion(spot: ForecastBenchmarkSpot): string {
  const country = normalized(spot.country);
  const state = normalized(spot.state);
  if (country === "usa" || country === "us" || country === "united states") {
    if (state === "ca" || state === "california") return "California";
    if (state === "hi" || state === "hawaii") return "Hawaii";
    if (WEST_COAST_STATES.has(state)) return "West Coast";
    if (GULF_STATES.has(state)) return "Gulf Coast";
    if (EAST_COAST_STATES.has(state)) return "East Coast";
  }
  return "International";
}

function spotQuery(
  spot: ForecastBenchmarkSpot,
  queryClass: Exclude<ForecastBenchmarkQueryClass, "best-surf-region-tomorrow" | "where-should-i-surf-region-tomorrow">,
): string {
  const name = spot.name;
  switch (queryClass) {
    case "spot-surf-forecast": return `${name} surf forecast`;
    case "spot-surf-report": return `${name} surf report`;
    case "spot-tomorrow": return `${name} tomorrow`;
    case "best-time-to-surf-spot": return `best time to surf ${name}`;
    case "when-should-i-surf-spot": return `when should I surf ${name}`;
    case "spot-swell-tomorrow": return `${name} swell tomorrow`;
    case "spot-wind-tomorrow": return `${name} wind tomorrow`;
    case "spot-tide-tomorrow": return `${name} tide tomorrow`;
  }
}

function queryId(
  queryClass: ForecastBenchmarkQueryClass,
  spotId: string | null,
  region: string,
): string {
  return `${region}:${spotId ?? "region"}:${queryClass}`;
}

export function buildForecastBenchmarkQueries(
  spots: ForecastBenchmarkSpot[],
  spotsPerRegion = 5,
): ForecastBenchmarkQuery[] {
  const spotsByRegion = new Map<string, ForecastBenchmarkSpot[]>();
  for (const spot of spots) {
    const region = classifyForecastBenchmarkRegion(spot);
    const regionSpots = spotsByRegion.get(region) ?? [];
    regionSpots.push(spot);
    spotsByRegion.set(region, regionSpots);
  }

  const queries: ForecastBenchmarkQuery[] = [];
  for (const [region, regionSpots] of spotsByRegion) {
    const sampledSpots = [...regionSpots]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, spotsPerRegion);

    for (const spot of sampledSpots) {
      for (const queryClass of SPOT_QUERY_CLASSES) {
        queries.push({
          queryId: queryId(queryClass, spot.id, region),
          queryClass,
          query: spotQuery(spot, queryClass),
          spotId: spot.id,
          region,
          canonicalPath: spot.canonicalPath,
        });
      }
    }

    for (const queryClass of [
      "best-surf-region-tomorrow",
      "where-should-i-surf-region-tomorrow",
    ] as const) {
      queries.push({
        queryId: queryId(queryClass, null, region),
        queryClass,
        query: queryClass === "best-surf-region-tomorrow"
          ? `best surf ${region} tomorrow`
          : `where should I surf ${region} tomorrow`,
        spotId: null,
        region,
        canonicalPath: null,
      });
    }
  }

  return queries;
}

function normalizedUrl(value: string | null): URL | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function normalizedPath(value: string): string {
  return value.length > 1 ? value.replace(/\/$/, "") : value;
}

function normalizedHost(value: string): string {
  return value.toLowerCase().replace(/^www\./, "");
}

function urlBelongsToDomains(url: URL | null, domains: string[]): boolean {
  if (!url) return false;
  const host = normalizedHost(url.hostname);
  return domains.some((domain) => {
    const normalizedDomain = normalizedHost(domain);
    return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
  });
}

function isQuiverUrl(value: string | null, quiverOrigin: string): boolean {
  const originUrl = normalizedUrl(quiverOrigin);
  if (!originUrl) return false;
  return urlBelongsToDomains(
    normalizedUrl(value),
    [originUrl.hostname],
  );
}

function isCanonicalQuiverUrl(
  value: string | null,
  canonicalPath: string,
  quiverOrigin: string,
): boolean {
  const url = normalizedUrl(value);
  return (
    isQuiverUrl(value, quiverOrigin)
    && url !== null
    && normalizedPath(url.pathname) === normalizedPath(canonicalPath)
  );
}

function isRetrievalEvidence(value: unknown): value is ForecastRetrievalEvidence {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.queryId === "string"
    && (record.selectedUrl === null || typeof record.selectedUrl === "string")
    && (record.answerUrl === null || typeof record.answerUrl === "string")
    && (record.citedUrl === null || typeof record.citedUrl === "string")
    && typeof record.answerComplete === "boolean"
    && typeof record.current === "boolean"
  );
}

export function parseForecastRetrievalEvidence(value: unknown): ForecastRetrievalEvidence[] {
  if (!Array.isArray(value) || !value.every(isRetrievalEvidence)) {
    throw new Error(
      "Retrieval evidence must be an array of { queryId, selectedUrl, answerUrl, citedUrl, answerComplete, current } objects.",
    );
  }

  return value;
}

function share(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function createUnmeasuredForecastRetrievalBenchmark(
  queries: ForecastBenchmarkQuery[],
  reason: string,
): ForecastRetrievalBenchmark {
  return {
    status: "not-run",
    provider: null,
    expectedQueries: queries.length,
    measuredQueries: 0,
    retrievedShare: null,
    answerShare: null,
    currentAnswerShare: null,
    citationShare: null,
    canonicalSelectionShare: null,
    missingQueryIds: queries.map((query) => query.queryId),
    unexpectedQueryIds: [],
    duplicateQueryIds: [],
    reason,
  };
}

export function summarizeForecastRetrievalEvidence(
  queries: ForecastBenchmarkQuery[],
  evidence: ForecastRetrievalEvidence[],
  provider: string,
  quiverOrigin = DEFAULT_QUIVER_BENCHMARK_ORIGIN,
): ForecastRetrievalBenchmark {
  const expectedById = new Map(queries.map((query) => [query.queryId, query]));
  const evidenceCounts = new Map<string, number>();
  for (const result of evidence) {
    evidenceCounts.set(result.queryId, (evidenceCounts.get(result.queryId) ?? 0) + 1);
  }

  const duplicateQueryIds = [...evidenceCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([queryId]) => queryId);
  const unexpectedQueryIds = [...evidenceCounts.keys()]
    .filter((queryId) => !expectedById.has(queryId));
  const missingQueryIds = queries
    .map((query) => query.queryId)
    .filter((queryId) => !evidenceCounts.has(queryId));

  if (duplicateQueryIds.length > 0 || unexpectedQueryIds.length > 0 || missingQueryIds.length > 0) {
    return {
      status: "invalid",
      provider,
      expectedQueries: queries.length,
      measuredQueries: evidence.length,
      retrievedShare: null,
      answerShare: null,
      currentAnswerShare: null,
      citationShare: null,
      canonicalSelectionShare: null,
      missingQueryIds,
      unexpectedQueryIds,
      duplicateQueryIds,
      reason: "Retrieval evidence must contain exactly one result for every generated query.",
    };
  }

  const expectedCanonicalQueries = queries.filter((query) => query.canonicalPath !== null);
  const measuredById = new Map(evidence.map((result) => [result.queryId, result]));
  const retrieved = evidence.filter((result) => isQuiverUrl(result.selectedUrl, quiverOrigin)).length;
  const answered = evidence.filter((result) => (
    result.answerComplete && isQuiverUrl(result.answerUrl, quiverOrigin)
  )).length;
  const currentAnswers = evidence.filter((result) => (
    result.answerComplete
    && result.current
    && isQuiverUrl(result.answerUrl, quiverOrigin)
  )).length;
  const cited = evidence.filter((result) => isQuiverUrl(result.citedUrl, quiverOrigin)).length;
  const canonicalSelections = expectedCanonicalQueries.filter((query) => {
    const result = measuredById.get(query.queryId);
    return isCanonicalQuiverUrl(
      result?.selectedUrl ?? null,
      query.canonicalPath!,
      quiverOrigin,
    );
  }).length;

  return {
    status: "measured",
    provider,
    expectedQueries: queries.length,
    measuredQueries: evidence.length,
    retrievedShare: share(retrieved, queries.length),
    answerShare: share(answered, queries.length),
    currentAnswerShare: share(currentAnswers, queries.length),
    citationShare: share(cited, queries.length),
    canonicalSelectionShare: share(canonicalSelections, expectedCanonicalQueries.length),
    missingQueryIds: [],
    unexpectedQueryIds: [],
    duplicateQueryIds: [],
    reason: null,
  };
}

export function summarizeForecastCompetitiveBenchmark(
  queries: ForecastBenchmarkQuery[],
  evidence: ForecastRetrievalEvidence[],
  retrieval: ForecastRetrievalBenchmark,
  competitors: ForecastBenchmarkCompetitor[] = DEFAULT_FORECAST_BENCHMARK_COMPETITORS,
): ForecastCompetitiveBenchmark {
  const sourceResults = competitors.map((competitor): ForecastCompetitiveSourceResult => {
    const selected = evidence.filter((result) => urlBelongsToDomains(
      normalizedUrl(result.selectedUrl),
      competitor.domains,
    )).length;
    const answered = evidence.filter((result) => (
      result.answerComplete
      && urlBelongsToDomains(
        normalizedUrl(result.answerUrl),
        competitor.domains,
      )
    )).length;
    const cited = evidence.filter((result) => urlBelongsToDomains(
      normalizedUrl(result.citedUrl),
      competitor.domains,
    )).length;

    return {
      name: competitor.name,
      domains: competitor.domains,
      selectedShare: retrieval.status === "measured" ? share(selected, queries.length) : null,
      answerShare: retrieval.status === "measured" ? share(answered, queries.length) : null,
      citationShare: retrieval.status === "measured" ? share(cited, queries.length) : null,
    };
  });

  return {
    status: retrieval.status,
    provider: retrieval.provider,
    competitors: sourceResults,
    reason: retrieval.reason,
  };
}

function hasAny(html: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(html));
}

export function extractForecastAnswerContractFacts(
  html: string,
): ForecastAnswerContractFacts {
  const facts = {
    answerLayer: /data-testid=["']public-forecast-answer["']/.test(html),
    forecastDate: /Forecast valid at|surf forecast/i.test(html),
    surfFacts: /<dt[^>]*>Surf<\/dt>|Surf<\/h[1-6]>|Surf forecast/i.test(html),
    bestWindow: /Best window/i.test(html),
    reasoning: /Why:/i.test(html),
    freshness: /Source data updated|Quiver computed/i.test(html),
    provenance: /Contributing sources|Source data updated/i.test(html),
    score: hasAny(html, [/Score/i, /Confidence/i]) ? 1 : 0,
  };

  const passed = Object.values(facts).filter((value) => value === true || value === 1).length;
  return { ...facts, score: passed / Object.keys(facts).length };
}
