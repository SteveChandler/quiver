export type TideForecastSelectionRow = {
  ts: string;
  tide_height_m: number | null;
  tide_phase: string | null;
  created_at?: string | null;
  source?: string | null;
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
export function compareTideForecastRows(
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

export function isPreferredTideForecastRow(
  candidate: TideForecastSelectionRow,
  incumbent: TideForecastSelectionRow,
): boolean {
  return compareTideForecastRows(candidate, incumbent) > 0;
}

export function getUtcHourKey(timestamp: string): string | null {
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return null;
  return new Date(Math.floor(timestampMs / HOUR_MS) * HOUR_MS).toISOString();
}
