/**
 * Notification delivery worker.
 *
 * Pulls pending events from `notification_events`, applies preferences /
 * self-suppress / quiet-hours, dispatches push (FCM) and in-app (`notifications`
 * table inserts), and writes per-channel outcome rows to
 * `notification_delivery_attempts`.
 *
 * Pure function — the cron route in `app/api/cron/notifications-deliver/`
 * wires this up under `withCronObservability`.
 *
 * ## Per-channel retry model
 *
 * Each channel reaches one of three states per event:
 *
 *   - **terminal-success**: a `sent` attempt exists. Channel is done.
 *   - **terminal-skipped**: a decisive skip (`skipped_pref_master`,
 *     `skipped_pref_type`, `skipped_self`, `skipped_no_device`,
 *     `skipped_dedup`). The decision was "don't send" rather than "couldn't
 *     send" — we don't retry. Channel is done.
 *   - **retryable**: `failed_provider`, `failed_internal`, or
 *     `deferred_quiet_hours` (re-evaluate next tick when out of window). The
 *     event stays `pending` until the channel either succeeds, decisively
 *     skips, or hits MAX_FAILED_ATTEMPTS_PER_CHANNEL.
 *
 * The event is marked terminal (`processed`/`skipped`/`failed`) only once
 * every channel reaches a terminal state. Already-sent channels are NOT
 * re-dispatched on retry ticks — the worker reads existing
 * `notification_delivery_attempts` for each event and short-circuits
 * channels that are already terminal.
 *
 * ## Concurrency (Phase 5b — atomic claim)
 *
 * Each tick generates a unique `claim_token` UUID and calls the
 * `claim_notification_events` Postgres function, which uses
 * `FOR UPDATE SKIP LOCKED` inside a CTE to atomically claim a batch:
 *
 *   - Eligible: status='pending' OR (status='processing' AND claimed_at older
 *     than the lease) AND (next_attempt_at NULL or in the past).
 *   - The function transitions claimed rows from `pending` → `processing`
 *     with the caller's `claim_token`, increments `attempt_count`, and sets
 *     `last_attempt_at`.
 *   - SKIP LOCKED means parallel workers always claim disjoint sets — no
 *     row is double-dispatched even if Vercel runs two instances.
 *
 * Subsequent terminal-status writes (`markEventTerminal`) and lease releases
 * (`releaseClaims`) include `WHERE claim_token = $own` so a stale worker
 * (whose lease was reclaimed by a fresh tick) can't overwrite fresh progress.
 *
 * If a worker crashes mid-tick, its claim becomes reclaimable after
 * `CLAIM_STALE_AFTER_MS` (5 min). Events that stay pending for retry have
 * their lease explicitly released at the end of the tick (status →
 * `pending`, claim_token NULL, claimed_at NULL) so the next tick can
 * re-claim immediately.
 *
 * ## Dedupe
 *
 * Enqueue-time only, via the partial unique index on `notification_events`.
 * The worker does NOT do windowed re-suppression. See registry.ts for the
 * dedupe-key recipe per type.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 2a + review fixes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Database, Json } from "@/types/database.generated";
import {
  getRegistryEntry,
  isKnownNotificationType,
  type NotificationType,
} from "./registry";
import type {
  BuildCtx,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationTypeDef,
} from "./types";
import type {
  NotificationEventRow,
  NotificationDeliveryAttemptInsert,
  NotificationDeliveryAttemptRow,
} from "./db-augment";
import { getFirebaseAdminMessaging } from "@/lib/services/firebase-admin";
import {
  dispatchPushMessages,
  type PushMessage,
  type PushDeliveryOutcome,
} from "@/lib/services/push-delivery";
import { capturePostHogEvent } from "@/lib/posthog-server";
import { getLocalHour } from "@/lib/utils/timezone-utils";
import {
  getQuietWindowEnd,
  isInQuietWindow,
  resolveNotificationTimezone,
} from "@/lib/notifications/quiet-hours";
import type { messaging as fbMessaging } from "firebase-admin";
import {
  resolveNotificationMajorEventHold,
  type NotificationMajorEventHoldResult,
  type ResolveNotificationMajorEventHoldInput,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import { resolveNotificationPresentationCompatibility } from "./build-compatibility";

type ServiceClient = SupabaseClient<Database>;
type FcmMessaging = fbMessaging.Messaging | null;

const DEFAULT_BATCH_SIZE = 50;
const MAX_FAILED_ATTEMPTS_PER_CHANNEL = 3;
/**
 * How long a worker's claim on an event is considered authoritative. After
 * this many ms, the row is treated as abandoned (presumably the worker
 * crashed) and may be reclaimed by another tick.
 */
const CLAIM_STALE_AFTER_MS = 5 * 60 * 1000;
const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

// Statuses that mean "channel is done, do not retry".
const TERMINAL_SKIP_STATUSES = new Set<NotificationDeliveryStatus>([
  "skipped_pref_master",
  "skipped_pref_type",
  "skipped_self",
  "skipped_no_device",
  "skipped_dedup",
  "skipped_disabled",
  "skipped_cooldown",
]);

// Statuses that count toward the per-channel failure cap.
const FAILURE_STATUSES = new Set<NotificationDeliveryStatus>([
  "failed_provider",
  "failed_internal",
]);

/**
 * Phase 5c: backoff schedule for retryable channel failures. Indexed by
 * the event's `attempt_count` after this tick:
 *   1 → 60s, 2 → 5min, 3+ → 30min
 * Quiet-hours defers don't use this — they just leave next_attempt_at NULL
 * so the next tick can re-evaluate the quiet window immediately.
 */
function backoffFor(attemptCount: number): number {
  if (attemptCount <= 1) return 60_000;
  if (attemptCount === 2) return 5 * 60_000;
  return 30 * 60_000;
}

function earliestDate(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return dates.reduce((earliest, date) =>
    date.getTime() < earliest.getTime() ? date : earliest,
  );
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  timezone: string | null;
  experience_level: string | null;
  allow_implicit_tracking: boolean;
  notif_push_enabled: boolean;
  notif_email_enabled: boolean;
  notif_inapp_enabled: boolean;
  notif_likes: boolean;
  notif_follows: boolean;
  notif_reminders: boolean;
  notif_xp_updates: boolean;
  notif_forecast_alerts: boolean;
  notif_water_quality: boolean;
  notif_similarity_alerts: boolean;
}

interface DeviceRow {
  id: string;
  device_token: string;
  installation_id: string | null;
  retired_at: string | null;
  platform: string | null;
  app_version: string | null;
  build_number: string | null;
  delivery_claim_id?: string;
  delivery_claim_version?: number;
}

export interface ProcessOptions {
  batchSize?: number;
  /** Override "now" for deterministic testing. */
  now?: Date;
  /** Pre-resolved FCM messaging client. If undefined, looked up lazily. */
  fcm?: FcmMessaging;
  /** Override the last-mile safety resolver for deterministic tests. */
  resolveMajorEventHold?: NotificationMajorEventHoldResolver;
}

export type NotificationMajorEventHoldResolver = (
  input: ResolveNotificationMajorEventHoldInput,
) => Promise<NotificationMajorEventHoldResult>;

