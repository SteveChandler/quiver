import fs from "node:fs";
import path from "node:path";

import {
  buildDataForSeoExport,
  buildMissingDataForSeoExport,
  parseAsoRanking,
  parseCompetitorRankedKeywords,
  parseGoogleSerpRanking,
} from "../../lib/seo/agent-workflow/dataforseo-export";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type {
  DataForSeoAsoRanking,
  DataForSeoCompetitorKeyword,
  DataForSeoSerpRanking,
} from "../../lib/seo/agent-workflow/types";
import type {
  DataForSeoAsoTaskContext,
  DataForSeoTaskContext,
  DataForSeoWatchlist,
} from "../../lib/seo/agent-workflow/dataforseo-export";
import { loadSeoEnv } from "./load-env";

loadSeoEnv();

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("DATAFORSEO-EXPORT.json", currentAuditDate());
const watchlistPath = getFlag("--watchlist") ??
  path.join(process.cwd(), "docs", "seo", "dataforseo-watchlist.json");
const login = process.env.DATAFORSEO_LOGIN;
const password = process.env.DATAFORSEO_PASSWORD;
const apiBase = process.env.DATAFORSEO_API_BASE ?? "https://api.dataforseo.com";
const competitorLimit = numberFromEnv("DATAFORSEO_COMPETITOR_KEYWORD_LIMIT", 100);
const appBatchSize = numberFromEnv("DATAFORSEO_APP_BATCH_SIZE", 5);
const appPollMs = numberFromEnv("DATAFORSEO_APP_POLL_MS", 60000);
const appPollIntervalMs = numberFromEnv("DATAFORSEO_APP_POLL_INTERVAL_MS", 5000);

void main();

async function main(): Promise<void> {
  const watchlist = readWatchlist(watchlistPath);
  const missing = [
    ...(!login ? ["DATAFORSEO_LOGIN"] : []),
    ...(!password ? ["DATAFORSEO_PASSWORD"] : []),
    ...(!fs.existsSync(watchlistPath) ? [watchlistPath] : []),
  ];

  if (!watchlist || !login || !password) {
    writeJson(buildMissingDataForSeoExport(new Date().toISOString(), missing));
    return;
  }

  const googleRankings = await fetchGoogleRankings(watchlist, missing);
  const asoRankings = await fetchAsoRankings(watchlist, missing);
  const competitorKeywords = await fetchCompetitorKeywords(watchlist, missing);

  writeJson(buildDataForSeoExport(new Date().toISOString(), {
    googleRankings,
    asoRankings,
    competitorKeywords,
    missing,
    estimatedCostUsd: estimateRunCost(watchlist),
  }));
}

async function fetchGoogleRankings(
  watchlist: DataForSeoWatchlist,
  missing: string[],
): Promise<DataForSeoSerpRanking[]> {
  const contexts = watchlist.google.keywords.flatMap((keyword) =>
    watchlist.google.locations.map((location): DataForSeoTaskContext => ({
      keyword,
      location: location.name,
      locationCode: location.code,
      languageCode: "en",
      device: watchlist.google.device,
      depth: watchlist.google.depth,
    })),
  );
  if (contexts.length === 0) return [];

  try {
    const raw = await postDataForSeo("/v3/serp/google/organic/live/advanced", contexts.map((context) => ({
      keyword: context.keyword,
      language_code: context.languageCode,
      depth: context.depth,
      device: context.device,
      os: context.device === "mobile" ? "ios" : "macos",
      ...(context.locationCode ? { location_code: context.locationCode } : { location_name: context.location }),
      tag: `quiver-serp:${context.keyword}:${context.location}`,
    })));

    return contexts.map((context) =>
      parseGoogleSerpRanking(taskResponseAt(raw, contexts.indexOf(context)), context, watchlist.google.domain),
    );
  } catch (error) {
    missing.push(`DataForSEO Google SERP: ${errorMessage(error)}`);
    return [];
  }
}

async function fetchAsoRankings(
  watchlist: DataForSeoWatchlist,
  missing: string[],
): Promise<DataForSeoAsoRanking[]> {
  const iosContexts = watchlist.aso.keywords.map((keyword): DataForSeoAsoTaskContext => ({
    keyword,
    platform: "ios",
    location: "United States",
    depth: watchlist.aso.depth,
  }));
  const androidContexts = watchlist.aso.keywords.map((keyword): DataForSeoAsoTaskContext => ({
    keyword,
    platform: "android",
    location: "United States",
    depth: watchlist.aso.depth,
  }));

  const [ios, android] = await Promise.all([
    fetchAppSearchRankings(
      "/v3/app_data/apple/app_searches/task_post",
      "/v3/app_data/apple/app_searches/task_get/advanced",
      iosContexts,
      watchlist.aso.quiver.iosAppId,
      missing,
    ),
    fetchAppSearchRankings(
      "/v3/app_data/google/app_searches/task_post",
      "/v3/app_data/google/app_searches/task_get/advanced",
      androidContexts,
      watchlist.aso.quiver.androidAppId,
      missing,
    ),
  ]);

  return [...ios, ...android];
}

