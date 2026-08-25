/**
 * Shared types for the centralized notification pipeline.
 *
 * Mirrors the SQL CHECK constraints in:
 *   - 20260429231445_create_notification_events.sql
 *   - 20260429231446_create_notification_delivery_attempts.sql
 *
 * The registry (registry.ts) is the runtime source of truth for type names;
 * the SQL `type` column intentionally has no CHECK so adding a new type
 * doesn't require a migration.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

export type ProfilePrefColumn = Extract<
  keyof Database["public"]["Tables"]["profiles"]["Row"],
  | "notif_push_enabled"
  | "notif_email_enabled"
  | "notif_inapp_enabled"
  | "notif_likes"
  | "notif_follows"
  | "notif_reminders"
  | "notif_xp_updates"
  | "notif_forecast_alerts"
  | "notif_water_quality"
  | "notif_similarity_alerts"
>;

export type NotificationChannel = "push" | "in_app" | "email";

/**
 * Phase 5a: event-level outcomes only. Channel-level skips moved to
 * NotificationDeliveryStatus. The legacy 'skipped' value has been backfilled
 * to 'processed' in the migration; new code should never write it.
 */
export type NotificationEventStatus =
  | "pending"
  | "processing"
  | "processed"
  | "failed"
  | "cancelled";

/**
 * Phase 5a: `skipped_quiet_hours` was renamed to `deferred_quiet_hours` to
 * make its retryable nature explicit. `skipped_cooldown` is a new terminal
 * skip emitted when the registry's per-type cooldownMs window has not
 * elapsed since the last successful send to this recipient.
 */
export type NotificationDeliveryStatus =
  | "sent"
  | "skipped_no_device"
  | "skipped_pref_master"
  | "skipped_pref_type"
  | "skipped_self"
  | "skipped_dedup"
  | "skipped_disabled"
  | "skipped_cooldown"
  | "deferred_quiet_hours"
  | "failed_provider"
  | "failed_internal";

/**
 * Phase 5d: first-class quiet-hours policy. The legacy `{ honor: bool }` shape
 * is replaced with an explicit mode so registry entries name their intent:
 *   - `ignore`: type doesn't care about quiet hours (e.g. cron-timed types
 *     that already fire at fixed daytime hours — declaring this is honest).
 *   - `defer`: respect the window; defer delivery until the window ends.
 *   - `bypass`: emergency-class — always send, even at 3am (admin_broadcast).
 */
export interface QuietHoursConfig {
  mode: "ignore" | "defer" | "bypass";
  /** Local hour (0–23) when quiet hours start. Inclusive. Required when mode='defer'. */
  windowStart?: number;
  /** Local hour (0–23) when quiet hours end. Exclusive. Wraps midnight. Required when mode='defer'. */
  windowEnd?: number;
}

export interface NotificationPushPayload {
  title: string;
  body: string;
  /** FCM data fields are stringified at send-time; values can be any JSON-serializable. */
  data: Record<string, unknown>;
  /** Bundled iOS/Expo sound file for notification presentation. */
  iosSound?: string;
  /** Immutable Android notification channel configured by the native app. */
  androidChannelId?: string;
}

export interface NotificationInAppPayload {
  /** Type string written to the `notifications` table. May differ from the
   *  registry key if the legacy in-app `type` CHECK constraint demands it. */
  type: string;
  data: Record<string, unknown>;
}

/** Recipient context the worker fetches once per event and passes to builders. */
export interface BuildCtx {
  recipientUserId: string;
  actorUserId: string | null;
  recipient: {
    display_name: string | null;
    timezone: string | null;
  };
  /** The actor's profile, only loaded if the type might reference it (most do). */
  actor: {
    display_name: string | null;
  } | null;
}

export interface OnChannelOutcomeArgs<P = Record<string, unknown>> {
  supabase: SupabaseClient<Database>;
  event: {
    id: string;
    recipient_user_id: string;
    actor_user_id: string | null;
    type: string;
    entity_type: string | null;
    entity_id: string | null;
    payload: P;
    created_at: string;
  };
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
}

