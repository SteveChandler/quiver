import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  createSuccessResponse,
  handleApiError,
  withRateLimit,
  type RouteHandler,
} from "@/lib/middleware/api-wrappers";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import {
  buildCoachPicksMajorEventHoldCandidates,
  sanitizeCoachPicksForMajorEventHold,
} from "@/lib/recommendations/major-event-hold/adapters/legacy";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";

export const dynamic = "force-dynamic";

const NO_STORE = "private, no-store, no-cache, must-revalidate";

type ApiSupabaseClient = Awaited<ReturnType<typeof createAPIServerClient>>;

async function getVerifiedProfileExperience(
  supabase: ApiSupabaseClient,
): Promise<unknown> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return await getProfileExperienceLevel(supabase, user.id);
  } catch {
    return null;
  }
}

function withNoStore(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const response = await handler(request, context);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  };
}

async function coachPicksHandler(request: NextRequest) {
  try {
    const requestAsOf = new Date();
    const { searchParams } = new URL(request.url);
    const beachId = searchParams.get("beachId");
    const radiusKm = Number(searchParams.get("radiusKm") || 80);
    const supabase = await createAPIServerClient();
    const profileExperience = await getVerifiedProfileExperience(supabase);
    if (!beachId) {
      const decisions = await evaluateMajorEventHoldCandidates({
        candidates: [null],
        profileExperience,
        asOf: requestAsOf,
      });
      return createSuccessResponse(
        sanitizeCoachPicksForMajorEventHold({ picks: [] }, [null], decisions),
      );
    }

    const { data, error } = await supabase.rpc("get_coach_picks", {
      _beach_id: beachId,
      _radius_km: radiusKm,
    });
    if (error) throw error;

    const picks = Array.isArray(data) ? data : [];
    const candidates = buildCoachPicksMajorEventHoldCandidates(
      picks,
      requestAsOf,
    );
    const decisions = await evaluateMajorEventHoldCandidates({
      candidates,
      profileExperience,
      asOf: requestAsOf,
    });
    return createSuccessResponse(
      sanitizeCoachPicksForMajorEventHold({ picks }, candidates, decisions),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// Keep the legacy surface rate-limited while applying the hold at the boundary.
export const GET = withNoStore(withRateLimit(coachPicksHandler, "coach-picks"));
