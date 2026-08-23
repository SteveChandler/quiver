import fs from "node:fs";
import path from "node:path";

import {
  buildDataForSeoExport,
  buildMissingDataForSeoExport,
  normalizeWatchlistKeywords,
  parseAsoRanking,
  parseCompetitorRankedKeywords,
  parseGoogleSerpRanking,
  parseKeywordMetrics,
} from "../../lib/seo/agent-workflow/dataforseo-export";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type {
  DataForSeoAsoRanking,
  DataForSeoCompetitorKeyword,
  DataForSeoExportPhase,
  DataForSeoKeywordMetric,
  DataForSeoSerpRanking,
} from "../../lib/seo/agent-workflow/types";
import type {
  DataForSeoAsoPlatform,
  DataForSeoAsoTaskContext,
  DataForSeoKeywordMetricContext,
  DataForSeoTaskContext,
  DataForSeoWatchlist,
  DataForSeoWatchlistKeyword,
  DataForSeoWatchlistMode,
} from "../../lib/seo/agent-workflow/dataforseo-export";
import { loadSeoEnv } from "./load-env";
import { fetchWithRetry } from "./resilient-fetch";

loadSeoEnv();

const PHASES: DataForSeoExportPhase[] = [
  "googleRankings",
  "keywordMetrics",
  "asoRankings",
  "competitorKeywords",
];

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("DATAFORSEO-EXPORT.json", currentAuditDate());
const watchlistPath = getFlag("--watchlist") ??
  path.join(process.cwd(), "docs", "seo", "dataforseo-watchlist.json");
const appleSearchAdsKeywordsPath = getFlag("--apple-search-ads-keywords") ??
  process.env.APPLE_SEARCH_ADS_KEYWORDS_PATH ??
  path.join(process.cwd(), "docs", "seo", "apple-search-ads-keywords.json");
const watchlistMode = normalizeWatchlistMode(
  getFlag("--watchlist-mode") ?? process.env.DATAFORSEO_WATCHLIST_MODE,
);
const login = process.env.DATAFORSEO_LOGIN;
const password = process.env.DATAFORSEO_PASSWORD;
const dataForSeoEnabled = process.env.DATAFORSEO_ENABLED?.toLowerCase() !== "false";
const apiBase = process.env.DATAFORSEO_API_BASE ?? "https://api.dataforseo.com";
const competitorLimit = numberFromEnv("DATAFORSEO_COMPETITOR_KEYWORD_LIMIT", 100);
const keywordMetricBatchSize = numberFromEnv("DATAFORSEO_KEYWORD_METRIC_BATCH_SIZE", 100);
const googleBatchSize = numberFromEnv("DATAFORSEO_GOOGLE_BATCH_SIZE", 5);
const appBatchSize = numberFromEnv("DATAFORSEO_APP_BATCH_SIZE", 10);
const appPollMs = numberFromEnv("DATAFORSEO_APP_POLL_MS", 120000);
const appPollIntervalMs = numberFromEnv("DATAFORSEO_APP_POLL_INTERVAL_MS", 5000);
const requestTimeoutMs = numberFromEnv("DATAFORSEO_TIMEOUT_MS", 15000);
const googleRequestTimeoutMs = numberFromEnv("DATAFORSEO_GOOGLE_TIMEOUT_MS", 45000);
const requestRetries = numberFromEnv("DATAFORSEO_REQUEST_RETRIES", 3);
const requestRetryDelayMs = numberFromEnv("DATAFORSEO_REQUEST_RETRY_DELAY_MS", 500);
const exporterDeadlineMs = numberFromEnv("DATAFORSEO_DEADLINE_MS", 240000);
const asoPhaseBudgetMs = numberFromEnv("DATAFORSEO_ASO_PHASE_MS", 150000);

interface ExportState {
  generatedAt: string;
  googleRankings: DataForSeoSerpRanking[];
  keywordMetrics: DataForSeoKeywordMetric[];
  asoRankings: DataForSeoAsoRanking[];
  competitorKeywords: DataForSeoCompetitorKeyword[];
  missing: string[];
  completedPhases: DataForSeoExportPhase[];
  failedPhases: DataForSeoExportPhase[];
  deadlineReached: boolean;
  status: "complete" | "partial" | "timed_out";
  estimatedCostUsd?: number;
}

