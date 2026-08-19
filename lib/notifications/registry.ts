/**
 * Notification type registry — single source of truth for every notification
 * type Quiver emits. The delivery worker reads from this to know which
 * channels to dispatch on, which prefs gate them, and how to format push/
 * in-app payloads.
 *
 * Adding a new type:
 *   1. Add an entry below.
 *   2. (Optional) Add the per-type pref column to `profiles` if needed.
 *   3. Producers call `enqueueNotification({ type: 'your_new_type', ... })`.
 *   4. Native client `setupNotificationListeners` adds a `case` for the type
 *      in `quiver-native/src/lib/push-notifications.ts`.
 *
 * Dedupe model: enqueue-time only, via the partial unique index on
 * (recipient_user_id, type, dedupe_key) on `notification_events`. The worker
 * does NOT do windowed re-suppression — once an event is enqueued, it is
 * delivered (subject to prefs/self/quiet-hours). When a producer needs a
 * "don't re-notify within N days" semantics (e.g. follow on/off/on), it
 * encodes the time bucket in the dedupe_key itself, e.g.
 *   `follow:${actor_id}:${recipient_id}:${YYYY-WW}`
 * so the next bucket window can enqueue a fresh event.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 1d).
 */

import { z } from "zod";

import type {
  NotificationDeliveryStatus,
  NotificationPushPayload,
  NotificationTypeDef,
} from "./types";
import { isHighConfidenceNotification } from "./relevance";
import {
  similarityMatchSchema,
  type SimilarityMatchPayload,
} from "./types/similarity-match";
import {
  parseMajorSwellNotificationPayload,
  type MajorSwellNotificationPayload,
} from "./types/major-swell";
import { canonicalSessionDecisionSchema } from "@/lib/recommendations/canonical-decision/contract";

// ─── Phase 5e: payload schemas (validatePayload source of truth) ─────────────

const likeSchema = z.object({
  session_id: z.string().min(1),
  beach_name: z.string().nullable().optional(),
});

// follow has no required fields; actor identity comes from BuildCtx.
const followSchema = z.record(z.string(), z.unknown());

const positiveRecommendationPolicyContextSchema = z
  .object({
    kind: z.literal("positive_session_recommendation"),
    beach_id: z.string().uuid(),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((context, refinement) => {
    if (Date.parse(context.ends_at) <= Date.parse(context.starts_at)) {
      refinement.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "ends_at must be after starts_at",
      });
    }
  });

type PositiveRecommendationPolicyContextPayload = z.infer<
  typeof positiveRecommendationPolicyContextSchema
>;

const notificationSimilarityMatchSchema = similarityMatchSchema.extend({
  policy_context: positiveRecommendationPolicyContextSchema.optional(),
  session_decision: canonicalSessionDecisionSchema.optional(),
});

const forecastAlertSchema = z.object({
  alert_date: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  beach_id: z.string().nullable().optional(),
  configured_beach_id: z.string().min(1).optional(),
  beach_slug: z.string().nullable().optional(),
  forecast_at: z.string().nullable().optional(),
  policy_context: positiveRecommendationPolicyContextSchema.optional(),
  session_decision: canonicalSessionDecisionSchema.optional(),
  matches: z.unknown().optional(),
  quiet_hours_start: z.number().int().min(0).max(23).optional(),
  quiet_hours_end: z.number().int().min(0).max(23).optional(),
  queue_items: z
    .array(z.object({ queue_id: z.string(), rule_id: z.string() }))
    .optional(),
});

const trialEndingSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  trial_ends_at: z.string().min(1),
});

const logSessionNudgeSchema = z
  .object({
    cohort: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    beach_id: z.string().nullable().optional(),
    beach_name: z.string().nullable().optional(),
    policy_context: positiveRecommendationPolicyContextSchema.optional(),
    notification_category: z.string().optional(),
    trigger_source: z.string().optional(),
    relevance_confidence: z
      .enum(["high", "medium", "low", "unknown"])
      .optional(),
    beach_confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
    assumed_attendance: z.literal(false).optional(),
    attendance_confidence_score: z.number().finite().optional(),
    beach_confidence_score: z.number().finite().optional(),
    relevance_score: z.number().finite().optional(),
  })
  .strict()
  .superRefine((payload, refinement) => {
    if (
      payload.cohort === "free_home_firing" &&
      payload.policy_context === undefined
    ) {
      refinement.addIssue({
        code: "custom",
        path: ["policy_context"],
        message: "free_home_firing requires positive recommendation context",
      });
    }
  });

const forecastFeedbackNudgeSchema = z.object({
  beach_id: z.string().min(1),
  beach_slug: z.string().optional(),
  beach_name: z.string().optional(),
  forecast_at: z.string().optional(),
  deeplink: z.string().optional(),
  notification_category: z.string().optional(),
  trigger_source: z.string().optional(),
  relevance_confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
  beach_confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
  assumed_attendance: z.literal(false).optional(),
  attendance_confidence_score: z.number().finite().optional(),
  beach_confidence_score: z.number().finite().optional(),
  relevance_score: z.number().finite().optional(),
});

