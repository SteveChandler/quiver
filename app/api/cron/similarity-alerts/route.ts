// app/api/cron/similarity-alerts/route.ts
//
// Phase 2 similarity-alerts cron — runs hourly.
//
// Scans every enabled alert_rules row with preset_type = 'similarity_match',
// calls compute_user_match_score against the next 72h of enhanced_forecasts
// for each rule's beach, and enqueues an alert_queue row when a forecast slot
// scores >= 7. Frequency caps: one alert per (user, beach) per 48h and a
// maximum of three queued alerts per user per 24h.
//
// Schema note: alert_queue has no `alert_type`/`payload` column (see
// supabase/migrations/20260408163000_add_condition_alerts.sql). We stamp the
// similarity payload inside `conditions_snapshot` jsonb so the delivery cron
// can distinguish similarity_match rows from regular condition alerts via
// conditions_snapshot.alert_type.
//
// Defensive paid API batching note: at scale (~100 rules × 72 hourly slots =
// ~7.2k RPC invocations/run) this cron dominates RPC traffic. For v1 we accept
// the cost since rules are bounded to the paid-tier cohort. Optimization
// targets if rule count grows:
//   - server-side batch RPC that scores all slots for a (user, beach) in one
//     round-trip
//   - early-break once we find the first slot >= threshold rather than scanning
//     all 72 hours (we currently keep scanning to report the peak)

import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[similarity-alerts]";
const SCORE_THRESHOLD = 7;
const PER_BEACH_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const DAILY_CAP = 3;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOOKAHEAD_HOURS = 72;

interface MatchScoreResult {
  state?: string;
  score?: number;
  label?: string;
  reason_bullets?: unknown;
  board_tip?: string | null;
  confidence?: number;
  sessions_in_profile?: number;
}

