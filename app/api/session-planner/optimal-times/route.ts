import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-response-utils";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OptimalTimeSlot {
  // Center time of the block for backwards compatibility with previous UI
  time: string;
  // Optional start/end for block display (e.g., 2-hour window)
  startTime?: string;
  endTime?: string;
  score: number;
  conditions: {
    waveHeight: number;
    waveQuality: string;
    windSpeed: number;
    windDirection: string;
    confidence: number;
    weatherCondition: string;
    tideHeight?: number | null;
    tideType?: string | null;
    swellPeriod?: number | null;
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
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let beachId = searchParams.get("beachId");
    const date = searchParams.get("date");
    const selectedTime = searchParams.get("selectedTime");
    const beachName = searchParams.get("beachName");

    console.log("🔍 Optimal Times Debug:", { beachId, date, selectedTime });

    const supabase = await createSupabaseServerClient();

    // If no beachId but we have a beachName, resolve to id (supports free-typed fallback)
    if (!beachId && beachName) {
      const { data: foundBeach, error: beachErr } = await supabase
        .from("beaches")
        .select("id, name")
        .ilike("name", beachName)
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
        const synthetic = buildSyntheticBlocks(selectedTime);
        return createSuccessResponse({
          beachId: "",
          date: date!,
          optimalTimes: synthetic,
          forecastSource: "synthetic",
          generatedAt: new Date().toISOString(),
        });
      }
      return createErrorResponse("Beach ID is required", null, 400);
    }

    if (!date) {
      return createErrorResponse("Date is required", null, 400);
    }

    // Get enhanced forecast data for the specific beach and date
    const { data: forecasts, error: forecastError } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .eq("forecast_date", date)
      .order("forecast_time", { ascending: true });

    console.log("📊 Enhanced Forecasts Query Result:", {
      forecasts: forecasts?.length || 0,
      error: forecastError,
      beachId,
      date,
    });

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

      console.log("📈 Basic Forecasts Fallback:", {
        forecasts: basicForecasts?.length || 0,
        error: basicError,
        beachId,
        date,
      });

      if (basicError || !basicForecasts || basicForecasts.length === 0) {
        // Graceful synthetic fallback if we have a selected time: generate neutral blocks around it
        if (selectedTime) {
          const synthetic = buildSyntheticBlocks(selectedTime);
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

      const optimalTimes = analyzeOptimalTimes(enhancedFromBasic, selectedTime);

      return createSuccessResponse({
        beachId,
        date,
        optimalTimes,
        forecastSource: "basic",
        generatedAt: new Date().toISOString(),
      });
    }

    // Analyze the forecast data to find optimal times
    const optimalTimes = analyzeOptimalTimes(forecasts, selectedTime);

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
export function analyzeOptimalTimes(
  forecasts: any[],
  selectedTime?: string | null
): OptimalTimeSlot[] {
  // 1) If selectedTime is provided, compute within a tight ±2h window.
  // If too sparse, expand to ±4h. Otherwise, use all forecasts.
  let filteredForecasts = forecasts;
  if (selectedTime) {
    filteredForecasts = filterByTimeWindow(forecasts, selectedTime, 2);
    if (filteredForecasts.length < 2) {
      filteredForecasts = filterByTimeWindow(forecasts, selectedTime, 4);
    }

    // If still sparse, synthesize interpolated points around the selected time
    if (filteredForecasts.length < 2) {
      const synthetic = generateAnchoredInterpolatedPoints(
        forecasts,
        selectedTime
      );
      if (synthetic.length > 0) {
        filteredForecasts = synthetic;
      }
    }
  }

  // 2) Score each forecast record using tide/wind/wave/period/confidence
  const scored = filteredForecasts.map((f) => scoreForecast(f));

  // If no selected time, keep legacy single-point ranking (top 6)
  if (!selectedTime) {
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((s) => ({ ...s }));
  }

  // 3) Build 2-hour blocks centered around available forecast times in the window
  const blocks = buildTwoHourBlocks(scored);

  // 3b) If blocks spill beyond ±2h, clamp to ±2h around selected time
  const center = parseTimeToHour(selectedTime);
  let clamped = blocks;
  if (center != null) {
    clamped = blocks.filter((b) => {
      const h = parseTimeToHour(b.time);
      if (h == null) return false;
      let diff = Math.abs(h - center);
      if (diff > 12) diff = 24 - diff;
      return diff <= 2.1; // small epsilon
    });
  }

  // 4) Return up to top 4 blocks
  const finalBlocks = (clamped.length > 0 ? clamped : blocks)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  return finalBlocks;
}

/**
 * Filters forecasts to within N hours of the selected time
 */
export function filterByTimeWindow(
  forecasts: any[],
  selectedTime: string,
  windowHours: number
): any[] {
  try {
    // Parse selected time (format: "HH:MM" or "HH:MM AM/PM")
    const selectedHour = parseTimeToHour(selectedTime);
    if (selectedHour === null) return forecasts;

    return forecasts.filter((forecast) => {
      const forecastHour = parseTimeToHour(forecast.forecast_time);
      if (forecastHour === null) return false; // exclude unparsable times instead of including all

      // Calculate time difference (handle day boundary)
      let timeDiff = Math.abs(forecastHour - selectedHour);
      if (timeDiff > 12) {
        timeDiff = 24 - timeDiff; // Handle crossing midnight
      }

      // Include times within windowHours
      return timeDiff <= windowHours;
    });
  } catch (error) {
    console.error("Error filtering by time window:", error);
    return forecasts; // Return all if filtering fails
  }
}

/**
 * Converts time string to hour (0-23)
 */
export function parseTimeToHour(timeStr: string): number | null {
  try {
    if (!timeStr) return null;

    // 1) ISO-like: contains 'T' → use Date parsing
    if (timeStr.includes("T")) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.getHours() + d.getMinutes() / 60;
      }
    }

    // 2) HH:MM:SS (24h)
    const hms = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (hms) {
      const hour = parseInt(hms[1], 10);
      const minute = parseInt(hms[2], 10);
      return (hour % 24) + minute / 60;
    }

    // 3) HH:MM AM/PM
    const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      let hour = parseInt(ampmMatch[1], 10);
      const minute = parseInt(ampmMatch[2], 10);
      const ampm = ampmMatch[3].toUpperCase();
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return hour + minute / 60;
    }

    return null;
  } catch (error) {
    console.error("Error parsing time:", error);
    return null;
  }
}