export interface ProcessSummary {
  fetched: number;
  /** Events finalized this tick, including decisive all-skip cancellations. */
  processed: number;
  /**
   * Retained for backwards-compat with dashboards. Phase 5a removed `skipped`
   * as an event-level status (skips are channel-level), so this counter now
   * tracks events whose channels were ALL terminal-skips. The event row is
   * normally `processed`; arbitration and safety cancellations remain `cancelled`.
   */
  skipped: number;
  /** Events that reached terminal `failed` this tick (retry exhausted or fatal). */
  failed: number;
  /** Events still `pending` after this tick (will retry next tick). */
  pending_after_run: number;
  firebase_configured: boolean;
  by_status: Partial<Record<NotificationDeliveryStatus, number>>;
  /**
   * Phase 5m: events deferred this tick due to quiet hours (will retry when
   * the window ends). Subset of pending_after_run, broken out so dashboards
   * can distinguish "respecting user preferences" from "broken / retrying".
   */
  deferred_quiet_hours_count: number;
  /**
   * Phase 5m: events scheduled for backoff retry this tick (failed_provider
   * / failed_internal below the per-channel cap). Subset of pending_after_run.
   * Different from deferred_quiet_hours_count: these are unhealthy paths.
   */
  retry_scheduled_count: number;
  /**
   * Phase 5m: events terminal-failed because the registry doesn't recognize
   * their type. Should be 0 in steady-state. Non-zero indicates a stale
   * producer or a missing registry entry — page on it.
   */
  unknown_type_count: number;
  /**
   * Phase 5m: events whose recipient lacks a `profiles.timezone`. Quiet-hours
   * defer falls back to UTC for these — fine in the short term but indicates
   * a sign-up flow gap. Tracked so we can fix the source instead of papering
   * over with UTC-default forever.
   */
  missing_timezone_count: number;
  /**
   * Privacy-safe per-device presentation decisions. Keys include only coarse
   * platform, outcome, and reason — never device tokens, event IDs, or users.
   */
  presentation_compatibility: Record<string, number>;
}

/** Per-channel decision rolled up at the end of one tick. */
type ChannelOutcome = "sent" | "skipped" | "failed" | "pending";

interface ChannelDecision {
  status: NotificationDeliveryStatus;
  providerResponse?: Json | null;
  errorMessage?: string | null;
  nextAttemptAt?: Date | null;
  cancelEventReason?: string | null;
}

type SurfAlertCandidate = {
  id: string;
  type: string;
  recipient_user_id: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
};

interface SurfAlertSlot {
  beachId: string;
  alertDate: string;
  priority: 1 | 2 | 3;
}

export function getSurfAlertSlot(
  event: SurfAlertCandidate,
): SurfAlertSlot | null {
  if (!isKnownNotificationType(event.type)) return null;

  const priority = getRegistryEntry(event.type).surfAlertPriority;
  const alertDate =
    typeof event.payload.alert_date === "string"
      ? event.payload.alert_date
      : null;
  const beachId =
    event.entity_id ??
    (typeof event.payload.beach_id === "string"
      ? event.payload.beach_id
      : null);

  if (
    !priority ||
    !alertDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(alertDate) ||
    !beachId
  ) {
    return null;
  }

  return { beachId, alertDate, priority };
}

/** Selects the preferred candidate per slot and priority-orders its fallbacks. */
export function selectSurfAlertWinners<T extends SurfAlertCandidate>(
  events: T[],
): {
  winners: T[];
  redundant: T[];
} {
  const winners: T[] = [];
  const redundant: T[] = [];
  const bySlot = new Map<string, T>();

  for (const event of events) {
    const slot = getSurfAlertSlot(event);
    if (!slot) {
      winners.push(event);
      continue;
    }

    const key = `${event.recipient_user_id}:${slot.beachId}:${slot.alertDate}`;
    const existing = bySlot.get(key);
    if (!existing) {
      bySlot.set(key, event);
      winners.push(event);
      continue;
    }
    const existingSlot = getSurfAlertSlot(existing);
    if (existingSlot && slot.priority > existingSlot.priority) {
      bySlot.set(key, event);
      winners.splice(winners.indexOf(existing), 1, event);
      redundant.push(existing);
    } else {
      redundant.push(event);
    }
  }
  redundant.sort((a, b) => {
    const aPriority = getSurfAlertSlot(a)?.priority ?? 0;
    const bPriority = getSurfAlertSlot(b)?.priority ?? 0;
    return bPriority - aPriority;
  });
  return { winners, redundant };
}

function channelDecision(
  status: NotificationDeliveryStatus,
  details: Omit<ChannelDecision, "status"> = {},
): ChannelDecision {
  return { status, ...details };
}

// ─── Public entrypoint ───────────────────────────────────────────────────────

export async function processPendingEvents(
  supabase: ServiceClient,
  opts: ProcessOptions = {},
): Promise<ProcessSummary> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = opts.now ?? new Date();
  const fcm = opts.fcm !== undefined ? opts.fcm : getFirebaseAdminMessaging();
  const resolveMajorEventHold =
    opts.resolveMajorEventHold ?? resolveNotificationMajorEventHold;
  const majorEventHoldAsOf = opts.now;

  const summary: ProcessSummary = {
    fetched: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    pending_after_run: 0,
    firebase_configured: fcm !== null,
    by_status: {},
    deferred_quiet_hours_count: 0,
    retry_scheduled_count: 0,
    unknown_type_count: 0,
    missing_timezone_count: 0,
    presentation_compatibility: {},
  };

  // Each tick gets a unique claim_token. Workers write terminal status only
  // WHERE claim_token = $own — defends against a stale worker (whose lease
  // was reclaimed by a fresh tick) overwriting fresh progress.
  const claimToken = crypto.randomUUID();

  // Surfacing a fetch error is critical: a silent empty-array return would
  // make a broken cron look identical to a healthy idle tick. Throwing here
  // lets `withCronObservability` mark the run status='error'.
  const events = await claimPendingEvents(supabase, batchSize, claimToken);
  summary.fetched = events.length;
  if (events.length === 0) return summary;

  const arbitration = selectSurfAlertWinners(
    events.map((event) => ({
      ...event,
      payload: event.payload as Record<string, unknown>,
    })),
  );
  // Evaluate the preferred candidate first, but do not cancel fallbacks until
  // the winner reaches the actual push boundary. A disabled forecast alert
  // must not suppress an enabled morning call for the same beach and day.
  const dispatchEvents = [
    ...arbitration.winners,
    ...arbitration.redundant,
  ] as NotificationEventRow[];

  const priorAttempts = await loadAttemptsForEvents(
    supabase,
    dispatchEvents.map((e) => e.id),
  );

  // Track events that stay pending after the tick so we can release their
  // claim and let the next tick retry. Phase 5c: nextAttemptAt is also
  // captured so we can space out retries with backoff (1m/5m/30m) instead
  // of hammering FCM every minute on transient failures.
  const pendingReleases: Array<{
    eventId: string;
    nextAttemptAt: Date | null;
  }> = [];

  for (const event of dispatchEvents) {
    const eventAttempts = priorAttempts.get(event.id) ?? [];
    try {
      const result = await processOne(
        supabase,
        fcm,
        event,
        eventAttempts,
        now,
        summary,
        claimToken,
        resolveMajorEventHold,
        majorEventHoldAsOf,
      );
      tallyOutcome(summary, result.outcome);
      if (result.outcome === "pending") {
        pendingReleases.push({
          eventId: event.id,
          nextAttemptAt: result.nextAttemptAt,
        });
      }
    } catch (err) {
      // Truly unexpected error (not a planned failure path) — leave the
      // event pending so the next tick retries. We do NOT mark the event
      // failed here because the failure may be transient (DB blip, network).
      console.error(
        `[notifications/worker] uncaught error processing event ${event.id}:`,
        err,
      );
      summary.pending_after_run++;
      // Unknown failure mode — schedule a backoff to avoid tight retry loop.
      pendingReleases.push({
        eventId: event.id,
        nextAttemptAt: new Date(
          now.getTime() + backoffFor(event.attempt_count),
        ),
      });
    }
  }

  await releaseClaims(supabase, pendingReleases, claimToken);

  return summary;
}

