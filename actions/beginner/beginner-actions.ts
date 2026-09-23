"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { rankBeaches } from "@/lib/recommendations/selection";
import { parseLocationFromSlug } from "@/lib/utils/location-slug";
import {
  parseFloatSafe,
  parseWaveHeightRange,
  parseWindSpeed,
} from "@/lib/utils/number-parsing";
import type {
  BeginnerConditionsBadge,
  BeginnerConditionStatus,
  BeginnerBeachWithEditorial,
  BeginnerCityEditorial,
  RightNowConditions,
  MetricStatus,
  ConditionMetric,
  ConditionMetricWithIcon,
} from "@/types/beginner";
import type { BeginnerNotesContent } from "@/types/editorial-content";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import {
  evaluateBeginnerWindow,
  type BeginnerWindowEvaluation,
} from "@/lib/beginner/beginner-window-evaluator";
import {
  communityPhotoTargetKey,
  getResolvedSpotPhotoMap,
  type ResolvedSpotPhoto,
} from "@/lib/community-photos";

// ================================================
// Internal Helpers
// ================================================

interface BeginnerBeachRankingMeta {
  id: string;
  name: string;
  slug: string | null;
  timezone: string | null;
  average_rating: number | null;
  review_count?: number | null;
  break_type: string | null;
  skill_level: string | null;
  features: string[] | null;
  preference_model: unknown;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
}

interface BeginnerForecastForRanking {
  beach_id: string;
  wave_height: string | null;
  wind_speed: string | null;
  tide_status: string | null;
  tide_height: string | null;
  forecast_at: string | null;
}

interface BeginnerBeachSort {
  conditionPriority: number;
  fitPriority: number;
  editorialPriority: number;
  rating: number;
  reviewCount: number;
  name: string;
}

function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_]/g, "\\$&");
}

