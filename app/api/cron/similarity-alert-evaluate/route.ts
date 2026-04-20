// @ts-nocheck — PostgREST resolves alert_rules→auth.users→profiles at runtime
// via an explicit `profiles!inner(...)` hint, but TypeScript can't follow the
// two-hop FK chain, so the generated types report
// `could not find the relation between alert_rules and profiles` even though
// the query works at runtime. Same hint as condition-alert-evaluate.
// app/api/cron/similarity-alert-evaluate/route.ts
//
// Similarity-alert evaluator — runs daily 08:00 UTC.
//
// For every enabled `similarity_alert` rule, iterates the next day's forecast
// hours at the rule's beach and calls compute_spot_similarity_score() per
// hour. When the returned score is >= rule.conditions.similarity_threshold
// (default 7.5) the match is enqueued into alert_queue for the existing
// condition-alert-deliver cron to consolidate + ship via push + email.
//
// Infrastructure reused as-is:
// - alert_queue + alert_deliveries tables (no schema delta)
// - condition-alert-deliver cron (same queue, same dedup, same payload shape)
// - alerts/sunrise.filterToDaylight + getDaylightWindow
// - alerts/entitlements getUserEntitlement + CAPS
// - alerts/timezone-utils getUtcDayBounds
// - compute_spot_similarity_score RPC (view-time on beach-detail, cron-time here)

