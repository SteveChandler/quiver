import type { NextRequest } from "next/server";
import {
  withErrorHandler,
  validateUuidParam,
  createSuccessResponse,
  createNotFoundError,
} from "@/lib/middleware/api-wrappers";
import type { RouteContext } from "@/lib/middleware/api-wrappers";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
} from "@/lib/domains/scoring/discovery-adapter";
import { calculateRideableWaves } from "@/lib/domains/wave-frequency/calculator";
import { parseWaveHeight } from "@/lib/ml/parse-wave-height";
import {
  parseWindSpeed,
  parseWavePeriod,
  getDirectionDegrees,
} from "@/lib/utils/number-parsing";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwellInfo {
  height: number;
  period: number;
  direction: number;
  compass: string;
}

interface TimeSlot {
  forecastAt: string;
  surfHeight: { min: number; max: number };
  swells: SwellInfo[];
  windSpeed: number;
  windDirection: string;
  windDirectionDeg: number;
  isOffshore: boolean;
  tideHeight: number;
  tideStatus: string;
  waterTemp: string;
  airTemp: string;
  compositeScore: number;
  rideableWavesPerHour: number;
  waveFrequencyConfidence: "high" | "medium" | "low";
  swellTrains: number;
  dominantBeatIntervalS: number | null;
  forecastDataConfidence: number;
}

