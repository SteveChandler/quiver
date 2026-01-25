"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TidePoint } from "@/components/forecast/tide-chart-recharts";
import type { TideScheduleEntry } from "@/types/forecast";
import { parseWaterTempF } from "@/lib/utils/wetsuit-utils";

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
    const { data: beachWithForecast, error: beachError } = await supabase
      .from("enhanced_forecasts")
      .select(
        `
        beach_id,
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
      .eq("forecast_date", today)
      .ilike("beaches.city", cityName)
      .ilike("beaches.state", state)
      .order("forecast_time", { ascending: true })
      .limit(1)
      .single();

    if (beachError || !beachWithForecast) {
      // Try with state abbreviation matching (CA vs California)
      const { data: altBeach, error: altError } = await supabase
        .from("enhanced_forecasts")
        .select(
          `
          beach_id,
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
        .eq("forecast_date", today)
        .ilike("beaches.city", cityName)
        .order("forecast_time", { ascending: true })
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

    // First find a representative beach in the city
    const { data: beachData, error: beachError } = await supabase
      .from("beaches")
      .select("id, name, city, state")
      .ilike("city", cityName)
      .ilike("state", state)
      .order("name", { ascending: true })
      .limit(1)
      .single();

    if (beachError || !beachData) {
      // Try with state abbreviation matching
      const { data: altBeach, error: altError } = await supabase
        .from("beaches")
        .select("id, name, city, state")
        .ilike("city", cityName)
        .order("name", { ascending: true })
        .limit(1)
        .single();

      if (altError || !altBeach) {
        console.log(
          `No beach found for ${cityName}, ${state}:`,
          beachError?.message || altError?.message
        );
        return null;
      }

      return fetchWaterTempData(supabase, altBeach, startDateStr, todayStr);
    }

    return fetchWaterTempData(supabase, beachData, startDateStr, todayStr);
  } catch (error) {
    console.error("Error in getCityWaterTempHistory:", error);
    return null;
  }
}

/**
 * Fetch water temperature data for a specific beach
 */
async function fetchWaterTempData(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  beach: { id: string; name: string },
  startDate: string,
  endDate: string
): Promise<CityWaterTempData | null> {
  // Get one forecast per day with water_temp data
  // Use early morning forecast (first of day) for consistency
  const { data: forecasts, error: forecastError } = await supabase
    .from("enhanced_forecasts")
    .select("forecast_date, water_temp, forecast_time")
    .eq("beach_id", beach.id)
    .gte("forecast_date", startDate)
    .lte("forecast_date", endDate)
    .not("water_temp", "is", null)
    .order("forecast_date", { ascending: true })
    .order("forecast_time", { ascending: true });

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