import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { filterToDaylight, getDaylightWindow } from "@/lib/alerts/sunrise";
import { getUserEntitlement, CAPS } from "@/lib/alerts/entitlements";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import { SIMILARITY_ALERT_DEFAULT_THRESHOLD } from "@/lib/alerts/presets";
import type { BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[similarity-alert-evaluate]";

interface SimilarityRpcResult {
  score: number;
  match_percent: number;
  label: string;
  session_count?: number;
  state?: string;
  reason_bullets?: unknown;
  board_tip?: string | null;
}

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();
  const summary = {
    evaluated: 0,
    matched: 0,
    queued: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select(
        `
        id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at,
        beaches!inner(id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg,
          preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
          swell_window_center_deg, swell_window_halfwidth_deg),
        profiles!inner(id, home_beach_id, notif_forecast_alerts, notif_email_enabled, notif_push_enabled)
      `,
      )
      .eq("enabled", true)
      .eq("preset_type", "similarity_alert");

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      console.log(`${CONTEXT_TAG} No enabled similarity_alert rules`);
      return NextResponse.json({ ...summary, message: "No rules to evaluate" });
    }

    const byUser = new Map<string, typeof rules>();
    for (const rule of rules) {
      if (!rule.profiles?.notif_forecast_alerts) {
        summary.skipped++;
        continue;
      }
      const existing = byUser.get(rule.user_id) ?? [];
      existing.push(rule);
      byUser.set(rule.user_id, existing);
    }

    for (const [userId, userRules] of byUser) {
      try {
        const homeBeachId = userRules[0].profiles?.home_beach_id;
        const homeBeachTz =
          userRules.find((r) => r.beach_id === homeBeachId)?.beaches?.timezone ??
          "America/New_York";
        const userLocalDate = new Date().toLocaleDateString("en-CA", {
          timeZone: homeBeachTz,
        });

        // Per-user dedup: if any delivery already recorded today, skip the
        // user entirely. Matches condition-alert-evaluate behavior so that
        // similarity + condition rules consolidate into a single daily email.
        const { data: existing } = await supabase
          .from("alert_deliveries")
          .select("id")
          .eq("user_id", userId)
          .eq("alert_date", userLocalDate)
          .limit(1);
        if (existing && existing.length > 0) {
          summary.skipped += userRules.length;
          continue;
        }

        // Entitlement cap — same pattern as condition-alert-evaluate.
        // Newest rules are dropped first when a user exceeds their tier cap.
        const tier = getUserEntitlement(userId);
        const caps = CAPS[tier];
        const sortedRules = [...userRules].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime(),
        );
        const activeRules = sortedRules.slice(0, caps.totalRules);

        for (const rule of activeRules) {
          summary.evaluated++;
          const beach = rule.beaches as unknown as BeachAlertMeta;
          const conditions = (rule.conditions ?? {}) as {
            similarity_threshold?: number;
          };
          const threshold =
            typeof conditions.similarity_threshold === "number"
              ? conditions.similarity_threshold
              : SIMILARITY_ALERT_DEFAULT_THRESHOLD;

          const { start: todayStart, end: todayEnd } = getUtcDayBounds(
            userLocalDate,
            beach.timezone,
          );

          const { data: forecasts } = await supabase
            .from("enhanced_forecasts")
            .select(
              "forecast_at, wave_height, wave_period, swell_1_height, swell_1_period, swell_1_direction, wind_speed, wind_direction_deg, tide_height, tide_status",
            )
            .eq("beach_id", rule.beach_id)
            .gte("forecast_at", todayStart)
            .lt("forecast_at", todayEnd)
            .order("forecast_at", { ascending: true });

          if (!forecasts || forecasts.length === 0) continue;

          const parsed: ForecastHour[] = forecasts.map((f) => ({
            forecast_at: f.forecast_at,
            wave_height: f.wave_height ? parseFloat(f.wave_height) : null,
            wave_period: f.wave_period
              ? parseFloat(String(f.wave_period).replace("s", ""))
              : null,
            swell_1_height: f.swell_1_height ? parseFloat(f.swell_1_height) : null,
            swell_1_period: f.swell_1_period
              ? parseFloat(String(f.swell_1_period).replace("s", ""))
              : null,
            swell_1_direction: f.swell_1_direction
              ? parseFloat(String(f.swell_1_direction))
              : null,
            wind_speed: f.wind_speed ? parseFloat(f.wind_speed) : null,
            wind_direction_deg: f.wind_direction_deg,
            tide_height: f.tide_height ? parseFloat(f.tide_height) : null,
            tide_status: f.tide_status,
          }));

          const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
          if (daylight.length === 0) continue;

          // Score each daylight hour with the RPC. This is the key divergence
          // from condition-alert-evaluate: we don't have a static
          // condition envelope; the "match" is a personalized score against
          // the user's rated session history at this beach.
          const matchedHours: Array<{
            hour: ForecastHour;
            result: SimilarityRpcResult;
          }> = [];
          for (const hour of daylight) {
            if (hour.wave_height == null || hour.wave_period == null) continue;
            const { data: rpcData, error: rpcError } = await supabase.rpc(
              "compute_spot_similarity_score",
              {
                p_user_id: userId,
                p_beach_id: rule.beach_id,
                p_wave_height: hour.wave_height,
                p_wave_period: hour.wave_period,
                p_wind_speed: hour.wind_speed,
                p_wind_direction: hour.wind_direction_deg,
                p_tide_height: hour.tide_height,
              },
            );
            if (rpcError) {
              console.warn(
                `${CONTEXT_TAG} RPC error for rule ${rule.id} hour ${hour.forecast_at}:`,
                rpcError.message,
              );
              continue;
            }
            const result = rpcData as SimilarityRpcResult;
            // The RPC returns score: 0 with state: 'onboarding' when the user
            // hasn't logged 5+ rated sessions yet. Skip those silently rather
            // than firing a meaningless alert.
            if (!result || result.state === "onboarding") continue;
            if (typeof result.score !== "number") continue;
            if (result.score < threshold) continue;
            matchedHours.push({ hour, result });
          }

          if (matchedHours.length === 0) continue;

          summary.matched++;

          // Collapse consecutive matched hours into a single window keyed by
          // the peak score. The delivery cron expects one queue row per
          // window, same as condition-alert-evaluate.
          const windows = consolidateMatchedHours(matchedHours);

          const { sunrise } = getDaylightWindow(
            beach.lat,
            beach.lon,
            new Date(todayStart),
          );

          for (const win of windows) {
            const sendAtDate = new Date(
              new Date(win.window_start).getTime() - 2 * 60 * 60 * 1000,
            );
            const clampedSendAt =
              sendAtDate < sunrise ? sunrise : sendAtDate;
            const sendAt =
              clampedSendAt < new Date() ? new Date() : clampedSendAt;

            const { error: insertError } = await (supabase as any)
              .from("alert_queue")
              .upsert(
                {
                  user_id: userId,
                  rule_id: rule.id,
                  beach_id: rule.beach_id,
                  alert_date: userLocalDate,
                  send_at: sendAt.toISOString(),
                  window_start: win.window_start,
                  window_end: win.window_end,
                  best_hour: win.best_hour,
                  conditions_snapshot: win.conditions_snapshot,
                },
                {
                  onConflict: "rule_id,alert_date,window_start",
                  ignoreDuplicates: true,
                },
              );

            if (insertError) {
              console.error(
                `${CONTEXT_TAG} Failed to queue alert:`,
                insertError,
              );
              summary.errors++;
            } else {
              summary.queued++;
            }
          }

          await supabase
            .from("alert_rules")
            .update({ last_matched_at: new Date().toISOString() })
            .eq("id", rule.id);
        }
      } catch (err) {
        console.error(
          `${CONTEXT_TAG} Error evaluating user ${userId}:`,
          err,
        );
        summary.errors++;
      }
    }

    console.log(`${CONTEXT_TAG} Summary:`, summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error(`${CONTEXT_TAG} Fatal error:`, err);
    return NextResponse.json(
      { error: "Internal error", summary },
      { status: 500 },
    );
  }
}

