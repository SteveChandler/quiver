import type { Beach } from "@/types/database";
import type {
  ConditionSummary,
  HourlySwellTimeline,
  SwellPartition,
} from "@/app/api/forecasts/bulk/route";
import { API_BATCH_CONFIG } from "@/lib/constants/ui";
import { fetchInBatches } from "@/lib/utils/batch-fetch";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";
import { MAX_TIMELINE_FIELD_BEACHES, selectTimelineFieldBeachIds } from "@/components/map/timeline-beach-sampler";
import { forecastCache } from "@/lib/utils/request-cache";

export type { ConditionSummary } from "@/app/api/forecasts/bulk/route";
export type ForecastLoadStatus = "ready" | "empty" | "unavailable";

const VALID_CONDITION_SUMMARIES = new Set<ConditionSummary>([
  "EPIC",
  "GOOD",
  "FAIR",
  "RIDEABLE",
  "MEH",
  "UNKNOWN",
]);

/**
 * Dependencies for fetchNearbyBeaches — injected so the module
 * can be tested without real API calls.
 */
export interface BeachLoaderDeps {
  /** Cached fetch function for the nearby beaches API */
  fetchNearbyBeaches: (
    lat: number,
    lon: number,
    signal?: AbortSignal,
  ) => Promise<any>;
}

/**
 * Result of loadBeachesAndWaveHeights — pure data, no side effects.
 */
export interface BeachLoaderResult {
  /** Resolved list of beaches to display on map */
  locations: Beach[];
  /** Map from beach ID to its own forecast wave height. */
  waveHeightMap: Map<string, number | undefined>;
  /** Map from beach ID to canonical forecast display label */
  displayForecastMap: Map<string, ForecastDisplay | undefined>;
  /** Map from beach ID to water temperature string (e.g., "52") */
  waterTempMap: Map<string, string | undefined>;
  /** Map from beach ID to 0-100 condition score */
  conditionScoreMap: Map<string, number | undefined>;
  /** Map from beach ID to native-aligned condition summary */
  conditionSummaryMap: Map<string, ConditionSummary>;
  /** Map from beach ID to whether the displayed height uses beach calibration */
  isCalibratedMap: Map<string, boolean>;
  /** Map from beach ID to parsed swell/wind partition for the flow field */
  partitionsMap: Map<string, SwellPartition>;
  /** Map from beach ID to parsed swell/wind partitions by forecast timeline step */
  partitionsTimelineMap: Map<string, SwellPartition[]>;
  /** Shared absolute-time envelope for the expandable public timeline. */
  hourlySwellTimeline: HourlySwellTimeline | null;
  /** Spatially representative beaches used by the bounded timeline field query. */
  hourlyTimelineBeachIds: string[];
  /** Whether swell data loaded, was valid-but-empty, or could not be trusted. */
  forecastStatus: ForecastLoadStatus;
}

export interface BeachLoaderOptions {
  skillLevel?: string;
  includeWaterQuality?: boolean;
  getAccessToken?: () => string | null;
  onAuthTokenExpired?: () => void;
  timeline?: "hourly";
  timelineStart?: string;
  timelineHours?: number;
  timelineFocusBeachId?: string | null;
  timelineOnly?: boolean;
  signal?: AbortSignal;
  initialForecastResponsePromise?: Promise<unknown> | null;
  /** Expose resolved beach geometry before forecast enrichment completes. */
  onLocationsResolved?: (locations: Beach[]) => void;
}

