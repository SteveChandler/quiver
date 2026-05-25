import type { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createValidationError,
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { getPersonalizationMatchScore } from "@/lib/personalization/match-score";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const GET = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const searchParams = new URL(request.url).searchParams;
    const beachId = searchParams.get("beach_id");
    if (!beachId) return createValidationError("beach_id is required");

    const result = await getPersonalizationMatchScore(
      user.id,
      supabase,
      {
        beachId,
        waveHeight: searchParams.get("wave_height") ?? "0",
        wavePeriod: searchParams.get("wave_period") ?? "0",
        windSpeed: searchParams.get("wind_speed") ?? "0",
        windDirection: searchParams.get("wind_direction") ?? "0",
        tideHeight: searchParams.get("tide_height") ?? "0",
      },
      {
        betaAccessRequired:
          process.env.PERSONALIZATION_BETA_REQUIRED === "true" ||
          request.headers.get("x-quiver-beta-access") === "required",
        personalizationDisabled:
          process.env.PERSONALIZATION_DISABLED === "true" ||
          process.env.PERSONALIZATION_ENABLED === "false",
        createScoringClient: createSupabaseServiceRoleClient,
      },
    );

    return createSuccessResponse(result);
  },
  { errorMessage: "Failed to load personalization match score" },
);