interface MatchedWindow {
  window_start: string;
  window_end: string;
  best_hour: string;
  conditions_snapshot: Record<string, unknown>;
}

// Collapses a time-ordered list of matched hours into contiguous windows.
// A "contiguous" run is one where each hour is exactly +1h from the prior.
// The conditions_snapshot of the window is the RPC result of its peak-score
// hour (the delivery cron surfaces it as the single headline for the window).
export function consolidateMatchedHours(
  matched: Array<{
    hour: ForecastHour;
    result: SimilarityRpcResult;
  }>,
): MatchedWindow[] {
  if (matched.length === 0) return [];

  // Ensure chronological ordering — caller passes daylight order which is
  // already chronological, but the invariant is load-bearing here.
  const sorted = [...matched].sort(
    (a, b) =>
      new Date(a.hour.forecast_at).getTime() -
      new Date(b.hour.forecast_at).getTime(),
  );

  const windows: MatchedWindow[] = [];
  let runStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    const isRunBreak =
      i === sorted.length ||
      new Date(sorted[i].hour.forecast_at).getTime() -
        new Date(sorted[i - 1].hour.forecast_at).getTime() >
        60 * 60 * 1000 + 5 * 60 * 1000; // >65 minutes = gap
    if (!isRunBreak) continue;

    const run = sorted.slice(runStart, i);
    const peak = run.reduce((best, curr) =>
      curr.result.score > best.result.score ? curr : best,
    );
    windows.push({
      window_start: run[0].hour.forecast_at,
      window_end: new Date(
        new Date(run[run.length - 1].hour.forecast_at).getTime() +
          60 * 60 * 1000,
      ).toISOString(),
      best_hour: peak.hour.forecast_at,
      conditions_snapshot: {
        similarity_score: peak.result.score,
        match_percent: peak.result.match_percent,
        label: peak.result.label,
        reason_bullets: peak.result.reason_bullets ?? [],
        board_tip: peak.result.board_tip ?? null,
        wave_height: peak.hour.wave_height,
        wave_period: peak.hour.wave_period,
        wind_speed: peak.hour.wind_speed,
        wind_direction_deg: peak.hour.wind_direction_deg,
        tide_height: peak.hour.tide_height,
      },
    });

    runStart = i;
  }

  return windows;
}
