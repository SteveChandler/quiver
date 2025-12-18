import type { ConfidenceLevel, DataFreshness } from "@/types/api/recommendations";

export const FRESHNESS_THRESHOLDS_MS = {
  CURRENT: 3 * 60 * 60 * 1000, // 3h
  STALE: 12 * 60 * 60 * 1000, // 12h
  OUTDATED: 24 * 60 * 60 * 1000, // 24h
} as const;

function freshnessRank(f: DataFreshness): number {
  switch (f) {
    case "current":
      return 0;
    case "stale":
      return 1;
    case "outdated":
      return 2;
    case "missing":
      return 3;
  }
}

/**
 * Categorize forecast data freshness based on *recency* timestamp.
 *
 * IMPORTANT: This should be called with a timestamp like `created_at` (when data was produced),
 * not `ts` (the forecast target time, often in the future).
 */
export function calculateDataFreshness(
  dataTimestamp: string | null,
  referenceTime: Date = new Date()
): DataFreshness {
  if (!dataTimestamp) return "missing";

  const dataTime = new Date(dataTimestamp);
  const ageMs = referenceTime.getTime() - dataTime.getTime();

  // If clock skew produces negative ages, treat as current rather than stale.
  if (!isFinite(ageMs) || ageMs < 0) return "current";

  if (ageMs <= FRESHNESS_THRESHOLDS_MS.CURRENT) return "current";
  if (ageMs <= FRESHNESS_THRESHOLDS_MS.STALE) return "stale";
  return "outdated";
}

export function calculateForecastAgeHours(
  dataTimestamp: string | null,
  referenceTime: Date = new Date()
): number | null {
  if (!dataTimestamp) return null;

  const dataTime = new Date(dataTimestamp);
  const ageMs = referenceTime.getTime() - dataTime.getTime();

  if (!isFinite(ageMs)) return null;

  const ageHours = Math.max(0, ageMs) / (60 * 60 * 1000);
  return Math.round(ageHours * 10) / 10;
}

/**
 * Choose the "worst" freshness across multiple sources.
 */
export function combineFreshness(...freshnessValues: DataFreshness[]): DataFreshness {
  return freshnessValues.reduce<DataFreshness>((worst, next) => {
    return freshnessRank(next) > freshnessRank(worst) ? next : worst;
  }, "current");
}

/**
 * Returns confidence degraded by data freshness.
 */
export function calculateConfidenceLevel(
  score: number,
  freshness: DataFreshness
): ConfidenceLevel {
  if (freshness === "missing" || freshness === "outdated") {
    return "low";
  }

  if (freshness === "stale") {
    return score >= 75 ? "medium" : "low";
  }

  // current
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}
