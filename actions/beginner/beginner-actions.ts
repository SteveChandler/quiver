"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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

// ================================================
// Internal Helpers
// ================================================

function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_]/g, "\\$&");
}

function cityNameFromSlug(citySlug: string): string {
  return parseLocationFromSlug(citySlug);
}

async function findTopBeginnerBeach(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  citySlug: string,
  stateSlug: string
): Promise<{ id: string; name: string; slug: string } | null> {
  const cityName = cityNameFromSlug(citySlug);
  const escapedCity = escapeLikePattern(cityName);
  const normalizedState = stateSlug.toUpperCase();

  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, slug, average_rating")
    .or(
      `city.ilike.%${escapedCity}%,city.ilike.%${escapeLikePattern(citySlug)}%`
    )
    .eq("state", normalizedState)
    .or("is_private.is.null,is_private.eq.false")
    // lower-intermediate is included as it represents the most accessible level
    // above strict beginner — consistent with has_beginner flag in the RPC
    .or("skill_level.ilike.%beginner%,skill_level.ilike.%longboard%,skill_level.eq.lower-intermediate")
    .order("average_rating", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return { id: data[0].id, name: data[0].name, slug: data[0].slug ?? "" };
}

async function getLatestForecast(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  beachId: string
): Promise<Record<string, any> | null> {
  const today = new Date().toISOString().split("T")[0];
  const nextDay = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];

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
  if (!waveHeight) return 0;
  const range = parseWaveHeightRange(waveHeight);
  if (range) return range.max;
  return parseFloatSafe(waveHeight, 0);
}

function formatWaveHeight(waveHeight: string | null): string {
  if (!waveHeight) return "N/A";
  const trimmed = waveHeight.trim();
  if (/ft|feet/i.test(trimmed)) return trimmed;
  return `${trimmed} ft`;
}

function formatWind(
  windSpeed: string | null,
  windDirection: string | null
): string {
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
  windDirection: string | null
): BeginnerConditionStatus {
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
  if (maxHeight < 3) return { value, label: "Ideal for learning", status: "good" };
  if (maxHeight <= 4) return { value, label: "Slightly challenging", status: "caution" };
  return { value, label: "Too large for beginners", status: "warning" };
}

function getWindMetric(
  windSpeed: string | null,
  windDirection: string | null
): ConditionMetric {
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
    return { value, label: "Cool - wetsuit recommended", status: "caution", icon: "thermometer" };
  if (temp > 0)
    return { value, label: "Cold - full wetsuit required", status: "warning", icon: "thermometer-snowflake" };
  return { value, label: "Temperature unavailable", status: "good", icon: "thermometer" };
}

function getTideMetric(
  tideStatus: string | null,
  tideHeight: string | null
): ConditionMetric {
  const height = tideHeight ? tideHeight.trim() : "";
  const status = tideStatus ? tideStatus.trim() : "Unknown";
  const heightDisplay = height ? ` (${height})` : "";
  return { value: `${status}${heightDisplay}`, label: status, status: "good" };
}

