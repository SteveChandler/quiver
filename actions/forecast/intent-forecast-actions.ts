"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TidePoint } from "@/components/forecast/tide-chart-recharts";
import type { TideScheduleEntry } from "@/types/forecast";
import { parseWaterTempF, getWetsuitRecommendation } from "@/lib/utils/wetsuit-utils";
import { TideExtremaDetector } from "@/lib/services/noaa-coops/tide-extrema-detector";
import { getTideHeightAtTime, getTideStatusAtTime, getNextTideFromTime } from "@/lib/services/noaa-coops/tide-analysis";
import type { TideData } from "@/lib/services/noaa-coops/types";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import { findMagicHour } from "@/lib/services/magic-hour/magic-hour-finder";
import type { BeachMetadata, MagicHourResult } from "@/lib/services/magic-hour/types";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import { sanitizeIntentForecastForMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/intent";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type { RecommendationAvailability } from "@/lib/recommendations/major-event-hold/types";
import { rankBeaches, selectBeach } from "@/lib/recommendations/selection";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>;

/**
 * Get timezone for a US state. Covers all in-coverage coastal states.
 */
function getTimezoneForState(state: string): string {
  const stateUpper = state.toUpperCase();
  if (stateUpper === "HI") return "Pacific/Honolulu";
  if (stateUpper === "PR") return "America/Puerto_Rico";
  // All other in-coverage states (CA, OR, WA, Baja) use Pacific
  return "America/Los_Angeles";
}

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

export type CityIntentDataAvailability = "available" | "missing" | "unknown";

/**
 * Per-beach water temperature for comparison table
 */
export interface BeachWaterTemp {
  beachName: string;
  beachSlug: string | null;
  tempF: number;
  wetsuitThickness: string;
}

/**
 * Monthly average water temperature (optional historical data)
 */
export interface MonthlyWaterTempAvg {
  month: number;       // 1-12
  monthLabel: string;  // "Jan", "Feb", etc.
  avgTempF: number;
  minTempF: number;
  maxTempF: number;
}

/**
 * Expanded water temperature data for the dedicated water-temp page
 */
export interface CityWaterTempExpanded extends CityWaterTempData {
  /** Wetsuit recommendation for current temp */
  wetsuitRecommendation: {
    thickness: string;
    description: string;
    extras: string[];
  };
  /** Per-beach current temperatures for comparison */
  beachTemps: BeachWaterTemp[];
  /** Monthly average temps (null if insufficient historical data) */
  monthlyAverages: MonthlyWaterTempAvg[] | null;
}

/**
 * Sun times data for dawn-patrol and sunset intent pages
 */
export interface CitySunTimesData {
  /** Formatted sunrise time (e.g., "6:32 AM") */
  sunrise: string;
  /** Formatted sunset time (e.g., "5:48 PM") */
  sunset: string;
  /** Civil twilight begin approximation (sunrise - 30min) */
  firstLight: string;
  /** Civil twilight end approximation (sunset + 30min) */
  lastLight: string;
  /** Day length formatted (e.g., "11h 16m") */
  dayLength: string;
  /** Day length change vs yesterday (e.g., "+2 min" or "-1 min") */
  dayLengthChange: string;
  /** Golden hour window (sunset - 60min to sunset) */
  goldenHour: { start: string; end: string } | null;
  /** 7-day sun times forecast */
  sevenDayTimes: Array<{
    date: string;
    label: string;
    sunrise: string;
    sunset: string;
    dayLength: string;
    isToday: boolean;
  }>;
  /** Beach used for data attribution */
  beachName: string;
}

/**
 * Summary of forecast conditions for the "Today's Plan" module on intent pages.
 */
export interface IntentForecastSummary {
  bestWindow: { start: string; end: string; reason: string } | null;
  topPicks: Array<{
    beachId: string;
    name: string;
    slug: string;
    waveHeight: string;
    windDirection: string;
    score: number;
    citySlug?: string;
    stateSlug?: string;
  }>;
  conditions: { tide: string; wind: string; swell: string };
  isTomorrow: boolean;
  recommendationAvailability: RecommendationAvailability;
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

      return hasUsableTideForecastRow(altBeach) ? processTideData(altBeach, state) : null;
    }

    return hasUsableTideForecastRow(beachWithForecast) ? processTideData(beachWithForecast, state) : null;
  } catch (error) {
    console.error("Error in getCityTideData:", error);
    return null;
  }
}