function hasRuntimeDataForSeoErrors(state: ExportState): boolean {
  return state.missing.some((entry) => entry.startsWith("DataForSEO "));
}

async function main(): Promise<void> {
  if (!dataForSeoEnabled) {
    writeJson(buildMissingDataForSeoExport(new Date().toISOString(), ["DATAFORSEO_DISABLED_BY_CONFIG"]));
    return;
  }

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

  const generatedAt = new Date().toISOString();
  const state: ExportState = {
    generatedAt,
    googleRankings: [],
    keywordMetrics: [],
    asoRankings: [],
    competitorKeywords: [],
    missing,
    completedPhases: [],
    failedPhases: [],
    deadlineReached: false,
    status: "partial",
    estimatedCostUsd: estimateRunCost(watchlist, watchlistMode),
  };
  const deadline = new ExportDeadline(exporterDeadlineMs);

  await checkpoint(state);

  for (const phase of PHASES) {
    if (deadline.hasExpired()) {
      markDeadline(state, phase);
      await checkpoint(state);
      break;
    }

    try {
      switch (phase) {
        case "googleRankings":
          await fetchGoogleRankings(watchlist, state, deadline);
          break;
        case "keywordMetrics":
          await fetchKeywordMetrics(watchlist, state, deadline);
          break;
        case "asoRankings":
          await fetchAsoRankings(watchlist, state, deadline);
          break;
        case "competitorKeywords":
          await fetchCompetitorKeywords(watchlist, state, deadline);
          break;
      }
      state.completedPhases.push(phase);
      state.failedPhases = state.failedPhases.filter((item) => item !== phase);
      state.status = deadline.hasExpired() ? "timed_out" : "partial";
      await checkpoint(state);
    } catch (error) {
      state.failedPhases.push(phase);
      if (error instanceof DeadlineExceededError) {
        markDeadline(state, phase);
      } else {
        state.missing.push(`DataForSEO ${phase}: ${errorMessage(error)}`);
        state.status = "partial";
      }
      await checkpoint(state);
      if (error instanceof DeadlineExceededError) break;
    }
  }

  if (state.deadlineReached) {
    state.status = "timed_out";
  } else if (state.failedPhases.length > 0 || hasRuntimeDataForSeoErrors(state)) {
    state.status = "partial";
  } else {
    state.status = "complete";
  }

  await checkpoint(state);
}

async function fetchGoogleRankings(
  watchlist: DataForSeoWatchlist,
  state: ExportState,
  deadline: ExportDeadline,
): Promise<void> {
  const keywords = normalizeWatchlistKeywords(watchlist.google.keywords, watchlistMode)
    .map((row) => row.keyword);
  const contexts = keywords.flatMap((keyword) =>
    watchlist.google.locations.map((location): DataForSeoTaskContext => ({
      keyword,
      location: location.name,
      locationCode: location.code,
      languageCode: "en",
      device: watchlist.google.device,
      depth: watchlist.google.depth,
    })),
  );
  if (contexts.length === 0) return;

  for (const contextBatch of chunkArray(contexts, googleBatchSize)) {
    deadline.assertRemaining("googleRankings");
    try {
      const raw = await postDataForSeo(
        "/v3/serp/google/organic/live/advanced",
        contextBatch.map((context) => ({
          keyword: context.keyword,
          language_code: context.languageCode,
          depth: context.depth,
          device: context.device,
          os: context.device === "mobile" ? "ios" : "macos",
          ...(context.locationCode ? { location_code: context.locationCode } : { location_name: context.location }),
          tag: `quiver-serp:${context.keyword}:${context.location}`,
        })),
        deadline,
        "googleRankings",
        googleRequestTimeoutMs,
      );

      const tasks = extractTasks(raw);
      for (const [index, context] of contextBatch.entries()) {
        const taskRaw = tasks[index] ? { tasks: [tasks[index]] } : null;
        if (!taskRaw) {
          state.missing.push(`DataForSEO Google SERP ${context.keyword}: missing task result`);
          continue;
        }
        state.googleRankings.push(parseGoogleSerpRanking(taskRaw, context, watchlist.google.domain));
      }
    } catch (error) {
      if (error instanceof DeadlineExceededError) throw error;
      for (const context of contextBatch) {
        state.missing.push(`DataForSEO Google SERP ${context.keyword}: ${errorMessage(error)}`);
      }
    }
  }
}