function cityNameFromSlug(citySlug: string): string {
  return parseLocationFromSlug(citySlug);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readBeginnerFit(preferenceModel: unknown): string | null {
  const preference = readRecord(preferenceModel);
  const beginnerWindow = readRecord(preference?.beginner_window);
  const fit = beginnerWindow?.beginner_fit;
  return typeof fit === "string" ? fit.toLowerCase() : null;
}

function getBeginnerFitPriority(beach: BeginnerBeachRankingMeta): number {
  const beginnerFit = readBeginnerFit(beach.preference_model);
  if (beginnerFit === "primary") return 0;
  if (beginnerFit === "conditional") return 1;
  if (beginnerFit === "no") return 4;

  const skillLevel = beach.skill_level?.toLowerCase() ?? "";
  const features = (beach.features ?? []).join(" ").toLowerCase();
  if (skillLevel.includes("beginner") || features.includes("beginner")) {
    return 1;
  }
  if (skillLevel.includes("longboard")) return 2;
  return 3;
}

function parseWaveHeightMaxOrNull(waveHeight: string | null): number | null {
  if (!waveHeight) return null;
  const range = parseWaveHeightRange(waveHeight);
  if (range) return range.max;
  const parsed = parseFloatSafe(waveHeight, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWindSpeedOrNull(windSpeed: string | null): number | null {
  const parsed = parseWindSpeed(windSpeed, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTideHeightOrNull(tideHeight: string | null): number | null {
  const parsed = parseFloatSafe(tideHeight, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getTodayLatestForecastMap(
  supabase: ReturnType<typeof createPublicReadClient>,
  beachIds: string[],
): Promise<Map<string, BeginnerForecastForRanking>> {
  if (beachIds.length === 0) return new Map();

  const today = new Date().toISOString().split("T")[0];
  const nextDay = new Date(new Date(today + "T00:00:00Z").getTime() + 86400000)
    .toISOString()
    .split("T")[0];

  const { data: forecasts } = await supabase
    .from("enhanced_forecasts")
    .select("beach_id, wave_height, wind_speed, tide_status, tide_height, forecast_at")
    .in("beach_id", beachIds)
    .gte("forecast_at", `${today}T00:00:00Z`)
    .lt("forecast_at", `${nextDay}T00:00:00Z`)
    .order("forecast_at", { ascending: false });

  const forecastMap = new Map<string, BeginnerForecastForRanking>();
  if (!forecasts) return forecastMap;

  for (const forecast of forecasts as BeginnerForecastForRanking[]) {
    if (!forecastMap.has(forecast.beach_id)) {
      forecastMap.set(forecast.beach_id, forecast);
    }
  }

  return forecastMap;
}

function getConditionPriority(
  beach: BeginnerBeachRankingMeta,
  forecast: BeginnerForecastForRanking | undefined,
): number {
  if (!forecast) return 2;

  const waveHeightFtMax = parseWaveHeightMaxOrNull(forecast.wave_height);
  const windSpeedMph = parseWindSpeedOrNull(forecast.wind_speed);
  const tideHeightFt = parseTideHeightOrNull(forecast.tide_height);
  const evaluation = evaluateBeginnerWindow({
    beach,
    waveHeightFtMax,
    windSpeedMph,
    tideStatus: forecast.tide_status,
    tideHeightFt,
    forecastAt: forecast.forecast_at,
    timezone: beach.timezone,
  });

  if (!evaluation.applies) return 2;
  if (evaluation.rating === "ideal") return 0;
  if (evaluation.rating === "acceptable") return 1;
  if (evaluation.rating === "unknown") return 2;
  return 3;
}

function buildBeginnerBeachSort(
  beach: BeginnerBeachRankingMeta,
  forecast: BeginnerForecastForRanking | undefined,
  hasEditorial = false,
): BeginnerBeachSort {
  return {
    conditionPriority: getConditionPriority(beach, forecast),
    fitPriority: getBeginnerFitPriority(beach),
    editorialPriority: hasEditorial ? 0 : 1,
    rating: beach.average_rating ?? 0,
    reviewCount: beach.review_count ?? 0,
    name: beach.name,
  };
}

function compareBeginnerBeachSort(
  a: BeginnerBeachSort,
  b: BeginnerBeachSort,
): number {
  if (a.conditionPriority !== b.conditionPriority) {
    return a.conditionPriority - b.conditionPriority;
  }
  if (a.fitPriority !== b.fitPriority) return a.fitPriority - b.fitPriority;
  if (a.editorialPriority !== b.editorialPriority) {
    return a.editorialPriority - b.editorialPriority;
  }
  if (a.rating !== b.rating) return b.rating - a.rating;
  if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
  return a.name.localeCompare(b.name);
}

async function findTopBeginnerBeach(
  supabase: ReturnType<typeof createPublicReadClient>,
  citySlug: string,
  stateSlug: string,
): Promise<BeginnerBeachRankingMeta | null> {
  const cityName = cityNameFromSlug(citySlug);
  const escapedCity = escapeLikePattern(cityName);
  const normalizedState = stateSlug.toUpperCase();

  const { data, error } = await supabase
    .from("beaches")
    .select(
      "id, name, slug, timezone, average_rating, break_type, skill_level, features, preference_model, preferred_tide_ft_min, preferred_tide_ft_max",
    )
    .or(
      `city.ilike.%${escapedCity}%,city.ilike.%${escapeLikePattern(citySlug)}%`,
    )
    .eq("state", normalizedState)
    .or("is_private.is.null,is_private.eq.false")
    .or("skill_level.ilike.%beginner%,skill_level.ilike.%longboard%")
    .order("average_rating", { ascending: false, nullsFirst: false });

  if (error || !data || data.length === 0) return null;

  const beaches = data as BeginnerBeachRankingMeta[];
  const forecastMap = await getTodayLatestForecastMap(
    supabase,
    beaches.map((beach) => beach.id),
  );

  const rankedBeaches = await rankBeaches(beaches, {
    compare: (left, right) => compareBeginnerBeachSort(
      buildBeginnerBeachSort(left, forecastMap.get(left.id)),
      buildBeginnerBeachSort(right, forecastMap.get(right.id)),
    ),
  });
  return rankedBeaches[0] ?? null;
}

async function getLatestForecast(
  supabase: ReturnType<typeof createPublicReadClient>,
  beachId: string,
): Promise<Record<string, any> | null> {
  const today = new Date().toISOString().split("T")[0];
  const nextDay = new Date(new Date(today + "T00:00:00Z").getTime() + 86400000)
    .toISOString()
    .split("T")[0];

  const { data: todayData, error: todayError } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .gte("forecast_at", `${today}T00:00:00Z`)
    .lt("forecast_at", `${nextDay}T00:00:00Z`)
    .order("forecast_at", { ascending: false })
    .limit(1);

  if (!todayError && todayData && todayData.length > 0) return todayData[0];

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .order("forecast_at", { ascending: false })
    .limit(1);

  if (fallbackError || !fallbackData || fallbackData.length === 0) return null;
  return fallbackData[0];
}

function parseWaveHeightMax(waveHeight: string | null): number {
  return parseWaveHeightMaxOrNull(waveHeight) ?? 0;
}

function formatWaveHeight(waveHeight: string | null): string {
  if (!waveHeight) return "N/A";
  const trimmed = waveHeight.trim();
  if (/ft|feet/i.test(trimmed)) return trimmed;
  return `${trimmed} ft`;
}

function formatWind(
  windSpeed: string | null,
  windDirection: string | null,
): string {
  if (!windSpeed) return "Wind unavailable";
  const speed = parseWindSpeed(windSpeed, 0);
  const dir = windDirection ? windDirection.trim() : "";
  if (speed === 0) return "Calm";
  const dirLabel = dir ? ` ${dir.toLowerCase()}` : "";
  return `${Math.round(speed)} mph${dirLabel}`;
}

function formatWaterTemp(waterTemp: string | null): string {
  if (!waterTemp) return "N/A";
  const temp = parseFloatSafe(waterTemp, 0);
  if (temp === 0) return "N/A";
  if (/[F\u00B0]/i.test(waterTemp)) return waterTemp.trim();
  return `${Math.round(temp)}\u00B0F`;
}

function determineConditionStatus(
  waveHeightMax: number,
  windSpeedNum: number,
  windDirection: string | null,
  beginnerWindow: BeginnerWindowEvaluation | null = null,
): BeginnerConditionStatus {
  if (beginnerWindow?.applies) {
    if (beginnerWindow.rating === "ideal") return "great";
    if (beginnerWindow.rating === "acceptable") return "fair";
    if (beginnerWindow.rating === "unknown") return "fair";
    return "challenging";
  }

  const isStrongOnshore =
    windDirection && /onshore/i.test(windDirection) && windSpeedNum > 12;

  if (waveHeightMax > 6 || windSpeedNum > 18 || isStrongOnshore)
    return "challenging";
  if (
    (waveHeightMax >= 4 && waveHeightMax <= 6) ||
    (windSpeedNum >= 12 && windSpeedNum <= 18)
  )
    return "fair";
  return "great";
}

function statusToLabel(status: BeginnerConditionStatus): string {
  switch (status) {
    case "great":
      return "Great for Beginners Today";
    case "fair":
      return "Fair for Beginners";
    case "challenging":
      return "Challenging Today";
  }
}

function getCrowdEstimate(): { value: string; status: MetricStatus } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (isWeekend) {
    if (hour < 8) return { value: "Light", status: "good" };
    if (hour < 12) return { value: "Crowded", status: "warning" };
    return { value: "Moderate", status: "caution" };
  }
  if (hour < 9) return { value: "Empty", status: "good" };
  if (hour < 15) return { value: "Light", status: "good" };
  return { value: "Moderate", status: "caution" };
}

function getWaveHeightMetric(waveHeight: string | null): ConditionMetric {
  const maxHeight = parseWaveHeightMax(waveHeight);
  const value = formatWaveHeight(waveHeight);
  if (maxHeight < 3)
    return { value, label: "Ideal for learning", status: "good" };
  if (maxHeight <= 4)
    return { value, label: "Slightly challenging", status: "caution" };
  return { value, label: "Too large for beginners", status: "warning" };
}

function applyBeginnerWindowMetric(
  metric: ConditionMetric,
  status: BeginnerWindowEvaluation["statuses"][keyof BeginnerWindowEvaluation["statuses"]],
  label: string,
): ConditionMetric {
  if (status === "ideal") return { ...metric, label, status: "good" };
  if (status === "acceptable") return { ...metric, label, status: "caution" };
  if (status === "poor") return { ...metric, label, status: "warning" };
  return { ...metric, label, status: "caution" };
}

function getWindMetric(
  windSpeed: string | null,
  windDirection: string | null,
): ConditionMetric {
  if (!windSpeed) {
    return {
      value: "Wind unavailable",
      label: "Wind unavailable",
      status: "caution",
    };
  }

  const speed = parseWindSpeed(windSpeed, 0);
  const value = formatWind(windSpeed, windDirection);
  if (speed < 8) return { value, label: "Clean conditions", status: "good" };
  if (speed <= 15) return { value, label: "Moderate chop", status: "caution" };
  return { value, label: "Choppy - not ideal", status: "warning" };
}

function getWaterTempMetric(waterTemp: string | null): ConditionMetricWithIcon {
  const temp = parseFloatSafe(waterTemp, 0);
  const value = formatWaterTemp(waterTemp);
  if (temp >= 65)
    return { value, label: "Warm", status: "good", icon: "thermometer-sun" };
  if (temp >= 55)
    return {
      value,
      label: "Cool - wetsuit recommended",
      status: "caution",
      icon: "thermometer",
    };
  if (temp > 0)
    return {
      value,
      label: "Cold - full wetsuit required",
      status: "warning",
      icon: "thermometer-snowflake",
    };
  return {
    value,
    label: "Temperature unavailable",
    status: "good",
    icon: "thermometer",
  };
}

function getTideMetric(
  tideStatus: string | null,
  tideHeight: string | null,
  beginnerWindow: BeginnerWindowEvaluation | null = null,
): ConditionMetric {
  const height = tideHeight ? tideHeight.trim() : "";
  const status = tideStatus ? tideStatus.trim() : "Unknown";
  const heightDisplay = height ? ` (${height})` : "";
  const metric: ConditionMetric = {
    value: `${status}${heightDisplay}`,
    label: status,
    status: "good",
  };

  if (!beginnerWindow?.applies) return metric;
  return applyBeginnerWindowMetric(
    metric,
    beginnerWindow.statuses.tide,
    beginnerWindow.labels.tide,
  );
}

function generateSummary(
  waveStatus: MetricStatus,
  windStatus: MetricStatus,
  crowdStatus: MetricStatus,
  tideStatus: MetricStatus,
): string {
  const statuses = [waveStatus, windStatus, crowdStatus, tideStatus];
  if (statuses.every((s) => s === "good"))
    return "Small, clean, early, and low-to-mid tide - a strong learner window";
  if (statuses.includes("warning"))
    return "Consider waiting for conditions to improve";
  return "Decent learner setup, but check the details before paddling out";
}

// ================================================
// Public Server Actions
// ================================================

/**
 * Combined fetch for badge + right-now conditions.
 * Uses a single beach lookup + single forecast query instead of duplicating.
 */
export async function getBeginnerConditionsData(
  citySlug: string,
  stateSlug: string,
): Promise<{
  badge: BeginnerConditionsBadge | null;
  rightNow: RightNowConditions | null;
}> {
  try {
    const supabase = createPublicReadClient();
    const beach = await findTopBeginnerBeach(supabase, citySlug, stateSlug);
    if (!beach) return { badge: null, rightNow: null };

    const forecast = await getLatestForecast(supabase, beach.id);
    if (!forecast) return { badge: null, rightNow: null };

    // Badge
    const waveHeightMax = parseWaveHeightMax(forecast.wave_height);
    const beginnerWaveHeightMax = parseWaveHeightMaxOrNull(
      forecast.wave_height,
    );
    const windSpeedNum = parseWindSpeed(forecast.wind_speed, 0);
    const beginnerWindSpeedMph = parseWindSpeedOrNull(forecast.wind_speed);
    const tideHeightNum = parseTideHeightOrNull(forecast.tide_height);
    const beginnerWindow = evaluateBeginnerWindow({
      beach,
      waveHeightFtMax: beginnerWaveHeightMax,
      windSpeedMph: beginnerWindSpeedMph,
      tideStatus: forecast.tide_status,
      tideHeightFt: tideHeightNum,
      forecastAt: forecast.forecast_at,
      timezone: beach.timezone,
    });
    const status = determineConditionStatus(
      waveHeightMax,
      windSpeedNum,
      forecast.wind_direction,
      beginnerWindow,
    );

    const badge: BeginnerConditionsBadge = {
      status,
      statusLabel: statusToLabel(status),
      waveHeight: formatWaveHeight(forecast.wave_height),
      wind: formatWind(forecast.wind_speed, forecast.wind_direction),
      waterTemp: formatWaterTemp(forecast.water_temp),
      spotName: beach.name,
      spotSlug: beach.slug ?? "",
    };

    // Right Now
    const rawWaveHeightMetric = getWaveHeightMetric(forecast.wave_height);
    const waveHeightMetric = beginnerWindow.applies
      ? applyBeginnerWindowMetric(
          rawWaveHeightMetric,
          beginnerWindow.statuses.wave,
          beginnerWindow.labels.wave,
        )
      : rawWaveHeightMetric;
    const rawWindMetric = getWindMetric(
      forecast.wind_speed,
      forecast.wind_direction,
    );
    const windMetric = beginnerWindow.applies
      ? applyBeginnerWindowMetric(
          rawWindMetric,
          beginnerWindow.statuses.wind,
          beginnerWindow.labels.wind,
        )
      : rawWindMetric;
    const waterTempMetric = getWaterTempMetric(forecast.water_temp);
    const tideMetric = getTideMetric(
      forecast.tide_status,
      forecast.tide_height,
      beginnerWindow,
    );
    const crowdEstimate = getCrowdEstimate();
    const crowdMetric: ConditionMetric = {
      value: crowdEstimate.value,
      label: crowdEstimate.value,
      status: crowdEstimate.status,
    };

    const rightNow: RightNowConditions = {
      spotId: beach.id,
      spotName: beach.name,
      spotSlug: beach.slug ?? "",
      metrics: {
        waveHeight: waveHeightMetric,
        wind: windMetric,
        waterTemp: waterTempMetric,
        tide: tideMetric,
        crowd: crowdMetric,
      },
      beginnerVerdict: {
        rating:
          beginnerWindow.applies &&
          beginnerWindow.rating !== "not_applicable"
            ? beginnerWindow.rating
            : "unknown",
        reasons: [
          {
            factor: "Wave size",
            detail: beginnerWindow.applies
              ? beginnerWindow.labels.wave
              : waveHeightMetric.label,
          },
          {
            factor: "Wind",
            detail: beginnerWindow.applies
              ? beginnerWindow.labels.wind
              : windMetric.label,
          },
          {
            factor: "Tide",
            detail: beginnerWindow.applies
              ? beginnerWindow.labels.tide
              : tideMetric.label,
          },
          {
            factor: "Time window",
            detail: beginnerWindow.applies
              ? beginnerWindow.labels.time
              : "Verify the current window before leaving",
          },
        ],
      },
      summary: generateSummary(
        waveHeightMetric.status,
        windMetric.status,
        crowdMetric.status,
        tideMetric.status,
      ),
      lastUpdated: forecast.updated_at || new Date().toISOString(),
    };

    return { badge, rightNow };
  } catch (error) {
    console.error("[getBeginnerConditionsData] Error:", error);
    return { badge: null, rightNow: null };
  }
}

export async function getBeginnerBeachesWithEditorial(
  citySlug: string,
  stateSlug: string,
): Promise<BeginnerBeachWithEditorial[]> {
  try {
    const supabase = createPublicReadClient();
    const cityName = cityNameFromSlug(citySlug);
    const escapedCity = escapeLikePattern(cityName);
    const normalizedState = stateSlug.toUpperCase();

    const { data: beaches, error } = await supabase
      .from("beaches")
      .select(
        `
        id, name, slug, city, state, timezone, average_rating, review_count,
        skill_level, break_type, features, preference_model,
        preferred_tide_ft_min, preferred_tide_ft_max,
        beach_editorial_content!left ( content_type, content ),
        beach_photos!left ( image_url )
      `,
      )
      .or(
        `city.ilike.%${escapedCity}%,city.ilike.%${escapeLikePattern(citySlug)}%`,
      )
      .eq("state", normalizedState)
      .or("is_private.is.null,is_private.eq.false")
      .or("skill_level.ilike.%beginner%,skill_level.ilike.%longboard%")
      .order("average_rating", { ascending: false, nullsFirst: false });

    if (error || !beaches || beaches.length === 0) return [];

    const beachRows = await rankBeaches(
      beaches as BeginnerBeachRankingMeta[],
      { compare: () => 0 },
    );
    if (beachRows.length === 0) return [];
    const forecastMap = await getTodayLatestForecastMap(
      supabase,
      beachRows.map((beach) => beach.id),
    );
    let communityPhotoMap = new Map<string, ResolvedSpotPhoto[]>();
    try {
      communityPhotoMap = await getResolvedSpotPhotoMap({
        targets: beachRows.map((beach) => ({
          type: "beach" as const,
          id: beach.id,
        })),
        limitPerTarget: 1,
      });
    } catch (error) {
      console.error("[getBeginnerBeachesWithEditorial] Photo resolver error:", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const enriched = beachRows.map((beach: any) => {
      const editorialRows = Array.isArray(beach.beach_editorial_content)
        ? beach.beach_editorial_content
        : [];
      const beginnerNotesRow = editorialRows.find(
        (e: any) => e.content_type === "beginner_notes",
      );
      const content = beginnerNotesRow?.content as
        | BeginnerNotesContent
        | undefined;

      let editorial: BeginnerBeachWithEditorial["editorial"] = null;
      if (content?.why_beginners_love_it && content?.logistics) {
        editorial = {
          whyBeginnersLoveIt: content.why_beginners_love_it,
          logistics: {
            parking: content.logistics.parking ?? "",
            walkDistance: content.logistics.walk_distance ?? "",
            lifeguards: content.logistics.lifeguards ?? false,
            bestHours: content.logistics.best_hours ?? "",
            facilities: content.logistics.facilities ?? "",
          },
          description: content.description ?? "",
        };
      }

      // Pick first available beach photo
      const photoRows = Array.isArray(beach.beach_photos)
        ? beach.beach_photos
        : [];
      const firstPhoto = photoRows.find((p: any) => p.image_url);
      const resolvedPhoto = communityPhotoMap.get(
        communityPhotoTargetKey({ type: "beach", id: beach.id }),
      )?.[0];
      const rawPhotoUrl =
        resolvedPhoto?.thumbUrl ??
        resolvedPhoto?.imageUrl ??
        firstPhoto?.image_url ??
        null;
      const photoUrl = rawPhotoUrl ? getOptimizedImageUrl(rawPhotoUrl) : null;
      const forecast = forecastMap.get(beach.id);

      return {
        beach: {
          id: beach.id,
          name: beach.name,
          slug: beach.slug ?? "",
          city: beach.city ?? null,
          state: beach.state ?? null,
          rating: beach.average_rating ?? 0,
          reviewCount: beach.review_count ?? 0,
          skillLevel: beach.skill_level ?? "beginner",
          breakType: beach.break_type ?? "",
          currentWaveHeight: forecast?.wave_height
            ? formatWaveHeight(forecast.wave_height)
            : null,
          editorial,
          photoUrl,
        },
        sort: buildBeginnerBeachSort(beach, forecast, editorial !== null),
      };
    });
    const ranked = await rankBeaches(
      enriched.map((candidate) => ({
        id: candidate.beach.id,
        candidate,
      })),
      { compare: (left, right) => compareBeginnerBeachSort(left.candidate.sort, right.candidate.sort) },
    );
    return ranked.map(({ candidate }) => candidate.beach);
  } catch (error) {
    console.error("[getBeginnerBeachesWithEditorial] Error:", error);
    return [];
  }
}

export async function getBeginnerCityEditorial(
  citySlug: string,
  stateSlug: string,
): Promise<BeginnerCityEditorial | null> {
  try {
    const supabase = createPublicReadClient();

    // Try beginner-specific editorial first
    const { data: beginnerData } = await supabase
      .from("city_editorial_content")
      .select("*")
      .eq("city_slug", citySlug)
      .eq("state_slug", stateSlug)
      .eq("intent", "beginner")
      .limit(1);

    let row: any = beginnerData?.[0] ?? null;

    // Fallback to general editorial
    if (!row) {
      const { data: generalData } = await supabase
        .from("city_editorial_content")
        .select("*")
        .eq("city_slug", citySlug)
        .eq("state_slug", stateSlug)
        .is("intent", null)
        .limit(1);

      row = generalData?.[0] ?? null;
    }

    if (!row) return null;

    const sessionTiming =
      typeof row.session_timing === "string"
        ? JSON.parse(row.session_timing)
        : row.session_timing || [];
    const quickLinks =
      typeof row.quick_links === "string"
        ? JSON.parse(row.quick_links)
        : row.quick_links || [];

    return {
      id: row.id,
      citySlug: row.city_slug,
      stateSlug: row.state_slug,
      cityName: (row.city_name || "").trim() || cityNameFromSlug(citySlug),
      regionLabel: row.region_label || "",
      description: row.description || [],
      sessionTiming,
      quickLinks,
      planningChecklist: row.planning_checklist || [],
    };
  } catch (error) {
    console.error("[getBeginnerCityEditorial] Error:", error);
    return null;
  }
}