/**
 * Process raw forecast data into CityTideData.
 * Dynamically computes current tide values from the tide_schedule array
 * rather than relying on pre-computed fields (which reflect the forecast
 * row's time slot, not the actual current time).
 */
function processTideData(forecastData: any, state: string): CityTideData | null {
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

  // Convert TideScheduleEntry[] to TideData[] for tide-analysis functions
  const tideData: TideData[] = tideSchedule
    ? tideSchedule.map((entry) => ({
        time: entry.time,
        height: entry.height,
        type: entry.type,
        name: entry.type === "high" ? "High Tide" : "Low Tide",
      }))
    : [];

  // Dynamically compute current tide values from schedule
  const now = new Date();
  const computedHeight = getTideHeightAtTime(tideData, now);
  const computedStatus = getTideStatusAtTime(tideData, now);
  const nextTide = getNextTideFromTime(tideData, now);

  const timeZone = getTimezoneForState(state);
  const nextTideTimeFormatted = nextTide
    ? new Date(nextTide.time * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      })
    : null;

  return {
    tidePoints,
    currentStatus: computedStatus !== "Unknown" ? computedStatus : (forecastData.tide_status || null),
    currentHeight: computedHeight != null ? `${computedHeight} ft` : (forecastData.tide_height || null),
    nextTideType: nextTide ? (nextTide.type === "high" ? "High" : "Low") : (forecastData.next_tide_type || null),
    nextTideTime: nextTideTimeFormatted || (forecastData.next_tide_time || null),
    nextTideHeight: nextTide ? `${nextTide.height} ft` : (forecastData.next_tide_height || null),
    beachName: beach?.name || "Unknown Beach",
    tideStation: rawForecast?.tide_station?.name || null,
  };
}

function hasUsableTideForecastRow(forecastData: any): boolean {
  const rawForecast = forecastData.raw_forecast as {
    tide_schedule?: TideScheduleEntry[];
  } | null;

  return (
    (Array.isArray(rawForecast?.tide_schedule) && rawForecast.tide_schedule.length >= 2) ||
    Boolean(
      forecastData.tide_status ||
      forecastData.tide_height ||
      forecastData.next_tide_time ||
      forecastData.next_tide_type ||
      forecastData.next_tide_height
    )
  );
}

/**
 * Format a date for day labels: "Today", "Tomorrow", or "Wed, Feb 12"
 * Uses explicit timezone to ensure deterministic server-side output.
 */
function formatDayLabel(date: Date, today: Date, timeZone: string): string {
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
): Promise<{ id: string; name: string; timezone: string | null } | null> {
  const { data } = await supabase
    .from("beaches")
    .select("id, name, timezone")
    .ilike("city", cityName)
    .ilike("state", state)
    .order("name", { ascending: true })
    .limit(1)
    .single();

  if (data) return selectBeach(data);

  const { data: alt } = await supabase
    .from("beaches")
    .select("id, name, timezone")
    .ilike("city", cityName)
    .order("name", { ascending: true })
    .limit(1)
    .single();

  return alt ? selectBeach(alt) : null;
}

async function findRepresentativeBeachStrict(
  supabase: SupabaseClient,
  cityName: string,
  state: string,
): Promise<{ id: string; name: string; timezone: string | null } | null> {
  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, timezone")
    .ilike("city", cityName)
    .ilike("state", state)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return selectBeach(data);

  const { data: alt, error: altError } = await supabase
    .from("beaches")
    .select("id, name, timezone")
    .ilike("city", cityName)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (altError) throw altError;
  return alt ? selectBeach(alt) : null;
}

