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
 * ## Concurrency
 *
 * The worker claims events atomically before processing. Each tick:
 *
 *   1. SELECT candidate ids WHERE status='pending' AND
 *        (claimed_at IS NULL OR claimed_at < now() - 5 min)
 *   2. UPDATE notification_events SET claimed_at = now()
 *        WHERE id = ANY(ids) AND status='pending'
 *          AND (claimed_at IS NULL OR claimed_at < now() - 5 min)
 *        RETURNING *;
 *
 * Postgres row-level locking on UPDATE means only one tick wins the claim
 * for any given row — the second tick's UPDATE re-evaluates the WHERE
 * clause against the now-updated row, fails the `claimed_at IS NULL OR ...`
 * predicate, and returns 0 rows. So even if Vercel runs two notifications-
 * deliver instances during a deploy, or a manual cron hit overlaps with
 * the scheduled tick, no event is double-dispatched.
 *
 * If a worker crashes mid-tick, its claim becomes reclaimable after
 * `CLAIM_STALE_AFTER_MS` (5 min). Events that stay pending for retry have
 * their claim released to NULL at the end of the tick so the next tick
 * can retry immediately.
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
import { getLocalHour } from "@/lib/utils/timezone-utils";
import type { messaging as fbMessaging } from "firebase-admin";

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
]);

// Statuses that count toward the per-channel failure cap.
const FAILURE_STATUSES = new Set<NotificationDeliveryStatus>([
  "failed_provider",
  "failed_internal",
]);

interface ProfileRow {
  id: string;
  display_name: string | null;
  timezone: string | null;
  notif_push_enabled: boolean;
  notif_email_enabled: boolean;
  notif_inapp_enabled: boolean;
  notif_session_invites: boolean;
  notif_likes: boolean;
  notif_follows: boolean;
  notif_reminders: boolean;
  notif_xp_updates: boolean;
  notif_forecast_alerts: boolean;
  notif_water_quality: boolean;
  inapp_session_invites: boolean;
  email_session_invites: boolean;
}

interface DeviceRow {
  device_token: string;
}

export interface ProcessOptions {
  batchSize?: number;
  /** Override "now" for deterministic testing. */
  now?: Date;
  /** Pre-resolved FCM messaging client. If undefined, looked up lazily. */
  fcm?: FcmMessaging;
}

export interface ProcessSummary {
  fetched: number;
  /** Events that reached terminal `processed` this tick. */
  processed: number;
  /** Events that reached terminal `skipped` this tick. */
  skipped: number;
  /** Events that reached terminal `failed` this tick (retry exhausted or fatal). */
  failed: number;
  /** Events still `pending` after this tick (will retry next tick). */
  pending_after_run: number;
  firebase_configured: boolean;
  by_status: Partial<Record<NotificationDeliveryStatus, number>>;
}

/** Per-channel decision rolled up at the end of one tick. */
type ChannelOutcome = "sent" | "skipped" | "failed" | "pending";

// ─── Public entrypoint ───────────────────────────────────────────────────────

export async function processPendingEvents(
  supabase: ServiceClient,
  opts: ProcessOptions = {}
): Promise<ProcessSummary> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = opts.now ?? new Date();
  const fcm = opts.fcm !== undefined ? opts.fcm : getFirebaseAdminMessaging();

  const summary: ProcessSummary = {
    fetched: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    pending_after_run: 0,
    firebase_configured: fcm !== null,
    by_status: {},
  };

  // Surfacing a fetch error is critical: a silent empty-array return would
  // make a broken cron look identical to a healthy idle tick. Throwing here
  // lets `withCronObservability` mark the run status='error'.
  const events = await claimPendingEvents(supabase, batchSize, now);
  summary.fetched = events.length;
  if (events.length === 0) return summary;

  const priorAttempts = await loadAttemptsForEvents(
    supabase,
    events.map((e) => e.id)
  );

  // Track events that stay pending after the tick so we can release their
  // claim and let the next tick retry immediately (instead of waiting for
  // the 5-min stale TTL).
  const stillPendingIds: string[] = [];

  for (const event of events) {
    const eventAttempts = priorAttempts.get(event.id) ?? [];
    try {
      const outcome = await processOne(
        supabase,
        fcm,
        event,
        eventAttempts,
        now,
        summary
      );
      tallyOutcome(summary, outcome);
      if (outcome === "pending") stillPendingIds.push(event.id);
    } catch (err) {
      // Truly unexpected error (not a planned failure path) — leave the
      // event pending so the next tick retries. We do NOT mark the event
      // failed here because the failure may be transient (DB blip, network).
      console.error(
        `[notifications/worker] uncaught error processing event ${event.id}:`,
        err
      );
      summary.pending_after_run++;
      stillPendingIds.push(event.id);
    }
  }

  await releaseClaims(supabase, stillPendingIds);

  return summary;
}

