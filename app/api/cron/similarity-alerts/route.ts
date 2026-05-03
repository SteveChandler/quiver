// app/api/cron/similarity-alerts/route.ts
//
// Plan V4 similarity-alerts cron — runs hourly.
//
// Iterates DISTINCT eligible USERS (not rules). For each user:
//  1. Builds a candidate beach pool: home_beach + favorites + nearby ≤ 25mi.
//  2. Drops candidates with active water-quality closures.
//  3. Fetches the next 24h of enhanced_forecasts per candidate, filters to
//     daylight hours, then bulk-scores via compute_user_match_score_batch
//     (one RPC per beach, not per slot — collapses N×72 to N round-trips).
//  4. Picks the highest-scoring ready slot ≥ 7.0 across all candidates,
//     tie-break by earliest forecast_at, rejects 22:00-06:00 user-local picks.
//  5. Inserts via try_insert_similarity_alert RPC. inserted=false on dedup
//     hit (partial unique index alert_queue_one_similarity_per_user_day) is
//     treated as success.
//
// Anchor rule selection (one user can have ≥1 similarity_match rule):
//   prefer auto_created_at IS NOT NULL, then MIN(id) for deterministic
//   tie-break. The anchor's id is stamped as the foreign key on alert_queue
//   and gets last_matched_at bumped on success.
//
// Kill switch (mirrors condition-alert-deliver):
//   - ALERTS_DELIVERY_ENABLED — must equal "true" or the cron returns
//     { skipped: true, reason: "delivery_disabled" } without touching the DB
//     (beyond the cron_runs row owned by withObservedCron).
//   - ALERTS_DELIVERY_USER_ALLOWLIST — optional comma-separated user_ids.
//     When non-empty, users not on the list are counted as skipped.
//
// Schema notes: alert_queue has no alert_type/payload column. The similarity
// shape lives inside conditions_snapshot.alert_type — try_insert_similarity_alert
// RAISES if conditions_snapshot.alert_type ≠ 'similarity_match', and the
// partial unique index is keyed on (user_id, alert_date) WHERE that flag
// matches.

import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import {
  pickBestSimilaritySlot,
  type ScoredSlot,
} from "@/lib/alerts/similarity-best-pick";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[similarity-alerts]";
const SCORE_THRESHOLD = 7;
const SURFABILITY_FLOOR = 0; // candidate pre-filter; picker handles its own threshold
const LOOKAHEAD_HOURS = 24;
const NEARBY_RADIUS_MILES = 25;
const NEARBY_LIMIT = 10;
const FAVORITE_LIMIT = 5;
const REJECT_START_HOUR_LOCAL = 22; // 10pm
const REJECT_END_HOUR_LOCAL = 6; // 6am
const DAYLIGHT_START_HOUR = 6;
const DAYLIGHT_END_HOUR = 21;

interface EligibleUserRow {
  user_id: string;
  anchor_rule_id: string;
  home_beach_id: string;
  timezone: string | null;
}

interface BeachRow {
  id: string;
  name: string;
  slug: string | null;
  center_lat: number | null;
  center_lng: number | null;
  timezone: string | null;
}

interface ForecastSlot {
  forecast_at: string;
  wave_height: string | null;
  wave_period: string | null;
  wind_speed: string | null;
  wind_direction_deg: number | null;
  tide_height: string | null;
}

interface BatchSlotResult {
  slot_idx: number;
  forecast_at: string;
  result: {
    state?: string;
    score?: number;
    label?: string | null;
    reason_bullets?: unknown;
    confidence?: number;
  } | null;
}

function localHourInTz(iso: string, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const h = parseInt(fmt.format(new Date(iso)), 10);
    return h === 24 ? 0 : h;
  } catch {
    return new Date(iso).getUTCHours();
  }
}

function localDateInTz(iso: string, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !d) throw new Error("bad date parts");
    return `${y}-${m}-${d}`;
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

function firstReasonBullet(bullets: unknown): string | null {
  if (Array.isArray(bullets)) {
    for (const b of bullets) {
      if (typeof b === "string" && b.length > 0) return b;
    }
  }
  return null;
}