/**
 * Scores a single forecast row and returns an OptimalTimeSlot-compatible object
 */
export function scoreForecast(forecast: any): OptimalTimeSlot {
  const waveHeight = parseFloat(forecast.wave_height) || 0;
  const windSpeed =
    parseFloat(String(forecast.wind_speed)?.replace(/[^\d.]/g, "")) || 0;
  const windDirectionLabel: string = forecast.wind_direction || "Variable";
  const windDirection = windDirectionLabel.toLowerCase();
  const tideHeight: number | null =
    forecast.tide_height != null ? Number(forecast.tide_height) : null;
  const tideType: string | null = forecast.tide_type || null; // e.g., "rising", "falling", "ebb", "flood"
  const swellPeriod: number | null =
    forecast.swell_period != null ? Number(forecast.swell_period) : null;
  const weatherCondition = forecast.weather_condition || "Unknown";

  // Normalize confidence to 0-1 range if it's in 0-100 range
  let confidence = forecast.confidence_score || 0.5;
  if (confidence > 1) confidence = confidence / 100;

  let score = 0;
  const reasons: string[] = [];

  // Wave height scoring (2-6 feet ideal) - Max 30
  if (waveHeight >= 2 && waveHeight <= 6) {
    score += 30;
    reasons.push(`Good wave height (${waveHeight}ft)`);
  } else if (waveHeight >= 1 && waveHeight < 2) {
    score += 18;
    reasons.push(`Small waves (${waveHeight}ft)`);
  } else if (waveHeight > 6 && waveHeight <= 8) {
    score += 22;
    reasons.push(`Large waves (${waveHeight}ft)`);
  } else if (waveHeight > 8) {
    score += 10;
    reasons.push(`Very large waves (${waveHeight}ft)`);
  }

  // Swell period scoring (10–16s best) - Max 15
  if (swellPeriod != null) {
    if (swellPeriod >= 10 && swellPeriod <= 16) {
      score += 15;
      reasons.push(`Good period (${swellPeriod}s)`);
    } else if (swellPeriod >= 8 && swellPeriod < 10) {
      score += 10;
      reasons.push(`Decent period (${swellPeriod}s)`);
    } else if (swellPeriod >= 6 && swellPeriod < 8) {
      score += 5;
      reasons.push(`Short period (${swellPeriod}s)`);
    }
  }

  // Wind speed scoring (lighter better) - Max 20
  if (windSpeed <= 5) {
    score += 20;
    reasons.push(`Light winds (${windSpeed}mph)`);
  } else if (windSpeed <= 10) {
    score += 12;
    reasons.push(`Moderate winds (${windSpeed}mph)`);
  } else if (windSpeed <= 15) {
    score += 5;
    reasons.push(`Breezy (${windSpeed}mph)`);
  } else {
    reasons.push(`Strong winds (${windSpeed}mph)`);
  }

  // Wind direction scoring (offshore best) - Max 15
  if (
    windDirection.includes("e") ||
    windDirection.includes("ne") ||
    windDirection.includes("se")
  ) {
    score += 15;
    reasons.push(`Offshore winds (${windDirectionLabel})`);
  } else if (windDirection.includes("n") || windDirection.includes("s")) {
    score += 7;
    reasons.push(`Cross-shore winds (${windDirectionLabel})`);
  } else {
    reasons.push(`Onshore winds (${windDirectionLabel})`);
  }

  // Tide scoring (favor mid-tide and rising)
  if (tideHeight != null) {
    // Favor mid-range roughly 1.5–3.5 ft
    if (tideHeight >= 1.5 && tideHeight <= 3.5) {
      score += 8;
      reasons.push("Mid tide in sweet spot");
    } else if (tideHeight > 4 && tideHeight <= 6) {
      score += 4;
      reasons.push(`Higher tide (${tideHeight}ft)`);
    } else if (tideHeight < 1) {
      score += 3;
      reasons.push(`Lower tide (${tideHeight}ft)`);
    }
  }
  if (tideType) {
    const tt = tideType.toLowerCase();
    if (tt.includes("rising") || tt.includes("flood")) {
      score += 4;
      reasons.push("Rising tide");
    } else if (tt.includes("falling") || tt.includes("ebb")) {
      reasons.push("Falling tide");
    }
  }

  // Confidence - Max 10
  score += Math.min(confidence * 10, 10);
  if (confidence >= 0.8) reasons.push("High forecast confidence");
  else if (confidence >= 0.6) reasons.push("Good forecast confidence");
  else reasons.push("Lower forecast confidence");

  // Determine wave quality descriptor from height & wind
  let waveQuality = "Poor";
  if (waveHeight >= 3 && waveHeight <= 5 && windSpeed <= 8)
    waveQuality = "Excellent";
  else if (waveHeight >= 2 && waveHeight <= 6 && windSpeed <= 12)
    waveQuality = "Good";
  else if (waveHeight >= 1 && waveHeight <= 8 && windSpeed <= 18)
    waveQuality = "Fair";

  // Overall rating buckets
  let rating: "poor" | "fair" | "good" | "excellent" = "poor";
  if (score >= 70) rating = "excellent";
  else if (score >= 55) rating = "good";
  else if (score >= 40) rating = "fair";

  // Cap score at 100
  const finalScore = Math.min(Math.round(score), 100);

  return {
    time: forecast.forecast_time,
    score: finalScore,
    conditions: {
      waveHeight,
      waveQuality,
      windSpeed,
      windDirection: windDirectionLabel,
      confidence: Math.min(Math.round(confidence * 100), 100),
      weatherCondition,
      tideHeight,
      tideType,
      swellPeriod,
    },
    rating,
    reasons,
  };
}