async function _GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();
  let enqueued = 0;
  let evaluated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // 1. Load all enabled similarity_match rules.
    const { data: rules, error: rulesErr } = await (supabase as any)
      .from("alert_rules")
      .select("id, user_id, beach_id, preset_type")
      .eq("preset_type", "similarity_match")
      .eq("enabled", true);

    if (rulesErr) {
      console.error(`${CONTEXT_TAG} failed to load rules`, rulesErr);
      return NextResponse.json(
        { error: rulesErr.message, enqueued },
        { status: 500 },
      );
    }

    for (const rule of (rules ?? []) as Array<{
      id: string;
      user_id: string;
      beach_id: string;
    }>) {
      evaluated++;
      try {
        // 2. Frequency cap: skip if this (user, beach) already has a
        // similarity alert queued in the last 48h.
        const cooldownSince = new Date(
          Date.now() - PER_BEACH_COOLDOWN_MS,
        ).toISOString();
        const { count: recent } = await (supabase as any)
          .from("alert_queue")
          .select("id", { count: "exact", head: true })
          .eq("user_id", rule.user_id)
          .eq("beach_id", rule.beach_id)
          .eq("rule_id", rule.id)
          .gte("created_at", cooldownSince);
        if ((recent ?? 0) > 0) {
          skipped++;
          continue;
        }

        // 3. Daily cap: skip if this user already has >=3 queued alerts in
        // the last 24h across all rules.
        const dailySince = new Date(
          Date.now() - DAILY_WINDOW_MS,
        ).toISOString();
        const { count: daily } = await (supabase as any)
          .from("alert_queue")
          .select("id", { count: "exact", head: true })
          .eq("user_id", rule.user_id)
          .gte("created_at", dailySince);
        if ((daily ?? 0) >= DAILY_CAP) {
          skipped++;
          continue;
        }

        // 4. Load next 72h of forecasts for this beach.
        const now = new Date();
        const horizon = new Date(
          now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000,
        );
        const { data: forecasts, error: forecastsErr } = await (supabase as any)
          .from("enhanced_forecasts")
          .select(
            "forecast_at, wave_height, wave_period, wind_speed, wind_direction_deg, tide_height",
          )
          .eq("beach_id", rule.beach_id)
          .gte("forecast_at", now.toISOString())
          .lte("forecast_at", horizon.toISOString())
          .order("forecast_at", { ascending: true });
        if (forecastsErr) {
          console.warn(
            `${CONTEXT_TAG} forecasts load failed for rule ${rule.id}`,
            forecastsErr.message,
          );
          errors++;
          continue;
        }
        if (!forecasts || forecasts.length === 0) continue;

        // 5. Score each slot; track the peak score >= threshold.
        let peak: {
          score: number;
          forecast_at: string;
          label: string | null;
        } | null = null;

        for (const f of forecasts as Array<{
          forecast_at: string;
          wave_height: string | null;
          wave_period: string | null;
          wind_speed: string | null;
          wind_direction_deg: number | null;
          tide_height: string | null;
        }>) {
          const wave = f.wave_height ? parseFloat(f.wave_height) : null;
          const period = f.wave_period
            ? parseFloat(String(f.wave_period).replace("s", ""))
            : null;
          if (wave == null || period == null) continue;

          const wind = f.wind_speed ? parseFloat(f.wind_speed) : null;
          const tide = f.tide_height ? parseFloat(f.tide_height) : null;

          // compute_user_match_score is the Phase 2 RPC shipped by Workstream
          // A. It may not be in types/database.generated.ts yet when this
          // lands; cast avoids the strict-typed rpc() overload rejection.
          const { data: rpcData, error: rpcErr } = await (
            supabase.rpc as unknown as (
              fn: string,
              args: Record<string, unknown>,
            ) => Promise<{ data: MatchScoreResult | null; error: unknown }>
          )("compute_user_match_score", {
            p_user_id: rule.user_id,
            p_beach_id: rule.beach_id,
            p_wave_height: wave,
            p_wave_period: period,
            p_wind_speed: wind,
            p_wind_direction: f.wind_direction_deg,
            p_tide_height: tide,
          });
          if (rpcErr) {
            console.warn(
              `${CONTEXT_TAG} RPC error rule=${rule.id} slot=${f.forecast_at}`,
              rpcErr,
            );
            continue;
          }
          const result = rpcData as MatchScoreResult | null;
          if (!result || result.state !== "ready") continue;
          if (typeof result.score !== "number") continue;
          if (result.score < SCORE_THRESHOLD) continue;
          if (!peak || result.score > peak.score) {
            peak = {
              score: result.score,
              forecast_at: f.forecast_at,
              label: result.label ?? null,
            };
          }
        }

        if (!peak) continue;

        // 6. Queue the alert. alert_queue has no alert_type/payload columns;
        // we stamp the similarity shape inside conditions_snapshot so the
        // delivery cron can dispatch the right copy.
        const alertDate = new Date(peak.forecast_at).toISOString().slice(0, 10);
        const { error: insertErr } = await (supabase as any)
          .from("alert_queue")
          .insert({
            user_id: rule.user_id,
            rule_id: rule.id,
            beach_id: rule.beach_id,
            alert_date: alertDate,
            send_at: new Date().toISOString(),
            window_start: peak.forecast_at,
            window_end: peak.forecast_at,
            best_hour: peak.forecast_at,
            conditions_snapshot: {
              alert_type: "similarity_match",
              score: peak.score,
              label: peak.label,
              forecast_at: peak.forecast_at,
              rule_id: rule.id,
            },
          });
        if (insertErr) {
          console.error(
            `${CONTEXT_TAG} enqueue failed rule=${rule.id}`,
            insertErr.message,
          );
          errors++;
          continue;
        }
        enqueued++;

        await (supabase as any)
          .from("alert_rules")
          .update({ last_matched_at: new Date().toISOString() })
          .eq("id", rule.id);
      } catch (ruleErr) {
        console.error(
          `${CONTEXT_TAG} error processing rule ${rule.id}`,
          ruleErr,
        );
        errors++;
      }
    }

    console.log(`${CONTEXT_TAG} summary`, {
      evaluated,
      enqueued,
      skipped,
      errors,
    });
    return NextResponse.json({ enqueued, evaluated, skipped, errors });
  } catch (err) {
    console.error(`${CONTEXT_TAG} fatal error`, err);
    return NextResponse.json(
      { error: "Internal error", enqueued, evaluated, skipped, errors },
      { status: 500 },
    );
  }
}

export const GET = withObservedCron("/api/cron/similarity-alerts", _GET);
