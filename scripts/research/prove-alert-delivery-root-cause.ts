/**
 * Read-only production reproduction for the 2026-08-10 forecast-alert outage.
 *
 * Production access is limited to SELECTs and the STABLE hold-resolver RPC.
 * All enqueue, slot-claim, delivery-attempt, inbox, and provider writes run
 * against in-memory fakes. The Expo boundary is intercepted before network I/O.
 *
 * Run:
 *   NODE_PATH="$PWD/scripts/research/stubs" \
 *   ALERTS_DELIVERY_ENABLED=true \
 *   node --import tsx scripts/research/prove-alert-delivery-root-cause.ts
 */

import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import { formatPushNotification } from "@/lib/alerts/push-formatter";
import type { AlertConditions, MatchingWindow } from "@/lib/alerts/types";
import { CAPS, resolveEntitlement } from "@/lib/alerts/entitlements";
import {
  selectFreshAlertWindow,
  type EnhancedForecastAlertRow,
} from "@/lib/alerts/revalidate-alert-window";
import { getDaylightWindow } from "@/lib/alerts/sunrise";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import { getLocalHour } from "@/lib/utils/timezone-utils";
import {
  DEFAULT_QUIET,
  isInQuietWindow,
  resolveNotificationTimezone,
} from "@/lib/notifications/quiet-hours";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { processPendingEvents } from "@/lib/notifications/worker";
import {
  canonicalAlertCandidateId,
  buildCanonicalDecisionFromAlertMatches,
} from "@/lib/recommendations/canonical-decision";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import {
  resolveNotificationMajorEventHold,
  type NotificationMajorEventHoldEvaluator,
  type NotificationMajorEventHoldResult,
  type ResolveNotificationMajorEventHoldInput,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import { resolveMajorEventHolds } from "@/lib/recommendations/major-event-hold/repository";
import type { Database, Json } from "@/types/database.generated";

loadEnv({ path: ".env.production.local" });

const SNAPSHOT_AT = new Date("2026-08-10T16:49:30.147Z");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const WORKER_EVENT_ID = "11111111-1111-4111-8111-111111111111";

const QUEUE_IDS = [
  ["Q1", "a299c3e4-0124-43d4-bdd2-c4504eea3262"],
  ["Q2", "38a2e309-3e23-4594-9414-049422221efd"],
  ["Q3", "710b8538-2742-465e-9216-c47e905d76be"],
  ["Q4", "9cc6043b-f320-4436-976d-d34cacacc824"],
  ["Q5", "be5255ad-4eea-446b-bc0c-d84e75e315f2"],
  ["Q6", "bf16aea8-74c7-4f82-b6de-4c791a8eea7d"],
  ["Q7", "ed715baf-9bcf-4f69-9ad7-10418efe4e87"],
] as const;

const ALIAS_BY_QUEUE_ID = new Map<string, string>(
  QUEUE_IDS.map(([alias, id]) => [id, alias]),
);

type RuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  notify_email: boolean;
  notify_push: boolean;
  conditions: AlertConditions;
};

type BeachRow = {
  id: string;
  name: string;
  slug: string | null;
  timezone: string | null;
  lat: number;
  lon: number;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  aspect_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  break_type: string | null;
  skill_level: string | null;
};

type QueueRow = {
  id: string;
  user_id: string;
  rule_id: string;
  beach_id: string;
  alert_date: string;
  send_at: string;
  window_start: string;
  window_end: string;
  best_hour: string;
  best_score: number | string | null;
  conditions_snapshot: Record<string, unknown>;
  sent: boolean;
  created_at: string;
  alert_rules: RuleRow | RuleRow[];
  beaches: BeachRow | BeachRow[];
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  timezone: string | null;
  experience_level: string | null;
  deleted_at: string | null;
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
};

type DeviceEvidence = {
  user_id: string;
  device_token: string;
  platform: string | null;
  app_version: string | null;
  build_number: string | null;
};

type AlertAttemptEvidence = {
  queue_id: string;
  rule_id: string;
  user_id: string;
  channel: string;
  status: string;
  skip_reason: string | null;
  attempted_at: string;
};

type AlertDeliveryEvidence = {
  user_id: string;
  beach_id: string | null;
  alert_date: string;
  channel: string;
  created_at: string;
};

type NotificationEventEvidence = {
  recipient_user_id: string;
  type: string;
  dedupe_key: string | null;
  status: string;
  created_at: string;
};

type SurfSlotEvidence = {
  recipient_user_id: string;
  beach_id: string;
  alert_date: string;
  priority: number;
  created_at: string;
};

type LoadedEvidence = {
  queueRows: QueueRow[];
  profilesByUser: Map<string, ProfileRow>;
  devices: DeviceEvidence[];
  attempts: AlertAttemptEvidence[];
  deliveries: AlertDeliveryEvidence[];
  notificationEvents: NotificationEventEvidence[];
  slots: SurfSlotEvidence[];
  suppressedEmails: Set<string>;
};

type RowAudit = {
  alias: string;
  queue: QueueRow;
  rule: RuleRow;
  beach: BeachRow;
  profile: ProfileRow;
  match: MatchingWindow;
  forecastEvidence: {
    rowCount: number;
    newestWriteAt: string | null;
    result: "fresh_match" | "stale" | "queued_snapshot_fallback";
  };
  longEventId: string;
  longEventLength: number;
  longCandidateLength: number;
  longHold: NotificationMajorEventHoldResult;
  shortEventId: string;
  shortEventLength: number;
  shortCandidateLength: number;
  shortHold: NotificationMajorEventHoldResult;
  hashedEventId: string;
  hashedEventLength: number;
  hashedCandidateLength: number;
  hashedHold: NotificationMajorEventHoldResult;
  emailHold: NotificationMajorEventHoldResult;
  pushHold: NotificationMajorEventHoldResult;
  decision: CanonicalSessionDecision;
  gates: Record<string, boolean | number | string | null>;
};

type MeasurementRuleRow = {
  id: string;
  user_id: string;
  beach_id: string;
  name: string;
  conditions: AlertConditions;
  notify_email: boolean;
  notify_push: boolean;
  preset_type: string | null;
  created_at: string;
};

type MeasurementProfileRow = {
  id: string;
  email: string | null;
  is_mock: boolean | null;
  deleted_at: string | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
  home_beach_id: string | null;
  notif_forecast_alerts: boolean;
  experience_level: string | null;
};

type MeasurementEntitlementRow = {
  user_id: string;
  is_pro: boolean | null;
  is_trialing: boolean | null;
  billing_issue: boolean | null;
  expires_at: string | null;
};

type MeasurementRecord = {
  rule_id: string;
  preset_type: string | null;
  user_key: string;
  beach_id: string;
  beach_name: string;
  evaluation_date: string;
  forecast_rows: number;
  matched: boolean;
  window_start: string | null;
  window_end: string | null;
  best_hour: string | null;
  best_score: number | null;
  modeled_send_at: string | null;
  verdict: CanonicalSessionDecision["verdict"] | null;
  reason_code: CanonicalSessionDecision["reasonCode"] | null;
  safety_rejection: string | null;
  hold_status: NotificationMajorEventHoldResult["status"] | null;
  hold_reason_code: string | null;
  hashed_hold_candidate_length: number | null;
};

type MeasurementEvidence = {
  rules: MeasurementRuleRow[];
  activeRules: MeasurementRuleRow[];
  profilesById: Map<string, MeasurementProfileRow>;
  beachesById: Map<string, BeachRow>;
  forecastRowsByBeachId: Map<string, EnhancedForecastAlertRow[]>;
  exclusions: Record<string, number>;
  forecast: {
    rows: number;
    beaches: number;
    earliestForecastAt: string | null;
    latestForecastAt: string | null;
    newestWriteAt: string | null;
  };
};