function tallyOutcome(
  summary: ProcessSummary,
  outcome: "processed" | "skipped" | "failed" | "pending"
): void {
  if (outcome === "processed") summary.processed++;
  else if (outcome === "skipped") summary.skipped++;
  else if (outcome === "failed") summary.failed++;
  else summary.pending_after_run++;
}

// ─── Per-event pipeline ──────────────────────────────────────────────────────

async function processOne(
  supabase: ServiceClient,
  fcm: FcmMessaging,
  event: NotificationEventRow,
  priorAttempts: NotificationDeliveryAttemptRow[],
  now: Date,
  summary: ProcessSummary
): Promise<"processed" | "skipped" | "failed" | "pending"> {
  if (!isKnownNotificationType(event.type)) {
    await markEventTerminal(supabase, event.id, "failed", "unknown_type");
    return "failed";
  }
  const def = getRegistryEntry(event.type as NotificationType);

  // Profile lookup distinguishes "row missing" (terminal failure) from
  // "query errored" (transient — leave pending so next tick can retry).
  let profile: ProfileRow | null;
  try {
    profile = await loadProfile(supabase, event.recipient_user_id);
  } catch (err) {
    console.error(
      `[notifications/worker] profile query errored for event ${event.id}:`,
      err
    );
    return "pending";
  }
  if (!profile) {
    await markEventTerminal(
      supabase,
      event.id,
      "failed",
      "recipient_profile_missing"
    );
    return "failed";
  }

  let actor: { id: string; display_name: string | null } | null = null;
  if (event.actor_user_id) {
    try {
      actor = await loadActorProfile(supabase, event.actor_user_id);
    } catch (err) {
      console.error(
        `[notifications/worker] actor query errored for event ${event.id}:`,
        err
      );
      return "pending";
    }
  }

  const ctx: BuildCtx = {
    recipientUserId: event.recipient_user_id,
    actorUserId: event.actor_user_id,
    recipient: { display_name: profile.display_name, timezone: profile.timezone },
    actor: actor ? { display_name: actor.display_name } : null,
  };

  const attemptsByChannel = groupAttemptsByChannel(priorAttempts);
  const newAttempts: NotificationDeliveryAttemptInsert[] = [];
  const channelOutcomes = new Map<NotificationChannel, ChannelOutcome>();

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
      FAILURE_STATUSES.has(a.status)
    ).length;
    if (failureCount >= MAX_FAILED_ATTEMPTS_PER_CHANNEL) {
      channelOutcomes.set(channel, "failed");
      continue;
    }

    const status = await processChannel(
      supabase,
      fcm,
      event,
      def,
      profile,
      ctx,
      channel,
      now
    );

    newAttempts.push({
      notification_event_id: event.id,
      channel,
      status,
      provider_response: null,
      error_message: null,
    });
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
          err
        );
      }
    }

    if (status === "sent") {
      channelOutcomes.set(channel, "sent");
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
  }

  if (newAttempts.length > 0) {
    await insertDeliveryAttempts(supabase, newAttempts);
  }

  return finalizeEventStatus(supabase, event.id, channelOutcomes);
}