async function fetchCityTideRowsForAvailability(
  supabase: SupabaseClient,
  cityName: string,
  state?: string,
): Promise<any[]> {
  const today = new Date().toISOString().split("T")[0];
  const nextDay = new Date(new Date(`${today}T00:00:00Z`).getTime() + 86400000)
    .toISOString()
    .split("T")[0];

  let query = supabase
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
    .limit(5);

  if (state) {
    query = query.ilike("beaches.state", state);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function getCityTideDataAvailability(
  supabase: SupabaseClient,
  cityName: string,
  state: string,
): Promise<CityIntentDataAvailability> {
  const rowsWithState = await fetchCityTideRowsForAvailability(supabase, cityName, state);
  const rows = rowsWithState.length > 0
    ? rowsWithState
    : await fetchCityTideRowsForAvailability(supabase, cityName);

  if (rows.length === 0) return "missing";

  return rows.some(hasUsableTideForecastRow)
    ? "available"
    : "missing";
}

async function getCityWaterTempDataAvailability(
  supabase: SupabaseClient,
  cityName: string,
  state: string,
): Promise<CityIntentDataAvailability> {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const todayStr = today.toISOString().split("T")[0];
  const startDateStr = sevenDaysAgo.toISOString().split("T")[0];
  const endNextDay = new Date(new Date(`${todayStr}T00:00:00Z`).getTime() + 86400000)
    .toISOString()
    .split("T")[0];

  const beach = await findRepresentativeBeachStrict(supabase, cityName, state);
  if (!beach) return "missing";

  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("forecast_at, water_temp")
    .eq("beach_id", beach.id)
    .gte("forecast_at", `${startDateStr}T00:00:00Z`)
    .lt("forecast_at", `${endNextDay}T00:00:00Z`)
    .not("water_temp", "is", null)
    .order("forecast_at", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return "missing";

  return data.some((forecast) => parseWaterTempF(forecast.water_temp) !== null)
    ? "available"
    : "missing";
}

export async function getCityIntentDataAvailability(
  intent: "tide" | "water-temp",
  cityName: string,
  state: string,
): Promise<CityIntentDataAvailability> {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    if (intent === "tide") {
      return getCityTideDataAvailability(supabase, cityName, state);
    }

    return getCityWaterTempDataAvailability(supabase, cityName, state);
  } catch (error) {
    console.error("Error in getCityIntentDataAvailability:", error);
    return "unknown";
  }
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

    const timeZone = repBeach.timezone || getTimezoneForState(state);
    return fetchExpandedTideData(supabase, repBeach.id, cityName, state, baseTideData, chartStart, sevenDaysLater, timeZone);
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
  endDate: Date,
  timeZone: string
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
    .select("forecast_date, forecast_at, water_temp")
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

/**
 * Fetch monthly average water temperatures from historical forecast data.
 * Returns null if fewer than 3 months of data available.
 */
async function fetchMonthlyWaterTempAverages(
  supabase: SupabaseClient,
  cityName: string,
  state: string
): Promise<MonthlyWaterTempAvg[] | null> {
  try {
    const beach = await findRepresentativeBeach(supabase, cityName, state);
    if (!beach) return null;

    // Fetch last 12 months of data and compute averages in JS
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: rawData } = await supabase
      .from("enhanced_forecasts")
      .select("forecast_at, water_temp")
      .eq("beach_id", beach.id)
      .gte("forecast_at", twelveMonthsAgo.toISOString())
      .not("water_temp", "is", null)
      .order("forecast_at", { ascending: true });

    if (!rawData || rawData.length === 0) return null;

    // Group by month and compute averages
    const monthBuckets = new Map<number, number[]>();
    for (const row of rawData) {
      const tempF = parseWaterTempF(row.water_temp);
      if (tempF === null) continue;
      const month = new Date(row.forecast_at).getMonth() + 1; // 1-12
      const bucket = monthBuckets.get(month) ?? [];
      bucket.push(tempF);
      monthBuckets.set(month, bucket);
    }

    // Need at least 3 months with data
    if (monthBuckets.size < 3) return null;

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const result: MonthlyWaterTempAvg[] = [];

    for (let m = 1; m <= 12; m++) {
      const temps = monthBuckets.get(m);
      if (!temps || temps.length === 0) {
        // Skip months with no data
        continue;
      }
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      result.push({
        month: m,
        monthLabel: monthLabels[m - 1],
        avgTempF: Math.round(avg * 10) / 10,
        minTempF: Math.round(Math.min(...temps) * 10) / 10,
        maxTempF: Math.round(Math.max(...temps) * 10) / 10,
      });
    }

    return result.length >= 3 ? result : null;
  } catch (error) {
    console.error("Error fetching monthly water temp averages:", error);
    return null;
  }
}

/**
 * Get expanded water temperature data for the dedicated water-temp page.
 * Includes per-beach comparison and monthly averages.
 */
export async function getCityWaterTempExpanded(
  cityName: string,
  state: string
): Promise<CityWaterTempExpanded | null> {
  try {
    const [baseData, supabase] = await Promise.all([
      getCityWaterTempHistory(cityName, state),
      createSupabaseServiceRoleClient(),
    ]);
    if (!baseData) return null;

    const wetsuitRec = getWetsuitRecommendation(baseData.currentTemp);

    // Fetch per-beach temps: get all beaches in city with today's water_temp
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];

    // Use a subquery pattern: get latest forecast per beach with water_temp
    const { data: beachForecasts } = await supabase
      .from("enhanced_forecasts")
      .select(`
        beach_id,
        water_temp,
        forecast_at,
        beaches!inner (
          name,
          slug,
          city,
          state
        )
      `)
      .ilike("beaches.city", cityName)
      .ilike("beaches.state", state)
      .gte("forecast_at", `${today}T00:00:00Z`)
      .lt("forecast_at", `${tomorrow}T00:00:00Z`)
      .not("water_temp", "is", null)
      .order("forecast_at", { ascending: false });

    // Deduplicate: keep first (most recent) forecast per beach
    const seenBeaches = new Set<string>();
    const beachTemps: BeachWaterTemp[] = [];

    if (beachForecasts) {
      for (const row of beachForecasts) {
        if (seenBeaches.has(row.beach_id)) continue;
        seenBeaches.add(row.beach_id);

        const tempF = parseWaterTempF(row.water_temp);
        if (tempF === null) continue;

        const beach = row.beaches as any;
        const rec = getWetsuitRecommendation(tempF);
        beachTemps.push({
          beachName: beach.name,
          beachSlug: beach.slug ?? null,
          tempF,
          wetsuitThickness: rec.thickness,
        });
      }
    }

    // Sort beachTemps by temp descending (warmest first)
    beachTemps.sort((a, b) => b.tempF - a.tempF);

    // Attempt monthly averages from historical data
    const monthlyAverages = await fetchMonthlyWaterTempAverages(supabase, cityName, state);

    return {
      ...baseData,
      wetsuitRecommendation: {
        thickness: wetsuitRec.thickness,
        description: wetsuitRec.description,
        extras: wetsuitRec.extras,
      },
      beachTemps,
      monthlyAverages,
    };
  } catch (error) {
    console.error("Error in getCityWaterTempExpanded:", error);
    return null;
  }
}

/**
 * Get sun times data for dawn-patrol and sunset intent pages.
 * Queries the sun_times table for a representative beach and returns
 * formatted sunrise/sunset data with twilight and golden hour approximations.
 *
 * Twilight approximations (standard photography/surfing conventions):
 * - First light (civil twilight begin) ≈ sunrise - 30 minutes
 * - Last light (civil twilight end) ≈ sunset + 30 minutes
 * - Golden hour start ≈ sunset - 60 minutes
 * - Golden hour end ≈ sunset
 */
export async function getCitySunTimesData(
  cityName: string,
  state: string
): Promise<CitySunTimesData | null> {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const beach = await findRepresentativeBeach(supabase, cityName, state);
    if (!beach) return null;

    // Fetch today + next 6 days + yesterday (for day length change)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sixDaysLater = new Date(today);
    sixDaysLater.setDate(sixDaysLater.getDate() + 6);

    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];
    const endStr = sixDaysLater.toISOString().split("T")[0];

    const { data: sunTimes, error } = await supabase
      .from("sun_times")
      .select("date, sunrise_utc, sunset_utc")
      .eq("beach_id", beach.id)
      .gte("date", yesterdayStr)
      .lte("date", endStr)
      .order("date", { ascending: true });

    if (error || !sunTimes || sunTimes.length === 0) {
      console.log(`No sun times data for ${cityName}, ${state}:`, error?.message);
      return null;
    }

    const timeZone = beach.timezone || getTimezoneForState(state);
    const timeFmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Find today's and yesterday's data
    const todayData = sunTimes.find(st => st.date === todayStr);
    const yesterdayData = sunTimes.find(st => st.date === yesterdayStr);

    if (!todayData || !todayData.sunrise_utc || !todayData.sunset_utc) {
      console.log(`No sun times for today (${todayStr}) for beach ${beach.id}`);
      return null;
    }

    const todaySunrise = new Date(todayData.sunrise_utc);
    const todaySunset = new Date(todayData.sunset_utc);

    // Calculate day length in minutes
    const todayDayLengthMin = Math.round((todaySunset.getTime() - todaySunrise.getTime()) / 60000);

    // Calculate day length change vs yesterday
    let dayLengthChangeStr = "";
    if (yesterdayData?.sunrise_utc && yesterdayData?.sunset_utc) {
      const ySunrise = new Date(yesterdayData.sunrise_utc);
      const ySunset = new Date(yesterdayData.sunset_utc);
      const yDayLengthMin = Math.round((ySunset.getTime() - ySunrise.getTime()) / 60000);
      const diff = todayDayLengthMin - yDayLengthMin;
      if (diff > 0) dayLengthChangeStr = `+${diff} min vs yesterday`;
      else if (diff < 0) dayLengthChangeStr = `${diff} min vs yesterday`;
      else dayLengthChangeStr = "Same as yesterday";
    }

    // Calculate twilight approximations
    const firstLightDate = new Date(todaySunrise.getTime() - 30 * 60000);
    const lastLightDate = new Date(todaySunset.getTime() + 30 * 60000);

    // Golden hour: sunset - 60min to sunset
    const goldenHourStart = new Date(todaySunset.getTime() - 60 * 60000);

    // Format day length
    const hours = Math.floor(todayDayLengthMin / 60);
    const mins = todayDayLengthMin % 60;
    const dayLengthFormatted = `${hours}h ${mins}m`;

    // Build 7-day times (skip yesterday)
    const todayDate = new Date(todayStr + "T12:00:00");
    const sevenDayTimes = sunTimes
      .filter(st => st.date >= todayStr && st.sunrise_utc && st.sunset_utc)
      .slice(0, 7)
      .map(st => {
        const sunrise = new Date(st.sunrise_utc!);
        const sunset = new Date(st.sunset_utc!);
        const dayMin = Math.round((sunset.getTime() - sunrise.getTime()) / 60000);
        const h = Math.floor(dayMin / 60);
        const m = dayMin % 60;
        const stDate = new Date(st.date + "T12:00:00");

        return {
          date: st.date,
          label: formatDayLabel(stDate, todayDate, timeZone),
          sunrise: timeFmt.format(sunrise),
          sunset: timeFmt.format(sunset),
          dayLength: `${h}h ${m}m`,
          isToday: st.date === todayStr,
        };
      });

    return {
      sunrise: timeFmt.format(todaySunrise),
      sunset: timeFmt.format(todaySunset),
      firstLight: timeFmt.format(firstLightDate),
      lastLight: timeFmt.format(lastLightDate),
      dayLength: dayLengthFormatted,
      dayLengthChange: dayLengthChangeStr,
      goldenHour: {
        start: timeFmt.format(goldenHourStart),
        end: timeFmt.format(todaySunset),
      },
      sevenDayTimes,
      beachName: beach.name,
    };
  } catch (error) {
    console.error("Error in getCitySunTimesData:", error);
    return null;
  }
}

