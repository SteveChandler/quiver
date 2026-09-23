import { recommendBoard, type RecommendedBoard } from "@/lib/scoring/personal-board";
import type { NextRequest } from "next/server";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  createNotFoundError,
  createValidationError,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import {
  sanitizeScoredForecastForMajorEventHold,
  type ScoredForecastGoldenWindowBinding,
  type ScoredForecastSlotBinding,
} from "@/lib/recommendations/major-event-hold/adapters/bulk-forecast";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import { calculateRideableWaves } from "@/lib/domains/wave-frequency/calculator";
import { resolveNativeSkillLevel } from "@/lib/scoring/native-condition-score";
import {
  scoreWindowConditionDetails,
  scoreWindowConditionForBoardClass,
} from "@/lib/services/discovery/window-selector/window-scorer";
import { fetchUserBoardContext } from "@/lib/services/discovery/surf-discovery-orchestrator";
import type { BoardClass } from "@/lib/domains/rideability";
import { getConditionBoardPick, toForecastForScoring, type BoardForPick } from "@/lib/scoring";
import type { SkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { parseWaveHeightRangeFt } from "@/lib/alerts/forecast-parsers";
import {
  parseWindSpeed,
  parseWavePeriod,
  getDirectionDegrees,
} from "@/lib/utils/number-parsing";
import { fetchLatestObservation } from "@/lib/services/observations/nowcast-anchor";
import {
  applyV51DisplayOverrideToForecasts,
} from "@/lib/services/forecast/v5-display-gate";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { entitlementFromRow } from "@/lib/alerts/entitlements";
import { isBoardPicksFreeEnabled } from "@/lib/flags/board-picks-free";

export const dynamic = "force-dynamic";

const SLOT_DURATION_MS = 3 * 60 * 60 * 1000;

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
  generalScore?: number;
  rideableWavesPerHour: number;
  waveFrequencyConfidence: "high" | "medium" | "low";
  swellTrains: number;
  dominantBeatIntervalS: number | null;
  forecastDataConfidence: number;
  recommendedBoard?: RecommendedBoard | null;
  boardClass?: BoardClass | null;
  board?: { id: string; name: string; boardType: string } | null;
  sizeBand?: {
    idealMinFt: number;
    idealMaxFt: number;
    acceptableMinFt: number;
    acceptableMaxFt: number;
  } | null;
  scoreComponents?: {
    waveFit: number;
    period: number;
    wind: number;
    tide: number;
    windQuality?: number;
    swellAlignment?: number;
  };
  appliedEffects?: string[];
  boardLift?: boolean;
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
  return parseWaveHeightRangeFt(text) ?? { min: 0, max: 0 };
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
  beach: Beach,
  skillLevel?: SkillLevel | string | null,
  boardClasses: readonly BoardClass[] = [],
  boardsForPicks: BoardForPick[] = [],
): TimeSlot[] {
  return forecasts.map((forecast) => {
    const recommendedBoard = recommendBoard(boardsForPicks, forecast, beach, skillLevel);
    const recommendedClass = recommendedBoard?.boardClass ?? null;
    // The shown board, its score, size band and lift must describe one board.
    const scoreDetails = recommendedClass
      ? scoreWindowConditionForBoardClass(forecast, beach, skillLevel, recommendedClass)
      : scoreWindowConditionDetails(
          forecast, beach,
          boardClasses.length > 0 ? skillLevel : resolveNativeSkillLevel(skillLevel),
          null, boardClasses,
        );
    const generalScore = scoreWindowConditionDetails(
      forecast,
      beach,
      "beginner",
      null,
      [],
    ).score;
    const boardPick = recommendedClass && recommendedBoard
      ? { boardId: recommendedBoard.id, boardName: recommendedBoard.name, boardType: recommendedBoard.type }
      : scoreDetails.boardClass
        ? getConditionBoardPick(
            toForecastForScoring(forecast),
            boardsForPicks,
            beach,
            { kind: "scored", boardClass: scoreDetails.boardClass },
          )
        : null;

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
      compositeScore: scoreDetails.score,
      generalScore,
      rideableWavesPerHour,
      waveFrequencyConfidence,
      swellTrains,
      dominantBeatIntervalS,
      forecastDataConfidence,
      recommendedBoard: recommendedClass ? recommendedBoard : null,
      boardClass: scoreDetails.boardClass,
      board: boardPick
        ? {
            id: boardPick.boardId,
            name: boardPick.boardName,
            boardType: boardPick.boardType,
          }
        : null,
      sizeBand: scoreDetails.rideabilityBand
        ? {
            idealMinFt: scoreDetails.rideabilityBand.ideal.min,
            idealMaxFt: scoreDetails.rideabilityBand.ideal.max,
            acceptableMinFt: scoreDetails.rideabilityBand.acceptable.min,
            acceptableMaxFt: scoreDetails.rideabilityBand.acceptable.max,
          }
        : null,
      scoreComponents: scoreDetails.components,
      appliedEffects: scoreDetails.appliedEffects,
      boardLift: scoreDetails.boardClass !== null,
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

function slotEnd(forecastAt: string): string {
  const startsAtMs = Date.parse(forecastAt);
  return Number.isFinite(startsAtMs)
    ? new Date(startsAtMs + SLOT_DURATION_MS).toISOString()
    : "";
}

function buildSlotBindings(
  beachId: string,
  timeSlots: readonly TimeSlot[]
): ScoredForecastSlotBinding[] {
  return timeSlots.map(({ forecastAt }) => ({
    forecastAt,
    candidate: {
      candidateId: `scored-slot:${beachId}:${forecastAt}`,
      beachId,
      startsAt: forecastAt,
      endsAt: slotEnd(forecastAt),
    },
  }));
}

function buildGoldenBindings(
  beachId: string,
  goldenWindows: readonly GoldenWindow[]
): ScoredForecastGoldenWindowBinding[] {
  return goldenWindows.map(({ startTime, endTime }) => ({
    startTime,
    endTime,
    candidate: {
      candidateId: `scored-golden:${beachId}:${startTime}:${endTime}`,
      beachId,
      startsAt: startTime,
      endsAt: endTime,
    },
  }));
}


// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET = withNoStore(withAuth(
  async (request: NextRequest, context) => {
    const params = context.params ?? {};
    const beachId = (params as Record<string, string>).beachId;

    // Validate beachId
    const uuidResult = validateUuidParam(beachId, "beachId");
    if ("error" in uuidResult) return uuidResult.error;
    const validBeachId = uuidResult.value;
    const { supabase } = context;
    const range = request.nextUrl.searchParams.get("range");
    if (range !== null && range !== "14day") {
      return createValidationError("range must be 14day when provided");
    }
    const extended = range === "14day";

    // Fetch beach
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", validBeachId)
      .single();

    if (beachError || !beach) {
      return createNotFoundError("Beach");
    }

    // Keep the legacy 24-hour response; native can request its full timeline.
    const nowMs = Date.now();
    const startsAt = new Date(nowMs - (extended ? 8 : 0) * 3_600_000).toISOString();
    const endsAt = new Date(nowMs + (extended ? 14 : 1) * 24 * 3_600_000).toISOString();

    const [forecastsResult, latestObservation] = await Promise.all([
      supabase
        .from("enhanced_forecasts")
        .select("*")
        .eq("beach_id", validBeachId)
        .gte("forecast_at", startsAt)
        .lt("forecast_at", endsAt)
        .order("forecast_at")
        .limit(extended ? 344 : 8),
      fetchLatestObservation(supabase, validBeachId),
    ]);

    const { data: forecasts, error: forecastError } = forecastsResult;

    if (forecastError) {
      throw new Error(forecastError.message);
    }

    const forecastList = await applyV51DisplayOverrideToForecasts(
      (forecasts ?? []) as EnhancedForecastEntity[]
    );

    // Score all slots
    const userSkillLevel = await getProfileExperienceLevel(
      supabase,
      context.user?.id
    );

    const { data: entitlementRow } = context.user
      ? await supabase
          .from("user_entitlements")
          .select("is_pro, is_trialing, billing_issue, expires_at")
          .eq("user_id", context.user.id)
          .maybeSingle()
      : { data: null };
    const isPro = entitlementFromRow(entitlementRow ?? null) === "premium";
    const boardPicksEnabled = isPro || isBoardPicksFreeEnabled();
    const boardContext = context.user
      ? await fetchUserBoardContext(supabase, context.user.id, boardPicksEnabled)
      : null;
    const timeSlots = scoreForecastSlots(
      forecastList, beach as Beach, userSkillLevel, boardContext?.boardClasses,
      boardContext?.boardsForPicks,
    );

    // Identify golden windows
    const goldenWindows = identifyGoldenWindows(timeSlots);

    // Calibration status — true when beach has an empirical shoaling
    // calibration, false for ML-only beaches. Derived here (not exposed as
    // raw JSONB) so the client can distinguish calibrated face heights from
    // forecast-only sig-wave heights in the UI.
    const isCalibrated = beach.shoaling_factors !== null;

    const response = {
      timeSlots,
      goldenWindows,
      beach: {
        aspectDeg: beach.aspect_deg ?? null,
        breakType: beach.break_type ?? null,
        isCalibrated,
      },
      // Top-level (not per-slot) — the live observation is a single "now"
      // reading that doesn't vary across the 8 forecast slots.
      latestObservation,
      plan: isPro ? "pro" : "free",
      boardPicksEnabled,
      generalProfile: { skill: "beginner", board: null },
    };
    const slotBindings = buildSlotBindings(validBeachId, timeSlots);
    const goldenBindings = buildGoldenBindings(validBeachId, goldenWindows);
    const candidates = [...slotBindings, ...goldenBindings].map(
      ({ candidate }) => candidate
    );
    const decisions = await evaluateMajorEventHoldCandidates({
      candidates,
      profileExperience: userSkillLevel,
    });
    return createSuccessResponse(
      sanitizeScoredForecastForMajorEventHold(
        response,
        validBeachId,
        slotBindings,
        goldenBindings,
        candidates,
        decisions
      )
    );
  },
  { optional: true, errorMessage: "Failed to fetch scored forecast" }
));