export interface NotificationTypeDef<P = Record<string, unknown>> {
  /** Stable string key used by producers and stored in `notification_events.type`. */
  type: string;
  channels: NotificationChannel[];
  prefs: {
    /** Required master gate per channel — recipient.profile[col] === false suppresses. */
    master: Partial<Record<NotificationChannel, ProfilePrefColumn>>;
    /** Optional per-type gate per channel. */
    perType: Partial<Record<NotificationChannel, ProfilePrefColumn>>;
  };
  /** Skip when actor === recipient. Default true for social types. */
  suppressSelfNotify: boolean;
  /**
   * Priority within the one-alert-per-user/beach/day surf slot. Surf alerts
   * wait briefly at enqueue time so a higher-priority source can replace a
   * lower-priority event before either is delivered.
   */
  surfAlertPriority?: 1 | 2 | 3;
  quietHours: QuietHoursConfig;
  /**
   * Phase 5e: validate (and parse) the producer-supplied payload at enqueue
   * time. Throw on shape mismatch — `enqueueNotification` catches and returns
   * `{ enqueued: false, reason: "invalid_payload" }`. Recommended: a Zod
   * schema's `.parse`. Returning the validated payload lets builders rely
   * on the parsed shape downstream.
   */
  validatePayload?: (input: unknown) => P;
  /**
   * Phase 5e: per-type minimum interval between SUCCESSFUL push deliveries to
   * the same recipient. Querying `notification_delivery_attempts` for the
   * last `sent` push within this window — if found, the worker emits
   * `skipped_cooldown`. NULL = no cooldown (default). Distinct from producer
   * dedupe_key (which prevents duplicate active events).
   */
  cooldownMs?: number | ((payload: P) => number);
  /** Optional scope within a notification type, such as watched update category. */
  cooldownKey?: (payload: P) => string | null;
  /**
   * Phase 5e: per-type override for the global per-channel retry cap.
   * Default 3. Rarely needed — set higher for types where transient
   * delivery failures are tolerable (e.g. analytics).
   */
  maxAttempts?: number;
  buildPushPayload?: (payload: P, ctx: BuildCtx) => NotificationPushPayload;
  buildInAppPayload?: (payload: P, ctx: BuildCtx) => NotificationInAppPayload;
  /**
   * Optional hook the worker fires after writing a notification_delivery_attempts
   * row. Called for every status EXCEPT `deferred_quiet_hours` (which is a "try
   * later" state, not an outcome). Used by types that need to reconcile their
   * own bookkeeping tables (e.g. forecast_alert writes per-rule rows to
   * alert_delivery_attempts).
   *
   * Errors thrown by the hook are logged but do not roll back the channel
   * dispatch — observability bookkeeping must not break delivery.
   */
  onChannelOutcome?: (args: OnChannelOutcomeArgs<P>) => Promise<void>;
}

export interface EnqueueArgs<P = Record<string, unknown>> {
  type: string;
  recipientUserId: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: P;
  /**
   * Producer-supplied idempotency key. The partial unique index on
   * (recipient_user_id, type, dedupe_key) blocks a duplicate insert when
   * non-null. There is NO automatic derivation — if you omit this, the row
   * inserts unconditionally and the producer is responsible for any other
   * idempotency story it needs.
   *
   * Recommended shapes (mirrored in registry comments):
   *   like:           `like:${session_id}:${actor_user_id}`
   *                   (intentionally permanent — re-clicking a like should not
   *                   re-notify the recipient)
   *   follow:         `follow:${actor_user_id}:${recipient_user_id}:${YYYY-WW}`
   *                   (weekly bucket — re-engagement after a week re-notifies)
   *   forecast_alert: `forecast_alert:${recipient_user_id}:${alert_date}`
   *   water_quality:  `water_quality:${recipient_user_id}:${beach_id}:${date}`
   *   daily_digest:   `daily_digest:${recipient_user_id}:${alert_date}`
   *   trial_ending:   `trial_ending:${recipient_user_id}:${trial_ends_at}`
   *   log_session_nudge: `log_session_nudge:${recipient_user_id}:${cohort}`
   */
  dedupeKey?: string | null;
}

export type EnqueueResult =
  | { enqueued: true; eventId: string }
  | {
      enqueued: false;
      reason:
        | "duplicate"
        | "unknown_type"
        | "internal_error"
        | "invalid_payload";
      message?: string;
    };