function tallyOutcome(
  summary: ProcessSummary,
  outcome: ProcessOneOutcome,
): void {
  if (outcome === "processed") summary.processed++;
  else if (outcome === "all-skipped") {
    summary.processed++;
    summary.skipped++;
  } else if (outcome === "failed") summary.failed++;
  else summary.pending_after_run++;
}

/**
 * Event-level outcome of one tick's pass over an event.
 *   - processed: at least one channel was sent and the event finalized
 *   - all-skipped: every channel was a terminal skip (processed or cancelled)
 *   - failed: at least one required channel exhausted retries
 *   - pending: at least one channel is retryable; revisit next tick
 */
type ProcessOneOutcome = "processed" | "all-skipped" | "failed" | "pending";

/**
 * processOne result. `nextAttemptAt` is only meaningful when outcome='pending'
 * — Phase 5c uses it to space out retries so transient FCM failures don't
 * hammer the provider every minute.
 */
interface ProcessOneResult {
  outcome: ProcessOneOutcome;
  /** When to re-claim. NULL = immediate (next tick). Date = future. */
  nextAttemptAt: Date | null;
}

// ─── Per-event pipeline ──────────────────────────────────────────────────────

async function processOne(
  supabase: ServiceClient,
  fcm: FcmMessaging,
  event: NotificationEventRow,
  priorAttempts: NotificationDeliveryAttemptRow[],
  now: Date,
  summary: ProcessSummary,
  claimToken: string,
  resolveMajorEventHold: NotificationMajorEventHoldResolver,
  majorEventHoldAsOf: Date | undefined,
): Promise<ProcessOneResult> {
  if (!isKnownNotificationType(event.type)) {
    summary.unknown_type_count++;
    await markEventTerminal(
      supabase,
      event.id,
      "failed",
      "unknown_type",
      claimToken,
    );
    return { outcome: "failed", nextAttemptAt: null };
  }
  const def = getRegistryEntry(event.type as NotificationType);
  const surfAlertSlot = getSurfAlertSlot({
    id: event.id,
    type: event.type,
    recipient_user_id: event.recipient_user_id,
    entity_id: event.entity_id,
    payload: event.payload as Record<string, unknown>,
  });

  // Profile lookup distinguishes "row missing" (terminal failure) from
  // "query errored" (transient — leave pending so next tick can retry).
  let profile: ProfileRow | null;
  try {
    profile = await loadProfile(supabase, event.recipient_user_id);
  } catch (err) {
    console.error(
      `[notifications/worker] profile query errored for event ${event.id}:`,
      err,
    );
    // Transient lookup failure — backoff before next tick to avoid hammering.
    return {
      outcome: "pending",
      nextAttemptAt: new Date(now.getTime() + backoffFor(event.attempt_count)),
    };
  }
  if (!profile) {
    await markEventTerminal(
      supabase,
      event.id,
      "failed",
      "recipient_profile_missing",
      claimToken,
    );
    return { outcome: "failed", nextAttemptAt: null };
  }

  let actor: { id: string; display_name: string | null } | null = null;
  if (event.actor_user_id) {
    try {
      actor = await loadActorProfile(supabase, event.actor_user_id);
    } catch (err) {
      console.error(
        `[notifications/worker] actor query errored for event ${event.id}:`,
        err,
      );
      return {
        outcome: "pending",
        nextAttemptAt: new Date(
          now.getTime() + backoffFor(event.attempt_count),
        ),
      };
    }
  }

  // Phase 5m: tally missing timezones at most once per event. Recipients
  // without a timezone fall back to UTC for quiet-hours math, which is
  // wrong for non-UTC users — count so we can fix the source instead of
  // papering over with a UTC default forever.
  if (!profile.timezone) {
    summary.missing_timezone_count++;
  }

  const ctx: BuildCtx = {
    recipientUserId: event.recipient_user_id,
    actorUserId: event.actor_user_id,
    recipient: {
      display_name: profile.display_name,
      timezone: profile.timezone,
    },
    actor: actor ? { display_name: actor.display_name } : null,
  };

  const attemptsByChannel = groupAttemptsByChannel(priorAttempts);
  const newAttempts: NotificationDeliveryAttemptInsert[] = [];
  const quietHoursRetryTimes: Date[] = [];
  const channelOutcomes = new Map<NotificationChannel, ChannelOutcome>();
  let hasSentDelivery = priorAttempts.some(
    (attempt) => attempt.status === "sent",
  );
  let surfAlertRejected = false;
  let terminalCancellationReason: string | null = null;

  for (const channel of def.channels) {
    const prior = attemptsByChannel.get(channel) ?? [];

    // Already terminal? Don't re-dispatch.
    const terminal = priorTerminalOutcome(prior);
    if (terminal) {
      channelOutcomes.set(channel, terminal);
      continue;
    }

    // Retry cap reached? Stop trying — channel is permanently failed.
    const failureCount = prior.filter((a) =>
      FAILURE_STATUSES.has(a.status),
    ).length;
    if (failureCount >= MAX_FAILED_ATTEMPTS_PER_CHANNEL) {
      channelOutcomes.set(channel, "failed");
      continue;
    }

    const decision = await processChannel(
      supabase,
      fcm,
      event,
      def,
      profile,
      ctx,
      channel,
      now,
      summary.presentation_compatibility,
      surfAlertSlot,
      resolveMajorEventHold,
      majorEventHoldAsOf,
    );
    const { status } = decision;

    newAttempts.push({
      notification_event_id: event.id,
      channel,
      status,
      provider_response: decision.providerResponse ?? null,
      error_message: decision.errorMessage ?? null,
    });
    if (status === "deferred_quiet_hours" && decision.nextAttemptAt) {
      quietHoursRetryTimes.push(decision.nextAttemptAt);
    }
    summary.by_status[status] = (summary.by_status[status] ?? 0) + 1;

    // Type-specific reconciliation hook (e.g. forecast_alert -> alert_delivery_attempts).
    // Skip for deferred_quiet_hours (non-terminal — try later, no audit row yet).
    if (def.onChannelOutcome && status !== "deferred_quiet_hours") {
      try {
        await def.onChannelOutcome({
          supabase: supabase as unknown as Parameters<
            NonNullable<NotificationTypeDef["onChannelOutcome"]>
          >[0]["supabase"],
          event: {
            id: event.id,
            recipient_user_id: event.recipient_user_id,
            actor_user_id: event.actor_user_id,
            type: event.type,
            entity_type: event.entity_type,
            entity_id: event.entity_id,
            payload: (event.payload ?? {}) as Record<string, unknown>,
            created_at: event.created_at,
          },
          channel,
          status,
        });
      } catch (err) {
        console.error(
          `[notifications/worker] onChannelOutcome hook threw for event ${event.id} (${event.type}/${channel}):`,
          err,
        );
      }
    }

    if (status === "sent") {
      channelOutcomes.set(channel, "sent");
      hasSentDelivery = true;
    } else if (TERMINAL_SKIP_STATUSES.has(status)) {
      channelOutcomes.set(channel, "skipped");
    } else if (status === "deferred_quiet_hours") {
      // Retryable — re-evaluate next tick.
      channelOutcomes.set(channel, "pending");
    } else if (FAILURE_STATUSES.has(status)) {
      // Was the cap hit by THIS attempt?
      if (failureCount + 1 >= MAX_FAILED_ATTEMPTS_PER_CHANNEL) {
        channelOutcomes.set(channel, "failed");
      } else {
        channelOutcomes.set(channel, "pending");
      }
    } else {
      // Unrecognized status — defensive treat as failed.
      channelOutcomes.set(channel, "failed");
    }

    if (surfAlertSlot && status === "skipped_dedup") {
      surfAlertRejected = true;
      break;
    }
    if (decision.cancelEventReason && !hasSentDelivery) {
      terminalCancellationReason = decision.cancelEventReason;
      break;
    }
  }

  if (newAttempts.length > 0) {
    const attemptsInserted = await insertDeliveryAttempts(
      supabase,
      newAttempts,
    );
    if (attemptsInserted && profile.allow_implicit_tracking === true) {
      await captureDeliveryAttemptEvents(event, newAttempts);
    }
  }

  if (surfAlertRejected) {
    await markEventTerminal(
      supabase,
      event.id,
      "cancelled",
      "skipped_redundant",
      claimToken,
    );
    return { outcome: "all-skipped", nextAttemptAt: null };
  }

  if (terminalCancellationReason) {
    await markEventTerminal(
      supabase,
      event.id,
      "cancelled",
      terminalCancellationReason,
      claimToken,
    );
    return { outcome: "all-skipped", nextAttemptAt: null };
  }

  const outcome = await finalizeEventStatus(
    supabase,
    event.id,
    channelOutcomes,
    claimToken,
  );

  // Phase 5c: schedule backoff for retryable failures so the next tick
  // doesn't fire 1 minute later. Quiet-hours-only retryable → no backoff
  // (next tick can re-evaluate the window immediately and skip if still
  // inside quiet hours; the cost is one wasted tick).
  let nextAttemptAt: Date | null = null;
  if (outcome === "pending") {
    const hasRetryableFailure = newAttempts.some((a) =>
      FAILURE_STATUSES.has(a.status as NotificationDeliveryStatus),
    );
    const hasDeferredQuietHours = newAttempts.some(
      (a) => a.status === "deferred_quiet_hours",
    );
    if (hasRetryableFailure) {
      nextAttemptAt = new Date(now.getTime() + backoffFor(event.attempt_count));
      // Phase 5m: surface the unhealthy retry path separately from the
      // healthy "user said quiet hours, we respect it" path.
      summary.retry_scheduled_count++;
    } else if (hasDeferredQuietHours) {
      nextAttemptAt = earliestDate(quietHoursRetryTimes);
      summary.deferred_quiet_hours_count++;
    }
  }

  return { outcome, nextAttemptAt };
}

