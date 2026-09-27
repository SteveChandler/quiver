import type { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createValidationError,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { getPersonalizationMatchScore } from "@/lib/personalization/match-score";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchUserBoardContext } from "@/lib/services/discovery/surf-discovery-orchestrator";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { recommendBoard } from "@/lib/scoring/personal-board";
import { getDirectionDegrees } from "@/lib/utils/number-parsing";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export const GET = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const searchParams = new URL(request.url).searchParams;
    const beachId = searchParams.get("beach_id");
    if (!beachId) return createValidationError("beach_id is required");
    const requestedForecastAt = searchParams.get("forecast_at");
    if (requestedForecastAt && !Number.isFinite(Date.parse(requestedForecastAt))) {
      return createValidationError("forecast_at must be a valid timestamp");
    }
    const forecastAt = requestedForecastAt ? new Date(requestedForecastAt).toISOString() : new Date().toISOString();
    const windDirection = searchParams.get("wind_direction") ?? "0";
    const waveHeight = searchParams.get("wave_height") ?? "0";
    const wavePeriod = searchParams.get("wave_period") ?? "0";
    const windSpeed = searchParams.get("wind_speed") ?? "0";
    const tideHeight = searchParams.get("tide_height") ?? "0";

    const result = await getPersonalizationMatchScore(
      user.id,
      supabase,
      {
        beachId,
        waveHeight,
        wavePeriod,
        windSpeed,
        windDirection,
        tideHeight,
      },
      {
        betaAccessRequired:
          process.env.PERSONALIZATION_BETA_REQUIRED === "true" ||
          request.headers.get("x-quiver-beta-access") === "required",
        personalizationDisabled:
          process.env.PERSONALIZATION_DISABLED === "true" ||
          process.env.PERSONALIZATION_ENABLED === "false",
        createScoringClient: createSupabaseServiceRoleClient,
        loadBoardPick: async () => {
          const { data: beach, error } = await supabase.from("beaches").select("*").eq("id", beachId).maybeSingle();
          if (error) throw error;
          if (!beach) return null;
          const { boardsForPicks } = await fetchUserBoardContext(supabase, user.id, true);
          const experience = await getProfileExperienceLevel(supabase, user.id);
          const boardForecast = {
            beach_id: beachId,
            forecast_at: forecastAt,
            wave_height: waveHeight,
            wave_period: wavePeriod,
            wind_speed: windSpeed,
            wind_direction: windDirection,
            wind_direction_deg: getDirectionDegrees(windDirection),
            tide_height: tideHeight,
            tide_status: searchParams.get("tide_status"),
          } as EnhancedForecastEntity;
          return recommendBoard(boardsForPicks, boardForecast, beach as Beach, experience);
        },
      },
    );

    return createSuccessResponse(result);
  },
  { errorMessage: "Failed to load personalization match score" },
);
