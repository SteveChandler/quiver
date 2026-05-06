// app/api/cron/condition-alert-evaluate/route.ts
import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withCronObservability } from "@/lib/cron/observability";
import { findMatchingWindows } from "@/lib/alerts/window-finder";
import { filterToDaylight, getDaylightWindow } from "@/lib/alerts/sunrise";
import { CAPS, resolveEntitlement } from "@/lib/alerts/entitlements";
import { getUtcDayBounds } from "@/lib/alerts/timezone-utils";
import { parseWindSpeedToKt, parseSwellDirectionToDegrees } from "@/lib/alerts/forecast-parsers";
import type { AlertConditions, BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";
import type { Database } from "@/types/database.generated";
import { selectBestWindow } from "@/lib/services/discovery";
import { computeSurfCall, getMinRideable, MINIMUM_VIABLE_WINDOW_MINUTES } from "@/lib/utils/surf-call-logic";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SupabaseClient } from "@supabase/supabase-js";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[condition-alert-evaluate]";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "home_beach_id" | "notif_forecast_alerts" | "notif_email_enabled" | "notif_push_enabled"
>;
type BeachRow = Beach;
type EntitlementRow = Pick<
  Database["public"]["Tables"]["user_entitlements"]["Row"],
  "user_id" | "is_pro" | "is_trialing" | "billing_issue" | "expires_at"
>;

interface QueuedSurfWindow {
  window_start: string;
  window_end: string;
  best_hour: string;
  conditions_snapshot: Record<string, unknown>;
}

function buildConditionsSnapshot(forecast: EnhancedForecastEntity | null): Record<string, unknown> {
  if (!forecast) return {};

  return {
    wave_height: forecast.wave_height ? parseFloat(forecast.wave_height) : null,
    wave_period: forecast.wave_period ? parseFloat(forecast.wave_period.replace("s", "")) : null,
    wave_direction: forecast.wave_direction ?? null,
    swell_1_period: forecast.swell_1_period ? parseFloat(forecast.swell_1_period.replace("s", "")) : null,
    swell_1_direction: parseSwellDirectionToDegrees(forecast.swell_1_direction ?? null),
    wind_speed: parseWindSpeedToKt(forecast.wind_speed ?? null),
    wind_direction_deg: forecast.wind_direction_deg ?? null,
    tide_height: forecast.tide_height ? parseFloat(forecast.tide_height) : null,
    tide_status: forecast.tide_status ?? null,
  };
}

function pickForecastClosestTo(
  forecasts: EnhancedForecastEntity[],
  targetISO: string | null
): EnhancedForecastEntity | null {
  if (forecasts.length === 0) return null;
  if (!targetISO) return forecasts[0];

  const targetMs = new Date(targetISO).getTime();
  if (!Number.isFinite(targetMs)) return forecasts[0];

  return forecasts.reduce((closest, forecast) => {
    const closestDelta = Math.abs(new Date(closest.forecast_at).getTime() - targetMs);
    const forecastDelta = Math.abs(new Date(forecast.forecast_at).getTime() - targetMs);
    return forecastDelta < closestDelta ? forecast : closest;
  }, forecasts[0]);
}

async function resolveSurfCallWindow(
  supabase: SupabaseClient<Database>,
  beach: Beach,
  forecasts: EnhancedForecastEntity[],
  localDate: string
): Promise<QueuedSurfWindow | null> {
  const sunTimesCache = await getSunTimesCache(supabase, beach.id, localDate);
  const selectedWindow = selectBestWindow({
    forecasts,
    beach,
    userPrefs: null,
    horizonHours: 24,
    sunTimesCache,
  });
  const surfCall = computeSurfCall(selectedWindow, forecasts, beach);

  if (!surfCall.bestWindowStart || !surfCall.bestWindowEnd) return null;

  const bestHour = surfCall.peakTime ?? surfCall.bestWindowStart;
  const snapshotForecast = pickForecastClosestTo(forecasts, bestHour);

  return {
    window_start: surfCall.bestWindowStart,
    window_end: surfCall.bestWindowEnd,
    best_hour: bestHour,
    conditions_snapshot: buildConditionsSnapshot(snapshotForecast),
  };
}

async function getSunTimesCache(
  supabase: SupabaseClient<Database>,
  beachId: string,
  localDate: string
): Promise<Map<string, { sunrises: Date[]; sunsets: Date[] }>> {
  const { data, error } = await supabase
    .from("sun_times")
    .select("beach_id, sunrise_utc, sunset_utc")
    .eq("beach_id", beachId)
    .eq("date", localDate)
    .order("sunrise_utc", { ascending: true });

  if (error || !data) return new Map();

  const sunrises: Date[] = [];
  const sunsets: Date[] = [];
  for (const row of data) {
    if (row.sunrise_utc) sunrises.push(new Date(row.sunrise_utc));
    if (row.sunset_utc) sunsets.push(new Date(row.sunset_utc));
  }

  return new Map([[beachId, { sunrises, sunsets }]]);
}

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();

  try {
    const summary = await withCronObservability(
      "/api/cron/condition-alert-evaluate",
      async () => {
        const result = { evaluated: 0, matched: 0, queued: 0, skipped: 0, skipped_unsurfable: 0, errors: 0 };

        // 1. Fetch all enabled rules — flat select, no embeds.
        //    Previously this used profiles!inner(...) which requires PostgREST to
        //    resolve the two-hop FK alert_rules.user_id → auth.users.id ← profiles.id.
        //    That embed was throwing silently in prod (A2 diagnosis H1, ~60% confidence).
        const { data: rules, error: rulesError } = await supabase
          .from("alert_rules")
          .select("id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at")
          .eq("enabled", true)
          .neq("preset_type", "similarity_match");

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
            const homeBeachId = profile.home_beach_id;
            const homeBeach = homeBeachId ? beachesById.get(homeBeachId) : undefined;
            const homeBeachTz = homeBeach?.timezone ?? "America/New_York";
            const userLocalDate = new Date().toLocaleDateString("en-CA", { timeZone: homeBeachTz });
            const surfCallWindowByBeachId = new Map<string, QueuedSurfWindow | null>();

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
                .select("*")
                .eq("beach_id", rule.beach_id)
                .gte("forecast_at", todayStart)
                .lt("forecast_at", todayEnd)
                .order("forecast_at", { ascending: true });

              if (!forecasts || forecasts.length === 0) continue;

              const parsed: ForecastHour[] = forecasts.map((f) => ({
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

              if (!surfCallWindowByBeachId.has(rule.beach_id)) {
                const surfCallWindow = await resolveSurfCallWindow(
                  supabase,
                  beachRow as Beach,
                  forecasts as EnhancedForecastEntity[],
                  userLocalDate
                );
                surfCallWindowByBeachId.set(rule.beach_id, surfCallWindow);
              }

              const surfCallWindow = surfCallWindowByBeachId.get(rule.beach_id);
              if (!surfCallWindow) {
                result.skipped_unsurfable++;
                continue;
              }

              result.matched++;

              const { sunrise } = getDaylightWindow(beach.lat, beach.lon, new Date(todayStart));

              for (const window of [surfCallWindow]) {
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
