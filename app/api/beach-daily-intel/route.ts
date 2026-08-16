import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSuccessResponse,
  createValidationError,
  withErrorHandler,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import { getVerifiedProfileExperience } from "@/lib/profile/skill-level";
import {
  buildDailyIntelMajorEventHoldCandidate,
  sanitizeDailyIntelForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/legacy";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import { getDailyIntelWaveHeightLabels } from "@/lib/services/intel/wave-height-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";


const QuerySchema = z.object({
  beachId: z.string().uuid("beachId must be a valid UUID"),
  forecastDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "forecastDate must be YYYY-MM-DD"),
});




/**
 * GET /api/beach-daily-intel?beachId=<uuid>&forecastDate=YYYY-MM-DD
 *
 * Returns the latest `beach_daily_intel` record (or null) for a beach and local-date.
 */
async function getBeachDailyIntel(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const parsed = QuerySchema.safeParse({
    beachId: searchParams.get("beachId"),
    forecastDate: searchParams.get("forecastDate"),
  });

  if (!parsed.success) {
    return createValidationError("Invalid query parameters", parsed.error.issues);
  }

  const { beachId, forecastDate } = parsed.data;

  // Dev-only logging to debug timezone issues
  if (process.env.NODE_ENV === "development") {
    console.log(`[beach-daily-intel API] Querying intel:`, {
      beachId,
      forecastDate,
      utcNow: new Date().toISOString(),
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data: intel, error } = await supabase
    .from("beach_daily_intel")
    .select(
      `
      id,
      beach_id,
      forecast_date,
      generated_at,
      generation_time,
      created_at,
      updated_at,
      conditions_score,
      confidence,
      recommendation,
      best_window_start,
      best_window_end,
      best_window_description,
      surf_min_ft,
      surf_max_ft,
      surf_description,
      primary_swell_height_ft,
      primary_swell_period_s,
      primary_swell_direction_deg,
      primary_swell_direction_text,
      secondary_swell_height_ft,
      secondary_swell_period_s,
      secondary_swell_direction_deg,
      secondary_swell_direction_text,
      wind_speed_mph,
      wind_direction_deg,
      wind_direction_text,
      wind_quality,
      wind_description,
      tide_height_ft,
      tide_status,
      tide_time,
      tide_optimal_range,
      next_tide_height_ft,
      next_tide_time,
      next_tide_type,
      raw_intel_data,
      beaches!inner (
        timezone
      )
    `
    )
    .eq("beach_id", beachId)
    .eq("forecast_date", forecastDate)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Dev-only result logging
  if (process.env.NODE_ENV === "development") {
    if (!intel) {
      console.log(
        `[beach-daily-intel API] No intel found for beach ${beachId} on ${forecastDate}`
      );
    } else {
      console.log(`[beach-daily-intel API] Found intel for beach ${beachId}:`, {
        forecast_date: intel.forecast_date,
        generated_at: intel.generated_at,
      });
    }
  }

  if (error) {
    throw error;
  }

  if (!intel) {
    return createSuccessResponse({ intel: null });
  }

  const { beaches, ...intelFields } = intel;
  const beach = Array.isArray(beaches) ? beaches[0] : beaches;
  const beachTimeZone = beach?.timezone ?? "";
  const labels = await getDailyIntelWaveHeightLabels(
    supabase,
    beachId,
    forecastDate,
    {
      bestWindowStart: intel.best_window_start,
      bestWindowEnd: intel.best_window_end,
    },
    beachTimeZone
  );
  const completeIntel = { ...intelFields, ...labels };
  const candidate = buildDailyIntelMajorEventHoldCandidate(
    completeIntel,
    beachTimeZone
  );
  const candidates = [candidate];
  const { profileExperience } = await getVerifiedProfileExperience(supabase);
  const decisions = await evaluateMajorEventHoldCandidates({
    candidates,
    profileExperience,
  });
  const sanitizedIntel = sanitizeDailyIntelForMajorEventHold(
    completeIntel,
    beachTimeZone,
    candidates,
    decisions
  );

  return createSuccessResponse({ intel: sanitizedIntel });
}

export const GET = withNoStore(
  withErrorHandler(getBeachDailyIntel, {
    errorMessage: "Failed to load beach daily intel",
  })
);
