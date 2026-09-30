export type TideForecastSelectionRow = {
  ts: string;
  tide_height_m: number | null;
  tide_phase?: string | null;
  created_at?: string | null;
  source?: string | null;
  station_id?: string | null;
};

const HOUR_MS = 60 * 60 * 1000;

function sourceRank(source: string | null | undefined): number {
  if (source === "noaa") return 2;
  if (source === "noaa_hilo_interpolated") return 1;
  return 0;
}

function createdAtRank(createdAt: string | null | undefined): number {
  if (!createdAt) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(createdAt);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function timestampDistanceFromUtcHour(timestamp: string): number {
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return Number.POSITIVE_INFINITY;
  return Math.abs(timestampMs - Math.floor(timestampMs / HOUR_MS) * HOUR_MS);
}

function compareStrings(left: string | null | undefined, right: string | null | undefined): number {
  const leftValue = left ?? "";
  const rightValue = right ?? "";
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

function compareHigher(left: number, right: number): number {
  if (left > right) return 1;
  if (left < right) return -1;
  return 0;
}

/** Returns positive when candidate should replace incumbent. */
function compareTideForecastRows(
  candidate: TideForecastSelectionRow,
  incumbent: TideForecastSelectionRow,
): number {
  const sourceDelta = sourceRank(candidate.source) - sourceRank(incumbent.source);
  if (sourceDelta !== 0) return sourceDelta;

  const createdAtDelta = compareHigher(
    createdAtRank(candidate.created_at),
    createdAtRank(incumbent.created_at),
  );
  if (createdAtDelta !== 0) return createdAtDelta;

  const candidateDistance = timestampDistanceFromUtcHour(candidate.ts);
  const incumbentDistance = timestampDistanceFromUtcHour(incumbent.ts);
  const distanceDelta = compareHigher(incumbentDistance, candidateDistance);
  if (distanceDelta !== 0) return distanceDelta;

  const timestampDelta = compareStrings(candidate.ts, incumbent.ts);
  if (timestampDelta !== 0) return timestampDelta;

  const heightDelta = compareHigher(
    candidate.tide_height_m ?? Number.NEGATIVE_INFINITY,
    incumbent.tide_height_m ?? Number.NEGATIVE_INFINITY,
  );
  if (heightDelta !== 0) return heightDelta;

  return compareStrings(candidate.tide_phase, incumbent.tide_phase);
}

function isPreferredTideForecastRow(
  candidate: TideForecastSelectionRow,
  incumbent: TideForecastSelectionRow,
): boolean {
  return compareTideForecastRows(candidate, incumbent) > 0;
}

function getUtcHourKey(timestamp: string): string | null {
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return null;
  return new Date(Math.floor(timestampMs / HOUR_MS) * HOUR_MS).toISOString();
}

/** Returns positive when candidate was written by the later ingestion. */
function compareIngestion(
  candidate: TideForecastSelectionRow,
  incumbent: TideForecastSelectionRow,
): number {
  const createdAtDelta = compareHigher(
    createdAtRank(candidate.created_at),
    createdAtRank(incumbent.created_at),
  );
  if (createdAtDelta !== 0) return createdAtDelta;

  const sourceDelta = sourceRank(candidate.source) - sourceRank(incumbent.source);
  if (sourceDelta !== 0) return sourceDelta;

  return compareStrings(candidate.station_id, incumbent.station_id);
}

/**
 * Reduce one beach's tide_forecasts rows to the single series a reader shows.
 *
 * The station is the one the latest ingestion assigned: the station of the
 * most recently written row. The refresh cron re-resolves the nearest NOAA
 * station on every run and upserts on (beach_id, ts, source), so a beach
 * whose station changed keeps the old station's rows until they age out;
 * mixing the two puts a fake turning point at every hour. Within that
 * station, each UTC hour keeps one row and direct `noaa` beats
 * `noaa_hilo_interpolated`: a failed hourly fetch falls back to hilo for the
 * same station, and the direct rows it could not refresh stay the better
 * prediction.
 *
 * Rows without provenance (no station_id or created_at) form one series.
 */
export function selectTideSeries<T extends TideForecastSelectionRow>(rows: readonly T[]): T[] {
  let latest: T | null = null;
  for (const row of rows) {
    if (!latest || compareIngestion(row, latest) > 0) latest = row;
  }
  if (!latest) return [];

  const stationId = latest.station_id ?? null;
  const byHour = new Map<string, T>();
  for (const row of rows) {
    if ((row.station_id ?? null) !== stationId) continue;
    const hourKey = getUtcHourKey(row.ts);
    if (!hourKey) continue;
    const incumbent = byHour.get(hourKey);
    if (!incumbent || isPreferredTideForecastRow(row, incumbent)) byHour.set(hourKey, row);
  }

  return [...byHour.values()].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}