/**
 * Build rolling 2-hour blocks, averaging scores/conditions
 */
export function buildTwoHourBlocks(
  scored: OptimalTimeSlot[]
): OptimalTimeSlot[] {
  if (scored.length === 0) return [];

  // Ensure ascending by time
  const sorted = [...scored].sort((a, b) => {
    const ah = parseTimeToHour(a.time) ?? 0;
    const bh = parseTimeToHour(b.time) ?? 0;
    return ah - bh;
  });

  const blocks: OptimalTimeSlot[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    const startHour = parseTimeToHour(start.time);
    if (startHour == null) continue;

    // Collect all points within +2h of start
    const windowPoints: OptimalTimeSlot[] = [start];
    for (let j = i + 1; j < sorted.length; j++) {
      const h = parseTimeToHour(sorted[j].time);
      if (h == null) continue;
      let diff = Math.abs(h - startHour);
      if (diff > 12) diff = 24 - diff; // handle midnight wrap
      if (diff <= 2) windowPoints.push(sorted[j]);
    }

    // Compute averages for the block
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const avgScore = Math.round(avg(windowPoints.map((p) => p.score)));
    const avgWave = Number(
      avg(windowPoints.map((p) => p.conditions.waveHeight)).toFixed(1)
    );
    const avgWind = Number(
      avg(windowPoints.map((p) => p.conditions.windSpeed)).toFixed(1)
    );
    const avgConf = Math.round(
      avg(windowPoints.map((p) => p.conditions.confidence))
    );
    const avgTide = windowPoints.some((p) => p.conditions.tideHeight != null)
      ? Number(
          avg(
            windowPoints.map((p) =>
              p.conditions.tideHeight == null ? 0 : p.conditions.tideHeight
            )
          ).toFixed(1)
        )
      : null;
    const avgPeriod = windowPoints.some((p) => p.conditions.swellPeriod != null)
      ? Number(
          avg(
            windowPoints.map((p) =>
              p.conditions.swellPeriod == null ? 0 : p.conditions.swellPeriod
            )
          ).toFixed(1)
        )
      : null;

    // Choose a representative wind direction (use the first non-variable value)
    const windDir =
      windowPoints.find(
        (p) =>
          p.conditions.windDirection &&
          p.conditions.windDirection !== "Variable"
      )?.conditions.windDirection || start.conditions.windDirection;

    // Derive rating bucket from avg score
    let rating: "poor" | "fair" | "good" | "excellent" = "poor";
    if (avgScore >= 70) rating = "excellent";
    else if (avgScore >= 55) rating = "good";
    else if (avgScore >= 40) rating = "fair";

    const startTime = start.time;
    const endTime = windowPoints[windowPoints.length - 1].time;

    // Center time for compatibility (midpoint of start/end)
    const centerHour = (() => {
      const sh = parseTimeToHour(startTime) ?? 0;
      const eh = parseTimeToHour(endTime) ?? sh;
      let diff = eh - sh;
      if (diff < 0) diff += 24;
      const mid = sh + diff / 2;
      return toTimeString(mid);
    })();

    blocks.push({
      time: centerHour,
      startTime,
      endTime,
      score: avgScore,
      conditions: {
        waveHeight: avgWave,
        waveQuality: start.conditions.waveQuality, // keep descriptor simple
        windSpeed: avgWind,
        windDirection: windDir,
        confidence: avgConf,
        weatherCondition: start.conditions.weatherCondition,
        tideHeight: avgTide,
        tideType: start.conditions.tideType ?? null,
        swellPeriod: avgPeriod,
      },
      rating,
      reasons: ["Averaged conditions across ~2h window"],
    });
  }

  // Deduplicate overlapping blocks by start/end
  const unique = new Map<string, OptimalTimeSlot>();
  for (const b of blocks) {
    const key = `${b.startTime}-${b.endTime}`;
    if (!unique.has(key) || unique.get(key)!.score < b.score)
      unique.set(key, b);
  }
  return Array.from(unique.values());
}

