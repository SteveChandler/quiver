import { scoreForecastSlots, identifyGoldenWindows, type TimeSlot, type GoldenWindow } from "@/lib/services/forecast/scored-slots";
import type { NextRequest } from "next/server";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  createNotFoundError,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import {
  sanitizeScoredForecastForMajorEventHold,
  type ScoredForecastGoldenWindowBinding,
  type ScoredForecastSlotBinding,
} from "@/lib/recommendations/major-event-hold/adapters/bulk-forecast";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { fetchLatestObservation } from "@/lib/services/observations/nowcast-anchor";
import {
  applyV51DisplayOverrideToForecasts,
} from "@/lib/services/forecast/v5-display-gate";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

export const dynamic = "force-dynamic";

const SLOT_DURATION_MS = 3 * 60 * 60 * 1000;

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

    // Fetch beach
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", validBeachId)
      .single();

    if (beachError || !beach) {
      return createNotFoundError("Beach");
    }

    // Fetch next 24 hours of enhanced forecasts (8 slots × 3h = 24h) and
    // the latest live-buoy observation in parallel — both feed the beach
    // detail UI (forecast slots + LiveBuoyChip).
    const now = new Date().toISOString();
    const twentyFourHoursLater = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    const [forecastsResult, latestObservation] = await Promise.all([
      supabase
        .from("enhanced_forecasts")
        .select("*")
        .eq("beach_id", validBeachId)
        .gte("forecast_at", now)
        .lt("forecast_at", twentyFourHoursLater)
        .order("forecast_at")
        .limit(8),
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

    const timeSlots = scoreForecastSlots(forecastList, beach as Beach, userSkillLevel);

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