async function fetchAppSearchRankings(
  postEndpoint: string,
  getEndpoint: string,
  contexts: DataForSeoAsoTaskContext[],
  targetAppId: string,
  missing: string[],
): Promise<DataForSeoAsoRanking[]> {
  if (contexts.length === 0) return [];

  const rankings: DataForSeoAsoRanking[] = [];

  for (const contextBatch of chunkArray(contexts, appBatchSize)) {
    try {
      const postResponse = await postDataForSeo(postEndpoint, contextBatch.map((context) => ({
        keyword: context.keyword,
        location_code: 2840,
        language_code: "en",
        depth: context.depth,
        tag: `quiver-aso:${context.platform}:${context.keyword}`,
      })));
      const taskIds = extractTaskIds(postResponse);
      const batchRankings = await Promise.all(contextBatch.map(async (context, index) => {
        try {
          const taskId = taskIds[index];
          if (!taskId) {
            missing.push(`DataForSEO ${context.platform} ASO task id missing for ${context.keyword}`);
            return null;
          }
          const result = await pollTaskGet(`${getEndpoint}/${taskId}`);
          if (!result) {
            missing.push(`DataForSEO ${context.platform} ASO task not ready for ${context.keyword}`);
            return null;
          }
          return parseAsoRanking(result, context, targetAppId);
        } catch (error) {
          missing.push(`DataForSEO ASO ${context.platform} ${context.keyword}: ${errorMessage(error)}`);
          return null;
        }
      }));
      rankings.push(...batchRankings.filter(isDefined));
    } catch (error) {
      for (const context of contextBatch) {
        missing.push(`DataForSEO ASO ${context.platform} ${context.keyword}: ${errorMessage(error)}`);
      }
    }
  }

  return rankings;
}

async function fetchCompetitorKeywords(
  watchlist: DataForSeoWatchlist,
  missing: string[],
): Promise<DataForSeoCompetitorKeyword[]> {
  const rows: DataForSeoCompetitorKeyword[] = [];

  for (const competitor of watchlist.competitors) {
    try {
      const raw = await postDataForSeo("/v3/dataforseo_labs/google/ranked_keywords/live", [{
        target: competitor.domain,
        location_code: 2840,
        language_code: "en",
        limit: competitorLimit,
        order_by: ["keyword_data.keyword_info.search_volume,desc"],
      }]);
      rows.push(...parseCompetitorRankedKeywords(raw, competitor));
    } catch (error) {
      missing.push(`DataForSEO competitor keywords ${competitor.name}: ${errorMessage(error)}`);
    }
  }

  return rows;
}

async function pollTaskGet(endpoint: string): Promise<unknown | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= appPollMs) {
    const raw = await getDataForSeo(endpoint);
    if (hasTaskResult(raw)) return raw;
    await new Promise((resolve) => setTimeout(resolve, appPollIntervalMs));
  }
  return null;
}

async function postDataForSeo(endpoint: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${apiBase}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseDataForSeoResponse(response);
}

async function getDataForSeo(endpoint: string): Promise<unknown> {
  const response = await fetch(`${apiBase}${endpoint}`, {
    headers: { Authorization: authHeader() },
  });
  return parseDataForSeoResponse(response);
}

async function parseDataForSeoResponse(response: Response): Promise<unknown> {
  const raw = await response.json() as unknown;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${dataForSeoMessage(raw)}`);
  }
  const statusCode = isRecord(raw) ? raw.status_code : undefined;
  if (typeof statusCode === "number" && statusCode >= 40000) {
    throw new Error(`status ${statusCode}${dataForSeoMessage(raw)}`);
  }
  return raw;
}

function taskResponseAt(raw: unknown, index: number): unknown {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return raw;
  return { ...raw, tasks: [raw.tasks[index]].filter(Boolean) };
}

function extractTaskIds(raw: unknown): string[] {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return [];
  return raw.tasks
    .map((task) => isRecord(task) && typeof task.id === "string" ? task.id : "");
}

function hasTaskResult(raw: unknown): boolean {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return false;
  const task = raw.tasks.find(isRecord);
  return !!task && Array.isArray(task.result);
}

function estimateRunCost(watchlist: DataForSeoWatchlist): number {
  const serpTasks = watchlist.google.keywords.length * watchlist.google.locations.length;
  const asoTasks = watchlist.aso.keywords.length * 2;
  const competitorRows = watchlist.competitors.length * competitorLimit;
  const estimate = (serpTasks * 0.00465) + (asoTasks * 0.011) + (watchlist.competitors.length * 0.01) + (competitorRows * 0.0001);
  return Math.round(estimate * 100) / 100;
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function readWatchlist(filePath: string): DataForSeoWatchlist | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as DataForSeoWatchlist;
}

function writeJson(value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath }, null, 2));
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dataForSeoMessage(raw: unknown): string {
  if (!isRecord(raw) || typeof raw.status_message !== "string" || raw.status_message.length === 0) {
    return "";
  }
  return `: ${raw.status_message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
