/**
 * Regional Forecast Utilities
 *
 * Utilities for aggregating forecast data across multiple beaches within a region.
 * Used by regional forecast pages to provide 7-day outlooks, swell event detection,
 * and beach rankings.
 *
 * @module lib/utils/regional-forecast-utils
 */

import { formatInTimeZone } from "date-fns-tz";

import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";
import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";
import { getWaveSizeDescription } from "@/lib/utils/wave-formatters";
import { classifyWindDirection } from "@/lib/utils/wind-classification";
import { scoreNativeForecastDay } from "@/lib/scoring/native-condition-score";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-constants";

/**
 * Weekday for a calendar date. The date is pinned to UTC noon and read back in
 * UTC so the label can never drift onto a neighbouring day on a server whose
 * zone is behind UTC — the same convention the day cards use for the date they
 * print beside this weekday.
 */
function weekdayForDate(dateString: string): string {
  return new Date(`${dateString}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/**
 * The timezone shared by most of a region's beaches.
 *
 * Taken by majority rather than from the first row because a handful of beaches
 * carry a wrong stamp — Galveston, Corpus Christi and Long Island are all
 * recorded as America/Los_Angeles — and one of those must not decide the
 * calendar for an entire region.
 */
function resolveRegionTimezone(beaches: Beach[]): string {
  const counts = new Map<string, number>();
  for (const beach of beaches) {
    if (!beach.timezone) continue;
    counts.set(beach.timezone, (counts.get(beach.timezone) ?? 0) + 1);
  }

  let resolved = DEFAULT_TIMEZONE;
  let highest = 0;
  for (const [timezone, count] of counts) {
    if (count > highest) {
      resolved = timezone;
      highest = count;
    }
  }
  return resolved;
}

interface ForecastInterval {
  windowStart: string;
  windowEnd: string;
}

function resolveForecastInterval(
  forecasts: readonly EnhancedForecastEntity[],
): ForecastInterval | null {
  const parsedInstants = forecasts.map((forecast) => {
    if (
      typeof forecast.forecast_at !== "string" ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(forecast.forecast_at)
    ) {
      return null;
    }
    const milliseconds = Date.parse(forecast.forecast_at);
    return Number.isFinite(milliseconds) ? milliseconds : null;
  });
  if (parsedInstants.some((instant) => instant === null)) return null;
  const instants = Array.from(new Set(parsedInstants as number[])).sort(
    (left, right) => left - right,
  );
  if (instants.length !== forecasts.length) return null;
  if (instants.length < 2) return null;

  const cadenceMs = instants[1] - instants[0];
  if (
    cadenceMs <= 0 ||
    instants.slice(2).some((instant, index) => {
      const previous = instants[index + 1];
      return instant - previous !== cadenceMs;
    })
  ) {
    return null;
  }

  return {
    windowStart: new Date(instants[0]).toISOString(),
    windowEnd: new Date(instants[instants.length - 1] + cadenceMs).toISOString(),
  };
}

/**
 * Summary of forecast conditions for a single day across a region
 */
export interface DaySummary {
  /** Date object for the day */
  date: Date;
  /** ISO date string (YYYY-MM-DD) */
  dateString: string;
  /** Day name (e.g., "Monday", "Tuesday") */
  dayOfWeek: string;
  /** Aggregate score 0-100 for this day */
  score: number;
  /** Average wave height across all beaches (feet) */
  avgWaveHeight: number;
  /** Range of wave heights [min, max] in feet */
  waveRange: [number, number];
  /** Most common wind direction across beaches */
  dominantWindDirection: string;
  /** Overall wind conditions for the region */
  windConditions: "offshore" | "light" | "onshore";
  /** Most common objective tide status across the region. */
  dominantTideStatus?: string | null;
  /** Best time window to surf this day */
  bestTimeSlot: "dawn-patrol" | "morning" | "midday" | "afternoon" | "evening";
  /** Complete ranked beach pool. Policy filtering applies display limits later. */
  topBeaches: Array<{
    id: string;
    name: string;
    slug: string;
    score: number;
    waveHeight: number;
    /** Exact server-generated interval represented by this daily ranking. */
    windowStart?: string;
    windowEnd?: string;
  }>;
  /** Count of beaches with good conditions (score > 60) */
  beachesWithGoodConditions: number;
}

/**
 * Detected swell event with peak timing and characteristics
 */
export interface SwellEvent {
  /** Event start date */
  startDate: Date;
  /** Peak conditions date */
  peakDate: Date;
  /** Event end date */
  endDate: Date;
  /** Swell direction (e.g., "NW", "SW", "S") */
  direction: string;
  /** Swell period in seconds */
  period: number;
  /** Wave height range [min, max] in feet */
  heightRange: [number, number];
  /** Human-readable size description */
  size: string;
  /** Human-readable event description */
  description: string;
}

/**
 * Summary of conditions for a single beach within the region
 */
export interface BeachConditionSummary {
  beachId: string;
  beachName: string;
  beachSlug: string;
  /** State name or abbreviation (e.g. "CA") — used to build hierarchical URLs */
  state: string;
  /** City name (e.g. "San Diego") — used to build hierarchical URLs */
  city: string;
  /** Country name (e.g. "USA") or null for domestic — used to build hierarchical URLs */
  country: string | null;
  /** Current conditions score (0-100) */
  currentScore: number;
  /** Current wave height (feet) */
  currentWaveHeight: number;
  /** Exact server-generated interval represented by the current ranking. */
  currentWindowStart?: string;
  currentWindowEnd?: string;
  /** Trend over next 24 hours */
  trend: "improving" | "steady" | "declining";
  /** Best day name for this beach */
  bestDay: string;
  /** Best day score */
  bestDayScore: number;
}

/**
 * Complete regional forecast summary with 7-day outlook
 */
export interface RegionalForecastSummary {
  /** The forecast region */
  region: ForecastRegion;
  /** Timestamp when summary was generated */
  generatedAt: Date;
  /** 7 days of forecast summaries */
  days: DaySummary[];
  /** The best day overall for the region */
  bestDay: DaySummary;
  /** Upcoming swell events */
  upcomingSwells: SwellEvent[];
  /** Individual beach condition summaries */
  beachConditions: BeachConditionSummary[];
  /** Top surf-window recommendations for the active regional pilot surface. */
  bestSurfWindows?: SurfWindowRecommendation[];
  /** Availability of positive regional recommendations after policy filtering. */
  recommendationAvailability?: RecommendationAvailability;
  /**
   * Approved photo representing the region (from `beach_photos` table).
   * Attached by `getRegionalSummaries` — null when no top beach has an
   * approved photo on file. Used as the hero backdrop and guide-card art.
   */
  photoUrl: string | null;
  /** Beach name for the attached photo — used for alt text. */
  photoBeachName: string | null;
  /**
   * Second approved photo (from the region's second-highest-scored beach).
   * Used by the hero polaroid inset so the backdrop and polaroid aren't the
   * same image. Null when the region only has one approved beach photo —
   * callers should fall back to `photoUrl` for graceful degradation.
   */
  secondaryPhotoUrl: string | null;
  /** Beach name for the secondary photo. */
  secondaryPhotoBeachName: string | null;
  /** Regional statistics */
  stats: {
    totalBeaches: number;
    beachesWithData: number;
    avgRegionScore: number;
  };
}

/**
 * Filter beaches by region criteria (state and optional city)
 *
 * @param region - The forecast region to filter by
 * @param allBeaches - Array of all beaches
 * @returns Beaches matching the region's geographic filters
 *
 * @example
 * ```typescript
 * const sdBeaches = getBeachesForRegion(
 *   FORECAST_REGIONS['san-diego'],
 *   beaches
 * );
 * ```
 */
export function getBeachesForRegion(
  region: ForecastRegion,
  allBeaches: Beach[]
): Beach[] {
  // Filter by state first
  let filtered = allBeaches.filter((beach) =>
    region.states.some((state) => beach.state?.toLowerCase() === state.toLowerCase())
  );

  // If region specifies cities, further filter by city
  if (region.cities && region.cities.length > 0) {
    filtered = filtered.filter((beach) =>
      region.cities!.some((city) => beach.city?.toLowerCase() === city.toLowerCase())
    );
  }

  // If region specifies latitude bounds, filter by latitude
  if (region.latBounds) {
    filtered = filtered.filter((beach) => {
      const lat = beach.lat;
      if (lat == null) return true; // Include beaches without coordinates
      if (region.latBounds!.min != null && lat < region.latBounds!.min) return false;
      if (region.latBounds!.max != null && lat >= region.latBounds!.max) return false;
      return true;
    });
  }

  return filtered;
}

/**
 * Calculate aggregate score for a day based on forecast conditions
 *
 * Scores the best native-compatible slot in the provided forecast group.
 *
 * @param forecasts - Array of forecasts for a single day
 * @param beach - The beach being scored
 * @returns Score from 0-100
 *
 * @example
 * ```typescript
 * const score = calculateDayScore(dayForecasts, beach);
 * // Returns: 85
 * ```
 */
export function calculateDayScore(
  forecasts: EnhancedForecastEntity[],
  _beach: Beach
): number {
  return scoreNativeForecastDay(forecasts);
}

/**
 * Detect upcoming swell events from forecast data
 *
 * Identifies significant wave height increases (>40% jump) and tracks
 * swell direction changes to identify distinct swell events.
 *
 * @param forecastMap - Map of beach IDs to their forecast arrays
 * @returns Array of detected swell events
 *
 * @example
 * ```typescript
 * const swells = detectSwellEvents(forecastsByBeach);
 * // Returns: [{ startDate: ..., peakDate: ..., direction: "NW", ... }]
 * ```
 */
export function detectSwellEvents(
  forecastMap: Map<string, EnhancedForecastEntity[]>
): SwellEvent[] {
  const events: SwellEvent[] = [];

  // Aggregate forecasts by date across all beaches
  const dateMap = new Map<string, EnhancedForecastEntity[]>();

  for (const forecasts of forecastMap.values()) {
    for (const forecast of forecasts) {
      // Prefer forecast_at (extract date part), fallback to forecast_date
      const date = forecast.forecast_at
        ? forecast.forecast_at.split('T')[0]
        : forecast.forecast_date;
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(forecast);
    }
  }

  // Sort dates
  const sortedDates = Array.from(dateMap.keys()).sort();

  // Track wave heights by date
  const dateWaveHeights: Array<{
    date: string;
    avgHeight: number;
    avgPeriod: number;
    dominantDirection: string;
  }> = [];

  for (const date of sortedDates) {
    const forecasts = dateMap.get(date) || [];
    if (forecasts.length === 0) continue;

    // Calculate average wave height
    const heights = forecasts
      .map((f) => parseFloat(f.wave_height || "0"))
      .filter((h) => h > 0);
    const avgHeight = heights.length > 0 ? heights.reduce((a, b) => a + b, 0) / heights.length : 0;

    // Calculate average period
    const periods = forecasts
      .map((f) => parseFloat(f.swell_1_period || f.wave_period || "0"))
      .filter((p) => p > 0);
    const avgPeriod = periods.length > 0 ? periods.reduce((a, b) => a + b, 0) / periods.length : 0;

    // Find dominant direction
    const directions = forecasts
      .map((f) => f.swell_1_direction || f.wave_direction)
      .filter((d) => d != null);
    const directionCounts = new Map<string, number>();
    for (const dir of directions) {
      directionCounts.set(dir!, (directionCounts.get(dir!) || 0) + 1);
    }
    const dominantDirection =
      Array.from(directionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N";

    dateWaveHeights.push({ date, avgHeight, avgPeriod, dominantDirection });
  }

  // Detect swell events (significant increases in wave height)
  for (let i = 1; i < dateWaveHeights.length - 1; i++) {
    const prev = dateWaveHeights[i - 1];
    const current = dateWaveHeights[i];
    const next = dateWaveHeights[i + 1];

    // Check for significant increase (>40% jump)
    // Guard against division by zero when prev.avgHeight is 0
    const increaseFromPrev =
      prev.avgHeight > 0
        ? (current.avgHeight - prev.avgHeight) / prev.avgHeight
        : current.avgHeight > 0
          ? 1
          : 0;

    if (increaseFromPrev > 0.4 && current.avgHeight >= 3) {
      // Found swell event
      let startIdx = i;
      let peakIdx = i;
      let endIdx = i;

      // Find peak day (highest wave height)
      let peakHeight = current.avgHeight;
      for (let j = i; j < dateWaveHeights.length; j++) {
        if (dateWaveHeights[j].avgHeight > peakHeight) {
          peakHeight = dateWaveHeights[j].avgHeight;
          peakIdx = j;
        }
        // Stop when waves drop significantly
        if (j > i && dateWaveHeights[j].avgHeight < current.avgHeight * 0.7) {
          endIdx = j - 1;
          break;
        }
        endIdx = j;
      }

      const peak = dateWaveHeights[peakIdx];
      const end = dateWaveHeights[endIdx];

      // Surfline-parity: heightRange is the swell event's face Hs at peak.
      // Downstream formatter brackets via floor/ceil. Don't synthesize a
      // × 1.5 set expansion here — that would re-inflate the upper bound.
      const avgHeight = peak.avgHeight;

      events.push({
        startDate: new Date(current.date + "T00:00:00Z"),
        peakDate: new Date(peak.date + "T00:00:00Z"),
        endDate: new Date(end.date + "T00:00:00Z"),
        direction: peak.dominantDirection,
        period: peak.avgPeriod,
        heightRange: [avgHeight, avgHeight],
        size: getWaveSizeDescription(avgHeight),
        description: `${getWaveSizeDescription(avgHeight)} ${peak.dominantDirection} swell with ${peak.avgPeriod.toFixed(0)}s period`,
      });

      // Skip ahead to avoid duplicate detection
      i = endIdx;
    }
  }

  return events;
}

/**
 * Aggregate regional forecast across all beaches in a region
 *
 * Main aggregation function that combines all beach forecasts into a
 * comprehensive regional summary with 7-day outlook, best day identification,
 * swell event detection, and beach rankings.
 *
 * @param region - The forecast region
 * @param beaches - Beaches in the region
 * @param forecastMap - Map of beach IDs to their forecast arrays
 * @returns Complete regional forecast summary
 *
 * @example
 * ```typescript
 * const summary = aggregateRegionalForecast(
 *   FORECAST_REGIONS['southern-california'],
 *   beaches,
 *   forecastsByBeachId
 * );
 * ```
 */
export function aggregateRegionalForecast(
  region: ForecastRegion,
  beaches: Beach[],
  forecastMap: Map<string, EnhancedForecastEntity[]>,
  options: { now?: Date } = {}
): RegionalForecastSummary {
  // Same reference instant the window selector uses, so "now" means the same
  // thing in the ranking score and in the surf window beside it.
  const referenceNow = options.now ?? new Date();
  const referenceMs = referenceNow.getTime();
  const generatedAt = referenceNow;
  const days: DaySummary[] = [];

  // One timezone for the whole region, so the day a row is filed under, the day
  // that counts as "today", and the weekday printed on the card all describe the
  // same calendar day. Bucketing on the UTC date part instead filed a Pacific
  // evening under tomorrow.
  const regionTimezone = resolveRegionTimezone(beaches);

  // Group forecasts by date
  const dateMap = new Map<string, Map<string, EnhancedForecastEntity[]>>();

  for (const [beachId, forecasts] of forecastMap.entries()) {
    for (const forecast of forecasts) {
      // Prefer forecast_at (resolved to the region's calendar day), fallback to
      // forecast_date, which is already a bare local date.
      const date = forecast.forecast_at
        ? formatInTimeZone(
            new Date(forecast.forecast_at),
            regionTimezone,
            "yyyy-MM-dd",
          )
        : forecast.forecast_date;
      if (!dateMap.has(date)) {
        dateMap.set(date, new Map());
      }
      if (!dateMap.get(date)!.has(beachId)) {
        dateMap.get(date)!.set(beachId, []);
      }
      dateMap.get(date)!.get(beachId)!.push(forecast);
    }
  }

  // Filter to today and future dates, then take first 7 days. "Today" is the
  // region's calendar day; the previous -10h HST fudge existed only because
  // this comparison was made against a UTC date.
  const today = formatInTimeZone(referenceNow, regionTimezone, "yyyy-MM-dd");
  const sortedDates = Array.from(dateMap.keys())
    .filter((date) => date >= today)
    .sort()
    .slice(0, 7);

  // Build day summaries
  for (const dateString of sortedDates) {
    const beachForecasts = dateMap.get(dateString)!;
    const date = new Date(dateString + "T00:00:00Z");

    // Calculate aggregate metrics
    const allForecasts: EnhancedForecastEntity[] = [];
    const beachScores: Array<{
      beachId: string;
      score: number;
      avgHeight: number;
      interval: ForecastInterval | null;
    }> = [];

    for (const [beachId, forecasts] of beachForecasts.entries()) {
      allForecasts.push(...forecasts);
      const beach = beaches.find((b) => b.id === beachId);
      if (beach) {
        const score = calculateDayScore(forecasts, beach);
        const heights = forecasts
          .map((f) => parseFloat(f.wave_height || "0"))
          .filter((h) => h > 0);
        const avgHeight = heights.length > 0 ? heights.reduce((a, b) => a + b, 0) / heights.length : 0;
        beachScores.push({
          beachId,
          score,
          avgHeight,
          interval: resolveForecastInterval(forecasts),
        });
      }
    }

    // Calculate wave height range
    const allHeights = allForecasts
      .map((f) => parseFloat(f.wave_height || "0"))
      .filter((h) => h > 0);
    const waveRange: [number, number] =
      allHeights.length > 0
        ? [Math.min(...allHeights), Math.max(...allHeights)]
        : [0, 0];

    const avgWaveHeight =
      allHeights.length > 0 ? allHeights.reduce((a, b) => a + b, 0) / allHeights.length : 0;

    // Determine dominant wind direction
    const windDirections = allForecasts
      .map((f) => f.wind_direction)
      .filter((d) => d != null) as string[];
    const windCounts = new Map<string, number>();
    for (const dir of windDirections) {
      windCounts.set(dir, (windCounts.get(dir) || 0) + 1);
    }
    const dominantWindDirection =
      Array.from(windCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Variable";

    // Determine wind conditions using shared classification
    const windClassifications = windDirections.map((d) => classifyWindDirection(d));
    const offshoreCount = windClassifications.filter((c) => c === "offshore").length;
    const lightCount = windClassifications.filter((c) => c === "light").length;
    const windConditions: "offshore" | "light" | "onshore" =
      offshoreCount > windDirections.length / 2
        ? "offshore"
        : lightCount > windDirections.length / 2
          ? "light"
          : "onshore";

    const tideStatuses = allForecasts
      .map((forecast) => forecast.tide_status)
      .filter((status): status is string => Boolean(status));
    const tideCounts = new Map<string, number>();
    for (const status of tideStatuses) {
      tideCounts.set(status, (tideCounts.get(status) || 0) + 1);
    }
    const dominantTideStatus =
      Array.from(tideCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    // Determine best time slot (simplified - could be more sophisticated)
    const bestTimeSlot: "dawn-patrol" | "morning" | "midday" | "afternoon" | "evening" =
      windConditions === "offshore" ? "dawn-patrol" : "morning";

    // Retain the complete ranked pool so policy filtering can happen before
    // the display cap is applied.
    const topBeaches = beachScores
      .sort((a, b) => b.score - a.score)
      .map(({ beachId, score, avgHeight, interval }) => {
        const beach = beaches.find((b) => b.id === beachId)!;
        return {
          id: beach.id,
          name: beach.name || "Unknown Beach",
          slug: beach.slug || "",
          score,
          waveHeight: avgHeight,
          ...(interval
            ? {
                windowStart: interval.windowStart,
                windowEnd: interval.windowEnd,
              }
            : {}),
        };
      });

    // Count beaches with good conditions
    const beachesWithGoodConditions = beachScores.filter((b) => b.score > 60).length;

    // Calculate aggregate day score
    const dayScore =
      beachScores.length > 0
        ? Math.round(beachScores.reduce((sum, b) => sum + b.score, 0) / beachScores.length)
        : 0;

    days.push({
      date,
      dateString,
      dayOfWeek: weekdayForDate(dateString),
      score: dayScore,
      avgWaveHeight,
      waveRange,
      dominantWindDirection,
      windConditions,
      dominantTideStatus,
      bestTimeSlot,
      topBeaches,
      beachesWithGoodConditions,
    });
  }

  // Identify best day
  const bestDay = days.reduce((best, day) => (day.score > best.score ? day : best), days[0] || {
    date: new Date(),
    dateString: "",
    dayOfWeek: "",
    score: 0,
    avgWaveHeight: 0,
    waveRange: [0, 0] as [number, number],
    dominantWindDirection: "",
    windConditions: "onshore" as const,
    dominantTideStatus: null,
    bestTimeSlot: "morning" as const,
    topBeaches: [],
    beachesWithGoodConditions: 0,
  });

  // Detect swell events
  const upcomingSwells = detectSwellEvents(forecastMap);

  // Build beach condition summaries
  const beachConditions: BeachConditionSummary[] = [];
  for (const beach of beaches) {
    const forecasts = forecastMap.get(beach.id);
    if (!forecasts || forecasts.length === 0) continue;

    // Current score: the next few hours from the reference instant, NOT the
    // day's first rows. Scoring dawn rows in the afternoon reported a stale
    // "EPIC" for conditions that had already passed, contradicting the
    // future-only surf window rendered beside it.
    const chronological = forecasts
      .filter((forecast) => Boolean(forecast.forecast_at))
      .sort(
        (left, right) =>
          Date.parse(left.forecast_at) - Date.parse(right.forecast_at),
      );
    const upcoming = chronological.filter(
      (forecast) => Date.parse(forecast.forecast_at) >= referenceMs,
    );
    // Once a beach's horizon is exhausted, fall back to its most recent rows
    // so it still ranks rather than dropping out of the region entirely.
    const currentForecasts = (
      upcoming.length > 0 ? upcoming : chronological.slice(-3)
    ).slice(0, 3);
    const currentInterval = resolveForecastInterval(currentForecasts);
    const currentScore = calculateDayScore(currentForecasts, beach);
    const currentWaveHeight = parseFloat(currentForecasts[0]?.wave_height || "0");

    // Trend over the next 24h, taken from the same now-anchored chronological
    // series as currentScore — comparing it against raw insertion order made
    // "improving"/"declining" a comparison between two different baselines.
    const next24hForecasts = (
      upcoming.length > 0 ? upcoming : chronological
    ).slice(0, 8);
    const scores = next24hForecasts.map((f) => calculateDayScore([f], beach));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trend: "improving" | "steady" | "declining" =
      avgScore > currentScore + 10 ? "improving" : avgScore < currentScore - 10 ? "declining" : "steady";

    // Find best day for this beach - calculate from all forecast data
    let bestDayName = "";
    let bestDayScore = 0;
    for (const dateString of sortedDates) {
      const beachForecasts = dateMap.get(dateString)?.get(beach.id);
      if (beachForecasts && beachForecasts.length > 0) {
        const dayScore = calculateDayScore(beachForecasts, beach);
        if (dayScore > bestDayScore) {
          bestDayScore = dayScore;
          bestDayName = weekdayForDate(dateString);
        }
      }
    }

    beachConditions.push({
      beachId: beach.id,
      beachName: beach.name || "Unknown Beach",
      beachSlug: beach.slug || "",
      state: beach.state || "",
      city: beach.city || "",
      country: beach.country ?? null,
      currentScore,
      currentWaveHeight,
      ...(currentInterval
        ? {
            currentWindowStart: currentInterval.windowStart,
            currentWindowEnd: currentInterval.windowEnd,
          }
        : {}),
      trend,
      bestDay: bestDayName || "Unknown",
      bestDayScore,
    });
  }

  // Sort by current score so the top beach is the best one
  beachConditions.sort((a, b) => b.currentScore - a.currentScore);

  // Calculate stats
  const beachesWithData = Array.from(forecastMap.values()).filter((f) => f.length > 0).length;
  const avgRegionScore =
    days.length > 0 ? Math.round(days.reduce((sum, day) => sum + day.score, 0) / days.length) : 0;

  return {
    region,
    generatedAt,
    days,
    bestDay,
    upcomingSwells,
    beachConditions,
    photoUrl: null,
    photoBeachName: null,
    secondaryPhotoUrl: null,
    secondaryPhotoBeachName: null,
    stats: {
      totalBeaches: beaches.length,
      beachesWithData,
      avgRegionScore,
    },
  };
}
