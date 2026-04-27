// app/api/cron/condition-alert-evaluate/route.ts
import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withCronObservability } from "@/lib/cron/observability";
import { findMatchingWindows } from "@/lib/alerts/window-finder";
import { filterToDaylight, getDaylightWindow } from "@/lib/alerts/sunrise";
import { CAPS, resolveEntitlement } from "@/lib/alerts/entitlements";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import { parseWindSpeedToKt } from "@/lib/alerts/forecast-parsers";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";
import type { Database } from "@/types/database.generated";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[condition-alert-evaluate]";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "home_beach_id" | "notif_forecast_alerts" | "notif_email_enabled" | "notif_push_enabled"
>;
type BeachRow = Pick<
  Database["public"]["Tables"]["beaches"]["Row"],
  | "id"
  | "name"
  | "slug"
  | "lat"
  | "lon"
  | "timezone"
  | "wind_offshore_deg"
  | "wind_offshore_tol_deg"
  | "aspect_deg"
  | "preferred_tide_ft_min"
  | "preferred_tide_ft_max"
  | "preferred_tide_direction"
  | "swell_window_center_deg"
  | "swell_window_halfwidth_deg"
>;
type EntitlementRow = Pick<
  Database["public"]["Tables"]["user_entitlements"]["Row"],
  "user_id" | "is_pro" | "is_trialing" | "billing_issue" | "expires_at"
>;

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();

  try {
    const summary = await withCronObservability(
      "/api/cron/condition-alert-evaluate",
      async () => {
        const result = { evaluated: 0, matched: 0, queued: 0, skipped: 0, errors: 0 };

        // 1. Fetch all enabled rules — flat select, no embeds.
        //    Previously this used profiles!inner(...) which requires PostgREST to
        //    resolve the two-hop FK alert_rules.user_id → auth.users.id ← profiles.id.
        //    That embed was throwing silently in prod (A2 diagnosis H1, ~60% confidence).
        const { data: rules, error: rulesError } = await supabase
          .from("alert_rules")
          .select("id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at")
          .eq("enabled", true);

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
            .select("id, home_beach_id, notif_forecast_alerts, notif_email_enabled, notif_push_enabled")
            .in("id", userIds),
          supabase
            .from("beaches")
            .select(
              "id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, swell_window_center_deg, swell_window_halfwidth_deg"
            )
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
            const homeBeachId = profile.home_beach_id;
            const homeBeach = homeBeachId ? beachesById.get(homeBeachId) : undefined;
            const homeBeachTz = homeBeach?.timezone ?? "America/New_York";
            const userLocalDate = new Date().toLocaleDateString("en-CA", { timeZone: homeBeachTz });

            // Check if already delivered today.
            const { data: existing } = await supabase
              .from("alert_deliveries")
              .select("id")
              .eq("user_id", userId)
              .eq("alert_date", userLocalDate)
              .limit(1);

            if (existing && existing.length > 0) {
              result.skipped += userRules.length;
              continue;
            }

            // Apply entitlement caps — skip newest rules first.
            const entitlementRow = entitlementByUserId.get(userId) ?? null;
            const tier = resolveEntitlement(userId, entitlementRow);
            const caps = CAPS[tier];
            const sortedRules = [...userRules].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const activeRules = sortedRules.slice(0, caps.totalRules);

            for (const rule of activeRules) {
              result.evaluated++;
              const beach = beachesById.get(rule.beach_id) as BeachAlertMeta;
              const conditions = rule.conditions as AlertConditions;

              const { start: todayStart, end: todayEnd } = getUtcDayBounds(userLocalDate, beach.timezone);

              const { data: forecasts } = await supabase
                .from("enhanced_forecasts")
                .select(
                  "forecast_at, wave_height, wave_period, swell_1_height, swell_1_period, swell_1_direction, wind_speed, wind_direction_deg, tide_height, tide_status"
                )
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
                wind_speed: parseWindSpeedToKt(f.wind_speed),
                wind_direction_deg: f.wind_direction_deg,
                tide_height: f.tide_height ? parseFloat(f.tide_height) : null,
                tide_status: f.tide_status,
              }));

              const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
              if (daylight.length === 0) continue;

              const windows = findMatchingWindows(conditions, daylight, beach);
              if (windows.length === 0) continue;

              result.matched++;

              const { sunrise } = getDaylightWindow(beach.lat, beach.lon, new Date(todayStart));

              for (const window of windows) {
                const sendAtDate = new Date(new Date(window.window_start).getTime() - 2 * 60 * 60 * 1000);
                const clampedSendAt = sendAtDate < sunrise ? sunrise : sendAtDate;
                const sendAt = clampedSendAt < new Date() ? new Date() : clampedSendAt;

                const { error: insertError } = await supabase
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
                      // conditions_snapshot is Record<string,unknown> from MatchingWindow
                      // but the DB column is typed as Json — structurally compatible.
                      conditions_snapshot: window.conditions_snapshot as import("@/types/database.generated").Json,
                    },
                    { onConflict: "rule_id,alert_date,window_start", ignoreDuplicates: true }
                  );

                if (insertError) {
                  console.error(`${CONTEXT_TAG} Failed to queue alert:`, insertError);
                  result.errors++;
                } else {
                  result.queued++;
                }
              }

              await supabase
                .from("alert_rules")
                .update({ last_matched_at: new Date().toISOString() })
                .eq("id", rule.id);
            }
          } catch (err) {
            console.error(`${CONTEXT_TAG} Error evaluating user ${userId}:`, err);
            result.errors++;
          }
        }

        console.log(`${CONTEXT_TAG} Summary:`, result);
        return result;
      }
    );
    return NextResponse.json(summary);
  } catch (err) {
    console.error(`${CONTEXT_TAG} Fatal error:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
