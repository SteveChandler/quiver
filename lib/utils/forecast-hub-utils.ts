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
import { buildSurfWindowRecommendations } from "@/lib/recommendations/surf-window-recommendations";
import {
  buildRegionalMajorEventHoldCandidates,
  sanitizeRegionalForecastForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/regional";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { getBeachesFromDb } from "@/lib/services/beach-query-service";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
import { rankBeaches } from "@/lib/recommendations/selection";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

/**
 * Get regional forecast summaries for all regions.
 *
 * Fetches beaches for each region, retrieves cached forecasts in batches,
 * and aggregates into regional summaries.
 *
 * @param beaches - Optional pre-fetched beach array. If not provided, will fetch beaches internally.
 */
export interface GetRegionalSummariesOptions {
  now?: Date;
  baseUrl?: string;
  includeBestSurfWindows?: boolean;
  includePhotos?: boolean;
  profileExperience?: unknown;
}

async function applyRegionalMajorEventHold(
  summary: RegionalForecastSummary,
  profileExperience: unknown,
): Promise<RegionalForecastSummary> {
  const candidates = buildRegionalMajorEventHoldCandidates(summary);
  const hasPositiveRecommendation =
    summary.days.some((day) => day.topBeaches.length > 0) ||
    (summary.bestSurfWindows?.length ?? 0) > 0 ||
    summary.beachConditions.length > 0;
  const decisions = await evaluateMajorEventHoldCandidates({
    candidates:
      candidates.length === 0 && hasPositiveRecommendation
        ? [null]
        : candidates,
    profileExperience,
    applyWaterQualityHolds: true,
  });
  return sanitizeRegionalForecastForMajorEventHold(
    summary,
    candidates,
    decisions,
  );
}

export async function getRegionalSummaries(
  beaches?: Beach[],
  options: GetRegionalSummariesOptions = {}
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

  const safeBeaches = await rankBeaches(allBeaches, {
    asOf: options.now,
    compare: () => 0,
  });

  // Collect all beach IDs across all regions for batch fetch
  const allBeachIds = new Set<string>();
  const regionBeachesMap = new Map<string, Beach[]>();

  for (const region of regions) {
    const regionBeaches = getBeachesForRegion(region, safeBeaches);
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
    const regionForecastMap = new Map<string, EnhancedForecastEntity[]>();
    for (const beach of regionBeaches) {
      const result = forecastMap.get(beach.id);
      if (result && result.forecasts.length > 0) {
        regionForecastMap.set(beach.id, result.forecasts);
      }
    }

    // Aggregate into regional summary
    const selectionNow = options.now ?? new Date();
    const summary = aggregateRegionalForecast(
      region,
      regionBeaches,
      regionForecastMap,
      { now: selectionNow }
    );
    summary.generatedAt = selectionNow;
    if (options.includeBestSurfWindows !== false) {
      summary.bestSurfWindows = buildBestSurfWindowsForRegion(
        regionBeaches,
        regionForecastMap,
        { ...options, now: selectionNow },
      );
    }
    summaries[region.slug] = await applyRegionalMajorEventHold(
      summary,
      options.profileExperience ?? null,
    );
  }

  // Attach one approved photo per region (from the region's highest-scored
  // beach). Single batched query across all regions keeps the cost flat.
  if (options.includePhotos !== false) {
    await attachRegionPhotos(summaries);
  }

  return summaries;
}

async function resolveBeaches(beaches?: Beach[]): Promise<Beach[] | null> {
  if (beaches) return beaches;

  const beachesResult = await getBeachesFromDb();
  if (!beachesResult.success || !beachesResult.data) {
    console.error("Failed to fetch beaches for forecast hub");
    return null;
  }

  return beachesResult.data;
}

function buildBestSurfWindowsForRegion(
  regionBeaches: Beach[],
  regionForecastMap: Map<string, EnhancedForecastEntity[]>,
  options: GetRegionalSummariesOptions
): SurfWindowRecommendation[] {
  const groups = regionBeaches
    .map((beach) => ({
      beach,
      forecasts: regionForecastMap.get(beach.id) ?? [],
    }))
    .filter((group) => group.forecasts.length > 0);
  return buildSurfWindowRecommendations(groups, {
    maxRecommendations: groups.length,
    maxWindowsPerBeach: 1,
    now: options.now,
    baseUrl: options.baseUrl,
  }).recommendations;
}

export function createEmptyRegionalSummary(
  region: ForecastRegion
): RegionalForecastSummary {
  const generatedAt = new Date();
  const bestDay = {
    date: generatedAt,
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
  };

  return {
    region,
    generatedAt,
    days: [],
    bestDay,
    upcomingSwells: [],
    beachConditions: [],
    bestSurfWindows: [],
    recommendationAvailability: {
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "hold-state-unavailable",
    },
    photoUrl: null,
    photoBeachName: null,
    secondaryPhotoUrl: null,
    secondaryPhotoBeachName: null,
    stats: {
      totalBeaches: 0,
      beachesWithData: 0,
      avgRegionScore: 0,
    },
  };
}

/**
 * Get a full forecast summary for one region only.
 *
 * The /forecast hub uses this path after resolving the active region so a
 * single page request does not aggregate every Quiver forecast region.
 */
export async function getRegionalSummary(
  region: ForecastRegion,
  beaches?: Beach[],
  options: GetRegionalSummariesOptions = {}
): Promise<RegionalForecastSummary> {
  const allBeaches = await resolveBeaches(beaches);
  if (!allBeaches) {
    return createEmptyRegionalSummary(region);
  }

  const safeBeaches = await rankBeaches(allBeaches, {
    asOf: options.now,
    compare: () => 0,
  });
  const regionBeaches = getBeachesForRegion(region, safeBeaches);
  if (regionBeaches.length === 0) {
    return createEmptyRegionalSummary(region);
  }

  const beachIds = regionBeaches.map((beach) => beach.id);
  const forecastMap = await getBatchFreshForecastsFromCache(beachIds, 168);
  const regionForecastMap = new Map<string, EnhancedForecastEntity[]>();

  for (const beach of regionBeaches) {
    const result = forecastMap.get(beach.id);
    if (result && result.forecasts.length > 0) {
      regionForecastMap.set(beach.id, result.forecasts);
    }
  }

  const selectionNow = options.now ?? new Date();
  const summary = aggregateRegionalForecast(
    region,
    regionBeaches,
    regionForecastMap,
    { now: selectionNow }
  );
  summary.generatedAt = selectionNow;

  if (options.includeBestSurfWindows !== false) {
    summary.bestSurfWindows = buildBestSurfWindowsForRegion(
      regionBeaches,
      regionForecastMap,
      { ...options, now: selectionNow }
    );
  }

  const policyFilteredSummary = await applyRegionalMajorEventHold(
    summary,
    options.profileExperience ?? null,
  );

  if (options.includePhotos !== false) {
    await attachRegionPhotos({ [region.slug]: policyFilteredSummary });
  }

  return policyFilteredSummary;
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
  userCoords?: { lat: number; lon: number } | null,
  profileExperience: unknown = null,
): Promise<TopBeachEntry[]> {
  // Fetch beaches once and pass to getRegionalSummaries to avoid double fetch
  const beachesResult = await getBeachesFromDb();
  if (!beachesResult.success || !beachesResult.data) {
    console.error("Failed to fetch beaches for top beaches");
    return [];
  }

  const allBeaches = beachesResult.data;

  // Build lookup from beach ID -> Beach for URL generation
  const beachMap = new Map<string, Beach>();
  for (const beach of allBeaches) {
    beachMap.set(beach.id, beach);
  }

  // Determine which summaries to pull beach conditions from
  let targetSummaries: RegionalForecastSummary[];

  if (userCoords) {
    const closestRegion = getClosestRegion(userCoords);
    if (closestRegion) {
      targetSummaries = [
        await getRegionalSummary(closestRegion, allBeaches, {
          includeBestSurfWindows: false,
          includePhotos: false,
          profileExperience,
        }),
      ];
    } else {
      const summaries = await getRegionalSummaries(allBeaches, {
        includeBestSurfWindows: false,
        includePhotos: false,
        profileExperience,
      });
      targetSummaries = Object.values(summaries);
    }
  } else {
    const summaries = await getRegionalSummaries(allBeaches, {
      includeBestSurfWindows: false,
      includePhotos: false,
      profileExperience,
    });
    targetSummaries = Object.values(summaries);
  }

  // Build lookup from beach ID -> region name
  const beachRegionMap = new Map<string, string>();
  for (const summary of targetSummaries) {
    for (const bc of summary.beachConditions) {
      beachRegionMap.set(bc.beachId, summary.region.name);
    }
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
