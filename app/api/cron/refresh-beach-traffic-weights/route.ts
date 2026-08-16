import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withCronOutcome } from "@/lib/cron/outcome";
import { withObservedCron } from "@/lib/cron/observability";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { refreshBeachTrafficWeights } from "@/lib/npc/traffic-weights";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }
    const supabase = await createSupabaseServiceRoleClient();
    const weights = await withCronOutcome(
      {
        job: "/api/cron/refresh-beach-traffic-weights",
        unit: "weights_refreshed",
        expectedMin: 1,
        getProduced: (value) => value.length,
        legitimatelyZero: (value) =>
          value.length === 0
            ? { reason: "No active beaches were available for traffic weights" }
            : undefined,
      },
      () => refreshBeachTrafficWeights(supabase),
    );
    return createSuccessResponse({
      beaches: weights.length,
      computedAt: weights[0]?.computedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "Failed to refresh beach traffic weights");
  }
}

export const GET = withObservedCron(
  "/api/cron/refresh-beach-traffic-weights",
  _GET,
);