async function _GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const vercelHeader = req.headers.get("x-vercel-cron");
  const isAuthorized =
    !!vercelHeader || auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deliveryEnabled = process.env.ALERTS_DELIVERY_ENABLED === "true";
  const allowlistRaw = process.env.ALERTS_DELIVERY_USER_ALLOWLIST ?? "";
  const allowlist = new Set(
    allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (!deliveryEnabled) {
    console.log(`${CONTEXT_TAG} skipped: ALERTS_DELIVERY_ENABLED=false`);
    return NextResponse.json({
      skipped: true,
      reason: "delivery_disabled",
      enqueued: 0,
      evaluated: 0,
    });
  }

  const supabase = await createSupabaseServiceRoleClient();
  let evaluated = 0;
  let enqueued = 0;
  let dedupSkipped = 0;
  let allowlistSkipped = 0;
  let noPickSkipped = 0;
  let errors = 0;

  try {
    const eligibleUsers = await loadEligibleUsers(supabase);

    for (const user of eligibleUsers) {
      evaluated++;
      try {
        if (allowlist.size > 0 && !allowlist.has(user.user_id)) {
          allowlistSkipped++;
          continue;
        }

        const candidates = await buildCandidateBeaches(supabase, user);
        if (candidates.length === 0) {
          noPickSkipped++;
          continue;
        }

        const filtered = await filterByWaterQuality(supabase, candidates);
        if (filtered.length === 0) {
          noPickSkipped++;
          continue;
        }

        const scored = await scoreCandidates(supabase, user.user_id, filtered);
        if (scored.length === 0) {
          noPickSkipped++;
          continue;
        }

        const pick = pickBestSimilaritySlot({
          scoredSlots: scored,
          scoreThreshold: SCORE_THRESHOLD,
          rejectStartHourLocal: REJECT_START_HOUR_LOCAL,
          rejectEndHourLocal: REJECT_END_HOUR_LOCAL,
        });

        if (!pick) {
          noPickSkipped++;
          continue;
        }

        const inserted = await tryInsertAlert(supabase, user, pick);
        if (inserted === "inserted") {
          enqueued++;
          await bumpLastMatchedAt(supabase, user.anchor_rule_id);
        } else if (inserted === "dedup") {
          dedupSkipped++;
        } else {
          errors++;
        }
      } catch (userErr) {
        console.error(
          `${CONTEXT_TAG} error processing user ${user.user_id}`,
          userErr,
        );
        errors++;
      }
    }

    console.log(`${CONTEXT_TAG} summary`, {
      evaluated,
      enqueued,
      dedupSkipped,
      allowlistSkipped,
      noPickSkipped,
      errors,
    });
    return NextResponse.json({
      evaluated,
      enqueued,
      dedupSkipped,
      allowlistSkipped,
      noPickSkipped,
      errors,
    });
  } catch (err) {
    console.error(`${CONTEXT_TAG} fatal error`, err);
    return NextResponse.json(
      {
        error: "Internal error",
        evaluated,
        enqueued,
        dedupSkipped,
        allowlistSkipped,
        noPickSkipped,
        errors,
      },
      { status: 500 },
    );
  }
}

/**
 * Loads eligible users + their anchor similarity_match rule. Done in two
 * round-trips (Supabase JS client doesn't expose CTEs):
 *  1. Fetch all enabled similarity_match rules joined to user_entitlements
 *     and profiles. We do entitlement filtering in JS to mirror
 *     entitlementFromRow exactly (billing_issue carve-out + expires_at
 *     staleness guard).
 *  2. Group by user_id and pick the anchor: prefer auto_created_at NOT NULL,
 *     then MIN(id).
 */
