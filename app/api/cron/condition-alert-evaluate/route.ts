// app/api/cron/condition-alert-evaluate/route.ts
import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { findMatchingWindows } from "@/lib/alerts/window-finder";
import { filterToDaylight, getDaylightWindow } from "@/lib/alerts/sunrise";
import { getUserEntitlement, CAPS } from "@/lib/alerts/entitlements";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[condition-alert-evaluate]";

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();
  const summary = { evaluated: 0, matched: 0, queued: 0, skipped: 0, errors: 0 };

  try {
    // 1. Fetch all enabled rules with user + beach data
    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select(`
        id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at,
        beaches!inner(id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg,
          preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction,
          swell_window_center_deg, swell_window_halfwidth_deg),
        profiles!inner(id, home_beach_id, notif_forecast_alerts, notif_email_enabled, notif_push_enabled)
      `)
      .eq("enabled", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      console.log(`${CONTEXT_TAG} No enabled alert rules found`);
      return NextResponse.json({ ...summary, message: "No rules to evaluate" });
    }

    // 2. Group rules by user
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

    // 3. Evaluate each user's rules
    for (const [userId, userRules] of byUser) {
      try {
        const homeBeachId = userRules[0].profiles?.home_beach_id;
        const homeBeachTz = userRules.find((r) => r.beach_id === homeBeachId)?.beaches?.timezone ?? "America/New_York";
        const userLocalDate = new Date().toLocaleDateString("en-CA", { timeZone: homeBeachTz });

        // Check if already delivered today
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

        // Apply entitlement caps — skip newest rules first
        const tier = getUserEntitlement(userId);
        const caps = CAPS[tier];
        const sortedRules = [...userRules].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const activeRules = sortedRules.slice(0, caps.totalRules);

        for (const rule of activeRules) {
          summary.evaluated++;
          const beach = rule.beaches as unknown as BeachAlertMeta;
          const conditions = rule.conditions as AlertConditions;

          const { start: todayStart, end: todayEnd } = getUtcDayBounds(userLocalDate, beach.timezone);

          const { data: forecasts } = await supabase
            .from("enhanced_forecasts")
            .select("forecast_at, wave_height, wave_period, swell_1_height, swell_1_period, swell_1_direction, wind_speed, wind_direction_deg, tide_height, tide_status")
            .eq("beach_id", rule.beach_id)
            .gte("forecast_at", todayStart)
            .lt("forecast_at", todayEnd)
            .order("forecast_at", { ascending: true });

          if (!forecasts || forecasts.length === 0) continue;

          const parsed: ForecastHour[] = forecasts.map((f) => ({
            forecast_at: f.forecast_at,
            wave_height: f.wave_height ? parseFloat(f.wave_height) : null,
            wave_period: f.wave_period ? parseFloat(f.wave_period.replace("s", "")) : null,
            swell_1_height: f.swell_1_height ? parseFloat(f.swell_1_height) : null,
            swell_1_period: f.swell_1_period ? parseFloat(f.swell_1_period.replace("s", "")) : null,
            swell_1_direction: f.swell_1_direction ? parseFloat(String(f.swell_1_direction)) : null,
            wind_speed: f.wind_speed ? parseFloat(f.wind_speed) : null,
            wind_direction_deg: f.wind_direction_deg,
            tide_height: f.tide_height ? parseFloat(f.tide_height) : null,
            tide_status: f.tide_status,
          }));

          const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
          if (daylight.length === 0) continue;

          const windows = findMatchingWindows(conditions, daylight, beach);
          if (windows.length === 0) continue;

          summary.matched++;

          const { sunrise } = getDaylightWindow(beach.lat, beach.lon, new Date(todayStart));

          for (const window of windows) {
            const sendAtDate = new Date(new Date(window.window_start).getTime() - 2 * 60 * 60 * 1000);
            const clampedSendAt = sendAtDate < sunrise ? sunrise : sendAtDate;
            const sendAt = clampedSendAt < new Date() ? new Date() : clampedSendAt;

            const { error: insertError } = await (supabase as any)
              .from("alert_queue")
              .upsert(
                {
                  user_id: userId,
                  rule_id: rule.id,
                  beach_id: rule.beach_id,
                  alert_date: userLocalDate,
                  send_at: sendAt.toISOString(),
                  window_start: window.window_start,
                  window_end: window.window_end,
                  best_hour: window.best_hour,
                  conditions_snapshot: window.conditions_snapshot,
                },
                { onConflict: "rule_id,alert_date,window_start", ignoreDuplicates: true }
              );

            if (insertError) {
              console.error(`${CONTEXT_TAG} Failed to queue alert:`, insertError);
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
        console.error(`${CONTEXT_TAG} Error evaluating user ${userId}:`, err);
        summary.errors++;
      }
    }

    console.log(`${CONTEXT_TAG} Summary:`, summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error(`${CONTEXT_TAG} Fatal error:`, err);
    return NextResponse.json({ error: "Internal error", summary }, { status: 500 });
  }
}
