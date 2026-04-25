/**
 * Regional Forecast Utilities
 *
 * Utilities for aggregating forecast data across multiple beaches within a region.
 * Used by regional forecast pages to provide 7-day outlooks, swell event detection,
 * and beach rankings.
 *
 * @module lib/utils/regional-forecast-utils
 */

import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { getWaveSizeDescription } from "@/lib/utils/wave-formatters";
import { classifyWindDirection, getWindScore } from "@/lib/utils/wind-classification";

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
  /** Best time window to surf this day */
  bestTimeSlot: "dawn-patrol" | "morning" | "midday" | "afternoon" | "evening";
  /** Top 5 beaches with best conditions for this day */
  topBeaches: Array<{
    id: string;
    name: string;
    slug: string;
    score: number;
    waveHeight: number;
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
 * Scoring factors:
 * - Wave height: Ideal range 3-6ft scores highest
 * - Wind direction: Offshore +25, light +15, onshore 0
 * - Swell period: Longer period = better quality (+2 per second over 10s)
 * - Consistency: Lower variance across day = higher score
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
  beach: Beach
): number {
  if (forecasts.length === 0) return 0;

  let totalScore = 0;
  let count = 0;

  for (const forecast of forecasts) {
    let score = 0;

    // Wave height scoring (0-40 points)
    const waveHeight = parseFloat(forecast.wave_height || "0");
    if (waveHeight >= 3 && waveHeight <= 6) {
      score += 40; // Ideal range
    } else if (waveHeight >= 2 && waveHeight < 3) {
      score += 30; // Small but surfable
    } else if (waveHeight > 6 && waveHeight <= 8) {
      score += 35; // Larger but still manageable
    } else if (waveHeight > 8 && waveHeight <= 12) {
      score += 25; // Big waves (advanced only)
    } else if (waveHeight >= 1 && waveHeight < 2) {
      score += 15; // Minimal but rideable
    } else if (waveHeight < 1) {
      score += 5; // Too small
    } else {
      score += 10; // Too big or extreme
    }

    // Wind scoring (0-25 points) — exact compass/keyword matching
    const windDirection = forecast.wind_direction || "";
    score += getWindScore(classifyWindDirection(windDirection));

    // Swell period scoring (0-20 points)
    const swellPeriod = parseFloat(forecast.swell_1_period || forecast.wave_period || "0");
    if (swellPeriod > 10) {
      const periodBonus = Math.min(20, (swellPeriod - 10) * 2);
      score += periodBonus;
    }

    // Confidence bonus (0-15 points)
    const confidence = forecast.confidence_score || 0;
    score += Math.min(15, confidence * 0.15);

    totalScore += score;
    count++;
  }

  // Calculate average and normalize to 0-100
  const avgScore = count > 0 ? totalScore / count : 0;
  return Math.round(Math.min(100, Math.max(0, avgScore)));
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
  forecastMap: Map<string, EnhancedForecastEntity[]>
): RegionalForecastSummary {
  const generatedAt = new Date();
  const days: DaySummary[] = [];

  // Group forecasts by date
  const dateMap = new Map<string, Map<string, EnhancedForecastEntity[]>>();

  for (const [beachId, forecasts] of forecastMap.entries()) {
    for (const forecast of forecasts) {
      // Prefer forecast_at (extract date part), fallback to forecast_date
      const date = forecast.forecast_at
        ? forecast.forecast_at.split('T')[0]
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

  // Filter to today and future dates, then take first 7 days.
  // Use HST offset (-10h) as the earliest US timezone so we never
  // prematurely filter out "today" for any US-based user.
  const nowWithOffset = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const today = nowWithOffset.toISOString().split("T")[0]; // YYYY-MM-DD
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
        beachScores.push({ beachId, score, avgHeight });
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

    // Determine best time slot (simplified - could be more sophisticated)
    const bestTimeSlot: "dawn-patrol" | "morning" | "midday" | "afternoon" | "evening" =
      windConditions === "offshore" ? "dawn-patrol" : "morning";

    // Rank top 5 beaches
    const topBeaches = beachScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ beachId, score, avgHeight }) => {
        const beach = beaches.find((b) => b.id === beachId)!;
        return {
          id: beach.id,
          name: beach.name || "Unknown Beach",
          slug: beach.slug || "",
          score,
          waveHeight: avgHeight,
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
      dayOfWeek: date.toLocaleDateString("en-US", { weekday: "long" }),
      score: dayScore,
      avgWaveHeight,
      waveRange,
      dominantWindDirection,
      windConditions,
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

    // Current score (first forecast)
    const currentForecasts = forecasts.filter((f) => f.forecast_date === sortedDates[0]).slice(0, 3);
    const currentScore = calculateDayScore(currentForecasts, beach);
    const currentWaveHeight = parseFloat(currentForecasts[0]?.wave_height || "0");

    // Calculate trend
    const next24hForecasts = forecasts.slice(0, 8); // Next 24 hours (3hr intervals)
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
          const date = new Date(dateString + "T00:00:00Z");
          bestDayName = date.toLocaleDateString("en-US", { weekday: "long" });
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