async function loadEligibleUsers(
  supabase: any,
): Promise<EligibleUserRow[]> {
  const { data, error } = await supabase
    .from("alert_rules")
    .select(
      `
      id,
      user_id,
      auto_created_at,
      profiles!inner(
        id,
        home_beach_id,
        timezone,
        user_entitlements(
          is_pro,
          is_trialing,
          billing_issue,
          expires_at
        )
      )
      `,
    )
    .eq("preset_type", "similarity_match")
    .eq("enabled", true);

  if (error) {
    console.error(`${CONTEXT_TAG} failed to load eligible users`, error);
    throw error;
  }

  const now = Date.now();
  const groups = new Map<
    string,
    Array<{
      id: string;
      user_id: string;
      auto_created_at: string | null;
      home_beach_id: string;
      timezone: string | null;
    }>
  >();

  for (const row of (data ?? []) as Array<{
    id: string;
    user_id: string;
    auto_created_at: string | null;
    profiles: {
      id: string;
      home_beach_id: string | null;
      timezone: string | null;
      user_entitlements:
        | { is_pro: boolean | null; is_trialing: boolean | null; billing_issue: boolean | null; expires_at: string | null }[]
        | { is_pro: boolean | null; is_trialing: boolean | null; billing_issue: boolean | null; expires_at: string | null }
        | null;
    };
  }>) {
    const profile = row.profiles;
    if (!profile) continue;
    if (!profile.home_beach_id) continue;

    const ent = Array.isArray(profile.user_entitlements)
      ? profile.user_entitlements[0]
      : profile.user_entitlements;
    if (!ent) continue;
    if (!ent.is_pro && !ent.is_trialing) continue;
    if (
      ent.expires_at &&
      !ent.billing_issue &&
      new Date(ent.expires_at).getTime() < now
    ) {
      continue;
    }

    const list = groups.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      user_id: row.user_id,
      auto_created_at: row.auto_created_at,
      home_beach_id: profile.home_beach_id,
      timezone: profile.timezone,
    });
    groups.set(row.user_id, list);
  }

  const eligibleUsers: EligibleUserRow[] = [];
  for (const [userId, rules] of groups) {
    rules.sort((a, b) => {
      // Prefer auto_created_at NOT NULL (system-seeded). When tied (both NULL
      // or both NOT NULL), sort by id ASC for deterministic anchor selection.
      const aAuto = a.auto_created_at ? 1 : 0;
      const bAuto = b.auto_created_at ? 1 : 0;
      if (aAuto !== bAuto) return bAuto - aAuto;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const anchor = rules[0];
    eligibleUsers.push({
      user_id: userId,
      anchor_rule_id: anchor.id,
      home_beach_id: anchor.home_beach_id,
      timezone: anchor.timezone,
    });
  }

  return eligibleUsers;
}

/**
 * Builds candidate pool: home_beach (required) + favorites (≤5) + nearby (≤10).
 * Deduplicates by id. Returns hydrated beach rows.
 */
async function buildCandidateBeaches(
  supabase: any,
  user: EligibleUserRow,
): Promise<BeachRow[]> {
  const ids = new Set<string>([user.home_beach_id]);

  const { data: favs } = await supabase
    .from("favorite_beaches")
    .select("beach_id")
    .eq("user_id", user.user_id)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(FAVORITE_LIMIT);
  for (const r of (favs ?? []) as Array<{ beach_id: string }>) {
    if (r.beach_id) ids.add(r.beach_id);
  }

  // Nearby: need home beach coords first.
  const { data: home } = await supabase
    .from("beaches")
    .select("id, center_lat, center_lng")
    .eq("id", user.home_beach_id)
    .maybeSingle();

  const homeRow = home as
    | { id: string; center_lat: number | null; center_lng: number | null }
    | null;

  if (homeRow?.center_lat != null && homeRow?.center_lng != null) {
    const meters = Math.round(NEARBY_RADIUS_MILES * 1609.34);
    const { data: nearby } = await supabase.rpc("get_nearby_beaches", {
      input_lat: homeRow.center_lat,
      input_lng: homeRow.center_lng,
      max_distance_meters: meters,
      limit_count: NEARBY_LIMIT,
    });
    for (const r of (nearby ?? []) as Array<{ id: string; is_private?: boolean | null }>) {
      if (r.id && !r.is_private) ids.add(r.id);
    }
  }

  if (ids.size === 0) return [];

  const { data: beaches, error: beachErr } = await supabase
    .from("beaches")
    .select("id, name, slug, center_lat, center_lng, timezone")
    .in("id", Array.from(ids));

  if (beachErr) {
    console.warn(`${CONTEXT_TAG} beach hydrate failed`, beachErr.message);
    return [];
  }

  return (beaches ?? []) as BeachRow[];
}

/**
 * Drops beaches with status='closure' in beach_water_quality (matches the
 * filter applied by the discovery orchestrator).
 */
async function filterByWaterQuality(
  supabase: any,
  candidates: BeachRow[],
): Promise<BeachRow[]> {
  if (candidates.length === 0) return [];
  const { data, error } = await supabase
    .from("beach_water_quality")
    .select("beach_id, status")
    .in(
      "beach_id",
      candidates.map((c) => c.id),
    );
  if (error) {
    // Non-fatal — proceed without WQ filter rather than skipping the user.
    console.warn(`${CONTEXT_TAG} water quality lookup failed`, error.message);
    return candidates;
  }
  const closed = new Set<string>();
  for (const r of (data ?? []) as Array<{ beach_id: string; status: string }>) {
    if (r.status === "closure") closed.add(r.beach_id);
  }
  return candidates.filter((c) => !closed.has(c.id));
}

/**
 * For each candidate beach: fetch next 24h of forecasts, slice to daylight
 * (6am-9pm beach-local), bulk-score via compute_user_match_score_batch, and
 * flatten into a single ScoredSlot[] for the picker.
 */
async function scoreCandidates(
  supabase: any,
  userId: string,
  candidates: BeachRow[],
): Promise<ScoredSlot[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  const out: ScoredSlot[] = [];

  for (const beach of candidates) {
    const tz = resolveBeachTimezone(beach.timezone);

    const { data: rows, error: fxErr } = await supabase
      .from("enhanced_forecasts")
      .select(
        "forecast_at, wave_height, wave_period, wind_speed, wind_direction_deg, tide_height",
      )
      .eq("beach_id", beach.id)
      .gte("forecast_at", now.toISOString())
      .lte("forecast_at", horizon.toISOString())
      .order("forecast_at", { ascending: true });

    if (fxErr) {
      console.warn(
        `${CONTEXT_TAG} forecast load failed beach=${beach.id}`,
        fxErr.message,
      );
      continue;
    }

    const forecasts = (rows ?? []) as ForecastSlot[];
    if (forecasts.length === 0) continue;

    const daylight = forecasts.filter((f) => {
      const hour = localHourInTz(f.forecast_at, tz);
      return hour >= DAYLIGHT_START_HOUR && hour < DAYLIGHT_END_HOUR;
    });
    if (daylight.length === 0) continue;

    const slots = daylight
      .filter((f) => f.wave_height != null && f.wave_period != null)
      .map((f) => ({
        forecast_at: f.forecast_at,
        wave_height: f.wave_height ?? "",
        wave_period: f.wave_period ?? "",
        wind_speed: f.wind_speed ?? "",
        wind_direction:
          f.wind_direction_deg == null ? "" : String(f.wind_direction_deg),
        tide_height: f.tide_height ?? "",
      }));

    if (slots.length === 0) continue;

    const { data: rpcRows, error: rpcErr } = await supabase.rpc(
      "compute_user_match_score_batch",
      {
        p_user_id: userId,
        p_beach_id: beach.id,
        p_slots: slots,
      },
    );

    if (rpcErr) {
      console.warn(
        `${CONTEXT_TAG} batch RPC failed beach=${beach.id}`,
        rpcErr.message,
      );
      continue;
    }

    for (const r of (rpcRows ?? []) as BatchSlotResult[]) {
      const result = r.result;
      if (!result || result.state !== "ready") continue;
      if (typeof result.score !== "number") continue;
      if (result.score < SURFABILITY_FLOOR) continue;
      out.push({
        beach_id: beach.id,
        beach_name: beach.name,
        beach_slug: beach.slug ?? "",
        forecast_at: r.forecast_at,
        beach_timezone: tz,
        score: result.score,
        label: result.label ?? null,
        reason: firstReasonBullet(result.reason_bullets),
      });
    }
  }

  return out;
}

type InsertOutcome = "inserted" | "dedup" | "error";

async function tryInsertAlert(
  supabase: any,
  user: EligibleUserRow,
  pick: ScoredSlot,
): Promise<InsertOutcome> {
  const userTz = resolveBeachTimezone(user.timezone || pick.beach_timezone);
  const alertDate = localDateInTz(pick.forecast_at, userTz);
  const nowIso = new Date().toISOString();

  const snapshot = {
    alert_type: "similarity_match" as const,
    score: pick.score,
    label: pick.label,
    forecast_at: pick.forecast_at,
    rule_id: user.anchor_rule_id,
    beach_id: pick.beach_id,
    beach_slug: pick.beach_slug,
    beach_name: pick.beach_name,
    reason: pick.reason ?? `${pick.label ?? "Match"} at ${pick.beach_name}`,
  };

  const { data, error } = await supabase.rpc("try_insert_similarity_alert", {
    p_user_id: user.user_id,
    p_rule_id: user.anchor_rule_id,
    p_beach_id: pick.beach_id,
    p_alert_date: alertDate,
    p_send_at: nowIso,
    p_window_start: pick.forecast_at,
    p_window_end: pick.forecast_at,
    p_best_hour: pick.forecast_at,
    p_conditions_snapshot: snapshot,
  });

  if (error) {
    console.error(
      `${CONTEXT_TAG} try_insert_similarity_alert failed user=${user.user_id}`,
      error.message,
    );
    return "error";
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.inserted) return "inserted";
  return "dedup";
}

async function bumpLastMatchedAt(
  supabase: any,
  ruleId: string,
): Promise<void> {
  const { error } = await supabase
    .from("alert_rules")
    .update({ last_matched_at: new Date().toISOString() })
    .eq("id", ruleId);
  if (error) {
    console.warn(
      `${CONTEXT_TAG} last_matched_at update failed rule=${ruleId}`,
      error.message,
    );
  }
}

export const GET = withObservedCron("/api/cron/similarity-alerts", _GET);
