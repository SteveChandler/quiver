import { NextRequest } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validation";
import { withCronOutcome } from "@/lib/cron/outcome";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSearchParams(request: Request | NextRequest): URLSearchParams {
  const maybeNextUrl = (request as NextRequest).nextUrl;
  if (maybeNextUrl?.searchParams) {
    return maybeNextUrl.searchParams;
  }

  if (request.url) {
    try {
      return new URL(request.url).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }

  return new URLSearchParams();
}

/**
 * GET /api/cron/update-implicit-preferences
 *
 * Aggregates recent user_events into user_implicit_preferences.
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 * - userId: optional UUID for a single-user manual recompute
 */
async function _GET(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    if (env !== "production") {
      return createErrorResponse(
        "Forbidden",
        `Implicit preference cron disabled for environment: ${env}. Only runs in production.`,
        403
      );
    }

    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const searchParams = getSearchParams(request);
    const targetUserId =
      searchParams.get("userId") || searchParams.get("targetUserId");

    if (targetUserId && !isValidUUID(targetUserId)) {
      return createErrorResponse(
        "Invalid userId",
        "userId must be a valid UUID",
        400
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const { data: processedUsers, error: computeError } = await (
      supabase.rpc as any
    )("compute_implicit_preferences", {
      target_user_id: targetUserId || null,
    });

    if (computeError) {
      throw new Error(`Failed to compute implicit preferences: ${computeError.message}`);
    }

    const { data: deletedExpiredEvents, error: cleanupError } = await (
      supabase.rpc as any
    )("cleanup_expired_events");

    if (cleanupError) {
      throw new Error(`Failed to cleanup expired events: ${cleanupError.message}`);
    }

    const outcome = await withCronOutcome(
      {
        job: "/api/cron/update-implicit-preferences",
        unit: "preferences_recomputed",
        expectedMin: 1,
        getProduced: (value) => value.processedUsers,
        legitimatelyZero: (value) =>
          value.processedUsers === 0
            ? { reason: "No users had eligible events for implicit preference recomputation" }
            : undefined,
      },
      async () => ({
        processedUsers: processedUsers ?? 0,
        deletedExpiredEvents: deletedExpiredEvents ?? 0,
      }),
    );

    return createSuccessResponse({
      ...outcome,
      targetUserId: targetUserId || null,
      duration: `${Date.now() - startedAt}ms`,
    });
  } catch (error) {
    return handleApiError(error, "Implicit preference update cron failed", true);
  }
}

async function _POST(request: Request): Promise<Response> {
  return _GET(request);
}

export const GET = withObservedCron("/api/cron/update-implicit-preferences", _GET);
export const POST = withObservedCron("/api/cron/update-implicit-preferences", _POST);
