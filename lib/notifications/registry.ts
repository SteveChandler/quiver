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

import type { NotificationDeliveryStatus, NotificationTypeDef } from "./types";

/**
 * Map a worker's per-channel status onto the legacy alert_delivery_attempts
 * status enum. Returns null for non-terminal-or-irrelevant statuses (e.g.
 * skipped_quiet_hours — the next worker tick will produce the real outcome).
 */
function mapWorkerStatusToAlertAttempt(
  status: NotificationDeliveryStatus
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
    case "skipped_quiet_hours":
      return null;
    default:
      return null;
  }
}

// Default 10pm–4am local quiet hours. Overridden per-type below where the
// producer's existing semantics need different behavior (e.g. trial_ending
// runs at 9am PT and never needs nighttime suppression).
const DEFAULT_QUIET = { honor: true, windowStart: 22, windowEnd: 4 } as const;
const NO_QUIET = { honor: false } as const;

// ─── Payload shapes (what producers pass + what builders consume) ────────────

interface SessionInvitePayload {
  session_id: string;
  beach_name?: string | null;
  arrival_time?: string | null;
  message?: string | null;
}

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
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const NOTIFICATION_REGISTRY = {
  session_invite: {
    type: "session_invite",
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      perType: {
        push: "notif_session_invites",
        in_app: "inapp_session_invites",
      },
    },
    suppressSelfNotify: true,
    quietHours: DEFAULT_QUIET,
    buildPushPayload: (p, ctx) => {
      const inviter = ctx.actor?.display_name || "A surfer on Quiver";
      const where = p.beach_name ? ` to ${p.beach_name}` : "";
      const when = p.arrival_time
        ? ` • ${new Date(p.arrival_time).toLocaleString()}`
        : "";
      return {
        title: "New Surf Session Invite",
        body: `${inviter} invited you${where}${when}`,
        data: {
          type: "session_invite",
          session_id: p.session_id,
          message: p.message ?? "",
        },
      };
    },
    buildInAppPayload: (p, ctx) => ({
      type: "session_invite",
      data: {
        session_id: p.session_id,
        inviter_id: ctx.actorUserId,
        beach_name: p.beach_name ?? null,
        arrival_time: p.arrival_time ?? null,
        message: p.message ?? null,
      },
    }),
  } satisfies NotificationTypeDef<SessionInvitePayload>,

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
    quietHours: DEFAULT_QUIET,
    buildPushPayload: (p) => ({
      title: p.title,
      body: p.body,
      data: {
        type: "forecast_alert",
        alert_date: p.alert_date,
        ...(p.beach_id ? { beach_id: p.beach_id } : {}),
        ...(p.beach_slug ? { beach_slug: p.beach_slug } : {}),
      },
    }),
    buildInAppPayload: (p) => ({
      type: "forecast_alert",
      data: {
        alert_date: p.alert_date,
        title: p.title,
        body: p.body,
        ...(p.matches ? { matches: p.matches } : {}),
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
          error
        );
      }
    },
  } satisfies NotificationTypeDef<ForecastAlertPayload>,

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
    buildPushPayload: (p) => ({
      title: p.title,
      body: p.body,
      data: {
        type: "log_session_nudge",
        cohort: p.cohort,
        ...(p.beach_id ? { beach_id: p.beach_id } : {}),
      },
    }),
  } satisfies NotificationTypeDef<LogSessionNudgePayload>,

  water_quality: {
    type: "water_quality",
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      perType: { push: "notif_water_quality", in_app: "notif_water_quality" },
    },
    suppressSelfNotify: false,
    quietHours: DEFAULT_QUIET,
    buildPushPayload: (p) => {
      const isAdvisory = p.status === "advisory" || p.status === "closure";
      const title = isAdvisory
        ? `Advisory: ${p.beach_name}`
        : `All clear: ${p.beach_name}`;
      const body = isAdvisory
        ? "Water quality has dropped. Check before paddling out."
        : "Water quality is back to good.";
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
    channels: ["push", "in_app"],
    prefs: {
      master: { push: "notif_push_enabled", in_app: "notif_inapp_enabled" },
      perType: {},
    },
    suppressSelfNotify: false,
    quietHours: NO_QUIET,
    buildPushPayload: (p) => ({
      title: p.title,
      body: p.body,
      data: { type: "daily_digest", alert_date: p.alert_date },
    }),
    buildInAppPayload: (p) => ({
      type: "daily_digest",
      data: {
        alert_date: p.alert_date,
        title: p.title,
        body: p.body,
        match_count: p.match_count ?? 0,
      },
    }),
  } satisfies NotificationTypeDef<DailyDigestPayload>,
} as const;

export type NotificationType = keyof typeof NOTIFICATION_REGISTRY;

export function isKnownNotificationType(t: string): t is NotificationType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_REGISTRY, t);
}

export function getRegistryEntry(t: NotificationType): NotificationTypeDef {
  return NOTIFICATION_REGISTRY[t] as NotificationTypeDef;
}
