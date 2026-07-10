import type { Beach } from "@/types/database";
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";
import { API_BATCH_CONFIG } from "@/lib/constants/ui";
import { fetchInBatches } from "@/lib/utils/batch-fetch";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";

export type ConditionSummary = "GOOD" | "FAIR" | "CHECK" | "UNKNOWN";

const VALID_CONDITION_SUMMARIES = new Set<ConditionSummary>([
  "GOOD",
  "FAIR",
  "CHECK",
  "UNKNOWN",
]);

/**
 * Dependencies for fetchNearbyBeaches — injected so the module
 * can be tested without real API calls.
 */
export interface BeachLoaderDeps {
  /** Cached fetch function for the nearby beaches API */
  fetchNearbyBeaches: (lat: number, lon: number) => Promise<any>;
}

/**
 * Result of loadBeachesAndWaveHeights — pure data, no side effects.
 */
export interface BeachLoaderResult {
  /** Resolved list of beaches to display on map (max 20) */
  locations: Beach[];
  /** Map from beach ID to wave height (includes interpolated values) */
  waveHeightMap: Map<string, number | undefined>;
  /** Map from beach ID to canonical forecast display label */
  displayForecastMap: Map<string, ForecastDisplay | undefined>;
  /** Map from beach ID to water temperature string (e.g., "52") */
  waterTempMap: Map<string, string | undefined>;
  /** Map from beach ID to 0-100 condition score */
  conditionScoreMap: Map<string, number | undefined>;
  /** Map from beach ID to native-aligned condition summary */
  conditionSummaryMap: Map<string, ConditionSummary>;
  /** Map from beach ID to parsed swell/wind partition for the flow field */
  partitionsMap: Map<string, SwellPartition>;
  /** Map from beach ID to parsed swell/wind partitions by forecast timeline step */
  partitionsTimelineMap: Map<string, SwellPartition[]>;
}

export interface BeachLoaderOptions {
  timeline?: "hourly";
}

/**
 * Resolve which beaches to display and fetch their wave heights.
 *
 * This is a pure async function — the caller is responsible for setting
 * React state with the returned result.
 *
 * Beach resolution priority:
 * 1. If `providedBeaches` is non-empty, use those (sliced to 20)
 * 2. Otherwise fetch from nearby API, falling back to public list
 *
 * Wave height fetching:
 * - Batch-fetches from `/api/forecasts/bulk`
 * - Interpolates missing heights from the nearest beach with data
 *
 * @param latitude - Map center latitude
 * @param longitude - Map center longitude
 * @param providedBeaches - Beaches from parent prop (may be undefined)
 * @param deps - Injectable dependencies
 */