function priorTerminalOutcome(
  prior: NotificationDeliveryAttemptRow[]
): ChannelOutcome | null {
  for (const a of prior) {
    if (a.status === "sent") return "sent";
    if (TERMINAL_SKIP_STATUSES.has(a.status)) return "skipped";
  }
  return null;
}

function groupAttemptsByChannel(
  attempts: NotificationDeliveryAttemptRow[]
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
  outcomes: Map<NotificationChannel, ChannelOutcome>
): Promise<"processed" | "skipped" | "failed" | "pending"> {
  const values = Array.from(outcomes.values());
  if (values.length === 0) {
    // No channels — defensive (shouldn't happen for a registered type).
    await markEventTerminal(supabase, eventId, "failed", "no_channels");
    return "failed";
  }

  const allTerminal = values.every(
    (o) => o === "sent" || o === "skipped" || o === "failed"
  );
  if (!allTerminal) {
    // At least one channel is still retrying — leave event pending. Don't
    // touch processed_at or status; next tick will revisit.
    return "pending";
  }

  const anySent = values.some((o) => o === "sent");
  const anyFailed = values.some((o) => o === "failed");

  if (anySent) {
    await markEventTerminal(supabase, eventId, "processed", null);
    return "processed";
  }
  if (anyFailed) {
    await markEventTerminal(supabase, eventId, "failed", "all_channels_failed");
    return "failed";
  }
  // Everything was a decisive skip.
  await markEventTerminal(supabase, eventId, "skipped", "all_channels_skipped");
  return "skipped";
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
  now: Date
): Promise<NotificationDeliveryStatus> {
  if (
    def.suppressSelfNotify &&
    event.actor_user_id &&
    event.actor_user_id === event.recipient_user_id
  ) {
    return "skipped_self";
  }

  const masterCol = def.prefs.master[channel];
  if (masterCol && profile[masterCol] === false) {
    return "skipped_pref_master";
  }

  const perTypeCol = def.prefs.perType[channel];
  if (perTypeCol && profile[perTypeCol] === false) {
    return "skipped_pref_type";
  }

  if (channel === "push" && def.quietHours.honor) {
    const tz = profile.timezone || "UTC";
    const localHour = getLocalHour(now, tz);
    const start = def.quietHours.windowStart ?? 22;
    const end = def.quietHours.windowEnd ?? 4;
    if (isInQuietWindow(localHour, start, end)) {
      return "deferred_quiet_hours";
    }
  }

  if (channel === "push") {
    return dispatchPush(supabase, fcm, event, def, ctx);
  }
  if (channel === "in_app") {
    return dispatchInApp(supabase, event, def, ctx);
  }
  // 'email' not supported in v1 — registry has no entries that route here.
  return "failed_internal";
}

function isInQuietWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // Window wraps midnight (e.g. 22→4 means 22,23,0,1,2,3 are quiet).
  return hour >= start || hour < end;
}

// ─── Push dispatch ───────────────────────────────────────────────────────────

async function dispatchPush(
  supabase: ServiceClient,
  fcm: FcmMessaging,
  event: NotificationEventRow,
  def: NotificationTypeDef,
  ctx: BuildCtx
): Promise<NotificationDeliveryStatus> {
  if (!def.buildPushPayload) return "failed_internal";

  if (fcm === null) {
    return "failed_provider";
  }

  const { data: devices, error: devicesError } = await supabase
    .from("user_devices")
    .select("device_token")
    .eq("user_id", event.recipient_user_id);

  if (devicesError) {
    console.error(
      `[notifications/worker] device lookup failed for ${event.recipient_user_id}:`,
      devicesError
    );
    return "failed_internal";
  }
  const deviceList = (devices ?? []) as DeviceRow[];
  if (deviceList.length === 0) {
    return "skipped_no_device";
  }

  const payloadRecord = (event.payload ?? {}) as Record<string, unknown>;
  const built = def.buildPushPayload(payloadRecord, ctx);

  const fbMessages: fbMessaging.Message[] = deviceList.map((d) => ({
    token: d.device_token,
    notification: { title: built.title, body: built.body },
    data: stringifyDataPayload(built.data),
  }));

  let response: fbMessaging.BatchResponse;
  try {
    response = await fcm.sendEach(fbMessages);
  } catch (err) {
    console.error(
      `[notifications/worker] fcm.sendEach threw for event ${event.id}:`,
      err
    );
    return "failed_provider";
  }

  // Prune invalid tokens (mirrors lib/services/push-notifications.ts:86-104).
  const invalid: string[] = [];
  response.responses.forEach((r, i) => {
    if (r.error && INVALID_TOKEN_ERROR_CODES.has(r.error.code)) {
      invalid.push(deviceList[i].device_token);
    }
  });
  if (invalid.length > 0) {
    await supabase.from("user_devices").delete().in("device_token", invalid);
  }

  if (response.successCount > 0) return "sent";
  if (response.failureCount > 0) return "failed_provider";
  return "failed_internal";
}

