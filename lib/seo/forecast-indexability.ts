import * as Sentry from "@sentry/nextjs";

import { chunk } from "@/lib/utils/chunk";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStalenessThreshold } from "@/lib/config/forecast-staleness";
import {
  evaluateBeachForecastIndexability,
  type IndexabilityDecision,
} from "@/lib/seo/indexability";
import {
  getLocalDateString,
  resolveBeachTimezone,
} from "@/lib/utils/timezone-utils";

export interface ForecastCoverageRow {
  beach_id: string | null;
  forecast_at: string | null;
  wave_height: string | number | null;
  updated_at: string | null;
  data_source: string | null;
}

export interface ForecastIndexabilitySnapshot {
  forecastAvailable: boolean;
  selectedStateComplete: boolean;
  forecastFresh: boolean;
  forecastValidAt: string | null;
  sourceDataUpdatedAt: string | null;
  primaryDataSource: string | null;
  isStale: boolean;
}

export interface ForecastIndexabilityBeach {
  id: string;
  timezone?: string | null;
}

interface SubPageDataAvailability {
  /** The sub-page's own dataset resolved to a real value this render. */
  hasSubPageData: boolean;
}

const FORECAST_COVERAGE_SELECT =
  "beach_id, forecast_at, wave_height, updated_at, data_source";
const BEACH_ID_BATCH_SIZE = 20;

/**
 * The coverage read failed and this instance has no earlier answer for the
 * beach, so its forecast state is not known. Distinct from "no snapshot",
 * which means the beach has no forecast.
 */
export const FORECAST_COVERAGE_UNKNOWN = "forecast-coverage-unknown" as const;

export type ForecastCoverage =
  | ForecastIndexabilitySnapshot
  | undefined
  | typeof FORECAST_COVERAGE_UNKNOWN;

/** Snapshot by beach id; a beach is unknown only when its read failed. */
export type ForecastCoverageLookup = ReadonlyMap<
  string,
  ForecastIndexabilitySnapshot | typeof FORECAST_COVERAGE_UNKNOWN
>;

export function forecastCoverageFor(
  lookup: ForecastCoverageLookup,
  beachId: string,
): ForecastCoverage {
  return lookup.get(beachId);
}

/**
 * One decision for the beach detail page, shared by the sitemap and the page's
 * generateMetadata so a submitted URL cannot answer with noindex.
 *
 * Unknown coverage skips only the forecast gate: an ISR page or sitemap must not
 * store noindex for an hour because one coverage read failed.
 */
export function evaluateBeachPageIndexability(
  snapshot: ForecastCoverage,
  canonicalValid: boolean,
): IndexabilityDecision {
  if (snapshot === FORECAST_COVERAGE_UNKNOWN) {
    return canonicalValid
      ? { indexable: true, reason: "forecast-coverage-unknown" }
      : { indexable: false, reason: "invalid-canonical" };
  }
  if (!snapshot) return { indexable: false, reason: "forecast-missing" };

  return evaluateBeachForecastIndexability({
    canonicalValid,
    forecastAvailable: snapshot.forecastAvailable,
    selectedStateComplete: snapshot.selectedStateComplete,
    forecastFresh: snapshot.forecastFresh,
  });
}

/**
 * One predicate for beach tides/water-temp sub-pages, called by both the sitemap
 * and generateMetadata so a submitted URL cannot answer with noindex.
 */
export function isBeachSubPageIndexable(
  snapshot: ForecastCoverage,
  canonicalPath: string,
  availability: SubPageDataAvailability,
): boolean {
  if (!availability.hasSubPageData) return false;
  if (snapshot === FORECAST_COVERAGE_UNKNOWN) return !canonicalPath.startsWith("/beach/");
  if (!snapshot) return false;

  return evaluateBeachForecastIndexability({
    canonicalValid: !canonicalPath.startsWith("/beach/"),
    forecastAvailable: snapshot.forecastAvailable,
    selectedStateComplete: snapshot.selectedStateComplete,
    forecastFresh: snapshot.forecastFresh,
  }).indexable;
}

