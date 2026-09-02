// app/api/cron/similarity-alerts/route.ts
//
// Plan V4 similarity-alerts cron — runs once daily at 13:00 UTC (~6am PT).
//
// Iterates DISTINCT eligible USERS (not rules). For each user:
//  1. Builds a candidate beach pool around the user's latest foreground
//     location, bounded by their drive-range preference.
//  2. Drops candidates whose `slug` is null/empty (defensive; payload schema
//     requires non-empty beach_slug and a missing slug means the beach row
//     was malformed at seed time — better to skip than to self-reject in
//     the worker).
//  3. Fetches the next 72h of enhanced_forecasts per candidate, filters to
//     surfable windows (tighter 6:00-19:00 beach-local daylight + base
//     scoreWindowWithComposite().total ≥ SURFABILITY_FLOOR on the 0-100
//     beach-aware condition
//     scale), then bulk-scores survivors via compute_user_match_score_batch
//     (one RPC per beach, not per slot).
//  4. Picks the highest-scoring ready slot ≥ 7.5 across all candidates,
//     tie-break by earliest forecast_at, rejects 22:00-06:00 user-local picks.
//  5. Inserts via try_insert_similarity_alert RPC with send_at =
//     window_start - 60 minutes so the alert lands ~1h before the window.
//     inserted=false on dedup hit is treated as success.
//
// TODO(window-selector reuse): the daylight + score floor here is a tighter
// stand-in for the full discovery window selector. Future follow-up: thread
// the orchestrator's `selectBestWindow` (with sun-times cache) through here
// so the cron honours per-beach tide/wind/sunset rules identically to /home.
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
import { isAlertsDeliveryEnabled } from "@/lib/flags/alerts-delivery";

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  createErrorResponse,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { scoreWindowWithComposite } from "@/lib/services/discovery/window-selector";
import {
  pickBestSimilaritySlot,
  type ScoredSlot,
} from "@/lib/alerts/similarity-best-pick";
import { isLearnedMatchState } from "@/lib/personalization/match-state-compat";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { resolveNotificationMajorEventHold } from "@/lib/recommendations/major-event-hold/adapters/notification";
import { buildCanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { normalizeTideStatus } from "@/lib/services/preference-learning-service";
import { selectBeach } from "@/lib/recommendations/selection";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONTEXT_TAG = "[similarity-alerts]";
const SCORE_THRESHOLD = 7.5;
/**
 * Base score floor (0-100 discovery scale). A slot must clear this on
 * scoreWindowWithComposite().total BEFORE we run user-personal similarity
 * scoring — otherwise we send a "matches your style" alert for a flat /
 * blown-out window just because the user has logged sessions like it before.
 *
 * 60 ≈ "decent surfable conditions" on the beach-aware discovery condition
 * score. Tune downward only after observing false-positive complaints.
 */
const SURFABILITY_FLOOR = 60;
/**
 * Forecast horizon scanned per run.
 *
 * The queue dedupe contract keys similarity alerts by user, beach, forecast
 * window, and canonical verdict. An identical decision from a later cron
 * tick returns inserted=false and is counted in `dedupSkipped`, while a
 * genuinely different beach/window remains eligible inside this horizon.
 */
const LOOKAHEAD_HOURS = 72;
const MAX_NEARBY_RADIUS_MILES = 100;
const NEARBY_RADIUS_MILES = 30;
const NEARBY_LIMIT = 10;
const FAVORITE_LIMIT = 5;
const MILES_PER_DRIVE_MINUTE = 0.5;
const MAX_LOCATION_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_LOCATION_FUTURE_SKEW_MS = 5 * 60 * 1000;
const REJECT_START_HOUR_LOCAL = 22; // 10pm
const REJECT_END_HOUR_LOCAL = 6; // 6am
const DAYLIGHT_START_HOUR = 6;
/**
 * 19:00 — tighter than the previous 21:00 to drop dusk windows that
 * accumulate junk wind/glare-off-the-water and rarely produce surfable
 * conditions in practice. The picker's reject window (22:00-06:00) still
 * runs as a defense-in-depth.
 */
const DAYLIGHT_END_HOUR = 19;
/** send_at = window_start - 60 min so the alert lands ~1h before the window. */
const SEND_AT_LEAD_MINUTES = 60;

interface EligibleUserRow {
  user_id: string;
  anchor_rule_id: string;
  home_beach_id: string;
  configured_beach_id: string;
  experience_level: string | null;
  max_drive_minutes: number | null;
  location: {
    lat: number;
    lon: number;
    timezone: string;
  };
}

/**
 * Hydrated beach row passed to the scoring/picker pipeline. Includes the
 * fields needed for score gating and notification context.
 */
interface BeachRow {
  id: string;
  name: string;
  slug: string | null;
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  skill_level: string | null;
  break_type: string | null;
  swell_window_min_deg: number | null;
  swell_window_max_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  wind_onshore_bad_kt: number | null;
  wind_cross_shore_ok_kt: number | null;
  preferred_tide_direction: string | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  tide_direction_sensitivity: string | null;
}

interface ForecastSlot {
  forecast_at: string;
  wave_height: string | null;
  wave_period: string | null;
  wave_direction: string | null;
  wind_speed: string | null;
  wind_direction: string | null;
  wind_direction_deg: number | null;
  tide_height: string | null;
  tide_status: string | null;
  swell_1_height: string | null;
  swell_1_period: string | null;
  swell_1_direction: string | null;
  swell_2_height: string | null;
  swell_2_period: string | null;
  swell_2_direction: string | null;
  wind_wave_height: string | null;
  wind_wave_period: string | null;
  wind_wave_direction: string | null;
  confidence_score: number | null;
  data_source: string | null;
}

interface BatchSlotResult {
  slot_idx: number;
  forecast_at: string;
  result: {
    state?: string;
    score?: number;
    label?: string | null;
    reason_bullets?: unknown;
    confidence?: number | "low" | "medium" | "high";
    board_tip?: unknown;
    setup_tip?: unknown;
  } | null;
}

type RichScoredSlot = ScoredSlot & {
  beach_skill_level?: string | null;
  window_end?: string;
  wind_speed_mph?: number;
  wind_direction?: string;
  tide_height_ft?: number;
  tide_status?: string;
  confidence?: number;
  condition_summary?: string;
  board_tip?: string;
  setup_tip?: string;
};

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

/**
 * Format a forecast UTC ISO string into a short beach-local window label
 * for the push body, e.g. "Sat 8am". No standalone formatter exists in
 * timezone-utils — this matches the Plan V4 "Sat 8am"-style spec verbatim.
 *
 * Uses two Intl.DateTimeFormat calls so we can lowercase the AM/PM separately
 * and drop the space ("8 AM" → "8am"), matching the email/web body convention.
 */
function formatWindowLocal(forecastAt: string, timezone: string): string {
  try {
    const d = new Date(forecastAt);
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).format(d);
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: true,
    })
      .format(d)
      .toLowerCase()
      .replace(/\s+/g, "");
    return `${day} ${hour}`;
  } catch {
    // Fall back to the raw ISO if locale data is unavailable. Never throw
    // out of the cron's hot path on a formatting blip.
    return forecastAt;
  }
}

