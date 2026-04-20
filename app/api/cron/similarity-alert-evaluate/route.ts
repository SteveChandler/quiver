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
import { CAPS, resolveEntitlement } from "@/lib/alerts/entitlements";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import { resolveSimilarityThreshold } from "@/lib/alerts/presets";
import { consolidateMatchedHours } from "@/lib/alerts/consolidate";
import type { BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[similarity-alert-evaluate]";

// Deployment contract — read before changing entitlement wiring.
//
// This cron's matching path is blocked upstream: canCreateRule in
// lib/alerts/entitlements.ts rejects similarity_alert for the free tier, and
// getUserEntitlement is currently a stub that returns "free" unless the env
// var ALERT_PREVIEW_MODE === "true". Until a real entitlement source (the
// user_entitlements Supabase mirror backed by RevenueCat, specced in
// quiver-native/docs/superpowers/specs/2026-04-16-subscription-paywall-design.md)
// lands and getUserEntitlement reads from it, no similarity_alert rule can be
// created in a non-preview prod, so this cron is a no-op.
//
// To test in prod ahead of the paywall: set ALERT_PREVIEW_MODE=true in the
// Vercel cron runtime environment. Do NOT ship that to end-user runtimes —
// every alert preset becomes "premium" for every user and the free-tier gate
// collapses across the entire alerts system.

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
        profiles!inner(id, home_beach_id, notif_forecast_alerts, notif_email_enabled, notif_push_enabled),
        user_entitlements(is_pro, is_trialing, billing_issue, expires_at)
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

        // Entitlement cap — reads from the user_entitlements row joined into
        // the rules select above, avoiding an N+1 query per user.
        // resolveEntitlement honors ALERT_PREVIEW_MODE + ALERT_BETA_USER_IDS
        // env bypasses too, matching getUserEntitlement semantics exactly.
        const entitlementRow = userRules[0].user_entitlements ?? null;
        const tier = resolveEntitlement(userId, entitlementRow);
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
          const threshold = resolveSimilarityThreshold(conditions);

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
          //
          // Service-role auth note: compute_spot_similarity_score has an
          // `IF p_user_id <> auth.uid() THEN RAISE` guard. Under the
          // service-role client used here, auth.uid() returns NULL — and
          // `<uuid> <> NULL` evaluates to NULL (not TRUE), so the guard does
          // not raise. We rely on this implicit bypass to impersonate each
          // user at cron time. If the RPC's guard is ever tightened to
          // `IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid()`, the
          // cron path here MUST be updated too.
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