/**
 * Build a human-readable reason string from a MagicHourResult.
 */
function buildWindowReason(result: MagicHourResult): string {
  const parts: string[] = [];
  if (result.tideInRange) parts.push("incoming tide");
  if (result.windQuality === "perfect") parts.push("offshore winds");
  else if (result.windQuality === "acceptable") parts.push("light winds");
  else if (result.windQuality === "cross") parts.push("cross-shore winds");
  if (result.swellMatch) parts.push("good swell angle");
  return parts.length > 0 ? parts.join(", ") : "favorable conditions";
}

/**
 * Get forecast summary for the "Today's Plan" module on intent pages.
 *
 * Takes a set of beaches (typically the top beaches for a city/intent),
 * queries their forecasts, and runs the Magic Hour finder to identify the
 * best surf window and top-scoring beaches for today (or tomorrow as fallback).
 *
 * @param beaches - Array of beach objects with metadata for scoring
 * @param intentSlug - The intent slug (e.g., "surf-report") for context
 * @returns IntentForecastSummary or null if no forecast data is available
 */
export async function getIntentForecastSummary(
  beaches: Array<{
    id: string;
    name: string;
    slug: string;
    city?: string;
    state?: string;
    skill_level?: string | null;
    swell_window_center_deg?: number | null;
    swell_window_halfwidth_deg?: number | null;
    wind_offshore_deg?: number | null;
    wind_offshore_tol_deg?: number | null;
    preferred_tide_ft_min?: number | null;
    preferred_tide_ft_max?: number | null;
  }>,
  intentSlug: string
): Promise<IntentForecastSummary | null> {
  try {
    const rankedInputBeaches = await rankBeaches(
      beaches.map((beach, index) => ({ beach, id: beach.id, index })),
      { compare: (left, right) => left.index - right.index },
    );
    const selectedBeaches = rankedInputBeaches
      .slice(0, 5)
      .map(({ beach }) => beach);
    const beachIds = selectedBeaches.map((b) => b.id);

    if (beachIds.length === 0) return null;

    const supabase = await createSupabaseServiceRoleClient();

    // Build date range: today start through tomorrow end (UTC)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(todayStart);
    tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 2); // day-after-tomorrow 00:00 = tomorrow end

    // Batched query for today + tomorrow forecasts
    const { data: forecasts, error } = await supabase
      .from("enhanced_forecasts")
      .select(
        "id, beach_id, forecast_at, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_direction_deg, wind_speed, tide_height, tide_status, created_at, updated_at"
      )
      .in("beach_id", beachIds)
      .gte("forecast_at", todayStart.toISOString())
      .lt("forecast_at", tomorrowEnd.toISOString())
      .order("forecast_at", { ascending: true });

    if (error) {
      console.error("Error fetching intent forecast summary:", error.message);
      return null;
    }

    if (!forecasts || forecasts.length === 0) {
      return null;
    }

    // Group forecasts by beach_id
    const forecastsByBeach = new Map<string, EnhancedForecastEntity[]>();
    for (const f of forecasts) {
      const existing = forecastsByBeach.get(f.beach_id) ?? [];
      existing.push(f as EnhancedForecastEntity);
      forecastsByBeach.set(f.beach_id, existing);
    }

    // Build BeachMetadata for each beach
    const beachMetaMap = new Map<string, BeachMetadata>();
    for (const beach of selectedBeaches) {
      beachMetaMap.set(beach.id, {
        id: beach.id,
        name: beach.name,
        slug: beach.slug,
        skill_level: beach.skill_level ?? null,
        swell_window_center_deg: beach.swell_window_center_deg ?? null,
        swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
        wind_offshore_deg: beach.wind_offshore_deg ?? null,
        wind_offshore_tol_deg: beach.wind_offshore_tol_deg ?? null,
        preferred_tide_ft_min: beach.preferred_tide_ft_min ?? null,
        preferred_tide_ft_max: beach.preferred_tide_ft_max ?? null,
      });
    }

    // Run findMagicHour for today first
    let isTomorrow = false;
    let results: Array<{
      beach: (typeof selectedBeaches)[number];
      result: MagicHourResult;
      forecasts: EnhancedForecastEntity[];
    }> = [];

    const todayTarget = new Date();
    results = runMagicHourForBeaches(
      selectedBeaches,
      forecastsByBeach,
      beachMetaMap,
      todayTarget
    );

    // Check if all results have found: false OR all peakTimes are in the past
    const allMissedToday = results.every((r) => {
      if (!r.result.found) return true;
      if (r.result.peakTime && r.result.peakTime.getTime() < now.getTime())
        return true;
      return false;
    });

    if (allMissedToday) {
      // Fallback to tomorrow
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const tomorrowResults = runMagicHourForBeaches(
        selectedBeaches,
        forecastsByBeach,
        beachMetaMap,
        tomorrow
      );

      // Only switch to tomorrow if we got at least one result
      const hasTomorrowResult = tomorrowResults.some((r) => r.result.found);
      if (hasTomorrowResult) {
        results = tomorrowResults;
        isTomorrow = true;
      }
    }

    // Sort every positive result before policy filtering. The adapter owns the
    // final top-three truncation so a held rank-one result cannot hide rank four.
    const sortedResults = results
      .filter((r) => r.result.found)
      .sort((a, b) => b.result.confidence - a.result.confidence);

    const rankedItems = sortedResults.map((r) => {
      // Find the best forecast row for wave/wind display
      const beachForecasts = r.forecasts;
      const representativeForecast = beachForecasts[0];
      const peakTimeMs = r.result.peakTime?.getTime() ?? NaN;
      const peakTime = Number.isFinite(peakTimeMs)
        ? new Date(peakTimeMs).toISOString()
        : "";
      const candidate = {
        candidateId: `intent:${r.beach.id}:${peakTime || "invalid"}`,
        beachId: r.beach.id,
        startsAt: Number.isFinite(peakTimeMs)
          ? new Date(peakTimeMs - 30 * 60 * 1000).toISOString()
          : "",
        endsAt: Number.isFinite(peakTimeMs)
          ? new Date(peakTimeMs + 30 * 60 * 1000).toISOString()
          : "",
      };

      return {
        candidate,
        peakTime,
        topPick: {
          beachId: r.beach.id,
          name: r.beach.name,
          slug: r.beach.slug,
          waveHeight: representativeForecast?.wave_height ?? "N/A",
          windDirection: representativeForecast?.wind_speed
            ? `${representativeForecast.wind_speed}`
            : "N/A",
          score: Math.round(r.result.confidence * 100),
          citySlug: r.beach.city?.toLowerCase().replace(/\s+/g, "-"),
          stateSlug: r.beach.state?.toLowerCase().replace(/\s+/g, "-"),
        },
      };
    });

    const safeRankedItems = await rankBeaches(
      rankedItems.map((item) => ({
        id: item.candidate.beachId,
        item,
      })),
      {
        compare: (left, right) =>
          right.item.topPick.score - left.item.topPick.score,
      },
    );

    // Extract bestWindow from the top result
    let bestWindow: IntentForecastSummary["bestWindow"] = null;
    if (safeRankedItems.length > 0) {
      const best = sortedResults.find(
        (result) => result.beach.id === safeRankedItems[0].id,
      );
      if (!best) return null;
      bestWindow = {
        start: best.result.windowStart ?? "",
        end: best.result.windowEnd ?? "",
        reason: buildWindowReason(best.result),
      };
    }

    // Extract conditions from the best beach's forecast data
    const bestForecasts: EnhancedForecastEntity[] =
      safeRankedItems.length > 0
        ? forecastsByBeach.get(safeRankedItems[0].id) ?? []
        : (forecasts as EnhancedForecastEntity[]);
    const conditionForecast = bestForecasts[0];

    const conditions: IntentForecastSummary["conditions"] = {
      tide: conditionForecast?.tide_status ?? "Unknown",
      wind: conditionForecast?.wind_speed ?? "Unknown",
      swell: conditionForecast?.wave_height ?? "Unknown",
    };

    const safeItems = safeRankedItems.map(({ item }) => item);
    const candidates = safeItems.map(({ candidate }) => candidate);
    const decisions = await evaluateMajorEventHoldCandidates({
      candidates,
      profileExperience: null,
      applyWaterQualityHolds: true,
    });

    return sanitizeIntentForecastForMajorEventHold(
      {
        items: safeItems,
        bestWindow,
        bestWindowSourceCandidateId:
          safeItems[0]?.candidate.candidateId ?? null,
        conditions,
        isTomorrow,
      },
      candidates,
      decisions,
    );
  } catch (error) {
    console.error("Error in getIntentForecastSummary:", error);
    return null;
  }
}