const TEST_EMAIL_PATTERN = /(test|local|example)/i;
const FORECAST_PAGE_SIZE = 1000;
const SAFETY_REASON_CODES = new Set<string>([
  "unknown_skill",
  "major_event_hold",
  "hold_state_unavailable",
  "water_quality_closure",
  "beach_skill_exceeds_user",
  "wave_height_exceeds_skill",
  "missing_beach_skill",
  "missing_wave_height",
  "invalid_candidate",
]);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function firstEmbed<T>(value: T | T[]): T {
  if (Array.isArray(value)) {
    if (!value[0]) throw new Error("Missing embedded row");
    return value[0];
  }
  return value;
}

function numericScore(value: number | string | null): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildQueuedMatch(
  queue: QueueRow,
  rule: RuleRow,
  beach: BeachRow,
): MatchingWindow {
  return {
    rule_id: queue.rule_id,
    rule_name: rule.name,
    beach_id: queue.beach_id,
    beach_name: beach.name,
    beach_slug: beach.slug,
    beach_skill_level: beach.skill_level,
    beach_timezone: beach.timezone ?? "America/Los_Angeles",
    window_start: queue.window_start,
    window_end: queue.window_end,
    best_hour: queue.best_hour,
    best_score: numericScore(queue.best_score),
    conditions_snapshot: queue.conditions_snapshot,
    notify_email: rule.notify_email,
    notify_push: rule.notify_push,
  };
}

function policyContextFor(match: MatchingWindow): {
  kind: "positive_session_recommendation";
  beach_id: string;
  starts_at: string;
  ends_at: string;
} {
  return {
    kind: "positive_session_recommendation",
    beach_id: match.beach_id,
    starts_at: match.window_start,
    ends_at: match.window_end,
  };
}

function buildSessionDecision(
  match: MatchingWindow,
  profileExperience: unknown,
  anchorTime: Date,
): CanonicalSessionDecision {
  return buildCanonicalDecisionFromAlertMatches({
    anchorTime: anchorTime.toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: match.window_start,
      windowEnd: match.window_end,
      timezone: match.beach_timezone,
    },
    profileExperience,
    recommendationAvailability: {
      state: "available",
      holdEpoch: `research:${anchorTime.toISOString()}`,
      resolutionAsOf: anchorTime.toISOString(),
    },
    matches: [match],
  });
}

function quietHoursFor(conditions: AlertConditions): {
  start: number;
  end: number;
} {
  const start = conditions.quiet_hours_start;
  const end = conditions.quiet_hours_end;
  if (
    typeof start === "number" &&
    Number.isInteger(start) &&
    start >= 0 &&
    start <= 23 &&
    typeof end === "number" &&
    Number.isInteger(end) &&
    end >= 0 &&
    end <= 23 &&
    start !== end
  ) {
    return { start, end };
  }
  return { start: DEFAULT_QUIET.windowStart, end: DEFAULT_QUIET.windowEnd };
}

function sha256EventId(eventId: string): string {
  return `sha256:${createHash("sha256").update(eventId).digest("hex")}`;
}

