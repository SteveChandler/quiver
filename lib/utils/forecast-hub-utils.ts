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
import { getBeachesFromDb } from "@/lib/services/beach-query-service";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
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
    const beachesResult = await getBeachesFromDb();
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

  // Attach one approved photo per region (from the region's highest-scored
  // beach). Single batched query across all regions keeps the cost flat.
  await attachRegionPhotos(summaries);

  return summaries;
}

/**
 * Attach representative approved photos to each region summary (mutates in place).
 *
 * Picks the top TWO scoring beaches per region so the hero backdrop
 * (`photoUrl`) and the hero polaroid inset (`secondaryPhotoUrl`) render
 * different images. Batch-fetches approved photos for every candidate in a
 * single Supabase query. Beach-level failures never throw; regions without
 * any approved photo simply retain null fields.
 */
async function attachRegionPhotos(
  summaries: Record<string, RegionalForecastSummary>
): Promise<void> {
  // For each beach id, remember which region(s) want it and at which rank
  // (0 = primary, 1 = secondary). A single beach can legitimately be the
  // primary pick for region A and the secondary for region B.
  type Role = "primary" | "secondary";
  const beachAssignments = new Map<
    string,
    Array<{ slug: string; role: Role }>
  >();
  const beachIdToName = new Map<string, string>();

  for (const [slug, summary] of Object.entries(summaries)) {
    const top = summary.beachConditions[0];
    const second = summary.beachConditions[1];
    if (top) {
      const list = beachAssignments.get(top.beachId) ?? [];
      list.push({ slug, role: "primary" });
      beachAssignments.set(top.beachId, list);
      beachIdToName.set(top.beachId, top.beachName);
    }
    if (second && second.beachId !== top?.beachId) {
      const list = beachAssignments.get(second.beachId) ?? [];
      list.push({ slug, role: "secondary" });
      beachAssignments.set(second.beachId, list);
      beachIdToName.set(second.beachId, second.beachName);
    }
  }

  if (beachAssignments.size === 0) return;

  try {
    const supabase = createSupabaseServiceRoleClient();
    const baseQuery = supabase
      .from("beach_photos")
      .select("beach_id, image_url")
      .in("beach_id", Array.from(beachAssignments.keys()))
      .order("fetched_at", { ascending: false });
    const { data: photos } = await withApprovedPhotos(baseQuery);
    if (!Array.isArray(photos) || photos.length === 0) return;

    // Keep the first (most recent) approved photo per beach.
    const firstPhotoByBeach = new Map<string, string>();
    for (const p of photos) {
      if (!firstPhotoByBeach.has(p.beach_id)) {
        firstPhotoByBeach.set(p.beach_id, p.image_url);
      }
    }

    for (const [beachId, url] of firstPhotoByBeach.entries()) {
      const assignments = beachAssignments.get(beachId);
      if (!assignments) continue;
      const beachName = beachIdToName.get(beachId) ?? null;
      for (const { slug, role } of assignments) {
        const summary = summaries[slug];
        if (!summary) continue;
        if (role === "primary") {
          summary.photoUrl = url;
          summary.photoBeachName = beachName;
        } else {
          summary.secondaryPhotoUrl = url;
          summary.secondaryPhotoBeachName = beachName;
        }
      }
    }
  } catch (err) {
    console.error("Failed to attach region photos:", err);
  }
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

export interface BestRegionResult {
  region: ForecastRegion;
  summary: RegionalForecastSummary;
  isLocationPersonalized: boolean;
}

/**
 * Get the closest region to the user with valid forecast data.
 *
 * If userCoords are provided, finds regions within maxDistanceMiles,
 * sorts by distance ascending, and picks the closest one with valid data.
 * Falls back to global best if no coords or no nearby regions have data.
 */
export function getBestRegionForUser(
  summaries: Record<string, RegionalForecastSummary>,
  userCoords: { lat: number; lon: number } | null,
  maxDistanceMiles: number = 300
): BestRegionResult | null {
  if (userCoords) {
    // Find regions within range, sorted by distance (closest first)
    const nearbyRegions: { region: ForecastRegion; distance: number }[] = [];
    for (const region of Object.values(FORECAST_REGIONS)) {
      const distance = calculateDistanceInMiles(userCoords, {
        lat: region.centerLat,
        lon: region.centerLon,
      });
      if (!isNaN(distance) && distance <= maxDistanceMiles) {
        nearbyRegions.push({ region, distance });
      }
    }

    // Sort by distance ascending (closest first)
    nearbyRegions.sort((a, b) => a.distance - b.distance);

    // Pick the closest region that has valid summary data
    for (const { region } of nearbyRegions) {
      const summary = summaries[region.slug];
      if (summary && summary.days[0]) {
        return { region, summary, isLocationPersonalized: true };
      }
    }
  }

  // Fall back to global best
  const globalBest = getBestRegionToday(summaries);
  if (!globalBest) return null;
  return { ...globalBest, isLocationPersonalized: false };
}

/**
 * Find the closest region to the given coordinates.
 */
export function getClosestRegion(
  userCoords: { lat: number; lon: number }
): ForecastRegion | null {
  let closest: ForecastRegion | null = null;
  let minDistance = Infinity;

  for (const region of Object.values(FORECAST_REGIONS)) {
    const distance = calculateDistanceInMiles(userCoords, {
      lat: region.centerLat,
      lon: region.centerLon,
    });
    if (!isNaN(distance) && distance < minDistance) {
      minDistance = distance;
      closest = region;
    }
  }

  return closest;
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
  slug: string | null;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  averageRating: number | null;
  skillLevel: string | null;
}

/**
 * Get the top beaches by current score.
 *
 * When userCoords are provided, filters to beaches from the closest region only.
 * Otherwise, returns top beaches across all regions.
 *
 * @param limit - Maximum number of beaches to return (default 5)
 * @param userCoords - Optional user coordinates to filter to closest region
 */
export async function getTopBeachesRightNow(
  limit: number = 5,
  userCoords?: { lat: number; lon: number } | null
): Promise<TopBeachEntry[]> {
  // Fetch beaches once and pass to getRegionalSummaries to avoid double fetch
  const beachesResult = await getBeachesFromDb();
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

  // Determine which summaries to pull beach conditions from
  let targetSummaries: RegionalForecastSummary[];

  if (userCoords) {
    const closestRegion = getClosestRegion(userCoords);
    if (closestRegion && summaries[closestRegion.slug]) {
      targetSummaries = [summaries[closestRegion.slug]];
    } else {
      targetSummaries = Object.values(summaries);
    }
  } else {
    targetSummaries = Object.values(summaries);
  }

  // Flatten beach conditions from target summaries
  const beachConditions = targetSummaries.flatMap(
    (summary) => summary.beachConditions
  );

  if (beachConditions.length === 0) {
    return [];
  }

  // Sort by current score descending and take top N
  const sorted = beachConditions
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, limit);

  // Batch fetch approved photos for the top beaches
  const topBeachIds = sorted.map((bc) => bc.beachId);
  const photoMap = new Map<string, string>();
  try {
    const supabase = createSupabaseServiceRoleClient();
    const baseQuery = supabase
      .from("beach_photos")
      .select("beach_id, image_url")
      .in("beach_id", topBeachIds)
      .order("fetched_at", { ascending: false });
    const { data: photos } = await withApprovedPhotos(baseQuery);
    if (photos) {
      for (const photo of photos) {
        // Keep only the first (most recent) photo per beach
        if (!photoMap.has(photo.beach_id)) {
          photoMap.set(photo.beach_id, photo.image_url);
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch beach photos for top beaches:", err);
  }

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
      slug: beach?.slug || null,
      city: beach?.city || null,
      state: beach?.state || null,
      imageUrl: photoMap.get(bc.beachId) || null,
      averageRating: beach?.average_rating || null,
      skillLevel: beach?.skill_level || null,
    };
  });
}