async function fetchKeywordMetrics(
  watchlist: DataForSeoWatchlist,
  state: ExportState,
  deadline: ExportDeadline,
): Promise<void> {
  const keywords = normalizeWatchlistKeywords(watchlist.google.keywords, watchlistMode)
    .map((row) => row.keyword);
  if (keywords.length === 0 || watchlist.google.locations.length === 0) {
    return;
  }

  for (const location of watchlist.google.locations) {
    const context: DataForSeoKeywordMetricContext = {
      location: location.name,
      locationCode: location.code,
      languageCode: "en",
    };

    for (const keywordBatch of chunkArray(keywords, keywordMetricBatchSize)) {
      deadline.assertRemaining("keywordMetrics");
      try {
        const raw = await postDataForSeo("/v3/dataforseo_labs/google/keyword_overview/live", [{
          keywords: keywordBatch,
          language_code: context.languageCode,
          ...(context.locationCode ? { location_code: context.locationCode } : { location_name: context.location }),
          tag: `quiver-keyword-overview:${context.location}:${keywordBatch.length}`,
        }], deadline, "keywordMetrics");

        state.keywordMetrics.push(...parseKeywordMetrics(raw, context));
      } catch (error) {
        if (error instanceof DeadlineExceededError) throw error;
        state.missing.push(`DataForSEO keyword overview ${location.name}: ${errorMessage(error)}`);
      }
    }
  }
}

async function fetchAsoRankings(
  watchlist: DataForSeoWatchlist,
  state: ExportState,
  deadline: ExportDeadline,
): Promise<void> {
  const phaseEndAt = Math.min(deadline.endAt, Date.now() + asoPhaseBudgetMs);
  const phaseDeadline = new ExportDeadline(phaseEndAt - Date.now(), phaseEndAt);
  const platforms = activeAsoPlatforms(watchlist);

  if (platforms.includes("ios")) {
    const contexts = buildAsoContexts(watchlist, "ios");
    await fetchAppSearchRankings(
      "/v3/app_data/apple/app_searches/task_post",
      "/v3/app_data/apple/app_searches/task_get/advanced",
      contexts,
      watchlist.aso.quiver.iosAppId,
      state,
      phaseDeadline,
    );
  }

  if (platforms.includes("android")) {
    const androidAppId = watchlist.aso.quiver.androidAppId;
    if (!androidAppId) {
      state.missing.push("DATAFORSEO_ANDROID_APP_ID");
      return;
    }
    const contexts = buildAsoContexts(watchlist, "android");
    await fetchAppSearchRankings(
      "/v3/app_data/google/app_searches/task_post",
      "/v3/app_data/google/app_searches/task_get/advanced",
      contexts,
      androidAppId,
      state,
      phaseDeadline,
    );
  }
}

