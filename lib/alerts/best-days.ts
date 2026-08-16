// lib/alerts/best-days.ts
//
// Computes the top N upcoming similarity-match forecast slots for a user
// across the beaches they're subscribed to (via alert_rules). Used by the
// weekly-recap-email cron to render the Phase 2 "Best days this week"
// section on the digest.
//
// Separate from app/api/cron/similarity-alerts/route.ts because the weekly
// digest uses a looser threshold (>= 6 vs >= 7) and a longer window (7 days
// vs 72 hours), and we don't want to couple those knobs.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BestDaySlot } from "@/lib/mailer/templates/WeeklyRecapEmail";
import { isLearnedMatchState } from "@/lib/personalization/match-state-compat";
import {
  DAYLIGHT_END_HOUR,
  DAYLIGHT_START_HOUR,
} from "@/lib/services/magic-hour/constants";
import { getLocalHour } from "@/lib/utils/timezone-utils";

const DIGEST_SCORE_THRESHOLD = 6;
const DIGEST_LOOKAHEAD_DAYS = 7;
const DIGEST_MAX_SLOTS = 5;

interface MatchScoreResult {
  state?: string;
  score?: number;
  label?: string;
}

interface BeachMeta {
  id: string;
  name: string;
  timezone: string | null;
}

interface ForecastRow {
  forecast_at: string;
  wave_height: string | null;
  wave_period: string | null;
  wind_speed: string | null;
  wind_direction_deg: number | null;
  tide_height: string | null;
}

/**
 * Gather the top upcoming similarity-match slots for a user's subscribed
 * beaches over the next 7 days. Returns slots sorted by score desc, capped
 * at 5, and filtered to score >= 6. Empty array when the user has no
 * subscribed beaches, no qualifying forecasts, or the match-score RPC
 * indicates the user is still in the onboarding (<5 rated sessions) state.
 */
export async function computeBestDaysForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<BestDaySlot[]> {
  // 1. Subscribed beaches = every beach_id with an enabled rule for this user.
  // Using alert_rules (not user_favorite_beaches) mirrors the Phase 2
  // similarity-alerts cron's notion of "subscribed".
  const { data: rules } = await (supabase as any)
    .from("alert_rules")
    .select("beach_id, beaches!inner(id, name, timezone)")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (!rules || rules.length === 0) return [];

  const beachesById = new Map<string, BeachMeta>();
  for (const row of rules as Array<{
    beach_id: string;
    beaches: BeachMeta | BeachMeta[] | null;
  }>) {
    const beach = Array.isArray(row.beaches) ? row.beaches[0] : row.beaches;
    if (beach?.id) beachesById.set(row.beach_id, beach);
  }
  if (beachesById.size === 0) return [];

  const now = new Date();
  const horizon = new Date(
    now.getTime() + DIGEST_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
  );

  const slots: BestDaySlot[] = [];

  for (const beach of beachesById.values()) {
    const beachId = beach.id;
    const tz = beach.timezone ?? "America/Los_Angeles";
    const { data: forecasts } = await (supabase as any)
      .from("enhanced_forecasts")
      .select(
        "forecast_at, wave_height, wave_period, wind_speed, wind_direction_deg, tide_height",
      )
      .eq("beach_id", beachId)
      .gte("forecast_at", now.toISOString())
      .lte("forecast_at", horizon.toISOString())
      .order("forecast_at", { ascending: true });

    if (!forecasts || forecasts.length === 0) continue;

    for (const f of forecasts as ForecastRow[]) {
      const localHour = getLocalHour(new Date(f.forecast_at), tz);
      if (
        localHour < DAYLIGHT_START_HOUR ||
        localHour >= DAYLIGHT_END_HOUR
      ) {
        continue;
      }

      const wave = f.wave_height ? parseFloat(f.wave_height) : null;
      const period = f.wave_period
        ? parseFloat(String(f.wave_period).replace("s", ""))
        : null;
      if (wave == null || period == null) continue;

      const wind = f.wind_speed ? parseFloat(f.wind_speed) : null;
      const tide = f.tide_height ? parseFloat(f.tide_height) : null;

      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "compute_user_match_score",
        {
          p_user_id: userId,
          p_beach_id: beachId,
          p_wave_height: String(wave),
          p_wave_period: String(period),
          p_wind_speed: wind == null ? "" : String(wind),
          p_wind_direction:
            f.wind_direction_deg == null ? "" : String(f.wind_direction_deg),
          p_tide_height: tide == null ? "" : String(tide),
        },
      );
      if (rpcErr) continue;
      const result = rpcData as MatchScoreResult | null;
      if (!result || !isLearnedMatchState(result.state)) continue;
      if (typeof result.score !== "number") continue;
      if (result.score < DIGEST_SCORE_THRESHOLD) continue;

      const d = new Date(f.forecast_at);
      const weekday = d.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: tz,
      });
      const time = d
        .toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz })
        .replace(/\s?(AM|PM)/i, (_, ampm) => ampm.toLowerCase());

      slots.push({
        beach_name: beach.name,
        score: result.score,
        label: result.label ?? "",
        weekday,
        time,
      });
    }
  }

  slots.sort((a, b) => b.score - a.score);
  return slots.slice(0, DIGEST_MAX_SLOTS);
}
