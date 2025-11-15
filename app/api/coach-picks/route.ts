import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { withRateLimit } from "@/lib/middleware/rate-limiter";

export const dynamic = 'force-dynamic';

async function coachPicksHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const beachId = searchParams.get("beachId");
    const radiusKm = Number(searchParams.get("radiusKm") || 80);

    if (!beachId) {
      return createSuccessResponse({ picks: [] });
    }

    const supabase = createAPIServerClient();
    const { data, error } = await supabase.rpc("get_coach_picks", {
      _beach_id: beachId,
      _radius_km: radiusKm,
    });
    if (error) throw error;

    return createSuccessResponse({ picks: data || [] });
  } catch (error) {
    return handleApiError(error);
  }
}

// Apply rate limiting to prevent abuse of RPC calls
export const GET = withRateLimit(coachPicksHandler, "coach-picks");

