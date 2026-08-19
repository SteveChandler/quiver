/**
 * GET /api/cron/trial-ending-push-deliver
 *
 * Day-12 trial-ending push cron. Runs daily at 9am Pacific.
 *
 * Sends ONE push notification to users whose 14-day RevenueCat trial is
 * ending in ~2 days (Day 12 of trial). Mirrors the in-app EntitlementBanner
 * trial countdown — this push catches users who don't open the app during
 * the final 2 days.
 *
 * Anti-trap UX per paywall spec §3:
 *   quiver-native/docs/superpowers/specs/2026-04-16-subscription-paywall-design.md
 *
 * Selection window: trial_ends_at BETWEEN now+1.5d AND now+2.5d
 *   - Catches the full Day-12 population regardless of cron offset drift.
 *   - Idempotency log (trial_ending_push_log) ensures no double-push within the
 *     24h window even if Vercel retries or we bump the schedule to twice-daily.
 *
 * Push tap routes to Settings → Manage Subscription (native router key
 * 'Settings'). See quiver-native/src/lib/push-notifications.ts.
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[trial-ending-push-deliver]";

const SENTRY_MONITOR = {
  slug: "trial-ending-push-deliver",
  schedule: "0 17 * * *",
  maxRuntimeMinutes: 5,
};

// Selection window: trial_ends_at in [now + 1.5 days, now + 2.5 days].
// Center on 2.0 days with a ±0.5d buffer so the cron can slip without missing
// anyone. The idempotency log blocks double-sends on overlap.
const WINDOW_START_HOURS = 36; // 1.5 days
const WINDOW_END_HOURS = 60; // 2.5 days

const PUSH_TITLE = "Trial ends in 2 days";
const PUSH_BODY =
  "Keep your board picks + similarity alerts, or cancel anytime in App Store settings.";

// ============================================================================
// Type Definitions
// ============================================================================

interface TrialCandidate {
  user_id: string;
  trial_ends_at: string;
  device_tokens: string[];
}

interface RunSummary {
  candidates: number;
  sent: number;
  skipped: {
    noPushPref: number;
    noDeviceToken: number;
    alreadySent: number;
    sendFailed: number;
    logFailed: number;
  };
  errors: number;
  durationMs: number;
}

async function recordTrialEndingOutcome(
  result: { summary: RunSummary },
): Promise<{ summary: RunSummary }> {
  return withCronOutcome(
    {
      job: "/api/cron/trial-ending-push-deliver",
      unit: "notifications_sent",
      expectedMin: 1,
      getProduced: (value) => value.summary.sent,
      legitimatelyZero: (value) =>
        value.summary.candidates === 0
          ? { reason: "No trial users had an eligible push notification this cycle" }
          : undefined,
    },
    async () => result,
  );
}

// ============================================================================
// Main Handler
// ============================================================================

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    console.log(`${CONTEXT_TAG} Starting trial-ending-push-deliver run`);

    const supabase = createSupabaseServiceRoleClient();

    const summary: RunSummary = {
      candidates: 0,
      sent: 0,
      skipped: {
        noPushPref: 0,
        noDeviceToken: 0,
        alreadySent: 0,
        sendFailed: 0,
        logFailed: 0,
      },
      errors: 0,
      durationMs: 0,
    };

    const now = new Date();
    const windowStart = new Date(
      now.getTime() + WINDOW_START_HOURS * 60 * 60 * 1000
    ).toISOString();
    const windowEnd = new Date(
      now.getTime() + WINDOW_END_HOURS * 60 * 60 * 1000
    ).toISOString();

    // 1. Find trialing users with trial_ends_at in the window.
    //    WHERE trial_ends_at in window is also a cheap "not past-grace" filter
    //    — past-grace users have trial_ends_at < now and are excluded.
    const { data: trialUsers, error: trialError } = await supabase
      .from("user_entitlements")
      .select("user_id, trial_ends_at")
      .eq("is_trialing", true)
      .gte("trial_ends_at", windowStart)
      .lte("trial_ends_at", windowEnd);

    if (trialError) {
      throw new Error(`Failed to query user_entitlements: ${trialError.message}`);
    }

    if (!trialUsers || trialUsers.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No trialing users in Day-12 window`);
      return createSuccessResponse(await recordTrialEndingOutcome({ summary }));
    }

    const userIds = trialUsers.map((u) => u.user_id);

    // 2. Filter out users who already received this push (idempotency).
    const { data: alreadySent, error: logError } = await supabase
      .from("trial_ending_push_log")
      .select("user_id")
      .in("user_id", userIds);

    if (logError) {
      throw new Error(`Failed to query trial_ending_push_log: ${logError.message}`);
    }

    const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id));
    summary.skipped.alreadySent = alreadySentIds.size;

    const unsentUserIds = userIds.filter((id) => !alreadySentIds.has(id));
    if (unsentUserIds.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(
        `${CONTEXT_TAG} All ${userIds.length} candidates already pushed (idempotent skip)`
      );
      return createSuccessResponse(await recordTrialEndingOutcome({ summary }));
    }

    // 3. Filter to users with push enabled.
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, notif_push_enabled")
      .in("id", unsentUserIds);

    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }

    const pushEnabledIds = new Set(
      (profiles ?? [])
        .filter((p) => p.notif_push_enabled === true)
        .map((p) => p.id)
    );
    summary.skipped.noPushPref = unsentUserIds.length - pushEnabledIds.size;

    if (pushEnabledIds.size === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(
        `${CONTEXT_TAG} No push-enabled users (${unsentUserIds.length} had push disabled)`
      );
      return createSuccessResponse(await recordTrialEndingOutcome({ summary }));
    }

    // 4. Fetch device tokens per user (multiple devices allowed).
    const deviceQuery = supabase
      .from("user_devices")
      .select("user_id, device_token")
      .in("user_id", Array.from(pushEnabledIds));
    const { data: devices, error: devicesError } = await (typeof (deviceQuery as { is?: unknown }).is === "function"
      ? deviceQuery.is("retired_at" as never, null)
      : deviceQuery);

    if (devicesError) {
      throw new Error(`Failed to query user_devices: ${devicesError.message}`);
    }

    const tokensByUser = new Map<string, string[]>();
    for (const d of devices ?? []) {
      const list = tokensByUser.get(d.user_id) ?? [];
      list.push(d.device_token);
      tokensByUser.set(d.user_id, list);
    }

    // Build final candidate list. Users with push enabled but no token
    // are counted as skipped (and NOT logged, so re-registration works).
    const trialEndsByUser = new Map(
      trialUsers.map((u) => [u.user_id, u.trial_ends_at as string])
    );

    const candidates: TrialCandidate[] = [];
    for (const userId of pushEnabledIds) {
      const tokens = tokensByUser.get(userId);
      if (!tokens || tokens.length === 0) {
        summary.skipped.noDeviceToken++;
        continue;
      }
      const endsAt = trialEndsByUser.get(userId);
      if (!endsAt) continue; // defensive: should always be present
      candidates.push({
        user_id: userId,
        trial_ends_at: endsAt,
        device_tokens: tokens,
      });
    }

    summary.candidates = candidates.length;
    console.log(
      `${CONTEXT_TAG} ${candidates.length} candidates (${trialUsers.length} in window, ${summary.skipped.alreadySent} already sent, ${summary.skipped.noPushPref} push-disabled, ${summary.skipped.noDeviceToken} no token)`
    );

    if (candidates.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse(await recordTrialEndingOutcome({ summary }));
    }

    // 5. Phase 3e: enqueue once per candidate. The notifications-deliver
    //    worker handles devices, FCM, retries, and skip-no-device. The
    //    `trial_ending_push_log` row is retained as the cron-level dedup so
    //    a user is not re-enqueued daily.
    for (const candidate of candidates) {
      try {
        const enqueueResult = await enqueueNotification({
          type: "trial_ending",
          recipientUserId: candidate.user_id,
          payload: {
            title: PUSH_TITLE,
            body: PUSH_BODY,
            trial_ends_at: candidate.trial_ends_at,
          },
          dedupeKey: `trial_ending:${candidate.user_id}:${candidate.trial_ends_at}`,
        });

        if (!enqueueResult.enqueued && enqueueResult.reason !== "duplicate") {
          console.error(
            `${CONTEXT_TAG} Enqueue failed for user ${candidate.user_id}:`,
            enqueueResult
          );
          summary.skipped.sendFailed++;
          summary.errors++;
          continue;
        }

        // Log per-user (unique constraint on PK prevents dupes even on race).
        const { error: insertError } = await supabase
          .from("trial_ending_push_log")
          .insert({
            user_id: candidate.user_id,
            trial_ends_at: candidate.trial_ends_at,
            meta: {
              device_count: candidate.device_tokens.length,
              notification_event_id:
                enqueueResult.enqueued ? enqueueResult.eventId : null,
              method: "enqueued_via_pipeline",
            },
          });

        if (insertError) {
          console.error(
            `${CONTEXT_TAG} Failed to log send for user ${candidate.user_id}:`,
            insertError
          );
          summary.skipped.logFailed++;
          // Still count as sent — event is enqueued. Next tick noops on PK conflict.
        }

        summary.sent++;
        console.log(
          `${CONTEXT_TAG} Enqueued for user ${candidate.user_id} (${candidate.device_tokens.length} device${candidate.device_tokens.length === 1 ? "" : "s"})`
        );
      } catch (candidateError) {
        console.error(
          `${CONTEXT_TAG} Error processing user ${candidate.user_id}:`,
          candidateError
        );
        summary.skipped.sendFailed++;
        summary.errors++;
      }
    }

    summary.durationMs = Date.now() - startTime;
    console.log(
      `${CONTEXT_TAG} Completed: ${summary.sent} sent, ${summary.candidates} candidates, ${summary.durationMs}ms`
    );

    return createSuccessResponse(await recordTrialEndingOutcome({ summary }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron(
  "/api/cron/trial-ending-push-deliver",
  _GET,
  SENTRY_MONITOR
);
