#!/usr/bin/env npx tsx
/**
 * Mock cohort re-seed script.
 *
 * Why:
 *   28 mock users have 793 sessions with zero conditions populated, an all-positive
 *   rating distribution (avg 4.42, 0 r1s, 2 r2s), and ~1 session per beach across
 *   30+ unique beaches each. Useless as a test fixture for preference learning,
 *   forecast-vs-actual diffs, similarity matching, or implicit-prefs cron coverage.
 *
 * What this does (per non-Steven mock user, in order):
 *   Phase 0 — pre-clear stale derived rows (user_surf_preferences,
 *             user_implicit_preferences, signal user_events) and ensure
 *             allow_implicit_tracking=true.
 *   Phase 1 — synthesize SYNTHETIC_SESSIONS_PER_USER completed sessions per user
 *             at 2 deterministically-picked home breaks from a pool of
 *             well-covered beaches (recent enhanced_forecasts). Delete any
 *             pre-existing non-home completed sessions to keep cohort clean.
 *             Trigger auto-creates SFS rows on insert.
 *   Phase 2 — for each retained session, parse forecast_snapshot strings to numerics,
 *             apply deterministic Gaussian perturbation, assign rating from a
 *             realistic histogram (skewed toward 3 with a long left tail), UPDATE
 *             the session, then UPDATE SFS.forecast_vs_actual to write a real diff
 *             (the trigger's diff logic is broken for our forecast string format).
 *   Phase 3 — DELETE then INSERT user_events with TOP-LEVEL beach_id (the implicit
 *             aggregation reads e.beach_id, not metadata->>'beach_id').
 *
 * Safety:
 *   - Service-role client only.
 *   - CONFIRM_TARGET=DEV|PROD required; CONFIRM_PROD=YES required for PROD.
 *   - Explicit env file load per target (no fall-through).
 *   - Sanity guard: abort if cohort > MAX_COHORT_SIZE.
 *   - Steven (610a5745-...) excluded; lookup by email at start, hard-fail if missing.
 *   - Cohort prefetch (`is_mock = true AND id <> stevenId`) plus 35-row sanity cap
 *     is the primary safety net. Phase 0's profile UPDATE additionally re-asserts
 *     the cohort filter at the DB; per-row writes elsewhere trust the prefetched
 *     cohortIds list.
 *   - Idempotent: deterministic SHA-1 seeds for ratings/perturbation; clones tagged
 *     in notes; Phase 0 deletes-then-recreates events.
 *
 * Usage:
 *   yarn seed:reseed-mock:dry                           # plan-only, no writes
 *   CONFIRM_TARGET=DEV yarn seed:reseed-mock:dev        # full execution against dev
 *   CONFIRM_TARGET=PROD CONFIRM_PROD=YES yarn ...:prod  # against prod
 *   yarn seed:reseed-mock:dry -- --verify               # run SQL assertions only
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { createHash } from "crypto";
import * as path from "path";
import * as fs from "fs";
import {
  parseWaveHeight,
  parseWindSpeed,
} from "@/lib/utils/forecast-parsing";

// ───────────────────────────────────────────────────────────── constants ─────

const MAX_COHORT_SIZE = 35;
const HOME_BREAK_COUNT = 2;
const SYNTHETIC_SESSIONS_PER_USER = 15;
const SYNTHETIC_SESSION_NOTES_PREFIX = "reseed-mock-synthetic";
const HOME_BREAK_POOL_SIZE = 10;
const SYNTHETIC_DAYS_BACK = 7; // EF coverage window (observed ~7d on prod, narrower than retention)
const STEVEN_EMAIL = "stcha0004@gmail.com";

const RATING_HISTOGRAM_CDF: Array<[number, number]> = [
  [0.08, 1],
  [0.25, 2],
  [0.55, 3],
  [0.83, 4],
  [1.0, 5],
];

const EVENT_PLAN: Record<string, number> = {
  forecast_check: 30,
  beach_view: 15,
  discovery_click: 5,
  location_update: 2,
  discovery_skip: 3,
};

const FEET_PER_METER = 1 / 0.3048;
const MS_PER_MPH = 0.44704;

// ────────────────────────────────────────────────────────── arg + env ────────

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has("--dry-run");
const VERIFY_ONLY = ARGS.has("--verify");
const VERBOSE = ARGS.has("--verbose") || DRY_RUN;

const TARGET = process.env.CONFIRM_TARGET as "DEV" | "PROD" | undefined;

if (TARGET !== "DEV" && TARGET !== "PROD") {
  console.error("CONFIRM_TARGET must be 'DEV' or 'PROD' (required for all modes including --dry-run and --verify).");
  process.exit(1);
}

if (TARGET === "PROD" && !DRY_RUN && !VERIFY_ONLY && process.env.CONFIRM_PROD !== "YES") {
  console.error("CONFIRM_PROD=YES required for PROD live runs.");
  process.exit(1);
}

{
  // Explicit env file per target — no fall-through.
  const envFile = TARGET === "PROD" ? ".env.production.local" : ".env.local";
  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    console.error(`Required env file missing: ${envPath}`);
    process.exit(1);
  }
  const result = dotenvConfig({ path: envPath, override: true });
  if (result.error) {
    console.error(`Failed to load ${envFile}: ${result.error.message}`);
    process.exit(1);
  }
  console.log(`✓ Loaded env from ${envFile}`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ──────────────────────────────────────────────────────── deterministic rng ──

function seedFloat(parts: string[], salt: string): number {
  const h = createHash("sha1").update([...parts, salt].join("|")).digest();
  // Take first 6 bytes → 48-bit unsigned → divide for [0,1)
  const n =
    h[0] * 2 ** 40 +
    h[1] * 2 ** 32 +
    h[2] * 2 ** 24 +
    h[3] * 2 ** 16 +
    h[4] * 2 ** 8 +
    h[5];
  return n / 2 ** 48;
}

function seedGaussian(parts: string[], salt: string, sigma: number): number {
  // Box-Muller from two independent uniforms.
  const u1 = Math.max(seedFloat(parts, salt + ":u1"), 1e-12);
  const u2 = seedFloat(parts, salt + ":u2");
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * sigma;
}

function pickRating(seed: number): number {
  for (const [cdf, rating] of RATING_HISTOGRAM_CDF) {
    if (seed <= cdf) return rating;
  }
  return 5;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ─────────────────────────────────────────────────────────── parsers ─────────

const TIDE_STATUS_MAP: Record<string, "rising" | "falling" | "high" | "low"> = {
  rising: "rising",
  "rising tide": "rising",
  rise: "rising",
  falling: "falling",
  "falling tide": "falling",
  fall: "falling",
  high: "high",
  "high slack": "high",
  "high tide": "high",
  low: "low",
  "low slack": "low",
  "low tide": "low",
};

function normalizeTideStatus(raw: unknown): "rising" | "falling" | "high" | "low" | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return TIDE_STATUS_MAP[trimmed] ?? null;
}

function parseLooseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const m = raw.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

interface ParsedForecast {
  wave_height_ft: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  water_temp: number | null;
  tide_height_ft: number | null;
  tide_status: "rising" | "falling" | "high" | "low" | null;
}

function parseForecastSnapshot(snapshot: Record<string, unknown> | null): ParsedForecast {
  if (!snapshot) {
    return {
      wave_height_ft: null,
      wind_speed_mph: null,
      wind_direction: null,
      water_temp: null,
      tide_height_ft: null,
      tide_status: null,
    };
  }
  // Skip parseWaveHeight for "flat" / null inputs — it returns FLAT_HEIGHT_METERS
  // (~0.5 ft) which would be perturbed into a fake "actual" reading. Treat as null
  // so the session row keeps wave_height_ft empty rather than fabricating a 0.5 ft
  // measurement on flat days.
  const waveStr =
    typeof snapshot.wave_height === "string" ? (snapshot.wave_height as string) : null;
  const waveMeters =
    waveStr && !waveStr.toLowerCase().includes("flat") ? parseWaveHeight(waveStr) : null;
  const windMs = parseWindSpeed(
    typeof snapshot.wind_speed === "string" ? (snapshot.wind_speed as string) : null
  );
  const wd = snapshot.wind_direction;
  return {
    wave_height_ft:
      waveMeters !== null ? Math.round(waveMeters * FEET_PER_METER * 10) / 10 : null,
    wind_speed_mph: windMs !== null ? Math.round(windMs / MS_PER_MPH) : null,
    wind_direction: typeof wd === "string" && wd.trim() ? wd.trim() : null,
    water_temp: parseLooseNumber(snapshot.water_temp),
    tide_height_ft: parseLooseNumber(snapshot.tide_height),
    tide_status: normalizeTideStatus(snapshot.tide_status),
  };
}

// ──────────────────────────────────────────────────────── cohort ─────────────

interface CohortMember {
  user_id: string;
  display_name: string | null;
}

async function listAllAuthUserIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
    for (const u of data.users) ids.add(u.id);
    if (data.users.length < 200) break;
    page++;
  }
  return ids;
}

async function selectCohort(stevenId: string): Promise<CohortMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("is_mock", true)
    .neq("id", stevenId);
  if (error) throw new Error(`cohort select failed: ${error.message}`);
  if (!data) return [];
  if (data.length > MAX_COHORT_SIZE) {
    throw new Error(
      `Cohort sanity guard tripped: got ${data.length} mock users (max ${MAX_COHORT_SIZE}). ` +
        `Refusing to proceed. Inspect profiles.is_mock=true rows manually.`
    );
  }
  // Filter out orphaned profiles whose auth.users row was deleted. The session
  // INSERT trigger writes to user_beach_affinity which has FK -> auth.users(id);
  // an orphan triggers a constraint violation that aborts the transaction.
  const authIds = await listAllAuthUserIds();
  const valid = data.filter((r) => authIds.has(r.id as string));
  const orphanCount = data.length - valid.length;
  if (orphanCount > 0) {
    console.log(
      `  ⚠ filtered ${orphanCount} orphaned profiles (is_mock=true but no auth.users row)`
    );
  }
  return valid.map((r) => ({ user_id: r.id, display_name: r.display_name }));
}

async function findStevenId(): Promise<string> {
  // Walk auth.users to find Steven by canonical email. Hard-fail if not found —
  // we never want to run without an explicit Steven exclusion.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === STEVEN_EMAIL);
    if (match) return match.id;
    if (data.users.length < 200) break;
    page++;
  }
  throw new Error(
    `Could not find Steven's user_id by email ${STEVEN_EMAIL}. Aborting — refuse to run without explicit exclusion.`
  );
}

// ─────────────────────────────────────────────────────── phase 0 ─────────────

async function preClearDerived(cohortIds: string[], stevenId: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [dry] would DELETE user_surf_preferences for ${cohortIds.length} users`);
    console.log(`  [dry] would DELETE user_implicit_preferences for ${cohortIds.length} users`);
    console.log(`  [dry] would DELETE signal user_events for ${cohortIds.length} users`);
    console.log(`  [dry] would UPDATE allow_implicit_tracking=true on cohort`);
    return;
  }
  // Use rpc-like raw SQL via Supabase exec function isn't available — fall back to
  // structured queries with .in() filters. Defense-in-depth: gate on is_mock=true
  // via an additional .eq() filter at the cohort fetch (we already did) plus an
  // .in() against the prefetched cohort. The cohort prefetch already excluded Steven.
  const { error: e1 } = await supabase
    .from("user_surf_preferences")
    .delete()
    .in("user_id", cohortIds);
  if (e1) throw new Error(`pre-clear user_surf_preferences: ${e1.message}`);

  const { error: e2 } = await supabase
    .from("user_implicit_preferences")
    .delete()
    .in("user_id", cohortIds);
  if (e2) throw new Error(`pre-clear user_implicit_preferences: ${e2.message}`);

  const { error: e3 } = await supabase
    .from("user_events")
    .delete()
    .in("user_id", cohortIds)
    .in("event_type", Object.keys(EVENT_PLAN));
  if (e3) throw new Error(`pre-clear user_events: ${e3.message}`);

  const { error: e4 } = await supabase
    .from("profiles")
    .update({ allow_implicit_tracking: true })
    .eq("is_mock", true)
    .neq("id", stevenId);
  if (e4) throw new Error(`opt-in cohort: ${e4.message}`);
}

// ─────────────────────────────────────────────────────── phase 1 ─────────────

interface PhaseOneResult {
  user_id: string;
  before: number;
  deleted: number;
  inserted: number;
  beaches: string[];
}

interface BeachPoolEntry {
  id: string;
  name: string;
}

/**
 * Build the home-break pool: well-covered beaches with recent enhanced_forecasts
 * rows. Sessions inserted at these beaches will get SFS rows from the trigger.
 */