function priorTerminalOutcome(
  prior: NotificationDeliveryAttemptRow[],
): ChannelOutcome | null {
  for (const a of prior) {
    if (a.status === "sent") return "sent";
    if (TERMINAL_SKIP_STATUSES.has(a.status)) return "skipped";
  }
  return null;
}

function groupAttemptsByChannel(
  attempts: NotificationDeliveryAttemptRow[],
): Map<NotificationChannel, NotificationDeliveryAttemptRow[]> {
  const m = new Map<NotificationChannel, NotificationDeliveryAttemptRow[]>();
  for (const a of attempts) {
    const list = m.get(a.channel) ?? [];
    list.push(a);
    m.set(a.channel, list);
  }
  return m;
}

async function finalizeEventStatus(
  supabase: ServiceClient,
  eventId: string,
  outcomes: Map<NotificationChannel, ChannelOutcome>,
  claimToken: string,
): Promise<ProcessOneOutcome> {
  const values = Array.from(outcomes.values());
  if (values.length === 0) {
    await markEventTerminal(
      supabase,
      eventId,
      "processed",
      "surface_disabled",
      claimToken,
    );
    return "all-skipped";
  }

  const allTerminal = values.every(
    (o) => o === "sent" || o === "skipped" || o === "failed",
  );
  if (!allTerminal) {
    // At least one channel is still retrying — leave event pending. Don't
    // touch processed_at or status; next tick will revisit.
    return "pending";
  }

  const anySent = values.some((o) => o === "sent");
  const anyFailed = values.some((o) => o === "failed");

  if (anySent) {
    await markEventTerminal(supabase, eventId, "processed", null, claimToken);
    return "processed";
  }
  if (anyFailed) {
    await markEventTerminal(
      supabase,
      eventId,
      "failed",
      "all_channels_failed",
      claimToken,
    );
    return "failed";
  }
  // Everything was a decisive skip. Phase 5a: event-level 'skipped' status was
  // removed — record this as 'processed' (we processed the event, the decision
  // was "don't send"). The processed counter ticks both `processed` and
  // `skipped` in summary so dashboards can still distinguish.
  await markEventTerminal(
    supabase,
    eventId,
    "processed",
    "all_channels_skipped",
    claimToken,
  );
  return "all-skipped";
}

// ─── Per-channel pipeline ────────────────────────────────────────────────────

