// app/api/cron/condition-alert-deliver/route.ts
//
// Delivery cron — runs hourly (`0 * * * *`).
// Reads due items from alert_queue, consolidates per user, sends email + push.
// Cadence relaxed from `*/15 * * * *` on 2026-05-02 — initial-rollout latency budget is
// 60 min from evaluator → delivery, acceptable for surf condition alerts.
// Re-tighten if user-volume or feedback warrants it.
//
// Hardened (Task 4) with:
//   - FORECAST_ALERT_DELIVERY_ENABLED forecast send switch (default off)
//   - ALERTS_DELIVERY_ENABLED legacy similarity-alert send switch
//   - ALERTS_DELIVERY_USER_ALLOWLIST (comma-separated user_ids; empty = all)
//   - Per-(queue_id, channel) row in `alert_delivery_attempts` for every
//     decision (sent, skipped_*, failed_*).
//
// Forecast shadow mode runs hold, canonical, and channel checks, records the
// outcome, and consumes queue rows without calling an outbound provider.

import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withCronOutcome } from "@/lib/cron/outcome";
import {
  sendEmail,
  MAIL_FROM,
  MAIL_REPLY_TO,
  getBaseUrl,
} from "@/lib/mailer/client";
import {
  buildConditionsLine,
  ConsolidatedAlertEmail,
} from "@/lib/mailer/templates/ConsolidatedAlertEmail";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import {
  consolidateQueueItems,
  type AlertRevalidationBeachMeta,
  type QueueItemWithMeta,
} from "@/lib/alerts/payload-builder";
import { buildConsolidatedSubject } from "@/lib/alerts/consolidated-subject";
import { formatPushNotification } from "@/lib/alerts/push-formatter";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import {
  generateDisableToken,
  generateEmailUnsubscribeToken,
} from "@/lib/alerts/email-token";
import type { AttemptStatus } from "@/lib/alerts/throttle";
import { cooldownDecision, weeklyCapDecision } from "@/lib/alerts/throttle";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import { getLocalHour } from "@/lib/utils/timezone-utils";
import {
  DEFAULT_QUIET,
  isInQuietWindow,
  resolveNotificationTimezone,
} from "@/lib/notifications/quiet-hours";
import {
  selectFreshAlertWindow,
  type EnhancedForecastAlertRow,
} from "@/lib/alerts/revalidate-alert-window";
import type { AlertConditions } from "@/lib/alerts/types";
import type { MatchingWindow } from "@/lib/alerts/types";
import { isForecastAlertDeliveryEnabled } from "@/lib/flags/forecast-alert-delivery";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";
import {
  resolveNotificationMajorEventHold,
  type PositiveRecommendationPolicyContext,
} from "@/lib/recommendations/major-event-hold/adapters/notification";
import {
  buildCanonicalDecisionFromAlertMatches,
  canonicalAlertCandidateId,
  parseCanonicalSessionDecision,
  type CanonicalSessionDecision,
} from "@/lib/recommendations/canonical-decision";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CONTEXT_TAG = "[condition-alert-deliver]";
const HOLD_STATE_UNAVAILABLE_MAX_ATTEMPTS = 3;

const QUEUE_MARK_REASONS = [
  "delivered",
  "stale",
  "below_score_floor",
  "major_event_hold",
  "canonical_safety_rejected",
  "shadow_withheld",
  "delivery_disabled",
  "allowlist_excluded",
  "cooldown",
  "user_cap",
  "channel_disabled",
  "missing_destination",
  "deduplicated",
  "no_enabled_channels",
  "mixed_deliberate_skip",
  "orphaned_profile",
  "failed_delivery",
  "invalid_payload",
  "unrecorded_consumption",
  "hold_state_unavailable_retry_exhausted",
] as const;

type QueueMarkReason = (typeof QUEUE_MARK_REASONS)[number];

/**
 * Minimum best_score worth interrupting someone for. Rules match on thresholds, which
 * says a session is acceptable, not that it is worth the drive. In the 7 days after the
 * 2026-08-10 pipeline repair, 9 of 56 queued alerts scored below this — the weakest 0.09.
 */
const ALERT_MIN_DELIVERABLE_SCORE = 0.3;

type RecordedAttempt = {
  channel: Channel;
  status: AttemptStatus;
  skipReason: string | null;
};

type ForecastAlertShadowOutcome = {
  status: "shadow_withheld";
  verdict: CanonicalSessionDecision["verdict"];
  reason_code: CanonicalSessionDecision["reasonCode"];
  preset_type: string | null;
  would_use_channels: Channel[];
};

function createQueueMarkedByReason(): Record<QueueMarkReason, number> {
  return Object.fromEntries(
    QUEUE_MARK_REASONS.map((reason) => [reason, 0]),
  ) as Record<QueueMarkReason, number>;
}

const DEGRADED_QUEUE_MARK_REASONS = new Set<QueueMarkReason>([
  "orphaned_profile",
  "failed_delivery",
  "invalid_payload",
  "unrecorded_consumption",
  "hold_state_unavailable_retry_exhausted",
]);

type Channel = "email" | "push";

type RuleEmbed = {
  name: string;
  preset_type: string | null;
  notify_email: boolean;
  notify_push: boolean;
  conditions?: AlertConditions | null;
};

type BeachEmbed = {
  id?: string;
  name: string;
  slug?: string | null;
  timezone?: string | null;
  lat?: number | null;
  lon?: number | null;
  wind_offshore_deg?: number | null;
  wind_offshore_tol_deg?: number | null;
  aspect_deg?: number | null;
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
  preferred_tide_direction?: string | null;
  swell_window_center_deg?: number | null;
  swell_window_halfwidth_deg?: number | null;
  break_type?: string | null;
  skill_level?: string | null;
};

type AlertQueueRowWithBestScore = {
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
  conditions_snapshot: unknown;
  sent: boolean;
  alert_rules: unknown;
  beaches: unknown;
};

type AlertQueueRefreshUpdateWithBestScore = {
  window_start: string;
  window_end: string;
  best_hour: string;
  best_score: number;
  conditions_snapshot: Record<string, unknown>;
};

function enabledChannels(item: QueueItemWithMeta): Channel[] {
  const channels: Channel[] = [];
  if (item.notify_email) channels.push("email");
  if (item.notify_push) channels.push("push");
  return channels;
}

function toRevalidationBeachMeta(
  beachId: string,
  beach: BeachEmbed,
): AlertRevalidationBeachMeta | null {
  if (
    typeof beach.lat !== "number" ||
    !Number.isFinite(beach.lat) ||
    typeof beach.lon !== "number" ||
    !Number.isFinite(beach.lon)
  ) {
    return null;
  }

  return {
    id: beach.id ?? beachId,
    name: beach.name,
    slug: beach.slug ?? null,
    lat: beach.lat,
    lon: beach.lon,
    timezone: beach.timezone ?? "America/Los_Angeles",
    wind_offshore_deg: beach.wind_offshore_deg ?? null,
    wind_offshore_tol_deg: beach.wind_offshore_tol_deg ?? null,
    aspect_deg: beach.aspect_deg ?? null,
    preferred_tide_ft_min: beach.preferred_tide_ft_min ?? null,
    preferred_tide_ft_max: beach.preferred_tide_ft_max ?? null,
    preferred_tide_direction: beach.preferred_tide_direction ?? null,
    swell_window_center_deg: beach.swell_window_center_deg ?? null,
    swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
    break_type: beach.break_type ?? null,
    skill_level: beach.skill_level ?? null,
  };
}

function parseQueuedBestScore(value: unknown): number {
  const score =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  if (Number.isFinite(score)) return score;
  // Fail open so malformed queue data cannot silently mute the alert channel.
  return ALERT_MIN_DELIVERABLE_SCORE;
}

function resolveRuleWeeklyCap(
  conditions?: AlertConditions | null,
): number | null {
  const value = conditions?.max_frequency_per_week;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }
  return Math.min(value, 14);
}

function resolveQuietHoursOverride(
  items: QueueItemWithMeta[],
): { quiet_hours_start: number; quiet_hours_end: number } | null {
  for (const item of items) {
    const start =
      typeof item.conditions?.quiet_hours_start === "number"
        ? item.conditions.quiet_hours_start
        : null;
    const end =
      typeof item.conditions?.quiet_hours_end === "number"
        ? item.conditions.quiet_hours_end
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
      return { quiet_hours_start: start, quiet_hours_end: end };
    }
  }
  return null;
}

function waveLabelFromSnapshot(
  snapshot: Record<string, unknown>,
): string | null {
  const value = snapshot.wave_height;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return formatWaveHeightRange(value);
}

function buildRenderedMatchDetails(
  matches: MatchingWindow[],
): Array<Record<string, unknown>> {
  return matches.map((match) => ({
    rule_id: match.rule_id,
    rule_name: match.rule_name,
    beach_id: match.beach_id,
    beach_name: match.beach_name,
    window_start: match.window_start,
    window_end: match.window_end,
    best_hour: match.best_hour,
    wave_label: waveLabelFromSnapshot(match.conditions_snapshot),
    snapshot_summary: buildConditionsLine(match.conditions_snapshot),
  }));
}