async function fetchAppSearchRankings(
  postEndpoint: string,
  getEndpoint: string,
  contexts: DataForSeoAsoTaskContext[],
  targetAppId: string,
  state: ExportState,
  deadline: ExportDeadline,
): Promise<void> {
  if (contexts.length === 0) return;

  const rankingsByBatch = await Promise.allSettled(chunkArray(contexts, appBatchSize).map(async (contextBatch) => {
    deadline.assertRemaining("asoRankings");
    try {
      const postResponse = await postDataForSeo(postEndpoint, contextBatch.map((context) => ({
        keyword: context.keyword,
        location_code: 2840,
        language_code: "en",
        depth: context.depth,
        tag: `quiver-aso:${context.platform}:${context.keyword}`,
      })), deadline, "asoRankings");

      const taskIds = extractTaskIds(postResponse);
      const batchRankings = await Promise.all(contextBatch.map(async (context, index) => {
        try {
          deadline.assertRemaining("asoRankings");
          const taskId = taskIds[index];
          if (!taskId) {
            state.missing.push(`DataForSEO ${context.platform} ASO task id missing for ${context.keyword}`);
            return null;
          }
          const result = await pollTaskGet(`${getEndpoint}/${taskId}`, deadline);
          if (!result) {
            state.missing.push(`DataForSEO ${context.platform} ASO task not ready for ${context.keyword}`);
            return null;
          }
          return parseAsoRanking(result, context, targetAppId);
        } catch (error) {
          if (error instanceof DeadlineExceededError) throw error;
          state.missing.push(`DataForSEO ASO ${context.platform} ${context.keyword}: ${errorMessage(error)}`);
          return null;
        }
      }));

      return batchRankings.filter(isDefined);
    } catch (error) {
      if (error instanceof DeadlineExceededError) throw error;
      for (const context of contextBatch) {
        state.missing.push(`DataForSEO ASO ${context.platform} ${context.keyword}: ${errorMessage(error)}`);
      }
      return [];
    }
  }));

  state.asoRankings.push(...rankingsByBatch.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  ));

  const deadlineFailure = rankingsByBatch.find((result) =>
    result.status === "rejected" && result.reason instanceof DeadlineExceededError
  );
  if (deadlineFailure?.status === "rejected") {
    throw deadlineFailure.reason;
  }
}

async function fetchCompetitorKeywords(
  watchlist: DataForSeoWatchlist,
  state: ExportState,
  deadline: ExportDeadline,
): Promise<void> {
  for (const competitor of watchlist.competitors) {
    deadline.assertRemaining("competitorKeywords");
    try {
      const raw = await postDataForSeo("/v3/dataforseo_labs/google/ranked_keywords/live", [{
        target: competitor.domain,
        location_code: 2840,
        language_code: "en",
        limit: competitorLimit,
        order_by: ["keyword_data.keyword_info.search_volume,desc"],
      }], deadline, "competitorKeywords");
      state.competitorKeywords.push(...parseCompetitorRankedKeywords(raw, competitor));
    } catch (error) {
      if (error instanceof DeadlineExceededError) throw error;
      state.missing.push(`DataForSEO competitor keywords ${competitor.name}: ${errorMessage(error)}`);
    }
  }
}

async function pollTaskGet(
  endpoint: string,
  deadline: ExportDeadline,
): Promise<unknown | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= appPollMs) {
    deadline.assertRemaining("asoRankings");
    const raw = await getDataForSeo(endpoint, deadline, "asoRankings");
    if (hasTaskResult(raw)) return raw;
    const sleepMs = Math.min(appPollIntervalMs, deadline.timeRemaining());
    if (sleepMs <= 0) break;
    await sleep(sleepMs);
  }

  deadline.assertRemaining("asoRankings");
  const finalRaw = await getDataForSeo(endpoint, deadline, "asoRankings").catch(() => null);
  return finalRaw && hasTaskResult(finalRaw) ? finalRaw : null;
}

async function postDataForSeo(
  endpoint: string,
  body: unknown,
  deadline: ExportDeadline,
  phase: DataForSeoExportPhase,
  timeoutOverrideMs?: number,
): Promise<unknown> {
  return requestDataForSeo(async () => {
    deadline.assertRemaining(phase);
    const controller = new AbortController();
    const timeoutMs = Math.min(timeoutOverrideMs ?? requestTimeoutMs, deadline.timeRemaining());
    return fetchWithRetry(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }, {
      timeoutMs,
      retries: 1,
      retryDelayMs: requestRetryDelayMs,
    }).then((response) => parseDataForSeoResponse(response, controller, timeoutMs));
  }, deadline, phase);
}

async function getDataForSeo(
  endpoint: string,
  deadline: ExportDeadline,
  phase: DataForSeoExportPhase,
): Promise<unknown> {
  return requestDataForSeo(async () => {
    deadline.assertRemaining(phase);
    const controller = new AbortController();
    const timeoutMs = Math.min(requestTimeoutMs, deadline.timeRemaining());
    return fetchWithRetry(`${apiBase}${endpoint}`, {
      headers: { Authorization: authHeader() },
      signal: controller.signal,
    }, {
      timeoutMs,
      retries: 1,
      retryDelayMs: requestRetryDelayMs,
    }).then((response) => parseDataForSeoResponse(response, controller, timeoutMs));
  }, deadline, phase);
}

