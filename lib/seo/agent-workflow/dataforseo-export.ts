import type {
  DataForSeoAsoRanking,
  DataForSeoCompetitorKeyword,
  DataForSeoExportInput,
  DataForSeoSerpRanking,
} from "./types";

export interface DataForSeoWatchlist {
  google: {
    domain: string;
    depth: number;
    device: "desktop" | "mobile";
    locations: Array<{ name: string; code?: number }>;
    keywords: string[];
  };
  aso: {
    quiver: {
      iosAppId: string;
      androidAppId: string;
    };
    depth: number;
    keywords: string[];
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

export function buildMissingDataForSeoExport(
  generatedAt: string,
  missing: string[],
): DataForSeoExportInput {
  return {
    generatedAt,
    googleRankings: [],
    asoRankings: [],
    competitorKeywords: [],
    missing,
  };
}

export function buildDataForSeoExport(
  generatedAt: string,
  input: {
    googleRankings?: DataForSeoSerpRanking[];
    asoRankings?: DataForSeoAsoRanking[];
    competitorKeywords?: DataForSeoCompetitorKeyword[];
    missing?: string[];
    estimatedCostUsd?: number;
  },
): DataForSeoExportInput {
  return {
    generatedAt,
    googleRankings: input.googleRankings ?? [],
    asoRankings: input.asoRankings ?? [],
    competitorKeywords: input.competitorKeywords ?? [],
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
    item.domain === targetDomain || item.domain.endsWith(`.${targetDomain}`),
  );

  return {
    ...context,
    quiverRank: target?.rank ?? null,
    quiverUrl: target?.url,
    topCompetitors: organicItems
      .filter((item) => item.domain !== targetDomain && !item.domain.endsWith(`.${targetDomain}`))
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

function normalizeDomain(value: string): string {
  return value.replace(/^www\./, "").toLowerCase();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