function buildAlertSessionDecision(args: {
  matches: MatchingWindow[];
  profileExperience: unknown;
  anchorTime?: Date;
}): CanonicalSessionDecision {
  const anchorTime = args.anchorTime ?? new Date();
  const starts = args.matches
    .map((match) => Date.parse(match.window_start))
    .filter(Number.isFinite);
  const ends = args.matches
    .map((match) => Date.parse(match.window_end))
    .filter(Number.isFinite);
  const scopeStart =
    starts.length > 0
      ? new Date(Math.min(...starts)).toISOString()
      : anchorTime.toISOString();
  const scopeEnd =
    ends.length > 0
      ? new Date(Math.max(...ends)).toISOString()
      : anchorTime.toISOString();

  return buildCanonicalDecisionFromAlertMatches({
    anchorTime: anchorTime.toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: scopeStart,
      windowEnd: scopeEnd,
      timezone: args.matches[0]?.beach_timezone ?? "UTC",
    },
    profileExperience: args.profileExperience,
    recommendationAvailability: {
      state: "available",
      holdEpoch: `notification:alert:${anchorTime.toISOString()}`,
      resolutionAsOf: anchorTime.toISOString(),
    },
    matches: args.matches,
  });
}

function selectedAlertMatch(
  matches: MatchingWindow[],
  decision: CanonicalSessionDecision,
): MatchingWindow | null {
  const candidateId = decision.selection?.candidateId;
  if (!candidateId) return null;
  return (
    matches.find((match) => canonicalAlertCandidateId(match) === candidateId) ??
    null
  );
}

