/**
 * GET /api/cron/earn-pro-evaluate
 *
 * Evaluates the test-user allowlist for streak-maintained earned Pro grants.
 * The route is inert unless EARN_PRO_ENABLED is true and
 * EARN_PRO_TEST_USER_IDS contains explicit user ids.
 */

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import {
  grantPromotionalEntitlement,
  isEarnProEligible,
  isEarnProEnabled,
  parseEarnProTestUserIds,
  type EarnProStreakSnapshot,
} from "@/lib/subscription/grant-promotional-entitlement";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[earn-pro-evaluate]";
const SENTRY_MONITOR = {
  slug: "earn-pro-evaluate",
  schedule: "0 18 * * *",
  maxRuntimeMinutes: 5,
};

interface ProfileRow {
  id: string;
}

interface StreakRpcData {
  weekly_session_streak_current?: unknown;
  weekly_session_streak_best?: unknown;
}

interface StreakRpcClient {
  rpc(
    fn: "get_user_streaks",
    args: { p_user_id: string },
  ): Promise<{ data: StreakRpcData | null; error: { message: string } | null }>;
}

interface RunSummary {
  enabled: boolean;
  allowlistSize: number;
  candidates: number;
  evaluated: number;
  eligible: number;
  granted: number;
  skipped: {
    flagDisabled: number;
    missingAllowlist: number;
    missingProfile: number;
    ineligible: number;
    activeGrant: number;
    streakReadFailed: number;
    grantFailed: number;
  };
  errors: number;
  durationMs: number;
}

function numericStreak(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildStreakSnapshot(data: StreakRpcData | null): EarnProStreakSnapshot {
  return {
    weeklySessionStreakCurrent: numericStreak(
      data?.weekly_session_streak_current,
    ),
    weeklySessionStreakBest: numericStreak(data?.weekly_session_streak_best),
  };
}

function asStreakRpcClient(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
): StreakRpcClient {
  return supabase as unknown as StreakRpcClient;
}

function createInitialSummary(startedAt: number): RunSummary {
  return {
    enabled: isEarnProEnabled(),
    allowlistSize: parseEarnProTestUserIds().length,
    candidates: 0,
    evaluated: 0,
    eligible: 0,
    granted: 0,
    skipped: {
      flagDisabled: 0,
      missingAllowlist: 0,
      missingProfile: 0,
      ineligible: 0,
      activeGrant: 0,
      streakReadFailed: 0,
      grantFailed: 0,
    },
    errors: 0,
    durationMs: Date.now() - startedAt,
  };
}

async function _GET(request: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const summary = createInitialSummary(startedAt);
    if (!summary.enabled) {
      summary.skipped.flagDisabled = 1;
      summary.durationMs = Date.now() - startedAt;
      return createSuccessResponse(
        await withCronOutcome(
          {
            job: "/api/cron/earn-pro-evaluate",
            unit: "rewards_evaluated",
            expectedMin: 1,
            getProduced: (value) => value.summary.evaluated,
            legitimatelyZero: () => ({ reason: "EARN_PRO_ENABLED is not true" }),
          },
          async () => ({ summary }),
        ),
      );
    }

    const allowlistedUserIds = parseEarnProTestUserIds();
    summary.allowlistSize = allowlistedUserIds.length;
    if (allowlistedUserIds.length === 0) {
      summary.skipped.missingAllowlist = 1;
      summary.durationMs = Date.now() - startedAt;
      console.warn(`${CONTEXT_TAG} EARN_PRO_ENABLED is true but allowlist is empty`);
      return createSuccessResponse(
        await withCronOutcome(
          {
            job: "/api/cron/earn-pro-evaluate",
            unit: "rewards_evaluated",
            expectedMin: 1,
            getProduced: (value) => value.summary.evaluated,
            legitimatelyZero: () => ({ reason: "EARN_PRO_ENABLED is true but the test allowlist is empty" }),
          },
          async () => ({ summary }),
        ),
      );
    }

    const supabase = createSupabaseServiceRoleClient();
    const streakRpc = asStreakRpcClient(supabase);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", allowlistedUserIds);

    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }

    const profileIds = new Set(
      ((profiles ?? []) as ProfileRow[])
        .map((profile) => profile.id)
        .filter(Boolean),
    );
    summary.skipped.missingProfile = allowlistedUserIds.length - profileIds.size;
    summary.candidates = profileIds.size;

    for (const userId of profileIds) {
      const { data, error } = await streakRpc.rpc("get_user_streaks", {
        p_user_id: userId,
      });
      if (error) {
        summary.skipped.streakReadFailed++;
        summary.errors++;
        console.error(`${CONTEXT_TAG} get_user_streaks failed for ${userId}:`, error);
        continue;
      }

      summary.evaluated++;
      const streakSnapshot = buildStreakSnapshot(data);
      if (!isEarnProEligible(streakSnapshot)) {
        summary.skipped.ineligible++;
        continue;
      }

      summary.eligible++;
      const grantResult = await grantPromotionalEntitlement({
        supabase,
        userId,
        streakSnapshot,
      });

      if (grantResult.status === "granted") {
        summary.granted++;
      } else if (grantResult.status === "skipped_active") {
        summary.skipped.activeGrant++;
      } else {
        summary.skipped.grantFailed++;
        summary.errors++;
        console.error(`${CONTEXT_TAG} grant failed for ${userId}:`, grantResult.error);
      }
    }

    summary.durationMs = Date.now() - startedAt;
    return createSuccessResponse(
      await withCronOutcome(
        {
          job: "/api/cron/earn-pro-evaluate",
          unit: "rewards_evaluated",
          expectedMin: 1,
          getProduced: (value) => value.summary.evaluated,
          legitimatelyZero: (value) =>
            value.summary.candidates === 0
              ? { reason: "No allowlisted profiles were available to evaluate" }
              : undefined,
        },
        async () => ({ summary }),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("earn-pro-evaluate", _GET, SENTRY_MONITOR);