async function waitForForecastRetry(ms: number, signal?: AbortSignal): Promise<void> {
  assertNotAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const abort = (): void => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function fetchBulkForecast(
  url: string,
  signal: AbortSignal | undefined,
  getAccessToken?: () => string | null,
  onAuthTokenExpired?: () => void,
): Promise<Response> {
  const accessToken = getAccessToken?.();
  const cacheKey = `map-bulk:${accessToken ?? "guest"}:${url}`;
  assertNotAborted(signal);
  const cached = forecastCache.get<Response>(cacheKey);
  if (cached) return cached.clone();

  const request = async (): Promise<Response> => {
    if (!accessToken) return fetch(url, { signal });
    const response = await fetch(url, { signal, headers: { Authorization: `Bearer ${accessToken}` } });
    if (![401, 403].includes(response.status)) return response;
    onAuthTokenExpired?.();
    return fetch(url, { signal });
  };
  let response = await request();
  if (response.status === 429) {
    const header = response.headers.get("Retry-After");
    const seconds = header ? Number(header) : NaN;
    const delay = Number.isFinite(seconds)
      ? Math.max(1000, seconds * 1000)
      : Math.max(1000, Date.parse(header ?? "") - Date.now() || 60_000);
    await waitForForecastRetry(delay, signal);
    response = await request();
  }
  if (response.ok && typeof response.clone === "function") {
    forecastCache.set(cacheKey, response.clone(), 60_000);
  }
  return response;
}

const REQUIRED_SWELL_PARTITION_KEYS = [
  "s1Dir",
  "s1PeriodS",
  "s1HeightFt",
  "s2Dir",
  "s2PeriodS",
  "s2HeightFt",
  "windDir",
  "windMph",
] as const satisfies ReadonlyArray<keyof SwellPartition>;

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSwellPartition(value: unknown): value is SwellPartition {
  if (!isRecord(value)) return false;

  const partition = value as Record<string, unknown>;
  if (
    !REQUIRED_SWELL_PARTITION_KEYS.every(
      (key) => key in partition && isFiniteNumberOrNull(partition[key]),
    )
  ) {
    return false;
  }

  return (!("swellDirOm" in partition) || isFiniteNumberOrNull(partition.swellDirOm))
    && (!("conditionScore" in partition) || isFiniteNumberOrNull(partition.conditionScore));
}

const HOUR_MS = 60 * 60 * 1000;

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw new DOMException("The operation was aborted.", "AbortError");
}

function parseCanonicalUtcHour(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || epoch % HOUR_MS !== 0) return null;
  return new Date(epoch).toISOString() === value ? epoch : null;
}

export function parseHourlySwellTimeline(
  value: unknown,
  expectedBeachIds: readonly string[] = [],
): HourlySwellTimeline | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const envelope = value as Record<string, unknown>;
  if (!Array.isArray(envelope.timestamps) || typeof envelope.hasMore !== "boolean") {
    return null;
  }
  if (
    envelope.nextStart !== null &&
    parseCanonicalUtcHour(envelope.nextStart) === null
  ) {
    return null;
  }
  if (!envelope.partitionsByBeach || typeof envelope.partitionsByBeach !== "object") {
    return null;
  }

  const timestamps = envelope.timestamps;
  const timestampEpochs = timestamps.map(parseCanonicalUtcHour);
  if (timestampEpochs.some((epoch) => epoch === null)) return null;
  if (timestampEpochs.some((epoch, index) => index > 0 && epoch! <= timestampEpochs[index - 1]!)) {
    return null;
  }
  const nextStart = envelope.nextStart as string | null;
  if (!envelope.hasMore && nextStart !== null) return null;
  if (
    envelope.hasMore &&
    (
      nextStart === null ||
      timestampEpochs.length === 0 ||
      parseCanonicalUtcHour(nextStart)! <= timestampEpochs[timestampEpochs.length - 1]!
    )
  ) {
    return null;
  }

  const parsedPartitions = Object.entries(
    envelope.partitionsByBeach as Record<string, unknown>,
  ).reduce<Record<string, Array<SwellPartition | null>> | null>((result, [beachId, partitions]) => {
    if (!result || !Array.isArray(partitions) || partitions.length !== timestamps.length) {
      return null;
    }
    if (partitions.some((partition) => partition !== null && !isSwellPartition(partition))) {
      return null;
    }
    result[beachId] = partitions as Array<SwellPartition | null>;
    return result;
  }, {});
  if (!parsedPartitions) return null;
  if (expectedBeachIds.some((beachId) => !(beachId in parsedPartitions))) return null;

  return {
    timestamps: [...timestamps] as string[],
    partitionsByBeach: parsedPartitions,
    hasMore: envelope.hasMore,
    nextStart,
  };
}

function hourlySwellTimelineHasData(
  timeline: HourlySwellTimeline | null,
): boolean {
  if (!timeline) return false;
  return Object.values(timeline.partitionsByBeach).some((partitions) =>
    partitions.some((partition) => partition !== null),
  );
}

