import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-response-utils";

// Mark this route as dynamic to prevent static generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OptimalTimeSlot {
  time: string;
  score: number;
  conditions: {
    waveHeight: number;
    waveQuality: string;
    windSpeed: number;
    windDirection: string;
    confidence: number;
    weatherCondition: string;
  };
  rating: "poor" | "fair" | "good" | "excellent";
  reasons: string[];
}

interface OptimalTimesResponse {
  beachId: string;
  date: string;
  optimalTimes: OptimalTimeSlot[];
  forecastSource: string;
  generatedAt: string;
}

/**
 * Analyzes forecast data to recommend optimal surf times
 * GET /api/session-planner/optimal-times?beachId=xxx&date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const beachId = searchParams.get("beachId");
    const date = searchParams.get("date");

    if (!beachId) {
      return createErrorResponse("Beach ID is required", null, 400);
    }

    if (!date) {
      return createErrorResponse("Date is required", null, 400);
    }

    const supabase = await createSupabaseServerClient();

    // Get enhanced forecast data for the specific beach and date
    const { data: forecasts, error: forecastError } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .eq("forecast_date", date)
      .order("forecast_time", { ascending: true });

    if (forecastError) {
      console.error("Error fetching forecast data:", forecastError);
      return createErrorResponse(
        "Failed to fetch forecast data",
        forecastError.message
      );
    }

    if (!forecasts || forecasts.length === 0) {
      // Fallback to basic forecasts if enhanced forecasts are not available
      const { data: basicForecasts, error: basicError } = await supabase
        .from("forecasts")
        .select("*")
        .eq("beach_id", beachId)
        .eq("forecast_date", date)
        .order("forecast_time", { ascending: true });

      if (basicError || !basicForecasts || basicForecasts.length === 0) {
        return createErrorResponse(
          "No forecast data available for this beach and date",
          null,
          404
        );
      }

      // Convert basic forecasts to enhanced format
      const enhancedFromBasic = basicForecasts.map((forecast) => ({
        ...forecast,
        confidence_score: 0.7, // Default confidence for basic forecasts
        tide_height: null,
        tide_type: null,
        swell_direction: null,
        swell_period: null,
      }));

      const optimalTimes = analyzeOptimalTimes(enhancedFromBasic);

      return createSuccessResponse({
        beachId,
        date,
        optimalTimes,
        forecastSource: "basic",
        generatedAt: new Date().toISOString(),
      });
    }

    // Analyze the forecast data to find optimal times
    const optimalTimes = analyzeOptimalTimes(forecasts);

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

/**
 * Analyzes forecast data to determine optimal surf times
 */
function analyzeOptimalTimes(forecasts: any[]): OptimalTimeSlot[] {
  const timeSlots: OptimalTimeSlot[] = [];

  forecasts.forEach((forecast) => {
    const waveHeight = parseFloat(forecast.wave_height) || 0;
    const windSpeed =
      parseFloat(forecast.wind_speed?.replace(/[^\d.]/g, "")) || 0;
    const confidence = forecast.confidence_score || 0.5;

    // Calculate score based on multiple factors
    let score = 0;
    const reasons: string[] = [];

    // Wave height scoring (2-6 feet is ideal)
    if (waveHeight >= 2 && waveHeight <= 6) {
      score += 40;
      reasons.push(`Good wave height (${waveHeight}ft)`);
    } else if (waveHeight >= 1 && waveHeight < 2) {
      score += 20;
      reasons.push(`Small waves (${waveHeight}ft)`);
    } else if (waveHeight > 6 && waveHeight <= 8) {
      score += 25;
      reasons.push(`Large waves (${waveHeight}ft)`);
    } else if (waveHeight > 8) {
      score += 10;
      reasons.push(`Very large waves (${waveHeight}ft)`);
    }

    // Wind scoring (light offshore winds are best)
    if (windSpeed <= 5) {
      score += 25;
      reasons.push(`Light winds (${windSpeed}mph)`);
    } else if (windSpeed <= 10) {
      score += 15;
      reasons.push(`Moderate winds (${windSpeed}mph)`);
    } else if (windSpeed <= 15) {
      score += 5;
      reasons.push(`Strong winds (${windSpeed}mph)`);
    } else {
      reasons.push(`Very strong winds (${windSpeed}mph)`);
    }

    // Wind direction scoring (offshore is best)
    const windDirection = forecast.wind_direction?.toLowerCase() || "";
    if (
      windDirection.includes("e") ||
      windDirection.includes("ne") ||
      windDirection.includes("se")
    ) {
      score += 20;
      reasons.push(`Offshore winds (${forecast.wind_direction})`);
    } else if (windDirection.includes("n") || windDirection.includes("s")) {
      score += 10;
      reasons.push(`Cross-shore winds (${forecast.wind_direction})`);
    } else {
      reasons.push(`Onshore winds (${forecast.wind_direction})`);
    }

    // Confidence scoring
    score += confidence * 15;
    if (confidence >= 0.8) {
      reasons.push(`High forecast confidence`);
    } else if (confidence >= 0.6) {
      reasons.push(`Good forecast confidence`);
    } else {
      reasons.push(`Lower forecast confidence`);
    }

    // Determine wave quality
    let waveQuality = "Poor";
    if (waveHeight >= 3 && waveHeight <= 5 && windSpeed <= 8) {
      waveQuality = "Excellent";
    } else if (waveHeight >= 2 && waveHeight <= 6 && windSpeed <= 12) {
      waveQuality = "Good";
    } else if (waveHeight >= 1 && waveHeight <= 8 && windSpeed <= 18) {
      waveQuality = "Fair";
    }

    // Determine overall rating
    let rating: "poor" | "fair" | "good" | "excellent" = "poor";
    if (score >= 80) rating = "excellent";
    else if (score >= 60) rating = "good";
    else if (score >= 40) rating = "fair";

    timeSlots.push({
      time: forecast.forecast_time,
      score: Math.round(score),
      conditions: {
        waveHeight,
        waveQuality,
        windSpeed,
        windDirection: forecast.wind_direction || "Variable",
        confidence: Math.round(confidence * 100),
        weatherCondition: forecast.weather_condition || "Unknown",
      },
      rating,
      reasons,
    });
  });

  // Sort by score (best first) and return top slots
  return timeSlots.sort((a, b) => b.score - a.score).slice(0, 6); // Return top 6 time slots
}
