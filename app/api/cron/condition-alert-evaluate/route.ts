// app/api/cron/condition-alert-evaluate/route.ts
import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withCronOutcome } from "@/lib/cron/outcome";
import { findMatchingWindows } from "@/lib/alerts/window-finder";
import { evaluateWatchedCall } from "@/lib/alerts/watched-call-evaluator";
import { selectActionableAlertWindow } from "@/lib/alerts/actionable-window-selector";
import { filterToDaylight, getDaylightWindow } from "@/lib/alerts/sunrise";
import { CAPS, resolveEntitlement } from "@/lib/alerts/entitlements";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import { parseWindSpeedToKt, parseSwellDirectionToDegrees } from "@/lib/alerts/forecast-parsers";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";
import type { Database } from "@/types/database.generated";
import { getMinRideable, MINIMUM_VIABLE_WINDOW_MINUTES } from "@/lib/utils/surf-call-logic";
import type { Beach } from "@/types/database";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { resolveNotificationMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/notification";
import type { RecommendationHoldReasonCode } from "@/lib/recommendations/major-event-hold/types";
import { discoverSurfSpots } from "@/lib/services/surf-discovery-service";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[condition-alert-evaluate]";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id"
  | "home_beach_id"
  | "notif_forecast_alerts"
  | "notif_email_enabled"
  | "notif_push_enabled"
  | "experience_level"
>;
type BeachRow = Beach;
type EntitlementRow = Pick<
  Database["public"]["Tables"]["user_entitlements"]["Row"],
  "user_id" | "is_pro" | "is_trialing" | "billing_issue" | "expires_at"
>;
type AlertQueueInsertWithBestScore =
  Database["public"]["Tables"]["alert_queue"]["Insert"] & {
    best_score: number;
  };

function watchedWindowId(
  watched: NonNullable<AlertConditions["watched_call"]>,
  window: { window_start: string; window_end: string; forecast_id?: string },
  index: number,
): string {
  const overlap = Math.max(
    0,
    Math.min(Date.parse(watched.windowEnd), Date.parse(window.window_end))
      - Math.max(Date.parse(watched.windowStart), Date.parse(window.window_start)),
  );
  const shorter = Math.min(
    Date.parse(watched.windowEnd) - Date.parse(watched.windowStart),
    Date.parse(window.window_end) - Date.parse(window.window_start),
  );
  if (shorter > 0 && overlap / shorter >= 0.5) return watched.recommendationId;
  return window.forecast_id ?? `${watched.beachId}:${window.window_start}:${index}`;
}

function watchedCallPayload(args: {
  evaluation: ReturnType<typeof evaluateWatchedCall>;
  watched: NonNullable<AlertConditions["watched_call"]>;
  beachName: string;
}): Record<string, unknown> | null {
  if (args.evaluation.delivery !== "eligible") return null;
  const current = args.evaluation.update?.currentIdentity.recommendation;
  const category = args.evaluation.category;
  const title = category === "still_on"
    ? `Still on at ${args.beachName}`
    : category === "call_changed"
      ? `Call changed at ${args.beachName}`
      : category === "better_nearby"
        ? `Better nearby than ${args.beachName}`
        : `Watched window ended at ${args.beachName}`;
  const body = category === "still_on"
    ? "Your watched window is still on."
    : category === "call_changed"
      ? "The strongest useful window changed."
      : category === "better_nearby"
        ? "A nearby useful window is materially stronger."
        : "Your watched window has ended.";
  return {
    category,
    cause: args.evaluation.update?.cause ?? "window_passed",
    alert_rule_id: args.evaluation.update?.priorIdentity.alertRule.id,
    beach_id: current?.beachId ?? args.watched.beachId,
    beach_name: args.beachName,
    recommendation_id: current?.recommendationId ?? args.watched.recommendationId,
    prior_recommendation_id: args.watched.recommendationId,
    window_start: current?.windowStart ?? args.watched.windowStart,
    window_end: current?.windowEnd ?? args.watched.windowEnd,
    forecast_at: current?.forecastAt ?? args.watched.forecastAt,
    title,
    body,
  };
}

interface ConditionAlertEvaluationSummary {
  status: "ok" | "degraded";
  evaluated: number;
  matched: number;
  queued: number;
  skipped: number;
  skipped_unsurfable: number;
  skipped_by_reason: Record<RecommendationHoldReasonCode, number>;
  errors: number;
}

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();

  try {
    const summary = await withCronOutcome(
      {
        job: "/api/cron/condition-alert-evaluate",
        unit: "alerts_queued",
        expectedMin: 1,
        getProduced: (result) => result.queued,
        legitimatelyZero: (result) => {
          if (
            result.status === "ok" &&
            result.errors === 0 &&
            result.skipped_by_reason.hold_state_unavailable === 0
          ) {
            return { reason: "No actionable alert windows matched this cycle" };
          }
          return undefined;
        },
        failureReason: (result) =>
          result.status === "degraded"
            ? "Matched alert windows dropped without a safety hold"
            : null,
      },
      async () => {
        const result: ConditionAlertEvaluationSummary = {
          status: "ok",
          evaluated: 0,
          matched: 0,
          queued: 0,
          skipped: 0,
          skipped_unsurfable: 0,
          skipped_by_reason: {
            hold_state_unavailable: 0,
            major_event_hold: 0,
            water_quality_hold: 0,
          },
          errors: 0,
        };

        // 1. Fetch all enabled rules — flat select, no embeds.
        //    Previously this used profiles!inner(...) which requires PostgREST to
        //    resolve the two-hop FK alert_rules.user_id → auth.users.id ← profiles.id.
        //    That embed was throwing silently in prod (A2 diagnosis H1, ~60% confidence).
        const { data: rules, error: rulesError } = await supabase
          .from("alert_rules")
          .select("id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at")
          .eq("enabled", true)
          .or("preset_type.is.null,preset_type.neq.similarity_match");

        if (rulesError) throw rulesError;
        if (!rules || rules.length === 0) {
          console.log(`${CONTEXT_TAG} No enabled alert rules found`);
          return { ...result, message: "No rules to evaluate" };
        }

        // 2. Collect distinct user + beach IDs for batch lookups.
        const userIds = [...new Set(rules.map((r) => r.user_id))];
        const beachIds = [...new Set(rules.map((r) => r.beach_id))];

        // 3. Three flat selects in parallel — no join resolution, no relationship hop.
        const [profilesRes, beachesRes, entitlementsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, home_beach_id, notif_forecast_alerts, notif_email_enabled, notif_push_enabled, experience_level")
            .in("id", userIds),
          supabase
            .from("beaches")
            .select("*")
            .in("id", beachIds),
          supabase
            .from("user_entitlements")
            .select("user_id, is_pro, is_trialing, billing_issue, expires_at")
            .in("user_id", userIds),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (beachesRes.error) throw beachesRes.error;
        // user_entitlements legitimately has no rows for free users — only throw on hard errors.
        if (entitlementsRes.error) throw entitlementsRes.error;

        // 4. Build O(1) lookup maps.
        const profilesById = new Map<string, ProfileRow>();
        for (const p of profilesRes.data ?? []) profilesById.set(p.id, p);

        const beachesById = new Map<string, BeachRow>();
        for (const b of beachesRes.data ?? []) beachesById.set(b.id, b);

        const entitlementByUserId = new Map<string, EntitlementRow>();
        for (const e of entitlementsRes.data ?? []) entitlementByUserId.set(e.user_id, e);

        // 5. Group rules by user, skipping users with no profile or alerts disabled.
        const byUser = new Map<string, typeof rules>();
        for (const rule of rules) {
          const profile = profilesById.get(rule.user_id);
          if (!profile) {
            console.error(`${CONTEXT_TAG} No profile found for user ${rule.user_id}, skipping rule ${rule.id}`);
            result.errors++;
            continue;
          }
          if (!profile.notif_forecast_alerts) {
            result.skipped++;
            continue;
          }
          const beach = beachesById.get(rule.beach_id);
          if (!beach) {
            console.error(`${CONTEXT_TAG} No beach found for beach_id ${rule.beach_id}, skipping rule ${rule.id}`);
            result.errors++;
            continue;
          }
          const existing = byUser.get(rule.user_id) ?? [];
          existing.push(rule);
          byUser.set(rule.user_id, existing);
        }

        // 6. Evaluate each user's rules.
        for (const [userId, userRules] of byUser) {
          try {
            const profile = profilesById.get(userId)!;
            const profileExperience = parseSkillLevel(profile.experience_level);
            const homeBeachId = profile.home_beach_id;
            const homeBeach = homeBeachId ? beachesById.get(homeBeachId) : undefined;
            const homeBeachTz = homeBeach?.timezone ?? "America/New_York";
            const userLocalDate = new Date().toLocaleDateString("en-CA", { timeZone: homeBeachTz });

            // A surf alert is unique per beach, not per user. This lets an
            // actionable second break through while keeping repeat windows at
            // the same break quiet for the rest of the local day.
            // `beach_id` is introduced by the same migration as this
            // behavior; keep this boundary untyped until generated DB types
            // are refreshed in the deployment environment.
            const { data: existing, error: existingError } = await (supabase as any)
              .from("alert_deliveries")
              .select("beach_id")
              .eq("user_id", userId)
              .eq("alert_date", userLocalDate);

            if (existingError) throw existingError;

            const deliveredBeachIds = new Set(
              ((existing ?? []) as Array<{ beach_id?: unknown }>)
                .map((delivery: { beach_id?: unknown }) => delivery.beach_id)
                .filter((beachId: unknown): beachId is string => typeof beachId === "string"),
            );
            const eligibleRules = userRules.filter(
              (rule) => rule.preset_type === "watched_call"
                || !deliveredBeachIds.has(rule.beach_id),
            );
            if (eligibleRules.length === 0) {
              result.skipped += userRules.length;
              continue;
            }

            // Apply entitlement caps — skip newest rules first.
            const entitlementRow = entitlementByUserId.get(userId) ?? null;
            const tier = resolveEntitlement(userId, entitlementRow);
            const caps = CAPS[tier];
            const sortedRules = [...eligibleRules].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const activeRules = sortedRules.slice(0, caps.totalRules);
            let nearbyRecommendations: Awaited<ReturnType<typeof discoverSurfSpots>>["recommendations"] = [];
            const activeWatchedRule = activeRules.find((rule) => {
              const watchedCall = (rule.conditions as AlertConditions).watched_call;
              return rule.preset_type === "watched_call"
                && watchedCall
                && Date.now() < Date.parse(watchedCall.windowEnd);
            });
            if (activeWatchedRule) {
              const anchorBeach = beachesById.get(activeWatchedRule.beach_id)!;
              const discovery = await discoverSurfSpots(userId, {
                userLocation: { lat: anchorBeach.lat, lon: anchorBeach.lon },
                horizonHours: 72,
                maxResults: 10,
                includeBeachIds: activeRules
                  .filter((rule) => rule.preset_type === "watched_call")
                  .map((rule) => rule.beach_id),
                isPro: tier === "premium",
              });
              nearbyRecommendations = discovery.recommendations;
            }

            const queueWatchedUpdate = async (args: {
              rule: (typeof activeRules)[number];
              watched: NonNullable<AlertConditions["watched_call"]>;
              beach: BeachAlertMeta;
              evaluation: ReturnType<typeof evaluateWatchedCall>;
            }): Promise<boolean> => {
              const payload = watchedCallPayload({
                evaluation: args.evaluation,
                watched: args.watched,
                beachName: args.beach.name,
              });
              if (!payload || args.evaluation.delivery !== "eligible") {
                result.skipped++;
                return !args.evaluation.keepWatchActive;
              }
              const postWindow = args.evaluation.category === "post_window";
              if (!postWindow) {
                const hold = await resolveNotificationMajorEventHold({
                  eventId: `condition-alert-evaluate:${args.rule.id}:${String(payload.window_start)}`,
                  type: "forecast_alert",
                  payload: {
                    beach_id: String(payload.beach_id),
                    configured_beach_id: args.rule.beach_id,
                    forecast_at: payload.forecast_at,
                    policy_context: {
                      kind: "positive_session_recommendation",
                      beach_id: String(payload.beach_id),
                      starts_at: String(payload.window_start),
                      ends_at: String(payload.window_end),
                    },
                  },
                  profileExperience,
                });
                if (hold.status === "suppressed") {
                  result.skipped++;
                  result.skipped_by_reason[hold.reasonCode]++;
                  return false;
                }
              }
              const queueStart = postWindow
                ? args.watched.windowEnd
                : String(payload.window_start);
              const queueEnd = postWindow
                ? new Date(Date.parse(queueStart) + 1).toISOString()
                : String(payload.window_end);
              const queueRow: AlertQueueInsertWithBestScore = {
                user_id: userId,
                rule_id: args.rule.id,
                beach_id: String(payload.beach_id),
                alert_date: userLocalDate,
                send_at: new Date().toISOString(),
                window_start: queueStart,
                window_end: queueEnd,
                best_hour: String(payload.forecast_at ?? queueStart),
                best_score: args.watched.overallScore / 100,
                conditions_snapshot: {
                  alert_type: "watched_call_update",
                  dedupe_key: args.evaluation.dedupeKey,
                  payload,
                } as import("@/types/database.generated").Json,
              };
              const { error } = await supabase.from("alert_queue").upsert(
                queueRow,
                { onConflict: "rule_id,alert_date,window_start", ignoreDuplicates: true },
              );
              if (error) {
                console.error(`${CONTEXT_TAG} Failed to queue watched-call update:`, error);
                result.errors++;
                return false;
              }
              result.matched++;
              result.queued++;
              return true;
            };

            for (const rule of activeRules) {
              result.evaluated++;
              const beach = beachesById.get(rule.beach_id) as BeachAlertMeta;
              const conditions = rule.conditions as AlertConditions;
              const watched = rule.preset_type === "watched_call"
                ? conditions.watched_call
                : undefined;

              const { start: todayStart, end: todayEnd } = getUtcDayBounds(userLocalDate, beach.timezone);

              if (watched && Date.now() >= Date.parse(watched.windowEnd)) {
                const { data: responses, error: responseError } = await supabase
                  .from("sessions")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("beach_id", watched.beachId)
                  .eq("status", "completed")
                  .is("deleted_at", null)
                  .gte("arrival_time", watched.windowStart)
                  .lte("arrival_time", watched.windowEnd)
                  .limit(1);
                if (responseError) throw responseError;
                const evaluation = evaluateWatchedCall({
                  alertRule: { id: rule.id, beach_id: rule.beach_id },
                  watched,
                  localDate: userLocalDate,
                  generatedAt: new Date().toISOString(),
                  scorerVersion: "condition-alert-v1",
                  candidateFingerprint: watched.beachId,
                  requestFingerprint: `${watched.beachId}:${watched.mode}`,
                  bestWindowId: null,
                  windows: [],
                  now: new Date(),
                  alreadyResponded: (responses?.length ?? 0) > 0,
                  lastStillOnAt: null,
                });
                const terminalHandled = await queueWatchedUpdate({ rule, watched, beach, evaluation });
                if (terminalHandled && !evaluation.keepWatchActive) {
                  const { error: retireError } = await supabase
                    .from("alert_rules")
                    .update({ enabled: false })
                    .eq("id", rule.id);
                  if (retireError) {
                    console.error(`${CONTEXT_TAG} Failed to retire watched call:`, retireError);
                    result.errors++;
                  }
                }
                continue;
              }

              const { data: forecasts, error: forecastsError } = await supabase
                .from("enhanced_forecasts")
                .select("*")
                .eq("beach_id", rule.beach_id)
                .gte("forecast_at", todayStart)
                .lt("forecast_at", todayEnd)
                .order("forecast_at", { ascending: true });

              if (forecastsError) throw forecastsError;

              if (!forecasts || forecasts.length === 0) continue;

              const parsed: ForecastHour[] = forecasts.map((f) => ({
                forecast_id: typeof f.id === "string" && f.id.length > 0 ? f.id : undefined,
                forecast_at: f.forecast_at,
                wave_height: f.wave_height ? parseFloat(f.wave_height) : null,
                wave_period: f.wave_period ? parseFloat(f.wave_period.replace("s", "")) : null,
                wave_direction: f.wave_direction ?? null,
                swell_1_height: f.swell_1_height ? parseFloat(f.swell_1_height) : null,
                swell_1_period: f.swell_1_period ? parseFloat(f.swell_1_period.replace("s", "")) : null,
                swell_1_direction: parseSwellDirectionToDegrees(f.swell_1_direction),
                wind_speed: parseWindSpeedToKt(f.wind_speed),
                wind_direction_deg: f.wind_direction_deg,
                tide_height: f.tide_height ? parseFloat(f.tide_height) : null,
                tide_status: f.tide_status,
              }));

              const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
              if (daylight.length === 0) continue;

              // For the surfability gate we need the MAX numeric from the raw
              // wave_height string, not parseFloat's first-number result —
              // enhanced_forecasts.wave_height is sometimes a range like
              // "1-2ft" (see lib/services/forecast/apply-beach-height-offset.ts).
              // parsed.wave_height is the lower bound (conservative for matching);
              // for "is anything in this window rideable?" we want the upper.
              //
              // Built from the unfiltered `forecasts` (not `daylight`) because
              // it's a cheap O(n) lookup table — the gate's reduce iterates
              // `daylight` for time-window scoping, but we'd rather build the
              // map once than re-scope it per window.
              const maxWaveByForecastAt = new Map<string, number>();
              for (const f of forecasts) {
                if (!f.wave_height) continue;
                const nums = String(f.wave_height).match(/[\d.]+/g);
                if (!nums) continue;
                const parsedNums = nums.map(Number).filter((n) => Number.isFinite(n));
                if (parsedNums.length === 0) continue;
                maxWaveByForecastAt.set(f.forecast_at, Math.max(...parsedNums));
              }

              const allWindows = findMatchingWindows(conditions, daylight, beach);
              if (allWindows.length === 0) continue;

              // Surfability gate: a rule can match conditions the user picked
              // (e.g. waves > 1ft) on a day that's still genuinely unsurfable
              // for the beach (max wave in the window below the break-type
              // minimum, or window shorter than 30 min). Suppress those — the
              // user only wants a report when paddling out is actually worth
              // it.
              //
              // We gate on the MAX wave height across the window's hours, not
              // the best-scoring hour from the snapshot. The snapshot picks the
              // hour with the best composite score (clean wind / matching
              // swell), which can be a small-but-glassy hour even when a later
              // hour in the same window has rideable size. Using the max
              // captures "is there ANY rideable hour in this window?"
              //
              // Mirrors the NO conditions in lib/utils/surf-call-logic.ts
              // computeSurfCall (waves below getMinRideable, no viable window).
              // Inlined here because the alert pipeline shapes
              // (FoundWindow/ForecastHour/BeachAlertMeta) don't match the
              // discovery shapes computeSurfCall expects.
              const beachRow = beachesById.get(rule.beach_id)!;
              const minRideable = getMinRideable(beachRow as unknown as Beach);
              const windows = allWindows.filter((w) => {
                const startMs = new Date(w.window_start).getTime();
                const endMs = new Date(w.window_end).getTime();
                const durationMinutes = (endMs - startMs) / 60000;
                if (durationMinutes < MINIMUM_VIABLE_WINDOW_MINUTES) return false;

                const maxWave = daylight.reduce<number | null>((max, hour) => {
                  const t = new Date(hour.forecast_at).getTime();
                  if (t < startMs || t > endMs) return max;
                  // Prefer the upper bound from the raw range string when
                  // available; fall back to the parsed lower bound.
                  const candidate =
                    maxWaveByForecastAt.get(hour.forecast_at) ??
                    (typeof hour.wave_height === "number" && Number.isFinite(hour.wave_height)
                      ? hour.wave_height
                      : null);
                  if (candidate === null) return max;
                  return max === null ? candidate : Math.max(max, candidate);
                }, null);

                // If we have any wave-height samples in the window and the max
                // is below the rideable minimum, drop. If we have no samples
                // (all null), let it through — fail-open for missing data
                // beats a silent suppression on every report.
                if (maxWave !== null && maxWave < minRideable) return false;

                return true;
              });
              if (windows.length === 0) {
                result.skipped_unsurfable++;
                continue;
              }

              if (watched) {
                const stableWindows = windows.map((window, index) => ({
                  id: watchedWindowId(watched, window, index),
                  bucket: "morning" as const,
                  start: window.window_start,
                  end: window.window_end,
                  peakTime: window.best_hour,
                  beachId: rule.beach_id,
                  rankingScore: window.best_score * 100,
                  verdict: "worth_it" as const,
                  rideable: true,
                  safe: true,
                }));
                const winner = stableWindows.reduce<(typeof stableWindows)[number] | null>(
                  (best, candidate) => !best || candidate.rankingScore > best.rankingScore
                    ? candidate
                    : best,
                  null,
                );
                const nearby = nearbyRecommendations.find((recommendation) =>
                  recommendation.kind !== "custom_spot"
                  && recommendation.beach.id !== watched.beachId,
                );
                const evaluation = evaluateWatchedCall({
                  alertRule: { id: rule.id, beach_id: rule.beach_id },
                  watched,
                  localDate: userLocalDate,
                  generatedAt: new Date().toISOString(),
                  scorerVersion: "condition-alert-v1",
                  candidateFingerprint: watched.beachId,
                  requestFingerprint: `${watched.beachId}:${watched.mode}`,
                  bestWindowId: winner?.id ?? null,
                  windows: stableWindows,
                  now: new Date(),
                  alreadyResponded: false,
                  lastStillOnAt: null,
                  nearbyRecommendation: nearby ? {
                    recommendationId: nearby.recommendationId
                      ?? `beach:${nearby.beach.id}:${nearby.forecast.forecast_at}`,
                    beachId: nearby.beach.id,
                    windowStart: nearby.window.start.toISOString(),
                    windowEnd: nearby.window.end.toISOString(),
                    forecastAt: nearby.forecast.forecast_at,
                    recommendationState: nearby.recommendationLabel === "Worth it"
                      ? "ready_today"
                      : "available",
                    conditionScore: nearby.score,
                    personalMatchScore: nearby.similarity?.state === "ready"
                      ? Math.max(0, Math.min(100, nearby.similarity.score * 10))
                      : 0,
                    overallScore: nearby.score,
                    reasonType: "forecast_conditions",
                  } : undefined,
                });
                await queueWatchedUpdate({ rule, watched, beach, evaluation });
                continue;
              }

              const matchedWindow = selectActionableAlertWindow(windows, new Date());
              if (!matchedWindow) continue;

              result.matched++;

              const { sunrise } = getDaylightWindow(beach.lat, beach.lon, new Date(todayStart));

              let holdSuppressed = false;
              for (const window of [matchedWindow]) {
                const holdResolution = await resolveNotificationMajorEventHold({
                  eventId: `condition-alert-evaluate:${rule.id}:${window.window_start}`,
                  type: "forecast_alert",
                  payload: {
                    beach_id: rule.beach_id,
                    configured_beach_id: rule.beach_id,
                    forecast_at: window.best_hour,
                    policy_context: {
                      kind: "positive_session_recommendation",
                      beach_id: rule.beach_id,
                      starts_at: window.window_start,
                      ends_at: window.window_end,
                    },
                  },
                  profileExperience,
                });
                if (holdResolution.status === "suppressed") {
                  result.skipped++;
                  result.skipped_by_reason[holdResolution.reasonCode]++;
                  console.warn(`${CONTEXT_TAG} Suppressed matched alert window`, {
                    rule_id: rule.id,
                    user_id: userId,
                    beach_id: rule.beach_id,
                    reason_code: holdResolution.reasonCode,
                  });
                  holdSuppressed = true;
                  continue;
                }

                const sendAtDate = new Date(new Date(window.window_start).getTime() - 2 * 60 * 60 * 1000);
                const clampedSendAt = sendAtDate < sunrise ? sunrise : sendAtDate;
                const sendAt = clampedSendAt < new Date() ? new Date() : clampedSendAt;
                const queueRow: AlertQueueInsertWithBestScore = {
                  user_id: userId,
                  rule_id: rule.id,
                  beach_id: rule.beach_id,
                  alert_date: userLocalDate,
                  send_at: sendAt.toISOString(),
                  window_start: window.window_start,
                  window_end: window.window_end,
                  best_hour: window.best_hour,
                  best_score: window.best_score,
                  // conditions_snapshot is Record<string,unknown> from MatchingWindow
                  // but the DB column is typed as Json — structurally compatible.
                  conditions_snapshot: window.conditions_snapshot as import("@/types/database.generated").Json,
                };

                const { error: insertError } = await supabase
                  .from("alert_queue")
                  .upsert(
                    queueRow,
                    { onConflict: "rule_id,alert_date,window_start", ignoreDuplicates: true }
                  );

                if (insertError) {
                  console.error(`${CONTEXT_TAG} Failed to queue alert:`, insertError);
                  result.errors++;
                } else {
                  result.queued++;
                }
              }

              if (!holdSuppressed) {
                await supabase
                  .from("alert_rules")
                  .update({ last_matched_at: new Date().toISOString() })
                  .eq("id", rule.id);
              }
            }
          } catch (err) {
            console.error(`${CONTEXT_TAG} Error evaluating user ${userId}:`, err);
            result.errors++;
          }
        }

        // A matched window that never reaches the queue is only expected when a
        // real safety hold suppressed it (`major_event_hold`) — that is the hold
        // system working, and must stay `ok` or every big-swell day alarms falsely.
        // `hold_state_unavailable` is the opposite: the hold could not be resolved
        // at all, so the alert was dropped by a failure. That is the state which
        // silently killed every forecast alert from 2026-07-26 onward.
        if (result.skipped_by_reason.hold_state_unavailable > 0) {
          result.status = "degraded";
          console.warn(`${CONTEXT_TAG} Matched alert windows dropped without a safety hold`, {
            matched: result.matched,
            queued: result.queued,
            skipped_by_reason: result.skipped_by_reason,
            errors: result.errors,
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