/**
 * Resolve which beaches to display and fetch their wave heights.
 *
 * This is a pure async function — the caller is responsible for setting
 * React state with the returned result.
 *
 * Beach resolution priority:
 * 1. If `providedBeaches` is non-empty, use those
 * 2. Otherwise fetch from nearby API, falling back to public list
 *
 * Wave height fetching:
 * - Batch-fetches from `/api/forecasts/bulk`
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
  if (providedBeaches !== undefined) {
    locations = providedBeaches;
  } else {
    // Fallback to API fetch when no beaches prop provided
    try {
      const response = await deps.fetchNearbyBeaches(
        latitude,
        longitude,
        options.signal,
      );
      locations = (response?.data as Beach[]) || [];
    } catch (err) {
      assertNotAborted(options.signal);
      console.warn("Nearby beaches API failed", err);
    }

    // Fallback to public beaches list and filter by distance client-side
    if (locations.length === 0) {
      try {
        const res = await fetch("/api/beaches", {
          headers: { Accept: "application/json" },
          signal: options.signal,
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
        assertNotAborted(options.signal);
        console.error("Public beaches list fetch failed", fallbackErr);
      }
    }

    // Limit to 20 beaches max
    locations = locations.slice(0, 20);
  }

  if (providedBeaches === undefined) {
    options.onLocationsResolved?.(locations);
  }

  // Fetch wave heights for all beaches rendered by the map markers.
  const waveHeightMap = new Map<string, number | undefined>();
  const displayForecastMap = new Map<string, ForecastDisplay | undefined>();
  const waterTempMap = new Map<string, string | undefined>();
  const conditionScoreMap = new Map<string, number | undefined>();
  const conditionSummaryMap = new Map<string, ConditionSummary>();
  const isCalibratedMap = new Map<string, boolean>();
  const partitionsMap = new Map<string, SwellPartition>();
  const partitionsTimelineMap = new Map<string, SwellPartition[]>();
  let hourlySwellTimeline: HourlySwellTimeline | null = null;
  const hourlyTimelineBeachIds = options.timeline === "hourly"
    ? selectTimelineFieldBeachIds(
        locations,
        { lat: latitude, lon: longitude },
        locations.length,
        options.timelineFocusBeachId,
      )
    : [];
  let forecastStatus: ForecastLoadStatus = "empty";
  const beachesForWaveData = locations;

  if (beachesForWaveData.length > 0) {
    try {
      const allBeachIds = options.timeline === "hourly" ? hourlyTimelineBeachIds
        : beachesForWaveData.map((beach) => beach.id).filter(Boolean) as string[];
      let initialForecastResponsePromise = options.initialForecastResponsePromise;
      const timelineStart = options.timelineStart ?? (
        allBeachIds.length > (options.timeline === "hourly" ? MAX_TIMELINE_FIELD_BEACHES : API_BATCH_CONFIG.BEACH_ID_BATCH_SIZE)
          ? new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS).toISOString()
          : undefined
      );

      const results = await fetchInBatches({
        items: allBeachIds,
        batchSize: options.timeline === "hourly" ? MAX_TIMELINE_FIELD_BEACHES : API_BATCH_CONFIG.BEACH_ID_BATCH_SIZE,
        fetchBatch: async (batchIds) => {
          if (
            initialForecastResponsePromise &&
            options.timeline === undefined &&
            batchIds.length === allBeachIds.length
          ) {
            const preloaded = initialForecastResponsePromise;
            initialForecastResponsePromise = null;
            const data = await preloaded;
            assertNotAborted(options.signal);
            if (data && typeof data === "object") {
              return { data, expectedBeachIds: batchIds };
            }
          }
          const batchTimelineBeachIds = hourlyTimelineBeachIds.filter((id) => batchIds.includes(id));
          const searchParams = new URLSearchParams({ beachIds: batchIds.join(",") });
          if (options.skillLevel !== undefined) {
            searchParams.set("skillLevel", options.skillLevel);
          }
          if (options.timeline === "hourly" && batchTimelineBeachIds.length > 0) {
            searchParams.set("timeline", "hourly");
            searchParams.set("includeConditions", "true");
            if (options.timelineOnly) searchParams.set("timelineOnly", "true");
            else if (timelineStart) searchParams.set("timelineOnly", "false");
            searchParams.set("timelineBeachIds", batchTimelineBeachIds.join(","));
            if (timelineStart) searchParams.set("timelineStart", timelineStart);
            if (options.timelineHours !== undefined) {
              searchParams.set("timelineHours", String(options.timelineHours));
            }
          }
          const response = await fetchBulkForecast(
            `/api/forecasts/bulk?${searchParams.toString()}`,
            options.signal,
            options.getAccessToken,
            options.onAuthTokenExpired,
          );
          if (!response.ok) {
            if (response.status !== 400) {
              throw new Error(
                `Bulk forecast API returned ${response.status}`
              );
            }
            return { data: null, expectedBeachIds: batchIds };
          }
          return {
            data: await response.json(),
            expectedBeachIds: options.timeline === "hourly"
              ? hourlyTimelineBeachIds.filter((beachId) => batchIds.includes(beachId))
              : batchIds,
          };
        },
        onBatchError: (error, batchIndex) => {
          if (options.signal?.aborted) return;
          console.warn(`Wave height batch ${batchIndex} failed:`, error);
        },
      });
      assertNotAborted(options.signal);

      if (results.length === 0 && allBeachIds.length > 0) {
        forecastStatus = "unavailable";
      }

      let invalidPartitionData = false;
      let invalidHourlyTimeline = false;

      results.forEach(({ data, expectedBeachIds }) => {
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

        const calibrationStatuses = data?.data?.isCalibrated || {};
        Object.entries(calibrationStatuses).forEach(([beachId, isCalibrated]) => {
          if (typeof isCalibrated === "boolean") {
            isCalibratedMap.set(beachId, isCalibrated);
          }
        });

        const rawSwellPartitions = data?.data?.swellPartitions;
        if (rawSwellPartitions !== undefined && !isRecord(rawSwellPartitions)) {
          invalidPartitionData = true;
        }
        const swellPartitions = isRecord(rawSwellPartitions)
          ? rawSwellPartitions
          : {};
        Object.entries(swellPartitions).forEach(([beachId, partition]) => {
          if (!isSwellPartition(partition)) {
            invalidPartitionData = true;
            return;
          }
          partitionsMap.set(beachId, partition);
        });

        const rawSwellPartitionTimeline = data?.data?.swellPartitionTimeline;
        if (
          rawSwellPartitionTimeline !== undefined &&
          !isRecord(rawSwellPartitionTimeline)
        ) {
          invalidPartitionData = true;
        }
        const swellPartitionTimeline = isRecord(rawSwellPartitionTimeline)
          ? rawSwellPartitionTimeline
          : {};
        Object.entries(swellPartitionTimeline).forEach(
          ([beachId, partitions]) => {
            if (
              !Array.isArray(partitions) ||
              partitions.some((partition) => !isSwellPartition(partition))
            ) {
              invalidPartitionData = true;
              return;
            }
            partitionsTimelineMap.set(beachId, partitions);
          }
        );

        const parsedHourlyTimeline = parseHourlySwellTimeline(
          data?.data?.hourlySwellTimeline,
          expectedBeachIds,
        );
        if (options.timeline === "hourly" && expectedBeachIds.length > 0 && !parsedHourlyTimeline) {
          invalidHourlyTimeline = true;
        } else if (parsedHourlyTimeline) {
          hourlySwellTimeline = hourlySwellTimeline
            ? {
                ...hourlySwellTimeline,
                partitionsByBeach: {
                  ...hourlySwellTimeline.partitionsByBeach,
                  ...parsedHourlyTimeline.partitionsByBeach,
                },
              }
            : parsedHourlyTimeline;
        }
      });

      if (invalidPartitionData || invalidHourlyTimeline) {
        forecastStatus = "unavailable";
      } else if (forecastStatus !== "unavailable") {
        const hourlyTimelineHasData = hourlySwellTimelineHasData(
          hourlySwellTimeline,
        );
        forecastStatus =
          partitionsMap.size > 0 ||
          partitionsTimelineMap.size > 0 ||
          hourlyTimelineHasData
            ? "ready"
            : "empty";
      }
    } catch (error) {
      assertNotAborted(options.signal);
      forecastStatus = "unavailable";
      console.warn("Failed to fetch bulk forecasts:", error);
    }
  }

  if (providedBeaches !== undefined && options.includeWaterQuality && locations.some((beach) => !("waterQualityHold" in beach))) {
    const anchor = locations.find((beach) => Number.isFinite(beach.lat) && Number.isFinite(beach.lon));
    if (anchor) {
      try {
        const nearby = await deps.fetchNearbyBeaches(anchor.lat!, anchor.lon!, options.signal);
        const evidence = new Map<string, Beach>((Array.isArray(nearby?.data) ? nearby.data : []).map((beach: Beach) => [beach.id, beach]));
        locations = locations.map((beach) => ({ ...beach, ...evidence.get(beach.id) }));
      } catch (error) {
        assertNotAborted(options.signal);
        console.warn("Unable to load beach water-quality context", error);
      }
    }
  }

  return {
    locations,
    waveHeightMap,
    displayForecastMap,
    waterTempMap,
    conditionScoreMap,
    conditionSummaryMap,
    isCalibratedMap,
    partitionsMap,
    partitionsTimelineMap,
    hourlySwellTimeline,
    hourlyTimelineBeachIds,
    forecastStatus,
  };
}
