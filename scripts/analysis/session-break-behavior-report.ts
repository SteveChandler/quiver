#!/usr/bin/env tsx
/**
 * Read-only session/break behavior report.
 *
 * Usage:
 *   yarn tsx scripts/analysis/session-break-behavior-report.ts --days 365
 *   yarn tsx scripts/analysis/session-break-behavior-report.ts --start 2025-06-20 --end 2026-06-20 --output-json /tmp/quiver-session-break-behavior.json
 *
 * Safety:
 * - Reads only from Supabase.
 * - Filters mock/system/deleted profiles when profile rows are available.
 * - Never prints names, emails, avatars, notes, photo URLs, board names, or raw user IDs.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../../types/database.generated";

config({ path: ".env.local" });
config({ path: ".env.production.local" });
config();

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 400;
const DEFAULT_DAYS = 365;
const DEFAULT_MIN_SESSIONS = 5;
const DEFAULT_TOP = 15;
const MS_PER_DAY = 86_400_000;
const LOW_CONFIDENCE_THRESHOLD = 55;
const HIGH_CONFIDENCE_THRESHOLD = 70;
const LOW_COMPLETION_RATE_THRESHOLD = 0.35;

interface CliOptions {
  start: string;
  end: string;
  days: number;
  minSessions: number;
  top: number;
  outputJsonPath: string | null;
}

interface ProfileRow {
  id: string;
  deleted_at: string | null;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
}

interface SessionRow {
  id: string;
  beach_id: string | null;
  user_id: string | null;
  status: string | null;
  arrival_time: string | null;
  created_at: string | null;
  board_id: string | null;
  rating: number | null;
  wave_height_ft: number | null;
  wave_quality: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  tide_height_ft: number | null;
  tide_status: string | null;
  forecast_accuracy: string | null;
  deleted_at: string | null;
}

interface BeachRow {
  id: string;
  name: string;
  region: string | null;
  state: string | null;
  timezone: string | null;
  break_type: string | null;
  skill_level: string | null;
  aspect_deg: number | null;
  swell_window_min_deg: number | null;
  swell_window_max_deg: number | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  wind_cross_shore_ok_kt: number | null;
  wind_onshore_bad_kt: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  terrain_enabled: boolean | null;
  cdip_station: string | null;
  cdip_eligible: boolean | null;
  nws_forecast_zone: string | null;
  swell_access_factors: number[] | null;
  wind_exposure_factors: number[] | null;
}

interface SnapshotRow {
  session_id: string;
  beach_id: string;
  forecast_confidence_score: number | null;
  data_source: string | null;
  forecast_snapshot: Json;
  forecast_vs_actual: Json | null;
}

interface ReviewRow {
  beach_id: string;
  overall_rating: number | null;
  wave_quality_rating: number | null;
  crowd_density_rating: number | null;
  deleted_at: string | null;
}

interface BoardRow {
  id: string;
  board_type: string | null;
  volume: number | null;
}

interface FavoriteRow {
  beach_id: string | null;
  user_id: string | null;
  alerts_enabled: boolean | null;
  created_at: string | null;
}

interface BreakRankingRow {
  beachId: string;
  break: string;
  region: string | null;
  planned: number;
  completed: number;
  completionRate: number | null;
  uniqueUsers: number;
  firstTimeUsers: number;
  repeatUsers: number;
  repeatCompletedSessionUsers: number;
  averageSessionsPerUser: number | null;
  favoriteUsers: number;
  alertsEnabledFavorites: number;
  averageSessionRating: number | null;
  averageWaveQuality: number | null;
  averageForecastConfidence: number | null;
  averageCompletedForecastConfidence: number | null;
  snapshotCoverageRate: number | null;
  completedLowConfidenceSessions: number;
  commonSessionTimes: string;
  commonConditions: string;
  boardUseSummary: string;
  reviewSummary: string;
  recommendationNote: string;
  confidenceLabel: "sparse" | "low" | "medium" | "high";
}

interface Report {
  generatedAt: string;
  range: {
    start: string;
    end: string;
    days: number;
  };
  filters: {
    minSessions: number;
    lowConfidenceThreshold: number;
    excludedMockOrSystemRows: number;
  };
  summary: {
    rawSessions: number;
    includedSessions: number;
    completedSessions: number;
    uniqueBreaks: number;
    uniqueUsers: number;
    snapshotRows: number;
    snapshotCoverageRate: number | null;
  };
  rankedBreaks: BreakRankingRow[];
  topBreaksByIntent: BreakRankingRow[];
  topBreaksByCompleted: BreakRankingRow[];
  topBreaksByCompletionRate: BreakRankingRow[];
  topBreaksByRepeatCompletedUsers: BreakRankingRow[];
  highIntentLowCompletionBreaks: BreakRankingRow[];
  lowConfidenceCompletedBreaks: BreakRankingRow[];
  sparseBreaks: BreakRankingRow[];
}

interface MutableBreakAggregate {
  beachId: string;
  totalSessions: number;
  completedSessions: number;
  users: Set<string>;
  userCounts: Map<string, number>;
  completedUserCounts: Map<string, number>;
  statusCounts: Map<string, number>;
  ratings: number[];
  waveQualityRatings: number[];
  forecastConfidence: number[];
  completedForecastConfidence: number[];
  completedLowConfidenceSessions: number;
  snapshotCount: number;
  dayCounts: Map<string, number>;
  hourCounts: Map<string, number>;
  allConditions: ConditionCounts;
  completedConditions: ConditionCounts;
  boardTypes: Map<string, number>;
  reviewOverallRatings: number[];
  reviewWaveQualityRatings: number[];
  favoriteUsers: Set<string>;
  alertsEnabledFavoriteUsers: Set<string>;
}

interface ConditionCounts {
  waveHeight: Map<string, number>;
  wavePeriod: Map<string, number>;
  swellDirection: Map<string, number>;
  windSpeed: Map<string, number>;
  windDirection: Map<string, number>;
  tideStatus: Map<string, number>;
}

type Supabase = SupabaseClient<Database>;

function parseCliArgs(argv: string[], now: Date = new Date()): CliOptions {
  let days = DEFAULT_DAYS;
  let start: string | null = null;
  let end = now.toISOString();
  let minSessions = DEFAULT_MIN_SESSIONS;
  let top = DEFAULT_TOP;
  let outputJsonPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      printUsageAndExit();
    }

    if (arg === "--days" && next) {
      days = parsePositiveInteger(next, "--days");
      index += 1;
      continue;
    }

    if (arg === "--start" && next) {
      start = new Date(next).toISOString();
      index += 1;
      continue;
    }

    if (arg === "--end" && next) {
      end = new Date(next).toISOString();
      index += 1;
      continue;
    }

    if (arg === "--min-sessions" && next) {
      minSessions = parsePositiveInteger(next, "--min-sessions");
      index += 1;
      continue;
    }

    if (arg === "--top" && next) {
      top = parsePositiveInteger(next, "--top");
      index += 1;
      continue;
    }

    if (arg === "--output-json" && next) {
      outputJsonPath = next;
      index += 1;
      continue;
    }
  }

  if (!start) {
    start = new Date(new Date(end).getTime() - days * MS_PER_DAY).toISOString();
  } else {
    days = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / MS_PER_DAY));
  }

  return {
    start,
    end,
    days,
    minSessions,
    top,
    outputJsonPath,
  };
}

function printUsageAndExit(): never {
  console.log(`Read-only Quiver session/break behavior report

Usage:
  yarn tsx scripts/analysis/session-break-behavior-report.ts --days 365
  yarn tsx scripts/analysis/session-break-behavior-report.ts --start 2025-06-20 --end 2026-06-20 --output-json /tmp/quiver-session-break-behavior.json

Options:
  --days N            Lookback window ending now. Default: 365
  --start DATE        Inclusive start timestamp/date.
  --end DATE          Exclusive end timestamp/date. Default: now
  --min-sessions N    Minimum intent sessions for rate-based rankings. Default: 5
  --top N             Number of rows in each stdout table. Default: 15
  --output-json PATH  Write full aggregate report JSON.
`);
  process.exit(0);
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function createAdminClient(): Supabase {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey);
}

async function fetchPaged<T>(
  queryFactory: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function fetchSessions(
  supabase: Supabase,
  options: CliOptions
): Promise<SessionRow[]> {
  return fetchPaged<SessionRow>((from, to) =>
    supabase
      .from("sessions")
      .select(
        [
          "id",
          "beach_id",
          "user_id",
          "status",
          "arrival_time",
          "created_at",
          "board_id",
          "rating",
          "wave_height_ft",
          "wave_quality",
          "wind_speed_mph",
          "wind_direction",
          "tide_height_ft",
          "tide_status",
          "forecast_accuracy",
          "deleted_at",
        ].join(",")
      )
      .is("deleted_at", null)
      .not("beach_id", "is", null)
      .gte("created_at", options.start)
      .lt("created_at", options.end)
      .order("created_at", { ascending: true })
      .range(from, to)
      .then((result) => ({
        data: (result.data ?? null) as SessionRow[] | null,
        error: result.error,
      }))
  );
}

async function fetchProfilesByIds(
  supabase: Supabase,
  userIds: string[]
): Promise<Map<string, ProfileRow>> {
  const profileRows: ProfileRow[] = [];
  for (const chunk of chunks(userIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,deleted_at,is_mock,analytics_is_real_user,is_system_account"
      )
      .in("id", chunk);
    if (error) {
      throw new Error(error.message);
    }
    profileRows.push(...((data ?? []) as ProfileRow[]));
  }

  return new Map(profileRows.map((profile) => [profile.id, profile]));
}

async function fetchBeachesByIds(
  supabase: Supabase,
  beachIds: string[]
): Promise<Map<string, BeachRow>> {
  const rows: BeachRow[] = [];
  for (const chunk of chunks(beachIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("beaches")
      .select(
        [
          "id",
          "name",
          "region",
          "state",
          "timezone",
          "break_type",
          "skill_level",
          "aspect_deg",
          "swell_window_min_deg",
          "swell_window_max_deg",
          "wind_offshore_deg",
          "wind_offshore_tol_deg",
          "wind_cross_shore_ok_kt",
          "wind_onshore_bad_kt",
          "preferred_tide_ft_min",
          "preferred_tide_ft_max",
          "preferred_tide_direction",
          "terrain_enabled",
          "cdip_station",
          "cdip_eligible",
          "nws_forecast_zone",
          "swell_access_factors",
          "wind_exposure_factors",
        ].join(",")
      )
      .in("id", chunk);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...((data ?? []) as unknown as BeachRow[]));
  }

  return new Map(rows.map((row) => [row.id, row]));
}

async function fetchSnapshotsBySessionIds(
  supabase: Supabase,
  sessionIds: string[]
): Promise<Map<string, SnapshotRow>> {
  const rows: SnapshotRow[] = [];
  for (const chunk of chunks(sessionIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("session_forecast_snapshots")
      .select(
        "session_id,beach_id,forecast_confidence_score,data_source,forecast_snapshot,forecast_vs_actual"
      )
      .in("session_id", chunk);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...((data ?? []) as SnapshotRow[]));
  }

  return new Map(rows.map((row) => [row.session_id, row]));
}

async function fetchReviewsByBeachIds(
  supabase: Supabase,
  beachIds: string[]
): Promise<ReviewRow[]> {
  const rows: ReviewRow[] = [];
  for (const chunk of chunks(beachIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("beach_reviews")
      .select("beach_id,overall_rating,wave_quality_rating,crowd_density_rating,deleted_at")
      .in("beach_id", chunk)
      .is("deleted_at", null);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...((data ?? []) as ReviewRow[]));
  }
  return rows;
}

async function fetchBoardsByIds(
  supabase: Supabase,
  boardIds: string[]
): Promise<Map<string, BoardRow>> {
  const rows: BoardRow[] = [];
  for (const chunk of chunks(boardIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("boards")
      .select("id,board_type,volume")
      .in("id", chunk);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...((data ?? []) as BoardRow[]));
  }
  return new Map(rows.map((row) => [row.id, row]));
}

async function fetchFavoritesByBeachIds(
  supabase: Supabase,
  beachIds: string[],
  start: string,
  end: string
): Promise<FavoriteRow[]> {
  const rows: FavoriteRow[] = [];
  for (const chunk of chunks(beachIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("favorite_beaches")
      .select("beach_id,user_id,alerts_enabled,created_at")
      .in("beach_id", chunk)
      .gte("created_at", start)
      .lt("created_at", end);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...((data ?? []) as FavoriteRow[]));
  }
  return rows;
}

function chunks<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isRealProfile(profile: ProfileRow | undefined): boolean {
  if (!profile) return true;
  if (profile.deleted_at !== null) return false;
  if (profile.is_mock === true) return false;
  if (profile.analytics_is_real_user === false) return false;
  if (profile.is_system_account === true) return false;
  return true;
}

function makeConditionCounts(): ConditionCounts {
  return {
    waveHeight: new Map(),
    wavePeriod: new Map(),
    swellDirection: new Map(),
    windSpeed: new Map(),
    windDirection: new Map(),
    tideStatus: new Map(),
  };
}

function makeAggregate(beachId: string): MutableBreakAggregate {
  return {
    beachId,
    totalSessions: 0,
    completedSessions: 0,
    users: new Set(),
    userCounts: new Map(),
    completedUserCounts: new Map(),
    statusCounts: new Map(),
    ratings: [],
    waveQualityRatings: [],
    forecastConfidence: [],
    completedForecastConfidence: [],
    completedLowConfidenceSessions: 0,
    snapshotCount: 0,
    dayCounts: new Map(),
    hourCounts: new Map(),
    allConditions: makeConditionCounts(),
    completedConditions: makeConditionCounts(),
    boardTypes: new Map(),
    reviewOverallRatings: [],
    reviewWaveQualityRatings: [],
    favoriteUsers: new Set(),
    alertsEnabledFavoriteUsers: new Set(),
  };
}

function increment(map: Map<string, number>, key: string | null | undefined): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pushFinite(values: number[], value: number | null | undefined): void {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  values.push(value);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

function round(value: number, decimals = 1): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function numericFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function snapshotRecord(snapshot: SnapshotRow | undefined): Record<string, unknown> {
  const value = snapshot?.forecast_snapshot;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function snapshotNumber(
  snapshot: SnapshotRow | undefined,
  keys: string[]
): number | null {
  const record = snapshotRecord(snapshot);
  for (const key of keys) {
    const parsed = numericFromUnknown(record[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function snapshotString(
  snapshot: SnapshotRow | undefined,
  keys: string[]
): string | null {
  const record = snapshotRecord(snapshot);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function waveHeightBucket(value: number | null): string | null {
  if (value === null) return null;
  if (value < 2) return "<2ft";
  if (value < 3) return "2-3ft";
  if (value < 4) return "3-4ft";
  if (value < 6) return "4-6ft";
  return "6ft+";
}

function windSpeedBucket(value: number | null): string | null {
  if (value === null) return null;
  if (value <= 5) return "0-5mph";
  if (value <= 10) return "6-10mph";
  if (value <= 15) return "11-15mph";
  return "16mph+";
}

function periodBucket(value: number | null): string | null {
  if (value === null) return null;
  if (value < 8) return "<8s";
  if (value < 12) return "8-11s";
  if (value < 16) return "12-15s";
  return "16s+";
}

function directionBucket(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = numericFromUnknown(trimmed);
  if (numeric !== null) {
    const normalized = ((numeric % 360) + 360) % 360;
    const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(normalized / 45) % 8;
    return labels[index];
  }
  return trimmed.toUpperCase();
}

function tideBucket(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function addConditionCounts(
  counts: ConditionCounts,
  session: SessionRow,
  snapshot: SnapshotRow | undefined
): void {
  const waveHeight =
    session.wave_height_ft ?? snapshotNumber(snapshot, ["wave_height", "wave_height_ft"]);
  const wavePeriod = snapshotNumber(snapshot, [
    "wave_period",
    "swell_1_period",
    "swell_period",
  ]);
  const swellDirection = snapshotString(snapshot, [
    "swell_1_direction",
    "swell_direction",
    "wave_direction",
  ]);
  const windSpeed =
    session.wind_speed_mph ?? snapshotNumber(snapshot, ["wind_speed_mph", "wind_speed"]);
  const windDirection =
    session.wind_direction ??
    snapshotString(snapshot, ["wind_direction", "wind_direction_deg"]);
  const tideStatus =
    session.tide_status ?? snapshotString(snapshot, ["tide_status"]);

  increment(counts.waveHeight, waveHeightBucket(waveHeight));
  increment(counts.wavePeriod, periodBucket(wavePeriod));
  increment(counts.swellDirection, directionBucket(swellDirection));
  increment(counts.windSpeed, windSpeedBucket(windSpeed));
  increment(counts.windDirection, directionBucket(windDirection));
  increment(counts.tideStatus, tideBucket(tideStatus));
}

function localParts(
  timestamp: string | null,
  timezone: string | null | undefined
): { day: string | null; hour: string | null } {
  if (!timestamp) {
    return { day: null, hour: null };
  }

  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return { day: null, hour: null };
  }

  const resolvedTimezone = timezone || "UTC";
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimezone,
    weekday: "short",
  }).format(date);
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimezone,
    hour: "2-digit",
    hour12: false,
  }).format(date);

  return { day, hour: `${hour}:00` };
}

function isCompleted(session: SessionRow): boolean {
  return session.status === "completed";
}

function confidenceLabel(
  totalSessions: number,
  completedSessions: number
): BreakRankingRow["confidenceLabel"] {
  if (totalSessions < 5 || completedSessions < 3) return "sparse";
  if (totalSessions < 10 || completedSessions < 5) return "low";
  if (totalSessions < 20 || completedSessions < 10) return "medium";
  return "high";
}

function topLabel(map: Map<string, number>, fallback = "n/a"): string {
  const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!top) return fallback;
  return `${top[0]} (${top[1]})`;
}

function compactJoin(parts: Array<string | null | undefined>): string {
  const filtered = parts.filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join("; ") : "n/a";
}

function buildRecommendationNote(
  row: Omit<BreakRankingRow, "recommendationNote">
): string {
  if (row.confidenceLabel === "sparse") {
    return "Sparse data; keep behavior neutral until more completed sessions exist.";
  }

  if (
    row.planned >= 10 &&
    row.completionRate !== null &&
    row.completionRate < LOW_COMPLETION_RATE_THRESHOLD
  ) {
    return "High intent with low completion; inspect forecast fit, timing, or product friction before boosting.";
  }

  if (
    row.completedLowConfidenceSessions >= 3 &&
    row.completed > 0 &&
    row.completedLowConfidenceSessions / row.completed >= 0.25
  ) {
    return "Possible under-rating: users completed sessions despite low forecast confidence.";
  }

  if (
    row.averageForecastConfidence !== null &&
    row.averageForecastConfidence >= HIGH_CONFIDENCE_THRESHOLD &&
    row.completionRate !== null &&
    row.completionRate < 0.5
  ) {
    return "Possible over-rating: high confidence did not convert to completed sessions.";
  }

  if (row.repeatCompletedSessionUsers >= 2 && row.completionRate !== null && row.completionRate >= 0.6) {
    return "Behavior supports a conservative recommendation boost when forecast quality is also acceptable.";
  }

  return "Use as neutral calibration signal; no strong behavior adjustment.";
}

function finalizeAggregate(
  aggregate: MutableBreakAggregate,
  beachById: Map<string, BeachRow>
): BreakRankingRow {
  const beach = beachById.get(aggregate.beachId);
  const uniqueUsers = aggregate.users.size;
  const repeatUsers = Array.from(aggregate.userCounts.values()).filter(
    (count) => count >= 2
  ).length;
  const repeatCompletedSessionUsers = Array.from(
    aggregate.completedUserCounts.values()
  ).filter((count) => count >= 2).length;
  const firstTimeUsers = Array.from(aggregate.userCounts.values()).filter(
    (count) => count === 1
  ).length;
  const completionRate =
    aggregate.totalSessions > 0
      ? round(aggregate.completedSessions / aggregate.totalSessions, 3)
      : null;
  const confidence = confidenceLabel(
    aggregate.totalSessions,
    aggregate.completedSessions
  );
  const preferredConditions =
    aggregate.completedSessions > 0
      ? aggregate.completedConditions
      : aggregate.allConditions;
  const snapshotCoverageRate =
    aggregate.totalSessions > 0
      ? round(aggregate.snapshotCount / aggregate.totalSessions, 3)
      : null;

  const withoutNote = {
    beachId: aggregate.beachId,
    break: beach?.name ?? aggregate.beachId,
    region: beach?.region ?? beach?.state ?? null,
    planned: aggregate.totalSessions,
    completed: aggregate.completedSessions,
    completionRate,
    uniqueUsers,
    firstTimeUsers,
    repeatUsers,
    repeatCompletedSessionUsers,
    averageSessionsPerUser:
      uniqueUsers > 0 ? round(aggregate.totalSessions / uniqueUsers, 2) : null,
    favoriteUsers: aggregate.favoriteUsers.size,
    alertsEnabledFavorites: aggregate.alertsEnabledFavoriteUsers.size,
    averageSessionRating: average(aggregate.ratings),
    averageWaveQuality: average(aggregate.waveQualityRatings),
    averageForecastConfidence: average(aggregate.forecastConfidence),
    averageCompletedForecastConfidence: average(
      aggregate.completedForecastConfidence
    ),
    snapshotCoverageRate,
    completedLowConfidenceSessions: aggregate.completedLowConfidenceSessions,
    commonSessionTimes: compactJoin([
      `day ${topLabel(aggregate.dayCounts)}`,
      `hour ${topLabel(aggregate.hourCounts)}`,
    ]),
    commonConditions: compactJoin([
      `wave ${topLabel(preferredConditions.waveHeight)}`,
      `period ${topLabel(preferredConditions.wavePeriod)}`,
      `swell ${topLabel(preferredConditions.swellDirection)}`,
      `wind ${topLabel(preferredConditions.windSpeed)}/${topLabel(preferredConditions.windDirection)}`,
      `tide ${topLabel(preferredConditions.tideStatus)}`,
    ]),
    boardUseSummary: topLabel(aggregate.boardTypes),
    reviewSummary: compactJoin([
      aggregate.reviewOverallRatings.length > 0
        ? `overall ${average(aggregate.reviewOverallRatings)} (${aggregate.reviewOverallRatings.length})`
        : null,
      aggregate.reviewWaveQualityRatings.length > 0
        ? `wave ${average(aggregate.reviewWaveQualityRatings)}`
        : null,
    ]),
    confidenceLabel: confidence,
  };

  return {
    ...withoutNote,
    recommendationNote: buildRecommendationNote(withoutNote),
  };
}

function buildReport(
  options: CliOptions,
  rawSessions: SessionRow[],
  sessions: SessionRow[],
  beachById: Map<string, BeachRow>,
  snapshotBySessionId: Map<string, SnapshotRow>,
  boardById: Map<string, BoardRow>,
  reviews: ReviewRow[],
  favorites: FavoriteRow[],
  profileById: Map<string, ProfileRow>
): Report {
  const aggregateByBeach = new Map<string, MutableBreakAggregate>();

  for (const session of sessions) {
    if (!session.beach_id || !session.user_id) continue;
    const aggregate =
      aggregateByBeach.get(session.beach_id) ?? makeAggregate(session.beach_id);
    aggregateByBeach.set(session.beach_id, aggregate);

    const beach = beachById.get(session.beach_id);
    const snapshot = snapshotBySessionId.get(session.id);
    const completed = isCompleted(session);
    const sessionTime = session.arrival_time ?? session.created_at;
    const parts = localParts(sessionTime, beach?.timezone);
    const confidence = snapshot?.forecast_confidence_score ?? null;

    aggregate.totalSessions += 1;
    increment(aggregate.statusCounts, session.status ?? "unknown");
    aggregate.users.add(session.user_id);
    aggregate.userCounts.set(
      session.user_id,
      (aggregate.userCounts.get(session.user_id) ?? 0) + 1
    );
    increment(aggregate.dayCounts, parts.day);
    increment(aggregate.hourCounts, parts.hour);
    pushFinite(aggregate.ratings, session.rating);
    pushFinite(aggregate.waveQualityRatings, session.wave_quality);
    if (snapshot) {
      aggregate.snapshotCount += 1;
    }
    pushFinite(aggregate.forecastConfidence, confidence);
    addConditionCounts(aggregate.allConditions, session, snapshot);

    if (session.board_id) {
      const board = boardById.get(session.board_id);
      increment(aggregate.boardTypes, board?.board_type ?? "unknown");
    }

    if (completed) {
      aggregate.completedSessions += 1;
      aggregate.completedUserCounts.set(
        session.user_id,
        (aggregate.completedUserCounts.get(session.user_id) ?? 0) + 1
      );
      pushFinite(aggregate.completedForecastConfidence, confidence);
      if (confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD) {
        aggregate.completedLowConfidenceSessions += 1;
      }
      addConditionCounts(aggregate.completedConditions, session, snapshot);
    }
  }

  for (const review of reviews) {
    const aggregate = aggregateByBeach.get(review.beach_id);
    if (!aggregate) continue;
    pushFinite(aggregate.reviewOverallRatings, review.overall_rating);
    pushFinite(aggregate.reviewWaveQualityRatings, review.wave_quality_rating);
  }

  for (const favorite of favorites) {
    if (!favorite.beach_id || !favorite.user_id) continue;
    if (!isRealProfile(profileById.get(favorite.user_id))) continue;
    const aggregate = aggregateByBeach.get(favorite.beach_id);
    if (!aggregate) continue;
    aggregate.favoriteUsers.add(favorite.user_id);
    if (favorite.alerts_enabled === true) {
      aggregate.alertsEnabledFavoriteUsers.add(favorite.user_id);
    }
  }

  const rankedBreaks = Array.from(aggregateByBeach.values())
    .map((aggregate) => finalizeAggregate(aggregate, beachById))
    .sort((a, b) => b.planned - a.planned);

  const top = options.top;
  const topBreaksByIntent = rankedBreaks.slice(0, top);
  const topBreaksByCompleted = [...rankedBreaks]
    .sort((a, b) => b.completed - a.completed)
    .slice(0, top);
  const topBreaksByCompletionRate = rankedBreaks
    .filter((row) => row.planned >= options.minSessions)
    .sort((a, b) => (b.completionRate ?? 0) - (a.completionRate ?? 0))
    .slice(0, top);
  const topBreaksByRepeatCompletedUsers = [...rankedBreaks]
    .sort(
      (a, b) =>
        b.repeatCompletedSessionUsers - a.repeatCompletedSessionUsers ||
        b.completed - a.completed
    )
    .slice(0, top);
  const highIntentLowCompletionBreaks = rankedBreaks
    .filter(
      (row) =>
        row.planned >= options.minSessions &&
        row.completionRate !== null &&
        row.completionRate < LOW_COMPLETION_RATE_THRESHOLD
    )
    .sort((a, b) => b.planned - a.planned)
    .slice(0, top);
  const lowConfidenceCompletedBreaks = rankedBreaks
    .filter((row) => row.completedLowConfidenceSessions > 0)
    .sort(
      (a, b) =>
        b.completedLowConfidenceSessions - a.completedLowConfidenceSessions ||
        b.completed - a.completed
    )
    .slice(0, top);
  const sparseBreaks = rankedBreaks
    .filter((row) => row.confidenceLabel === "sparse")
    .sort((a, b) => b.planned - a.planned)
    .slice(0, top);
  const excludedMockOrSystemRows = rawSessions.length - sessions.length;

  return {
    generatedAt: new Date().toISOString(),
    range: {
      start: options.start,
      end: options.end,
      days: options.days,
    },
    filters: {
      minSessions: options.minSessions,
      lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
      excludedMockOrSystemRows,
    },
    summary: {
      rawSessions: rawSessions.length,
      includedSessions: sessions.length,
      completedSessions: sessions.filter(isCompleted).length,
      uniqueBreaks: aggregateByBeach.size,
      uniqueUsers: new Set(sessions.map((session) => session.user_id).filter(Boolean)).size,
      snapshotRows: snapshotBySessionId.size,
      snapshotCoverageRate:
        sessions.length > 0 ? round(snapshotBySessionId.size / sessions.length, 3) : null,
    },
    rankedBreaks,
    topBreaksByIntent,
    topBreaksByCompleted,
    topBreaksByCompletionRate,
    topBreaksByRepeatCompletedUsers,
    highIntentLowCompletionBreaks,
    lowConfidenceCompletedBreaks,
    sparseBreaks,
  };
}

function formatPct(value: number | null): string {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function printTable(title: string, rows: BreakRankingRow[]): void {
  console.log(`\n${title}`);
  console.log(
    [
      "Break",
      "Planned",
      "Completed",
      "Completion",
      "Users",
      "Repeat",
      "Common Conditions",
      "Note",
      "Confidence",
    ].join(" | ")
  );
  console.log(
    [
      "---",
      "---:",
      "---:",
      "---:",
      "---:",
      "---:",
      "---",
      "---",
      "---",
    ].join(" | ")
  );
  for (const row of rows) {
    console.log(
      [
        row.break,
        row.planned,
        row.completed,
        formatPct(row.completionRate),
        row.uniqueUsers,
        row.repeatCompletedSessionUsers,
        row.commonConditions,
        row.recommendationNote,
        row.confidenceLabel,
      ].join(" | ")
    );
  }
}

function printReport(report: Report): void {
  console.log("Quiver session/break behavior report");
  console.log(`Range: ${report.range.start} to ${report.range.end}`);
  console.log(
    `Included sessions: ${report.summary.includedSessions}/${report.summary.rawSessions}; completed=${report.summary.completedSessions}; breaks=${report.summary.uniqueBreaks}; users=${report.summary.uniqueUsers}; snapshotCoverage=${formatPct(report.summary.snapshotCoverageRate)}`
  );

  printTable("Top breaks by intent sessions", report.topBreaksByIntent);
  printTable("Top breaks by completed sessions", report.topBreaksByCompleted);
  printTable("Top completion-rate breaks", report.topBreaksByCompletionRate);
  printTable("Top repeat-completed-user breaks", report.topBreaksByRepeatCompletedUsers);
  printTable("High-intent, low-completion breaks", report.highIntentLowCompletionBreaks);
  printTable("Completed sessions with low forecast confidence", report.lowConfidenceCompletedBreaks);
}

function writeJson(path: string, report: Report): void {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote JSON report: ${absolutePath}`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const supabase = createAdminClient();
  const rawSessions = await fetchSessions(supabase, options);
  const initialUserIds = uniqueStrings(rawSessions.map((session) => session.user_id));
  const profileById = await fetchProfilesByIds(supabase, initialUserIds);
  const sessions = rawSessions.filter((session) =>
    session.user_id ? isRealProfile(profileById.get(session.user_id)) : false
  );
  const beachIds = uniqueStrings(sessions.map((session) => session.beach_id));
  const [beachById, snapshotBySessionId, boardById, reviews, favorites] =
    await Promise.all([
      fetchBeachesByIds(supabase, beachIds),
      fetchSnapshotsBySessionIds(supabase, sessions.map((session) => session.id)),
      fetchBoardsByIds(supabase, uniqueStrings(sessions.map((session) => session.board_id))),
      fetchReviewsByBeachIds(supabase, beachIds),
      fetchFavoritesByBeachIds(supabase, beachIds, options.start, options.end),
    ]);

  const favoriteUserIds = uniqueStrings(favorites.map((favorite) => favorite.user_id))
    .filter((userId) => !profileById.has(userId));
  if (favoriteUserIds.length > 0) {
    const favoriteProfileById = await fetchProfilesByIds(supabase, favoriteUserIds);
    for (const [userId, profile] of favoriteProfileById) {
      profileById.set(userId, profile);
    }
  }

  const report = buildReport(
    options,
    rawSessions,
    sessions,
    beachById,
    snapshotBySessionId,
    boardById,
    reviews,
    favorites,
    profileById
  );

  printReport(report);
  if (options.outputJsonPath) {
    writeJson(options.outputJsonPath, report);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export {
  buildReport,
  confidenceLabel,
  parseCliArgs,
  waveHeightBucket,
  windSpeedBucket,
};