/**
 * State-level water temperature overview for the conditions state page.
 * Single query joining enhanced_forecasts for representative beaches across top cities.
 */
export async function getStateWaterTempOverview(
  stateSlug: string
): Promise<Array<{ cityName: string; citySlug: string; tempF: number; wetsuitThickness: string }>> {
  try {
    const supabase = await createSupabaseServiceRoleClient();
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];

    // Get one forecast per city with water temp, ordered geographically (north to south by lat)
    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select(`
        water_temp,
        forecast_at,
        beaches!inner (
          name,
          city,
          state,
          lat,
          slug
        )
      `)
      .ilike("beaches.state", stateSlug)
      .gte("forecast_at", `${today}T00:00:00Z`)
      .lt("forecast_at", `${tomorrow}T00:00:00Z`)
      .not("water_temp", "is", null)
      .order("forecast_at", { ascending: false })
      .limit(200);

    if (error || !data) return [];

    // Deduplicate by city (keep first/most recent per city)
    const cityMap = new Map<string, { cityName: string; state: string; lat: number; tempF: number }>();
    for (const row of data) {
      const beach = row.beaches as any;
      const city = beach.city as string;
      if (cityMap.has(city)) continue;

      const tempF = parseWaterTempF(row.water_temp);
      if (tempF === null) continue;

      cityMap.set(city, {
        cityName: city,
        state: beach.state as string,
        lat: beach.lat ?? 0,
        tempF,
      });
    }

    // Sort north to south (descending latitude)
    const cities = Array.from(cityMap.values())
      .sort((a, b) => b.lat - a.lat)
      .slice(0, 10);

    return cities.map(c => ({
      cityName: c.cityName,
      citySlug: buildCitySlug(c.cityName, c.state, COLLISION_CITY_MAP) || c.cityName.toLowerCase().replace(/\s+/g, "-"),
      tempF: c.tempF,
      wetsuitThickness: getWetsuitRecommendation(c.tempF).thickness,
    }));
  } catch (error) {
    console.error("Error in getStateWaterTempOverview:", error);
    return [];
  }
}

