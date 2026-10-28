import { NextRequest } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/validation";
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

const COMPUTE_CONCURRENCY = 8;
const ID_PAGE_SIZE = 1000;

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

async function selectAllIds(
  supabase: ServiceClient,
  table: "profiles" | "user_implicit_preferences",
  column: "id" | "user_id",
  filter?: (query: any) => any
): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += ID_PAGE_SIZE) {
    let query: any = supabase.from(table).select(column).order(column);
    if (filter) query = filter(query);
    const { data, error } = await query.range(from, from + ID_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to list ${table} ids: ${error.message}`);
    }
    const rows = (data ?? []) as Record<string, string>[];
    ids.push(...rows.map((row) => row[column]));
    if (rows.length < ID_PAGE_SIZE) return ids;
  }
}

// Opted-in users get recomputed; existing preference rows are included so the
// per-user call still deletes rows for users who opted out or went inactive.
async function listCandidateUserIds(supabase: ServiceClient): Promise<string[]> {
  const [optedIn, existing] = await Promise.all([
    selectAllIds(supabase, "profiles", "id", (q) => q.eq("allow_implicit_tracking", true)),
    selectAllIds(supabase, "user_implicit_preferences", "user_id"),
  ]);
  return [...new Set([...optedIn, ...existing])];
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

    if (targetUserId && !isUuid(targetUserId)) {
      return createErrorResponse(
        "Invalid userId",
        "userId must be a valid UUID",
        400
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const userIds = targetUserId ? [targetUserId] : await listCandidateUserIds(supabase);
    let processedUsers = 0;
    const failures: string[] = [];

    // One call per user: the all-users call runs 6-9 s and hits PostgREST's 8 s statement_timeout.
    for (let i = 0; i < userIds.length; i += COMPUTE_CONCURRENCY) {
      const batch = userIds.slice(i, i + COMPUTE_CONCURRENCY);
      const results = await Promise.all(
        batch.map((userId) =>
          (supabase.rpc as any)("compute_implicit_preferences", { target_user_id: userId })
        )
      );
      results.forEach(({ data, error }: { data: number | null; error: { message: string } | null }, idx: number) => {
        if (error) {
          failures.push(`${batch[idx]}: ${error.message}`);
          return;
        }
        processedUsers += data ?? 0;
      });
    }

    if (failures.length > 0 && failures.length === userIds.length) {
      throw new Error(`Failed to compute implicit preferences: ${failures[0]}`);
    }
    if (failures.length > 0) {
      console.warn(
        `[update-implicit-preferences] ${failures.length}/${userIds.length} users failed; first: ${failures[0]}`
      );
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
        processedUsers,
        failedUsers: failures.length,
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