const homeMorningCallSchema = z
  .object({
    alert_date: z.string().min(1),
    verdict: z.enum(["YES", "MAYBE", "NO"]),
    beach_id: z.string().min(1),
    beach_name: z.string().optional(),
    forecast_at: z.string().nullable().optional(),
    policy_context: positiveRecommendationPolicyContextSchema.optional(),
    session_decision: canonicalSessionDecisionSchema.optional(),
    title: z.string().min(1),
    body: z.string().min(1),
  })
  .superRefine((payload, context) => {
    if (!payload.session_decision) return;
    const expected =
      payload.session_decision.verdict === "go"
        ? "YES"
        : payload.session_decision.verdict === "maybe"
          ? "MAYBE"
          : "NO";
    if (payload.verdict !== expected) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verdict"],
        message: "verdict must agree with session_decision.verdict",
      });
    }
    if (
      payload.session_decision.verdict !== "no" &&
      payload.session_decision.selection &&
      payload.session_decision.selection.beachId !== payload.beach_id
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["beach_id"],
        message: "beach_id must agree with canonical selection",
      });
    }
  });

const weekendLocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Invalid local date");

const weekendWindowSchema = z
  .object({
    snapshot_id: z.string().uuid(),
    weekend_start: weekendLocalDateSchema,
    weekend_end: weekendLocalDateSchema,
    qualifying_count: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    lead_beach_id: z.string().uuid(),
    lead_beach_name: z.string().min(1),
    lead_window_local: z.string().min(1),
  })
  .strict()
  .superRefine((payload, context) => {
    const expectedEnd = new Date(`${payload.weekend_start}T00:00:00.000Z`);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 1);
    if (payload.weekend_end !== expectedEnd.toISOString().slice(0, 10)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weekend_end"],
        message: "weekend_end must follow weekend_start",
      });
    }
  });

const weeklyStreakReminderSchema = z.object({
  streak: z.number().int().min(1),
  period_key: z.string().optional(),
  notification_category: z.string().optional(),
  trigger_source: z.string().optional(),
  relevance_confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
  beach_confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
  assumed_attendance: z.literal(false).optional(),
});

const waterQualitySchema = z.object({
  beach_id: z.string().min(1),
  beach_slug: z.string().min(1),
  beach_name: z.string().min(1),
  status: z.enum(["good", "advisory", "closure", "unknown"]),
  previous_status: z
    .enum(["good", "advisory", "closure", "unknown"])
    .nullable(),
  status_changed_at: z.string().min(1),
});

const dailyDigestSchema = z.object({
  alert_date: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  match_count: z.number().int().nonnegative().optional(),
  // Phase 5h: consolidated summaries from the morning digest cron. Both
  // optional — the cron populates them as the data integrations land.
  forecast_summary: z
    .object({
      top_match: z.string().min(1),
      match_count: z.number().int().nonnegative(),
    })
    .optional(),
  water_quality_summary: z
    .object({
      advisory_count: z.number().int().nonnegative(),
      closure_count: z.number().int().nonnegative(),
    })
    .optional(),
});

// Phase 5i: admin types — push-only, master-pref-only, no quiet hours.
const adminTestSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  body: z.string().min(1).max(240).optional(),
});

const adminBroadcastSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(240),
  url: z.string().nullable().optional(),
  data: z.record(z.string(), z.string()).optional(),
});

/**
 * Map a worker's per-channel status onto the legacy alert_delivery_attempts
 * status enum. Returns null for non-terminal-or-irrelevant statuses (e.g.
 * deferred_quiet_hours — the next worker tick will produce the real outcome).
 */
function mapWorkerStatusToAlertAttempt(
  status: NotificationDeliveryStatus,
):
  | "sent"
  | "skipped_no_device"
  | "skipped_channel_disabled"
  | "skipped_dedup_collision"
  | "skipped_disabled"
  | "failed_provider"
  | "failed_internal"
  | null {
  switch (status) {
    case "sent":
      return "sent";
    case "skipped_no_device":
      return "skipped_no_device";
    case "skipped_pref_master":
    case "skipped_pref_type":
      return "skipped_channel_disabled";
    case "skipped_dedup":
      return "skipped_dedup_collision";
    case "skipped_disabled":
    case "skipped_self":
      return "skipped_disabled";
    case "failed_provider":
      return "failed_provider";
    case "failed_internal":
      return "failed_internal";
    case "deferred_quiet_hours":
      return null;
    default:
      return null;
  }
}