function stringifyDataPayload(
  data: Record<string, unknown>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
  );
}

// ─── In-app dispatch ─────────────────────────────────────────────────────────

async function dispatchInApp(
  supabase: ServiceClient,
  event: NotificationEventRow,
  def: NotificationTypeDef,
  ctx: BuildCtx
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
      error
    );
    return "failed_internal";
  }
  return "sent";
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

const EVENT_COLUMN_LIST =
  "id, recipient_user_id, actor_user_id, type, entity_type, entity_id, payload, dedupe_key, status, skip_reason, created_at, processed_at, claimed_at";

/**
 * Atomically claim up to `limit` pending events. Two-phase:
 *
 *   1. SELECT candidate ids (claimable = unclaimed OR claim is stale).
 *   2. UPDATE the same id set, setting `claimed_at = now()` only if the row
 *      is STILL claimable at update time. Rows that another worker already
 *      grabbed between phase 1 and phase 2 are silently dropped from the
 *      RETURNING set.
 *
 * Throws on query error so the cron handler surfaces it via
 * withCronObservability (`cron_runs.status='error'`) rather than silently
 * looking like a clean idle tick.
 */
async function claimPendingEvents(
  supabase: ServiceClient,
  limit: number,
  now: Date
): Promise<NotificationEventRow[]> {
  const staleCutoff = new Date(now.getTime() - CLAIM_STALE_AFTER_MS).toISOString();
  const claimableFilter = `claimed_at.is.null,claimed_at.lt.${staleCutoff}`;

  // Phase 1 — find candidate ids. We could fold this into a single UPDATE
  // ... WHERE id IN (SELECT ...) but supabase-js doesn't expose subqueries,
  // so the two-step keeps us within the supported builder API.
  const selectClient = supabase as unknown as {
    from(t: "notification_events"): {
      select(s: string): {
        eq(c: string, v: string): {
          or(filter: string): {
            order(c: string, opts: { ascending: boolean }): {
              limit(n: number): Promise<{
                data: Pick<NotificationEventRow, "id">[] | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };

  const { data: candidates, error: selectError } = await selectClient
    .from("notification_events")
    .select("id")
    .eq("status", "pending")
    .or(claimableFilter)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (selectError) {
    throw new Error(
      `notification_events select failed: ${selectError.message}${selectError.code ? ` (code=${selectError.code})` : ""}`
    );
  }

  const candidateIds = (candidates ?? []).map((r) => r.id);
  if (candidateIds.length === 0) return [];

  // Phase 2 — atomic claim. The duplicated `claimableFilter` predicate is
  // intentional: it forces Postgres to re-check (under the row lock taken by
  // UPDATE) whether the row is still claimable, so a parallel worker's
  // claim wins the race but doesn't get double-dispatched.
  const updateClient = supabase as unknown as {
    from(t: "notification_events"): {
      update(v: { claimed_at: string }): {
        in(c: string, v: string[]): {
          eq(c: string, v: string): {
            or(filter: string): {
              select(s: string): Promise<{
                data: NotificationEventRow[] | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };

  const { data: claimed, error: updateError } = await updateClient
    .from("notification_events")
    .update({ claimed_at: now.toISOString() })
    .in("id", candidateIds)
    .eq("status", "pending")
    .or(claimableFilter)
    .select(EVENT_COLUMN_LIST);

  if (updateError) {
    throw new Error(
      `notification_events claim failed: ${updateError.message}${updateError.code ? ` (code=${updateError.code})` : ""}`
    );
  }

  return claimed ?? [];
}

/**
 * Release the claim on events that the worker chose to leave pending for
 * retry next tick (e.g. quiet-hours, transient FCM error). Without this,
 * the row stays "claimed" until the 5-minute stale TTL kicks in — which
 * pushes retry latency from 1 min (next tick) to 5 min.
 */
async function releaseClaims(
  supabase: ServiceClient,
  eventIds: string[]
): Promise<void> {
  if (eventIds.length === 0) return;

  const client = supabase as unknown as {
    from(t: "notification_events"): {
      update(v: { claimed_at: null }): {
        in(c: string, v: string[]): {
          eq(c: string, v: string): Promise<{
            error: { message: string; code?: string } | null;
          }>;
        };
      };
    };
  };

  const { error } = await client
    .from("notification_events")
    .update({ claimed_at: null })
    .in("id", eventIds)
    .eq("status", "pending");
  if (error) {
    console.error(
      "[notifications/worker] releaseClaims failed (will be reclaimed via stale TTL):",
      error
    );
  }
}

/**
 * Batched lookup of existing delivery attempts for a set of events. Returns
 * a Map keyed by notification_event_id. Used for per-channel idempotency on
 * retry ticks.
 */
async function loadAttemptsForEvents(
  supabase: ServiceClient,
  eventIds: string[]
): Promise<Map<string, NotificationDeliveryAttemptRow[]>> {
  const result = new Map<string, NotificationDeliveryAttemptRow[]>();
  if (eventIds.length === 0) return result;

  const client = supabase as unknown as {
    from(t: "notification_delivery_attempts"): {
      select(s: string): {
        in(c: string, v: string[]): Promise<{
          data: NotificationDeliveryAttemptRow[] | null;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await client
    .from("notification_delivery_attempts")
    .select(
      "id, notification_event_id, channel, status, provider_response, error_message, created_at"
    )
    .in("notification_event_id", eventIds);

  if (error) {
    throw new Error(
      `notification_delivery_attempts fetch failed: ${error.message}${error.code ? ` (code=${error.code})` : ""}`
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
  userId: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, timezone, notif_push_enabled, notif_email_enabled, notif_inapp_enabled, notif_session_invites, notif_likes, notif_follows, notif_reminders, notif_xp_updates, notif_forecast_alerts, notif_water_quality, inapp_session_invites, email_session_invites"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `profiles lookup failed for user ${userId}: ${error.message}`
    );
  }
  return (data as ProfileRow | null) ?? null;
}

async function loadActorProfile(
  supabase: ServiceClient,
  userId: string
): Promise<{ id: string; display_name: string | null } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `actor profile lookup failed for user ${userId}: ${error.message}`
    );
  }
  return (data as { id: string; display_name: string | null } | null) ?? null;
}

async function insertDeliveryAttempts(
  supabase: ServiceClient,
  rows: NotificationDeliveryAttemptInsert[]
): Promise<void> {
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
  }
}

async function markEventTerminal(
  supabase: ServiceClient,
  eventId: string,
  status: "processed" | "skipped" | "failed",
  skipReason: string | null
): Promise<void> {
  const client = supabase as unknown as {
    from(t: "notification_events"): {
      update(row: Record<string, unknown>): {
        eq(c: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await client
    .from("notification_events")
    .update({
      status,
      skip_reason: skipReason,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (error) {
    console.error(
      `[notifications/worker] mark event ${eventId} ${status} failed:`,
      error
    );
  }
}
