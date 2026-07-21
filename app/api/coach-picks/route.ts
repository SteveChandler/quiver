import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  createSuccessResponse,
  handleApiError,
  withRateLimit,
  type RouteHandler,
} from "@/lib/middleware/api-wrappers";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { sanitizeCoachPicksForMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/legacy";
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

async function coachPicksHandler() {
  try {
    const supabase = await createAPIServerClient();
    const profileExperience = await getVerifiedProfileExperience(supabase);
    const decisions = await evaluateMajorEventHoldCandidates({
      candidates: [null],
      profileExperience,
    });
    return createSuccessResponse(
      sanitizeCoachPicksForMajorEventHold({ picks: [] }, decisions),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// Keep the legacy surface rate-limited while it remains explicitly empty.
export const GET = withNoStore(withRateLimit(coachPicksHandler, "coach-picks"));