async function loadEvidence(
  client: SupabaseClient<Database>,
): Promise<LoadedEvidence> {
  const queueClient = client as unknown as {
    from(table: "alert_queue"): {
      select(columns: string): {
        in(
          column: "id",
          values: string[],
        ): Promise<{
          data: unknown[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data: queueData, error: queueError } = await queueClient
    .from("alert_queue")
    .select(
      `
      id, user_id, rule_id, beach_id, alert_date, send_at, window_start,
      window_end, best_hour, best_score, conditions_snapshot, sent, created_at,
      alert_rules!inner(id, name, enabled, notify_email, notify_push, conditions),
      beaches!inner(
        id, name, slug, timezone, lat, lon, wind_offshore_deg,
        wind_offshore_tol_deg, aspect_deg, preferred_tide_ft_min,
        preferred_tide_ft_max, preferred_tide_direction,
        swell_window_center_deg, swell_window_halfwidth_deg, break_type,
        skill_level
      )
    `,
    )
    .in(
      "id",
      QUEUE_IDS.map(([, id]) => id),
    );
  if (queueError)
    throw new Error(`alert_queue read failed: ${queueError.message}`);

  const queueRows = (queueData ?? []) as unknown as QueueRow[];
  if (queueRows.length !== QUEUE_IDS.length) {
    throw new Error(
      `Expected ${QUEUE_IDS.length} frozen rows, found ${queueRows.length}`,
    );
  }
  queueRows.sort((left, right) =>
    (ALIAS_BY_QUEUE_ID.get(left.id) ?? "").localeCompare(
      ALIAS_BY_QUEUE_ID.get(right.id) ?? "",
    ),
  );

  const userIds = [...new Set(queueRows.map((row) => row.user_id))];
  const profileEmails = new Set<string>();
  const sinceWeek = new Date(SNAPSHOT_AT.getTime() - WEEK_MS).toISOString();

  const [
    profilesResult,
    devicesResult,
    attemptsResult,
    deliveriesResult,
    eventsResult,
    slotsResult,
  ] = await Promise.all([
    client
      .from("profiles")
      .select(
        "id, display_name, email, timezone, experience_level, deleted_at, allow_implicit_tracking, notif_push_enabled, notif_email_enabled, notif_inapp_enabled, notif_likes, notif_follows, notif_reminders, notif_xp_updates, notif_forecast_alerts, notif_water_quality, notif_similarity_alerts",
      )
      .in("id", userIds),
    client
      .from("user_devices")
      .select("user_id, device_token, platform, app_version, build_number")
      .in("user_id", userIds),
    client
      .from("alert_delivery_attempts")
      .select(
        "queue_id, rule_id, user_id, channel, status, skip_reason, attempted_at",
      )
      .in("user_id", userIds)
      .gte("attempted_at", sinceWeek)
      .lte("attempted_at", SNAPSHOT_AT.toISOString()),
    client
      .from("alert_deliveries")
      .select("user_id, beach_id, alert_date, channel, created_at")
      .in("user_id", userIds)
      .lte("created_at", SNAPSHOT_AT.toISOString()),
    (
      client as unknown as {
        from(table: "notification_events"): {
          select(columns: string): {
            in(
              column: string,
              values: string[],
            ): {
              lte(
                column: string,
                value: string,
              ): Promise<{
                data: unknown[] | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("notification_events")
      .select("recipient_user_id, type, dedupe_key, status, created_at")
      .in("recipient_user_id", userIds)
      .lte("created_at", SNAPSHOT_AT.toISOString()),
    (
      client as unknown as {
        from(table: "surf_alert_delivery_slots"): {
          select(columns: string): {
            in(
              column: string,
              values: string[],
            ): {
              lte(
                column: string,
                value: string,
              ): Promise<{
                data: unknown[] | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("surf_alert_delivery_slots")
      .select("recipient_user_id, beach_id, alert_date, priority, created_at")
      .in("recipient_user_id", userIds)
      .lte("created_at", SNAPSHOT_AT.toISOString()),
  ]);

  const results = [
    ["profiles", profilesResult],
    ["user_devices", devicesResult],
    ["alert_delivery_attempts", attemptsResult],
    ["alert_deliveries", deliveriesResult],
    ["notification_events", eventsResult],
    ["surf_alert_delivery_slots", slotsResult],
  ] as const;
  for (const [label, result] of results) {
    if (result.error)
      throw new Error(`${label} read failed: ${result.error.message}`);
  }

  const profiles = (profilesResult.data ?? []) as unknown as ProfileRow[];
  for (const profile of profiles) {
    if (profile.email) profileEmails.add(profile.email.toLowerCase());
  }
  const suppressionResult = await client
    .from("email_suppression_list")
    .select("email")
    .in("email", [...profileEmails]);
  if (suppressionResult.error) {
    throw new Error(
      `email_suppression_list read failed: ${suppressionResult.error.message}`,
    );
  }

  return {
    queueRows,
    profilesByUser: new Map(profiles.map((profile) => [profile.id, profile])),
    devices: (devicesResult.data ?? []) as unknown as DeviceEvidence[],
    attempts: (attemptsResult.data ?? []) as unknown as AlertAttemptEvidence[],
    deliveries: (deliveriesResult.data ??
      []) as unknown as AlertDeliveryEvidence[],
    notificationEvents: (eventsResult.data ??
      []) as unknown as NotificationEventEvidence[],
    slots: (slotsResult.data ?? []) as unknown as SurfSlotEvidence[],
    suppressedEmails: new Set(
      (suppressionResult.data ?? []).map((row) => row.email.toLowerCase()),
    ),
  };
}

function createHoldEvaluator(
  client: SupabaseClient<Database>,
): NotificationMajorEventHoldEvaluator {
  return async (input) =>
    evaluateMajorEventHoldCandidates(input, {
      resolveHolds: async (candidates, options) =>
        resolveMajorEventHolds(candidates, {
          client,
          asOf: options.asOf,
        }),
      audit: () => undefined,
    });
}

function holdResolver(
  evaluateCandidates: NotificationMajorEventHoldEvaluator,
): (
  input: ResolveNotificationMajorEventHoldInput,
) => Promise<NotificationMajorEventHoldResult> {
  return async (input) =>
    resolveNotificationMajorEventHold(
      { ...input, mode: "enforce" },
      { evaluateCandidates },
    );
}

async function loadForecastEvidence(
  client: SupabaseClient<Database>,
  queue: QueueRow,
  rule: RuleRow,
  beach: BeachRow,
): Promise<{
  match: MatchingWindow;
  rowCount: number;
  newestWriteAt: string | null;
  result: "fresh_match" | "stale" | "queued_snapshot_fallback";
}> {
  const queuedMatch = buildQueuedMatch(queue, rule, beach);
  const { start, end } = getUtcDayBounds(
    queue.alert_date,
    beach.timezone ?? "America/Los_Angeles",
  );
  const { data, error } = await client
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", queue.beach_id)
    .gte("forecast_at", start)
    .lt("forecast_at", end)
    .order("forecast_at", { ascending: true });
  if (error)
    throw new Error(`enhanced_forecasts read failed: ${error.message}`);

  const rows = (data ?? []) as unknown as EnhancedForecastAlertRow[];
  const newestWriteAt = rows.reduce<string | null>((latest, row) => {
    const record = row as Record<string, unknown>;
    const candidate =
      typeof record.updated_at === "string"
        ? record.updated_at
        : typeof record.created_at === "string"
          ? record.created_at
          : null;
    if (!candidate) return latest;
    return latest === null || Date.parse(candidate) > Date.parse(latest)
      ? candidate
      : latest;
  }, null);

  if (rows.length === 0) {
    return {
      match: queuedMatch,
      rowCount: 0,
      newestWriteAt,
      result: "queued_snapshot_fallback",
    };
  }

  const fresh = selectFreshAlertWindow({
    conditions: rule.conditions,
    forecastRows: rows,
    beach: {
      id: beach.id,
      name: beach.name,
      slug: beach.slug,
      timezone: beach.timezone ?? "America/Los_Angeles",
      lat: beach.lat,
      lon: beach.lon,
      wind_offshore_deg: beach.wind_offshore_deg,
      wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
      aspect_deg: beach.aspect_deg,
      preferred_tide_ft_min: beach.preferred_tide_ft_min,
      preferred_tide_ft_max: beach.preferred_tide_ft_max,
      preferred_tide_direction: beach.preferred_tide_direction,
      swell_window_center_deg: beach.swell_window_center_deg,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
      break_type: beach.break_type,
      skill_level: beach.skill_level,
    },
    now: new Date(queue.send_at),
  });
  if (!fresh) {
    return {
      match: queuedMatch,
      rowCount: rows.length,
      newestWriteAt,
      result: "stale",
    };
  }

  return {
    match: {
      ...queuedMatch,
      window_start: fresh.window_start,
      window_end: fresh.window_end,
      best_hour: fresh.best_hour,
      best_score: fresh.best_score,
      conditions_snapshot: fresh.conditions_snapshot,
    },
    rowCount: rows.length,
    newestWriteAt,
    result: "fresh_match",
  };
}

async function auditRow(
  client: SupabaseClient<Database>,
  evidence: LoadedEvidence,
  queue: QueueRow,
  resolveHold: ReturnType<typeof holdResolver>,
): Promise<RowAudit> {
  const alias = ALIAS_BY_QUEUE_ID.get(queue.id);
  if (!alias) throw new Error(`Unknown queue row ${queue.id}`);
  const rule = firstEmbed(queue.alert_rules);
  const beach = firstEmbed(queue.beaches);
  const profile = evidence.profilesByUser.get(queue.user_id);
  if (!profile) throw new Error(`Missing profile for ${alias}`);

  const forecast = await loadForecastEvidence(client, queue, rule, beach);
  const match = forecast.match;
  const policyContext = policyContextFor(match);
  const holdPayload = {
    beach_id: match.beach_id,
    forecast_at: match.best_hour,
    policy_context: policyContext,
  };
  const longEventId =
    `condition-alert-deliver:canonical:${queue.user_id}:` +
    canonicalAlertCandidateId(match);
  const shortEventId = `condition-alert-deliver:canonical:${queue.id}`;
  const hashedEventId = sha256EventId(longEventId);

  const [longHold, shortHold, hashedHold, emailHold, pushHold] =
    await Promise.all([
      resolveHold({
        eventId: longEventId,
        type: "forecast_alert",
        payload: holdPayload,
        profileExperience: profile.experience_level,
        asOf: SNAPSHOT_AT,
      }),
      resolveHold({
        eventId: shortEventId,
        type: "forecast_alert",
        payload: holdPayload,
        profileExperience: profile.experience_level,
        asOf: SNAPSHOT_AT,
      }),
      resolveHold({
        eventId: hashedEventId,
        type: "forecast_alert",
        payload: holdPayload,
        profileExperience: profile.experience_level,
        asOf: SNAPSHOT_AT,
      }),
      resolveHold({
        eventId: `condition-alert-deliver:email:${queue.user_id}:${queue.rule_id}:${match.window_start}`,
        type: "forecast_alert",
        payload: holdPayload,
        profileExperience: profile.experience_level,
        asOf: SNAPSHOT_AT,
      }),
      resolveHold({
        eventId: `condition-alert-deliver:push:${queue.user_id}:${queue.rule_id}:${match.window_start}`,
        type: "forecast_alert",
        payload: holdPayload,
        profileExperience: profile.experience_level,
        asOf: SNAPSHOT_AT,
      }),
    ]);

  const sendAt = new Date(queue.send_at);
  const decision = buildSessionDecision(
    match,
    profile.experience_level,
    sendAt,
  );
  const attempts = evidence.attempts;
  const sentRule24h = attempts.filter(
    (attempt) =>
      attempt.status === "sent" &&
      attempt.rule_id === queue.rule_id &&
      Date.parse(attempt.attempted_at) >= SNAPSHOT_AT.getTime() - DAY_MS,
  ).length;
  const sentRule7d = attempts.filter(
    (attempt) => attempt.status === "sent" && attempt.rule_id === queue.rule_id,
  ).length;
  const sentUser7d = attempts.filter(
    (attempt) => attempt.status === "sent" && attempt.user_id === queue.user_id,
  ).length;
  const ruleCap =
    typeof rule.conditions.max_frequency_per_week === "number" &&
    Number.isInteger(rule.conditions.max_frequency_per_week) &&
    rule.conditions.max_frequency_per_week >= 1
      ? Math.min(rule.conditions.max_frequency_per_week, 14)
      : null;
  const emailDedup = evidence.deliveries.some(
    (delivery) =>
      delivery.user_id === queue.user_id &&
      delivery.beach_id === queue.beach_id &&
      delivery.alert_date === queue.alert_date &&
      delivery.channel === "email",
  );
  const pushDedup = evidence.deliveries.some(
    (delivery) =>
      delivery.user_id === queue.user_id &&
      delivery.beach_id === queue.beach_id &&
      delivery.alert_date === queue.alert_date &&
      delivery.channel === "push",
  );
  const dedupeKey = `forecast_alert:${queue.user_id}:${queue.beach_id}:${queue.alert_date}`;
  const activeNotificationDedupe = evidence.notificationEvents.some(
    (event) =>
      event.recipient_user_id === queue.user_id &&
      event.type === "forecast_alert" &&
      event.dedupe_key === dedupeKey &&
      (event.status === "pending" || event.status === "processing"),
  );
  const slotClaimed = evidence.slots.some(
    (slot) =>
      slot.recipient_user_id === queue.user_id &&
      slot.beach_id === queue.beach_id &&
      slot.alert_date === queue.alert_date,
  );
  const quiet = quietHoursFor(rule.conditions);
  const localHour = getLocalHour(
    sendAt,
    resolveNotificationTimezone(profile.timezone),
  );
  const inQuietHours = isInQuietWindow(localHour, quiet.start, quiet.end);
  const devices = evidence.devices.filter(
    (device) => device.user_id === queue.user_id,
  );
  const priorUnresolvedAttempts = attempts.filter(
    (attempt) =>
      attempt.queue_id === queue.id &&
      attempt.status === "skipped_disabled" &&
      attempt.skip_reason === "major_event_hold:hold_state_unavailable",
  ).length;

  return {
    alias,
    queue,
    rule,
    beach,
    profile,
    match,
    forecastEvidence: {
      rowCount: forecast.rowCount,
      newestWriteAt: forecast.newestWriteAt,
      result: forecast.result,
    },
    longEventId,
    longEventLength: longEventId.length,
    longCandidateLength: `notification:${longEventId}`.length,
    longHold,
    shortEventId,
    shortEventLength: shortEventId.length,
    shortCandidateLength: `notification:${shortEventId}`.length,
    shortHold,
    hashedEventId,
    hashedEventLength: hashedEventId.length,
    hashedCandidateLength: `notification:${hashedEventId}`.length,
    hashedHold,
    emailHold,
    pushHold,
    decision,
    gates: {
      sent_false: queue.sent === false,
      rule_enabled_in_db: rule.enabled,
      rule_enabled_delivery_gate: "absent",
      forecast_revalidation: forecast.result,
      profile_present_and_active: profile.deleted_at === null,
      canonical_selection: decision.selection !== null,
      canonical_reason: decision.reasonCode,
      canonical_verdict: decision.verdict,
      delivery_kill_switch: process.env.ALERTS_DELIVERY_ENABLED === "true",
      allowlist_empty: !process.env.ALERTS_DELIVERY_USER_ALLOWLIST,
      sent_rule_24h: sentRule24h,
      sent_rule_7d: sentRule7d,
      rule_weekly_cap: ruleCap,
      sent_user_7d: sentUser7d,
      email_rule_enabled: rule.notify_email,
      email_profile_enabled: profile.notif_email_enabled,
      email_destination_present: Boolean(profile.email?.trim()),
      email_suppression_list_entry: profile.email
        ? evidence.suppressedEmails.has(profile.email.toLowerCase())
        : false,
      email_suppression_list_delivery_gate: "absent",
      email_quiet_hours: inQuietHours,
      email_dedupe_exists: emailDedup,
      push_rule_enabled: rule.notify_push,
      push_profile_enabled: profile.notif_push_enabled,
      push_type_enabled: profile.notif_forecast_alerts,
      push_devices: devices.length,
      push_dedupe_exists: pushDedup,
      notification_active_dedupe_exists: activeNotificationDedupe,
      surf_slot_claimed: slotClaimed,
      prior_unresolved_attempts: priorUnresolvedAttempts,
    },
  };
}

type CapturedNotificationInsert = {
  recipient_user_id: string;
  actor_user_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Json;
  dedupe_key: string | null;
  next_attempt_at: string | null;
};

function createEnqueueClient(capture: {
  inserted: CapturedNotificationInsert | null;
}): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table !== "notification_events") {
        throw new Error(`Unexpected enqueue table: ${table}`);
      }
      return {
        insert(row: CapturedNotificationInsert) {
          capture.inserted = row;
          return {
            select() {
              return {
                async single() {
                  return { data: { id: WORKER_EVENT_ID }, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

type WorkerCapture = {
  notificationAttempts: Array<Record<string, unknown>>;
  alertAttempts: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  eventUpdates: Array<Record<string, unknown>>;
  slotClaims: number;
};

function createWorkerClient(args: {
  event: Record<string, unknown>;
  profile: ProfileRow;
  device: DeviceEvidence;
  capture: WorkerCapture;
}): SupabaseClient<Database> {
  return {
    async rpc(name: string) {
      if (name === "claim_notification_events") {
        return { data: [args.event], error: null };
      }
      if (name === "claim_surf_alert_slot") {
        args.capture.slotClaims++;
        return { data: true, error: null };
      }
      throw new Error(`Unexpected worker RPC: ${name}`);
    },
    from(table: string) {
      if (table === "notification_delivery_attempts") {
        return {
          select() {
            return {
              async in() {
                return { data: [], error: null };
              },
            };
          },
          async insert(rows: Array<Record<string, unknown>>) {
            args.capture.notificationAttempts.push(...rows);
            return { error: null };
          },
        };
      }
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        ...args.profile,
                        // Prevent the research harness from emitting PostHog events.
                        allow_implicit_tracking: false,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "user_devices") {
        return {
          select() {
            return {
              async eq() {
                return { data: [args.device], error: null };
              },
            };
          },
        };
      }
      if (table === "alert_delivery_attempts") {
        return {
          async insert(rows: Array<Record<string, unknown>>) {
            args.capture.alertAttempts.push(...rows);
            return { error: null };
          },
        };
      }
      if (table === "notifications") {
        return {
          async insert(row: Record<string, unknown>) {
            args.capture.notifications.push(row);
            return { error: null };
          },
        };
      }
      if (table === "notification_events") {
        return {
          update(row: Record<string, unknown>) {
            return {
              eq() {
                return {
                  async eq() {
                    args.capture.eventUpdates.push(row);
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected worker table: ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

async function proveEndToEndPush(args: {
  audit: RowAudit;
  evidence: LoadedEvidence;
  resolveHold: ReturnType<typeof holdResolver>;
}): Promise<Record<string, unknown>> {
  const { audit } = args;
  if (audit.alias !== "Q6") throw new Error("End-to-end proof must use Q6");
  if (audit.hashedHold.status !== "allowed") {
    throw new Error("Hashed hold candidate did not resolve allowed");
  }
  if (!audit.decision.selection) {
    throw new Error("Q6 canonical decision did not select a match");
  }
  if (audit.pushHold.status !== "allowed") {
    throw new Error("Q6 push hold did not resolve allowed");
  }

  const device = args.evidence.devices.find(
    (candidate) => candidate.user_id === audit.queue.user_id,
  );
  if (!device) throw new Error("Q6 has no production device evidence");
  const isExpo = /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(
    device.device_token,
  );
  if (!isExpo) throw new Error("Q6 production device is not an Expo token");

  const { title, body, data } = formatPushNotification([audit.match]);
  const enqueueCapture: { inserted: CapturedNotificationInsert | null } = {
    inserted: null,
  };
  const enqueueResult = await enqueueNotification(
    {
      type: "forecast_alert",
      recipientUserId: audit.queue.user_id,
      entityType: "beach",
      entityId: audit.match.beach_id,
      payload: {
        alert_date: audit.queue.alert_date,
        title,
        body,
        beach_id: data.beach_id,
        forecast_at:
          data.forecast_at ?? audit.match.best_hour ?? audit.match.window_start,
        matches: [
          {
            beach_id: audit.match.beach_id,
            beach_name: audit.match.beach_name,
            window_start: audit.match.window_start,
            window_end: audit.match.window_end,
            best_hour: audit.match.best_hour,
          },
        ],
        policy_context: policyContextFor(audit.match),
        session_decision: audit.decision,
        queue_items: [
          { queue_id: audit.queue.id, rule_id: audit.queue.rule_id },
        ],
      },
      dedupeKey:
        `forecast_alert:${audit.queue.user_id}:${audit.queue.beach_id}:` +
        audit.queue.alert_date,
    },
    createEnqueueClient(enqueueCapture),
  );
  if (!enqueueResult.enqueued || !enqueueCapture.inserted) {
    throw new Error(
      `In-memory enqueue failed: ${JSON.stringify(enqueueResult)}`,
    );
  }

  const inserted = enqueueCapture.inserted;
  const workerEvent = {
    id: WORKER_EVENT_ID,
    recipient_user_id: inserted.recipient_user_id,
    actor_user_id: inserted.actor_user_id,
    type: inserted.type,
    entity_type: inserted.entity_type,
    entity_id: inserted.entity_id,
    payload: inserted.payload,
    dedupe_key: inserted.dedupe_key,
    status: "processing",
    skip_reason: null,
    created_at: new Date(audit.queue.send_at).toISOString(),
    processed_at: null,
    claimed_at: new Date(audit.queue.send_at).toISOString(),
    attempt_count: 1,
    next_attempt_at: inserted.next_attempt_at,
    last_attempt_at: null,
    claim_token: null,
    cancel_reason: null,
    last_error: null,
  };

  const workerCapture: WorkerCapture = {
    notificationAttempts: [],
    alertAttempts: [],
    notifications: [],
    eventUpdates: [],
    slotClaims: 0,
  };
  const syntheticDevice: DeviceEvidence = {
    user_id: audit.queue.user_id,
    device_token: "ExpoPushToken[research-redacted]",
    platform: device.platform,
    app_version: device.app_version,
    build_number: device.build_number,
  };
  const workerClient = createWorkerClient({
    event: workerEvent,
    profile: audit.profile,
    device: syntheticDevice,
    capture: workerCapture,
  });

  const originalFetch = globalThis.fetch;
  const expoCalls: Array<{ url: string; messageCount: number }> = [];
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    if (url !== EXPO_PUSH_URL) return originalFetch(input, init);
    const bodyValue =
      typeof init?.body === "string" ? JSON.parse(init.body) : [];
    const messages = Array.isArray(bodyValue) ? bodyValue : [bodyValue];
    expoCalls.push({ url, messageCount: messages.length });
    return new Response(
      JSON.stringify({ data: messages.map(() => ({ status: "ok" })) }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const workerAt = new Date(Date.parse(audit.queue.send_at) + 5 * 60 * 1000);
    const summary = await processPendingEvents(workerClient, {
      now: workerAt,
      fcm: {} as never,
      resolveMajorEventHold: args.resolveHold,
    });
    const providerBoundaryReached =
      expoCalls.length === 1 &&
      expoCalls[0]?.messageCount === 1 &&
      workerCapture.notificationAttempts.some(
        (attempt) => attempt.channel === "push" && attempt.status === "sent",
      );
    if (!providerBoundaryReached) {
      throw new Error(
        "Worker did not reach the intercepted Expo send boundary",
      );
    }

    return {
      queue_alias: audit.alias,
      production_device_transport: "expo",
      canonical_hold_after_hash: audit.hashedHold.status,
      canonical_decision: {
        verdict: audit.decision.verdict,
        reason: audit.decision.reasonCode,
        selected: audit.decision.selection !== null,
      },
      producer_push_hold: audit.pushHold.status,
      enqueue_result: enqueueResult,
      worker_summary: summary,
      surf_slot_claim_calls: workerCapture.slotClaims,
      expo_http_send_calls: expoCalls,
      notification_attempts: workerCapture.notificationAttempts.map(
        (attempt) => ({
          channel: attempt.channel,
          status: attempt.status,
        }),
      ),
      legacy_alert_attempts: workerCapture.alertAttempts.map((attempt) => ({
        channel: attempt.channel,
        status: attempt.status,
        skip_reason: attempt.skip_reason,
      })),
      in_app_rows: workerCapture.notifications.length,
      provider_boundary_reached: providerBoundaryReached,
      provider_response_simulated: true,
      real_provider_network_requests: 0,
      production_mutations: 0,
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function printableHold(
  result: NotificationMajorEventHoldResult,
): Record<string, unknown> {
  return {
    status: result.status,
    ...(result.status === "suppressed"
      ? { reason: result.reasonCode, audit_code: result.auditCode }
      : {}),
    candidate_id:
      result.status === "not_applicable"
        ? null
        : (result.candidate?.candidateId ?? null),
  };
}

function printableAudit(audit: RowAudit): Record<string, unknown> {
  return {
    alias: audit.alias,
    queue_id: audit.queue.id,
    created_at: audit.queue.created_at,
    send_at: audit.queue.send_at,
    user_skill: audit.profile.experience_level,
    beach_skill: audit.beach.skill_level,
    channels: {
      email: audit.rule.notify_email,
      push: audit.rule.notify_push,
    },
    forecast: audit.forecastEvidence,
    route_event_id_length: audit.longEventLength,
    hold_candidate_id_length: audit.longCandidateLength,
    long_hold: printableHold(audit.longHold),
    short_event_id_length: audit.shortEventLength,
    short_candidate_id_length: audit.shortCandidateLength,
    short_hold: printableHold(audit.shortHold),
    hashed_event_id_length: audit.hashedEventLength,
    hashed_candidate_id_length: audit.hashedCandidateLength,
    hashed_hold: printableHold(audit.hashedHold),
    email_hold: printableHold(audit.emailHold),
    push_hold: printableHold(audit.pushHold),
    canonical: {
      verdict: audit.decision.verdict,
      reason: audit.decision.reasonCode,
      selection: audit.decision.selection !== null,
    },
    gates: audit.gates,
  };
}

function isRealMeasurementProfile(profile: MeasurementProfileRow): boolean {
  if (profile.is_mock !== false) return false;
  if (profile.deleted_at !== null) return false;
  if (profile.email !== null && TEST_EMAIL_PATTERN.test(profile.email)) {
    return false;
  }
  return true;
}

function localDateAt(value: Date, timezone: string): string {
  return value.toLocaleDateString("en-CA", { timeZone: timezone });
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  while (cursor.getTime() <= endMs) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function stableUserKey(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function latestTimestamp(
  current: string | null,
  candidate: unknown,
): string | null {
  if (typeof candidate !== "string") return current;
  const candidateMs = Date.parse(candidate);
  if (!Number.isFinite(candidateMs)) return current;
  if (current === null || candidateMs > Date.parse(current)) return candidate;
  return current;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await fn(values[index]);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      async () => worker(),
    ),
  );
  return results;
}

async function fetchForecastRowsForBeach(
  client: SupabaseClient<Database>,
  beachId: string,
  queryStart: string,
): Promise<EnhancedForecastAlertRow[]> {
  const rows: EnhancedForecastAlertRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .gte("forecast_at", queryStart)
      .order("forecast_at", { ascending: true })
      .range(offset, offset + FORECAST_PAGE_SIZE - 1);
    if (error) {
      throw new Error(
        `measurement enhanced_forecasts read failed for ${beachId}: ${error.message}`,
      );
    }
    const page = (data ?? []) as unknown as EnhancedForecastAlertRow[];
    rows.push(...page);
    if (page.length < FORECAST_PAGE_SIZE) break;
    offset += FORECAST_PAGE_SIZE;
  }
  return rows;
}

async function loadMeasurementEvidence(
  client: SupabaseClient<Database>,
  snapshotAt: Date,
): Promise<MeasurementEvidence> {
  const { data: allRuleData, error: rulesError } = await client
    .from("alert_rules")
    .select(
      "id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at",
    )
    .eq("enabled", true);
  if (rulesError) {
    throw new Error(`measurement alert_rules read failed: ${rulesError.message}`);
  }
  const allRules = (allRuleData ?? []) as unknown as MeasurementRuleRow[];
  const evaluatorRules = allRules.filter(
    (rule) => rule.preset_type !== "similarity_match",
  );
  const userIds = [...new Set(evaluatorRules.map((rule) => rule.user_id))];
  const [profilesResult, entitlementsResult] = await Promise.all([
    client
      .from("profiles")
      .select(
        "id, email, is_mock, deleted_at, analytics_is_real_user, is_system_account, home_beach_id, notif_forecast_alerts, experience_level",
      )
      .in("id", userIds),
    client
      .from("user_entitlements")
      .select("user_id, is_pro, is_trialing, billing_issue, expires_at")
      .in("user_id", userIds),
  ]);
  if (profilesResult.error) {
    throw new Error(
      `measurement profiles read failed: ${profilesResult.error.message}`,
    );
  }
  if (entitlementsResult.error) {
    throw new Error(
      `measurement user_entitlements read failed: ${entitlementsResult.error.message}`,
    );
  }

  const allProfiles = (profilesResult.data ??
    []) as unknown as MeasurementProfileRow[];
  const allProfilesById = new Map(
    allProfiles.map((profile) => [profile.id, profile]),
  );
  const profilesById = new Map(
    allProfiles
      .filter(isRealMeasurementProfile)
      .map((profile) => [profile.id, profile]),
  );
  const rules = evaluatorRules.filter((rule) =>
    profilesById.has(rule.user_id),
  );
  const entitlementsByUserId = new Map(
    ((entitlementsResult.data ??
      []) as unknown as MeasurementEntitlementRow[]).map((row) => [
      row.user_id,
      row,
    ]),
  );

  const activeRules: MeasurementRuleRow[] = [];
  let excludedAlertsDisabled = 0;
  let excludedByEntitlementCap = 0;
  const rulesByUser = new Map<string, MeasurementRuleRow[]>();
  for (const rule of rules) {
    const userRules = rulesByUser.get(rule.user_id) ?? [];
    userRules.push(rule);
    rulesByUser.set(rule.user_id, userRules);
  }
  for (const [userId, userRules] of rulesByUser) {
    const profile = profilesById.get(userId);
    if (!profile) continue;
    if (!profile.notif_forecast_alerts) {
      excludedAlertsDisabled += userRules.length;
      continue;
    }
    const tier = resolveEntitlement(
      userId,
      entitlementsByUserId.get(userId) ?? null,
    );
    const sorted = [...userRules].sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at) ||
        left.id.localeCompare(right.id),
    );
    activeRules.push(...sorted.slice(0, CAPS[tier].totalRules));
    excludedByEntitlementCap += Math.max(
      0,
      sorted.length - CAPS[tier].totalRules,
    );
  }

  const beachIds = new Set(activeRules.map((rule) => rule.beach_id));
  for (const rule of activeRules) {
    const homeBeachId = profilesById.get(rule.user_id)?.home_beach_id;
    if (homeBeachId) beachIds.add(homeBeachId);
  }
  const { data: beachData, error: beachesError } = await client
    .from("beaches")
    .select(
      "id, name, slug, timezone, lat, lon, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, swell_window_center_deg, swell_window_halfwidth_deg, break_type, skill_level",
    )
    .in("id", [...beachIds]);
  if (beachesError) {
    throw new Error(`measurement beaches read failed: ${beachesError.message}`);
  }
  const beachesById = new Map(
    ((beachData ?? []) as unknown as BeachRow[]).map((beach) => [
      beach.id,
      beach,
    ]),
  );

  const forecastBeachIds = [...new Set(activeRules.map((rule) => rule.beach_id))];
  const queryStart = new Date(snapshotAt.getTime() - DAY_MS).toISOString();
  const forecastResults = await mapWithConcurrency(
    forecastBeachIds,
    8,
    async (beachId) => ({
      beachId,
      rows: await fetchForecastRowsForBeach(client, beachId, queryStart),
    }),
  );
  const forecastRowsByBeachId = new Map(
    forecastResults.map(({ beachId, rows }) => [beachId, rows]),
  );
  const allForecastRows = forecastResults.flatMap(({ rows }) => rows);
  let newestWriteAt: string | null = null;
  let earliestForecastAt: string | null = null;
  let latestForecastAt: string | null = null;
  for (const row of allForecastRows) {
    const forecastMs = Date.parse(row.forecast_at);
    if (forecastMs >= snapshotAt.getTime()) {
      if (
        earliestForecastAt === null ||
        forecastMs < Date.parse(earliestForecastAt)
      ) {
        earliestForecastAt = row.forecast_at;
      }
      if (
        latestForecastAt === null ||
        forecastMs > Date.parse(latestForecastAt)
      ) {
        latestForecastAt = row.forecast_at;
      }
    }
    const raw = row as Record<string, unknown>;
    newestWriteAt = latestTimestamp(
      newestWriteAt,
      raw.updated_at ?? raw.created_at,
    );
  }

  return {
    rules,
    activeRules,
    profilesById,
    beachesById,
    forecastRowsByBeachId,
    exclusions: {
      enabled_rules_all: allRules.length,
      similarity_match_separate_pipeline: allRules.length - evaluatorRules.length,
      missing_profile: evaluatorRules.filter(
        (rule) => !allProfilesById.has(rule.user_id),
      ).length,
      is_mock_not_false: evaluatorRules.filter((rule) => {
        const profile = allProfilesById.get(rule.user_id);
        return profile !== undefined && profile.is_mock !== false;
      }).length,
      deleted_profile: evaluatorRules.filter((rule) => {
        const profile = allProfilesById.get(rule.user_id);
        return profile !== undefined && profile.deleted_at !== null;
      }).length,
      test_local_example_email: evaluatorRules.filter((rule) => {
        const email = allProfilesById.get(rule.user_id)?.email;
        return email !== null && email !== undefined && TEST_EMAIL_PATTERN.test(email);
      }).length,
      null_email_rules_kept: rules.filter(
        (rule) => profilesById.get(rule.user_id)?.email === null,
      ).length,
      profile_alerts_disabled: excludedAlertsDisabled,
      entitlement_cap: excludedByEntitlementCap,
      active_evaluator_rules: activeRules.length,
      active_evaluator_users: new Set(activeRules.map((rule) => rule.user_id)).size,
    },
    forecast: {
      rows: allForecastRows.length,
      beaches: forecastBeachIds.length,
      earliestForecastAt,
      latestForecastAt,
      newestWriteAt,
    },
  };
}

function modeledSendAt(
  windowStart: string,
  dateStart: string,
  beach: BeachRow,
  snapshotAt: Date,
): Date {
  const { sunrise } = getDaylightWindow(
    beach.lat,
    beach.lon,
    new Date(dateStart),
  );
  const twoHoursBefore = new Date(Date.parse(windowStart) - 2 * 60 * 60 * 1000);
  const clamped = twoHoursBefore < sunrise ? sunrise : twoHoursBefore;
  return clamped < snapshotAt ? snapshotAt : clamped;
}

function percent(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(1));
}

function cadenceStats(
  records: MeasurementRecord[],
  horizonWeeks: number,
  inScopeUsers: number,
): Record<string, unknown> {
  const deduped = new Map<string, MeasurementRecord>();
  for (const record of records) {
    const key = `${record.user_key}:${record.beach_id}:${record.evaluation_date}`;
    const current = deduped.get(key);
    if (current === undefined || (record.best_score ?? 0) > (current.best_score ?? 0)) {
      deduped.set(key, record);
    }
  }
  const alertRecords = [...deduped.values()];
  const reachedUsers = new Set(alertRecords.map((record) => record.user_key));
  const alertsByDate: Record<string, number> = {};
  for (const record of alertRecords) {
    alertsByDate[record.evaluation_date] =
      (alertsByDate[record.evaluation_date] ?? 0) + 1;
  }
  return {
    eligible_rule_windows: records.length,
    modeled_user_beach_day_alerts: alertRecords.length,
    distinct_users: reachedUsers.size,
    alerts_per_reached_user_per_week:
      reachedUsers.size === 0 || horizonWeeks <= 0
        ? 0
        : Number(
            (alertRecords.length / reachedUsers.size / horizonWeeks).toFixed(2),
          ),
    alerts_per_in_scope_user_per_week:
      inScopeUsers === 0 || horizonWeeks <= 0
        ? 0
        : Number((alertRecords.length / inScopeUsers / horizonWeeks).toFixed(2)),
    alerts_by_evaluation_date: alertsByDate,
  };
}

function volumeScenario(
  matchedRecords: MeasurementRecord[],
  args: {
    gatePresetsToGo: boolean;
    horizonWeeks: number;
    inScopeUsers: number;
  },
): Record<string, unknown> {
  const eligible = matchedRecords.filter((record) => {
    if (record.safety_rejection !== null) return false;
    if (record.preset_type === null) return true;
    return !args.gatePresetsToGo || record.verdict === "go";
  });
  const presets = eligible.filter((record) => record.preset_type !== null);
  const custom = eligible.filter((record) => record.preset_type === null);
  return {
    total: cadenceStats(eligible, args.horizonWeeks, args.inScopeUsers),
    presets: cadenceStats(presets, args.horizonWeeks, args.inScopeUsers),
    custom: cadenceStats(custom, args.horizonWeeks, args.inScopeUsers),
  };
}

function summarizeMeasurement(
  evidence: MeasurementEvidence,
  records: MeasurementRecord[],
  snapshotAt: Date,
): Record<string, unknown> {
  const matchedRecords = records.filter((record) => record.matched);
  const matrixGroups = new Map<string, MeasurementRecord[]>();
  for (const record of matchedRecords) {
    const key = record.preset_type ?? "custom";
    const group = matrixGroups.get(key) ?? [];
    group.push(record);
    matrixGroups.set(key, group);
  }
  const matrixKeys = [
    ...new Set(
      evidence.activeRules.map((rule) => rule.preset_type ?? "custom"),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const matrix = Object.fromEntries(
    matrixKeys.map((key) => {
        const group = matrixGroups.get(key) ?? [];
        const counts = {
          go: group.filter((record) => record.verdict === "go").length,
          maybe: group.filter((record) => record.verdict === "maybe").length,
          no: group.filter((record) => record.verdict === "no").length,
        };
        const nonGoReasons: Record<string, number> = {};
        for (const record of group.filter((candidate) => candidate.verdict !== "go")) {
          const reason = record.safety_rejection ?? record.reason_code ?? "unknown";
          nonGoReasons[reason] = (nonGoReasons[reason] ?? 0) + 1;
        }
        return [
          key,
          {
            matches: group.length,
            go: { count: counts.go, pct: percent(counts.go, group.length) },
            maybe: {
              count: counts.maybe,
              pct: percent(counts.maybe, group.length),
            },
            no: { count: counts.no, pct: percent(counts.no, group.length) },
            non_go_reason_codes: nonGoReasons,
          },
        ];
      }),
  );

  const safetyGroups = {
    presets: matchedRecords.filter(
      (record) => record.preset_type !== null && record.safety_rejection !== null,
    ),
    custom: matchedRecords.filter(
      (record) => record.preset_type === null && record.safety_rejection !== null,
    ),
  };
  const safety = Object.fromEntries(
    Object.entries(safetyGroups).map(([key, group]) => {
      const reasons: Record<string, number> = {};
      for (const record of group) {
        const reason = record.safety_rejection ?? "unknown";
        reasons[reason] = (reasons[reason] ?? 0) + 1;
      }
      return [key, { windows: group.length, reasons }];
    }),
  );

  const presetGroups = matrixKeys
    .filter((presetType) => presetType !== "custom")
    .map(
      (presetType) =>
        [presetType, matrixGroups.get(presetType) ?? []] as const,
    );
  const disagreement = Object.fromEntries(
    presetGroups.map(([presetType, group]) => {
      const safetyRejected = group.filter(
        (record) => record.safety_rejection !== null,
      ).length;
      const qualityDisagreement = group.filter(
        (record) =>
          record.safety_rejection === null && record.verdict !== "go",
      ).length;
      const qualityEligible = group.length - safetyRejected;
      return [
        presetType,
        {
          matches: group.length,
          go: group.filter((record) => record.verdict === "go").length,
          maybe: group.filter((record) => record.verdict === "maybe").length,
          no: group.filter((record) => record.verdict === "no").length,
          safety_rejected: safetyRejected,
          quality_eligible: qualityEligible,
          quality_disagreement: qualityDisagreement,
          quality_disagreement_pct: percent(qualityDisagreement, group.length),
          quality_disagreement_pct_of_safety_eligible: percent(
            qualityDisagreement,
            qualityEligible,
          ),
        },
      ];
    }),
  );

  const mellow = matrixGroups.get("mellow_session") ?? [];
  const horizonEndMs = evidence.forecast.latestForecastAt
    ? Date.parse(evidence.forecast.latestForecastAt)
    : snapshotAt.getTime();
  const horizonWeeks = Math.max(
    0,
    (horizonEndMs - snapshotAt.getTime()) / WEEK_MS,
  );
  const inScopeUsers = new Set(
    evidence.activeRules.map((rule) => rule.user_id),
  ).size;
  const holdStatuses: Record<string, number> = {};
  for (const record of matchedRecords) {
    const status = record.hold_status ?? "not_run";
    holdStatuses[status] = (holdStatuses[status] ?? 0) + 1;
  }

  return {
    snapshot_at: snapshotAt.toISOString(),
    measured_vs_modeled: {
      measured:
        "Rule matching, utility verdicts, reason codes, and safety checks use the production rows visible at snapshot_at.",
      modeled:
        "Future rule-day opportunities replay the current evaluator over the visible horizon; user-beach-day volume deduplicates multiple matching rules for the same user, beach, and local date.",
    },
    scope: {
      ...evidence.exclusions,
      rule_day_records: records.length,
      matched_rule_windows: matchedRecords.length,
      unmatched_rule_days: records.length - matchedRecords.length,
    },
    forecast: {
      ...evidence.forecast,
      freshness_hours:
        evidence.forecast.newestWriteAt === null
          ? null
          : Number(
              (
                (snapshotAt.getTime() -
                  Date.parse(evidence.forecast.newestWriteAt)) /
                (60 * 60 * 1000)
              ).toFixed(2),
            ),
      horizon_days: Number((horizonWeeks * 7).toFixed(2)),
      horizon_weeks: Number(horizonWeeks.toFixed(3)),
      moving_target_note:
        "Forecasts are the latest rows visible at snapshot_at, not the rows that will exist at each future evaluator or send_at.",
    },
    hashed_hold_control: {
      transform: "sha256:<64 hex chars> before the notification: prefix",
      max_candidate_length: Math.max(
        0,
        ...matchedRecords.map(
          (record) => record.hashed_hold_candidate_length ?? 0,
        ),
      ),
      statuses: holdStatuses,
    },
    preset_type_by_verdict: matrix,
    mellow_session: {
      enabled_rules: evidence.activeRules.filter(
        (rule) => rule.preset_type === "mellow_session",
      ).length,
      matches: mellow.length,
      matched_rules: new Set(mellow.map((record) => record.rule_id)).size,
      matched_users: new Set(mellow.map((record) => record.user_key)).size,
      go: mellow.filter((record) => record.verdict === "go").length,
      go_rules: new Set(
        mellow
          .filter((record) => record.verdict === "go")
          .map((record) => record.rule_id),
      ).size,
      go_users: new Set(
        mellow
          .filter((record) => record.verdict === "go")
          .map((record) => record.user_key),
      ).size,
      go_share_pct: percent(
        mellow.filter((record) => record.verdict === "go").length,
        mellow.length,
      ),
    },
    volume: {
      proposed_preset_go_custom_ungated: volumeScenario(matchedRecords, {
        gatePresetsToGo: true,
        horizonWeeks,
        inScopeUsers,
      }),
      presets_ungated_current_behavior: volumeScenario(matchedRecords, {
        gatePresetsToGo: false,
        horizonWeeks,
        inScopeUsers,
      }),
      definition:
        "eligible_rule_windows counts rule-day matches; modeled_user_beach_day_alerts collapses same-user/same-beach/same-date rule matches and is the report's cadence proxy.",
    },
    safety_rejections: safety,
    preset_canonical_disagreement: disagreement,
    approximations: [
      "The live evaluator runs once daily and scans only the user's current local date. This replay applies its matcher to every visible future local date using one fixed forecast snapshot.",
      "Modeled send volume does not simulate hourly cross-beach canonical batching, 24-hour/weekly attempt caps, channel preferences, device availability, provider acceptance, or forecast revalidation at send time.",
      "Safety stays fail-closed for both preset and custom rules. Custom ungated means quality verdicts maybe/no do not gate; it does not override skill or major-event safety.",
      "similarity_match is excluded because condition-alert-evaluate explicitly excludes it and a separate pipeline evaluates it.",
    ],
  };
}

async function measureFullForecastHorizon(
  client: SupabaseClient<Database>,
  resolveHold: ReturnType<typeof holdResolver>,
  snapshotAt: Date,
): Promise<{ summary: Record<string, unknown>; records: MeasurementRecord[] }> {
  const evidence = await loadMeasurementEvidence(client, snapshotAt);
  const records: MeasurementRecord[] = [];
  const matchedInputs: Array<{
    recordIndex: number;
    match: MatchingWindow;
    profile: MeasurementProfileRow;
    sendAt: Date;
  }> = [];
  const latestForecastAt = evidence.forecast.latestForecastAt;
  if (!latestForecastAt) {
    return { summary: summarizeMeasurement(evidence, records, snapshotAt), records };
  }

  for (const rule of evidence.activeRules) {
    const profile = evidence.profilesById.get(rule.user_id);
    const beach = evidence.beachesById.get(rule.beach_id);
    if (!profile || !beach) continue;
    const homeTimezone = profile.home_beach_id
      ? (evidence.beachesById.get(profile.home_beach_id)?.timezone ??
        "America/New_York")
      : "America/New_York";
    const beachTimezone = beach.timezone ?? "America/Los_Angeles";
    const dates = enumerateDates(
      localDateAt(snapshotAt, homeTimezone),
      localDateAt(new Date(latestForecastAt), homeTimezone),
    );
    const beachRows = evidence.forecastRowsByBeachId.get(rule.beach_id) ?? [];
    for (const evaluationDate of dates) {
      const { start, end } = getUtcDayBounds(evaluationDate, beachTimezone);
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      const dayRows = beachRows.filter((row) => {
        const forecastMs = Date.parse(row.forecast_at);
        return forecastMs >= startMs && forecastMs < endMs;
      });
      const fresh = selectFreshAlertWindow({
        conditions: rule.conditions,
        forecastRows: dayRows,
        beach: {
          id: beach.id,
          name: beach.name,
          slug: beach.slug,
          timezone: beachTimezone,
          lat: beach.lat,
          lon: beach.lon,
          wind_offshore_deg: beach.wind_offshore_deg,
          wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
          aspect_deg: beach.aspect_deg,
          preferred_tide_ft_min: beach.preferred_tide_ft_min,
          preferred_tide_ft_max: beach.preferred_tide_ft_max,
          preferred_tide_direction: beach.preferred_tide_direction,
          swell_window_center_deg: beach.swell_window_center_deg,
          swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
          break_type: beach.break_type,
          skill_level: beach.skill_level,
        },
        now: snapshotAt,
      });
      const record: MeasurementRecord = {
        rule_id: rule.id,
        preset_type: rule.preset_type,
        user_key: stableUserKey(rule.user_id),
        beach_id: beach.id,
        beach_name: beach.name,
        evaluation_date: evaluationDate,
        forecast_rows: dayRows.length,
        matched: fresh !== null,
        window_start: fresh?.window_start ?? null,
        window_end: fresh?.window_end ?? null,
        best_hour: fresh?.best_hour ?? null,
        best_score: fresh?.best_score ?? null,
        modeled_send_at: null,
        verdict: null,
        reason_code: null,
        safety_rejection: null,
        hold_status: null,
        hold_reason_code: null,
        hashed_hold_candidate_length: null,
      };
      const recordIndex = records.push(record) - 1;
      if (!fresh) continue;
      const sendAt = modeledSendAt(fresh.window_start, start, beach, snapshotAt);
      record.modeled_send_at = sendAt.toISOString();
      matchedInputs.push({
        recordIndex,
        profile,
        sendAt,
        match: {
          rule_id: rule.id,
          rule_name: rule.name,
          beach_id: beach.id,
          beach_name: beach.name,
          beach_slug: beach.slug,
          beach_skill_level: beach.skill_level,
          beach_timezone: beachTimezone,
          window_start: fresh.window_start,
          window_end: fresh.window_end,
          best_hour: fresh.best_hour,
          best_score: fresh.best_score,
          conditions_snapshot: fresh.conditions_snapshot,
          notify_email: rule.notify_email,
          notify_push: rule.notify_push,
        },
      });
    }
  }

  const resolved = await mapWithConcurrency(matchedInputs, 8, async (input) => {
    const longEventId =
      `condition-alert-deliver:canonical:${input.profile.id}:` +
      canonicalAlertCandidateId(input.match);
    const hashedEventId = sha256EventId(longEventId);
    const hold = await resolveHold({
      eventId: hashedEventId,
      type: "forecast_alert",
      payload: {
        beach_id: input.match.beach_id,
        forecast_at: input.match.best_hour,
        policy_context: policyContextFor(input.match),
      },
      profileExperience: input.profile.experience_level,
      asOf: snapshotAt,
    });
    const decision = buildSessionDecision(
      input.match,
      input.profile.experience_level,
      input.sendAt,
    );
    let safetyRejection: string | null = null;
    if (hold.status === "suppressed") {
      safetyRejection = hold.reasonCode;
    } else if (hold.status !== "allowed") {
      safetyRejection = `hold_${hold.status}`;
    } else if (decision.skillEligibility.state !== "eligible") {
      safetyRejection =
        decision.skillEligibility.reasonCodes.find((reason) =>
          SAFETY_REASON_CODES.has(reason),
        ) ?? decision.reasonCode;
    }
    return { input, hold, decision, hashedEventId, safetyRejection };
  });

  for (const result of resolved) {
    const record = records[result.input.recordIndex];
    record.verdict = result.decision.verdict;
    record.reason_code = result.decision.reasonCode;
    record.safety_rejection = result.safetyRejection;
    record.hold_status = result.hold.status;
    record.hold_reason_code =
      result.hold.status === "suppressed" ? result.hold.reasonCode : null;
    record.hashed_hold_candidate_length =
      `notification:${result.hashedEventId}`.length;
  }

  return {
    summary: summarizeMeasurement(evidence, records, snapshotAt),
    records,
  };
}

async function main(): Promise<void> {
  const runStartedAt = new Date();
  if (process.env.ALERTS_DELIVERY_ENABLED !== "true") {
    throw new Error("Set ALERTS_DELIVERY_ENABLED=true to mirror production");
  }
  const client = createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const evidence = await loadEvidence(client);
  const evaluateCandidates = createHoldEvaluator(client);
  const resolveHold = holdResolver(evaluateCandidates);
  const audits: RowAudit[] = [];
  for (const queue of evidence.queueRows) {
    audits.push(await auditRow(client, evidence, queue, resolveHold));
  }

  const q6 = audits.find((audit) => audit.alias === "Q6");
  if (!q6) throw new Error("Missing Q6 audit");
  const endToEnd = await proveEndToEndPush({
    audit: q6,
    evidence,
    resolveHold,
  });
  const measurement = await measureFullForecastHorizon(
    client,
    resolveHold,
    runStartedAt,
  );

  console.log("=== REPRODUCTION ===");
  console.log(
    JSON.stringify(
      {
        control_snapshot_at: SNAPSHOT_AT.toISOString(),
        run_started_at: runStartedAt.toISOString(),
        forecast_note:
          "Forecast rows are the latest rows visible at run_started_at and are projected through each row's scheduled send_at.",
        production_reads:
          "SELECT + STABLE resolve_active_regional_recommendation_holds RPC",
        production_mutations: 0,
        rows: audits.map(printableAudit),
      },
      null,
      2,
    ),
  );
  console.log("=== END_TO_END_Q6 ===");
  console.log(JSON.stringify(endToEnd, null, 2));
  console.log("=== FULL_HORIZON_MEASUREMENT ===");
  console.log(JSON.stringify(measurement.summary, null, 2));
  if (process.env.ALERT_MEASUREMENT_INCLUDE_RECORDS === "true") {
    console.log("=== FULL_HORIZON_RECORDS ===");
    console.log(JSON.stringify(measurement.records, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
