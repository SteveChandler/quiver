import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-utils";
import { withProtection } from "@/lib/middleware/api-wrappers";
import {
  analyzeOptimalTimes,
  buildSyntheticBlocks,
  type OptimalTimeSlot,
} from "@/lib/session-planner/optimal-times-utils";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OptimalTimesResponse {
  beachId: string;
  date: string;
  optimalTimes: OptimalTimeSlot[];
  forecastSource: string;
  generatedAt: string;
}

/**
 * Convert wind direction in degrees to compass direction
 */
function getWindDirection(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Analyzes forecast data to recommend optimal surf times
 * GET /api/session-planner/optimal-times?beachId=xxx&date=YYYY-MM-DD&selectedTime=HH:MM
 */
async function optimalTimesHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let beachId = searchParams.get("beachId");
    const dateParam = searchParams.get("date");
    const selectedTime = searchParams.get("selectedTime");
    const beachName = searchParams.get("beachName");

    // Get current time for filtering past times
    const now = new Date();
    const currentTimeHour = now.getHours() + now.getMinutes() / 60;
    const currentDate = now.toISOString().split("T")[0];
    const date = dateParam ?? currentDate;
    const isToday = date === currentDate;

    if (process.env.NODE_ENV !== "production") {
      console.log("🔍 Optimal Times Debug:", {
        beachId,
        date,
        selectedTime,
        isToday,
        currentTimeHour: currentTimeHour.toFixed(2),
      });
    }

    const supabase = await createSupabaseServerClient();

    // If no beachId but we have a beachName, resolve to id (supports free-typed fallback)
    if (!beachId && beachName) {
      const beachNamePattern = `%${beachName}%`;
      const { data: foundBeach, error: beachErr } = await supabase
        .from("beaches")
        .select("id, name")
        .ilike("name", beachNamePattern)
        .limit(1)
        .single();

      if (beachErr) {
        console.warn("Could not resolve beach by name", {
          beachName,
          beachErr,
        });
      }

      if (foundBeach?.id) {
        beachId = foundBeach.id;
      }
    }

    if (!beachId) {
      // If we still don't have a beachId but we do have a selectedTime, return a synthetic suggestion
      if (selectedTime) {
        const synthetic = buildSyntheticBlocks(selectedTime, isToday ? currentTimeHour : null);
        return createSuccessResponse({
          beachId: "",
          date,
          optimalTimes: synthetic,
          forecastSource: "synthetic",
          generatedAt: new Date().toISOString(),
        });
      }
      return createErrorResponse("Beach ID is required", null, 400);
    }

    if (!dateParam) {
      return createErrorResponse("Date is required", null, 400);
    }

    // Get enhanced forecast data for the specific beach and date
    const nextDay = new Date(new Date(date + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
    const { data: forecasts, error: forecastError } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .gte("forecast_at", `${date}T00:00:00Z`)
      .lt("forecast_at", `${nextDay}T00:00:00Z`)
      .order("forecast_at", { ascending: true });

    if (process.env.NODE_ENV !== "production") {
      console.log("📊 Enhanced Forecasts Query Result:", {
        forecasts: forecasts?.length || 0,
        error: forecastError,
        beachId,
        date,
      });
    }

    if (forecastError) {
      console.error("Error fetching forecast data:", forecastError);
      return createErrorResponse(
        "Failed to fetch forecast data",
        forecastError.message
      );
    }

    if (!forecasts || forecasts.length === 0) {
      // Fallback to marine forecasts if enhanced forecasts are not available
      const { data: basicForecasts, error: basicError } = await supabase
        .from("marine_forecasts")
        .select("*")
        .eq("beach_id", beachId)
        .gte("ts", `${date}T00:00:00.000Z`)
        .lt("ts", `${date}T23:59:59.999Z`)
        .order("ts", { ascending: true });

      if (process.env.NODE_ENV !== "production") {
        console.log("📈 Basic Forecasts Fallback:", {
          forecasts: basicForecasts?.length || 0,
          error: basicError,
          beachId,
          date,
        });
      }

      if (basicError || !basicForecasts || basicForecasts.length === 0) {
        // Graceful synthetic fallback if we have a selected time: generate neutral blocks around it
        if (selectedTime) {
          const synthetic = buildSyntheticBlocks(selectedTime, isToday ? currentTimeHour : null);
          return createSuccessResponse({
            beachId: beachId || "",
            date,
            optimalTimes: synthetic,
            forecastSource: "synthetic",
            generatedAt: new Date().toISOString(),
          });
        }

        // Otherwise, return informative error
        return createErrorResponse(
          "No forecast data available for this beach and date",
          null,
          404
        );
      }

      // Convert marine forecasts to enhanced format
      const enhancedFromBasic = basicForecasts.map((forecast) => ({
        ...forecast,
        forecast_time: forecast.ts, // Map timestamp to forecast_time
        forecast_date: date,
        beach_id: forecast.beach_id,
        wave_height: forecast.wave_height_m ? (forecast.wave_height_m * 3.28084).toFixed(1) : '0', // Convert meters to feet
        wind_speed: forecast.wind_speed_ms ? `${Math.round(forecast.wind_speed_ms * 2.237)} mph` : '0 mph', // Convert m/s to mph
        wind_direction: forecast.wind_direction_deg ? getWindDirection(forecast.wind_direction_deg) : 'Variable',
        confidence_score: 0.7, // Default confidence for marine forecasts
        tide_height: null,
        tide_type: null,
        swell_direction: forecast.wave_direction_deg,
        swell_period: forecast.wave_period_s,
        weather_condition: 'Unknown'
      }));

      const optimalTimes = analyzeOptimalTimes(enhancedFromBasic as any, selectedTime, isToday ? currentTimeHour : null);

      return createSuccessResponse({
        beachId,
        date,
        optimalTimes,
        forecastSource: "basic",
        generatedAt: new Date().toISOString(),
      });
    }

    // Analyze the forecast data to find optimal times
    const optimalTimes = analyzeOptimalTimes(forecasts as any, selectedTime, isToday ? currentTimeHour : null);

    const response: OptimalTimesResponse = {
      beachId,
      date,
      optimalTimes,
      forecastSource: "enhanced",
      generatedAt: new Date().toISOString(),
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error("Error analyzing optimal times:", error);
    return createErrorResponse(
      "Failed to analyze optimal surf times",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export const GET = withProtection(optimalTimesHandler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true },
});
