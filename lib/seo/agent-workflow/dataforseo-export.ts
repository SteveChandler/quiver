import type {
  DataForSeoAsoRanking,
  DataForSeoCompetitorKeyword,
  DataForSeoExportPhase,
  DataForSeoExportInput,
  DataForSeoKeywordMetric,
  DataForSeoSerpFeature,
  DataForSeoSerpRanking,
} from "./types";

export type DataForSeoAsoPlatform = "ios" | "android";
export type DataForSeoWatchlistMode = "live" | "full";
export type DataForSeoWatchlistTier = "critical" | "extended";

export interface DataForSeoWatchlistKeyword {
  keyword: string;
  tier?: DataForSeoWatchlistTier;
}

export interface DataForSeoWatchlist {
  google: {
    domain: string;
    depth: number;
    device: "desktop" | "mobile";
    locations: Array<{ name: string; code?: number }>;
    keywords: Array<string | DataForSeoWatchlistKeyword>;
  };
  aso: {
    quiver: {
      iosAppId: string;
      androidAppId?: string;
    };
    depth: number;
    platforms?: DataForSeoAsoPlatform[];
    disabledPlatforms?: Array<{
      platform: DataForSeoAsoPlatform;
      reason: string;
    }>;
    keywords: Array<string | DataForSeoWatchlistKeyword>;
  };
  competitors: Array<{ name: string; domain: string }>;
}

export interface DataForSeoTaskContext {
  keyword: string;
  location: string;
  locationCode?: number;
  languageCode: string;
  device: "desktop" | "mobile";
  depth: number;
}

export interface DataForSeoAsoTaskContext {
  keyword: string;
  platform: "ios" | "android";
  location: string;
  depth: number;
}

export interface DataForSeoKeywordMetricContext {
  location: string;
  locationCode?: number;
  languageCode: string;
}

export function buildMissingDataForSeoExport(
  generatedAt: string,
  missing: string[],
): DataForSeoExportInput {
  return {
    generatedAt,
    status: "complete",
    completedPhases: [],
    failedPhases: [],
    deadlineReached: false,
    googleRankings: [],
    asoRankings: [],
    competitorKeywords: [],
    keywordMetrics: [],
    missing,
  };
}

export function buildDataForSeoExport(
  generatedAt: string,
  input: {
    googleRankings?: DataForSeoSerpRanking[];
    asoRankings?: DataForSeoAsoRanking[];
    competitorKeywords?: DataForSeoCompetitorKeyword[];
    keywordMetrics?: DataForSeoKeywordMetric[];
    status?: DataForSeoExportInput["status"];
    completedPhases?: DataForSeoExportPhase[];
    failedPhases?: DataForSeoExportPhase[];
    deadlineReached?: boolean;
    watchlistMode?: DataForSeoWatchlistMode;
    missing?: string[];
    estimatedCostUsd?: number;
  },
): DataForSeoExportInput {
  return {
    generatedAt,
    status: input.status ?? "complete",
    completedPhases: input.completedPhases ?? [],
    failedPhases: input.failedPhases ?? [],
    deadlineReached: input.deadlineReached ?? false,
    watchlistMode: input.watchlistMode,
    googleRankings: input.googleRankings ?? [],
    asoRankings: input.asoRankings ?? [],
    competitorKeywords: input.competitorKeywords ?? [],
    keywordMetrics: input.keywordMetrics ?? [],
    missing: input.missing ?? [],
    estimatedCostUsd: input.estimatedCostUsd,
  };
}

export function parseGoogleSerpRanking(
  raw: unknown,
  context: DataForSeoTaskContext,
  targetDomain: string,
): DataForSeoSerpRanking {
  const items = extractResultItems(raw);
  const organicItems = items
    .filter((item) => stringValue(item.type) === "organic")
    .map((item) => ({
      domain: normalizeDomain(stringValue(item.domain)),
      url: stringValue(item.url),
      title: stringValue(item.title),
      rank: numberValue(item.rank_absolute) ?? numberValue(item.rank_group) ?? 0,
    }))
    .filter((item) => item.rank > 0)
    .sort((a, b) => a.rank - b.rank);

  const target = organicItems.find((item) =>
    item.rank <= context.depth &&
    (item.domain === targetDomain || item.domain.endsWith(`.${targetDomain}`)),
  );

  return {
    ...context,
    quiverRank: target?.rank ?? null,
    quiverUrl: target?.url,
    serpFeatures: extractSerpFeatures(items),
    topCompetitors: organicItems
      .filter((item) =>
        item.rank <= context.depth &&
        item.domain !== targetDomain &&
        !item.domain.endsWith(`.${targetDomain}`)
      )
      .slice(0, 10),
  };
}