function policyContextForMatch(
  match: MatchingWindow | undefined,
): PositiveRecommendationPolicyContext | null {
  if (!match) return null;
  const startsAtMs = Date.parse(match.window_start);
  const endsAtMs = Date.parse(match.window_end);
  if (
    !Number.isFinite(startsAtMs) ||
    !Number.isFinite(endsAtMs) ||
    endsAtMs <= startsAtMs
  ) {
    return null;
  }

  return {
    kind: "positive_session_recommendation",
    beach_id: match.beach_id,
    starts_at: match.window_start,
    ends_at: match.window_end,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();

  // Env-driven gates. Default OFF for safety; staged rollout via allowlist.
  const forecastDeliveryEnabled = isForecastAlertDeliveryEnabled();
  const similarityDeliveryEnabled =
    process.env.ALERTS_DELIVERY_ENABLED === "true";
  const allowlistRaw = process.env.ALERTS_DELIVERY_USER_ALLOWLIST ?? "";
  const allowlist = new Set(
    allowlistRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const recordedAttemptsByQueue = new Map<string, RecordedAttempt[]>();
  const deliveryAcceptedQueueIds = new Set<string>();
  const previousUnresolvedHoldRunsByQueue = new Map<string, number>();
  const shadowOutcomesByQueue = new Map<string, ForecastAlertShadowOutcome>();

  async function recordAttempt(args: {
    queueId: string;
    ruleId: string;
    userId: string;
    channel: Channel;
    status: AttemptStatus;
    skipReason?: string;
  }): Promise<void> {
    const { error } = await supabase.from("alert_delivery_attempts").insert({
      queue_id: args.queueId,
      rule_id: args.ruleId,
      user_id: args.userId,
      channel: args.channel,
      status: args.status,
      skip_reason: args.skipReason ?? null,
    });
    if (error) {
      console.error(
        `${CONTEXT_TAG} attempt-write-failed:`,
        error.message,
        args,
      );
      return;
    }
    const attempts = recordedAttemptsByQueue.get(args.queueId) ?? [];
    attempts.push({
      channel: args.channel,
      status: args.status,
      skipReason: args.skipReason ?? null,
    });
    recordedAttemptsByQueue.set(args.queueId, attempts);
  }

  async function persistShadowOutcome(item: QueueItemWithMeta): Promise<void> {
    const outcome = shadowOutcomesByQueue.get(item.id);
    if (!outcome) {
      throw new Error(`missing shadow outcome for queue row ${item.id}`);
    }

    const { error } = await (supabase.from("alert_queue") as any)
      .update({ delivery_shadow_outcome: outcome })
      .eq("id", item.id);
    if (error) {
      throw new Error(
        `failed to persist shadow outcome for alert_queue row ${item.id}: ${error.message}`,
      );
    }
  }

  function addShadowChannel(
    items: QueueItemWithMeta[],
    channel: Channel,
  ): void {
    for (const item of items) {
      const outcome = shadowOutcomesByQueue.get(item.id);
      if (!outcome || outcome.would_use_channels.includes(channel)) continue;
      outcome.would_use_channels.push(channel);
    }
  }

  async function refreshQueueItemFromLatestForecasts(
    item: QueueItemWithMeta,
  ): Promise<QueueItemWithMeta | null> {
    if (!item.conditions || !item.beach_meta) return item;

    const { start, end } = getUtcDayBounds(
      item.alert_date,
      item.beach_timezone,
    );
    const { data: forecastRows, error } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", item.beach_id)
      .gte("forecast_at", start)
      .lt("forecast_at", end)
      .order("forecast_at", { ascending: true });

    if (error) {
      console.warn(
        `${CONTEXT_TAG} forecast revalidation failed for queue ${item.id}; using queued snapshot:`,
        error.message,
      );
      return item;
    }

    if (!forecastRows || forecastRows.length === 0) return item;

    const freshWindow = selectFreshAlertWindow({
      conditions: item.conditions,
      forecastRows: forecastRows as EnhancedForecastAlertRow[],
      beach: item.beach_meta,
    });
    if (!freshWindow) return null;

    return {
      ...item,
      window_start: freshWindow.window_start,
      window_end: freshWindow.window_end,
      best_hour: freshWindow.best_hour,
      forecast_id: freshWindow.forecast_id,
      best_score: freshWindow.best_score,
      conditions_snapshot: {
        ...freshWindow.conditions_snapshot,
        ...(freshWindow.forecast_id
          ? { forecast_id: freshWindow.forecast_id }
          : {}),
      },
    };
  }

  async function persistRefreshedQueueItem(
    item: QueueItemWithMeta,
  ): Promise<void> {
    const update: AlertQueueRefreshUpdateWithBestScore = {
      window_start: item.window_start,
      window_end: item.window_end,
      best_hour: item.best_hour,
      best_score: item.best_score,
      conditions_snapshot: item.conditions_snapshot,
    };

    // alert_queue.best_score exists in DB but generated types are stale.
    const { error } = await (supabase.from("alert_queue") as any)
      .update(update)
      .eq("id", item.id);

    if (error) {
      throw new Error(
        `failed to persist refreshed alert_queue row ${item.id}: ${error.message}`,
      );
    }
  }

  try {
    const summary = await withCronOutcome(
      {
        job: "/api/cron/condition-alert-deliver",
        unit: "notifications_sent",
        expectedMin: 1,
        getProduced: (result) => result.emailSent + result.pushSent,
        legitimatelyZero: (result) => {
          if (
            result.errors === 0 &&
            result.holdStateUnavailableDeferred === 0 &&
            result.processed === 0 &&
            result.queueMarked === 0
          ) {
            return { reason: "No alert queue items were due for delivery" };
          }
          if (
            result.errors === 0 &&
            result.queueMarked > 0 &&
            result.queue_marked_by_reason.delivery_disabled ===
              result.queueMarked
          ) {
            return {
              reason: "Condition-alert delivery is disabled by feature flag",
            };
          }
          return undefined;
        },
        failureReason: (result) =>
          result.status === "degraded"
            ? "Alert queue consumption was unresolved or unexplained"
            : null,
      },
      async () => {
        const result = {
          status: "ok" as "ok" | "degraded",
          processed: 0,
          emailSent: 0,
          pushSent: 0,
          queueMarked: 0,
          queue_marked_by_reason: createQueueMarkedByReason(),
          skippedStale: 0,
          holdStateUnavailableDeferred: 0,
          // Email items deferred because the recipient is inside their
          // quiet-hours window. These rows stay due+unsent so a later hourly
          // run re-evaluates and sends once they're out of quiet hours.
          emailQuietHoursSkipped: 0,
          errors: 0,
        };

        async function markQueueItemsConsumed(
          queueItems: QueueItemWithMeta[],
          reason: QueueMarkReason,
        ): Promise<boolean> {
          if (queueItems.length === 0) return true;

          const queueIds = queueItems.map((item) => item.id);
          const { error } = await supabase
            .from("alert_queue")
            .update({ sent: true })
            .in("id", queueIds);
          if (error) {
            console.error(
              `${CONTEXT_TAG} Failed to mark queue items consumed`,
              {
                reason,
                queue_ids: queueIds,
                error: error.message,
              },
            );
            result.errors++;
            return false;
          }

          result.queueMarked += queueItems.length;
          result.queue_marked_by_reason[reason] += queueItems.length;
          for (const item of queueItems) {
            console.log(`${CONTEXT_TAG} queue-consumed`, {
              reason,
              queue_id: item.id,
              rule_id: item.rule_id,
              user_id: item.user_id,
            });
          }
          return true;
        }

        async function markQueueItemsByReason(
          itemsByReason: Map<QueueMarkReason, QueueItemWithMeta[]>,
        ): Promise<void> {
          for (const [reason, queueItems] of itemsByReason) {
            await markQueueItemsConsumed(queueItems, reason);
          }
        }

        function addItemReason(
          itemsByReason: Map<QueueMarkReason, QueueItemWithMeta[]>,
          reason: QueueMarkReason,
          item: QueueItemWithMeta,
        ): void {
          const queueItems = itemsByReason.get(reason) ?? [];
          queueItems.push(item);
          itemsByReason.set(reason, queueItems);
        }

        function unresolvedHoldDisposition(
          item: QueueItemWithMeta,
        ): QueueMarkReason | null {
          const enabled = enabledChannels(item);
          if (enabled.length === 0) return "no_enabled_channels";

          const recordedUnresolved = (
            recordedAttemptsByQueue.get(item.id) ?? []
          ).filter(
            (attempt) =>
              attempt.skipReason === "major_event_hold:hold_state_unavailable",
          );
          if (recordedUnresolved.length === 0) {
            return "unrecorded_consumption";
          }

          const attemptNumber =
            (previousUnresolvedHoldRunsByQueue.get(item.id) ?? 0) + 1;
          if (attemptNumber >= HOLD_STATE_UNAVAILABLE_MAX_ATTEMPTS) {
            return "hold_state_unavailable_retry_exhausted";
          }

          result.holdStateUnavailableDeferred++;
          console.warn(`${CONTEXT_TAG} queue-retained-for-unresolved-hold`, {
            queue_id: item.id,
            rule_id: item.rule_id,
            user_id: item.user_id,
            attempt: attemptNumber,
            max_attempts: HOLD_STATE_UNAVAILABLE_MAX_ATTEMPTS,
          });
          return null;
        }

        function reasonForProcessedForecastItem(
          item: QueueItemWithMeta,
        ): QueueMarkReason | null {
          if (deliveryAcceptedQueueIds.has(item.id)) return "delivered";
          if (enabledChannels(item).length === 0) return "no_enabled_channels";
          if (shadowOutcomesByQueue.has(item.id)) return "shadow_withheld";

          const attempts = recordedAttemptsByQueue.get(item.id) ?? [];
          if (attempts.length === 0) return "unrecorded_consumption";
          if (
            attempts.some((attempt) => attempt.status === "shadow_withheld")
          ) {
            return "shadow_withheld";
          }
          if (attempts.some((attempt) => attempt.status === "sent")) {
            return "delivered";
          }
          if (
            attempts.some(
              (attempt) =>
                attempt.skipReason ===
                "major_event_hold:hold_state_unavailable",
            )
          ) {
            return unresolvedHoldDisposition(item);
          }
          if (
            attempts.some(
              (attempt) =>
                attempt.status === "failed_provider" ||
                attempt.status === "failed_internal",
            )
          ) {
            return "failed_delivery";
          }

          const deliberateReasons = new Set<QueueMarkReason>();
          for (const attempt of attempts) {
            if (attempt.status === "skipped_allowlist") {
              deliberateReasons.add("allowlist_excluded");
            } else if (attempt.status === "skipped_cooldown") {
              deliberateReasons.add("cooldown");
            } else if (attempt.status === "skipped_user_cap") {
              deliberateReasons.add("user_cap");
            } else if (attempt.status === "skipped_channel_disabled") {
              deliberateReasons.add("channel_disabled");
            } else if (
              attempt.status === "skipped_no_email" ||
              attempt.status === "skipped_no_device"
            ) {
              deliberateReasons.add("missing_destination");
            } else if (attempt.status === "skipped_dedup_collision") {
              deliberateReasons.add("deduplicated");
            } else if (
              attempt.status === "skipped_disabled" &&
              attempt.skipReason === "ALERTS_DELIVERY_ENABLED=false"
            ) {
              deliberateReasons.add("delivery_disabled");
            } else if (
              attempt.status === "skipped_disabled" &&
              attempt.skipReason === "major_event_hold:major_event_hold"
            ) {
              deliberateReasons.add("major_event_hold");
            } else if (
              attempt.status === "skipped_disabled" &&
              attempt.skipReason?.startsWith("canonical_decision:")
            ) {
              deliberateReasons.add("canonical_safety_rejected");
            }
          }

          if (deliberateReasons.size === 1) {
            return [...deliberateReasons][0];
          }
          if (deliberateReasons.size > 1) return "mixed_deliberate_skip";
          return "unrecorded_consumption";
        }

        // 1. Fetch due, unsent queue items with rule + beach embeddings.
        //    Profiles are fetched in a separate query because `alert_queue.user_id`
        //    has a FK to `auth.users(id)` — not `profiles(id)` — so PostgREST
        //    cannot resolve a `profiles!inner(...)` embedding and returns PGRST200,
        //    500ing the whole cron (blocks all alert types, including similarity).
        const { data: rawItems, error: queueError } = await supabase
          .from("alert_queue")
          .select(
            `
            id, user_id, rule_id, beach_id, alert_date, send_at,
            window_start, window_end, best_hour, best_score, conditions_snapshot, sent,
            alert_rules!inner(name, preset_type, notify_email, notify_push, conditions),
            beaches!inner(
              id, name, slug, timezone, lat, lon,
              wind_offshore_deg, wind_offshore_tol_deg, aspect_deg,
              preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
              swell_window_center_deg, swell_window_halfwidth_deg,
              break_type, skill_level
            )
          `,
          )
          .eq("sent", false)
          .lte("send_at", new Date().toISOString())
          .order("send_at", { ascending: true });

        if (queueError) throw queueError;
        const queueRows = (rawItems ??
          []) as unknown as AlertQueueRowWithBestScore[];
        if (queueRows.length === 0) {
          console.log(`${CONTEXT_TAG} No due queue items`);
          return { ...result, message: "No items due" };
        }

        console.log(`${CONTEXT_TAG} Found ${queueRows.length} due queue items`);

        const {
          data: unresolvedHoldAttemptsRaw,
          error: unresolvedHoldAttemptsError,
        } = await supabase
          .from("alert_delivery_attempts")
          .select("queue_id, channel")
          .in(
            "queue_id",
            queueRows.map((row) => row.id),
          )
          .eq("status", "skipped_disabled")
          .eq("skip_reason", "major_event_hold:hold_state_unavailable");
        if (unresolvedHoldAttemptsError) throw unresolvedHoldAttemptsError;

        const unresolvedCountsByQueueChannel = new Map<string, number>();
        for (const attempt of (unresolvedHoldAttemptsRaw ?? []) as Array<{
          queue_id: string;
          channel: string;
        }>) {
          const key = `${attempt.queue_id}:${attempt.channel}`;
          unresolvedCountsByQueueChannel.set(
            key,
            (unresolvedCountsByQueueChannel.get(key) ?? 0) + 1,
          );
        }
        for (const row of queueRows) {
          const priorRuns = Math.max(
            unresolvedCountsByQueueChannel.get(`${row.id}:email`) ?? 0,
            unresolvedCountsByQueueChannel.get(`${row.id}:push`) ?? 0,
          );
          previousUnresolvedHoldRunsByQueue.set(row.id, priorRuns);
        }

        // 2. Reshape into flat QueueItemWithMeta (consolidateQueueItems expects this shape)
        const allItems: QueueItemWithMeta[] = queueRows.map((row) => {
          const rule = row.alert_rules as unknown as RuleEmbed;
          const beach = row.beaches as unknown as BeachEmbed;
          const conditionsSnapshot = (row.conditions_snapshot ?? {}) as Record<
            string,
            unknown
          >;
          return {
            id: row.id,
            user_id: row.user_id,
            rule_id: row.rule_id,
            beach_id: row.beach_id,
            alert_date: String(row.alert_date),
            send_at: row.send_at,
            window_start: row.window_start,
            window_end: row.window_end,
            best_hour: row.best_hour,
            forecast_id:
              typeof conditionsSnapshot.forecast_id === "string"
                ? conditionsSnapshot.forecast_id
                : undefined,
            conditions_snapshot: conditionsSnapshot,
            sent: row.sent,
            rule_name: rule.name,
            preset_type: rule.preset_type,
            beach_name: beach.name,
            beach_slug: beach.slug ?? null,
            beach_skill_level: beach.skill_level ?? null,
            beach_timezone: beach.timezone ?? "America/Los_Angeles",
            notify_email: rule.notify_email,
            notify_push: rule.notify_push,
            conditions: rule.conditions ?? null,
            beach_meta: toRevalidationBeachMeta(row.beach_id, beach),
            best_score: parseQueuedBestScore(row.best_score),
          };
        });

        // 2b. Partition: similarity_match rows are stamped by the
        //     try_insert_similarity_alert RPC with conditions_snapshot.alert_type
        //     and routed through the centralized notifications pipeline. Legacy
        //     forecast_alert rows continue through the consolidation +
        //     email/push branches below. Excluding similarity rows here is
        //     CRITICAL — otherwise the email path tries to render forecast
        //     match data and the push title is wrong.
        const similarityItems = allItems.filter(
          (i) =>
            (i.conditions_snapshot as Record<string, unknown>)?.alert_type ===
            "similarity_match",
        );
        const forecastItems = allItems.filter(
          (i) =>
            (i.conditions_snapshot as Record<string, unknown>)?.alert_type !==
            "similarity_match",
        );

        const items: QueueItemWithMeta[] = [];
        const staleItems: QueueItemWithMeta[] = [];
        for (const item of forecastItems) {
          const refreshed = await refreshQueueItemFromLatestForecasts(item);
          if (refreshed) {
            await persistRefreshedQueueItem(refreshed);
            items.push(refreshed);
          } else {
            staleItems.push(item);
          }
        }

        if (staleItems.length > 0) {
          for (const item of staleItems) {
            for (const channel of enabledChannels(item)) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel,
                status: "skipped_stale_forecast",
                skipReason:
                  "fresh forecast no longer matches the queued alert rule",
              });
            }
          }
          const marked = await markQueueItemsConsumed(staleItems, "stale");
          if (marked) result.skippedStale += staleItems.length;
        }

        const lowScoreItems = items.filter(
          (item) =>
            parseQueuedBestScore(item.best_score) < ALERT_MIN_DELIVERABLE_SCORE,
        );
        if (lowScoreItems.length > 0) {
          await markQueueItemsConsumed(lowScoreItems, "below_score_floor");
        }
        const scoreEligibleItems = items.filter(
          (item) =>
            parseQueuedBestScore(item.best_score) >=
            ALERT_MIN_DELIVERABLE_SCORE,
        );

        // 3. Fetch profile data for the queue's user set in a single query.
        //    profiles.id is a 1:1 mirror of auth.users.id, so we can key by user_id.
        type ProfileRow = {
          id: string;
          // profiles.email is nullable in the schema. Historical rows can have
          // NULL even though auth.users.email is set (signup-trigger ordering
          // edge case fixed forward in migration 20260503*). The email branch
          // below guards on this; push delivery still proceeds on null email.
          email: string | null;
          display_name: string | null;
          notif_email_enabled: boolean;
          notif_push_enabled: boolean;
          experience_level: string | null;
          // Drives the email quiet-hours window resolution (same source the
          // push worker uses via resolveNotificationTimezone). Nullable;
          // falls back to DEFAULT_TIMEZONE.
          timezone: string | null;
        };
        const userIds = Array.from(new Set(queueRows.map((r) => r.user_id)));
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select(
            "id, email, display_name, notif_email_enabled, notif_push_enabled, timezone, experience_level",
          )
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const profilesByUser = new Map<string, ProfileRow>();
        for (const row of (profileRows ?? []) as ProfileRow[]) {
          profilesByUser.set(row.id, row);
        }

        // 3b. Fetch recent 'sent' attempts once for cooldown (per-rule, 24h) and
        //     weekly cap (per-user, 7d) decisions. The 7d window covers both.
        const sinceWeek = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const { data: recentSentRaw, error: recentSentError } = await supabase
          .from("alert_delivery_attempts")
          .select("rule_id, user_id, attempted_at")
          .eq("status", "sent")
          .gte("attempted_at", sinceWeek);
        if (recentSentError) throw recentSentError;

        const recentSent = (recentSentRaw ?? []).map(
          (r: { rule_id: string; user_id: string; attempted_at: string }) => ({
            rule_id: r.rule_id,
            user_id: r.user_id,
            attempted_at: new Date(r.attempted_at),
          }),
        );

        // 4. Resolve active operator holds and record the canonical decision
        // for shadow observability. The user's matched rules remain the
        // delivery candidates regardless of verdict or skill eligibility.
        const deliverableItems: QueueItemWithMeta[] = [];
        const itemsByUser = new Map<string, QueueItemWithMeta[]>();
        for (const item of scoreEligibleItems) {
          const userItems = itemsByUser.get(item.user_id) ?? [];
          userItems.push(item);
          itemsByUser.set(item.user_id, userItems);
        }

        for (const [userId, userItems] of itemsByUser) {
          const profile = profilesByUser.get(userId);
          if (!profile) {
            deliverableItems.push(...userItems);
            continue;
          }
          const userMatches = consolidateQueueItems(userItems).flatMap(
            (candidatePayload) => candidatePayload.matches,
          );
          const heldCandidateIds = new Set<string>();
          for (const match of userMatches) {
            const policyContext = policyContextForMatch(match);
            const resolution = await resolveNotificationMajorEventHold({
              eventId: `condition-alert-deliver:canonical:${userId}:${canonicalAlertCandidateId(match)}`,
              type: "forecast_alert",
              payload: {
                beach_id: match.beach_id,
                configured_beach_id: match.beach_id,
                forecast_at: match.best_hour,
                ...(policyContext ? { policy_context: policyContext } : {}),
              },
              profileExperience: profile.experience_level,
            });
            if (
              resolution.status === "suppressed" &&
              resolution.reasonCode === "major_event_hold"
            ) {
              heldCandidateIds.add(canonicalAlertCandidateId(match));
            }
          }

          const decision = buildAlertSessionDecision({
            matches: userMatches,
            profileExperience: profile.experience_level,
          });
          if (!forecastDeliveryEnabled) {
            for (const item of userItems) {
              const held = heldCandidateIds.has(
                canonicalAlertCandidateId(item),
              );
              shadowOutcomesByQueue.set(item.id, {
                status: "shadow_withheld",
                verdict: held ? "no" : decision.verdict,
                reason_code: held ? "major_event_hold" : decision.reasonCode,
                preset_type: item.preset_type ?? null,
                would_use_channels: [],
              });
            }
          }
          const heldItems = userItems.filter((item) =>
            heldCandidateIds.has(canonicalAlertCandidateId(item)),
          );
          const unheldItems = userItems.filter(
            (item) => !heldCandidateIds.has(canonicalAlertCandidateId(item)),
          );
          deliverableItems.push(...unheldItems);

          for (const item of heldItems) {
            for (const channel of enabledChannels(item)) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId,
                channel,
                status: "skipped_disabled",
                skipReason: "major_event_hold:major_event_hold",
              });
            }
          }
          if (!forecastDeliveryEnabled) {
            for (const item of heldItems) {
              await persistShadowOutcome(item);
            }
          }
          await markQueueItemsConsumed(heldItems, "major_event_hold");
        }

        const payloads = consolidateQueueItems(deliverableItems);
        const baseUrl = getBaseUrl();
        const rateLimiter = createResendRateLimiter();
        const emailLogger = createEmailLogger(supabase, CONTEXT_TAG);

        for (const payload of payloads) {
          const payloadBeachId = payload.matches[0]?.beach_id ?? null;
          result.processed++;
          const contributingItems = deliverableItems.filter(
            (item) =>
              item.user_id === payload.user_id &&
              item.beach_id === payloadBeachId,
          );
          const emailItems = contributingItems.filter((i) => i.notify_email);
          const pushItems = contributingItems.filter((i) => i.notify_push);
          const profile = profilesByUser.get(payload.user_id);
          if (!profile) {
            console.warn(
              `${CONTEXT_TAG} No profile found for user ${payload.user_id}, skipping`,
            );
            for (const item of emailItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "email",
                status: "failed_internal",
                skipReason: "profile missing for queued alert user",
              });
            }
            for (const item of pushItems) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: payload.user_id,
                channel: "push",
                status: "failed_internal",
                skipReason: "profile missing for queued alert user",
              });
            }
            const marked = await markQueueItemsConsumed(
              contributingItems,
              "orphaned_profile",
            );
            if (marked) result.errors++;
            continue;
          }
          const profileExperience = parseSkillLevel(profile.experience_level);

          // Per-rule cooldown decision (cached) and per-user weekly cap decision.
          // Status priority: skipped_disabled > skipped_allowlist >
          //   skipped_cooldown > skipped_user_cap > skipped_dedup_collision >
          //   skipped_channel_disabled > skipped_no_device > failed_provider > sent.
          const throttleNow = new Date();
          const cooldownByRule = new Map<
            string,
            ReturnType<typeof cooldownDecision>
          >();
          function cooldownFor(
            ruleId: string,
          ): ReturnType<typeof cooldownDecision> {
            const cached = cooldownByRule.get(ruleId);
            if (cached) return cached;
            const decision = cooldownDecision({
              ruleId,
              now: throttleNow,
              recentSentAttempts: recentSent.map((r) => ({
                rule_id: r.rule_id,
                attempted_at: r.attempted_at,
              })),
              windowHours: 24,
            });
            cooldownByRule.set(ruleId, decision);
            return decision;
          }
          const userCap = weeklyCapDecision({
            userId: payload.user_id,
            now: throttleNow,
            recentSentAttempts: recentSent.map((r) => ({
              user_id: r.user_id,
              attempted_at: r.attempted_at,
            })),
            cap: 10,
          });

          // Apply throttle gates to a channel's contributing items, returning the
          // subset that survives. Blocked items get attempt rows written here.
          // Cooldown is checked first (higher priority), then user cap.
          async function applyThrottle(
            channelItems: QueueItemWithMeta[],
            channel: Channel,
          ): Promise<QueueItemWithMeta[]> {
            const survivors: QueueItemWithMeta[] = [];
            for (const item of channelItems) {
              const c = cooldownFor(item.rule_id);
              if (!c.ok) {
                await recordAttempt({
                  queueId: item.id,
                  ruleId: item.rule_id,
                  userId: payload.user_id,
                  channel,
                  status: c.status,
                  skipReason: c.reason,
                });
                continue;
              }
              const ruleCap = resolveRuleWeeklyCap(item.conditions);
              if (ruleCap !== null) {
                const count = recentSent.filter(
                  (attempt) => attempt.rule_id === item.rule_id,
                ).length;
                if (count >= ruleCap) {
                  await recordAttempt({
                    queueId: item.id,
                    ruleId: item.rule_id,
                    userId: payload.user_id,
                    channel,
                    status: "skipped_user_cap",
                    skipReason: `rule ${item.rule_id} has ${count} sent attempts in last 7d, cap is ${ruleCap}`,
                  });
                  continue;
                }
              }
              if (!userCap.ok) {
                await recordAttempt({
                  queueId: item.id,
                  ruleId: item.rule_id,
                  userId: payload.user_id,
                  channel,
                  status: userCap.status,
                  skipReason: userCap.reason,
                });
                continue;
              }
              survivors.push(item);
            }
            return survivors;
          }

          // Quiet-hours guard for the EMAIL channel. Mirrors the push worker:
          // resolve the recipient timezone the same way, honor the per-rule
          // quiet_hours override (else DEFAULT_QUIET), and defer the whole email
          // send if the recipient is currently inside the window. Most dawn
          // alerts have a pre-dawn send_at (after the 04:00 window end), so this
          // rarely triggers — it's an edge-case correctness fix.
          const emailQuietHoursOverride = resolveQuietHoursOverride(emailItems);
          const recipientTimezone = resolveNotificationTimezone(
            profile.timezone,
          );
          const recipientLocalHour = getLocalHour(
            new Date(),
            recipientTimezone,
          );
          const emailInQuietHours =
            emailItems.length > 0 &&
            isInQuietWindow(
              recipientLocalHour,
              emailQuietHoursOverride?.quiet_hours_start ??
                DEFAULT_QUIET.windowStart,
              emailQuietHoursOverride?.quiet_hours_end ??
                DEFAULT_QUIET.windowEnd,
            );

          // Queue ids whose EMAIL item was deferred this run because the
          // recipient is inside their quiet-hours window. These must NOT be
          // marked sent below — the row stays due+unsent so a later hourly run
          // (once send_at has passed AND they're out of quiet hours) sends it.
          const quietDeferredEmailQueueIds = new Set<string>();

          try {
            // ---- Email branch ----
            if (emailItems.length > 0) {
              if (allowlist.size > 0 && !allowlist.has(payload.user_id)) {
                for (const item of emailItems) {
                  await recordAttempt({
                    queueId: item.id,
                    ruleId: item.rule_id,
                    userId: payload.user_id,
                    channel: "email",
                    status: "skipped_allowlist",
                    skipReason: `user not in ALERTS_DELIVERY_USER_ALLOWLIST`,
                  });
                }
              } else if (emailInQuietHours) {
                // Defer the whole email send: no resend, no alert_deliveries
                // dedup row, no logDelivery, no sent attempt. Cooldown/cap reads
                // only count status='sent' rows, so this deferral cannot
                // suppress the later real send. The row is left due+unsent
                // below so a later hourly run sends once they're out of quiet
                // hours and send_at has passed.
                for (const item of emailItems) {
                  if (forecastDeliveryEnabled) {
                    quietDeferredEmailQueueIds.add(item.id);
                  }
                }
                if (forecastDeliveryEnabled) {
                  result.emailQuietHoursSkipped += emailItems.length;
                }
                console.log(
                  forecastDeliveryEnabled
                    ? `${CONTEXT_TAG} Email deferred for user ${payload.user_id} (quiet hours; ${emailItems.length} item(s) left due)`
                    : `${CONTEXT_TAG} Email shadow-blocked for user ${payload.user_id} (quiet hours)`,
                );
              } else {
                // Throttle (cooldown per-rule, weekly cap per-user). Items that
                // trip throttle get an attempt row written here and don't proceed
                // to channel-pref/dedup/provider. Status priority places these
                // skips above channel_disabled/dedup_collision.
                const emailSurvivors = await applyThrottle(emailItems, "email");
                if (emailSurvivors.length === 0) {
                  // All items blocked by throttle; rows already recorded.
                } else if (!profile.notif_email_enabled) {
                  for (const item of emailSurvivors) {
                    await recordAttempt({
                      queueId: item.id,
                      ruleId: item.rule_id,
                      userId: payload.user_id,
                      channel: "email",
                      status: "skipped_channel_disabled",
                      skipReason: "profile.notif_email_enabled=false",
                    });
                  }
                } else if (!profile.email || profile.email.trim() === "") {
                  // Resend rejects null/empty `to` with "The `to` field must be a
                  // `string`.", which surfaced as failed_provider on 2026-04-27.
                  // Guard before the provider call. Push delivery is independent
                  // and continues for the same user below.
                  for (const item of emailSurvivors) {
                    await recordAttempt({
                      queueId: item.id,
                      ruleId: item.rule_id,
                      userId: payload.user_id,
                      channel: "email",
                      status: "skipped_no_email",
                      skipReason: "profile.email is null or empty",
                    });
                  }
                } else {
                  // Dedup: only send if no email delivery recorded today
                  const { data: existingEmail, error: existingEmailError } =
                    await supabase
                      .from("alert_deliveries")
                      .select("id")
                      .eq("user_id", payload.user_id)
                      .eq("beach_id", payloadBeachId)
                      .eq("alert_date", payload.alert_date)
                      .eq("channel", "email")
                      .limit(1);
                  if (existingEmailError) throw existingEmailError;

                  if (existingEmail && existingEmail.length > 0) {
                    for (const item of emailSurvivors) {
                      await recordAttempt({
                        queueId: item.id,
                        ruleId: item.rule_id,
                        userId: payload.user_id,
                        channel: "email",
                        status: "skipped_dedup_collision",
                        skipReason:
                          "alert_deliveries row already exists for (user, date, email)",
                      });
                    }
                  } else {
                    const survivorRuleIds = new Set(
                      emailSurvivors.map((i) => i.rule_id),
                    );
                    const candidateEmailMatches = payload.matches
                      .filter(
                        (m) => m.notify_email && survivorRuleIds.has(m.rule_id),
                      )
                      .map((m) => ({
                        ...m,
                        disable_token: generateDisableToken(m.rule_id),
                      }));
                    const manageAlertsUrl = `${baseUrl}/settings`;
                    const unsubscribeToken = generateEmailUnsubscribeToken(
                      payload.user_id,
                    );
                    const unsubscribeUrl =
                      `${baseUrl}/api/alerts/unsubscribe-email?user_id=${payload.user_id}` +
                      `&token=${unsubscribeToken}`;
                    const alertDate = new Date(
                      payload.alert_date,
                    ).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    });
                    if (forecastDeliveryEnabled) {
                      await rateLimiter.throttle();
                    }

                    const emailDecision = buildAlertSessionDecision({
                      matches: candidateEmailMatches,
                      profileExperience,
                    });
                    const emailMatches = candidateEmailMatches;
                    const renderedEmailMatches =
                      buildRenderedMatchDetails(emailMatches);
                    const emailSubject = buildConsolidatedSubject(
                      emailMatches,
                      alertDate,
                    );
                    const sendResult = !forecastDeliveryEnabled
                      ? { data: null, error: null }
                      : await sendEmail({
                          from: MAIL_FROM,
                          replyTo: MAIL_REPLY_TO,
                          to: profile.email,
                          subject: emailSubject,
                          react: ConsolidatedAlertEmail({
                            displayName: profile.display_name,
                            alertDate,
                            matches: emailMatches,
                            manageAlertsUrl,
                            unsubscribeUrl,
                            baseUrl,
                          }),
                          unsubscribeUrl,
                        });
                    const { data: sendData, error: sendError } = sendResult;

                    if (!forecastDeliveryEnabled) {
                      addShadowChannel(emailSurvivors, "email");
                    } else if (sendError) {
                      console.error(
                        `${CONTEXT_TAG} Email send failed for user ${payload.user_id}:`,
                        sendError,
                      );
                      result.errors++;
                      const errorMessage =
                        (sendError as { message?: string })?.message ??
                        String(sendError);
                      for (const item of emailSurvivors) {
                        await recordAttempt({
                          queueId: item.id,
                          ruleId: item.rule_id,
                          userId: payload.user_id,
                          channel: "email",
                          status: "failed_provider",
                          skipReason: errorMessage,
                        });
                      }
                    } else {
                      for (const item of emailSurvivors) {
                        deliveryAcceptedQueueIds.add(item.id);
                      }
                      // Write dedup record
                      const { error: deliveryInsertError } = await supabase
                        .from("alert_deliveries")
                        .insert({
                          user_id: payload.user_id,
                          beach_id: payloadBeachId,
                          alert_date: payload.alert_date,
                          channel: "email",
                          payload: {
                            match_count: emailMatches.length,
                            beaches: emailMatches.map((m) => m.beach_name),
                            matches: renderedEmailMatches,
                          } as import("@/types/database.generated").Json,
                        });

                      if (deliveryInsertError) {
                        console.error(
                          `${CONTEXT_TAG} Email sent but alert_deliveries insert failed for user ${payload.user_id}:`,
                          deliveryInsertError,
                        );
                        result.errors++;
                        for (const item of emailSurvivors) {
                          await recordAttempt({
                            queueId: item.id,
                            ruleId: item.rule_id,
                            userId: payload.user_id,
                            channel: "email",
                            status: "sent",
                          });
                        }
                      } else {
                        await emailLogger.logDelivery({
                          userId: payload.user_id,
                          emailType: "conditions_alert",
                          subject: emailSubject,
                          meta: {
                            match_count: emailMatches.length,
                            beaches: emailMatches.map((m) => m.beach_name),
                            matches: renderedEmailMatches,
                            session_decision_id: emailDecision.decisionId,
                          },
                          resendMessageId: sendData?.id,
                        });

                        result.emailSent++;
                        console.log(
                          `${CONTEXT_TAG} Email sent to user ${payload.user_id} (${emailMatches.length} matches)`,
                        );

                        for (const item of emailSurvivors) {
                          await recordAttempt({
                            queueId: item.id,
                            ruleId: item.rule_id,
                            userId: payload.user_id,
                            channel: "email",
                            status: "sent",
                          });
                        }
                      }
                    }
                  }
                }
              }
            }

            // ---- Push branch ----
            if (pushItems.length > 0) {
              if (allowlist.size > 0 && !allowlist.has(payload.user_id)) {
                for (const item of pushItems) {
                  await recordAttempt({
                    queueId: item.id,
                    ruleId: item.rule_id,
                    userId: payload.user_id,
                    channel: "push",
                    status: "skipped_allowlist",
                    skipReason: `user not in ALERTS_DELIVERY_USER_ALLOWLIST`,
                  });
                }
              } else {
                const pushSurvivors = await applyThrottle(pushItems, "push");
                if (pushSurvivors.length === 0) {
                  // All items blocked by throttle; rows already recorded.
                } else if (!profile.notif_push_enabled) {
                  for (const item of pushSurvivors) {
                    await recordAttempt({
                      queueId: item.id,
                      ruleId: item.rule_id,
                      userId: payload.user_id,
                      channel: "push",
                      status: "skipped_channel_disabled",
                      skipReason: "profile.notif_push_enabled=false",
                    });
                  }
                } else {
                  const { data: existingPush, error: existingPushError } =
                    await supabase
                      .from("alert_deliveries")
                      .select("id")
                      .eq("user_id", payload.user_id)
                      .eq("beach_id", payloadBeachId)
                      .eq("alert_date", payload.alert_date)
                      .eq("channel", "push")
                      .limit(1);
                  if (existingPushError) throw existingPushError;

                  if (existingPush && existingPush.length > 0) {
                    for (const item of pushSurvivors) {
                      await recordAttempt({
                        queueId: item.id,
                        ruleId: item.rule_id,
                        userId: payload.user_id,
                        channel: "push",
                        status: "skipped_dedup_collision",
                        skipReason:
                          "alert_deliveries row already exists for (user, date, push)",
                      });
                    }
                  } else {
                    // Phase 3d: this branch no longer sends push directly.
                    // It enqueues a notification_event; the notifications-deliver
                    // worker handles devices, FCM, retries, and per-channel
                    // pref enforcement. The `notif_push_enabled` master gate
                    // above is kept as a cheap producer-side pre-filter.
                    const survivorRuleIdsPush = new Set(
                      pushSurvivors.map((i) => i.rule_id),
                    );
                    const candidatePushMatches = payload.matches.filter(
                      (m) =>
                        m.notify_push && survivorRuleIdsPush.has(m.rule_id),
                    );
                    const pushDecision = buildAlertSessionDecision({
                      matches: candidatePushMatches,
                      profileExperience,
                    });
                    const primaryPushMatch = selectedAlertMatch(
                      candidatePushMatches,
                      pushDecision,
                    );
                    const canonicalSelectionRejected =
                      primaryPushMatch === null;
                    const pushMatches = primaryPushMatch
                      ? [
                          primaryPushMatch,
                          ...candidatePushMatches.filter(
                            (match) => match !== primaryPushMatch,
                          ),
                        ]
                      : candidatePushMatches;
                    const renderedPushMatches =
                      buildRenderedMatchDetails(pushMatches);
                    const {
                      title,
                      body,
                      data: pushData,
                    } = formatPushNotification(
                      pushMatches,
                      pushDecision.verdict,
                      primaryPushMatch ?? undefined,
                    );
                    const topMatch = primaryPushMatch ?? undefined;
                    const quietHoursOverride =
                      resolveQuietHoursOverride(pushSurvivors);
                    const topPolicyContext = policyContextForMatch(topMatch);
                    const pushPayload = {
                      alert_date: payload.alert_date,
                      title,
                      body,
                      beach_id: pushData.beach_id,
                      configured_beach_id: payloadBeachId,
                      forecast_at:
                        pushData.forecast_at ??
                        topMatch?.best_hour ??
                        topMatch?.window_start ??
                        null,
                      matches: pushMatches.map((m) => ({
                        beach_id: m.beach_id,
                        beach_name: m.beach_name,
                        window_start: m.window_start,
                        window_end: m.window_end,
                        best_hour: m.best_hour,
                      })),
                      rendered_matches: renderedPushMatches,
                      ...(quietHoursOverride ?? {}),
                      ...(topPolicyContext
                        ? { policy_context: topPolicyContext }
                        : {}),
                      session_decision: pushDecision,
                      queue_items: pushSurvivors.map((s) => ({
                        queue_id: s.id,
                        rule_id: s.rule_id,
                      })),
                    };
                    const enqueueResult = canonicalSelectionRejected
                      ? {
                          enqueued: false as const,
                          reason: "canonical_safety_rejected" as const,
                        }
                      : !forecastDeliveryEnabled
                        ? {
                            enqueued: false as const,
                            reason: "shadow_withheld" as const,
                          }
                        : await enqueueNotification({
                            type: "forecast_alert",
                            recipientUserId: payload.user_id,
                            entityType: "beach",
                            entityId: topMatch?.beach_id ?? null,
                            payload: pushPayload,
                            dedupeKey: `forecast_alert:${payload.user_id}:${payloadBeachId}:${payload.alert_date}`,
                          }).catch((err) => {
                            console.error(
                              `${CONTEXT_TAG} enqueue threw for user ${payload.user_id}:`,
                              err,
                            );
                            return {
                              enqueued: false as const,
                              reason: "internal_error" as const,
                            };
                          });

                    if (
                      !enqueueResult.enqueued &&
                      enqueueResult.reason === "canonical_safety_rejected"
                    ) {
                      for (const item of pushSurvivors) {
                        await recordAttempt({
                          queueId: item.id,
                          ruleId: item.rule_id,
                          userId: payload.user_id,
                          channel: "push",
                          status: "skipped_disabled",
                          skipReason: `canonical_decision:${pushDecision.reasonCode}`,
                        });
                      }
                    } else if (
                      !enqueueResult.enqueued &&
                      enqueueResult.reason === "shadow_withheld"
                    ) {
                      addShadowChannel(pushSurvivors, "push");
                    } else if (enqueueResult.enqueued) {
                      for (const item of pushSurvivors) {
                        deliveryAcceptedQueueIds.add(item.id);
                      }
                      // Evaluator-side day gate: condition-alert-evaluate skips
                      // users who already have an alert_deliveries row for
                      // (user, alert_date). This is "we've enqueued for today"
                      // not "we've delivered" — actual delivery is recorded by
                      // the worker via the forecast_alert onChannelOutcome hook
                      // (per-rule rows in alert_delivery_attempts).
                      const { error: deliveryInsertError } = await supabase
                        .from("alert_deliveries")
                        .insert({
                          user_id: payload.user_id,
                          beach_id: payloadBeachId,
                          alert_date: payload.alert_date,
                          channel: "push",
                          payload: {
                            match_count: pushMatches.length,
                            notification_event_id: enqueueResult.eventId,
                            method: "enqueued_via_pipeline",
                            matches: renderedPushMatches,
                            session_decision_id: pushDecision.decisionId,
                          } as import("@/types/database.generated").Json,
                        });

                      if (deliveryInsertError) {
                        console.error(
                          `${CONTEXT_TAG} Push enqueued but alert_deliveries insert failed for user ${payload.user_id}:`,
                          deliveryInsertError,
                        );
                        result.errors++;
                      } else {
                        result.pushSent++;
                        console.log(
                          `${CONTEXT_TAG} Push enqueued for user ${payload.user_id} (event ${enqueueResult.eventId})`,
                        );
                      }

                      // Note: per-rule alert_delivery_attempts rows are NOT
                      // written here. The worker's onChannelOutcome hook
                      // writes them once delivery reaches a terminal status
                      // (sent / skipped_no_device / skipped_channel_disabled /
                      // failed_provider / etc.), so cooldown reads on
                      // status='sent' reflect actual delivery.
                    } else if (enqueueResult.reason === "duplicate") {
                      // Worker-level dedup caught it (a prior tick already
                      // enqueued the same forecast_alert for today).
                      for (const item of pushSurvivors) {
                        await recordAttempt({
                          queueId: item.id,
                          ruleId: item.rule_id,
                          userId: payload.user_id,
                          channel: "push",
                          status: "skipped_dedup_collision",
                          skipReason:
                            "notification_events dedupe_key collision",
                        });
                      }
                    } else {
                      console.error(
                        `${CONTEXT_TAG} enqueue failed for user ${payload.user_id}:`,
                        enqueueResult,
                      );
                      result.errors++;
                      for (const item of pushSurvivors) {
                        await recordAttempt({
                          queueId: item.id,
                          ruleId: item.rule_id,
                          userId: payload.user_id,
                          channel: "push",
                          status: "failed_internal",
                          skipReason: `enqueue: ${enqueueResult.reason}`,
                        });
                      }
                    }
                  }
                }
              }
            }

            if (!forecastDeliveryEnabled) {
              for (const item of contributingItems) {
                await persistShadowOutcome(item);
                const outcome = shadowOutcomesByQueue.get(item.id)!;
                for (const channel of outcome.would_use_channels) {
                  await recordAttempt({
                    queueId: item.id,
                    ruleId: item.rule_id,
                    userId: payload.user_id,
                    channel,
                    status: "shadow_withheld",
                    skipReason: JSON.stringify(outcome),
                  });
                }
              }
            }

            // 6. Mark queue items as sent. EXCEPT
            //    rows whose email item was quiet-hours-deferred this run: those
            //    stay due+unsent so a later hourly tick re-evaluates and sends.
            //    (Push on the same row is dedup-protected by the push
            //    alert_deliveries row + dedupeKey, so re-processing is safe.)
            const processedItemsByReason = new Map<
              QueueMarkReason,
              QueueItemWithMeta[]
            >();
            for (const item of contributingItems) {
              if (quietDeferredEmailQueueIds.has(item.id)) continue;
              const reason = reasonForProcessedForecastItem(item);
              if (reason) addItemReason(processedItemsByReason, reason, item);
            }
            await markQueueItemsByReason(processedItemsByReason);
          } catch (userErr) {
            console.error(
              `${CONTEXT_TAG} Error processing user ${payload.user_id}:`,
              userErr,
            );
            result.errors++;
          }
        }

        // ─── Similarity-match branch ────────────────────────────────────────
        // Each similarity row is independent (one-per-user-per-day, dedup
        // owned by the partial unique index Agent 2 added). We do NOT call
        // consolidateQueueItems on these — the payload is already shaped by
        // try_insert_similarity_alert and the notifications worker handles
        // per-channel pref enforcement (notif_similarity_alerts gate lives
        // in the registry). The cron-side throttle (cooldown + weekly cap)
        // is intentionally skipped — similarity is a once-per-day pick with
        // its own dedup story; piling it under the same per-user weekly cap
        // would silently suppress matches in active weeks.
        for (const item of similarityItems) {
          result.processed++;
          const profile = profilesByUser.get(item.user_id);

          if (!profile) {
            console.warn(
              `${CONTEXT_TAG} No profile found for similarity user ${item.user_id}, skipping`,
            );
            await recordAttempt({
              queueId: item.id,
              ruleId: item.rule_id,
              userId: item.user_id,
              channel: "push",
              status: "failed_internal",
              skipReason: "profile missing for queued similarity user",
            });
            const marked = await markQueueItemsConsumed(
              [item],
              "orphaned_profile",
            );
            if (marked) result.errors++;
            continue;
          }

          try {
            // Kill switch — same semantics as the forecast branch: skip the
            // provider call but mark the queue row sent so the queue can't
            // grow unbounded during a pause.
            if (forecastDeliveryEnabled && !similarityDeliveryEnabled) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel: "push",
                status: "skipped_disabled",
                skipReason: "ALERTS_DELIVERY_ENABLED=false",
              });
              await markQueueItemsConsumed([item], "delivery_disabled");
              continue;
            }

            if (allowlist.size > 0 && !allowlist.has(item.user_id)) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel: "push",
                status: "skipped_allowlist",
                skipReason: `user not in ALERTS_DELIVERY_USER_ALLOWLIST`,
              });
              await markQueueItemsConsumed([item], "allowlist_excluded");
              continue;
            }

            // Build the payload directly from conditions_snapshot. Newer
            // similarity rows include richer surf context; older rows only
            // carry the core fields and must still enqueue with fallback copy.
            const snap = item.conditions_snapshot as Record<string, unknown>;
            const optionalStringField = (value: unknown): string | undefined =>
              typeof value === "string" && value.trim().length > 0
                ? value
                : undefined;
            const optionalNumberField = (value: unknown): number | undefined =>
              typeof value === "number" && Number.isFinite(value)
                ? value
                : undefined;
            const similarityForecastAt = String(
              snap.forecast_at ?? item.best_hour,
            );
            const similarityForecastAtMs = Date.parse(similarityForecastAt);
            const similarityWindowEnd = Number.isFinite(similarityForecastAtMs)
              ? new Date(similarityForecastAtMs + 60 * 60 * 1000).toISOString()
              : "";
            let storedSimilarityDecision: CanonicalSessionDecision | null =
              null;
            try {
              storedSimilarityDecision = parseCanonicalSessionDecision(
                snap.session_decision,
              );
            } catch {
              storedSimilarityDecision = null;
            }
            const storedSelection = storedSimilarityDecision?.selection;
            const storedDecisionMatchesWindow =
              storedSimilarityDecision?.verdict === "go" &&
              storedSelection?.beachId === item.beach_id &&
              storedSelection.windowStart === similarityForecastAt &&
              storedSelection.windowEnd === similarityWindowEnd;
            const similarityPolicyContext =
              Number.isFinite(similarityForecastAtMs) &&
              similarityWindowEnd.length > 0
                ? {
                    kind: "positive_session_recommendation" as const,
                    beach_id: item.beach_id,
                    starts_at: similarityForecastAt,
                    ends_at: similarityWindowEnd,
                  }
                : null;
            const similarityPayload = {
              beach_id: String(snap.beach_id ?? item.beach_id),
              configured_beach_id:
                typeof snap.configured_beach_id === "string"
                  ? snap.configured_beach_id
                  : undefined,
              beach_slug: String(snap.beach_slug ?? ""),
              beach_name: String(snap.beach_name ?? item.beach_name),
              alert_date: item.alert_date,
              forecast_at: similarityForecastAt,
              score: typeof snap.score === "number" ? snap.score : 0,
              label: snap.label == null ? null : String(snap.label),
              reason: String(snap.reason ?? ""),
              ...(optionalStringField(snap.window_local) == null
                ? {}
                : { window_local: optionalStringField(snap.window_local) }),
              ...(optionalNumberField(snap.wave_height_ft) == null
                ? {}
                : { wave_height_ft: optionalNumberField(snap.wave_height_ft) }),
              ...(optionalNumberField(snap.wave_period_s) == null
                ? {}
                : { wave_period_s: optionalNumberField(snap.wave_period_s) }),
              ...(optionalNumberField(snap.wind_speed_mph) == null
                ? {}
                : { wind_speed_mph: optionalNumberField(snap.wind_speed_mph) }),
              ...(optionalStringField(snap.wind_direction) == null
                ? {}
                : { wind_direction: optionalStringField(snap.wind_direction) }),
              ...(optionalNumberField(snap.tide_height_ft) == null
                ? {}
                : { tide_height_ft: optionalNumberField(snap.tide_height_ft) }),
              ...(optionalStringField(snap.tide_status) == null
                ? {}
                : { tide_status: optionalStringField(snap.tide_status) }),
              ...(optionalNumberField(snap.confidence) == null
                ? {}
                : { confidence: optionalNumberField(snap.confidence) }),
              ...(optionalStringField(snap.condition_summary) == null
                ? {}
                : {
                    condition_summary: optionalStringField(
                      snap.condition_summary,
                    ),
                  }),
              ...(optionalStringField(snap.board_tip) == null
                ? {}
                : { board_tip: optionalStringField(snap.board_tip) }),
              ...(optionalStringField(snap.setup_tip) == null
                ? {}
                : { setup_tip: optionalStringField(snap.setup_tip) }),
              ...(similarityPolicyContext
                ? { policy_context: similarityPolicyContext }
                : {}),
              queue_items: [{ queue_id: item.id, rule_id: item.rule_id }],
            };
            const similarityHold = await resolveNotificationMajorEventHold({
              eventId: `condition-alert-deliver:similarity:${item.id}`,
              type: "similarity_match",
              payload: similarityPayload,
              profileExperience: parseSkillLevel(profile.experience_level),
            });
            const similarityScore =
              typeof snap.score === "number" && Number.isFinite(snap.score)
                ? snap.score
                : item.best_score;
            const normalizedSimilarityScore =
              similarityScore <= 10 ? similarityScore * 10 : similarityScore;
            const similarityMatch: MatchingWindow = {
              rule_id: item.rule_id,
              rule_name: item.rule_name,
              beach_id: item.beach_id,
              beach_name: item.beach_name,
              beach_slug: item.beach_slug ?? null,
              beach_skill_level:
                item.beach_skill_level ?? item.beach_meta?.skill_level ?? null,
              beach_timezone: item.beach_timezone,
              window_start: similarityForecastAt,
              window_end: similarityWindowEnd,
              best_hour: similarityForecastAt,
              best_score: normalizedSimilarityScore,
              conditions_snapshot: {
                ...snap,
                wave_height: snap.wave_height_ft,
              },
              forecast_id:
                typeof snap.forecast_id === "string"
                  ? snap.forecast_id
                  : undefined,
              notify_email: false,
              notify_push: true,
            };
            const similarityDecision =
              similarityHold.status === "allowed"
                ? buildAlertSessionDecision({
                    matches: [similarityMatch],
                    profileExperience: profile.experience_level,
                  })
                : null;
            const selectedSimilarityMatch = similarityDecision
              ? selectedAlertMatch([similarityMatch], similarityDecision)
              : null;
            const notificationDecision =
              storedDecisionMatchesWindow && storedSimilarityDecision
                ? storedSimilarityDecision
                : similarityDecision;
            if (!forecastDeliveryEnabled) {
              const reasonCode =
                similarityHold.status === "suppressed"
                  ? similarityHold.reasonCode
                  : (notificationDecision?.reasonCode ?? "no_candidates");
              shadowOutcomesByQueue.set(item.id, {
                status: "shadow_withheld",
                verdict:
                  similarityHold.status === "suppressed"
                    ? "no"
                    : (notificationDecision?.verdict ?? "no"),
                reason_code: reasonCode,
                preset_type: item.preset_type ?? null,
                would_use_channels: [],
              });
            }
            if (
              similarityHold.status !== "allowed" ||
              !similarityDecision ||
              !selectedSimilarityMatch ||
              notificationDecision?.verdict !== "go"
            ) {
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel: "push",
                status: "skipped_disabled",
                skipReason:
                  similarityHold.status === "suppressed"
                    ? `${similarityHold.auditCode}:${similarityHold.reasonCode}`
                    : `canonical_decision:${similarityDecision?.reasonCode ?? "unavailable"}`,
              });
              if (!forecastDeliveryEnabled) {
                await persistShadowOutcome(item);
              }
              const similaritySuppressionReason =
                similarityHold.status === "suppressed"
                  ? similarityHold.reasonCode
                  : null;
              if (similaritySuppressionReason === "hold_state_unavailable") {
                const reason = unresolvedHoldDisposition(item);
                if (reason) await markQueueItemsConsumed([item], reason);
              } else if (similaritySuppressionReason === "major_event_hold") {
                await markQueueItemsConsumed([item], "major_event_hold");
              } else {
                await markQueueItemsConsumed(
                  [item],
                  "canonical_safety_rejected",
                );
              }
              continue;
            }

            if (!forecastDeliveryEnabled) {
              addShadowChannel([item], "push");
              await persistShadowOutcome(item);
              const outcome = shadowOutcomesByQueue.get(item.id)!;
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel: "push",
                status: "shadow_withheld",
                skipReason: JSON.stringify(outcome),
              });
              await markQueueItemsConsumed([item], "shadow_withheld");
              continue;
            }

            const enqueueResult = await enqueueNotification({
              type: "similarity_match",
              recipientUserId: item.user_id,
              entityType: "beach",
              entityId: item.beach_id,
              payload: {
                ...similarityPayload,
                session_decision: notificationDecision,
              },
              dedupeKey:
                `similarity_match:${item.user_id}:${item.beach_id}:` +
                `${similarityForecastAt}:${notificationDecision.decisionId}`,
            }).catch((err) => {
              console.error(
                `${CONTEXT_TAG} similarity enqueue threw for user ${item.user_id}:`,
                err,
              );
              return {
                enqueued: false as const,
                reason: "internal_error" as const,
              };
            });

            if (enqueueResult.enqueued) {
              // Defer the per-queue-item alert_delivery_attempts row write to
              // the registry's onChannelOutcome hook (mirrors forecast_alert)
              // so the cron's cooldown / cap reads only see actually-delivered
              // pushes — not enqueued-but-pref-skipped ones.
              deliveryAcceptedQueueIds.add(item.id);
              const marked = await markQueueItemsConsumed([item], "delivered");
              if (marked) {
                result.pushSent++;
                console.log(
                  `${CONTEXT_TAG} Similarity push enqueued for user ${item.user_id} (event ${enqueueResult.eventId})`,
                );
              }
            } else if (enqueueResult.reason === "duplicate") {
              // Worker-level dedup caught it — a prior tick already enqueued
              // the same similarity_match for today. Mark queue sent so we
              // don't loop on it; record the skip.
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel: "push",
                status: "skipped_dedup_collision",
                skipReason: "notification_events dedupe_key collision",
              });
              await markQueueItemsConsumed([item], "deduplicated");
            } else if (enqueueResult.reason === "invalid_payload") {
              // Permanent — don't retry. Mark queue sent + record the failure.
              console.error(
                `${CONTEXT_TAG} similarity enqueue rejected invalid payload for user ${item.user_id}:`,
                enqueueResult,
              );
              result.errors++;
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel: "push",
                status: "failed_internal",
                skipReason: `enqueue: invalid_payload${enqueueResult.message ? `: ${enqueueResult.message}` : ""}`,
              });
              await markQueueItemsConsumed([item], "invalid_payload");
            } else {
              // internal_error / unknown_type — leave queue UNSENT so the
              // next tick can retry. Record the attempt for observability.
              console.error(
                `${CONTEXT_TAG} similarity enqueue failed for user ${item.user_id}:`,
                enqueueResult,
              );
              result.errors++;
              await recordAttempt({
                queueId: item.id,
                ruleId: item.rule_id,
                userId: item.user_id,
                channel: "push",
                status: "failed_internal",
                skipReason: `enqueue: ${enqueueResult.reason}`,
              });
            }
          } catch (similarityErr) {
            console.error(
              `${CONTEXT_TAG} Error processing similarity user ${item.user_id}:`,
              similarityErr,
            );
            result.errors++;
          }
        }

        const reasonTotal = Object.values(result.queue_marked_by_reason).reduce(
          (sum, count) => sum + count,
          0,
        );
        const unexplainedConsumed = [...DEGRADED_QUEUE_MARK_REASONS].reduce(
          (sum, reason) => sum + result.queue_marked_by_reason[reason],
          0,
        );
        if (
          reasonTotal !== result.queueMarked ||
          unexplainedConsumed > 0 ||
          result.holdStateUnavailableDeferred > 0
        ) {
          result.status = "degraded";
          console.warn(`${CONTEXT_TAG} degraded queue consumption`, {
            queue_marked: result.queueMarked,
            reason_total: reasonTotal,
            unexplained_consumed: unexplainedConsumed,
            hold_state_unavailable_deferred:
              result.holdStateUnavailableDeferred,
            queue_marked_by_reason: result.queue_marked_by_reason,
          });
        }

        console.log(`${CONTEXT_TAG} Summary:`, result);
        return result;
      },
    );
    return NextResponse.json(summary, {
      status: summary.status === "degraded" ? 503 : 200,
    });
  } catch (err) {
    console.error(`${CONTEXT_TAG} Fatal error:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
