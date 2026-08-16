/**
 * GET /api/cron/first-session-nudge-push
 *
 * Day-7 habit-formation push cron. Runs daily at 9am Pacific (17:00 UTC).
 *
 * Sends ONE push notification to users who signed up 6–8 days ago AND have
 * fewer than 3 sessions logged. Catches the habit-formation window where
 * a surfer is making it-or-break-it on "is this app part of my weekly
 * routine?" — distinct from:
 *   - Day-1 EMAIL (`/api/cron/first-session-nudge`) — 18–30h-old 0-session users
 *   - Day-12 PUSH (`/api/cron/trial-ending-push-deliver`) — trial-ending
 *
 * The three are additive and non-overlapping on (cohort, channel, lifecycle).
 *
 * Cohort branching (5-way):
 *   - Trialing + home beach             → "Unlock your Quiver"
 *   - Trialing + no home beach          → "Set your home break"
 *   - Free + home + conditions>=70      → "✨ {beach} is looking good"
 *   - Free + home                       → "How was this week?"
 *   - Free + no home                    → "Been out this week?"
 *
 * "Conditions>=70" = first hourly row today at the user's home beach with
 * `confidence_score >= 70` via `v_enhanced_forecast_latest` → enhanced_forecasts
 * join. Lookup failure falls back to the non-firing "Free + home" cohort.
 *
 * Idempotency: composite PK on activation_push_log(user_id, nudge_type) —
 * re-runs never double-push. Log row is written ONLY on successful send, so
 * a user with push disabled today stays eligible if they re-enable within
 * the 6–8d window.
 *
 * Push `data.type = 'log_session_nudge'` routes via native handler to
 * SessionForm (see quiver-native/src/lib/push-notifications.ts).
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */

import { enqueueNotification } from "@/lib/notifications/enqueue";
import { buildNotificationRelevanceMetadata } from "@/lib/notifications/relevance";
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
  getLocalDateString,
  getLocalHour,
  isNightHour,
} from "@/lib/utils/timezone-utils";
import {
  resolveNotificationMajorEventHold,
  type PositiveRecommendationPolicyContext,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import { fromZonedTime } from "date-fns-tz";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_TAG = "[first-session-nudge-push]";
const NUDGE_TYPE = "first_session_day7";

const SENTRY_MONITOR = {
  slug: "first-session-nudge-push",
  schedule: "0 17 * * *",
  maxRuntimeMinutes: 5,
};

// Closed-open signup window: [now - 8d, now - 6d).
// Mirrors Day-1 cron's off-by-one handling (half-open interval, inclusive
// on the older boundary, exclusive on the newer boundary).
const SIGNUP_MIN_DAYS = 6;
const SIGNUP_MAX_DAYS = 8;

// Session-count cap — anyone at 3+ sessions has already established habit.
const SESSION_COUNT_THRESHOLD = 3;

// Conditions>=70 threshold for the "firing" cohort branch.
const CONDITIONS_FIRING_THRESHOLD = 70;

type CohortKey =
  | "trialing_home"
  | "trialing_no_home"
  | "free_home_firing"
  | "free_home"
  | "free_no_home";

// ============================================================================
// Types
// ============================================================================

interface Candidate {
  user_id: string;
  home_beach_id: string | null;
  is_trialing: boolean;
  is_pro: boolean;
  device_tokens: string[];
  experience_level: string | null;
}

interface BeachRow {
  id: string;
  name: string | null;
  timezone: string | null;
}

interface ResolvedCohort {
  cohort: CohortKey;
  title: string;
  body: string;
  beach_id: string | null;
  beach_name: string | null;
  confidence_score: number | null;
  policy_context?: PositiveRecommendationPolicyContext;
}

interface FiringConfidence {
  confidenceScore: number;
  policyContext: PositiveRecommendationPolicyContext;
}

interface RunSummary {
  total: number;
  sent: number;
  skipped: {
    already_logged: number;
    at_3_sessions: number;
    no_email_confirmed: number;
    no_profile: number;
    push_disabled: number;
    no_token: number;
    send_failed: number;
    log_failed: number;
  };
  cohorts: Record<CohortKey, number>;
  errors: number;
  durationMs: number;
}

async function recordFirstSessionPushOutcome(
  result: { summary: RunSummary },
): Promise<{ summary: RunSummary }> {
  return withCronOutcome(
    {
      job: "/api/cron/first-session-nudge-push",
      unit: "nudges_sent",
      expectedMin: 1,
      getProduced: (value) => value.summary.sent,
      legitimatelyZero: (value) =>
        value.summary.total === 0
          ? { reason: "No users were eligible for the day-7 first-session push window" }
          : undefined,
    },
    async () => result,
  );
}

// ============================================================================
// Cohort resolution
// ============================================================================

async function fetchFiringConfidence(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  beachId: string,
  timezone?: string | null
): Promise<FiringConfidence | null> {
  if (!isValidIanaTimezone(timezone) || !isUuid(beachId)) return null;
  const beachTimezone = timezone;

  try {
    const now = new Date();
    const localDate = getLocalDateString(now, beachTimezone);
    const bounds = getStrictUtcDayBounds(localDate, beachTimezone);
    if (bounds === null) return null;
    const { start, end } = bounds;

    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("confidence_score, forecast_at")
      .eq("beach_id", beachId)
      .gte("forecast_at", start)
      .lt("forecast_at", end)
      .gte("confidence_score", CONDITIONS_FIRING_THRESHOLD)
      .order("forecast_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(
        `${CONTEXT_TAG} confidence lookup failed for beach ${beachId}:`,
        error.message
      );
      return null;
    }
    if (!data || typeof data.confidence_score !== "number") return null;

    const forecastAt = data.forecast_at ? new Date(data.forecast_at) : null;
    if (!forecastAt || Number.isNaN(forecastAt.getTime())) return null;
    if (isNightHour(getLocalHour(forecastAt, beachTimezone))) return null;

    return {
      confidenceScore: data.confidence_score,
      policyContext: {
        kind: "positive_session_recommendation",
        beach_id: beachId,
        starts_at: start,
        ends_at: end,
      },
    };
  } catch (err) {
    console.warn(`${CONTEXT_TAG} confidence lookup threw for beach ${beachId}:`, err);
    return null;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidIanaTimezone(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 100 ||
    value.trim() !== value
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function nextLocalDate(localDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1),
  );
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getStrictUtcDayBounds(
  localDate: string,
  timezone: string,
): { start: string; end: string } | null {
  const followingDate = nextLocalDate(localDate);
  if (followingDate === null) return null;
  try {
    const start = fromZonedTime(`${localDate}T00:00:00.000`, timezone);
    const end = fromZonedTime(`${followingDate}T00:00:00.000`, timezone);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end.getTime() <= start.getTime()
    ) {
      return null;
    }
    return { start: start.toISOString(), end: end.toISOString() };
  } catch {
    return null;
  }
}

async function resolveCohort(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  candidate: Candidate,
  beachById: Map<string, BeachRow>
): Promise<ResolvedCohort> {
  const beach = candidate.home_beach_id
    ? beachById.get(candidate.home_beach_id) ?? null
    : null;
  const beachName = beach?.name ?? null;

  if (candidate.is_trialing) {
    if (candidate.home_beach_id && beachName) {
      return {
        cohort: "trialing_home",
        title: "Unlock your Quiver",
        body: "Add your first session when you paddle out — 7 days left in your trial",
        beach_id: null,
        beach_name: beachName,
        confidence_score: null,
      };
    }
    return {
      cohort: "trialing_no_home",
      title: "Set your home break",
      body: "Pick a home break, then add your first session when you paddle out.",
      beach_id: null,
      beach_name: null,
      confidence_score: null,
    };
  }

  // Free tier (no entitlement row OR is_pro=false AND is_trialing=false).
  if (!candidate.home_beach_id || !beach) {
    return {
      cohort: "free_no_home",
      title: "Been out this week?",
      body: "Set your home break and log a session to start",
      beach_id: null,
      beach_name: null,
      confidence_score: null,
    };
  }

  const confidence = await fetchFiringConfidence(
    supabase,
    candidate.home_beach_id,
    beach.timezone
  );
  if (
    confidence !== null &&
    confidence.confidenceScore >= CONDITIONS_FIRING_THRESHOLD
  ) {
    return {
      cohort: "free_home_firing",
      title: "Good window at your home break",
      body: "Check today's forecast, and log a session if you paddle out.",
      beach_id: null,
      beach_name: beachName,
      confidence_score: confidence.confidenceScore,
      policy_context: confidence.policyContext,
    };
  }

  return {
    cohort: "free_home",
    title: "Start your surf log",
    body: "Add your first session when you paddle out.",
    beach_id: null,
    beach_name: beachName,
    confidence_score: null,
  };
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

    console.log(`${CONTEXT_TAG} Starting first-session-nudge-push run`);

    const supabase = createSupabaseServiceRoleClient();

    const summary: RunSummary = {
      total: 0,
      sent: 0,
      skipped: {
        already_logged: 0,
        at_3_sessions: 0,
        no_email_confirmed: 0,
        no_profile: 0,
        push_disabled: 0,
        no_token: 0,
        send_failed: 0,
        log_failed: 0,
      },
      cohorts: {
        trialing_home: 0,
        trialing_no_home: 0,
        free_home_firing: 0,
        free_home: 0,
        free_no_home: 0,
      },
      errors: 0,
      durationMs: 0,
    };

    // 1. Find profiles whose auth.users.created_at lands in [now-8d, now-6d).
    //    profiles.created_at tracks auth.users.created_at via the on-signup
    //    trigger, so we can filter there without hitting auth.users directly.
    const now = new Date();
    const signupAfter = new Date(
      now.getTime() - SIGNUP_MAX_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const signupBefore = new Date(
      now.getTime() - SIGNUP_MIN_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: windowProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, home_beach_id, experience_level")
      .gte("created_at", signupAfter)
      .lt("created_at", signupBefore);

    if (profilesError) {
      throw new Error(`Failed to query profiles: ${profilesError.message}`);
    }

    if (!windowProfiles || windowProfiles.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No profiles in signup window`);
      return createSuccessResponse(await recordFirstSessionPushOutcome({ summary }));
    }

    const windowUserIds = windowProfiles.map((p) => p.id);

    // 2. Idempotency filter — anyone already nudged is out.
    const { data: alreadyLogged, error: logError } = await supabase
      .from("activation_push_log")
      .select("user_id")
      .in("user_id", windowUserIds)
      .eq("nudge_type", NUDGE_TYPE);

    if (logError) {
      throw new Error(`Failed to query activation_push_log: ${logError.message}`);
    }

    const alreadyLoggedIds = new Set(
      ((alreadyLogged ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
    );
    summary.skipped.already_logged = alreadyLoggedIds.size;

    const unloggedIds = windowUserIds.filter((id) => !alreadyLoggedIds.has(id));
    if (unloggedIds.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} All ${windowUserIds.length} candidates already pushed`);
      return createSuccessResponse(await recordFirstSessionPushOutcome({ summary }));
    }

    // 3. Session-count filter — drop anyone at >= SESSION_COUNT_THRESHOLD.
    //    sessions.user_id is the post-Feb-2026 column name.
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("sessions")
      .select("user_id")
      .in("user_id", unloggedIds);

    if (sessionsError) {
      throw new Error(`Failed to query sessions: ${sessionsError.message}`);
    }

    const sessionCountByUser = new Map<string, number>();
    for (const s of sessionRows ?? []) {
      sessionCountByUser.set(s.user_id, (sessionCountByUser.get(s.user_id) ?? 0) + 1);
    }

    const underThresholdIds = unloggedIds.filter(
      (id) => (sessionCountByUser.get(id) ?? 0) < SESSION_COUNT_THRESHOLD
    );
    summary.skipped.at_3_sessions = unloggedIds.length - underThresholdIds.length;

    if (underThresholdIds.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No users under ${SESSION_COUNT_THRESHOLD}-session cap`);
      return createSuccessResponse(await recordFirstSessionPushOutcome({ summary }));
    }

    // 4. Email-confirmation gate — skip the "invisible cohort" (confirmed=null).
    //    Batched via admin API (same pattern as Day-1 cron).
    const BATCH_SIZE = 5;
    const confirmedIds: string[] = [];
    for (let i = 0; i < underThresholdIds.length; i += BATCH_SIZE) {
      const batch = underThresholdIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((id) => supabase.auth.admin.getUserById(id))
      );
      for (let j = 0; j < results.length; j++) {
        const authUser = results[j].data?.user;
        const userId = batch[j];
        if (!authUser) {
          summary.skipped.no_profile++;
          continue;
        }
        if (!authUser.email_confirmed_at) {
          summary.skipped.no_email_confirmed++;
          continue;
        }
        confirmedIds.push(userId);
      }
    }

    if (confirmedIds.length === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No email-confirmed candidates`);
      return createSuccessResponse(await recordFirstSessionPushOutcome({ summary }));
    }

    // 5. Push-enabled filter via profiles.notif_push_enabled.
    const { data: pushPrefs, error: prefsError } = await supabase
      .from("profiles")
      .select("id, notif_push_enabled")
      .in("id", confirmedIds);

    if (prefsError) {
      throw new Error(`Failed to query push prefs: ${prefsError.message}`);
    }

    const pushEnabledIds = new Set<string>();
    for (const row of pushPrefs ?? []) {
      if (row.notif_push_enabled === true) pushEnabledIds.add(row.id);
    }
    summary.skipped.push_disabled = confirmedIds.length - pushEnabledIds.size;

    if (pushEnabledIds.size === 0) {
      summary.durationMs = Date.now() - startTime;
      console.log(`${CONTEXT_TAG} No push-enabled candidates`);
      return createSuccessResponse(await recordFirstSessionPushOutcome({ summary }));
    }

    // 6. Device tokens — users without one are skipped and NOT logged (so
    //    re-registration still wins within the window).
    const { data: devices, error: devicesError } = await supabase
      .from("user_devices")
      .select("user_id, device_token")
      .in("user_id", Array.from(pushEnabledIds));

    if (devicesError) {
      throw new Error(`Failed to query user_devices: ${devicesError.message}`);
    }

    const tokensByUser = new Map<string, string[]>();
    for (const d of devices ?? []) {
      const list = tokensByUser.get(d.user_id) ?? [];
      list.push(d.device_token);
      tokensByUser.set(d.user_id, list);
    }

    // 7. Entitlement lookup — single batched read, presence = trialing/pro.
    const { data: entitlements, error: entError } = await supabase
      .from("user_entitlements")
      .select("user_id, is_pro, is_trialing")
      .in("user_id", Array.from(pushEnabledIds));

    if (entError) {
      throw new Error(`Failed to query user_entitlements: ${entError.message}`);
    }

    const entitlementByUser = new Map<
      string,
      { is_pro: boolean; is_trialing: boolean }
    >();
    for (const e of entitlements ?? []) {
      entitlementByUser.set(e.user_id, {
        is_pro: Boolean(e.is_pro),
        is_trialing: Boolean(e.is_trialing),
      });
    }

    // 8. Build candidate list — attach tokens + entitlement + profile fields.
    const profileById = new Map(
      windowProfiles.map((p) => [
        p.id,
        {
          home_beach_id: p.home_beach_id as string | null,
          experience_level: (p.experience_level as string | null) ?? null,
        },
      ])
    );

    const candidates: Candidate[] = [];
    for (const userId of pushEnabledIds) {
      const tokens = tokensByUser.get(userId);
      if (!tokens || tokens.length === 0) {
        summary.skipped.no_token++;
        continue;
      }
      const profile = profileById.get(userId);
      if (!profile) {
        summary.skipped.no_profile++;
        continue;
      }
      const ent = entitlementByUser.get(userId);
      candidates.push({
        user_id: userId,
        home_beach_id: profile.home_beach_id,
        is_trialing: ent?.is_trialing ?? false,
        is_pro: ent?.is_pro ?? false,
        device_tokens: tokens,
        experience_level: profile.experience_level,
      });
    }

    summary.total = candidates.length;
    console.log(
      `${CONTEXT_TAG} ${candidates.length} candidates ` +
        `(${windowProfiles.length} window, ${summary.skipped.already_logged} already logged, ` +
        `${summary.skipped.at_3_sessions} at cap, ${summary.skipped.no_email_confirmed} unconfirmed, ` +
        `${summary.skipped.push_disabled} push-disabled, ${summary.skipped.no_token} no token)`
    );

    if (candidates.length === 0) {
      summary.durationMs = Date.now() - startTime;
      return createSuccessResponse(await recordFirstSessionPushOutcome({ summary }));
    }

    // 9. Batch-load beach names for cohort copy (only beaches actually in use).
    const neededBeachIds = Array.from(
      new Set(
        candidates
          .map((c) => c.home_beach_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const beachById = new Map<string, BeachRow>();
    if (neededBeachIds.length > 0) {
      const { data: beaches, error: beachesError } = await supabase
        .from("beaches")
        .select("id, name, timezone")
        .in("id", neededBeachIds);
      if (beachesError) {
        console.warn(
          `${CONTEXT_TAG} beach lookup failed:`,
          beachesError.message
        );
      } else {
        for (const b of beaches ?? []) {
          beachById.set(b.id, {
            id: b.id,
            name: b.name,
            timezone: b.timezone ?? null,
          });
        }
      }
    }

    // 10. Phase 3e: enqueue per candidate. Worker handles devices/FCM.
    for (const candidate of candidates) {
      try {
        const resolved = await resolveCohort(supabase, candidate, beachById);
        summary.cohorts[resolved.cohort]++;

        const payload = {
          cohort: resolved.cohort,
          title: resolved.title,
          body: resolved.body,
          beach_id: null,
          ...(resolved.policy_context
            ? { policy_context: resolved.policy_context }
            : {}),
          ...buildNotificationRelevanceMetadata({
            category: "session_growth",
            triggerSource: "first_session_day7",
            relevanceConfidence: "medium",
            beachConfidence: "low",
            beachConfidenceScore: resolved.confidence_score,
          }),
        };
        if (resolved.cohort === "free_home_firing") {
          const holdDecision = await resolveNotificationMajorEventHold({
            eventId: `first-session:${candidate.user_id}:${NUDGE_TYPE}`,
            type: "log_session_nudge",
            payload,
            profileExperience: candidate.experience_level,
            asOf: new Date(),
          });
          if (holdDecision.status !== "allowed") {
            console.info(
              `${CONTEXT_TAG} Suppressed ${resolved.cohort} for ${candidate.user_id}`,
              {
                audit_code: "major_event_hold",
                reason_code:
                  holdDecision.status === "suppressed"
                    ? holdDecision.reasonCode
                    : "hold_state_unavailable",
              },
            );
            continue;
          }
        }

        const enqueueResult = await enqueueNotification({
          type: "log_session_nudge",
          recipientUserId: candidate.user_id,
          entityType: null,
          entityId: null,
          payload,
          dedupeKey: `log_session_nudge:${candidate.user_id}:${NUDGE_TYPE}`,
        });

        if (!enqueueResult.enqueued && enqueueResult.reason !== "duplicate") {
          console.error(
            `${CONTEXT_TAG} Enqueue failed for ${candidate.user_id}:`,
            enqueueResult
          );
          summary.skipped.send_failed++;
          summary.errors++;
          continue;
        }

        const { error: insertError } = await supabase
          .from("activation_push_log")
          .insert({
            user_id: candidate.user_id,
            nudge_type: NUDGE_TYPE,
            metadata: {
              cohort: resolved.cohort,
              beach_id: resolved.beach_id,
              beach_name: resolved.beach_name,
              confidence_score: resolved.confidence_score,
              device_count: candidate.device_tokens.length,
              notification_event_id:
                enqueueResult.enqueued ? enqueueResult.eventId : null,
              method: "enqueued_via_pipeline",
            },
          });

        if (insertError) {
          console.error(
            `${CONTEXT_TAG} log insert failed for ${candidate.user_id}:`,
            insertError
          );
          summary.skipped.log_failed++;
          // Still counted as sent — event is enqueued. Next tick noops on PK conflict.
        }

        summary.sent++;
        console.log(
          `${CONTEXT_TAG} Enqueued ${resolved.cohort} for ${candidate.user_id} ` +
            `(${candidate.device_tokens.length} device${candidate.device_tokens.length === 1 ? "" : "s"})`
        );
      } catch (candidateError) {
        console.error(
          `${CONTEXT_TAG} Error processing ${candidate.user_id}:`,
          candidateError
        );
        summary.skipped.send_failed++;
        summary.errors++;
      }
    }

    summary.durationMs = Date.now() - startTime;
    console.log(
      `${CONTEXT_TAG} Completed: ${summary.sent} sent, ${summary.total} candidates, ${summary.durationMs}ms`
    );

    return createSuccessResponse(await recordFirstSessionPushOutcome({ summary }));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron(
  "/api/cron/first-session-nudge-push",
  _GET,
  SENTRY_MONITOR
);