// Default 10pm–4am local quiet hours (defer mode). Overridden per-type below
// where the producer's existing semantics need different behavior (e.g.
// trial_ending runs at 9am PT and never needs nighttime suppression).
const DEFAULT_QUIET = { mode: "defer", windowStart: 22, windowEnd: 4 } as const;
const NO_QUIET = { mode: "ignore" } as const;
const SURF_ALERT_PUSH_PRESENTATION = {
  iosSound: "quiver-alert.wav",
  androidChannelId: "quiver-alerts-v1",
} as const satisfies Pick<
  NotificationPushPayload,
  "iosSound" | "androidChannelId"
>;

// ─── Payload shapes (what producers pass + what builders consume) ────────────

interface LikePayload {
  session_id: string;
  beach_name?: string | null;
}

interface FollowPayload {
  /** No specific fields — actor identity comes from BuildCtx. */
  [k: string]: unknown;
}

interface ForecastAlertPayload {
  alert_date: string;
  /** Pre-consolidated push title/body from the forecast alerts pipeline. */
  title: string;
  body: string;
  /** Optional first-match context for tap-routing to a specific beach. */
  beach_id?: string | null;
  beach_slug?: string | null;
  forecast_at?: string | null;
  policy_context?: PositiveRecommendationPolicyContextPayload;
  session_decision?: z.infer<typeof canonicalSessionDecisionSchema>;
  /** Full match list for the in-app inbox row. */
  matches?: unknown;
  /**
   * Per-rule provenance for cron-side bookkeeping. The forecast_alert
   * onChannelOutcome hook fans out into alert_delivery_attempts (one row per
   * queue item) using these IDs after the worker reaches a terminal channel
   * outcome — so cooldown / weekly-cap reads only see truly-delivered pushes.
   */
  queue_items?: Array<{ queue_id: string; rule_id: string }>;
}

interface TrialEndingPayload {
  title: string;
  body: string;
  trial_ends_at: string;
}

interface LogSessionNudgePayload {
  cohort: string;
  title: string;
  body: string;
  beach_id?: string | null;
  beach_name?: string | null;
  policy_context?: PositiveRecommendationPolicyContextPayload;
  notification_category?: string;
  trigger_source?: string;
  relevance_confidence?: "high" | "medium" | "low" | "unknown";
  beach_confidence?: "high" | "medium" | "low" | "unknown";
  assumed_attendance?: false;
  attendance_confidence_score?: number;
  beach_confidence_score?: number;
  relevance_score?: number;
}

interface ForecastFeedbackNudgePayload {
  beach_id: string;
  beach_slug?: string;
  beach_name?: string;
  forecast_at?: string;
  deeplink?: string;
  notification_category?: string;
  trigger_source?: string;
  relevance_confidence?: "high" | "medium" | "low" | "unknown";
  beach_confidence?: "high" | "medium" | "low" | "unknown";
  assumed_attendance?: false;
  attendance_confidence_score?: number;
  beach_confidence_score?: number;
  relevance_score?: number;
}

interface HomeMorningCallPayload {
  alert_date: string;
  verdict: "YES" | "MAYBE" | "NO";
  beach_id: string;
  beach_name?: string;
  forecast_at?: string | null;
  policy_context?: PositiveRecommendationPolicyContextPayload;
  session_decision?: z.infer<typeof canonicalSessionDecisionSchema>;
  title: string;
  body: string;
}

interface WeekendWindowPayload {
  snapshot_id: string;
  weekend_start: string;
  weekend_end: string;
  qualifying_count: 1 | 2 | 3;
  lead_beach_id: string;
  lead_beach_name: string;
  lead_window_local: string;
}

type NotificationSimilarityMatchPayload = SimilarityMatchPayload & {
  policy_context?: PositiveRecommendationPolicyContextPayload;
  session_decision?: z.infer<typeof canonicalSessionDecisionSchema>;
};

interface WeeklyStreakReminderPayload {
  streak: number;
  period_key?: string;
  notification_category?: string;
  trigger_source?: string;
  relevance_confidence?: "high" | "medium" | "low" | "unknown";
  beach_confidence?: "high" | "medium" | "low" | "unknown";
  assumed_attendance?: false;
}

interface WaterQualityPayload {
  beach_id: string;
  beach_slug: string;
  beach_name: string;
  status: "good" | "advisory" | "closure" | "unknown";
  previous_status: "good" | "advisory" | "closure" | "unknown" | null;
  status_changed_at: string;
}

interface DailyDigestPayload {
  alert_date: string;
  title: string;
  body: string;
  match_count?: number;
  // Phase 5h: optional consolidated summaries
  forecast_summary?: {
    top_match: string;
    match_count: number;
  };
  water_quality_summary?: {
    advisory_count: number;
    closure_count: number;
  };
}

interface AdminTestPayload {
  title?: string;
  body?: string;
}