async function parseDataForSeoResponse(
  response: Response,
  controller: AbortController,
  timeoutMs: number,
): Promise<unknown> {
  const raw = JSON.parse(await readResponseTextWithTimeout(response, controller, timeoutMs)) as unknown;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${dataForSeoMessage(raw)}`);
  }
  const statusCode = isRecord(raw) ? raw.status_code : undefined;
  if (typeof statusCode === "number" && statusCode >= 40000) {
    throw new Error(`status ${statusCode}${dataForSeoMessage(raw)}`);
  }
  return raw;
}

async function readResponseTextWithTimeout(
  response: Response,
  controller: AbortController,
  timeoutMs: number,
): Promise<string> {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  try {
    while (true) {
      const chunk = await readChunkWithTimeout(reader, controller, timeoutMs);
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    controller.abort(error instanceof Error ? error : undefined);
    await reader.cancel(error instanceof Error ? error : undefined).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function readChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: AbortController,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(`Timed out reading DataForSEO response body after ${timeoutMs}ms`);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([reader.read(), timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function extractTaskIds(raw: unknown): string[] {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return [];
  return raw.tasks
    .map((task) => isRecord(task) && typeof task.id === "string" ? task.id : "");
}

function extractTasks(raw: unknown): Record<string, unknown>[] {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return [];
  return raw.tasks.filter(isRecord);
}

function hasTaskResult(raw: unknown): boolean {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return false;
  const task = raw.tasks.find(isRecord);
  return !!task && Array.isArray(task.result);
}

function estimateRunCost(watchlist: DataForSeoWatchlist, mode: DataForSeoWatchlistMode): number {
  const googleKeywords = normalizeWatchlistKeywords(watchlist.google.keywords, mode).length;
  const asoKeywords = normalizeWatchlistKeywords(watchlist.aso.keywords, mode).length;
  const serpTasks = googleKeywords * watchlist.google.locations.length;
  const keywordMetricTasks = watchlist.google.locations.length *
    Math.ceil(googleKeywords / keywordMetricBatchSize);
  const asoTasks = asoKeywords * activeAsoPlatforms(watchlist).length;
  const competitorRows = watchlist.competitors.length * competitorLimit;
  const estimate = (serpTasks * 0.00465) + (keywordMetricTasks * 0.01) + (asoTasks * 0.011) +
    (watchlist.competitors.length * 0.01) + (competitorRows * 0.0001);
  return Math.round(estimate * 100) / 100;
}

function activeAsoPlatforms(watchlist: DataForSeoWatchlist): DataForSeoAsoPlatform[] {
  return watchlist.aso.platforms ?? ["ios", "android"];
}

function buildAsoContexts(
  watchlist: DataForSeoWatchlist,
  platform: DataForSeoAsoPlatform,
): DataForSeoAsoTaskContext[] {
  return normalizedAsoKeywords(watchlist)
    .map((row) => row.keyword)
    .map((keyword): DataForSeoAsoTaskContext => ({
      keyword,
      platform,
      location: "United States",
      depth: watchlist.aso.depth,
    }));
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function readWatchlist(filePath: string): DataForSeoWatchlist | null {
  if (!fs.existsSync(filePath)) return null;
  const watchlist = JSON.parse(fs.readFileSync(filePath, "utf8")) as DataForSeoWatchlist;
  const appleSearchAdsKeywords = readAppleSearchAdsKeywords(appleSearchAdsKeywordsPath);
  if (appleSearchAdsKeywords.length === 0) return watchlist;
  return {
    ...watchlist,
    aso: {
      ...watchlist.aso,
      keywords: mergeWatchlistKeywords(watchlist.aso.keywords, appleSearchAdsKeywords),
    },
  };
}

function normalizedAsoKeywords(watchlist: DataForSeoWatchlist): DataForSeoWatchlistKeyword[] {
  return normalizeWatchlistKeywords(watchlist.aso.keywords, watchlistMode);
}

function readAppleSearchAdsKeywords(filePath: string): DataForSeoWatchlistKeyword[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  const parsed = parseAppleSearchAdsKeywords(raw);
  return parsed.map((keyword) => ({ keyword, tier: "critical" as const }));
}

function parseAppleSearchAdsKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return unique(raw.flatMap(extractAppleSearchAdsKeyword));
  }
  if (!isRecord(raw)) return [];

  const candidates = [
    raw.keywords,
    raw.campaignKeywords,
    raw.rows,
    raw.items,
  ];

  return unique(candidates.flatMap((value) =>
    Array.isArray(value) ? value.flatMap(extractAppleSearchAdsKeyword) : []
  ));
}

function extractAppleSearchAdsKeyword(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim().length > 0 ? [value.trim()] : [];
  }
  if (!isRecord(value)) return [];
  if (value.enabled === false) return [];

  const status = typeof value.status === "string" ? value.status.toLowerCase() : "";
  if (status === "paused" || status === "negative" || status === "deleted") return [];

  const keyword = [
    value.keyword,
    value.term,
    value.text,
    value.searchTerm,
  ].find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);

  return typeof keyword === "string" ? [keyword.trim()] : [];
}

function mergeWatchlistKeywords(
  base: Array<string | DataForSeoWatchlistKeyword>,
  overlay: DataForSeoWatchlistKeyword[],
): Array<string | DataForSeoWatchlistKeyword> {
  const byKeyword = new Map<string, DataForSeoWatchlistKeyword>();

  for (const row of normalizeWatchlistKeywords(base, "full")) {
    byKeyword.set(row.keyword.toLowerCase(), row);
  }
  for (const row of overlay) {
    byKeyword.set(row.keyword.toLowerCase(), row);
  }

  return [...byKeyword.values()];
}

async function checkpoint(state: ExportState): Promise<void> {
  writeJson(buildDataForSeoExport(state.generatedAt, {
    googleRankings: state.googleRankings,
    asoRankings: state.asoRankings,
    competitorKeywords: state.competitorKeywords,
    keywordMetrics: state.keywordMetrics,
    missing: unique(state.missing),
    estimatedCostUsd: state.estimatedCostUsd,
    completedPhases: unique(state.completedPhases),
    failedPhases: unique(state.failedPhases),
    deadlineReached: state.deadlineReached,
    status: state.status,
    watchlistMode,
  }));
}

function writeJson(value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath }, null, 2));
}

function markDeadline(state: ExportState, phase: DataForSeoExportPhase): void {
  state.deadlineReached = true;
  state.status = "timed_out";
  state.failedPhases.push(phase);
  state.missing.push(`DataForSEO deadline reached during ${phase}`);
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function normalizeWatchlistMode(value: string | undefined | null): DataForSeoWatchlistMode {
  return value === "full" ? "full" : "live";
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

async function requestDataForSeo(
  load: () => Promise<unknown>,
  deadline: ExportDeadline,
  phase: DataForSeoExportPhase,
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= requestRetries; attempt += 1) {
    deadline.assertRemaining(phase);
    try {
      return await load();
    } catch (error) {
      lastError = error;
      if (error instanceof DeadlineExceededError) throw error;
      if (!shouldRetryDataForSeoError(error) || attempt >= requestRetries) {
        throw error;
      }
      const delayMs = Math.min(requestRetryDelayMs * attempt, deadline.timeRemaining());
      if (delayMs <= 0) {
        throw new DeadlineExceededError(`DataForSEO retry budget exhausted during ${phase}`);
      }
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("DataForSEO request failed");
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldRetryDataForSeoError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("fetch failed") ||
    message.includes("network");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

class DeadlineExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeadlineExceededError";
  }
}

class ExportDeadline {
  readonly endAt: number;

  constructor(durationMs: number, endAt?: number) {
    this.endAt = endAt ?? (Date.now() + Math.max(0, durationMs));
  }

  hasExpired(): boolean {
    return this.timeRemaining() <= 0;
  }

  timeRemaining(): number {
    return Math.max(0, this.endAt - Date.now());
  }

  assertRemaining(phase: DataForSeoExportPhase): void {
    if (this.hasExpired()) {
      throw new DeadlineExceededError(`DataForSEO deadline reached during ${phase}`);
    }
  }
}

void main();