function hasValue(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function isComplete(row: ForecastCoverageRow): boolean {
  if (!hasValue(row.beach_id) || !hasValue(row.wave_height) || !hasValue(row.data_source)) {
    return false;
  }

  return Boolean(
    row.forecast_at && !Number.isNaN(Date.parse(row.forecast_at)) &&
      row.updated_at && !Number.isNaN(Date.parse(row.updated_at)),
  );
}

function isFresh(row: ForecastCoverageRow, nowMs: number): boolean {
  if (!row.updated_at || !row.data_source) return false;
  const updatedMs = Date.parse(row.updated_at);
  if (Number.isNaN(updatedMs)) return false;

  const thresholdHours = getStalenessThreshold(row.data_source);
  return nowMs - updatedMs <= thresholdHours * 60 * 60 * 1000;
}

function sortByForecastTime(rows: ForecastCoverageRow[]): ForecastCoverageRow[] {
  return [...rows].sort(
    (left, right) => Date.parse(left.forecast_at ?? "") - Date.parse(right.forecast_at ?? ""),
  );
}

function selectNearTermForecast(
  completeRows: ForecastCoverageRow[],
  now: Date,
  timezone?: string | null,
): ForecastCoverageRow | null {
  const resolvedTimezone = resolveBeachTimezone(timezone);
  const today = getLocalDateString(now, resolvedTimezone);
  const tomorrow = getLocalDateString(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    resolvedTimezone,
  );
  const upcomingRows = completeRows.filter(
    (row) => Date.parse(row.forecast_at!) >= now.getTime(),
  );

  return (
    upcomingRows.find(
      (row) => getLocalDateString(new Date(row.forecast_at!), resolvedTimezone) === today,
    ) ??
    upcomingRows.find(
      (row) => getLocalDateString(new Date(row.forecast_at!), resolvedTimezone) === tomorrow,
    ) ??
    null
  );
}

export function buildForecastIndexabilitySnapshot(
  rows: ForecastCoverageRow[],
  now = new Date(),
  timezone?: string | null,
): ForecastIndexabilitySnapshot {
  const completeRows = sortByForecastTime(rows.filter(isComplete));
  // The public answer is today-first and tomorrow-second. Do not let a stale
  // extended-horizon row determine indexability when the near-term answer is fresh.
  const selected = selectNearTermForecast(completeRows, now, timezone);
  const selectedFresh = selected ? isFresh(selected, now.getTime()) : false;

  return {
    forecastAvailable: rows.length > 0,
    selectedStateComplete: Boolean(selected),
    forecastFresh: selectedFresh,
    forecastValidAt: selected?.forecast_at ?? null,
    sourceDataUpdatedAt: selected?.updated_at ?? null,
    primaryDataSource: selected?.data_source ?? null,
    isStale: Boolean(selected && !selectedFresh),
  };
}



/**
 * The coverage read failed. Thrown, not returned as an empty Map, so a cache
 * layer does not store "no forecast" for every beach.
 */
export class ForecastIndexabilityUnavailableError extends Error {
  constructor(stage: string, detail: string) {
    super(`[getForecastIndexabilityForBeaches] ${stage}: ${detail}`);
    this.name = "ForecastIndexabilityUnavailableError";
  }
}

const UNAVAILABLE_REPORT_WINDOW_MS = 5 * 60 * 1000;
let lastUnavailableReportAtMs: number | null = null;

let suppressedUnavailableReports = 0;

/**
 * Report a coverage read failure at most once per five minutes; every page
 * render hits it during one outage. The window is module state, so it is per
 * server instance: N warm instances can each report once per window. The log
 * line uses the same window and carries the count it suppressed.
 */
export function reportForecastCoverageUnavailable(
  error: ForecastIndexabilityUnavailableError,
): void {
  const nowMs = Date.now();
  if (
    lastUnavailableReportAtMs !== null &&
    nowMs - lastUnavailableReportAtMs < UNAVAILABLE_REPORT_WINDOW_MS
  ) {
    suppressedUnavailableReports += 1;
    return;
  }
  console.error(error.message, {
    suppressedSinceLastReport: suppressedUnavailableReports,
  });
  lastUnavailableReportAtMs = nowMs;
  suppressedUnavailableReports = 0;
  Sentry.captureException(error, {
    level: "warning",
    tags: { area: "seo-indexability" },
  });
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Fetch the small forecast-coverage envelope needed by the sitemap. Keeping
 * this separate from the page report avoids one full forecast query per URL.
 */
export async function getForecastIndexabilityForBeaches(
  beaches: ReadonlyArray<string | ForecastIndexabilityBeach>,
): Promise<Map<string, ForecastIndexabilitySnapshot>> {
  const timezoneByBeachId = new Map<string, string | null | undefined>();
  const ids = [
    ...new Set(
      beaches.flatMap((beach) => {
        const beachId = typeof beach === "string" ? beach : beach.id;
        if (!beachId) return [];
        if (typeof beach !== "string") {
          timezoneByBeachId.set(beachId, beach.timezone);
        }
        return [beachId];
      }),
    ),
  ];
  if (ids.length === 0) return new Map();

  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  let supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>;
  try {
    supabase = await createSupabaseServiceRoleClient();
  } catch (error) {
    throw new ForecastIndexabilityUnavailableError("client creation failed", errorMessage(error));
  }

  let responses: Array<{
    data: ForecastCoverageRow[];
    error: { message: string } | null;
  }>;
  try {
    responses = await Promise.all(
      chunk(ids, BEACH_ID_BATCH_SIZE).map(async (batch) => {
        const result = await supabase
          .from("enhanced_forecasts")
          .select(FORECAST_COVERAGE_SELECT)
          .in("beach_id", batch)
          .gte("forecast_at", start)
          .lt("forecast_at", end)
          .order("forecast_at", { ascending: true })
          .limit(1000);

        return {
          data: (result.data ?? []) as ForecastCoverageRow[],
          error: result.error,
        };
      }),
    );
  } catch (error) {
    throw new ForecastIndexabilityUnavailableError("coverage query failed", errorMessage(error));
  }

  const failed = responses.flatMap(({ error }) => (error ? [error.message] : []));
  if (failed.length > 0) {
    throw new ForecastIndexabilityUnavailableError("coverage query failed", failed.join("; "));
  }

  const rowsByBeach = new Map<string, ForecastCoverageRow[]>();
  for (const row of responses.flatMap(({ data }) => data)) {
    if (!row.beach_id) continue;
    const rows = rowsByBeach.get(row.beach_id) ?? [];
    rows.push(row);
    rowsByBeach.set(row.beach_id, rows);
  }

  return new Map(
    ids.map((beachId) => [
      beachId,
      buildForecastIndexabilitySnapshot(
        rowsByBeach.get(beachId) ?? [],
        now,
        timezoneByBeachId.get(beachId),
      ),
    ]),
  );
}