function parseFloatOrZero(value: string | null | undefined): number {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalFloat(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const cleaned = String(value).replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildConditionSummary(args: {
  waveHeightFt: number;
  wavePeriodS: number;
  windSpeedMph?: number;
  windDirection?: string;
  tideHeightFt?: number;
  tideStatus?: string;
}): string | undefined {
  const parts = [
    `${args.waveHeightFt.toFixed(1)}ft @ ${args.wavePeriodS.toFixed(0)}s`,
  ];
  if (args.windDirection && args.windSpeedMph != null) {
    parts.push(`${args.windDirection} wind ${args.windSpeedMph.toFixed(0)}mph`);
  }
  if (args.tideStatus && args.tideHeightFt != null) {
    parts.push(`${args.tideStatus} tide ${args.tideHeightFt.toFixed(1)}ft`);
  } else if (args.tideStatus) {
    parts.push(`${args.tideStatus} tide`);
  }
  return parts.length > 1 ? parts.join(", ") : undefined;
}

async function _GET(req: Request): Promise<Response> {
  if (!validateCronRequest(req)) {
    return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
  }

  const deliveryEnabled = isAlertsDeliveryEnabled();
  const allowlistRaw = process.env.ALERTS_DELIVERY_USER_ALLOWLIST ?? "";
  const allowlist = new Set(
    allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (!deliveryEnabled) {
    console.log(`${CONTEXT_TAG} skipped: ALERTS_DELIVERY_ENABLED=false`);
    return NextResponse.json(await withCronOutcome(
      {
        job: "/api/cron/similarity-alerts",
        unit: "alerts_queued",
        expectedMin: 1,
        getProduced: (value) => value.enqueued,
        legitimatelyZero: () => ({ reason: "ALERTS_DELIVERY_ENABLED is not true" }),
      },
      async () => ({
        skipped: true,
        reason: "delivery_disabled",
        enqueued: 0,
        evaluated: 0,
      }),
    ));
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

        const scored = await scoreCandidates(
          supabase,
          user.user_id,
          candidates,
        );
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

        const inserted = await tryInsertAlert(supabase, user, pick as RichScoredSlot);
        if (inserted === "inserted") {
          enqueued++;
          await bumpLastMatchedAt(supabase, user.anchor_rule_id);
        } else if (inserted === "dedup") {
          dedupSkipped++;
        } else if (inserted === "suppressed") {
          noPickSkipped++;
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
    return NextResponse.json(await withCronOutcome(
      {
        job: "/api/cron/similarity-alerts",
        unit: "alerts_queued",
        expectedMin: 1,
        getProduced: (value) => value.enqueued,
        legitimatelyZero: (value) =>
          value.errors === 0 && (value.evaluated === 0 || value.enqueued === 0)
            ? { reason: value.evaluated === 0 ? "No similarity-alert users were eligible" : "No eligible similarity window matched this cycle" }
            : undefined,
      },
      async () => ({
        evaluated,
        enqueued,
        dedupSkipped,
        allowlistSkipped,
        noPickSkipped,
        errors,
      }),
    ));
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
 * Loads eligible users + their anchor similarity_match rule.
 *
 * Uses three flat selects + JS-side join. We do NOT use a `profiles!inner(...)`
 * embed on alert_rules because `alert_rules.user_id` FKs to `auth.users(id)`,
 * not `profiles(id)` — PostgREST cannot resolve the two-hop relationship and
 * returns PGRST200, silently 500ing the cron. Both `condition-alert-evaluate`
 * (route.ts:64-67) and `condition-alert-deliver` (route.ts:91-94) document
 * the same lesson — keep this pattern in sync with them.
 *
 * Steps:
 *  1. Flat select alert_rules (no embeds).
 *  2. Parallel `.in()` lookups against profiles and user_entitlements.
 *  3. JS-side entitlement filter mirroring `entitlementFromRow` exactly
 *     (billing_issue carve-out + expires_at staleness guard).
 *  4. Group by user_id and pick the anchor: prefer auto_created_at NOT NULL,
 *     then MIN(id).
 */
async function loadEligibleUsers(
  supabase: any,
): Promise<EligibleUserRow[]> {
  // 1. Flat select — no relationship embed. See function-doc rationale.
  const { data: rules, error: rulesError } = await supabase
    .from("alert_rules")
    .select("id, user_id, beach_id, auto_created_at")
    .eq("preset_type", "similarity_match")
    .eq("enabled", true);

  if (rulesError) {
    console.error(`${CONTEXT_TAG} failed to load similarity rules`, rulesError);
    throw rulesError;
  }

  const ruleRows = (rules ?? []) as Array<{
    id: string;
    user_id: string;
    beach_id: string | null;
    auto_created_at: string | null;
  }>;
  if (ruleRows.length === 0) return [];

  const userIds = Array.from(new Set(ruleRows.map((r) => r.user_id)));

  // 2. Parallel flat lookups by user_id.
  const [profilesRes, entitlementsRes, locationsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, home_beach_id, experience_level, max_drive_minutes")
      .in("id", userIds),
    supabase
      .from("user_entitlements")
      .select("user_id, is_pro, is_trialing, billing_issue, expires_at")
      .in("user_id", userIds),
    supabase
      .from("user_location_snapshots")
      .select("user_id, lat, lon, timezone, captured_at")
      .in("user_id", userIds),
  ]);

  if (profilesRes.error) {
    console.error(`${CONTEXT_TAG} failed to load profiles`, profilesRes.error);
    throw profilesRes.error;
  }
  // user_entitlements legitimately has no rows for free users — only throw
  // on hard errors (mirrors condition-alert-evaluate:104).
  if (entitlementsRes.error) {
    console.error(
      `${CONTEXT_TAG} failed to load entitlements`,
      entitlementsRes.error,
    );
    throw entitlementsRes.error;
  }
  if (locationsRes.error) {
    console.error(`${CONTEXT_TAG} failed to load locations`, locationsRes.error);
    throw locationsRes.error;
  }

  // 3. Build lookup maps.
  const profileById = new Map<
    string,
    {
      home_beach_id: string | null;
      experience_level: string | null;
      max_drive_minutes: number | null;
    }
  >();
  for (const p of (profilesRes.data ?? []) as Array<{
    id: string;
    home_beach_id: string | null;
    experience_level: string | null;
    max_drive_minutes: number | null;
  }>) {
    profileById.set(p.id, {
      home_beach_id: p.home_beach_id,
      experience_level: p.experience_level,
      max_drive_minutes: p.max_drive_minutes,
    });
  }

  const entitlementByUserId = new Map<
    string,
    {
      is_pro: boolean | null;
      is_trialing: boolean | null;
      billing_issue: boolean | null;
      expires_at: string | null;
    }
  >();
  for (const e of (entitlementsRes.data ?? []) as Array<{
    user_id: string;
    is_pro: boolean | null;
    is_trialing: boolean | null;
    billing_issue: boolean | null;
    expires_at: string | null;
  }>) {
    entitlementByUserId.set(e.user_id, e);
  }

  // 4. JS-side join + entitlement filter + anchor selection.
  const now = Date.now();
  const locationByUserId = new Map<
    string,
    { lat: number; lon: number; timezone: string }
  >();
  for (const location of (locationsRes.data ?? []) as Array<{
    user_id: string;
    lat: number;
    lon: number;
    timezone: string;
    captured_at: string;
  }>) {
    const capturedAt = Date.parse(location.captured_at);
    if (
      !Number.isFinite(capturedAt) ||
      capturedAt > now + MAX_LOCATION_FUTURE_SKEW_MS ||
      now - capturedAt > MAX_LOCATION_AGE_MS
    ) {
      continue;
    }
    locationByUserId.set(location.user_id, {
      lat: location.lat,
      lon: location.lon,
      timezone: location.timezone,
    });
  }
  const groups = new Map<
    string,
    Array<{
      id: string;
      user_id: string;
      beach_id: string | null;
      auto_created_at: string | null;
      home_beach_id: string;
      experience_level: string | null;
      max_drive_minutes: number | null;
      location: { lat: number; lon: number; timezone: string };
    }>
  >();

  for (const rule of ruleRows) {
    const profile = profileById.get(rule.user_id);
    if (!profile) continue;
    if (!profile.home_beach_id) continue;
    const location = locationByUserId.get(rule.user_id);
    if (!location) continue;

    const ent = entitlementByUserId.get(rule.user_id);
    if (!ent) continue;
    if (!ent.is_pro && !ent.is_trialing) continue;
    if (
      ent.expires_at &&
      !ent.billing_issue &&
      new Date(ent.expires_at).getTime() < now
    ) {
      continue;
    }

    const list = groups.get(rule.user_id) ?? [];
    list.push({
      id: rule.id,
      user_id: rule.user_id,
      beach_id: rule.beach_id,
      auto_created_at: rule.auto_created_at,
      home_beach_id: profile.home_beach_id,
      experience_level: profile.experience_level,
      max_drive_minutes: profile.max_drive_minutes,
      location,
    });
    groups.set(rule.user_id, list);
  }

  const eligibleUsers: EligibleUserRow[] = [];
  for (const [userId, userRules] of groups) {
    userRules.sort((a, b) => {
      // Prefer auto_created_at NOT NULL (system-seeded). When tied (both NULL
      // or both NOT NULL), sort by id ASC for deterministic anchor selection.
      const aAuto = a.auto_created_at ? 1 : 0;
      const bAuto = b.auto_created_at ? 1 : 0;
      if (aAuto !== bAuto) return bAuto - aAuto;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const anchor = userRules[0];
    eligibleUsers.push({
      user_id: userId,
      anchor_rule_id: anchor.id,
      home_beach_id: anchor.home_beach_id,
      configured_beach_id: anchor.beach_id ?? anchor.home_beach_id,
      experience_level: anchor.experience_level,
      max_drive_minutes: anchor.max_drive_minutes,
      location: anchor.location,
    });
  }

  return eligibleUsers;
}

/**
 * Builds the local recommendation pool from the latest foreground location.
 * Hidden beaches and spots outside the configured drive range stay out.
 */
async function buildCandidateBeaches(
  supabase: any,
  user: EligibleUserRow,
): Promise<BeachRow[]> {
  const radiusMiles = Math.min(
    MAX_NEARBY_RADIUS_MILES,
    user.max_drive_minutes == null
      ? NEARBY_RADIUS_MILES
      : Math.max(0, user.max_drive_minutes * MILES_PER_DRIVE_MINUTE),
  );
  if (radiusMiles === 0) return [];

  const [favoritesRes, nearbyRes] = await Promise.all([
    supabase
      .from("favorite_beaches")
      .select("beach_id")
      .eq("user_id", user.user_id)
      .order("rank", { ascending: true, nullsFirst: false }),
    supabase.rpc("get_weekend_scout_candidates", {
      input_user_id: user.user_id,
      input_lat: user.location.lat,
      input_lon: user.location.lon,
      max_distance_meters: Math.round(radiusMiles * 1609.34),
      limit_count: NEARBY_LIMIT + FAVORITE_LIMIT,
    }),
  ]);
  if (nearbyRes.error) {
    console.warn(`${CONTEXT_TAG} local candidate lookup failed`);
    return [];
  }
  const favoriteIds: string[] = [];
  for (const r of (favoritesRes.data ?? []) as Array<{ beach_id: string }>) {
    if (!r.beach_id || favoriteIds.includes(r.beach_id)) continue;
    favoriteIds.push(r.beach_id);
  }
  const nearbyIds: string[] = [];
  for (const r of (nearbyRes.data ?? []) as Array<{ id: string }>) {
    if (r.id) nearbyIds.push(r.id);
  }
  if (nearbyIds.length === 0) return [];

  const { data: beaches, error: beachErr } = await supabase
    .from("beaches")
    .select(
      [
        "id",
        "name",
        "slug",
        "lat",
        "lon",
        "timezone",
        "skill_level",
        "break_type",
        "swell_window_min_deg",
        "swell_window_max_deg",
        "wind_offshore_deg",
        "wind_offshore_tol_deg",
        "wind_onshore_bad_kt",
        "wind_cross_shore_ok_kt",
        "preferred_tide_direction",
        "preferred_tide_ft_min",
        "preferred_tide_ft_max",
        "tide_direction_sensitivity",
      ].join(", "),
    )
    .in("id", nearbyIds);

  if (beachErr) {
    console.warn(`${CONTEXT_TAG} beach hydrate failed`, beachErr.message);
    return [];
  }

  // Producer-side slug guard: similarityMatchSchema requires a non-empty
  // beach_slug. A null/empty slug here means the beach row was malformed at
  // seed time — dropping it before similarity scoring is safer than letting
  // the worker self-reject the payload (which would burn a queue slot AND
  // log invalid_payload errors that look like data-shape regressions).
  const validBeaches = ((beaches ?? []) as BeachRow[]).filter((b) => {
    const slug = b.slug;
    if (slug == null || slug === "") {
      console.warn(
        `${CONTEXT_TAG} dropping candidate beach ${b.id} — null/empty slug`,
      );
      return false;
    }
    return true;
  });
  const validIds = new Set(validBeaches.map((beach) => beach.id));
  const selectedIds = new Set<string>();
  if (validIds.has(user.configured_beach_id)) {
    selectedIds.add(user.configured_beach_id);
  }
  const safeAlternatives = (
    await Promise.all(
      validBeaches
        .filter((beach) => beach.id !== user.configured_beach_id)
        .map((beach) => selectBeach(beach)),
    )
  ).filter((beach): beach is NonNullable<typeof beach> => beach !== null);
  const safeAlternativeIds = new Set(
    safeAlternatives.map(({ id }) => id),
  );
  favoriteIds
    .filter((beachId) => validIds.has(beachId))
    .filter((beachId) => safeAlternativeIds.has(beachId))
    .slice(0, FAVORITE_LIMIT)
    .forEach((beachId) => selectedIds.add(beachId));
  nearbyIds
    .filter((beachId) => validIds.has(beachId))
    .filter((beachId) => safeAlternativeIds.has(beachId))
    .forEach((beachId) => selectedIds.add(beachId));

  return validBeaches.filter(
    (beach) =>
      beach.id === user.configured_beach_id || selectedIds.has(beach.id),
  );
}

/**
 * For each candidate beach: fetch next 72h of forecasts, slice to daylight
 * (6am-7pm beach-local), drop slots whose discovery base score is below
 * SURFABILITY_FLOOR (so we never alert on personally-similar but objectively
 * weak windows), then bulk-score the survivors via
 * compute_user_match_score_batch and flatten into a single ScoredSlot[] for
 * the picker. Stamps window_local + wave_height_ft + wave_period_s on each
 * survivor so the registry's push body can compose without a second fetch.
 */
async function scoreCandidates(
  supabase: any,
  userId: string,
  candidates: BeachRow[]
): Promise<RichScoredSlot[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  const out: RichScoredSlot[] = [];

  for (const beach of candidates) {
    const tz = resolveBeachTimezone(beach.timezone);

    const { data: rows, error: fxErr } = await supabase
      .from("enhanced_forecasts")
      .select(
        [
          "forecast_at",
          "wave_height",
          "wave_period",
          "wave_direction",
          "wind_speed",
          "wind_direction",
          "wind_direction_deg",
          "tide_height",
          "tide_status",
          "swell_1_height",
          "swell_1_period",
          "swell_1_direction",
          "swell_2_height",
          "swell_2_period",
          "swell_2_direction",
          "wind_wave_height",
          "wind_wave_period",
          "wind_wave_direction",
          "confidence_score",
          "data_source",
        ].join(", "),
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

    // Daylight filter: tighter 6:00-19:00 vs the previous 21:00. Plan V4 fix
    // F2 — dusk windows accumulate junk wind and rarely surf well.
    const daylight = forecasts.filter((f) => {
      const hour = localHourInTz(f.forecast_at, tz);
      return hour >= DAYLIGHT_START_HOUR && hour < DAYLIGHT_END_HOUR;
    });
    if (daylight.length === 0) continue;

    // Base score gate: run the beach-aware composite scorer on each slot and
    // drop anything below SURFABILITY_FLOOR (60/100) BEFORE the user-personal
    // similarity scoring. Without this, a user with a "small-mush" preference
    // pattern gets push notifications for flat or onshore windows just because
    // they've logged sessions in those conditions before.
    //
    // We cast the structurally-narrow BeachRow / ForecastSlot to Beach /
    // EnhancedForecastEntity so the shared scorer can read the forecast shape
    // used by the rest of the app.
    const surfable: ForecastSlot[] = [];
    const conditionScoreByForecastAt = new Map<string, number>();
    for (const f of daylight) {
      if (f.wave_height == null || f.wave_period == null) continue;
      let baseScore = 0;
      try {
        baseScore = scoreWindowWithComposite(
          f as unknown as EnhancedForecastEntity,
          beach as unknown as Beach
        ).total;
      } catch (engineErr) {
        // Engine throws are unexpected — log and treat as below floor so we
        // never silently push an unscored window.
        console.warn(
          `${CONTEXT_TAG} scoreWindowWithComposite threw beach=${beach.id} forecast_at=${f.forecast_at}`,
          engineErr,
        );
        continue;
      }
      if (baseScore < SURFABILITY_FLOOR) continue;
      surfable.push(f);
      conditionScoreByForecastAt.set(f.forecast_at, baseScore);
    }
    if (surfable.length === 0) continue;

    const slots = surfable.map((f) => ({
      forecast_at: f.forecast_at,
      wave_height: f.wave_height ?? "",
      wave_period: f.wave_period ?? "",
      wind_speed: f.wind_speed ?? "",
      wind_direction:
        f.wind_direction_deg == null ? "" : String(f.wind_direction_deg),
      tide_height: f.tide_height ?? "",
    }));

    if (slots.length === 0) continue;

    // Quick lookup of original forecast row by forecast_at, so we can stamp
    // wave_height_ft / wave_period_s onto the ScoredSlot from the same row
    // the engine scored.
    const byForecastAt = new Map<string, ForecastSlot>();
    for (const f of surfable) byForecastAt.set(f.forecast_at, f);

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
      if (!result || !isLearnedMatchState(result.state)) continue;
      if (typeof result.score !== "number") continue;
      const source = byForecastAt.get(r.forecast_at);
      const waveHeightFt = parseFloatOrZero(source?.wave_height);
      const wavePeriodS = parseFloatOrZero(source?.wave_period);
      const windSpeedMph = parseOptionalFloat(source?.wind_speed);
      const tideHeightFt = parseOptionalFloat(source?.tide_height);
      const windDirection =
        optionalString(source?.wind_direction) ??
        (source?.wind_direction_deg == null
          ? undefined
          : String(source.wind_direction_deg));
      const tideStatus =
        normalizeTideStatus(source?.tide_status) ?? undefined;
      const matchConfidence =
        result.confidence === "low" ||
        result.confidence === "medium" ||
        result.confidence === "high"
          ? result.confidence
          : undefined;
      const confidence =
        typeof result.confidence === "number"
          ? result.confidence
          : source?.confidence_score ?? undefined;
      const boardTip = optionalString(result.board_tip);
      const setupTip = optionalString(result.setup_tip);
      const conditionSummary = buildConditionSummary({
        waveHeightFt,
        wavePeriodS,
        windSpeedMph,
        windDirection,
        tideHeightFt,
        tideStatus,
      });
      out.push({
        beach_id: beach.id,
        beach_name: beach.name,
        // Slug is guaranteed non-empty by the producer-side filter in
        // buildCandidateBeaches; the `?? ""` is defense-in-depth for the
        // type system, never reached at runtime.
        beach_slug: beach.slug ?? "",
        forecast_at: r.forecast_at,
        beach_timezone: tz,
        score: result.score,
        label: result.label ?? null,
        reason: firstReasonBullet(result.reason_bullets),
        ...(matchConfidence == null
          ? {}
          : { match_confidence: matchConfidence }),
        beach_skill_level: beach.skill_level,
        condition_score: conditionScoreByForecastAt.get(r.forecast_at),
        window_end: new Date(
          new Date(r.forecast_at).getTime() + 60 * 60 * 1000,
        ).toISOString(),
        window_local: formatWindowLocal(r.forecast_at, tz),
        wave_height_ft: waveHeightFt,
        wave_period_s: wavePeriodS,
        ...(windSpeedMph == null ? {} : { wind_speed_mph: windSpeedMph }),
        ...(windDirection == null ? {} : { wind_direction: windDirection }),
        ...(tideHeightFt == null ? {} : { tide_height_ft: tideHeightFt }),
        ...(tideStatus == null ? {} : { tide_status: tideStatus }),
        ...(confidence == null ? {} : { confidence }),
        ...(boardTip == null ? {} : { board_tip: boardTip }),
        ...(setupTip == null ? {} : { setup_tip: setupTip }),
        ...(conditionSummary == null
          ? {}
          : { condition_summary: conditionSummary }),
      });
    }
  }

  return out;
}

type InsertOutcome = "inserted" | "dedup" | "suppressed" | "error";

function canonicalMatchLabel(
  value: string | null,
): "EPIC" | "GOOD" | "FAIR" | "RIDEABLE" | "MEH" | null {
  const label = value?.trim().toUpperCase();
  if (
    label === "EPIC" ||
    label === "GOOD" ||
    label === "FAIR" ||
    label === "RIDEABLE" ||
    label === "MEH"
  ) {
    return label;
  }
  return null;
}

async function tryInsertAlert(
  supabase: any,
  user: EligibleUserRow,
  pick: RichScoredSlot,
): Promise<InsertOutcome> {
  const userTz = resolveBeachTimezone(
    user.location.timezone || pick.beach_timezone,
  );
  const alertDate = localDateInTz(pick.forecast_at, userTz);
  const now = Date.now();
  // Send the alert ~60 minutes before the matched window opens. If the
  // window is already in the past (defensive — pick should have filtered
  // these out), fall back to "now" so the deliver cron picks it up on the
  // next tick instead of holding an alert that will never fire.
  const windowStartMs = new Date(pick.forecast_at).getTime();
  const hasValidWindow = Number.isFinite(windowStartMs);
  const parsedWindowEnd = Date.parse(pick.window_end ?? "");
  const windowEndIso = Number.isFinite(parsedWindowEnd)
    ? new Date(parsedWindowEnd).toISOString()
    : hasValidWindow
      ? new Date(windowStartMs + 60 * 60 * 1000).toISOString()
    : pick.forecast_at;
  const sendAtMs = hasValidWindow
    ? windowStartMs - SEND_AT_LEAD_MINUTES * 60 * 1000
    : now;
  const sendAtIso = new Date(sendAtMs >= now ? sendAtMs : now).toISOString();
  const matchLabel = canonicalMatchLabel(pick.label);
  if (!hasValidWindow || matchLabel === null) return "suppressed";

  const conditionScore = pick.condition_score ?? 0;
  const recommendationLabel =
    conditionScore >= 70
      ? "Worth it"
      : conditionScore >= 40
        ? "Maybe"
        : "Skip";
  const anchorTime = new Date(windowStartMs).toISOString();
  const candidateId =
    `similarity-alert:${pick.beach_id}:${pick.forecast_at}`;
  const canonicalDecision = buildCanonicalSessionDecision({
    anchorTime,
    scope: {
      kind: "plan_next_session",
      windowStart: anchorTime,
      windowEnd: windowEndIso,
      timezone: pick.beach_timezone,
    },
    profileExperience: user.experience_level,
    recommendationAvailability: {
      state: "available",
      holdEpoch: "similarity-alert-preflight",
    },
    candidates: [
      {
        candidateId,
        beachId: pick.beach_id,
        beachName: pick.beach_name,
        beachSkillLevel: pick.beach_skill_level,
        windowStart: pick.forecast_at,
        windowEnd: windowEndIso,
        timezone: pick.beach_timezone,
        forecastId: candidateId,
        forecastAt: pick.forecast_at,
        waveHeight: `${pick.wave_height_ft} ft`,
        utilityScore: conditionScore,
        recommendationLabel,
        personalMatch: {
          score: pick.score,
          label: matchLabel,
          confidence:
            pick.match_confidence ??
            (pick.score >= 8 ? "high" : "medium"),
          sessionCount: 0,
          reasons: pick.reason ? [pick.reason] : [],
        },
      },
    ],
  });
  if (
    canonicalDecision.verdict !== "go" ||
    canonicalDecision.selection?.candidateId !== candidateId
  ) {
    return "suppressed";
  }

  const snapshot = {
    alert_type: "similarity_match" as const,
    score: pick.score,
    label: pick.label,
    forecast_at: pick.forecast_at,
    rule_id: user.anchor_rule_id,
    beach_id: pick.beach_id,
    configured_beach_id: user.configured_beach_id,
    beach_slug: pick.beach_slug,
    beach_name: pick.beach_name,
    reason: pick.reason ?? `${pick.label ?? "Match"} at ${pick.beach_name}`,
    session_decision: canonicalDecision,
    // Plan V4 fix F2: extended payload fields. The deliver cron reads these
    // off conditions_snapshot and forwards them into the notifications
    // pipeline; the registry's buildPushPayload composes them into the body
    // ("4.5ft @ 11s · Sat 8am") rather than falling back to `reason`.
    window_local: pick.window_local,
    wave_height_ft: pick.wave_height_ft,
    wave_period_s: pick.wave_period_s,
    ...(pick.wind_speed_mph == null ? {} : { wind_speed_mph: pick.wind_speed_mph }),
    ...(pick.wind_direction == null ? {} : { wind_direction: pick.wind_direction }),
    ...(pick.tide_height_ft == null ? {} : { tide_height_ft: pick.tide_height_ft }),
    ...(pick.tide_status == null ? {} : { tide_status: pick.tide_status }),
    ...(pick.confidence == null ? {} : { confidence: pick.confidence }),
    ...(pick.condition_summary == null ? {} : { condition_summary: pick.condition_summary }),
    ...(pick.board_tip == null ? {} : { board_tip: pick.board_tip }),
    ...(pick.setup_tip == null ? {} : { setup_tip: pick.setup_tip }),
    ...(hasValidWindow
      ? {
          policy_context: {
            kind: "positive_session_recommendation" as const,
            beach_id: pick.beach_id,
            starts_at: pick.forecast_at,
            ends_at: windowEndIso,
          },
        }
      : {}),
  };

  const holdResolution = await resolveNotificationMajorEventHold({
    eventId: `similarity-alerts:${user.user_id}:${pick.beach_id}:${pick.forecast_at}`,
    type: "similarity_match",
    payload: snapshot,
    profileExperience: parseSkillLevel(user.experience_level),
  });
  if (holdResolution.status === "suppressed") return "suppressed";

  const { data, error } = await supabase.rpc("try_insert_similarity_alert", {
    p_user_id: user.user_id,
    p_rule_id: user.anchor_rule_id,
    p_beach_id: pick.beach_id,
    p_alert_date: alertDate,
    p_send_at: sendAtIso,
    p_window_start: pick.forecast_at,
    p_window_end: windowEndIso,
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
