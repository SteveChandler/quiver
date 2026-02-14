"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TidePoint } from "@/components/forecast/tide-chart-recharts";
import type { TideScheduleEntry } from "@/types/forecast";
import { parseWaterTempF } from "@/lib/utils/wetsuit-utils";
import { TideExtremaDetector } from "@/lib/services/noaa-coops/tide-extrema-detector";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>;

/**
 * City-level tide data for intent pages
 */
export interface CityTideData {
  /** Tide points for chart visualization */
  tidePoints: TidePoint[];
  /** Current tide status (e.g., "Rising", "Falling") */
  currentStatus: string | null;
  /** Current tide height string (e.g., "3.2 ft") */
  currentHeight: string | null;
  /** Next tide type ("High" or "Low") */
  nextTideType: string | null;
  /** Next tide time (human readable) */
  nextTideTime: string | null;
  /** Next tide height string */
  nextTideHeight: string | null;
  /** Name of the beach used for data attribution */
  beachName: string;
  /** Tide station name if available */
  tideStation: string | null;
}

/**
 * A single tide extremum event (high or low) for the 7-day table
 */
export interface TideExtremaEvent {
  time: string;
  height: number;
  type: "high" | "low";
  timeFormatted: string;
}

/**
 * One day's worth of high/low tide events
 */
export interface TideDayExtrema {
  date: string;
  label: string;
  isToday: boolean;
  events: TideExtremaEvent[];
}

/**
 * Per-beach tide preference data
 */
export interface BeachTidePreference {
  beachName: string;
  beachSlug: string | null;
  preferredTideMin: number | null;
  preferredTideMax: number | null;
  preferredDirection: string | null;
  skillLevel: string | null;
}

/**
 * Expanded city tide data for the dedicated tide page
 */
export interface CityTideDataExpanded extends CityTideData {
  sevenDayExtrema: TideDayExtrema[];
  hourlyPoints: Array<{ time: string; height: number }>;
  beachTidePreferences: BeachTidePreference[];
}

/**
 * City-level water temperature data for intent pages
 */
export interface CityWaterTempData {
  /** Current water temperature in Fahrenheit */
  currentTemp: number;
  /** Historical temperature points for trend chart */
  points: Array<{
    date: string;
    tempF: number;
  }>;
  /** Name of the beach used for data attribution */
  beachName: string;
}

/**
 * Get tide data for a city's intent page
 *
 * Finds a representative beach in the city with today's forecast data,
 * extracts tide schedule, and returns formatted data for display.
 */
export async function getCityTideData(
  cityName: string,
  state: string
): Promise<CityTideData | null> {
  try {
    const supabase = await createSupabaseServiceRoleClient();
    const today = new Date().toISOString().split("T")[0];

    // Find a representative beach with today's forecast
    // Join beaches with enhanced_forecasts to find one with tide data
    const nextDay = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
    const { data: beachWithForecast, error: beachError } = await supabase
      .from("enhanced_forecasts")
      .select(
        `
        beach_id,
        forecast_at,
        tide_status,
        tide_height,
        next_tide_time,
        next_tide_type,
        next_tide_height,
        raw_forecast,
        beaches!inner (
          id,
          name,
          city,
          state
        )
      `
      )
      .gte("forecast_at", `${today}T00:00:00Z`)
      .lt("forecast_at", `${nextDay}T00:00:00Z`)
      .ilike("beaches.city", cityName)
      .ilike("beaches.state", state)
      .order("forecast_at", { ascending: true })
      .limit(1)
      .single();

    if (beachError || !beachWithForecast) {
      // Try with state abbreviation matching (CA vs California)
      const { data: altBeach, error: altError } = await supabase
        .from("enhanced_forecasts")
        .select(
          `
          beach_id,
          forecast_at,
          tide_status,
          tide_height,
          next_tide_time,
          next_tide_type,
          next_tide_height,
          raw_forecast,
          beaches!inner (
            id,
            name,
            city,
            state
          )
        `
        )
        .gte("forecast_at", `${today}T00:00:00Z`)
        .lt("forecast_at", `${nextDay}T00:00:00Z`)
        .ilike("beaches.city", cityName)
        .order("forecast_at", { ascending: true })
        .limit(1)
        .single();

      if (altError || !altBeach) {
        console.log(
          `No tide data found for ${cityName}, ${state}:`,
          beachError?.message || altError?.message
        );
        return null;
      }

      return processTideData(altBeach);
    }

    return processTideData(beachWithForecast);
  } catch (error) {
    console.error("Error in getCityTideData:", error);
    return null;
  }
}

/**
 * Process raw forecast data into CityTideData
 */