async function findHomeBreakPool(): Promise<BeachPoolEntry[]> {
  // Fetch beaches with EF coverage in the last 7 days. Using the
  // v_enhanced_forecast_latest view would be cleaner but we need a count.
  const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("beach_id")
    .gte("forecast_at", since);
  if (error) throw new Error(`findHomeBreakPool EF query: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.beach_id) continue;
    counts.set(row.beach_id, (counts.get(row.beach_id) ?? 0) + 1);
  }
  const topIds = [...counts.entries()]
    .filter(([, n]) => n >= 50) // require some real coverage
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, HOME_BREAK_POOL_SIZE)
    .map(([id]) => id);

  if (topIds.length < HOME_BREAK_COUNT) {
    throw new Error(
      `Home-break pool too small: ${topIds.length} beaches with EF coverage. Need >= ${HOME_BREAK_COUNT}.`
    );
  }

  const { data: beaches, error: bErr } = await supabase
    .from("beaches")
    .select("id, name")
    .in("id", topIds);
  if (bErr) throw new Error(`findHomeBreakPool beaches: ${bErr.message}`);
  // Preserve EF-coverage ordering
  const byId = new Map((beaches ?? []).map((b) => [b.id, b.name]));
  return topIds.map((id) => ({ id, name: byId.get(id) ?? "(unknown)" }));
}

function pickHomeBreaksForUser(
  userId: string,
  pool: BeachPoolEntry[]
): BeachPoolEntry[] {
  // Deterministic per-user shuffle; take first 2.
  const indexed = pool.map((b, i) => ({
    b,
    rank: seedFloat([userId, b.id, String(i)], "home-pick"),
  }));
  indexed.sort((a, b) => a.rank - b.rank);
  return indexed.slice(0, HOME_BREAK_COUNT).map((e) => e.b);
}

/**
 * Synthesize sessions: delete any existing non-home completed sessions for the
 * user (handles stray prior data + reruns at different home picks), then INSERT
 * SYNTHETIC_SESSIONS_PER_USER rows at the chosen home breaks with arrival_time
 * spread across the EF retention window. Trigger auto-creates SFS rows.
 */
async function phase1SynthesizeSessions(
  user: CohortMember,
  stevenId: string,
  pool: BeachPoolEntry[]
): Promise<PhaseOneResult> {
  const home = pickHomeBreaksForUser(user.user_id, pool);
  const homeIds = home.map((h) => h.id);

  // Existing completed sessions (count for reporting)
  const { data: existingSessions, error } = await supabase
    .from("sessions")
    .select("id, beach_id, notes")
    .eq("user_id", user.user_id)
    .eq("status", "completed")
    .is("deleted_at", null);
  if (error) throw new Error(`phase1 list sessions: ${error.message}`);
  const before = existingSessions?.length ?? 0;
  const nonHome = (existingSessions ?? []).filter((s) => !homeIds.includes(s.beach_id));
  const homeAlready = (existingSessions ?? []).filter((s) =>
    homeIds.includes(s.beach_id)
  );
  const syntheticAlready = homeAlready.filter((s) =>
    typeof s.notes === "string" && s.notes.startsWith(SYNTHETIC_SESSION_NOTES_PREFIX)
  );
  let deleted = 0;

  // 1. DELETE non-home sessions (the 20-ish strays + any prior synthetic at
  //    different home picks).
  if (nonHome.length > 0) {
    if (DRY_RUN) {
      deleted = nonHome.length;
    } else {
      const { error: delErr } = await supabase
        .from("sessions")
        .delete()
        .eq("user_id", user.user_id)
        .eq("status", "completed")
        .is("deleted_at", null)
        .not("beach_id", "in", `(${homeIds.join(",")})`);
      if (delErr) throw new Error(`phase1 delete: ${delErr.message}`);
      deleted = nonHome.length;
    }
  }

  // 2. INSERT SYNTHETIC_SESSIONS_PER_USER synthetic sessions at home breaks.
  // Use highest existing index + 1 as the starting offset so notes don't collide
  // with prior runs that left some synthetic sessions in place.
  const target = SYNTHETIC_SESSIONS_PER_USER;
  const toAdd = Math.max(0, target - syntheticAlready.length);
  const usedIndexes = new Set<number>();
  for (const s of syntheticAlready) {
    const m = (s.notes ?? "").match(/^reseed-mock-synthetic:(\d+)$/);
    if (m) usedIndexes.add(parseInt(m[1], 10));
  }
  const newRows: Array<Record<string, unknown>> = [];
  let nextIdx = 0;

  // 60% home1, 40% home2
  for (let n = 0; n < toAdd; n++) {
    while (usedIndexes.has(nextIdx)) nextIdx++;
    const idx = nextIdx;
    usedIndexes.add(idx);
    const idxStr = String(idx);
    const homeIdx = seedFloat([user.user_id, idxStr], "home-split") < 0.6 ? 0 : 1;
    const beachId = homeIds[Math.min(homeIdx, homeIds.length - 1)];
    const dayOffset = seedFloat([user.user_id, idxStr], "syn-day") * SYNTHETIC_DAYS_BACK;
    const hourOffset = Math.floor(seedFloat([user.user_id, idxStr], "syn-hour") * 12);
    const minuteOffset = Math.floor(seedFloat([user.user_id, idxStr], "syn-min") * 60);
    const t = new Date(Date.now() - Math.floor(dayOffset * 86400 * 1000));
    t.setUTCHours(6 + hourOffset, minuteOffset, 0, 0);
    const durationSeed = seedFloat([user.user_id, idxStr], "syn-dur");
    const duration = 45 + Math.floor(durationSeed * 90); // 45–135 min
    newRows.push({
      user_id: user.user_id,
      beach_id: beachId,
      arrival_time: t.toISOString(),
      duration_minutes: duration,
      status: "completed",
      notes: `${SYNTHETIC_SESSION_NOTES_PREFIX}:${idx}`,
      is_public: false,
    });
  }

  let inserted = 0;
  if (DRY_RUN) {
    inserted = newRows.length;
  } else if (newRows.length > 0) {
    const { error: insErr } = await supabase.from("sessions").insert(newRows);
    if (insErr) throw new Error(`phase1 synth insert: ${insErr.message}`);
    inserted = newRows.length;
  }

  return {
    user_id: user.user_id,
    before,
    deleted,
    inserted,
    beaches: homeIds,
  };
}

// ─────────────────────────────────────────────────────── phase 2 ─────────────

interface PhaseTwoStats {
  rated: number;
  withWave: number;
  withWind: number;
  withTide: number;
  diffsWritten: number;
  ratingHistogram: Record<number, number>;
}

async function phase2BackfillConditions(
  user: CohortMember,
  stevenId: string
): Promise<PhaseTwoStats> {
  const stats: PhaseTwoStats = {
    rated: 0,
    withWave: 0,
    withWind: 0,
    withTide: 0,
    diffsWritten: 0,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  // Pull sessions and SFS in two separate queries — the nested-embed PostgREST
  // syntax silently returns empty arrays for one-to-one joins in this codebase.
  const { data: rows, error } = await supabase
    .from("sessions")
    .select("id, beach_id, arrival_time")
    .eq("user_id", user.user_id)
    .eq("status", "completed")
    .is("deleted_at", null);
  if (error) throw new Error(`phase2 list sessions: ${error.message}`);

  const sessionIds = (rows ?? []).map((r) => r.id);
  const sfsBySession = new Map<string, Record<string, unknown> | null>();
  if (sessionIds.length > 0) {
    const { data: sfsRows, error: sfsErr } = await supabase
      .from("session_forecast_snapshots")
      .select("session_id, forecast_snapshot")
      .in("session_id", sessionIds);
    if (sfsErr) throw new Error(`phase2 list sfs: ${sfsErr.message}`);
    for (const r of sfsRows ?? []) {
      sfsBySession.set(
        r.session_id,
        r.forecast_snapshot as Record<string, unknown> | null
      );
    }
  }

  for (const row of rows ?? []) {
    const snapshot = sfsBySession.get(row.id) ?? null;
    const parsed = parseForecastSnapshot(snapshot);

    // Perturb (deterministic per-session)
    const wave =
      parsed.wave_height_ft !== null
        ? Math.max(
            0,
            Math.round(
              (parsed.wave_height_ft +
                seedGaussian([user.user_id, row.id], "wave", 0.5)) *
                10
            ) / 10
          )
        : null;
    const wind =
      parsed.wind_speed_mph !== null
        ? Math.max(
            0,
            Math.round(
              parsed.wind_speed_mph + seedGaussian([user.user_id, row.id], "wind", 2)
            )
          )
        : null;
    const water =
      parsed.water_temp !== null
        ? Math.round((parsed.water_temp + seedGaussian([user.user_id, row.id], "water", 2)) * 2) / 2
        : null;
    const tideHt =
      parsed.tide_height_ft !== null
        ? Math.round(
            (parsed.tide_height_ft + seedGaussian([user.user_id, row.id], "tide", 0.3)) * 10
          ) / 10
        : null;

    const ratingSeed = seedFloat([user.user_id, row.id], "rating");
    const rating = pickRating(ratingSeed);
    const wqJitter = (seedFloat([user.user_id, row.id], "wq") - 0.5) * 2; // [-1, +1]
    const waveQuality = clamp(Math.round(rating + wqJitter), 1, 5);

    stats.ratingHistogram[rating]++;
    if (wave !== null) stats.withWave++;
    if (wind !== null) stats.withWind++;
    if (parsed.tide_status) stats.withTide++;
    stats.rated++;

    if (DRY_RUN) continue;

    // 1. UPDATE session — trigger fires & merges actual_conditions, overwrites
    //    forecast_vs_actual with mostly-empty (broken cast).
    const { error: updErr } = await supabase
      .from("sessions")
      .update({
        rating,
        wave_quality: waveQuality,
        wave_height_ft: wave,
        wind_speed_mph: wind,
        wind_direction: parsed.wind_direction,
        water_temp: water,
        tide_height_ft: tideHt,
        tide_status: parsed.tide_status,
      })
      .eq("id", row.id)
      .eq("user_id", user.user_id);
    if (updErr) throw new Error(`phase2 session update ${row.id}: ${updErr.message}`);

    // 2. Compute synthetic diff and overwrite SFS.forecast_vs_actual.
    const diff: Record<string, unknown> = {};
    if (parsed.wave_height_ft !== null && wave !== null) {
      diff.wave_height_ft = {
        forecast: parsed.wave_height_ft,
        actual: wave,
        diff: Math.round((wave - parsed.wave_height_ft) * 100) / 100,
      };
    }
    if (parsed.wind_speed_mph !== null && wind !== null) {
      diff.wind_speed_mph = {
        forecast: parsed.wind_speed_mph,
        actual: wind,
        diff: wind - parsed.wind_speed_mph,
      };
    }
    if (parsed.water_temp !== null && water !== null) {
      diff.water_temp = {
        forecast: parsed.water_temp,
        actual: water,
        diff: Math.round((water - parsed.water_temp) * 10) / 10,
      };
    }
    if (parsed.tide_height_ft !== null && tideHt !== null) {
      diff.tide_height_ft = {
        forecast: parsed.tide_height_ft,
        actual: tideHt,
        diff: Math.round((tideHt - parsed.tide_height_ft) * 100) / 100,
      };
    }
    // wind_direction and tide_status are categorical — left unperturbed, no diff.

    if (Object.keys(diff).length > 0) {
      const { error: sfsErr } = await supabase
        .from("session_forecast_snapshots")
        .update({ forecast_vs_actual: diff })
        .eq("session_id", row.id);
      if (sfsErr) {
        // Non-fatal: SFS row may be missing for clone sessions where the trigger
        // EF lookup missed. Log and continue.
        if (VERBOSE) {
          console.warn(`    skip diff for ${row.id}: ${sfsErr.message}`);
        }
      } else {
        stats.diffsWritten++;
      }
    }
  }

  return stats;
}

// ─────────────────────────────────────────────────────── phase 3 ─────────────

interface PhaseThreeStats {
  inserted: number;
  byType: Record<string, number>;
}

function pickHomeBiased(
  homes: string[],
  homeWeights: number[],
  others: string[],
  otherShare: number,
  seed: number
): string {
  if (homes.length === 0 && others.length === 0) return "";
  const u = seed;
  const homeBudget = 1 - otherShare;
  if (u < homeBudget) {
    // Pick a home by weight
    const sumW = homeWeights.reduce((a, b) => a + b, 0) || 1;
    let cum = 0;
    const x = (u / homeBudget) * sumW;
    for (let i = 0; i < homes.length; i++) {
      cum += homeWeights[i];
      if (x <= cum) return homes[i];
    }
    return homes[homes.length - 1];
  }
  if (others.length === 0) return homes[0] ?? "";
  const idx = Math.floor(((u - homeBudget) / otherShare) * others.length);
  return others[Math.min(idx, others.length - 1)];
}

async function phase3SeedEvents(
  user: CohortMember,
  homeBeaches: string[]
): Promise<PhaseThreeStats> {
  const stats: PhaseThreeStats = { inserted: 0, byType: {} };
  if (homeBeaches.length === 0) return stats;

  // Pull a few non-home beach ids the user might "discover/skip"
  const { data: otherBeaches } = await supabase
    .from("beaches")
    .select("id")
    .not("id", "in", `(${homeBeaches.join(",")})`)
    .limit(10);
  const others = (otherBeaches ?? [])
    .map((r) => r.id as string)
    .slice(0, 5);

  const rows: Array<Record<string, unknown>> = [];
  const now = Date.now();

  for (const [eventType, count] of Object.entries(EVENT_PLAN)) {
    for (let i = 0; i < count; i++) {
      let beachId: string;
      if (eventType === "location_update") {
        beachId = homeBeaches[i % homeBeaches.length] ?? homeBeaches[0];
      } else if (eventType === "discovery_click") {
        beachId = homeBeaches[0];
      } else if (eventType === "discovery_skip") {
        const u = seedFloat([user.user_id, eventType, String(i)], "skip");
        beachId = others.length > 0 ? others[Math.floor(u * others.length)] : homeBeaches[1] ?? homeBeaches[0];
      } else if (eventType === "forecast_check") {
        const u = seedFloat([user.user_id, eventType, String(i)], "fc");
        // 70% home1, 30% home2
        beachId = u < 0.7 ? homeBeaches[0] : (homeBeaches[1] ?? homeBeaches[0]);
      } else {
        // beach_view: 50% home1, 30% home2, 20% other
        const u = seedFloat([user.user_id, eventType, String(i)], "bv");
        beachId = pickHomeBiased(homeBeaches, [0.5, 0.3], others, 0.2, u);
      }

      const ageDaysSeed = seedFloat([user.user_id, eventType, String(i)], "age");
      const ageMs = ageDaysSeed * 14 * 86400 * 1000;
      const created = new Date(now - ageMs).toISOString();

      rows.push({
        user_id: user.user_id,
        event_type: eventType,
        beach_id: beachId,
        created_at: created,
        metadata: { source: "reseed-mock", planned_share: eventType },
      });
      stats.byType[eventType] = (stats.byType[eventType] ?? 0) + 1;
    }
  }

  if (DRY_RUN) {
    stats.inserted = rows.length;
    return stats;
  }

  // Bulk insert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const { error } = await supabase.from("user_events").insert(slice);
    if (error) throw new Error(`phase3 insert: ${error.message}`);
    stats.inserted += slice.length;
  }
  return stats;
}

// ─────────────────────────────────────────────────────── verification ───────

async function runVerify(stevenId: string): Promise<void> {
  console.log("\n=== Verification ===");

  const { data: cohort } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_mock", true)
    .neq("id", stevenId);
  const cohortIds = (cohort ?? []).map((r) => r.id as string);
  console.log(`Cohort size: ${cohortIds.length}`);

  // 1. Beach concentration + session count + avg rating
  const { data: distRows } = await supabase
    .from("sessions")
    .select("user_id, beach_id, rating, status, deleted_at")
    .in("user_id", cohortIds)
    .eq("status", "completed")
    .is("deleted_at", null);
  const byUser = new Map<string, { beaches: Set<string>; total: number; ratingSum: number; rated: number }>();
  for (const r of distRows ?? []) {
    const u = r.user_id;
    const acc = byUser.get(u) ?? { beaches: new Set<string>(), total: 0, ratingSum: 0, rated: 0 };
    acc.beaches.add(r.beach_id);
    acc.total++;
    if (typeof r.rating === "number") {
      acc.ratingSum += r.rating;
      acc.rated++;
    }
    byUser.set(u, acc);
  }
  let userPass = 0;
  let userFail = 0;
  for (const [, v] of byUser) {
    const ok =
      v.beaches.size <= HOME_BREAK_COUNT &&
      v.total >= SYNTHETIC_SESSIONS_PER_USER &&
      v.rated > 0 &&
      v.ratingSum / v.rated >= 2.7 &&
      v.ratingSum / v.rated <= 3.8;
    if (ok) userPass++;
    else userFail++;
  }
  console.log(`[1] Per-user shape: ${userPass} pass, ${userFail} fail (target: all pass)`);

  // 2. Conditions populated (non-null)
  const total = distRows?.length ?? 0;
  const { data: condRows } = await supabase
    .from("sessions")
    .select("wave_height_ft, wind_speed_mph, tide_status, rating")
    .in("user_id", cohortIds)
    .eq("status", "completed")
    .is("deleted_at", null);
  const cond = condRows ?? [];
  const wave = cond.filter((r) => r.wave_height_ft !== null).length;
  const wind = cond.filter((r) => r.wind_speed_mph !== null).length;
  const tide = cond.filter((r) =>
    ["rising", "falling", "high", "low"].includes(r.tide_status ?? "")
  ).length;
  const rated = cond.filter((r) => r.rating !== null).length;
  console.log(
    `[2] Non-null conditions: ${total} total | wave=${wave} wind=${wind} tide=${tide} rated=${rated}`
  );

  // 3. SFS sync + diff numerics
  const { data: sfsRows } = await supabase
    .from("session_forecast_snapshots")
    .select("session_id, actual_conditions, forecast_vs_actual")
    .in("user_id", cohortIds);
  const sfsTotal = sfsRows?.length ?? 0;
  let actualWave = 0;
  let diffWave = 0;
  let diffNumeric = 0;
  for (const r of sfsRows ?? []) {
    const ac = r.actual_conditions as Record<string, unknown> | null;
    const fa = r.forecast_vs_actual as Record<string, unknown> | null;
    if (ac && "wave_height_ft" in ac && ac.wave_height_ft !== null && ac.wave_height_ft !== undefined) {
      actualWave++;
    }
    if (fa && "wave_height_ft" in fa) {
      diffWave++;
      const sub = fa.wave_height_ft as Record<string, unknown>;
      if (sub && typeof sub.diff === "number") diffNumeric++;
    }
  }
  console.log(
    `[3] SFS: ${sfsTotal} rows | actual_wave=${actualWave} diff_wave=${diffWave} diff_wave_numeric=${diffNumeric}`
  );

  // 4. Events seeded with top-level beach_id
  const { data: evRows } = await supabase
    .from("user_events")
    .select("event_type, beach_id")
    .in("user_id", cohortIds)
    .in("event_type", Object.keys(EVENT_PLAN));
  const byType = new Map<string, { rows: number; withBeach: number }>();
  for (const r of evRows ?? []) {
    const acc = byType.get(r.event_type) ?? { rows: 0, withBeach: 0 };
    acc.rows++;
    if (r.beach_id) acc.withBeach++;
    byType.set(r.event_type, acc);
  }
  console.log(`[4] Events:`);
  for (const [t, v] of byType) {
    console.log(`    ${t}: ${v.rows} rows | ${v.withBeach} with beach_id`);
  }

  // 5. Implicit-prefs RPC works (single-user). Runs on any target; DEV may
  // surface "RPC error: column b.center_lat does not exist" if Phase A migration
  // (20260502171735) hasn't been applied — that's the regression test.
  if (cohortIds.length > 0) {
    const sample = cohortIds[0];
    try {
      const { data: rpcResult, error: rpcErr } = await (supabase.rpc as any)(
        "compute_implicit_preferences",
        { target_user_id: sample }
      );
      if (rpcErr) {
        console.log(`[5] RPC error: ${rpcErr.message}`);
      } else {
        console.log(`[5] RPC processed=${rpcResult}`);
        const { data: ip } = await supabase
          .from("user_implicit_preferences")
          .select(
            "location_centroid_lat, location_centroid_lon, break_type_weights, top_engaged_beach_ids, confidence, event_count"
          )
          .eq("user_id", sample)
          .maybeSingle();
        const ok =
          ip &&
          ip.location_centroid_lat !== null &&
          ip.location_centroid_lon !== null &&
          (ip.confidence ?? 0) > 0;
        console.log(`    centroid_lat=${ip?.location_centroid_lat} centroid_lon=${ip?.location_centroid_lon} confidence=${ip?.confidence} pass=${ok}`);
      }
    } catch (e) {
      console.log(`[5] RPC threw: ${(e as Error).message}`);
    }
  } else {
    console.log("[5] RPC verification skipped (cohort empty)");
  }
}

// ─────────────────────────────────────────────────────── main ────────────────

async function main(): Promise<void> {
  console.log("=== Mock Cohort Re-seed ===");
  console.log(`Target: ${TARGET}, dry-run: ${DRY_RUN}, verify-only: ${VERIFY_ONLY}\n`);

  const stevenId = await findStevenId();
  console.log(`Steven (excluded): ${stevenId}`);

  const cohort = await selectCohort(stevenId);
  console.log(`Cohort: ${cohort.length} users\n`);

  if (VERIFY_ONLY) {
    await runVerify(stevenId);
    return;
  }

  const cohortIds = cohort.map((c) => c.user_id);

  console.log("--- Phase 0: pre-clear derived rows ---");
  await preClearDerived(cohortIds, stevenId);

  console.log("\n--- Phase 0.5: build home-break pool (well-covered beaches) ---");
  const pool = await findHomeBreakPool();
  console.log(`  pool (${pool.length} beaches): ${pool.map((b) => b.name).join(", ")}`);

  console.log("\n--- Phase 1: synthesize sessions at 2 home breaks per user ---");
  const phase1Results: PhaseOneResult[] = [];
  for (const u of cohort) {
    const r = await phase1SynthesizeSessions(u, stevenId, pool);
    phase1Results.push(r);
    if (VERBOSE) {
      console.log(
        `  ${u.display_name ?? u.user_id}: had ${r.before} | deleted ${r.deleted} non-home | inserted ${r.inserted} synthetic`
      );
    }
  }

  console.log("\n--- Phase 2: backfill conditions + write SFS diffs ---");
  const phase2Totals = { rated: 0, withWave: 0, withWind: 0, withTide: 0, diffsWritten: 0, hist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number> };
  for (const u of cohort) {
    const stats = await phase2BackfillConditions(u, stevenId);
    phase2Totals.rated += stats.rated;
    phase2Totals.withWave += stats.withWave;
    phase2Totals.withWind += stats.withWind;
    phase2Totals.withTide += stats.withTide;
    phase2Totals.diffsWritten += stats.diffsWritten;
    for (const r of [1, 2, 3, 4, 5]) phase2Totals.hist[r] += stats.ratingHistogram[r];
  }
  console.log(
    `  rated=${phase2Totals.rated} wave=${phase2Totals.withWave} wind=${phase2Totals.withWind} tide=${phase2Totals.withTide} diffs=${phase2Totals.diffsWritten}`
  );
  console.log(
    `  rating histogram: r1=${phase2Totals.hist[1]} r2=${phase2Totals.hist[2]} r3=${phase2Totals.hist[3]} r4=${phase2Totals.hist[4]} r5=${phase2Totals.hist[5]}`
  );

  console.log("\n--- Phase 3: seed user_events ---");
  let totalEvents = 0;
  for (let i = 0; i < cohort.length; i++) {
    const u = cohort[i];
    const r = phase1Results[i];
    if (r.beaches.length === 0) continue;
    const stats = await phase3SeedEvents(u, r.beaches);
    totalEvents += stats.inserted;
  }
  console.log(`  inserted ${totalEvents} events`);

  console.log("\n--- Verification ---");
  await runVerify(stevenId);

  console.log(DRY_RUN ? "\n[dry-run complete — no writes performed]" : "\n[live run complete]");
}

main().catch((err) => {
  console.error("\n❌ Re-seed failed:", err);
  process.exit(1);
});
