import { createContextLogger } from "@/lib/logger";
import { fetchPointMarineForecastPayload } from "./client";
import {
  buildPointForecastCandidates,
  selectNearestValidCandidate,
  type PointCoordinate,
} from "./candidates";
import {
  hasCompleteSwellComponent,
  isAllZeroWaveHeightSeries,
  normalizePointMarineForecastRows,
} from "./normalizer";
import {
  POINT_MARINE_FORECAST_MODEL,
  POINT_MARINE_FORECAST_SCHEMA_VERSION,
  POINT_MARINE_FORECAST_SOURCE,
  PointMarineForecastUnavailableError,
  type PointMarineForecastPayload,
  type PointMarineForecastResponseV1,
} from "./types";

const log = createContextLogger("PointMarineForecastService");
const CACHE_TTL_MS = 10 * 60 * 1000;
export const POINT_MARINE_FORECAST_MAX_STALE_AGE_MS = 6 * 60 * 60 * 1000;
export const POINT_MARINE_FORECAST_DEADLINE_MS = 8 * 1000;
const MAX_DAYS = 10;

interface CacheEntry {
  response: PointMarineForecastResponseV1;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(point: PointCoordinate, days: number): string {
  return `${point.lat.toFixed(4)},${point.lon.toFixed(4)}:${days}`;
}

function isValidPayload(
  payload: PointMarineForecastPayload,
  rows: ReturnType<typeof normalizePointMarineForecastRows>,
): boolean {
  return !isAllZeroWaveHeightSeries(payload)
    && rows.some(hasCompleteSwellComponent);
}

function staleResponse(response: PointMarineForecastResponseV1): PointMarineForecastResponseV1 {
  return { ...response, stale: true };
}

function canServeStaleResponse(
  response: PointMarineForecastResponseV1,
  nowMs: number,
): boolean {
  const fetchedAtMs = Date.parse(response.fetchedAt);
  if (!Number.isFinite(fetchedAtMs)) return false;
  if (nowMs - fetchedAtMs > POINT_MARINE_FORECAST_MAX_STALE_AGE_MS) return false;

  return response.rows.some((row) => {
    const forecastAtMs = Date.parse(row.forecastAt);
    return Number.isFinite(forecastAtMs) && forecastAtMs >= nowMs;
  });
}

function createUpstreamDeadline(args: { signal?: AbortSignal }): {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = (): void => controller.abort();

  if (args.signal?.aborted) {
    controller.abort();
  } else {
    args.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, POINT_MARINE_FORECAST_DEADLINE_MS);

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      args.signal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function awaitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(abortError("Point marine forecast request aborted"));
    };
    const onResolve = (value: T): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    promise.then(onResolve, onReject);
  });
}

export function clearPointMarineForecastCache(): void {
  cache.clear();
}

export async function fetchPointMarineForecast(args: {
  lat: number;
  lon: number;
  days?: number;
  signal?: AbortSignal;
  now?: Date;
}): Promise<PointMarineForecastResponseV1> {
  if (args.signal?.aborted) {
    const error = new Error("Point marine forecast request aborted");
    error.name = "AbortError";
    throw error;
  }

  const days = Math.min(Math.max(Math.trunc(args.days ?? 10), 1), MAX_DAYS);
  const requestedPoint = { lat: args.lat, lon: args.lon };
  const key = cacheKey(requestedPoint, days);
  const now = args.now ?? new Date();
  const cached = cache.get(key);

  if (
    cached
    && cached.expiresAt > now.getTime()
    && canServeStaleResponse(cached.response, now.getTime())
  ) {
    return cached.response;
  }

  const candidates = buildPointForecastCandidates(requestedPoint);
  const validResponses: Array<PointCoordinate & {
    sampledPoint: PointCoordinate;
    rows: ReturnType<typeof normalizePointMarineForecastRows>;
  }> = [];
  let lastError: unknown = null;
  const upstreamDeadline = createUpstreamDeadline({ signal: args.signal });

  try {
    for (const candidate of candidates) {
      if (upstreamDeadline.signal.aborted) break;

      try {
        const payload = await awaitWithAbort(
          fetchPointMarineForecastPayload({
            lat: candidate.lat,
            lon: candidate.lon,
            days,
            signal: upstreamDeadline.signal,
          }),
          upstreamDeadline.signal,
        );
        const rows = normalizePointMarineForecastRows(payload, days);
        if (isValidPayload(payload, rows)) {
          validResponses.push({
            lat: candidate.lat,
            lon: candidate.lon,
            sampledPoint: candidate,
            rows,
          });
          if (candidate.lat === requestedPoint.lat && candidate.lon === requestedPoint.lon) {
            break;
          }
        }
      } catch (error) {
        if (args.signal?.aborted) throw error;
        if (upstreamDeadline.timedOut()) {
          lastError = new Error("Point marine forecast upstream deadline exceeded");
          break;
        }
        if (error instanceof Error && error.name === "AbortError") throw error;
        lastError = error;
      }
    }
  } finally {
    upstreamDeadline.dispose();
  }

  const selected = selectNearestValidCandidate(requestedPoint, validResponses);
  if (selected) {
    const response: PointMarineForecastResponseV1 = {
      schemaVersion: POINT_MARINE_FORECAST_SCHEMA_VERSION,
      source: POINT_MARINE_FORECAST_SOURCE,
      sourceModel: POINT_MARINE_FORECAST_MODEL,
      requestedPoint,
      sampledPoint: { lat: selected.sampledPoint.lat, lon: selected.sampledPoint.lon },
      sampleResolution:
        selected.sampledPoint.lat === requestedPoint.lat && selected.sampledPoint.lon === requestedPoint.lon
          ? "exact"
          : "offshore_shifted",
      modelRunAt: null,
      fetchedAt: now.toISOString(),
      stale: false,
      rows: selected.rows,
    };
    cache.set(key, { response, expiresAt: now.getTime() + CACHE_TTL_MS });
    return response;
  }

  if (cached && canServeStaleResponse(cached.response, now.getTime())) {
    return staleResponse(cached.response);
  }

  log.warn("Point marine forecast unavailable", {
    lat: args.lat,
    lon: args.lon,
    days,
    error: lastError instanceof Error ? lastError.message : undefined,
  });
  throw new PointMarineForecastUnavailableError();
}