interface GoldenWindow {
  startTime: string;
  endTime: string;
  peakTime: string;
  peakScore: number;
  durationMinutes: number;
  peakWavesPerHour: number;
  waveFrequencyConfidence: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Classify wind as offshore (true) or onshore (false).
 * Offshore = wind blowing away from shore = negative cosine component.
 */
function classifyWind(
  windDirDeg: number | null,
  aspectDeg: number | null | undefined
): boolean {
  if (windDirDeg == null || aspectDeg == null) return false;
  const rad = ((windDirDeg - aspectDeg) * Math.PI) / 180;
  return Math.cos(rad) < 0;
}

/**
 * Parse a swell component from forecast fields.
 */
function parseSwell(
  forecast: EnhancedForecastEntity,
  prefix: "swell_1" | "swell_2" | "wind_wave"
): SwellInfo | null {
  const heightKey = `${prefix}_height` as keyof EnhancedForecastEntity;
  const periodKey = `${prefix}_period` as keyof EnhancedForecastEntity;
  const directionKey = `${prefix}_direction` as keyof EnhancedForecastEntity;

  const heightRaw = forecast[heightKey] as string | null | undefined;
  const periodRaw = forecast[periodKey] as string | null | undefined;
  const directionRaw = forecast[directionKey] as string | null | undefined;

  if (!heightRaw || !periodRaw) return null;

  const height = parseFloat(heightRaw);
  if (isNaN(height) || height <= 0) return null;

  const period = parseWavePeriod(periodRaw);
  if (period <= 0) return null;

  const directionDeg = getDirectionDegrees(null, directionRaw ?? null) ?? 0;
  const compass = directionRaw ?? "";

  return { height, period, direction: directionDeg, compass };
}

/**
 * Parse wave height range in feet from NOAA text ("3-4 ft").
 */
function parseWaveHeightRange(text: string | null | undefined): {
  min: number;
  max: number;
} {
  if (!text) return { min: 0, max: 0 };

  // Try range parsing via parseWaveHeight on each bound
  const FEET_PER_METER = 1 / 0.3048;

  const clean = text.replace(/[^\d\-.]/g, " ").trim();
  const nums = clean.match(/\d*\.?\d+/g);

  if (!nums || nums.length === 0) return { min: 0, max: 0 };

  const values = nums.map(Number).filter((n) => !isNaN(n));

  if (values.length >= 2) {
    return { min: values[0], max: values[1] };
  }

  const single = parseWaveHeight(text);
  const ft = single != null ? single * FEET_PER_METER : 0;
  return { min: ft, max: ft };
}

// ---------------------------------------------------------------------------
// Core logic — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Score a list of forecast slots for a beach.
 * Returns an array of TimeSlot objects with scores and wave frequency.
 */
export function scoreForecastSlots(
  forecasts: EnhancedForecastEntity[],
  beach: Beach
): TimeSlot[] {
  const engine = createDiscoveryScoringEngine();

  return forecasts.map((forecast) => {
    // Composite score
    const scored = scoreBeachWithEngine(engine, beach, forecast);
    const compositeScore = scored.total;

    // Wave frequency
    const {
      rideableWavesPerHour,
      confidence: waveFrequencyConfidence,
      swellTrains,
      dominantBeatIntervalS,
    } = calculateRideableWaves(forecast, beach);

    // Wave height range
    const surfHeight = parseWaveHeightRange(forecast.wave_height);

    // Swells
    const swells: SwellInfo[] = [];
    const s1 = parseSwell(forecast, "swell_1");
    if (s1) swells.push(s1);
    const s2 = parseSwell(forecast, "swell_2");
    if (s2) swells.push(s2);
    const ww = parseSwell(forecast, "wind_wave");
    if (ww) swells.push(ww);

    // Wind
    const windSpeedMph = parseWindSpeed(forecast.wind_speed ?? null);
    const windDirectionDeg =
      getDirectionDegrees(
        forecast.wind_direction_deg ?? null,
        forecast.wind_direction ?? null
      ) ?? 0;
    const isOffshore = classifyWind(windDirectionDeg, beach.aspect_deg);

    // Tide
    const tideHeight = parseFloat(forecast.tide_height ?? "0") || 0;
    const tideStatus = forecast.tide_status ?? "unknown";

    // Temperature fields
    const waterTemp = forecast.water_temp ?? "";
    const airTemp = forecast.air_temperature ?? "";

    // Forecast confidence
    const forecastDataConfidence = forecast.confidence_score ?? 0;

    return {
      forecastAt: forecast.forecast_at,
      surfHeight,
      swells,
      windSpeed: windSpeedMph,
      windDirection: forecast.wind_direction ?? "",
      windDirectionDeg,
      isOffshore,
      tideHeight,
      tideStatus,
      waterTemp,
      airTemp,
      compositeScore,
      rideableWavesPerHour,
      waveFrequencyConfidence,
      swellTrains,
      dominantBeatIntervalS,
      forecastDataConfidence,
    };
  });
}

/**
 * Identify golden windows: contiguous runs of slots with compositeScore >= 60.
 */
export function identifyGoldenWindows(slots: TimeSlot[]): GoldenWindow[] {
  const GOLDEN_THRESHOLD = 60;
  // Each slot represents a 3-hour window
  const SLOT_DURATION_MS = 3 * 60 * 60 * 1000;

  const windows: GoldenWindow[] = [];
  let runSlots: TimeSlot[] = [];

  const flushRun = () => {
    if (runSlots.length === 0) return;

    const startTime = runSlots[0].forecastAt;
    const lastSlot = runSlots[runSlots.length - 1];
    const endTime = new Date(
      new Date(lastSlot.forecastAt).getTime() + SLOT_DURATION_MS
    ).toISOString();

    const peakSlot = runSlots.reduce((best, s) =>
      s.compositeScore > best.compositeScore ? s : best
    );

    const durationMs =
      new Date(lastSlot.forecastAt).getTime() -
      new Date(startTime).getTime() +
      SLOT_DURATION_MS;
    const durationMinutes = Math.round(durationMs / 60_000);

    windows.push({
      startTime,
      endTime,
      peakTime: peakSlot.forecastAt,
      peakScore: peakSlot.compositeScore,
      durationMinutes,
      peakWavesPerHour: peakSlot.rideableWavesPerHour,
      waveFrequencyConfidence: peakSlot.waveFrequencyConfidence,
    });

    runSlots = [];
  };

  for (const slot of slots) {
    if (slot.compositeScore >= GOLDEN_THRESHOLD) {
      runSlots.push(slot);
    } else {
      flushRun();
    }
  }

  // Flush final run
  flushRun();

  return windows;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET = withErrorHandler(
  async (request: NextRequest, context?: RouteContext) => {
    const params = context?.params
      ? await Promise.resolve(context.params)
      : {};
    const beachId = (params as Record<string, string>).beachId;

    // Validate beachId
    const uuidResult = validateUuidParam(beachId, "beachId");
    if ("error" in uuidResult) return uuidResult.error;
    const validBeachId = uuidResult.value;

    const supabase = await createAPIServerClient();

    // Fetch beach
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", validBeachId)
      .single();

    if (beachError || !beach) {
      return createNotFoundError("Beach");
    }

    // Fetch next 24 hours of enhanced forecasts (8 slots × 3h = 24h)
    const now = new Date().toISOString();
    const twentyFourHoursLater = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: forecasts, error: forecastError } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", validBeachId)
      .gte("forecast_at", now)
      .lt("forecast_at", twentyFourHoursLater)
      .order("forecast_at")
      .limit(8);

    if (forecastError) {
      throw new Error(forecastError.message);
    }

    const forecastList = (forecasts ?? []) as EnhancedForecastEntity[];

    // Score all slots
    const timeSlots = scoreForecastSlots(forecastList, beach as Beach);

    // Identify golden windows
    const goldenWindows = identifyGoldenWindows(timeSlots);

    return createSuccessResponse({
      timeSlots,
      goldenWindows,
      beach: {
        aspectDeg: beach.aspect_deg ?? null,
        breakType: beach.break_type ?? null,
      },
    });
  },
  { errorMessage: "Failed to fetch scored forecast" }
);