function processTideData(forecastData: any): CityTideData | null {
  const beach = forecastData.beaches;
  const rawForecast = forecastData.raw_forecast as {
    tide_schedule?: TideScheduleEntry[];
    tide_station?: { id: string; name: string };
  } | null;

  // Extract tide schedule and convert to TidePoint[]
  const tideSchedule = rawForecast?.tide_schedule;
  let tidePoints: TidePoint[] = [];

  if (tideSchedule && tideSchedule.length >= 2) {
    tidePoints = tideSchedule.map((entry) => ({
      // Convert unix timestamp (seconds) to ISO string
      t: new Date(entry.time * 1000).toISOString(),
      h: entry.height,
      isHigh: entry.type === "high",
      isLow: entry.type === "low",
    }));
  }

  // If no tide schedule, try to construct from individual forecast fields
  if (tidePoints.length === 0 && forecastData.tide_height) {
    // Fall back to just showing current state without chart
    // The TideChart can handle empty data gracefully
  }

  return {
    tidePoints,
    currentStatus: forecastData.tide_status || null,
    currentHeight: forecastData.tide_height || null,
    nextTideType: forecastData.next_tide_type || null,
    nextTideTime: forecastData.next_tide_time || null,
    nextTideHeight: forecastData.next_tide_height || null,
    beachName: beach?.name || "Unknown Beach",
    tideStation: rawForecast?.tide_station?.name || null,
  };
}

/**
 * Format a date for day labels: "Today", "Tomorrow", or "Wed, Feb 12"
 * Uses explicit timezone to ensure deterministic server-side output.
 */
function formatDayLabel(date: Date, today: Date, timeZone = "America/Los_Angeles"): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const todayStr = fmt(today);
  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = fmt(tomorrowDate);
  const dateStr = fmt(date);

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Find a representative beach for a city, with state fallback.
 * Centralizes the repeated pattern of query-with-state → fallback-without-state.
 */
async function findRepresentativeBeach(
  supabase: SupabaseClient,
  cityName: string,
  state: string,
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from("beaches")
    .select("id, name")
    .ilike("city", cityName)
    .ilike("state", state)
    .order("name", { ascending: true })
    .limit(1)
    .single();

  if (data) return data;

  const { data: alt } = await supabase
    .from("beaches")
    .select("id, name")
    .ilike("city", cityName)
    .order("name", { ascending: true })
    .limit(1)
    .single();

  return alt ?? null;
}

/**
 * Get expanded tide data for the dedicated tide page.
 *
 * Includes everything from getCityTideData plus:
 * - 7 days of hourly tide points
 * - High/low extrema grouped by day
 * - Per-beach tide preferences for the city
 */
export async function getCityTideDataExpanded(
  cityName: string,
  state: string
): Promise<CityTideDataExpanded | null> {
  try {
    // Parallel: get base tide data + find representative beach
    const [baseTideData, supabase] = await Promise.all([
      getCityTideData(cityName, state),
      createSupabaseServiceRoleClient(),
    ]);
    if (!baseTideData) return null;

    const repBeach = await findRepresentativeBeach(supabase, cityName, state);
    if (!repBeach) {
      return {
        ...baseTideData,
        sevenDayExtrema: [],
        hourlyPoints: [],
        beachTidePreferences: [],
      };
    }

    const now = new Date();
    const chartStart = new Date(now);
    chartStart.setDate(chartStart.getDate() - 2); // 48h covers max past need of 33.6h (168h × 0.2 nowBias)
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    return fetchExpandedTideData(supabase, repBeach.id, cityName, state, baseTideData, chartStart, sevenDaysLater);
  } catch (error) {
    console.error("Error in getCityTideDataExpanded:", error);
    return null;
  }
}