/**
 * State-level sun times overview for dawn-patrol/sunset state pages.
 */
export async function getStateSunTimesOverview(
  stateSlug: string
): Promise<Array<{ cityName: string; citySlug: string; sunrise: string; sunset: string; firstLight: string; goldenHourStart: string }>> {
  try {
    const supabase = await createSupabaseServiceRoleClient();
    const todayStr = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("sun_times")
      .select(`
        sunrise_utc,
        sunset_utc,
        beaches!inner (
          city,
          state,
          lat,
          timezone
        )
      `)
      .ilike("beaches.state", stateSlug)
      .eq("date", todayStr)
      .limit(200);

    if (error || !data) return [];

    const fallbackTimeZone = getTimezoneForState(stateSlug);

    // Deduplicate by city
    const cityMap = new Map<string, { cityName: string; state: string; lat: number; sunrise: Date; sunset: Date; timezone: string }>();
    for (const row of data) {
      const beach = row.beaches as any;
      const city = beach.city as string;
      if (cityMap.has(city) || !row.sunrise_utc || !row.sunset_utc) continue;

      cityMap.set(city, {
        cityName: city,
        state: beach.state as string,
        lat: beach.lat ?? 0,
        sunrise: new Date(row.sunrise_utc),
        sunset: new Date(row.sunset_utc),
        timezone: (beach.timezone as string) || fallbackTimeZone,
      });
    }

    // Sort north to south
    const cities = Array.from(cityMap.values())
      .sort((a, b) => b.lat - a.lat)
      .slice(0, 10);

    return cities.map(c => {
      const timeFmt = new Intl.DateTimeFormat("en-US", {
        timeZone: c.timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return {
        cityName: c.cityName,
        citySlug: buildCitySlug(c.cityName, c.state, COLLISION_CITY_MAP) || c.cityName.toLowerCase().replace(/\s+/g, "-"),
        sunrise: timeFmt.format(c.sunrise),
        sunset: timeFmt.format(c.sunset),
        firstLight: timeFmt.format(new Date(c.sunrise.getTime() - 30 * 60000)),
        goldenHourStart: timeFmt.format(new Date(c.sunset.getTime() - 60 * 60000)),
      };
    });
  } catch (error) {
    console.error("Error in getStateSunTimesOverview:", error);
    return [];
  }
}

/**
 * Run findMagicHour for each beach with a given target date.
 */
function runMagicHourForBeaches(
  beaches: Array<{
    id: string;
    name: string;
    slug: string;
    city?: string;
    state?: string;
    skill_level?: string | null;
    swell_window_center_deg?: number | null;
    swell_window_halfwidth_deg?: number | null;
    wind_offshore_deg?: number | null;
    wind_offshore_tol_deg?: number | null;
    preferred_tide_ft_min?: number | null;
    preferred_tide_ft_max?: number | null;
  }>,
  forecastsByBeach: Map<string, EnhancedForecastEntity[]>,
  beachMetaMap: Map<string, BeachMetadata>,
  targetDate: Date
): Array<{
  beach: (typeof beaches)[number];
  result: MagicHourResult;
  forecasts: EnhancedForecastEntity[];
}> {
  const results: Array<{
    beach: (typeof beaches)[number];
    result: MagicHourResult;
    forecasts: EnhancedForecastEntity[];
  }> = [];

  for (const beach of beaches) {
    const beachForecasts = forecastsByBeach.get(beach.id);
    if (!beachForecasts || beachForecasts.length === 0) continue;

    const meta = beachMetaMap.get(beach.id);
    if (!meta) continue;

    const result = findMagicHour(beachForecasts, meta, {
      targetDate,
    });

    results.push({ beach, result, forecasts: beachForecasts });
  }

  return results;
}
