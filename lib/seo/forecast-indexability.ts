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

export interface SubPageDataAvailability {
  /** The sub-page's own dataset resolved to a real value this render. */
  hasSubPageData: boolean;
}

const FORECAST_COVERAGE_SELECT =
  "beach_id, forecast_at, wave_height, updated_at, data_source";
const BEACH_ID_BATCH_SIZE = 20;

export interface BeachPageIndexabilityOptions {
  /** The rendered path is the beach's canonical hierarchical URL. */
  canonicalValid: boolean;
}

/**
 * One decision for the beach detail page itself, called by both the sitemap and
 * the page's generateMetadata.
 *
 * Until 2026-09-01 the page derived its robots tag from the live surf report
 * while the sitemap read this coverage snapshot. The two were evaluated on
 * different clocks and from different row selections, so a beach could be
 * listed in the sitemap while answering noindex, and flip back an hour later.
 * Ahrefs recorded exactly that on the 24 and 31 Aug crawls.
 */
export function evaluateBeachPageIndexability(
  snapshot: ForecastIndexabilitySnapshot | undefined,
  options: BeachPageIndexabilityOptions,
): IndexabilityDecision {
  if (!snapshot) return { indexable: false, reason: "forecast-missing" };

  return evaluateBeachForecastIndexability({
    canonicalValid: options.canonicalValid,
    forecastAvailable: snapshot.forecastAvailable,
    selectedStateComplete: snapshot.selectedStateComplete,
    forecastFresh: snapshot.forecastFresh,
  });
}

export function isBeachPageIndexable(
  snapshot: ForecastIndexabilitySnapshot | undefined,
  options: BeachPageIndexabilityOptions,
): boolean {
  return evaluateBeachPageIndexability(snapshot, options).indexable;
}

/**
 * One predicate for beach tides/water-temp sub-pages, called by both the sitemap
 * and generateMetadata so a submitted URL cannot answer with noindex.
 */
export function isBeachSubPageIndexable(
  snapshot: ForecastIndexabilitySnapshot | undefined,
  canonicalPath: string,
  availability: SubPageDataAvailability,
): boolean {
  if (!snapshot) return false;
  if (!availability.hasSubPageData) return false;

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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

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
    console.error("[getForecastIndexabilityForBeaches] Client creation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Map();
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
    console.error("[getForecastIndexabilityForBeaches] Coverage query failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Map();
  }

  if (responses.some(({ error }) => error)) {
    console.error("[getForecastIndexabilityForBeaches] Coverage query failed", {
      errors: responses
        .map(({ error }) => error?.message)
        .filter(Boolean),
    });
    return new Map();
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