export function parseAsoRanking(
  raw: unknown,
  context: DataForSeoAsoTaskContext,
  targetAppId: string,
): DataForSeoAsoRanking {
  const items = extractResultItems(raw)
    .map((item) => ({
      app: stringValue(item.title) || stringValue(item.app_title) || stringValue(item.name) || "unknown",
      appId: stringValue(item.app_id) || stringValue(item.app_store_id) || stringValue(item.bundle_id),
      rank: numberValue(item.rank_absolute) ?? numberValue(item.rank_group) ?? 0,
    }))
    .filter((item) => item.rank > 0)
    .sort((a, b) => a.rank - b.rank);

  const target = items.find((item) => item.appId === targetAppId);

  return {
    ...context,
    quiverRank: target?.rank ?? null,
    topCompetitors: items
      .filter((item) => item.appId !== targetAppId)
      .slice(0, 10),
  };
}

export function parseCompetitorRankedKeywords(
  raw: unknown,
  competitor: { name: string; domain: string },
): DataForSeoCompetitorKeyword[] {
  return extractResultItems(raw)
    .map((item): DataForSeoCompetitorKeyword => {
      const keywordData = recordValue(item.keyword_data);
      const keywordInfo = recordValue(keywordData?.keyword_info);
      const rankedElement = recordValue(item.ranked_serp_element);
      const serpItem = recordValue(rankedElement?.serp_item);
      const url = stringValue(serpItem?.url);

      return {
        competitor: competitor.name,
        domain: competitor.domain,
        keyword: stringValue(keywordData?.keyword) || stringValue(item.keyword),
        url: url || undefined,
        rank: numberValue(serpItem?.rank_absolute) ?? numberValue(serpItem?.rank_group),
        searchVolume: numberValue(keywordInfo?.search_volume),
        estimatedTraffic: numberValue(item.etv),
      };
    })
    .filter((item) => item.keyword.length > 0);
}

export function parseKeywordMetrics(
  raw: unknown,
  context: DataForSeoKeywordMetricContext,
): DataForSeoKeywordMetric[] {
  return extractResultItems(raw)
    .map((item): DataForSeoKeywordMetric => {
      const keywordData = recordValue(item.keyword_data) ?? item;
      const keywordInfo = recordValue(keywordData.keyword_info);
      const trend = recordValue(keywordData.search_volume_trend);
      const intent = recordValue(keywordData.search_intent_info);

      return {
        keyword: stringValue(keywordData.keyword) || stringValue(item.keyword),
        location: context.location,
        locationCode: context.locationCode,
        languageCode: context.languageCode,
        searchVolume: numberValue(keywordInfo?.search_volume),
        competitionLevel: stringValue(keywordInfo?.competition_level) || undefined,
        cpc: numberValue(keywordInfo?.cpc),
        trend: trend
          ? {
            monthly: numberValue(trend.monthly),
            quarterly: numberValue(trend.quarterly),
            yearly: numberValue(trend.yearly),
          }
          : undefined,
        intent: intent
          ? {
            main: stringValue(intent.main_intent) || undefined,
            foreign: arrayOfStrings(intent.foreign_intent),
          }
          : undefined,
        monthlySearches: parseMonthlySearches(keywordData.monthly_searches),
      };
    })
    .filter((item) => item.keyword.length > 0);
}

export function normalizeWatchlistKeywords(
  keywords: Array<string | DataForSeoWatchlistKeyword>,
  mode: DataForSeoWatchlistMode,
): DataForSeoWatchlistKeyword[] {
  return keywords
    .map((item) => typeof item === "string"
      ? { keyword: item.trim(), tier: "critical" as const }
      : { keyword: item.keyword.trim(), tier: item.tier ?? "critical" })
    .filter((item) => item.keyword.length > 0)
    .filter((item) => mode === "full" || item.tier !== "extended");
}

function extractResultItems(raw: unknown): Record<string, unknown>[] {
  const response = recordValue(raw);
  const tasks = Array.isArray(response?.tasks) ? response.tasks : [];
  return tasks.flatMap((task) => {
    const taskRecord = recordValue(task);
    const results = Array.isArray(taskRecord?.result) ? taskRecord.result : [];
    return results.flatMap((result) => {
      const resultRecord = recordValue(result);
      return Array.isArray(resultRecord?.items)
        ? resultRecord.items.filter(isRecord)
        : [];
    });
  });
}

function extractSerpFeatures(items: Record<string, unknown>[]): DataForSeoSerpFeature[] {
  return items
    .filter((item) => {
      const type = stringValue(item.type);
      return type.length > 0 && type !== "organic";
    })
    .map((item) => {
      const domain = normalizeDomain(stringValue(item.domain));
      return {
        type: stringValue(item.type),
        rank: numberValue(item.rank_absolute) ?? numberValue(item.rank_group),
        title: stringValue(item.title) || undefined,
        url: stringValue(item.url) || undefined,
        domain: domain || undefined,
      };
    });
}

function parseMonthlySearches(value: unknown): DataForSeoKeywordMetric["monthlySearches"] {
  if (!Array.isArray(value)) return undefined;

  return value
    .filter(isRecord)
    .map((item) => ({
      year: numberValue(item.year) ?? 0,
      month: numberValue(item.month) ?? 0,
      searchVolume: numberValue(item.search_volume) ?? 0,
    }))
    .filter((item) => item.year > 0 && item.month > 0);
}

function normalizeDomain(value: string): string {
  return value.replace(/^www\./, "").toLowerCase();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