async function processChannel(
  supabase: ServiceClient,
  fcm: FcmMessaging,
  event: NotificationEventRow,
  def: NotificationTypeDef,
  profile: ProfileRow,
  ctx: BuildCtx,
  channel: NotificationChannel,
  now: Date,
  presentationCompatibility: Record<string, number>,
  surfAlertSlot: SurfAlertSlot | null,
  resolveMajorEventHold: NotificationMajorEventHoldResolver,
  majorEventHoldAsOf: Date | undefined,
): Promise<ChannelDecision> {
  if (
    def.suppressSelfNotify &&
    event.actor_user_id &&
    event.actor_user_id === event.recipient_user_id
  ) {
    return channelDecision("skipped_self");
  }

  const masterCol = def.prefs.master[channel];
  if (masterCol && profile[masterCol] === false) {
    return channelDecision("skipped_pref_master");
  }

  const perTypeCol = def.prefs.perType[channel];
  if (perTypeCol && profile[perTypeCol] === false) {
    return channelDecision("skipped_pref_type");
  }

  // Phase 5d: mode-based quiet hours. `ignore` and `bypass` skip the check
  // entirely. `defer` respects the window and returns deferred_quiet_hours
  // so the worker leaves the event pending for the next tick.
  if (channel === "push" && def.quietHours.mode === "defer") {
    const tz = resolveNotificationTimezone(profile.timezone);
    const localHour = getLocalHour(now, tz);
    const quietWindow = resolveQuietWindow(def, event.payload);
    const start = quietWindow.start;
    const end = quietWindow.end;
    if (isInQuietWindow(localHour, start, end)) {
      return channelDecision("deferred_quiet_hours", {
        nextAttemptAt: getQuietWindowEnd(now, tz, localHour, start, end),
      });
    }
  }

  // Phase 5g: per-type cooldown. If the registry sets `cooldownMs`, the worker
  // suppresses a second send to the same recipient until the window elapses.
  // Only applies after dedupe + prefs + quiet-hours since cooldown is the
  // last-line "we already sent one of these recently" guard. Distinct from
  // producer dedupe_key (which prevents duplicate ACTIVE events) and from
  // the active-event partial unique index (which only sees pending/processing).
  const cooldownMs = typeof def.cooldownMs === "function"
    ? def.cooldownMs(event.payload as Record<string, unknown>)
    : def.cooldownMs;
  if (channel === "push" && cooldownMs && cooldownMs > 0) {
    const cooldownStartIso = new Date(
      now.getTime() - cooldownMs,
    ).toISOString();
    const cooldownClient = supabase as unknown as {
      from(t: "notification_delivery_attempts"): {
        select(s: string): {
          eq(
            c: "channel",
            v: NotificationChannel,
          ): {
            eq(
              c: "status",
              v: NotificationDeliveryStatus,
            ): {
              gte(
                c: "created_at",
                v: string,
              ): {
                in(
                  c: "notification_event_id",
                  v: string[],
                ): {
                  limit(n: number): Promise<{
                    data: Array<{ id: string }> | null;
                    error: { message: string; code?: string } | null;
                  }>;
                };
              };
            };
          };
        };
      };
      from(t: "notification_events"): {
        select(s: string): {
          eq(
            c: "recipient_user_id",
            v: string,
          ): {
            eq(
              c: "type",
              v: string,
            ): {
              gte(
                c: "created_at",
                v: string,
              ): Promise<{
                data: Array<{ id: string; payload?: Record<string, unknown> }> | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      };
    };
    const { data: recentEvents, error: eventsErr } = await cooldownClient
      .from("notification_events")
      .select("id, payload")
      .eq("recipient_user_id", event.recipient_user_id)
      .eq("type", event.type)
      .gte("created_at", cooldownStartIso);
    if (eventsErr) {
      console.error(
        `[notifications/worker] cooldown lookup (events) failed for event ${event.id}:`,
        eventsErr,
      );
      // Fall through — we'd rather risk a within-cooldown send than lose the
      // notification on a transient query error.
    } else if (recentEvents && recentEvents.length > 0) {
      const cooldownKey = def.cooldownKey?.(
        event.payload as Record<string, unknown>,
      ) ?? null;
      const recentEventIds = recentEvents
        .filter((recentEvent) =>
          cooldownKey === null
          || def.cooldownKey?.((recentEvent.payload ?? {}) as Record<string, unknown>) === cooldownKey,
        )
        .map((r) => r.id);
      if (recentEventIds.length > 0) {
        const { data: sentAttempts, error: attemptsErr } = await cooldownClient
          .from("notification_delivery_attempts")
          .select("id")
          .eq("channel", "push")
          .eq("status", "sent")
          .gte("created_at", cooldownStartIso)
          .in("notification_event_id", recentEventIds)
          .limit(1);
        if (attemptsErr) {
          console.error(
            `[notifications/worker] cooldown lookup (attempts) failed for event ${event.id}:`,
            attemptsErr,
          );
        } else if (sentAttempts && sentAttempts.length > 0) {
          return channelDecision("skipped_cooldown");
        }
      }
    }
  }

  const holdSuppression = await resolveHoldSuppression(
    event,
    profile,
    resolveMajorEventHold,
    majorEventHoldAsOf,
  );
  if (holdSuppression) return holdSuppression;

  if (channel === "push") {
    return dispatchPush(
      supabase,
      fcm,
      event,
      def,
      profile,
      ctx,
      presentationCompatibility,
      surfAlertSlot,
      resolveMajorEventHold,
      majorEventHoldAsOf,
    );
  }
  if (channel === "in_app") {
    if (
      surfAlertSlot &&
      !(await claimSurfAlertSlot(supabase, event, surfAlertSlot))
    ) {
      return channelDecision("skipped_dedup");
    }
    const finalHoldSuppression = await resolveHoldSuppression(
      event,
      profile,
      resolveMajorEventHold,
      majorEventHoldAsOf,
      surfAlertSlot !== null,
    );
    if (finalHoldSuppression) return finalHoldSuppression;
    return channelDecision(await dispatchInApp(supabase, event, def, ctx));
  }
  // 'email' not supported in v1 — registry has no entries that route here.
  return channelDecision("failed_internal", {
    errorMessage: "Unsupported notification channel",
  });
}

async function resolveHoldSuppression(
  event: NotificationEventRow,
  profile: ProfileRow,
  resolveMajorEventHold: NotificationMajorEventHoldResolver,
  majorEventHoldAsOf: Date | undefined,
  cancelEventOnSuppression = false,
): Promise<ChannelDecision | null> {
  let holdDecision: NotificationMajorEventHoldResult;
  try {
    holdDecision = await resolveMajorEventHold({
      eventId: event.id,
      type: event.type,
      payload: event.payload,
      profileExperience: profile.experience_level,
      ...(majorEventHoldAsOf ? { asOf: majorEventHoldAsOf } : {}),
    });
  } catch {
    holdDecision = {
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
      auditCode: "major_event_hold",
      candidate: null,
    };
  }
  if (
    holdDecision.status === "suppressed" &&
    (event.type !== "forecast_alert" ||
      holdDecision.reasonCode === "major_event_hold")
  ) {
    return channelDecision("skipped_disabled", {
      providerResponse: {
        audit_code: holdDecision.auditCode,
        reason_code: holdDecision.reasonCode,
      },
      ...(cancelEventOnSuppression
        ? { cancelEventReason: holdDecision.auditCode }
        : {}),
    });
  }
  return null;
}

function resolveQuietWindow(
  def: NotificationTypeDef,
  payload: Json,
): { start: number; end: number } {
  if (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload)
  ) {
    const record = payload as Record<string, unknown>;
    const start =
      typeof record.quiet_hours_start === "number"
        ? record.quiet_hours_start
        : null;
    const end =
      typeof record.quiet_hours_end === "number"
        ? record.quiet_hours_end
        : null;
    if (
      start !== null &&
      end !== null &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      start <= 23 &&
      end >= 0 &&
      end <= 23 &&
      start !== end
    ) {
      return { start, end };
    }
  }

  return {
    start: def.quietHours.windowStart ?? 22,
    end: def.quietHours.windowEnd ?? 4,
  };
}

// ─── Push dispatch ───────────────────────────────────────────────────────────

function installationIdFor(device: DeviceRow): string | null {
  return device.installation_id ?? null;
}

function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sanitizeProviderText(
  text: string,
  devices: readonly DeviceRow[],
): string {
  return devices.reduce(
    (safe, device) =>
      safe
        .split(device.device_token)
        .join(`[token:${tokenFingerprint(device.device_token)}]`),
    text,
  );
}

/**
 * New installations are claimed in a durable per-event ledger before provider
 * dispatch. Legacy rows have no physical identity and remain on the additive
 * compatibility path; they are never guessed into an installation group.
 */
async function claimInstallationTargets(
  supabase: ServiceClient,
  eventId: string,
  devices: DeviceRow[],
): Promise<DeviceRow[]> {
  const identified = devices.filter(
    (device) => installationIdFor(device) !== null,
  );
  if (identified.length === 0) return devices;

  const rows = identified.map((device) => ({
    notification_event_id: eventId,
    installation_id: device.installation_id as string,
    token_fingerprint: tokenFingerprint(device.device_token),
  }));
  const inserted = await supabase
    .from("notification_delivery_targets")
    .upsert(rows, {
      onConflict: "notification_event_id,installation_id",
      ignoreDuplicates: true,
    });
  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(
      `notification target ledger insert failed: ${inserted.error.message}`,
    );
  }
  const claimId = crypto.randomUUID();
  const claimed = await supabase.rpc("claim_notification_delivery_targets", {
    p_event_id: eventId,
    p_installation_ids: rows.map((row) => row.installation_id),
    p_claim_id: claimId,
  });
  if (claimed.error) {
    throw new Error(
      `notification target claim failed: ${claimed.error.message}`,
    );
  }
  const claimedByInstallation = new Map(
    (claimed.data ?? [])
      .filter((target) => target.status === "sending")
      .map((target) => [target.installation_id, target] as const),
  );
  return [
    ...devices.filter((device) => installationIdFor(device) === null),
    ...identified.flatMap((device) => {
      const target = claimedByInstallation.get(
        device.installation_id as string,
      );
      if (!target) return [];
      return [
        {
          ...device,
          delivery_claim_id: claimId,
          delivery_claim_version: target.claim_version,
        },
      ];
    }),
  ];
}

async function dispatchPush(
  supabase: ServiceClient,
  fcm: FcmMessaging,
  event: NotificationEventRow,
  def: NotificationTypeDef,
  profile: ProfileRow,
  ctx: BuildCtx,
  presentationCompatibility: Record<string, number>,
  surfAlertSlot: SurfAlertSlot | null,
  resolveMajorEventHold: NotificationMajorEventHoldResolver,
  majorEventHoldAsOf: Date | undefined,
): Promise<ChannelDecision> {
  if (!def.buildPushPayload) {
    return channelDecision("failed_internal", {
      errorMessage: "Notification type has no push payload builder",
    });
  }

  if (fcm === null) {
    return channelDecision("failed_provider", {
      providerResponse: { reason: "firebase_not_configured" },
      errorMessage: "Firebase not configured",
    });
  }

  const { data: devices, error: devicesError } = await supabase
    .from("user_devices")
    .select(
      "id, device_token, installation_id, retired_at, platform, app_version, build_number",
    )
    .eq("user_id", event.recipient_user_id)
    .is("retired_at", null);

  if (devicesError) {
    console.error(
      `[notifications/worker] device lookup failed for ${event.recipient_user_id}:`,
      devicesError,
    );
    return channelDecision("failed_internal", {
      errorMessage: devicesError.message,
    });
  }
  const deviceList = ((devices ?? []) as DeviceRow[]).filter(
    (device) => device.retired_at == null,
  );
  if (deviceList.length === 0) {
    return channelDecision("skipped_no_device");
  }

  if (
    surfAlertSlot &&
    !(await claimSurfAlertSlot(supabase, event, surfAlertSlot))
  ) {
    return channelDecision("skipped_dedup");
  }

  const finalHoldSuppression = await resolveHoldSuppression(
    event,
    profile,
    resolveMajorEventHold,
    majorEventHoldAsOf,
    surfAlertSlot !== null,
  );
  if (finalHoldSuppression) return finalHoldSuppression;

  const dispatchableDevices = await claimInstallationTargets(
    supabase,
    event.id,
    deviceList,
  );
  if (dispatchableDevices.length === 0) {
    return channelDecision("skipped_dedup");
  }

  const payloadRecord = (event.payload ?? {}) as Record<string, unknown>;
  const built = def.buildPushPayload(payloadRecord, ctx);

  const messages: PushMessage[] = dispatchableDevices.map((device) => {
    const compatibility = resolveNotificationPresentationCompatibility({
      platform: device.platform,
      appVersion: device.app_version,
      buildNumber: device.build_number,
      notificationType: event.type,
    });
    const compatibilityKey = [
      compatibility.platform,
      compatibility.outcome,
      compatibility.reason,
    ].join(":");
    presentationCompatibility[compatibilityKey] =
      (presentationCompatibility[compatibilityKey] ?? 0) + 1;

    return {
      to: device.device_token,
      title: built.title,
      body: built.body,
      ...(compatibility.presentation === "ios_custom_sound" && built.iosSound
        ? {
            sound: built.iosSound,
            apns: { payload: { aps: { sound: built.iosSound } } },
          }
        : {}),
      ...(compatibility.presentation === "android_custom_channel" &&
      built.androidChannelId
        ? {
            android: {
              notification: { channelId: built.androidChannelId },
            },
          }
        : {}),
      data: {
        ...built.data,
        notification_event_id: event.id,
        message_instance_id: event.id,
      },
    };
  });

  let result;
  try {
    result = await dispatchPushMessages({ messages, fcm });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const safeMessage = sanitizeProviderText(message, dispatchableDevices);
    console.error(
      `[notifications/worker] push dispatch threw for event ${event.id}:`,
      safeMessage,
    );
    try {
      await finalizeInstallationTargets(
        supabase,
        event.id,
        dispatchableDevices,
        {
          success: 0,
          failed: 0,
          invalidTokens: [],
          errors: [safeMessage],
          outcomes: dispatchableDevices
            .filter((device) => installationIdFor(device) !== null)
            .map((device) => ({
              token: device.device_token,
              status: "unknown" as const,
              invalidToken: false,
            })),
        },
      );
    } catch (finalizeError) {
      const finalizeMessage =
        finalizeError instanceof Error
          ? finalizeError.message
          : String(finalizeError);
      console.error(
        `[notifications/worker] ambiguous push target finalization failed for event ${event.id}:`,
        sanitizeProviderText(finalizeMessage, dispatchableDevices),
      );
    }
    return channelDecision("failed_provider", {
      providerResponse: { reason: "dispatch_exception" },
      errorMessage: safeMessage,
    });
  }

  if (result.invalidTokens.length > 0) {
    await supabase
      .from("user_devices")
      .update({
        retired_at: new Date().toISOString(),
        retired_reason: "provider_invalid_token",
      })
      .in("device_token", result.invalidTokens)
      .is("retired_at", null);
  }

  const safeErrors = result.errors.map((error) =>
    sanitizeProviderText(error, dispatchableDevices),
  );
  const safeResult = { ...result, errors: safeErrors };
  const providerResponse = {
    success: result.success,
    failed: result.failed,
    invalidTokenCount: result.invalidTokens.length,
    errors: safeErrors,
  };
  try {
    await finalizeInstallationTargets(
      supabase,
      event.id,
      dispatchableDevices,
      safeResult,
    );
  } catch (finalizeError) {
    const finalizeMessage =
      finalizeError instanceof Error
        ? finalizeError.message
        : String(finalizeError);
    console.error(
      `[notifications/worker] push target finalization failed after provider response for event ${event.id}:`,
      sanitizeProviderText(finalizeMessage, dispatchableDevices),
    );
  }
  const errorMessage =
    safeErrors[0] ??
    (result.failed > 0 ? "Push provider returned failed deliveries" : null);

  if (result.success > 0) {
    return channelDecision("sent", {
      providerResponse,
      errorMessage,
    });
  }
  if (result.failed > 0) {
    return channelDecision("failed_provider", {
      providerResponse,
      errorMessage,
    });
  }
  return channelDecision("failed_internal", {
    providerResponse,
    errorMessage: "Push provider returned no sent or failed deliveries",
  });
}

async function finalizeInstallationTargets(
  supabase: ServiceClient,
  eventId: string,
  devices: DeviceRow[],
  result: {
    success: number;
    failed: number;
    invalidTokens: string[];
    errors: string[];
    outcomes: PushDeliveryOutcome[];
  },
): Promise<void> {
  const targets = devices.filter(
    (device) => installationIdFor(device) !== null,
  );
  if (targets.length === 0) return;
  const lookup = await supabase
    .from("notification_delivery_targets")
    .select("id, installation_id, claim_id, claim_version")
    .eq("notification_event_id", eventId)
    .in(
      "installation_id",
      targets.map((device) => device.installation_id as string),
    );
  if (lookup.error)
    throw new Error(
      `notification target lookup failed: ${lookup.error.message}`,
    );
  const invalid = new Set(result.invalidTokens);
  for (const target of lookup.data ?? []) {
    const device = targets.find(
      (candidate) => candidate.installation_id === target.installation_id,
    );
    if (
      !device ||
      device.delivery_claim_id !== target.claim_id ||
      device.delivery_claim_version !== target.claim_version
    ) {
      // A later worker may own this target now. Never finalize another claim.
      continue;
    }
    const outcome = result.outcomes.find(
      (candidate) => candidate.token === device.device_token,
    );
    const status =
      outcome?.status ??
      (invalid.has(device.device_token) ? "failed" : "unknown");
    const finalized = await supabase.rpc(
      "finalize_notification_delivery_target",
      {
        p_target_id: target.id,
        p_claim_id: device.delivery_claim_id,
        p_claim_version: device.delivery_claim_version,
        p_status: status,
        p_provider_response: { success: result.success, failed: result.failed },
        p_error_message:
          status === "unknown"
            ? "provider outcome ambiguous; dispatch will not be retried"
            : outcome?.error
              ? sanitizeProviderText(outcome.error, targets)
              : undefined,
      },
    );
    if (finalized.error)
      throw new Error(
        `notification target finalize failed: ${finalized.error.message}`,
      );
  }
}

// ─── In-app dispatch ─────────────────────────────────────────────────────────

async function dispatchInApp(
  supabase: ServiceClient,
  event: NotificationEventRow,
  def: NotificationTypeDef,
  ctx: BuildCtx,
): Promise<NotificationDeliveryStatus> {
  if (!def.buildInAppPayload) return "failed_internal";
  const payloadRecord = (event.payload ?? {}) as Record<string, unknown>;
  const built = def.buildInAppPayload(payloadRecord, ctx);

  const { error } = await supabase.from("notifications").insert({
    user_id: event.recipient_user_id,
    type: built.type,
    data: built.data as Json,
  });

  if (error) {
    console.error(
      `[notifications/worker] notifications insert failed for event ${event.id}:`,
      error,
    );
    return "failed_internal";
  }
  return "sent";
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

const EVENT_COLUMN_LIST =
  "id, recipient_user_id, actor_user_id, type, entity_type, entity_id, payload, dedupe_key, status, skip_reason, created_at, processed_at, claimed_at";

/**
 * Atomically claim up to `limit` events via the `claim_notification_events`
 * Postgres function (Phase 5b). The function uses FOR UPDATE SKIP LOCKED so
 * two parallel workers always claim disjoint sets, and transitions claimed
 * rows from `pending` → `processing` with the caller's `claim_token`.
 *
 * Stale processing rows (claimed_at older than CLAIM_STALE_AFTER_MS) become
 * claimable again — recovers from a crashed prior worker without manual
 * intervention.
 *
 * Throws on RPC error so `withCronObservability` records `status='error'`.
 */
async function claimPendingEvents(
  supabase: ServiceClient,
  limit: number,
  claimToken: string,
): Promise<NotificationEventRow[]> {
  const leaseSeconds = Math.ceil(CLAIM_STALE_AFTER_MS / 1000);

  const rpcClient = supabase as unknown as {
    rpc(
      name: "claim_notification_events",
      args: {
        p_batch_size: number;
        p_lease_seconds: number;
        p_claim_token: string;
      },
    ): Promise<{
      data: NotificationEventRow[] | null;
      error: { message: string; code?: string } | null;
    }>;
  };

  const { data, error } = await rpcClient.rpc("claim_notification_events", {
    p_batch_size: limit,
    p_lease_seconds: leaseSeconds,
    p_claim_token: claimToken,
  });

  if (error) {
    throw new Error(
      `notification_events claim failed: ${error.message}${error.code ? ` (code=${error.code})` : ""}`,
    );
  }

  return data ?? [];
}

/**
 * Release the claim on events that the worker chose to leave pending for
 * retry next tick. Transitions each row from `processing` back to `pending`
 * with `claim_token=NULL` and `claimed_at=NULL`. Phase 5c: also writes
 * `next_attempt_at` so retries with backoff land at the right time.
 *
 * Releases happen one event at a time because each may have a different
 * next_attempt_at. Volume per tick is bounded by batch size (50 default).
 *
 * Defended by `claim_token = $own` — if a stale-lease reclaim happened, this
 * worker's release is silently dropped (the fresh worker is now in charge).
 */
async function releaseClaims(
  supabase: ServiceClient,
  releases: Array<{ eventId: string; nextAttemptAt: Date | null }>,
  claimToken: string,
): Promise<void> {
  if (releases.length === 0) return;

  const client = supabase as unknown as {
    from(t: "notification_events"): {
      update(v: {
        status: string;
        claimed_at: null;
        claim_token: null;
        next_attempt_at: string | null;
      }): {
        eq(
          c: string,
          v: string,
        ): {
          eq(
            c: string,
            v: string,
          ): Promise<{
            error: { message: string; code?: string } | null;
          }>;
        };
      };
    };
  };

  for (const { eventId, nextAttemptAt } of releases) {
    const { error } = await client
      .from("notification_events")
      .update({
        status: "pending",
        claimed_at: null,
        claim_token: null,
        next_attempt_at: nextAttemptAt ? nextAttemptAt.toISOString() : null,
      })
      .eq("id", eventId)
      .eq("claim_token", claimToken);
    if (error) {
      console.error(
        `[notifications/worker] releaseClaims failed for ${eventId} (will be reclaimed via stale TTL):`,
        error,
      );
    }
  }
}

/**
 * Batched lookup of existing delivery attempts for a set of events. Returns
 * a Map keyed by notification_event_id. Used for per-channel idempotency on
 * retry ticks.
 */
async function loadAttemptsForEvents(
  supabase: ServiceClient,
  eventIds: string[],
): Promise<Map<string, NotificationDeliveryAttemptRow[]>> {
  const result = new Map<string, NotificationDeliveryAttemptRow[]>();
  if (eventIds.length === 0) return result;

  const client = supabase as unknown as {
    from(t: "notification_delivery_attempts"): {
      select(s: string): {
        in(
          c: string,
          v: string[],
        ): Promise<{
          data: NotificationDeliveryAttemptRow[] | null;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await client
    .from("notification_delivery_attempts")
    .select(
      "id, notification_event_id, channel, status, provider_response, error_message, created_at",
    )
    .in("notification_event_id", eventIds);

  if (error) {
    throw new Error(
      `notification_delivery_attempts fetch failed: ${error.message}${error.code ? ` (code=${error.code})` : ""}`,
    );
  }

  for (const row of data ?? []) {
    const list = result.get(row.notification_event_id) ?? [];
    list.push(row);
    result.set(row.notification_event_id, list);
  }
  return result;
}

/**
 * Distinguish "row not found" (returns null) from "query errored" (throws).
 * The caller leaves the event pending on a thrown error so a transient
 * Supabase blip doesn't poison valid events with the wrong skip_reason.
 */
async function loadProfile(
  supabase: ServiceClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, timezone, experience_level, allow_implicit_tracking, notif_push_enabled, notif_email_enabled, notif_inapp_enabled, notif_likes, notif_follows, notif_reminders, notif_xp_updates, notif_forecast_alerts, notif_water_quality, notif_similarity_alerts",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `profiles lookup failed for user ${userId}: ${error.message}`,
    );
  }
  return (data as ProfileRow | null) ?? null;
}

async function loadActorProfile(
  supabase: ServiceClient,
  userId: string,
): Promise<{ id: string; display_name: string | null } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `actor profile lookup failed for user ${userId}: ${error.message}`,
    );
  }
  return (data as { id: string; display_name: string | null } | null) ?? null;
}

async function insertDeliveryAttempts(
  supabase: ServiceClient,
  rows: NotificationDeliveryAttemptInsert[],
): Promise<boolean> {
  const client = supabase as unknown as {
    from(t: "notification_delivery_attempts"): {
      insert(rows: NotificationDeliveryAttemptInsert[]): Promise<{
        error: { message: string } | null;
      }>;
    };
  };
  const { error } = await client
    .from("notification_delivery_attempts")
    .insert(rows);
  if (error) {
    console.error("[notifications/worker] attempts insert failed:", error);
    return false;
  }
  return true;
}

function summarizeProviderResponse(
  response: Json | null | undefined,
): Record<string, unknown> {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return {};
  }

  const source = response as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  if (typeof source.success === "number") {
    summary.provider_success = source.success;
  }
  if (typeof source.failed === "number") {
    summary.provider_failed = source.failed;
  }
  if (Array.isArray(source.invalidTokens)) {
    summary.provider_invalid_token_count = source.invalidTokens.length;
  } else if (typeof source.invalidTokenCount === "number") {
    summary.provider_invalid_token_count = source.invalidTokenCount;
  }
  if (Array.isArray(source.errors)) {
    summary.provider_error_count = source.errors.length;
  }
  if (typeof source.reason === "string") {
    summary.provider_reason = source.reason;
  }

  return summary;
}

async function captureDeliveryAttemptEvents(
  event: NotificationEventRow,
  attempts: NotificationDeliveryAttemptInsert[],
): Promise<void> {
  for (const attempt of attempts) {
    try {
      await capturePostHogEvent({
        distinctId: event.recipient_user_id,
        event: "notification_delivery_attempt",
        properties: {
          $insert_id: [
            "notification_delivery_attempt",
            event.id,
            attempt.channel,
            event.attempt_count,
            attempt.status,
          ].join(":"),
          notification_event_id: event.id,
          notification_type: event.type,
          notification_channel: attempt.channel,
          notification_status: attempt.status,
          notification_entity_type: event.entity_type,
          notification_entity_id: event.entity_id,
          has_actor: Boolean(event.actor_user_id),
          event_created_at: event.created_at,
          attempt_count: event.attempt_count,
          has_error_message: Boolean(attempt.error_message),
          ...summarizeProviderResponse(attempt.provider_response ?? null),
        },
      });
    } catch (error) {
      console.error(
        `[notifications/worker] PostHog capture failed for event ${event.id} (${attempt.channel}/${attempt.status}):`,
        error,
      );
    }
  }
}

async function markEventTerminal(
  supabase: ServiceClient,
  eventId: string,
  status: "processed" | "failed" | "cancelled",
  skipReason: string | null,
  claimToken: string,
): Promise<void> {
  const client = supabase as unknown as {
    from(t: "notification_events"): {
      update(row: Record<string, unknown>): {
        eq(
          c: string,
          v: string,
        ): {
          eq(
            c: string,
            v: string,
          ): Promise<{ error: { message: string } | null }>;
        };
      };
    };
  };
  // claim_token defense (Phase 5b): if a stale-lease reclaim happened, the
  // fresh worker is now in charge. Our write matches zero rows and is
  // silently dropped — the fresh worker's progress wins.
  const { error } = await client
    .from("notification_events")
    .update({
      status,
      skip_reason: skipReason,
      cancel_reason: status === "cancelled" ? skipReason : null,
      processed_at: new Date().toISOString(),
      claim_token: null,
      claimed_at: null,
    })
    .eq("id", eventId)
    .eq("claim_token", claimToken);
  if (error) {
    console.error(
      `[notifications/worker] mark event ${eventId} ${status} failed:`,
      error,
    );
  }
}

async function claimSurfAlertSlot(
  supabase: ServiceClient,
  event: NotificationEventRow,
  slot: SurfAlertSlot,
): Promise<boolean> {
  const rpcClient = supabase as unknown as {
    rpc(
      name: "claim_surf_alert_slot",
      args: {
        p_event_id: string;
        p_recipient_user_id: string;
        p_beach_id: string;
        p_alert_date: string;
        p_priority: number;
      },
    ): Promise<{
      data: boolean | null;
      error: { message: string; code?: string } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc("claim_surf_alert_slot", {
    p_event_id: event.id,
    p_recipient_user_id: event.recipient_user_id,
    p_beach_id: slot.beachId,
    p_alert_date: slot.alertDate,
    p_priority: slot.priority,
  });

  if (error) {
    throw new Error(
      `surf alert slot claim failed: ${error.message}${error.code ? ` (code=${error.code})` : ""}`,
    );
  }

  return data === true;
}