export async function loadBeachesAndWaveHeights(
  latitude: number,
  longitude: number,
  providedBeaches: Beach[] | undefined,
  deps: BeachLoaderDeps,
  options: BeachLoaderOptions = {},
): Promise<BeachLoaderResult> {
  let locations: Beach[] = [];

  // Use provided beaches prop first (filtered beaches from parent)
  if (providedBeaches && providedBeaches.length > 0) {
    locations = providedBeaches.slice(0, 20);
  } else {
    // Fallback to API fetch when no beaches prop provided
    try {
      const response = await deps.fetchNearbyBeaches(latitude, longitude);
      locations = (response?.data as Beach[]) || [];
    } catch (err) {
      console.warn("Nearby beaches API failed", err);
    }

    // Fallback to public beaches list and filter by distance client-side
    if (locations.length === 0) {
      try {
        const res = await fetch("/api/beaches", {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const json = await res.json();
          const all: Beach[] = json?.beaches || json?.data?.beaches || [];
          const { calculateDistanceInMiles } = await import(
            "@/lib/utils/distance-utils"
          );
          locations = all
            .map((b) => ({
              ...b,
              _d: calculateDistanceInMiles(
                { lat: latitude, lon: longitude },
                { lat: b.lat ?? NaN, lon: b.lon ?? NaN }
              ),
            }))
            .filter((b: any) => isFinite(b._d) && b._d <= 30)
            .sort((a: any, b: any) => a._d - b._d)
            .slice(0, 20);
        }
      } catch (fallbackErr) {
        console.error("Public beaches list fetch failed", fallbackErr);
      }
    }

    // Limit to 20 beaches max
    locations = locations.slice(0, 20);
  }

  // Fetch wave heights for all beaches rendered by the map markers.
  const waveHeightMap = new Map<string, number | undefined>();
  const displayForecastMap = new Map<string, ForecastDisplay | undefined>();
  const waterTempMap = new Map<string, string | undefined>();
  const conditionScoreMap = new Map<string, number | undefined>();
  const conditionSummaryMap = new Map<string, ConditionSummary>();
  const partitionsMap = new Map<string, SwellPartition>();
  const partitionsTimelineMap = new Map<string, SwellPartition[]>();
  const beachesForWaveData = locations;

  if (beachesForWaveData.length > 0) {
    try {
      const allBeachIds = beachesForWaveData
        .map((beach) => beach.id)
        .filter(Boolean) as string[];

      const results = await fetchInBatches({
        items: allBeachIds,
        batchSize: API_BATCH_CONFIG.BEACH_ID_BATCH_SIZE,
        fetchBatch: async (batchIds) => {
          const timelineParam = options.timeline === "hourly" ? "&timeline=hourly" : "";
          const response = await fetch(
            `/api/forecasts/bulk?beachIds=${batchIds.join(",")}${timelineParam}`
          );
          if (!response.ok) {
            if (response.status !== 400) {
              throw new Error(
                `Bulk forecast API returned ${response.status}`
              );
            }
            return null;
          }
          return response.json();
        },
        onBatchError: (error, batchIndex) => {
          console.warn(`Wave height batch ${batchIndex} failed:`, error);
        },
      });

      results.forEach((data) => {
        const forecasts = data?.data?.forecasts || {};
        Object.entries(forecasts).forEach(([beachId, waveHeight]) => {
          const parsed =
            typeof waveHeight === "number"
              ? waveHeight
              : parseFloat(waveHeight as string);
          if (!isNaN(parsed)) {
            waveHeightMap.set(beachId, parsed);
          }
        });

        const displayForecasts = data?.data?.displayForecasts || {};
        Object.entries(displayForecasts).forEach(([beachId, display]) => {
          const forecastDisplay = display as ForecastDisplay | null | undefined;
          if (forecastDisplay?.label) {
            displayForecastMap.set(beachId, forecastDisplay);
          }
        });

        const waterTemps = data?.data?.waterTemps || {};
        Object.entries(waterTemps).forEach(([beachId, temp]) => {
          if (temp !== null && temp !== undefined) {
            waterTempMap.set(beachId, temp as string);
          }
        });

        const conditionScores = data?.data?.conditionScores || {};
        Object.entries(conditionScores).forEach(([beachId, score]) => {
          const parsed =
            typeof score === "number" ? score : parseFloat(score as string);
          if (!isNaN(parsed)) {
            conditionScoreMap.set(beachId, parsed);
          }
        });

        const conditionSummaries = data?.data?.conditionSummaries || {};
        Object.entries(conditionSummaries).forEach(([beachId, summary]) => {
          if (VALID_CONDITION_SUMMARIES.has(summary as ConditionSummary)) {
            conditionSummaryMap.set(beachId, summary as ConditionSummary);
          }
        });

        const swellPartitions = data?.data?.swellPartitions || {};
        Object.entries(swellPartitions).forEach(([beachId, partition]) => {
          if (partition && typeof partition === "object") {
            partitionsMap.set(beachId, partition as SwellPartition);
          }
        });

        const swellPartitionTimeline =
          data?.data?.swellPartitionTimeline || {};
        Object.entries(swellPartitionTimeline).forEach(
          ([beachId, partitions]) => {
            if (Array.isArray(partitions)) {
              partitionsTimelineMap.set(
                beachId,
                partitions.filter(
                  (partition): partition is SwellPartition =>
                    partition != null && typeof partition === "object"
                ) as SwellPartition[]
              );
            }
          }
        );
      });
    } catch (error) {
      console.warn("Failed to fetch bulk forecasts:", error);
    }
  }

  // Fill missing wave heights from nearest beach with data
  interpolateMissingWaveHeights(beachesForWaveData, waveHeightMap);

  return {
    locations,
    waveHeightMap,
    displayForecastMap,
    waterTempMap,
    conditionScoreMap,
    conditionSummaryMap,
    partitionsMap,
    partitionsTimelineMap,
  };
}

/**
 * Fill missing wave heights by copying from the geographically nearest
 * beach that has data. Mutates `waveHeightMap` in place.
 */
function interpolateMissingWaveHeights(
  beaches: Beach[],
  waveHeightMap: Map<string, number | undefined>
): void {
  if (waveHeightMap.size === 0 || beaches.length === 0) return;

  const beachesWithData = beaches.filter((b) => waveHeightMap.has(b.id));
  const beachesWithoutData = beaches.filter((b) => !waveHeightMap.has(b.id));

  for (const beach of beachesWithoutData) {
    let nearestDistance = Infinity;
    let nearestHeight: number | undefined;

    for (const dataBeach of beachesWithData) {
      const dist = Math.hypot(
        (beach.lat ?? 0) - (dataBeach.lat ?? 0),
        (beach.lon ?? 0) - (dataBeach.lon ?? 0)
      );
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestHeight = waveHeightMap.get(dataBeach.id);
      }
    }

    if (nearestHeight !== undefined) {
      waveHeightMap.set(beach.id, nearestHeight);
    }
  }
}