async function fetchExpandedTideData(
  supabase: SupabaseClient,
  beachId: string,
  cityName: string,
  state: string,
  baseTideData: CityTideData,
  startDate: Date,
  endDate: Date
): Promise<CityTideDataExpanded> {
  // Parallel fetch: hourly tide data + beach preferences
  const [tideResult, beachesResult] = await Promise.all([
    supabase
      .from("tide_forecasts")
      .select("ts, tide_height_m, tide_ft")
      .eq("beach_id", beachId)
      .gte("ts", startDate.toISOString())
      .lte("ts", endDate.toISOString())
      .order("ts", { ascending: true }),
    supabase
      .from("beaches")
      .select("name, slug, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, skill_level")
      .ilike("city", cityName)
      .ilike("state", state)
      .order("name", { ascending: true }),
  ]);

  // Process hourly tide data - keep both feet and meters for different uses
  const hourlyPoints: Array<{ time: string; height: number }> = [];
  const samplesForDetector: Array<{ ts: string; tide_height_m: number }> = [];

  if (tideResult.data) {
    for (const row of tideResult.data) {
      const heightFt = row.tide_ft ?? (row.tide_height_m != null ? row.tide_height_m * METERS_TO_FEET : null);
      const heightM = row.tide_height_m ?? (row.tide_ft != null ? row.tide_ft / METERS_TO_FEET : null);

      if (heightFt != null) {
        hourlyPoints.push({
          time: row.ts,
          height: Math.round(heightFt * 100) / 100,
        });
      }
      if (heightM != null) {
        samplesForDetector.push({ ts: row.ts, tide_height_m: heightM });
      }
    }
  }

  // Use battle-tested TideExtremaDetector (handles boundary + plateau cases)
  const detector = new TideExtremaDetector({ precision: 2 });
  const extremaRaw = detector.detectExtrema(samplesForDetector);

  // Group extrema by day with explicit timezone for deterministic output
  const timeZone = "America/Los_Angeles";
  const today = new Date();
  const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const todayStr = dateFmt.format(today);
  const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); // YYYY-MM-DD, lexicographically sortable
  const todayIso = isoDateFmt.format(today);
  const dayMap = new Map<string, TideDayExtrema & { _isoDate: string }>();

  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  for (const ex of extremaRaw) {
    const exDate = new Date(ex.time * 1000); // TideExtreme.time is unix seconds
    const dateKey = dateFmt.format(exDate);

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        date: dateKey,
        _isoDate: isoDateFmt.format(exDate),
        label: formatDayLabel(exDate, today, timeZone),
        isToday: dateKey === todayStr,
        events: [],
      });
    }

    const day = dayMap.get(dateKey)!;
    day.events.push({
      time: exDate.toISOString(),
      height: ex.height,
      type: ex.type,
      timeFormatted: timeFmt.format(exDate),
    });
  }

  // Filter out past days, sort chronologically, and limit to 7
  const sevenDayExtrema = Array.from(dayMap.values())
    .filter((day) => day._isoDate >= todayIso)
    .sort((a, b) => a._isoDate.localeCompare(b._isoDate))
    .slice(0, 7)
    .map(({ _isoDate: _, ...rest }) => rest);

  // Process beach preferences
  const beachTidePreferences: BeachTidePreference[] = (beachesResult.data || []).map(
    (beach) => ({
      beachName: beach.name,
      beachSlug: beach.slug,
      preferredTideMin: beach.preferred_tide_ft_min,
      preferredTideMax: beach.preferred_tide_ft_max,
      preferredDirection: beach.preferred_tide_direction,
      skillLevel: beach.skill_level,
    })
  );

  return {
    ...baseTideData,
    sevenDayExtrema,
    hourlyPoints,
    beachTidePreferences,
  };
}

/**
 * Get water temperature history for a city's intent page
 *
 * Finds a representative beach and retrieves the past 7 days of
 * water temperature readings for trend visualization.
 */
export async function getCityWaterTempHistory(
  cityName: string,
  state: string
): Promise<CityWaterTempData | null> {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Calculate date range (past 7 days including today)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const todayStr = today.toISOString().split("T")[0];
    const startDateStr = sevenDaysAgo.toISOString().split("T")[0];

    const beach = await findRepresentativeBeach(supabase, cityName, state);
    if (!beach) {
      console.log(`No beach found for ${cityName}, ${state}`);
      return null;
    }

    return fetchWaterTempData(supabase, beach, startDateStr, todayStr);
  } catch (error) {
    console.error("Error in getCityWaterTempHistory:", error);
    return null;
  }
}

/**
 * Fetch water temperature data for a specific beach
 */
async function fetchWaterTempData(
  supabase: SupabaseClient,
  beach: { id: string; name: string },
  startDate: string,
  endDate: string
): Promise<CityWaterTempData | null> {
  // Get one forecast per day with water_temp data
  // Use early morning forecast (first of day) for consistency
  const endNextDay = new Date(new Date(endDate + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
  const { data: forecasts, error: forecastError } = await supabase
    .from("enhanced_forecasts")
    .select("forecast_date, forecast_at, water_temp, forecast_time")
    .eq("beach_id", beach.id)
    .gte("forecast_at", `${startDate}T00:00:00Z`)
    .lt("forecast_at", `${endNextDay}T00:00:00Z`)
    .not("water_temp", "is", null)
    .order("forecast_at", { ascending: true });

  if (forecastError) {
    console.error("Error fetching water temp history:", forecastError.message);
    return null;
  }

  if (!forecasts || forecasts.length === 0) {
    console.log(`No water temp data found for beach ${beach.id}`);
    return null;
  }

  // Deduplicate by date (keep first forecast of each day)
  const seenDates = new Set<string>();
  const points: Array<{ date: string; tempF: number }> = [];
  let latestTemp: number | null = null;

  for (const forecast of forecasts) {
    if (seenDates.has(forecast.forecast_date)) continue;

    const tempF = parseWaterTempF(forecast.water_temp);
    if (tempF === null) continue;

    seenDates.add(forecast.forecast_date);
    points.push({
      date: forecast.forecast_date,
      tempF,
    });
    latestTemp = tempF;
  }

  if (points.length === 0 || latestTemp === null) {
    return null;
  }

  return {
    currentTemp: latestTemp,
    points,
    beachName: beach.name,
  };
}
