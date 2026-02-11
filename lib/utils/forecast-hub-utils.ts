/**
 * Forecast Hub Utilities
 *
 * Shared data-fetching logic for regional forecast summaries.
 * Used by the /forecast hub page and the landing page conditions snapshot.
 *
 * @module lib/utils/forecast-hub-utils
 */

import {
  FORECAST_REGIONS,
  type ForecastRegion,
} from "@/lib/data/forecast-regions";
import {
  aggregateRegionalForecast,
  getBeachesForRegion,
  type RegionalForecastSummary,
} from "@/lib/utils/regional-forecast-utils";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import type { Beach } from "@/types/database";

/**
 * Get regional forecast summaries for all regions.
 *
 * Fetches beaches for each region, retrieves cached forecasts in batches,
 * and aggregates into regional summaries.
 *
 * @param beaches - Optional pre-fetched beach array. If not provided, will fetch beaches internally.
 */
export async function getRegionalSummaries(
  beaches?: Beach[]
): Promise<Record<string, RegionalForecastSummary>> {
  const regions = Object.values(FORECAST_REGIONS);
  const summaries: Record<string, RegionalForecastSummary> = {};

  // Fetch all beaches once if not provided
  let allBeaches: Beach[];
  if (beaches) {
    allBeaches = beaches;
  } else {
    const beachesResult = await getBeaches();
    if (!beachesResult.success || !beachesResult.data) {
      console.error("Failed to fetch beaches for forecast hub");
      return summaries;
    }
    allBeaches = beachesResult.data;
  }

  // Collect all beach IDs across all regions for batch fetch
  const allBeachIds = new Set<string>();
  const regionBeachesMap = new Map<string, Beach[]>();

  for (const region of regions) {
    const regionBeaches = getBeachesForRegion(region, allBeaches);
    regionBeachesMap.set(region.slug, regionBeaches);
    regionBeaches.forEach((beach) => allBeachIds.add(beach.id));
  }

  // Batch fetch all forecasts at once (2 queries total instead of N*2)
  const forecastMap = await getBatchFreshForecastsFromCache(
    Array.from(allBeachIds),
    168 // 7 days in hours
  );

  // Build summaries for each region
  for (const region of regions) {
    const regionBeaches = regionBeachesMap.get(region.slug) || [];

    // Filter forecast map to only this region's beaches
    const regionForecastMap = new Map();
    for (const beach of regionBeaches) {
      const result = forecastMap.get(beach.id);
      if (result && result.forecasts.length > 0) {
        regionForecastMap.set(beach.id, result.forecasts);
      }
    }

    // Aggregate into regional summary
    summaries[region.slug] = aggregateRegionalForecast(
      region,
      regionBeaches,
      regionForecastMap
    );
  }

  return summaries;
}

/**
 * Get the best region for today based on current conditions.
 */
export function getBestRegionToday(
  summaries: Record<string, RegionalForecastSummary>
): { region: ForecastRegion; summary: RegionalForecastSummary } | null {
  let bestRegion: ForecastRegion | null = null;
  let bestSummary: RegionalForecastSummary | null = null;
  let bestScore = 0;

  for (const [, summary] of Object.entries(summaries)) {
    // Use first day's score as "today" score
    const todayScore = summary.days[0]?.score || 0;

    if (todayScore > bestScore) {
      bestScore = todayScore;
      bestRegion = summary.region;
      bestSummary = summary;
    }
  }

  if (bestRegion && bestSummary) {
    return { region: bestRegion, summary: bestSummary };
  }

  return null;
}

/**
 * A single beach entry in the "Best Right Now" ranking.
 */
export interface TopBeachEntry {
  beachId: string;
  beachName: string;
  score: number;
  waveHeight: number;
  regionName: string;
  href: string | null;
}

/**
 * Get the top beaches by current score across all regions.
 *
 * Flattens beachConditions from every region, enriches each with a URL
 * via `getBeachHrefSafe`, sorts by score descending, and returns the top N.
 *
 * @param limit - Maximum number of beaches to return (default 5)
 */
export async function getTopBeachesRightNow(
  limit: number = 5
): Promise<TopBeachEntry[]> {
  // Fetch beaches once and pass to getRegionalSummaries to avoid double fetch
  const beachesResult = await getBeaches();
  if (!beachesResult.success || !beachesResult.data) {
    console.error("Failed to fetch beaches for top beaches");
    return [];
  }

  const allBeaches = beachesResult.data;
  const summaries = await getRegionalSummaries(allBeaches);

  // Build lookup from beach ID -> Beach for URL generation
  const beachMap = new Map<string, Beach>();
  for (const beach of allBeaches) {
    beachMap.set(beach.id, beach);
  }

  // Build lookup from beach ID -> region name
  const beachRegionMap = new Map<string, string>();
  for (const summary of Object.values(summaries)) {
    for (const bc of summary.beachConditions) {
      beachRegionMap.set(bc.beachId, summary.region.name);
    }
  }

  // Flatten all beach conditions across all regions
  const allBeachConditions = Object.values(summaries).flatMap(
    (summary) => summary.beachConditions
  );

  if (allBeachConditions.length === 0) {
    return [];
  }

  // Sort by current score descending and take top N
  const sorted = allBeachConditions
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, limit);

  return sorted.map((bc) => {
    const beach = beachMap.get(bc.beachId);
    const href = beach
      ? getBeachHrefSafe({
          id: beach.id,
          slug: beach.slug,
          city: beach.city,
          state: beach.state,
          country: beach.country,
        })
      : null;

    return {
      beachId: bc.beachId,
      beachName: bc.beachName,
      score: bc.currentScore,
      waveHeight: bc.currentWaveHeight,
      regionName: beachRegionMap.get(bc.beachId) || "Unknown",
      href,
    };
  });
}