function toTimeString(hourFloat: number): string {
  // hourFloat in 0..24, possibly with minutes as fraction
  const h = Math.floor(hourFloat) % 24;
  const m = Math.round((hourFloat - Math.floor(hourFloat)) * 60);
  const hh = String((h + 24) % 24).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Build simple synthetic 2-hour blocks around a selected time when no data is available.
 */
function buildSyntheticBlocks(selectedTime: string): OptimalTimeSlot[] {
  const center = parseTimeToHour(selectedTime) ?? 12;
  const start = toTimeString(center - 1);
  const end = toTimeString(center + 1);

  return [
    {
      time: toTimeString(center),
      startTime: start,
      endTime: end,
      score: 50,
      conditions: {
        waveHeight: 0,
        waveQuality: "Fair",
        windSpeed: 0,
        windDirection: "Variable",
        confidence: 0,
        weatherCondition: "Unknown",
        tideHeight: null,
        tideType: null,
        swellPeriod: null,
      },
      rating: "fair",
      reasons: [
        "No live forecast available; showing time centered around your selection",
      ],
    },
  ];
}

/**
 * Generate synthetic 1-hour step points in ±2h window around selectedTime,
 * by interpolating between surrounding real forecast rows.
 */
function generateAnchoredInterpolatedPoints(
  forecasts: any[],
  selectedTime: string
): any[] {
  const target = parseTimeToHour(selectedTime);
  if (target == null) return [];

  // Sort with parsed hours
  const rows = forecasts
    .map((f) => ({ ...f, __hour: parseTimeToHour(f.forecast_time) }))
    .filter((f) => f.__hour != null)
    .sort((a, b) => a.__hour! - b.__hour!);
  if (rows.length === 0) return [];

  const points: any[] = [];
  const wantedHours = [target - 2, target - 1, target, target + 1, target + 2];

  for (const h of wantedHours) {
    const modH = ((h % 24) + 24) % 24;

    // If there is an exact data point within 0.25h, use it
    const exact = rows.find(
      (r) => Math.abs((r.__hour as number) - modH) < 0.25
    );
    if (exact) {
      points.push(exact);
      continue;
    }

    // Find nearest before and after
    const before = [...rows]
      .reverse()
      .find((r) => (r.__hour as number) <= modH);
    const after = rows.find((r) => (r.__hour as number) >= modH);

    if (before && after && before !== after) {
      points.push(interpolateForecastRow(before, after, modH));
      continue;
    }

    // Fallback: copy nearest neighbor
    const nearest = rows.reduce((best: any | null, r) => {
      if (!best) return r;
      return Math.abs((r.__hour as number) - modH) <
        Math.abs((best.__hour as number) - modH)
        ? r
        : best;
    }, null as any);
    if (nearest) {
      points.push({
        ...nearest,
        forecast_time: toTimeString(modH) + ":00",
        __interpolated: true,
      });
    }
  }

  return points;
}

function interpolateForecastRow(
  before: any,
  after: any,
  targetHour: number
): any {
  const t0 = before.__hour as number;
  const t1 = after.__hour as number;
  const alpha =
    t1 === t0 ? 0 : Math.min(Math.max((targetHour - t0) / (t1 - t0), 0), 1);

  const lerp = (a: number, b: number) => a + (b - a) * alpha;
  const num = (v: any) => {
    const n = parseFloat(String(v).replace(/[^\d.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const waveHeight = lerp(num(before.wave_height), num(after.wave_height));
  const windSpeed = lerp(num(before.wind_speed), num(after.wind_speed));
  const confidence = lerp(
    num(before.confidence_score),
    num(after.confidence_score)
  );
  const tideHeight = lerp(num(before.tide_height), num(after.tide_height));
  const swellPeriod = lerp(num(before.swell_period), num(after.swell_period));

  // Direction/trend from closer side
  const closer =
    Math.abs(targetHour - t0) <= Math.abs(t1 - targetHour) ? before : after;
  const tideType = (() => {
    if (before.tide_height != null && after.tide_height != null) {
      return num(after.tide_height) > num(before.tide_height)
        ? "rising"
        : "falling";
    }
    return closer.tide_type ?? null;
  })();

  return {
    ...closer,
    forecast_time: toTimeString(targetHour) + ":00",
    wave_height: waveHeight.toFixed(1),
    wind_speed: `${Math.round(windSpeed)} mph`,
    confidence_score: confidence,
    tide_height: Number.isFinite(tideHeight)
      ? Number(tideHeight.toFixed(1))
      : null,
    tide_type: tideType,
    swell_period: Number.isFinite(swellPeriod)
      ? Number(swellPeriod.toFixed(1))
      : null,
    __interpolated: true,
  };
}