interface AdminBroadcastPayload {
  title: string;
  body: string;
  url?: string | null;
  data?: Record<string, string>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const NOTIFICATION_REGISTRY = {
  like: {
    type: "like",
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      // Settings UI presents "Likes" as a single notification-type toggle, not
      // a per-channel one — must gate both push and in_app, otherwise users
      // who turn off "Likes" still get inbox rows.
      perType: { push: "notif_likes", in_app: "notif_likes" },
    },
    suppressSelfNotify: true,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) => likeSchema.parse(input),
    buildPushPayload: (p, ctx) => {
      const liker = ctx.actor?.display_name || "Someone";
      return {
        title: `${liker} liked your session`,
        body: p.beach_name ?? "",
        data: {
          type: "like",
          session_id: p.session_id,
          liker_id: ctx.actorUserId,
        },
      };
    },
    buildInAppPayload: (p, ctx) => ({
      type: "like",
      data: { session_id: p.session_id, liker_id: ctx.actorUserId },
    }),
  } satisfies NotificationTypeDef<LikePayload>,

  follow: {
    type: "follow",
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      // Same rationale as `like` — single UI toggle gates both channels.
      perType: { push: "notif_follows", in_app: "notif_follows" },
    },
    suppressSelfNotify: true,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) => followSchema.parse(input) as FollowPayload,
    buildPushPayload: (_p, ctx) => {
      const follower = ctx.actor?.display_name || "Someone";
      return {
        title: `${follower} followed you`,
        body: "",
        data: {
          type: "follow",
          // Native tap-route navigates to UserProfile { userId } — see
          // quiver-native/src/lib/push-notifications.ts:105-133.
          user_id: ctx.actorUserId,
        },
      };
    },
    buildInAppPayload: (_p, ctx) => ({
      type: "follow",
      data: { follower_id: ctx.actorUserId },
    }),
  } satisfies NotificationTypeDef<FollowPayload>,

  forecast_alert: {
    type: "forecast_alert",
    // Restore push delivery for actionable surf windows. The same per-type
    // forecast-alert toggle gates both push and in-app so users never end up
    // with a push-only or inbox-only mismatch.
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      // Single UI toggle ("Forecast Alerts") gates both channels.
      perType: {
        push: "notif_forecast_alerts",
        in_app: "notif_forecast_alerts",
      },
    },
    suppressSelfNotify: false,
    surfAlertPriority: 3,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) =>
      forecastAlertSchema.parse(input) as ForecastAlertPayload,
    buildPushPayload: (p) => ({
      ...SURF_ALERT_PUSH_PRESENTATION,
      title: p.title,
      body: p.body,
      data: {
        type: "forecast_alert",
        utm_source: "quiver",
        utm_medium: "push",
        utm_campaign: "conditions_alert",
        email_type: "conditions_alert",
        alert_date: p.alert_date,
        ...(p.beach_id ? { beach_id: p.beach_id } : {}),
        ...(p.beach_slug ? { beach_slug: p.beach_slug } : {}),
        ...(p.forecast_at ? { forecast_at: p.forecast_at } : {}),
        ...(p.session_decision
          ? {
              decision_id: p.session_decision.decisionId,
              decision_verdict: p.session_decision.verdict,
            }
          : {}),
      },
    }),
    buildInAppPayload: (p) => ({
      type: "forecast_alert",
      data: {
        alert_date: p.alert_date,
        title: p.title,
        body: p.body,
        ...(p.beach_id ? { beach_id: p.beach_id } : {}),
        ...(p.beach_slug ? { beach_slug: p.beach_slug } : {}),
        ...(p.forecast_at ? { forecast_at: p.forecast_at } : {}),
        ...(p.session_decision ? { session_decision: p.session_decision } : {}),
      },
    }),
    /**
     * On terminal push outcomes only, reconcile per-rule rows into
     * alert_delivery_attempts so the condition-alert-deliver cron's cooldown
     * (`status='sent'`) and weekly-cap reads reflect actual worker delivery.
     *
     * Without this hook, the cron pre-wrote `status='sent'` at enqueue time —
     * which burns alert budget for users whose push then terminal-skipped on
     * `skipped_no_device` / `skipped_pref_master` / etc.
     */
    onChannelOutcome: async ({ supabase, event, channel, status }) => {
      if (channel !== "push") return;
      const queueItems = event.payload.queue_items ?? [];
      if (queueItems.length === 0) return;

      const mapped = mapWorkerStatusToAlertAttempt(status);
      if (!mapped) return;

      const rows = queueItems.map((qi) => ({
        queue_id: qi.queue_id,
        rule_id: qi.rule_id,
        user_id: event.recipient_user_id,
        channel: "push" as const,
        status: mapped,
        skip_reason: status,
      }));

      const { error } = await supabase
        .from("alert_delivery_attempts")
        .insert(rows);
      if (error) {
        console.error(
          `[notifications/forecast_alert.onChannelOutcome] alert_delivery_attempts insert failed for event ${event.id}:`,
          error,
        );
      }
    },
  } satisfies NotificationTypeDef<ForecastAlertPayload>,

  similarity_match: {
    type: "similarity_match",
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      // Single UI toggle gates both channels — auto-enabled for Pro users
      // via `notif_similarity_alerts` (default true). Settings UI presents
      // it as one switch so we never end up with inbox rows leaking past
      // a user who thought they'd disabled the entire feature.
      perType: {
        push: "notif_similarity_alerts",
        in_app: "notif_similarity_alerts",
      },
    },
    suppressSelfNotify: false,
    surfAlertPriority: 2,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) =>
      notificationSimilarityMatchSchema.parse(
        input,
      ) as NotificationSimilarityMatchPayload,
    buildPushPayload: (p) => {
      const waveWindow =
        p.wave_height_ft != null && p.wave_period_s != null && p.window_local
          ? `${p.wave_height_ft.toFixed(1)}ft @ ${p.wave_period_s.toFixed(0)}s · ${p.window_local}`
          : null;
      const contextDetails = [
        p.wind_direction && p.wind_speed_mph != null
          ? `${p.wind_direction} wind ${p.wind_speed_mph.toFixed(0)}mph`
          : null,
        p.tide_status ? `${p.tide_status} tide` : null,
        p.board_tip ?? p.setup_tip ?? null,
        p.reason || null,
      ].filter((detail): detail is string => Boolean(detail));
      const body = waveWindow
        ? [waveWindow, ...contextDetails.slice(0, 2)].join(" · ")
        : p.reason;

      return {
        ...SURF_ALERT_PUSH_PRESENTATION,
        title: p.session_decision
          ? `${
              p.session_decision.verdict === "go"
                ? "Go"
                : p.session_decision.verdict === "maybe"
                  ? "Maybe"
                  : "No"
            } ${p.beach_name}`
          : `${p.label ? `${p.label} ` : ""}match at ${p.beach_name}`.trim(),
        body,
        data: {
          type: "similarity_match",
          beach_id: p.beach_id,
          beach_slug: p.beach_slug,
          alert_date: p.alert_date,
          forecast_at: p.forecast_at,
          ...(p.session_decision
            ? {
                decision_id: p.session_decision.decisionId,
                decision_verdict: p.session_decision.verdict,
              }
            : {}),
        },
      };
    },
    buildInAppPayload: (p) => ({
      type: "similarity_match",
      data: {
        beach_id: p.beach_id,
        beach_slug: p.beach_slug,
        beach_name: p.beach_name,
        alert_date: p.alert_date,
        forecast_at: p.forecast_at,
        label: p.label ?? null,
        reason: p.reason,
        window_local: p.window_local,
        wave_height_ft: p.wave_height_ft,
        wave_period_s: p.wave_period_s,
        wind_speed_mph: p.wind_speed_mph,
        wind_direction: p.wind_direction,
        tide_height_ft: p.tide_height_ft,
        tide_status: p.tide_status,
        condition_summary: p.condition_summary,
        board_tip: p.board_tip,
        setup_tip: p.setup_tip,
        ...(p.session_decision ? { session_decision: p.session_decision } : {}),
      },
    }),
    /**
     * Mirrors forecast_alert's hook: on terminal push outcomes, fan out into
     * `alert_delivery_attempts` (one row per queue item) so the cron's
     * cooldown / weekly-cap reads (status='sent') reflect actual worker
     * delivery rather than enqueue-time optimism.
     */
    onChannelOutcome: async ({ supabase, event, channel, status }) => {
      if (channel !== "push") return;
      const queueItems = event.payload.queue_items ?? [];
      if (queueItems.length === 0) return;

      const mapped = mapWorkerStatusToAlertAttempt(status);
      if (!mapped) return;

      const rows = queueItems.map((qi) => ({
        queue_id: qi.queue_id,
        rule_id: qi.rule_id,
        user_id: event.recipient_user_id,
        channel: "push" as const,
        status: mapped,
        skip_reason: status,
      }));

      const { error } = await supabase
        .from("alert_delivery_attempts")
        .insert(rows);
      if (error) {
        console.error(
          `[notifications/similarity_match.onChannelOutcome] alert_delivery_attempts insert failed for event ${event.id}:`,
          error,
        );
      }
    },
  } satisfies NotificationTypeDef<NotificationSimilarityMatchPayload>,

  home_morning_call: {
    type: "home_morning_call",
    channels: ["push"],
    prefs: {
      master: { push: "notif_push_enabled" },
      perType: { push: "notif_reminders" },
    },
    suppressSelfNotify: false,
    surfAlertPriority: 1,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) => homeMorningCallSchema.parse(input),
    buildPushPayload: (p) => ({
      title: p.title,
      body: p.body,
      data: {
        type: "home_morning_call",
        beach_id: p.beach_id,
        alert_date: p.alert_date,
        verdict: p.verdict,
        ...(p.forecast_at ? { forecast_at: p.forecast_at } : {}),
      },
    }),
  } satisfies NotificationTypeDef<HomeMorningCallPayload>,

  weekend_window: {
    type: "weekend_window",
    channels: ["push"],
    prefs: {
      master: { push: "notif_push_enabled" },
      perType: { push: "notif_reminders" },
    },
    suppressSelfNotify: false,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) => weekendWindowSchema.parse(input),
    buildPushPayload: (p) => {
      const countLabel = p.qualifying_count === 1 ? "spot looks" : "spots look";
      return {
        ...SURF_ALERT_PUSH_PRESENTATION,
        title: `${p.qualifying_count} ${countLabel} promising this weekend`,
        body: `${p.lead_beach_name} leads ${p.lead_window_local}. See your top picks and why.`,
        data: {
          type: "weekend_window",
          snapshot_id: p.snapshot_id,
          weekend_start: p.weekend_start,
          weekend_end: p.weekend_end,
          qualifying_count: p.qualifying_count,
          lead_beach_id: p.lead_beach_id,
          lead_beach_name: p.lead_beach_name,
          lead_window_local: p.lead_window_local,
        },
      };
    },
  } satisfies NotificationTypeDef<WeekendWindowPayload>,

  swell_watch: {
    type: "swell_watch",
    // Contract capability remains available, but major-swell automation and
    // delivery are intentionally disabled for this rollout slice.
    channels: [],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      perType: {
        push: "notif_forecast_alerts",
        in_app: "notif_forecast_alerts",
      },
    },
    suppressSelfNotify: false,
    quietHours: DEFAULT_QUIET,
    cooldownMs: 96 * 60 * 60 * 1000,
    validatePayload: parseMajorSwellNotificationPayload,
    buildPushPayload: (p) => ({
      ...SURF_ALERT_PUSH_PRESENTATION,
      title: p.title,
      body: p.body,
      data: {
        type: "swell_watch",
        beach_id: p.beach_id,
        ...(p.beach_slug ? { beach_slug: p.beach_slug } : {}),
        ...(p.forecast_at ? { forecast_at: p.forecast_at } : {}),
        awareness_signal: p.awareness_signal,
        awareness_severity: p.awareness_severity,
      },
    }),
    buildInAppPayload: (p) => ({
      type: "swell_watch",
      data: {
        beach_id: p.beach_id,
        ...(p.beach_slug ? { beach_slug: p.beach_slug } : {}),
        beach_name: p.beach_name,
        event_start_date: p.event_start_date,
        peak_date: p.peak_date,
        peak_height_ft: p.peak_height_ft,
        peak_period_s: p.peak_period_s,
        forecast_at: p.forecast_at,
        awareness_signal: p.awareness_signal,
        awareness_severity: p.awareness_severity,
        title: p.title,
        body: p.body,
      },
    }),
  } satisfies NotificationTypeDef<MajorSwellNotificationPayload>,

  trial_ending: {
    type: "trial_ending",
    channels: ["push"],
    prefs: {
      master: { push: "notif_push_enabled" },
      perType: {},
    },
    suppressSelfNotify: false,
    // Producer cron runs at 9am PT — quiet-hour window not relevant.
    quietHours: NO_QUIET,
    validatePayload: (input) => trialEndingSchema.parse(input),
    buildPushPayload: (p) => ({
      title: p.title,
      body: p.body,
      data: { type: "trial_ending", trial_ends_at: p.trial_ends_at },
    }),
  } satisfies NotificationTypeDef<TrialEndingPayload>,

  log_session_nudge: {
    type: "log_session_nudge",
    channels: ["push"],
    prefs: {
      master: { push: "notif_push_enabled" },
      perType: {},
    },
    suppressSelfNotify: false,
    quietHours: NO_QUIET,
    validatePayload: (input) => logSessionNudgeSchema.parse(input),
    buildPushPayload: (p) => ({
      title: p.title,
      body: p.body,
      data: {
        type: "log_session_nudge",
        cohort: p.cohort,
        ...(p.beach_id ? { beach_id: p.beach_id } : {}),
        ...(p.beach_name ? { beach_name: p.beach_name } : {}),
        ...(p.notification_category
          ? { notification_category: p.notification_category }
          : {}),
        ...(p.trigger_source ? { trigger_source: p.trigger_source } : {}),
        ...(p.relevance_confidence
          ? { relevance_confidence: p.relevance_confidence }
          : {}),
        ...(p.beach_confidence ? { beach_confidence: p.beach_confidence } : {}),
        ...(p.assumed_attendance === false
          ? { assumed_attendance: false }
          : {}),
        ...(p.attendance_confidence_score == null
          ? {}
          : { attendance_confidence_score: p.attendance_confidence_score }),
        ...(p.beach_confidence_score == null
          ? {}
          : { beach_confidence_score: p.beach_confidence_score }),
        ...(p.relevance_score == null
          ? {}
          : { relevance_score: p.relevance_score }),
      },
    }),
  } satisfies NotificationTypeDef<LogSessionNudgePayload>,

  forecast_feedback_nudge: {
    type: "forecast_feedback_nudge",
    channels: ["push"],
    prefs: {
      master: { push: "notif_push_enabled" },
      perType: { push: "notif_reminders" },
    },
    suppressSelfNotify: false,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) => forecastFeedbackNudgeSchema.parse(input),
    buildPushPayload: (p) => {
      const highConfidence = isHighConfidenceNotification(
        p.relevance_confidence,
      );

      return {
        title:
          highConfidence && p.beach_name
            ? `Surfed ${p.beach_name} today?`
            : "Catch a session today?",
        body: highConfidence
          ? "Log it in one tap."
          : "If you paddle out, log it when you are done.",
        data: {
          type: "forecast_feedback_nudge",
          beach_id: p.beach_id,
          ...(p.beach_slug ? { beach_slug: p.beach_slug } : {}),
          ...(p.forecast_at ? { forecast_at: p.forecast_at } : {}),
          ...(p.deeplink ? { deeplink: p.deeplink } : {}),
          ...(p.notification_category
            ? { notification_category: p.notification_category }
            : {}),
          ...(p.trigger_source ? { trigger_source: p.trigger_source } : {}),
          ...(p.relevance_confidence
            ? { relevance_confidence: p.relevance_confidence }
            : {}),
          ...(p.beach_confidence
            ? { beach_confidence: p.beach_confidence }
            : {}),
          ...(p.assumed_attendance === false
            ? { assumed_attendance: false }
            : {}),
          ...(p.attendance_confidence_score == null
            ? {}
            : { attendance_confidence_score: p.attendance_confidence_score }),
          ...(p.beach_confidence_score == null
            ? {}
            : { beach_confidence_score: p.beach_confidence_score }),
          ...(p.relevance_score == null
            ? {}
            : { relevance_score: p.relevance_score }),
        },
      };
    },
  } satisfies NotificationTypeDef<ForecastFeedbackNudgePayload>,

  weekly_streak_reminder: {
    type: "weekly_streak_reminder",
    channels: ["push"],
    prefs: {
      master: { push: "notif_push_enabled" },
      perType: { push: "notif_reminders" },
    },
    suppressSelfNotify: false,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) => weeklyStreakReminderSchema.parse(input),
    buildPushPayload: (p) => ({
      title: "Keep your streak alive",
      body: `Your ${p.streak}-week streak ends Sunday. Log a session to keep it going.`,
      data: {
        type: "weekly_streak_reminder",
        streak: p.streak,
        ...(p.period_key ? { period_key: p.period_key } : {}),
        ...(p.notification_category
          ? { notification_category: p.notification_category }
          : {}),
        ...(p.trigger_source ? { trigger_source: p.trigger_source } : {}),
        ...(p.relevance_confidence
          ? { relevance_confidence: p.relevance_confidence }
          : {}),
        ...(p.beach_confidence ? { beach_confidence: p.beach_confidence } : {}),
        ...(p.assumed_attendance === false
          ? { assumed_attendance: false }
          : {}),
      },
    }),
  } satisfies NotificationTypeDef<WeeklyStreakReminderPayload>,

  water_quality: {
    type: "water_quality",
    // Water-quality status changes (advisory / closure / all-clear) are
    // actionable safety info, so they go out as push AND land in the in-app
    // inbox. The single "Water quality" Settings toggle (notif_water_quality)
    // gates both channels — same pattern as like/follow/forecast_alert — so a
    // user who turns it off never gets a push or an inbox row.
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      perType: { push: "notif_water_quality", in_app: "notif_water_quality" },
    },
    suppressSelfNotify: false,
    quietHours: DEFAULT_QUIET,
    validatePayload: (input) => waterQualitySchema.parse(input),
    buildPushPayload: (p) => {
      // Severity ordering: a closure is unambiguously more urgent than an
      // advisory, and an all-clear is reassuring. Recovery is detected via the
      // transition back to 'good' from a prior advisory/closure.
      const isRecovery =
        p.status === "good" &&
        (p.previous_status === "advisory" || p.previous_status === "closure");

      let title: string;
      let body: string;
      if (p.status === "closure") {
        title = `Beach closed: ${p.beach_name}`;
        body = "High bacteria levels. Don't enter the water.";
      } else if (p.status === "advisory") {
        title = `Water advisory: ${p.beach_name}`;
        body = "Elevated bacteria. Check before paddling out.";
      } else if (isRecovery) {
        title = `All clear: ${p.beach_name}`;
        body = "Water quality is back to safe levels.";
      } else {
        // 'good' with no prior advisory/closure, or 'unknown' — the producer
        // gates these out, but keep the payload safe if one slips through.
        title = `Water update: ${p.beach_name}`;
        body = "Water quality status updated.";
      }
      return {
        title,
        body,
        data: {
          type: "water_quality",
          beach_id: p.beach_id,
          beach_slug: p.beach_slug,
          status: p.status,
        },
      };
    },
    buildInAppPayload: (p) => ({
      // Existing legacy in-app rows use 'water_quality_alert' as `type` —
      // keep that to avoid breaking the inbox UI's filtering/icons.
      type: "water_quality_alert",
      data: {
        beach_id: p.beach_id,
        beach_slug: p.beach_slug,
        beach_name: p.beach_name,
        status: p.status,
        previous_status: p.previous_status,
        status_changed_at: p.status_changed_at,
      },
    }),
  } satisfies NotificationTypeDef<WaterQualityPayload>,

  daily_digest: {
    type: "daily_digest",
    // Daily digest is intentionally disabled. Existing legacy rows remain
    // schema-valid, but the worker will not deliver them on any channel.
    channels: [],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      perType: {},
    },
    suppressSelfNotify: false,
    quietHours: NO_QUIET,
    validatePayload: (input) => dailyDigestSchema.parse(input),
    buildPushPayload: (p) => {
      // Phase 5h: prefer consolidated summary copy when forecast/water-quality
      // summaries are present. Falls back to the producer-supplied title/body
      // (legacy / cron-not-yet-enriched path).
      let body = p.body;
      const wqs = p.water_quality_summary;
      if (wqs && (wqs.advisory_count > 0 || wqs.closure_count > 0)) {
        const parts: string[] = [];
        if (wqs.closure_count > 0) {
          parts.push(
            `${wqs.closure_count} closure${wqs.closure_count === 1 ? "" : "s"}`,
          );
        }
        if (wqs.advisory_count > 0) {
          parts.push(
            `${wqs.advisory_count} advisor${wqs.advisory_count === 1 ? "y" : "ies"}`,
          );
        }
        body = `${p.body} • Water quality: ${parts.join(" + ")}`;
      }
      return {
        title: p.title,
        body,
        data: { type: "daily_digest", alert_date: p.alert_date },
      };
    },
    buildInAppPayload: (p) => ({
      type: "daily_digest",
      data: {
        alert_date: p.alert_date,
        title: p.title,
        body: p.body,
        match_count: p.match_count ?? 0,
        ...(p.forecast_summary ? { forecast_summary: p.forecast_summary } : {}),
        ...(p.water_quality_summary
          ? { water_quality_summary: p.water_quality_summary }
          : {}),
      },
    }),
  } satisfies NotificationTypeDef<DailyDigestPayload>,

  admin_test: {
    type: "admin_test",
    channels: ["push"],
    prefs: {
      // Honors master push pref so admins can verify their own
      // notif_push_enabled toggle. No per-type gate — there's no Settings
      // toggle for "admin test pushes" and there shouldn't be.
      master: { push: "notif_push_enabled" },
      perType: {},
    },
    suppressSelfNotify: false,
    quietHours: NO_QUIET,
    validatePayload: (input) => adminTestSchema.parse(input),
    buildPushPayload: (p) => {
      const nowIso = new Date().toISOString();
      return {
        title: p.title ?? "Quiver Test Push",
        body:
          p.body ??
          `Test push sent at ${nowIso}. If you see this, FCM is working.`,
        data: { type: "admin_test", url: "/profile", sent_at: nowIso },
      };
    },
  } satisfies NotificationTypeDef<AdminTestPayload>,

  admin_broadcast: {
    type: "admin_broadcast",
    channels: ["push"],
    prefs: {
      // Honors master push pref. Bypasses per-type prefs (no per-type
      // Settings toggle) AND quiet hours (mode='bypass') because broadcasts
      // are emergency-class — outage notices, app-killer issues, etc.
      master: { push: "notif_push_enabled" },
      perType: {},
    },
    suppressSelfNotify: false,
    quietHours: { mode: "bypass" },
    validatePayload: (input) => adminBroadcastSchema.parse(input),
    buildPushPayload: (p) => ({
      title: p.title,
      body: p.body,
      data: {
        type: "admin_broadcast",
        ...(p.url ? { url: p.url } : {}),
        ...(p.data ?? {}),
      },
    }),
  } satisfies NotificationTypeDef<AdminBroadcastPayload>,
} as const;

export type NotificationType = keyof typeof NOTIFICATION_REGISTRY;

export function isKnownNotificationType(t: string): t is NotificationType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_REGISTRY, t);
}

export function getRegistryEntry(t: NotificationType): NotificationTypeDef {
  return NOTIFICATION_REGISTRY[t] as NotificationTypeDef;
}