function generateSummary(
  waveStatus: MetricStatus,
  windStatus: MetricStatus,
  crowdStatus: MetricStatus
): string {
  const statuses = [waveStatus, windStatus, crowdStatus];
  if (statuses.every((s) => s === "good"))
    return "Head out now \u2013 conditions are textbook for a first session";
  if (statuses.includes("warning"))
    return "Consider waiting for conditions to improve";
  return "Decent conditions \u2013 worth a paddle if you\u2019re keen";
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
  stateSlug: string
): Promise<{
  badge: BeginnerConditionsBadge | null;
  rightNow: RightNowConditions | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const beach = await findTopBeginnerBeach(supabase, citySlug, stateSlug);
    if (!beach) return { badge: null, rightNow: null };

    const forecast = await getLatestForecast(supabase, beach.id);
    if (!forecast) return { badge: null, rightNow: null };

    // Badge
    const waveHeightMax = parseWaveHeightMax(forecast.wave_height);
    const windSpeedNum = parseWindSpeed(forecast.wind_speed, 0);
    const status = determineConditionStatus(
      waveHeightMax,
      windSpeedNum,
      forecast.wind_direction
    );

    const badge: BeginnerConditionsBadge = {
      status,
      statusLabel: statusToLabel(status),
      waveHeight: formatWaveHeight(forecast.wave_height),
      wind: formatWind(forecast.wind_speed, forecast.wind_direction),
      waterTemp: formatWaterTemp(forecast.water_temp),
      spotName: beach.name,
      spotSlug: beach.slug,
    };

    // Right Now
    const waveHeightMetric = getWaveHeightMetric(forecast.wave_height);
    const windMetric = getWindMetric(forecast.wind_speed, forecast.wind_direction);
    const waterTempMetric = getWaterTempMetric(forecast.water_temp);
    const tideMetric = getTideMetric(forecast.tide_status, forecast.tide_height);
    const crowdEstimate = getCrowdEstimate();
    const crowdMetric: ConditionMetric = {
      value: crowdEstimate.value,
      label: crowdEstimate.value,
      status: crowdEstimate.status,
    };

    const rightNow: RightNowConditions = {
      spotName: beach.name,
      spotSlug: beach.slug,
      metrics: {
        waveHeight: waveHeightMetric,
        wind: windMetric,
        waterTemp: waterTempMetric,
        tide: tideMetric,
        crowd: crowdMetric,
      },
      summary: generateSummary(
        waveHeightMetric.status,
        windMetric.status,
        crowdMetric.status
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
  stateSlug: string
): Promise<BeginnerBeachWithEditorial[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const cityName = cityNameFromSlug(citySlug);
    const escapedCity = escapeLikePattern(cityName);
    const normalizedState = stateSlug.toUpperCase();

    const { data: beaches, error } = await supabase
      .from("beaches")
      .select(
        `
        id, name, slug, city, state, average_rating, review_count, skill_level, break_type,
        beach_editorial_content!left ( content_type, content )
      `
      )
      .or(
        `city.ilike.%${escapedCity}%,city.ilike.%${escapeLikePattern(citySlug)}%`
      )
      .eq("state", normalizedState)
      .or("is_private.is.null,is_private.eq.false")
      // lower-intermediate is included as it represents the most accessible level
      // above strict beginner — consistent with has_beginner flag in the RPC
      .or("skill_level.ilike.%beginner%,skill_level.ilike.%longboard%,skill_level.eq.lower-intermediate")
      .order("average_rating", { ascending: false, nullsFirst: false });

    if (error || !beaches || beaches.length === 0) return [];

    // Batch fetch current wave heights
    const today = new Date().toISOString().split("T")[0];
    const nextDay = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
    const beachIds = beaches.map((b: any) => b.id);

    const { data: forecasts } = await supabase
      .from("enhanced_forecasts")
      .select("beach_id, wave_height")
      .in("beach_id", beachIds)
      .gte("forecast_at", `${today}T00:00:00Z`)
      .lt("forecast_at", `${nextDay}T00:00:00Z`)
      .order("forecast_at", { ascending: false });

    const waveHeightMap = new Map<string, string>();
    if (forecasts) {
      for (const f of forecasts) {
        if (!waveHeightMap.has(f.beach_id)) {
          waveHeightMap.set(f.beach_id, f.wave_height ?? "");
        }
      }
    }

    return beaches.map((beach: any) => {
      const editorialRows = Array.isArray(beach.beach_editorial_content)
        ? beach.beach_editorial_content
        : [];
      const beginnerNotesRow = editorialRows.find(
        (e: any) => e.content_type === "beginner_notes"
      );
      const content = beginnerNotesRow?.content as BeginnerNotesContent | undefined;

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

      return {
        id: beach.id,
        name: beach.name,
        slug: beach.slug ?? "",
        city: beach.city ?? null,
        state: beach.state ?? null,
        rating: beach.average_rating ?? 0,
        reviewCount: beach.review_count ?? 0,
        skillLevel: beach.skill_level ?? "beginner",
        breakType: beach.break_type ?? "",
        currentWaveHeight: waveHeightMap.get(beach.id)
          ? formatWaveHeight(waveHeightMap.get(beach.id)!)
          : null,
        editorial,
      };
    });
  } catch (error) {
    console.error("[getBeginnerBeachesWithEditorial] Error:", error);
    return [];
  }
}

export async function getBeginnerCityEditorial(
  citySlug: string,
  stateSlug: string
): Promise<BeginnerCityEditorial | null> {
  try {
    const supabase = await createSupabaseServerClient();

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
