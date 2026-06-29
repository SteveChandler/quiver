#!/usr/bin/env tsx
/**
 * Read-only Track C validator for the personal match-score heuristic.
 *
 * Pulls completed rated sessions + forecast snapshots, reconstructs the
 * current base component distances, and reports whether those components align
 * with actual user ratings. This does not train or write a model.
 *
 * Run:
 *   yarn tsx scripts/validate-match-score-heuristic.ts
 *   yarn tsx scripts/validate-match-score-heuristic.ts --output-json /tmp/quiver-match-score-heuristic-validation.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const DEFAULT_MONTHS = 12;
const DEFAULT_MIN_HISTORY = 5;
const DEFAULT_MIN_SCORED_SESSIONS = 100;
const DEFAULT_MIN_USERS = 25;
const DEFAULT_MIN_PEARSON = 0.2;
const DEFAULT_HISTORY_MODE = "prior-only" as const;
const PAGE_SIZE = 1000;
const MATCH_HEURISTIC_VALIDATION_SCHEMA_VERSION = 4;
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export const DEFAULT_MATCH_WEIGHTS = {
  wave: 0.35,
  period: 0.25,
  wind: 0.2,
  tide: 0.1,
  windDir: 0.1,
} as const;

export type MatchComponent = keyof typeof DEFAULT_MATCH_WEIGHTS;
export type MatchHistoryMode = "prior-only" | "leave-one-out";
export type MatchProfileScope = "user" | "cohort";

export type MatchWeights = Record<MatchComponent, number>;

type ReweightingReadinessFindingCode =
  | "scored_sessions_floor"
  | "scored_users_floor"
  | "best_grid_pearson_unavailable"
  | "best_grid_pearson_floor"
  | "holdout_grid_pearson_unavailable"
  | "holdout_grid_pearson_floor"
  | "reweighting_candidate_not_production_approval";

type CurrentHeuristicValidationFindingCode =
  | "current_scored_sessions_floor"
  | "current_scored_users_floor"
  | "current_weight_pearson_unavailable"
  | "current_weight_pearson_floor"
  | "current_weights_validated";

type CohortSanityFindingCode =
  | "cohort_diagnostic_missing"
  | "cohort_scored_sessions_floor"
  | "cohort_scored_users_floor"
  | "cohort_current_weight_pearson_unavailable"
  | "cohort_current_weight_pearson_floor"
  | "cohort_current_weights_aligned"
  | "cohort_not_production_evidence";

interface ReweightingReadinessFinding {
  code: ReweightingReadinessFindingCode;
  message: string;
}

interface CurrentHeuristicValidationFinding {
  code: CurrentHeuristicValidationFindingCode;
  message: string;
}

interface CohortSanityFinding {
  code: CohortSanityFindingCode;
  message: string;
}

interface CliOptions {
  months: number;
  minHistory: number;
  historyMode: MatchHistoryMode;
  minScoredSessions: number;
  minUsers: number;
  minPearson: number;
  failOnNotReady: boolean;
  outputJsonPath: string | null;
  validateOutputJsonPath: string | null;
  maxReportAgeHours: number | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  beach_id: string | null;
  arrival_time: string;
  rating: number | null;
  session_skill_fit: string | null;
  session_board_fit: string | null;
}

export interface SnapshotRow {
  session_id: string;
  forecast_snapshot: Record<string, unknown> | null;
}

interface BeachRow {
  id: string;
  name: string | null;
  slug: string | null;
  break_type: string | null;
}

export interface ProfileRow {
  id: string;
  deleted_at: string | null;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
}

export interface RatedSessionSample {
  id: string;
  userId: string;
  beachId: string | null;
  beachName: string | null;
  breakType: string | null;
  arrivalTime: string;
  rating: number;
  wave: number | null;
  period: number | null;
  wind: number | null;
  windDir: number | null;
  tide: number | null;
}

export interface PreferenceProfile {
  sessionCount: number;
  positiveCount: number;
  aversionCount: number;
  peak: Record<MatchComponent, number | null>;
}

export interface ScoredSession {
  userId: string;
  rating: number;
  score: number;
  componentCloseness: Record<MatchComponent, number>;
  historyCount: number;
}

export interface MatchWeightHoldout {
  strategy: "user-deterministic-80-20";
  trainScoredCount: number;
  trainUserCount: number;
  holdoutScoredCount: number;
  holdoutUserCount: number;
  trainedWeights: MatchWeights | null;
  trainPearson: number | null;
  holdoutPearson: number | null;
}

export interface ValidationSummary {
  loadedCount: number;
  usableCount: number;
  scoredCount: number;
  loadedUserCount: number;
  userCount: number;
  scorePearson: number | null;
  scoreSpearman: number | null;
  componentPearson: Record<MatchComponent, number | null>;
  componentSpearman: Record<MatchComponent, number | null>;
  bestWeights: MatchWeights | null;
  bestWeightPearson: number | null;
  reweightingHoldout: MatchWeightHoldout;
  currentWeightPearson: number | null;
  ratingBuckets: Array<{ rating: number; count: number; averageScore: number }>;
}

export interface RatingInventory {
  rawRatedSessionCount: number;
  rawRatedUserCount: number;
  realProfileRatedSessionCount: number;
  realProfileUserCount: number;
  excludedProfileSessionCount: number;
  missingForecastSnapshotSessionCount: number;
  loadedRatedSessionCount: number;
  loadedUserCount: number;
}

export interface ReweightingReadiness {
  verdict: "candidate" | "not-ready";
  readyForExperiment: boolean;
  readyForProduction: false;
  criteria: {
    historyMode: MatchHistoryMode;
    minScoredSessions: number;
    minUsers: number;
    minPearson: number;
  };
  observed: {
    scoredCount: number;
    userCount: number;
    bestWeightPearson: number | null;
    holdoutScoredCount: number;
    holdoutUserCount: number;
    holdoutWeightPearson: number | null;
  };
  findings: string[];
  findingCodes: ReweightingReadinessFindingCode[];
}

export interface CurrentHeuristicValidation {
  verdict: "validated" | "not-validated";
  criteria: {
    historyMode: MatchHistoryMode;
    minScoredSessions: number;
    minUsers: number;
    minPearson: number;
  };
  observed: {
    scoredCount: number;
    userCount: number;
    currentWeightPearson: number | null;
    currentWeightSpearman: number | null;
  };
  findings: string[];
  findingCodes: CurrentHeuristicValidationFindingCode[];
}

export interface CohortSanityCheck {
  verdict: "aligned" | "not-aligned" | "insufficient-signal";
  productionEvidence: false;
  criteria: {
    profileScope: "cohort";
    historyMode: "leave-one-out";
    minHistory: number;
    minScoredSessions: number;
    minUsers: number;
    minPearson: number;
  };
  observed: {
    scoredCount: number;
    userCount: number;
    currentWeightPearson: number | null;
    currentWeightSpearman: number | null;
    bestWeightPearson: number | null;
  };
  findings: string[];
  findingCodes: CohortSanityFindingCode[];
}

export interface MatchHeuristicMeasurementWindow {
  start: string;
  end: string;
  months: number;
}

export interface MatchHeuristicValidationReport {
  reportSchemaVersion: 4;
  generatedAt: string;
  measurementWindow: MatchHeuristicMeasurementWindow;
  options: {
    months: number;
    minHistory: number;
    historyMode: MatchHistoryMode;
    minScoredSessions: number;
    minUsers: number;
    minPearson: number;
  };
  currentWeights: MatchWeights;
  ratingInventory: RatingInventory | null;
  summary: ValidationSummary;
  rpcFloorDiagnostic: MatchHeuristicRpcFloorDiagnostic;
  cohortDiagnostic: MatchHeuristicCohortDiagnostic | null;
  cohortSanityCheck: CohortSanityCheck;
  currentHeuristicValidation: CurrentHeuristicValidation;
  reweightingReadiness: ReweightingReadiness;
}

export interface MatchHeuristicValidationReportValidationResult {
  ok: boolean;
  blockers: string[];
}

export interface MatchHeuristicCohortDiagnostic {
  profileScope: "cohort";
  historyMode: "leave-one-out";
  minHistory: number;
  summary: ValidationSummary;
  warning: string;
}

export interface MatchHeuristicRpcFloorDiagnostic {
  profileScope: "user";
  historyMode: "prior-only";
  minHistory: 1;
  productionEvidence: false;
  summary: ValidationSummary;
  warning: string;
}

const DEFAULT_COHORT_DIAGNOSTIC_MIN_HISTORY = 3;
const RPC_FLOOR_DIAGNOSTIC_MIN_HISTORY = 1;

export function parseCliArgs(argv: string[]): CliOptions {
  let months = DEFAULT_MONTHS;
  let minHistory = DEFAULT_MIN_HISTORY;
  let historyMode: MatchHistoryMode = DEFAULT_HISTORY_MODE;
  let minScoredSessions = DEFAULT_MIN_SCORED_SESSIONS;
  let minUsers = DEFAULT_MIN_USERS;
  let minPearson = DEFAULT_MIN_PEARSON;
  let failOnNotReady = false;
  let outputJsonPath: string | null = null;
  let validateOutputJsonPath: string | null = null;
  let maxReportAgeHours: number | null = null;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--months") {
      const value = readFlagValue(next, "--months");
      months = parsePositiveInteger(value, "--months");
      index++;
      continue;
    }
    if (arg.startsWith("--months=")) {
      months = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--months"),
        "--months"
      );
      continue;
    }
    if (arg === "--min-history") {
      const value = readFlagValue(next, "--min-history");
      minHistory = parseNonNegativeInteger(value, "--min-history");
      index++;
      continue;
    }
    if (arg.startsWith("--min-history=")) {
      minHistory = parseNonNegativeInteger(
        readFlagValue(arg.split("=")[1], "--min-history"),
        "--min-history"
      );
      continue;
    }
    if (arg === "--history-mode") {
      const value = readFlagValue(next, "--history-mode");
      historyMode = parseHistoryMode(value);
      index++;
      continue;
    }
    if (arg.startsWith("--history-mode=")) {
      historyMode = parseHistoryMode(
        readFlagValue(arg.split("=")[1], "--history-mode")
      );
      continue;
    }
    if (arg === "--include-future-history") {
      historyMode = "leave-one-out";
      continue;
    }
    if (arg === "--min-scored-sessions") {
      const value = readFlagValue(next, "--min-scored-sessions");
      minScoredSessions = parsePositiveInteger(
        value,
        "--min-scored-sessions"
      );
      index++;
      continue;
    }
    if (arg.startsWith("--min-scored-sessions=")) {
      minScoredSessions = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-scored-sessions"),
        "--min-scored-sessions"
      );
      continue;
    }
    if (arg === "--min-users") {
      const value = readFlagValue(next, "--min-users");
      minUsers = parsePositiveInteger(value, "--min-users");
      index++;
      continue;
    }
    if (arg.startsWith("--min-users=")) {
      minUsers = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--min-users"),
        "--min-users"
      );
      continue;
    }
    if (arg === "--min-pearson") {
      const value = readFlagValue(next, "--min-pearson");
      minPearson = parsePearsonThreshold(value, "--min-pearson");
      index++;
      continue;
    }
    if (arg.startsWith("--min-pearson=")) {
      minPearson = parsePearsonThreshold(
        readFlagValue(arg.split("=")[1], "--min-pearson"),
        "--min-pearson"
      );
      continue;
    }
    if (arg === "--fail-on-not-ready") {
      failOnNotReady = true;
      continue;
    }
    if (arg === "--output-json") {
      outputJsonPath = readFlagValue(next, "--output-json");
      index++;
      continue;
    }
    if (arg.startsWith("--output-json=")) {
      outputJsonPath = readFlagValue(arg.split("=")[1], "--output-json");
      continue;
    }
    if (arg === "--validate-output-json") {
      validateOutputJsonPath = readFlagValue(next, "--validate-output-json");
      index++;
      continue;
    }
    if (arg.startsWith("--validate-output-json=")) {
      validateOutputJsonPath = readFlagValue(
        arg.split("=")[1],
        "--validate-output-json"
      );
      continue;
    }
    if (arg === "--max-report-age-hours") {
      maxReportAgeHours = parsePositiveInteger(
        readFlagValue(next, "--max-report-age-hours"),
        "--max-report-age-hours"
      );
      index++;
      continue;
    }
    if (arg.startsWith("--max-report-age-hours=")) {
      maxReportAgeHours = parsePositiveInteger(
        readFlagValue(arg.split("=")[1], "--max-report-age-hours"),
        "--max-report-age-hours"
      );
      continue;
    }
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (outputJsonPath && validateOutputJsonPath) {
    throw new Error(
      "--validate-output-json cannot be combined with --output-json."
    );
  }
  if (maxReportAgeHours !== null && !validateOutputJsonPath) {
    throw new Error(
      "--max-report-age-hours requires --validate-output-json."
    );
  }

  return {
    months,
    minHistory,
    historyMode,
    minScoredSessions,
    minUsers,
    minPearson,
    failOnNotReady,
    outputJsonPath,
    validateOutputJsonPath,
    maxReportAgeHours,
  };
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return parsed;
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function parseNonNegativeInteger(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flagName} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePearsonThreshold(value: string, flagName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error(`${flagName} must be greater than 0 and no more than 1.`);
  }
  return parsed;
}

function parseHistoryMode(value: string): MatchHistoryMode {
  if (value === "prior-only" || value === "leave-one-out") {
    return value;
  }
  throw new Error("--history-mode must be prior-only or leave-one-out.");
}

export function buildMatchHeuristicMeasurementWindow(
  months: number,
  endDate: Date = new Date()
): MatchHeuristicMeasurementWindow {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error("months must be a positive integer.");
  }

  const end = new Date(endDate);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    months,
  };
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function fetchRatedSessionValidationInput(
  supabase: SupabaseClient,
  options: CliOptions,
  measurementWindow: MatchHeuristicMeasurementWindow =
    buildMatchHeuristicMeasurementWindow(options.months)
): Promise<{ sessions: RatedSessionSample[]; ratingInventory: RatingInventory }> {
  const sessions: SessionRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("sessions")
      .select(
        "id,user_id,beach_id,arrival_time,rating,session_skill_fit,session_board_fit"
      )
      .eq("status", "completed")
      .is("deleted_at", null)
      .not("rating", "is", null)
      .gte("arrival_time", measurementWindow.start)
      .lt("arrival_time", measurementWindow.end)
      .order("arrival_time", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`sessions lookup failed: ${error.message}`);
    }

    const page = (data ?? []) as SessionRow[];
    sessions.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  const profilesById = await fetchProfilesById(
    supabase,
    Array.from(new Set(sessions.map((session) => session.user_id)))
  );
  const realUserSessions = filterSessionRowsByRealProfiles(
    sessions,
    profilesById
  );
  const sessionIds = realUserSessions.map((session) => session.id);
  const beachIds = Array.from(
    new Set(
      realUserSessions
        .map((session) => session.beach_id)
        .filter((beachId): beachId is string => Boolean(beachId))
    )
  );

  const snapshotsBySessionId = await fetchSnapshotsBySessionId(
    supabase,
    sessionIds
  );
  const beachesById = await fetchBeachesById(supabase, beachIds);

  const loadedSessions = realUserSessions.flatMap((session) => {
    const snapshot = snapshotsBySessionId.get(session.id)?.forecast_snapshot;
    if (!snapshot || session.rating == null) {
      return [];
    }

    const beach = session.beach_id ? beachesById.get(session.beach_id) : null;
    return [
      {
        id: session.id,
        userId: session.user_id,
        beachId: session.beach_id,
        beachName: beach?.name ?? beach?.slug ?? null,
        breakType: beach?.break_type ?? null,
        arrivalTime: session.arrival_time,
        rating: session.rating,
        wave: parseNumeric(snapshot.wave_height),
        period: parseNumeric(snapshot.wave_period),
        wind: parseNumeric(snapshot.wind_speed),
        windDir: parseNumeric(snapshot.wind_direction_deg),
        tide: parseNumeric(snapshot.tide_height),
      },
    ];
  });

  return {
    sessions: loadedSessions,
    ratingInventory: buildRatingInventory({
      ratedSessions: sessions,
      realUserSessions,
      snapshotsBySessionId,
      loadedSessions,
    }),
  };
}

async function fetchProfilesById(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, ProfileRow>> {
  const profilesById = new Map<string, ProfileRow>();
  for (let offset = 0; offset < userIds.length; offset += PAGE_SIZE) {
    const chunk = userIds.slice(offset, offset + PAGE_SIZE);
    if (chunk.length === 0) {
      continue;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id,deleted_at,is_mock,analytics_is_real_user,is_system_account")
      .in("id", chunk);

    if (error) {
      throw new Error(`profiles lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as ProfileRow[]) {
      profilesById.set(row.id, row);
    }
  }
  return profilesById;
}

export function filterSessionRowsByRealProfiles(
  sessions: SessionRow[],
  profilesById: Map<string, ProfileRow>
): SessionRow[] {
  return sessions.filter((session) =>
    isRealProfile(profilesById.get(session.user_id))
  );
}

function isRealProfile(profile: ProfileRow | undefined): boolean {
  if (!profile) {
    return false;
  }
  if (profile.deleted_at !== null) {
    return false;
  }
  if (profile.is_mock === true) {
    return false;
  }
  if (profile.analytics_is_real_user === false) {
    return false;
  }
  if (profile.is_system_account === true) {
    return false;
  }
  return true;
}

export function buildRatingInventory({
  ratedSessions,
  realUserSessions,
  snapshotsBySessionId,
  loadedSessions,
}: {
  ratedSessions: SessionRow[];
  realUserSessions: SessionRow[];
  snapshotsBySessionId: Map<string, SnapshotRow>;
  loadedSessions: RatedSessionSample[];
}): RatingInventory {
  return {
    rawRatedSessionCount: ratedSessions.length,
    rawRatedUserCount: uniqueCount(ratedSessions.map((session) => session.user_id)),
    realProfileRatedSessionCount: realUserSessions.length,
    realProfileUserCount: uniqueCount(
      realUserSessions.map((session) => session.user_id)
    ),
    excludedProfileSessionCount: ratedSessions.length - realUserSessions.length,
    missingForecastSnapshotSessionCount: realUserSessions.filter(
      (session) => !snapshotsBySessionId.get(session.id)?.forecast_snapshot
    ).length,
    loadedRatedSessionCount: loadedSessions.length,
    loadedUserCount: uniqueCount(loadedSessions.map((session) => session.userId)),
  };
}

function uniqueCount(values: string[]): number {
  return new Set(values).size;
}

async function fetchSnapshotsBySessionId(
  supabase: SupabaseClient,
  sessionIds: string[]
): Promise<Map<string, SnapshotRow>> {
  const snapshotsBySessionId = new Map<string, SnapshotRow>();
  for (let offset = 0; offset < sessionIds.length; offset += PAGE_SIZE) {
    const chunk = sessionIds.slice(offset, offset + PAGE_SIZE);
    if (chunk.length === 0) {
      continue;
    }
    const { data, error } = await supabase
      .from("session_forecast_snapshots")
      .select("session_id,forecast_snapshot")
      .in("session_id", chunk);

    if (error) {
      throw new Error(`session_forecast_snapshots lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as SnapshotRow[]) {
      snapshotsBySessionId.set(row.session_id, row);
    }
  }
  return snapshotsBySessionId;
}

async function fetchBeachesById(
  supabase: SupabaseClient,
  beachIds: string[]
): Promise<Map<string, BeachRow>> {
  const beachesById = new Map<string, BeachRow>();
  for (let offset = 0; offset < beachIds.length; offset += PAGE_SIZE) {
    const chunk = beachIds.slice(offset, offset + PAGE_SIZE);
    if (chunk.length === 0) {
      continue;
    }
    const { data, error } = await supabase
      .from("beaches")
      .select("id,name,slug,break_type")
      .in("id", chunk);

    if (error) {
      throw new Error(`beaches lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as BeachRow[]) {
      beachesById.set(row.id, row);
    }
  }
  return beachesById;
}

export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildPreferenceProfile(
  sessions: RatedSessionSample[],
  target: RatedSessionSample,
  options: {
    historyMode?: MatchHistoryMode;
    profileScope?: MatchProfileScope;
  } = {}
): PreferenceProfile {
  const historyMode = options.historyMode ?? DEFAULT_HISTORY_MODE;
  const profileScope = options.profileScope ?? "user";
  const targetTime = Date.parse(target.arrivalTime);
  const breakFiltered = sessions.filter(
    (session) =>
      session.id !== target.id &&
      (profileScope === "cohort" || session.userId === target.userId) &&
      (target.breakType == null ||
        session.breakType === target.breakType ||
        session.breakType == null) &&
      isEligibleHistorySession(session, targetTime, historyMode)
  );

  return {
    sessionCount: breakFiltered.length,
    positiveCount: breakFiltered.filter((session) => session.rating >= 4).length,
    aversionCount: breakFiltered.filter((session) => session.rating <= 2).length,
    peak: {
      wave: weightedPeak(breakFiltered, "wave", "positive"),
      period: weightedPeak(breakFiltered, "period", "positive"),
      wind: weightedPeak(breakFiltered, "wind", "positive"),
      tide: weightedPeak(breakFiltered, "tide", "positive"),
      windDir: weightedPeak(breakFiltered, "windDir", "positive"),
    },
  };
}

function isEligibleHistorySession(
  session: RatedSessionSample,
  targetTime: number,
  historyMode: MatchHistoryMode
): boolean {
  if (historyMode === "leave-one-out") {
    return true;
  }
  const sessionTime = Date.parse(session.arrivalTime);
  return (
    Number.isFinite(targetTime) &&
    Number.isFinite(sessionTime) &&
    sessionTime < targetTime
  );
}

function weightedPeak(
  sessions: RatedSessionSample[],
  component: MatchComponent,
  mode: "positive" | "negative"
): number | null {
  let numerator = 0;
  let denominator = 0;
  for (const session of sessions) {
    const value = session[component];
    if (value == null || !Number.isFinite(value)) {
      continue;
    }
    const weight =
      mode === "positive"
        ? Math.max(session.rating - 3, 0)
        : Math.max(3 - session.rating, 0);
    if (weight <= 0) {
      continue;
    }
    numerator += value * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : null;
}

export function scoreAgainstProfile(
  target: RatedSessionSample,
  profile: PreferenceProfile,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS
): ScoredSession | null {
  if (
    profile.positiveCount === 0 ||
    !hasAllTargetComponents(target) ||
    !hasAllProfilePeaks(profile)
  ) {
    return null;
  }

  const componentCloseness = {
    wave: 1 - distance(target.wave, profile.peak.wave, "wave"),
    period: 1 - distance(target.period, profile.peak.period, "period"),
    wind: 1 - distance(target.wind, profile.peak.wind, "wind"),
    tide: 1 - distance(target.tide, profile.peak.tide, "tide"),
    windDir: 1 - windDirectionDistance(target.windDir, profile.peak.windDir),
  };
  const weightedDistance =
    weights.wave * (1 - componentCloseness.wave) +
    weights.period * (1 - componentCloseness.period) +
    weights.wind * (1 - componentCloseness.wind) +
    weights.tide * (1 - componentCloseness.tide) +
    weights.windDir * (1 - componentCloseness.windDir);

  return {
    userId: target.userId,
    rating: target.rating,
    score: roundMetric((1 - Math.min(weightedDistance, 1)) * 10),
    componentCloseness,
    historyCount: profile.sessionCount,
  };
}

function hasAllTargetComponents(target: RatedSessionSample): boolean {
  return (
    target.wave != null &&
    target.period != null &&
    target.wind != null &&
    target.tide != null &&
    target.windDir != null
  );
}

function hasAllProfilePeaks(profile: PreferenceProfile): boolean {
  return (
    profile.peak.wave != null &&
    profile.peak.period != null &&
    profile.peak.wind != null &&
    profile.peak.tide != null &&
    profile.peak.windDir != null
  );
}

function distance(
  targetValue: number | null,
  peakValue: number | null,
  component: Exclude<MatchComponent, "windDir">
): number {
  if (targetValue == null || peakValue == null) {
    return 1;
  }
  const denominator =
    component === "wind" ? Math.max(peakValue, 5) : Math.max(peakValue, 1);
  if (component === "tide") {
    return Math.min(Math.abs(peakValue - targetValue) / 3, 1);
  }
  return Math.min(Math.abs(peakValue - targetValue) / denominator, 1);
}

function windDirectionDistance(
  targetValue: number | null,
  peakValue: number | null
): number {
  if (targetValue == null || peakValue == null) {
    return 1;
  }
  const rawDiff = Math.abs(peakValue - targetValue);
  return Math.min(Math.min(rawDiff, 360 - rawDiff) / 180, 1);
}

export function validateMatchHeuristic(
  sessions: RatedSessionSample[],
  minHistory = DEFAULT_MIN_HISTORY,
  historyMode: MatchHistoryMode = DEFAULT_HISTORY_MODE,
  profileScope: MatchProfileScope = "user"
): ValidationSummary {
  const usableSessions = sessions.filter(hasAllTargetComponents);
  const scored = usableSessions.flatMap((session) => {
    const profile = buildPreferenceProfile(usableSessions, session, {
      historyMode,
      profileScope,
    });
    if (profile.sessionCount < minHistory) {
      return [];
    }
    const scoredSession = scoreAgainstProfile(session, profile);
    return scoredSession ? [scoredSession] : [];
  });

  const ratings = scored.map((session) => session.rating);
  const scores = scored.map((session) => session.score);
  const componentPearson = componentCorrelation(scored, pearsonCorrelation);
  const componentSpearman = componentCorrelation(scored, spearmanCorrelation);
  const gridSearch = findBestWeights(scored);
  const reweightingHoldout = buildWeightSearchHoldout(scored);

  return {
    loadedCount: sessions.length,
    usableCount: usableSessions.length,
    scoredCount: scored.length,
    loadedUserCount: new Set(sessions.map((session) => session.userId)).size,
    userCount: new Set(scored.map((session) => session.userId)).size,
    scorePearson: pearsonCorrelation(scores, ratings),
    scoreSpearman: spearmanCorrelation(scores, ratings),
    componentPearson,
    componentSpearman,
    bestWeights: gridSearch?.weights ?? null,
    bestWeightPearson: gridSearch?.pearson ?? null,
    reweightingHoldout,
    currentWeightPearson: pearsonCorrelation(scores, ratings),
    ratingBuckets: ratingBuckets(scored),
  };
}

export function buildCohortDiagnosticSummary(
  sessions: RatedSessionSample[],
  minHistory = DEFAULT_COHORT_DIAGNOSTIC_MIN_HISTORY
): MatchHeuristicCohortDiagnostic {
  return {
    profileScope: "cohort",
    historyMode: "leave-one-out",
    minHistory,
    summary: validateMatchHeuristic(
      sessions,
      minHistory,
      "leave-one-out",
      "cohort"
    ),
    warning:
      "Broad cohort diagnostic only: uses other users' same-break-type " +
      "ratings to maximize signal coverage and is not production " +
      "personalization evidence.",
  };
}

export function buildRpcFloorDiagnosticSummary(
  sessions: RatedSessionSample[]
): MatchHeuristicRpcFloorDiagnostic {
  return {
    profileScope: "user",
    historyMode: "prior-only",
    minHistory: RPC_FLOOR_DIAGNOSTIC_MIN_HISTORY,
    productionEvidence: false,
    summary: validateMatchHeuristic(
      sessions,
      RPC_FLOOR_DIAGNOSTIC_MIN_HISTORY,
      "prior-only",
      "user"
    ),
    warning:
      "Diagnostic only: uses the RPC's one-positive-sample floor with " +
      "prior-only same-user history. This shows near-cold-start signal " +
      "coverage, but the stricter production validation gate remains the " +
      "authoritative approval evidence.",
  };
}

export function buildReweightingReadiness(
  summary: ValidationSummary,
  options: Pick<CliOptions, "minScoredSessions" | "minUsers" | "minPearson"> &
    Partial<Pick<CliOptions, "historyMode">>
): ReweightingReadiness {
  const findings: ReweightingReadinessFinding[] = [];
  const historyMode = options.historyMode ?? DEFAULT_HISTORY_MODE;
  const scoredSessionFindingLabel = scoredSessionLabel(historyMode);
  if (summary.scoredCount < options.minScoredSessions) {
    findings.push({
      code: "scored_sessions_floor",
      message: `${scoredSessionFindingLabel} ${summary.scoredCount} is below ${options.minScoredSessions}.`,
    });
  }
  if (summary.userCount < options.minUsers) {
    findings.push({
      code: "scored_users_floor",
      message: `Scored users represented ${summary.userCount} is below ${options.minUsers}.`,
    });
  }
  if (summary.bestWeightPearson == null) {
    findings.push({
      code: "best_grid_pearson_unavailable",
      message: "Best grid Pearson is unavailable.",
    });
  } else if (summary.bestWeightPearson < options.minPearson) {
    findings.push({
      code: "best_grid_pearson_floor",
      message: `Best grid Pearson ${summary.bestWeightPearson.toFixed(
        3
      )} is below ${options.minPearson.toFixed(3)}.`,
    });
  }
  if (summary.reweightingHoldout.holdoutPearson == null) {
    findings.push({
      code: "holdout_grid_pearson_unavailable",
      message:
        "User-level holdout Pearson is unavailable for the best grid weights.",
    });
  } else if (summary.reweightingHoldout.holdoutPearson < options.minPearson) {
    findings.push({
      code: "holdout_grid_pearson_floor",
      message: `User-level holdout Pearson ${summary.reweightingHoldout.holdoutPearson.toFixed(
        3
      )} is below ${options.minPearson.toFixed(3)}.`,
    });
  }

  const readyForExperiment = findings.length === 0;
  if (readyForExperiment) {
    findings.push({
      code: "reweighting_candidate_not_production_approval",
      message:
        "Data is large enough for a reviewed reweighting experiment, but this diagnostic is not production approval.",
    });
  }
  const findingMessages = findings.map((finding) => finding.message);
  const findingCodes = findings.map((finding) => finding.code);

  return {
    verdict: readyForExperiment ? "candidate" : "not-ready",
    readyForExperiment,
    readyForProduction: false,
    criteria: {
      historyMode,
      minScoredSessions: options.minScoredSessions,
      minUsers: options.minUsers,
      minPearson: options.minPearson,
    },
    observed: {
      scoredCount: summary.scoredCount,
      userCount: summary.userCount,
      bestWeightPearson: summary.bestWeightPearson,
      holdoutScoredCount: summary.reweightingHoldout.holdoutScoredCount,
      holdoutUserCount: summary.reweightingHoldout.holdoutUserCount,
      holdoutWeightPearson: summary.reweightingHoldout.holdoutPearson,
    },
    findings: findingMessages,
    findingCodes,
  };
}

export function buildCurrentHeuristicValidation(
  summary: ValidationSummary,
  options: Pick<CliOptions, "minScoredSessions" | "minUsers" | "minPearson"> &
    Partial<Pick<CliOptions, "historyMode">>
): CurrentHeuristicValidation {
  const findings: CurrentHeuristicValidationFinding[] = [];
  const historyMode = options.historyMode ?? DEFAULT_HISTORY_MODE;
  const scoredSessionFindingLabel = scoredSessionLabel(historyMode);

  if (summary.scoredCount < options.minScoredSessions) {
    findings.push({
      code: "current_scored_sessions_floor",
      message: `${scoredSessionFindingLabel} ${summary.scoredCount} is below ${options.minScoredSessions}.`,
    });
  }
  if (summary.userCount < options.minUsers) {
    findings.push({
      code: "current_scored_users_floor",
      message: `Scored users represented ${summary.userCount} is below ${options.minUsers}.`,
    });
  }
  if (summary.currentWeightPearson == null) {
    findings.push({
      code: "current_weight_pearson_unavailable",
      message: "Current-weight Pearson is unavailable.",
    });
  } else if (summary.currentWeightPearson < options.minPearson) {
    findings.push({
      code: "current_weight_pearson_floor",
      message: `Current-weight Pearson ${summary.currentWeightPearson.toFixed(
        3
      )} is below ${options.minPearson.toFixed(3)}.`,
    });
  }

  const isValidated = findings.length === 0;
  if (isValidated) {
    findings.push({
      code: "current_weights_validated",
      message:
        "Current weights clear the validation floor for this historical sample.",
    });
  }
  const findingMessages = findings.map((finding) => finding.message);
  const findingCodes = findings.map((finding) => finding.code);

  return {
    verdict: isValidated ? "validated" : "not-validated",
    criteria: {
      historyMode,
      minScoredSessions: options.minScoredSessions,
      minUsers: options.minUsers,
      minPearson: options.minPearson,
    },
    observed: {
      scoredCount: summary.scoredCount,
      userCount: summary.userCount,
      currentWeightPearson: summary.currentWeightPearson,
      currentWeightSpearman: summary.scoreSpearman,
    },
    findings: findingMessages,
    findingCodes,
  };
}

export function buildCohortSanityCheck(
  cohortDiagnostic: MatchHeuristicCohortDiagnostic | null,
  options: Pick<CliOptions, "minScoredSessions" | "minUsers" | "minPearson">
): CohortSanityCheck {
  const findings: CohortSanityFinding[] = [
    {
      code: "cohort_not_production_evidence",
      message:
        "Broad cohort diagnostic uses other users' history and is not production personalization approval.",
    },
  ];
  const summary = cohortDiagnostic?.summary ?? null;
  const minHistory =
    cohortDiagnostic?.minHistory ?? DEFAULT_COHORT_DIAGNOSTIC_MIN_HISTORY;

  if (!summary) {
    findings.push({
      code: "cohort_diagnostic_missing",
      message: "Broad cohort diagnostic is missing.",
    });
  } else {
    if (summary.scoredCount < options.minScoredSessions) {
      findings.push({
        code: "cohort_scored_sessions_floor",
        message: `Cohort scored sessions ${summary.scoredCount} is below ${options.minScoredSessions}.`,
      });
    }
    if (summary.userCount < options.minUsers) {
      findings.push({
        code: "cohort_scored_users_floor",
        message: `Cohort scored users represented ${summary.userCount} is below ${options.minUsers}.`,
      });
    }
    if (summary.currentWeightPearson == null) {
      findings.push({
        code: "cohort_current_weight_pearson_unavailable",
        message: "Cohort current-weight Pearson is unavailable.",
      });
    } else if (summary.currentWeightPearson < options.minPearson) {
      findings.push({
        code: "cohort_current_weight_pearson_floor",
        message: `Cohort current-weight Pearson ${summary.currentWeightPearson.toFixed(
          3
        )} is below ${options.minPearson.toFixed(3)}.`,
      });
    }
  }

  const hasSampleFloorBlocker = findings.some(
    (finding) =>
      finding.code === "cohort_diagnostic_missing" ||
      finding.code === "cohort_scored_sessions_floor" ||
      finding.code === "cohort_scored_users_floor"
  );
  const hasPearsonBlocker = findings.some(
    (finding) =>
      finding.code === "cohort_current_weight_pearson_unavailable" ||
      finding.code === "cohort_current_weight_pearson_floor"
  );
  const verdict =
    hasSampleFloorBlocker || !summary
      ? "insufficient-signal"
      : hasPearsonBlocker
        ? "not-aligned"
        : "aligned";

  if (verdict === "aligned") {
    findings.push({
      code: "cohort_current_weights_aligned",
      message:
        "Cohort diagnostic current weights clear the sanity-check floor.",
    });
  }

  return {
    verdict,
    productionEvidence: false,
    criteria: {
      profileScope: "cohort",
      historyMode: "leave-one-out",
      minHistory,
      minScoredSessions: options.minScoredSessions,
      minUsers: options.minUsers,
      minPearson: options.minPearson,
    },
    observed: {
      scoredCount: summary?.scoredCount ?? 0,
      userCount: summary?.userCount ?? 0,
      currentWeightPearson: summary?.currentWeightPearson ?? null,
      currentWeightSpearman: summary?.scoreSpearman ?? null,
      bestWeightPearson: summary?.bestWeightPearson ?? null,
    },
    findings: findings.map((finding) => finding.message),
    findingCodes: findings.map((finding) => finding.code),
  };
}

function componentCorrelation(
  scored: ScoredSession[],
  correlation: (xs: number[], ys: number[]) => number | null
): Record<MatchComponent, number | null> {
  const ratings = scored.map((session) => session.rating);
  return {
    wave: correlation(
      scored.map((session) => session.componentCloseness.wave),
      ratings
    ),
    period: correlation(
      scored.map((session) => session.componentCloseness.period),
      ratings
    ),
    wind: correlation(
      scored.map((session) => session.componentCloseness.wind),
      ratings
    ),
    tide: correlation(
      scored.map((session) => session.componentCloseness.tide),
      ratings
    ),
    windDir: correlation(
      scored.map((session) => session.componentCloseness.windDir),
      ratings
    ),
  };
}

export function findBestWeights(
  scored: ScoredSession[],
  step = 0.05
): { weights: MatchWeights; pearson: number } | null {
  if (scored.length < 3) {
    return null;
  }

  let best: { weights: MatchWeights; pearson: number } | null = null;
  const units = Math.round(1 / step);
  for (let wave = 0; wave <= units; wave++) {
    for (let period = 0; period <= units - wave; period++) {
      for (let wind = 0; wind <= units - wave - period; wind++) {
        for (let tide = 0; tide <= units - wave - period - wind; tide++) {
          const windDir = units - wave - period - wind - tide;
          const weights: MatchWeights = {
            wave: wave * step,
            period: period * step,
            wind: wind * step,
            tide: tide * step,
            windDir: windDir * step,
          };
          const pearson = weightSetPearson(scored, weights);
          if (pearson == null) {
            continue;
          }
          if (!best || pearson > best.pearson) {
            best = { weights, pearson };
          }
        }
      }
    }
  }
  return best;
}

export function buildWeightSearchHoldout(
  scored: ScoredSession[]
): MatchWeightHoldout {
  const { train, holdout } = splitScoredByUserHoldout(scored);
  const trained = findBestWeights(train);

  return {
    strategy: "user-deterministic-80-20",
    trainScoredCount: train.length,
    trainUserCount: uniqueCount(train.map((session) => session.userId)),
    holdoutScoredCount: holdout.length,
    holdoutUserCount: uniqueCount(holdout.map((session) => session.userId)),
    trainedWeights: trained?.weights ?? null,
    trainPearson: trained?.pearson ?? null,
    holdoutPearson: trained ? weightSetPearson(holdout, trained.weights) : null,
  };
}

function splitScoredByUserHoldout(scored: ScoredSession[]): {
  train: ScoredSession[];
  holdout: ScoredSession[];
} {
  const userIds = Array.from(new Set(scored.map((session) => session.userId))).sort();
  const holdoutUserIds = new Set<string>();
  for (let index = 0; index < userIds.length; index++) {
    if ((index + 1) % 5 === 0) {
      holdoutUserIds.add(userIds[index]);
    }
  }
  if (holdoutUserIds.size === 0 && userIds.length > 1) {
    holdoutUserIds.add(userIds[userIds.length - 1]);
  }

  return {
    train: scored.filter((session) => !holdoutUserIds.has(session.userId)),
    holdout: scored.filter((session) => holdoutUserIds.has(session.userId)),
  };
}

function weightSetPearson(
  scored: ScoredSession[],
  weights: MatchWeights
): number | null {
  return pearsonCorrelation(
    scored.map((session) => weightedScore(session.componentCloseness, weights)),
    scored.map((session) => session.rating)
  );
}

function weightedScore(
  closeness: Record<MatchComponent, number>,
  weights: MatchWeights
): number {
  return (
    10 *
    (weights.wave * closeness.wave +
      weights.period * closeness.period +
      weights.wind * closeness.wind +
      weights.tide * closeness.tide +
      weights.windDir * closeness.windDir)
  );
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const pairs = pairedFinite(xs, ys);
  if (pairs.length < 3) {
    return null;
  }
  const xMean = mean(pairs.map((pair) => pair[0]));
  const yMean = mean(pairs.map((pair) => pair[1]));
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  for (const [x, y] of pairs) {
    const xDiff = x - xMean;
    const yDiff = y - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff * xDiff;
    yDenominator += yDiff * yDiff;
  }
  if (xDenominator === 0 || yDenominator === 0) {
    return null;
  }
  return roundMetric(numerator / Math.sqrt(xDenominator * yDenominator));
}

export function spearmanCorrelation(xs: number[], ys: number[]): number | null {
  const pairs = pairedFinite(xs, ys);
  if (pairs.length < 3) {
    return null;
  }
  return pearsonCorrelation(
    rank(pairs.map((pair) => pair[0])),
    rank(pairs.map((pair) => pair[1]))
  );
}

function pairedFinite(xs: number[], ys: number[]): Array<[number, number]> {
  return xs.flatMap((x, index) => {
    const y = ys[index];
    return Number.isFinite(x) && Number.isFinite(y) ? [[x, y]] : [];
  });
}

function rank(values: number[]): number[] {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  for (let index = 0; index < sorted.length; ) {
    let end = index + 1;
    while (end < sorted.length && sorted[end].value === sorted[index].value) {
      end++;
    }
    const averageRank = (index + 1 + end) / 2;
    for (let rankIndex = index; rankIndex < end; rankIndex++) {
      ranks[sorted[rankIndex].index] = averageRank;
    }
    index = end;
  }
  return ranks;
}

function ratingBuckets(
  scored: ScoredSession[]
): Array<{ rating: number; count: number; averageScore: number }> {
  const byRating = new Map<number, number[]>();
  for (const session of scored) {
    byRating.set(session.rating, [
      ...(byRating.get(session.rating) ?? []),
      session.score,
    ]);
  }
  return Array.from(byRating.entries())
    .sort(([a], [b]) => a - b)
    .map(([rating, scores]) => ({
      rating,
      count: scores.length,
      averageScore: roundMetric(mean(scores)),
    }));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function printReport(
  summary: ValidationSummary,
  options: CliOptions,
  rpcFloorDiagnostic: MatchHeuristicRpcFloorDiagnostic,
  ratingInventory: RatingInventory | null = null,
  cohortDiagnostic: MatchHeuristicCohortDiagnostic | null = null,
  measurementWindow: MatchHeuristicMeasurementWindow =
    buildMatchHeuristicMeasurementWindow(options.months)
): void {
  const readiness = buildReweightingReadiness(summary, options);
  const currentValidation = buildCurrentHeuristicValidation(summary, options);
  const cohortSanityCheck = buildCohortSanityCheck(cohortDiagnostic, options);
  console.log("# Match Score Heuristic Validation");
  console.log("");
  console.log(
    `- Window: ${measurementWindow.start} to ${measurementWindow.end} (${measurementWindow.months} months)`
  );
  console.log(`- History mode: ${options.historyMode}`);
  console.log(`- Minimum prior history: ${options.minHistory}`);
  console.log(`- Rated sessions loaded: ${summary.loadedCount}`);
  console.log(`- Users loaded: ${summary.loadedUserCount}`);
  console.log(`- Sessions with complete components: ${summary.usableCount}`);
  console.log(
    `- ${scoredSessionLabel(options.historyMode)}: ${summary.scoredCount}`
  );
  console.log(`- Scored users represented: ${summary.userCount}`);
  if (ratingInventory) {
    console.log("");
    console.log("## Rating Inventory");
    console.log("");
    console.log("| Stage | Sessions | Users |");
    console.log("|-------|----------|-------|");
    console.log(
      `| Raw completed rated sessions | ${ratingInventory.rawRatedSessionCount} | ${ratingInventory.rawRatedUserCount} |`
    );
    console.log(
      `| Real-profile rated sessions | ${ratingInventory.realProfileRatedSessionCount} | ${ratingInventory.realProfileUserCount} |`
    );
    console.log(
      `| Loaded sessions with forecast snapshots | ${ratingInventory.loadedRatedSessionCount} | ${ratingInventory.loadedUserCount} |`
    );
    console.log("");
    console.log(
      `- Excluded non-real/deleted/system/missing-profile sessions: ${ratingInventory.excludedProfileSessionCount}`
    );
    console.log(
      `- Real-profile rated sessions missing forecast snapshots: ${ratingInventory.missingForecastSnapshotSessionCount}`
    );
  }
  console.log("");
  console.log("## Current Heuristic");
  console.log("");
  console.log(`- Validation verdict: ${currentValidation.verdict}`);
  console.log(
    `- Criteria: scored sessions >= ${currentValidation.criteria.minScoredSessions}, users >= ${currentValidation.criteria.minUsers}, current Pearson >= ${currentValidation.criteria.minPearson.toFixed(
      3
    )}`
  );
  console.log("| Metric | Value |");
  console.log("|--------|-------|");
  console.log(`| Pearson(score, rating) | ${formatMaybe(summary.scorePearson)} |`);
  console.log(`| Spearman(score, rating) | ${formatMaybe(summary.scoreSpearman)} |`);
  for (const finding of currentValidation.findings) {
    console.log(`- ${finding}`);
  }
  console.log("");
  console.log("## RPC-Floor Same-User Diagnostic");
  console.log("");
  console.log(rpcFloorDiagnostic.warning);
  console.log("");
  console.log("- Production evidence: false");
  console.log(`- Profile scope: ${rpcFloorDiagnostic.profileScope}`);
  console.log(`- History mode: ${rpcFloorDiagnostic.historyMode}`);
  console.log(
    `- Minimum same-break-type prior history: ${rpcFloorDiagnostic.minHistory}`
  );
  console.log(
    `- RPC-floor scored sessions: ${rpcFloorDiagnostic.summary.scoredCount}`
  );
  console.log(
    `- RPC-floor scored users represented: ${rpcFloorDiagnostic.summary.userCount}`
  );
  console.log(
    `- RPC-floor Pearson(score, rating): ${formatMaybe(
      rpcFloorDiagnostic.summary.scorePearson
    )}`
  );
  console.log(
    `- RPC-floor Spearman(score, rating): ${formatMaybe(
      rpcFloorDiagnostic.summary.scoreSpearman
    )}`
  );
  console.log("");
  console.log("## Component Correlation");
  console.log("");
  console.log("| Component closeness | Pearson | Spearman | Current weight |");
  console.log("|---------------------|---------|----------|----------------|");
  for (const component of componentOrder()) {
    console.log(
      `| ${componentLabel(component)} | ${formatMaybe(
        summary.componentPearson[component]
      )} | ${formatMaybe(summary.componentSpearman[component])} | ${formatWeight(
        DEFAULT_MATCH_WEIGHTS[component]
      )} |`
    );
  }
  console.log("");
  console.log("## Rating Buckets");
  console.log("");
  console.log("| Rating | N | Avg current score |");
  console.log("|--------|---|-------------------|");
  for (const bucket of summary.ratingBuckets) {
    console.log(
      `| ${bucket.rating} | ${bucket.count} | ${bucket.averageScore.toFixed(2)} |`
    );
  }
  if (summary.bestWeights) {
    console.log("");
    console.log("## Exploratory Reweighting");
    console.log("");
    console.log(
      "Grid search is diagnostic only. It is not a learned model and should not ship without more data."
    );
    console.log("");
    console.log(
      `- Current Pearson: ${formatMaybe(summary.currentWeightPearson)}`
    );
    console.log(`- Best grid Pearson: ${formatMaybe(summary.bestWeightPearson)}`);
    console.log(
      `- User holdout: train ${summary.reweightingHoldout.trainScoredCount} sessions / ${summary.reweightingHoldout.trainUserCount} users, holdout ${summary.reweightingHoldout.holdoutScoredCount} sessions / ${summary.reweightingHoldout.holdoutUserCount} users`
    );
    console.log(
      `- Holdout Pearson: ${formatMaybe(
        summary.reweightingHoldout.holdoutPearson
      )}`
    );
    console.log(
      `- Best weights: ${componentOrder()
        .map(
          (component) =>
            `${componentLabel(component)} ${formatWeight(
              summary.bestWeights?.[component] ?? 0
            )}`
        )
        .join(", ")}`
    );
  }
  console.log("");
  console.log("## Reweighting Readiness");
  console.log("");
  console.log(`- Verdict: ${readiness.verdict}`);
  console.log(
    `- Criteria: scored sessions >= ${readiness.criteria.minScoredSessions}, users >= ${readiness.criteria.minUsers}, best grid Pearson >= ${readiness.criteria.minPearson.toFixed(
      3
    )}, holdout Pearson >= ${readiness.criteria.minPearson.toFixed(3)}`
  );
  console.log(
    `- Observed: scored sessions ${readiness.observed.scoredCount}, users ${
      readiness.observed.userCount
    }, best grid Pearson ${formatMaybe(
      readiness.observed.bestWeightPearson
    )}, holdout sessions ${readiness.observed.holdoutScoredCount}, holdout users ${
      readiness.observed.holdoutUserCount
    }, holdout Pearson ${formatMaybe(readiness.observed.holdoutWeightPearson)}`
  );
  for (const finding of readiness.findings) {
    console.log(`- ${finding}`);
  }
  if (cohortDiagnostic) {
    console.log("");
    console.log("## Broad Cohort Diagnostic");
    console.log("");
    console.log(cohortDiagnostic.warning);
    console.log("");
    console.log(`- Sanity-check verdict: ${cohortSanityCheck.verdict}`);
    console.log("- Production evidence: false");
    console.log(
      `- Criteria: cohort scored sessions >= ${cohortSanityCheck.criteria.minScoredSessions}, users >= ${cohortSanityCheck.criteria.minUsers}, current Pearson >= ${cohortSanityCheck.criteria.minPearson.toFixed(
        3
      )}`
    );
    for (const finding of cohortSanityCheck.findings) {
      console.log(`- ${finding}`);
    }
    console.log("");
    console.log(`- Profile scope: ${cohortDiagnostic.profileScope}`);
    console.log(`- History mode: ${cohortDiagnostic.historyMode}`);
    console.log(
      `- Minimum same-break-type cohort history: ${cohortDiagnostic.minHistory}`
    );
    console.log(
      `- Cohort scored sessions: ${cohortDiagnostic.summary.scoredCount}`
    );
    console.log(
      `- Cohort scored users represented: ${cohortDiagnostic.summary.userCount}`
    );
    console.log(
      `- Cohort Pearson(score, rating): ${formatMaybe(
        cohortDiagnostic.summary.scorePearson
      )}`
    );
    console.log(
      `- Cohort Spearman(score, rating): ${formatMaybe(
        cohortDiagnostic.summary.scoreSpearman
      )}`
    );
    console.log("");
    console.log("| Component closeness | Pearson | Spearman | Current weight |");
    console.log("|---------------------|---------|----------|----------------|");
    for (const component of componentOrder()) {
      console.log(
        `| ${componentLabel(component)} | ${formatMaybe(
          cohortDiagnostic.summary.componentPearson[component]
        )} | ${formatMaybe(
          cohortDiagnostic.summary.componentSpearman[component]
        )} | ${formatWeight(DEFAULT_MATCH_WEIGHTS[component])} |`
      );
    }
  }
}

function scoredSessionLabel(historyMode: MatchHistoryMode): string {
  return historyMode === "leave-one-out"
    ? "Leave-one-out scored sessions"
    : "Prior-history scored sessions";
}

export function buildMatchHeuristicValidationReport(
  summary: ValidationSummary,
  options: CliOptions,
  rpcFloorDiagnostic: MatchHeuristicRpcFloorDiagnostic,
  generatedAt = new Date().toISOString(),
  ratingInventory: RatingInventory | null = null,
  cohortDiagnostic: MatchHeuristicCohortDiagnostic | null = null,
  measurementWindow: MatchHeuristicMeasurementWindow =
    buildMatchHeuristicMeasurementWindow(options.months, new Date(generatedAt))
): MatchHeuristicValidationReport {
  return {
    reportSchemaVersion: MATCH_HEURISTIC_VALIDATION_SCHEMA_VERSION,
    generatedAt,
    measurementWindow,
    options: {
      months: options.months,
      minHistory: options.minHistory,
      historyMode: options.historyMode,
      minScoredSessions: options.minScoredSessions,
      minUsers: options.minUsers,
      minPearson: options.minPearson,
    },
    currentWeights: { ...DEFAULT_MATCH_WEIGHTS },
    ratingInventory,
    summary,
    rpcFloorDiagnostic,
    cohortDiagnostic,
    cohortSanityCheck: buildCohortSanityCheck(cohortDiagnostic, options),
    currentHeuristicValidation: buildCurrentHeuristicValidation(
      summary,
      options
    ),
    reweightingReadiness: buildReweightingReadiness(summary, options),
  };
}

export function validateMatchHeuristicValidationReport(
  report: unknown,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): MatchHeuristicValidationReportValidationResult {
  const blockers: string[] = [];
  const serializedReport = JSON.stringify(report) ?? "";
  if (UUID_PATTERN.test(serializedReport)) {
    blockers.push("report_contains_uuid");
  }

  if (!isRecord(report)) {
    return {
      ok: false,
      blockers: [...blockers, "report_not_object"],
    };
  }

  if (
    report.reportSchemaVersion !== MATCH_HEURISTIC_VALIDATION_SCHEMA_VERSION
  ) {
    blockers.push("report_schema_version_invalid");
  }
  validateGeneratedAt(report.generatedAt, options, blockers);
  validateMeasurementWindow(
    report.measurementWindow,
    report.options,
    report.generatedAt,
    options,
    blockers
  );
  validateReportOptions(report.options, blockers);
  validateCurrentWeights(report.currentWeights, blockers);
  validateRatingInventory(report.ratingInventory, blockers);
  validateSummary(report.summary, "summary", blockers);
  validateRpcFloorDiagnostic(report.rpcFloorDiagnostic, report.summary, blockers);
  validateCohortDiagnostic(report.cohortDiagnostic, blockers);
  validateCohortSanityCheck(
    report.cohortSanityCheck,
    report.cohortDiagnostic,
    blockers
  );
  validateCurrentHeuristicBlock(report.currentHeuristicValidation, blockers);
  validateReweightingReadinessBlock(report.reweightingReadiness, blockers);

  return {
    ok: blockers.length === 0,
    blockers,
  };
}

export function validateMatchHeuristicValidationReportFile(
  inputJsonPath: string,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): MatchHeuristicValidationReportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(inputJsonPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      blockers: [
        `report_json_unreadable:${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  return validateMatchHeuristicValidationReport(parsed, options);
}

export function writeMatchHeuristicValidationReportJson(
  outputJsonPath: string,
  report: MatchHeuristicValidationReport
): string {
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`);
  return resolvedPath;
}

function validateGeneratedAt(
  generatedAt: unknown,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(generatedAt)) {
    blockers.push("generated_at_invalid");
    return;
  }

  const now = options.now ?? new Date();
  const generatedAtDate = new Date(generatedAt);
  const ageMs = now.getTime() - generatedAtDate.getTime();
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    blockers.push("generated_at_in_future");
  }
  if (
    typeof options.maxReportAgeHours === "number" &&
    ageMs > options.maxReportAgeHours * 60 * 60 * 1000
  ) {
    blockers.push("generated_at_too_old");
  }
}

function validateMeasurementWindow(
  measurementWindow: unknown,
  reportOptions: unknown,
  generatedAt: unknown,
  validationOptions: {
    maxReportAgeHours?: number | null;
  },
  blockers: string[]
): void {
  if (!isRecord(measurementWindow)) {
    blockers.push("measurement_window_invalid");
    return;
  }

  const start = measurementWindow.start;
  const end = measurementWindow.end;
  const months = measurementWindow.months;
  if (!isUtcTimestamp(start) || !isUtcTimestamp(end)) {
    blockers.push("measurement_window_invalid");
    return;
  }
  if (!isPositiveInteger(months)) {
    blockers.push("measurement_window_months_invalid");
    return;
  }
  if (Date.parse(start) >= Date.parse(end)) {
    blockers.push("measurement_window_invalid");
  }

  if (isRecord(reportOptions) && reportOptions.months !== months) {
    blockers.push("measurement_window_options_mismatch");
  }

  const expectedStart = buildMatchHeuristicMeasurementWindow(
    months,
    new Date(end)
  ).start;
  if (start !== expectedStart) {
    blockers.push("measurement_window_months_mismatch");
  }

  if (!isUtcTimestamp(generatedAt)) {
    return;
  }

  const ageMs = Date.parse(generatedAt) - Date.parse(end);
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    blockers.push("measurement_end_after_generated_at");
  }
  if (
    typeof validationOptions.maxReportAgeHours === "number" &&
    ageMs > validationOptions.maxReportAgeHours * 60 * 60 * 1000
  ) {
    blockers.push("measurement_end_too_old");
  }
}

function validateReportOptions(options: unknown, blockers: string[]): void {
  if (!isRecord(options)) {
    blockers.push("options_invalid");
    return;
  }

  if (!isPositiveInteger(options.months)) {
    blockers.push("options_months_invalid");
  }
  if (!isNonNegativeIntegerValue(options.minHistory)) {
    blockers.push("options_min_history_invalid");
  }
  if (!isHistoryMode(options.historyMode)) {
    blockers.push("options_history_mode_invalid");
  }
  if (!isPositiveInteger(options.minScoredSessions)) {
    blockers.push("options_min_scored_sessions_invalid");
  }
  if (!isPositiveInteger(options.minUsers)) {
    blockers.push("options_min_users_invalid");
  }
  if (
    typeof options.minPearson !== "number" ||
    !Number.isFinite(options.minPearson) ||
    options.minPearson <= 0 ||
    options.minPearson > 1
  ) {
    blockers.push("options_min_pearson_invalid");
  }
}

function validateCurrentWeights(weights: unknown, blockers: string[]): void {
  if (!isRecord(weights)) {
    blockers.push("current_weights_invalid");
    return;
  }

  for (const component of componentOrder()) {
    if (weights[component] !== DEFAULT_MATCH_WEIGHTS[component]) {
      blockers.push("current_weights_mismatch");
      return;
    }
  }
}

function validateRatingInventory(
  inventory: unknown,
  blockers: string[]
): void {
  if (inventory === null) {
    return;
  }
  if (!isRecord(inventory)) {
    blockers.push("rating_inventory_invalid");
    return;
  }

  const countFields = [
    "rawRatedSessionCount",
    "rawRatedUserCount",
    "realProfileRatedSessionCount",
    "realProfileUserCount",
    "excludedProfileSessionCount",
    "missingForecastSnapshotSessionCount",
    "loadedRatedSessionCount",
    "loadedUserCount",
  ] as const;
  for (const field of countFields) {
    if (!isNonNegativeIntegerValue(inventory[field])) {
      blockers.push("rating_inventory_invalid");
      return;
    }
  }

  const counts = inventory as Record<(typeof countFields)[number], number>;
  if (
    counts.realProfileRatedSessionCount > counts.rawRatedSessionCount ||
    counts.loadedRatedSessionCount > counts.realProfileRatedSessionCount ||
    counts.realProfileUserCount > counts.rawRatedUserCount ||
    counts.loadedUserCount > counts.realProfileUserCount
  ) {
    blockers.push("rating_inventory_counts_inconsistent");
  }
}

function validateSummary(
  summary: unknown,
  blockerPrefix: string,
  blockers: string[]
): void {
  if (!isRecord(summary)) {
    blockers.push(`${blockerPrefix}_invalid`);
    return;
  }

  const countFields = [
    "loadedCount",
    "usableCount",
    "scoredCount",
    "loadedUserCount",
    "userCount",
  ] as const;
  for (const field of countFields) {
    if (!isNonNegativeIntegerValue(summary[field])) {
      blockers.push(`${blockerPrefix}_${field}_invalid`);
    }
  }

  if (
    isNonNegativeIntegerValue(summary.loadedCount) &&
    isNonNegativeIntegerValue(summary.usableCount) &&
    summary.usableCount > summary.loadedCount
  ) {
    blockers.push(`${blockerPrefix}_usable_count_inconsistent`);
  }
  if (
    isNonNegativeIntegerValue(summary.usableCount) &&
    isNonNegativeIntegerValue(summary.scoredCount) &&
    summary.scoredCount > summary.usableCount
  ) {
    blockers.push(`${blockerPrefix}_scored_count_inconsistent`);
  }
  if (
    isNonNegativeIntegerValue(summary.loadedUserCount) &&
    isNonNegativeIntegerValue(summary.userCount) &&
    summary.userCount > summary.loadedUserCount
  ) {
    blockers.push(`${blockerPrefix}_user_count_inconsistent`);
  }

  for (const field of [
    "scorePearson",
    "scoreSpearman",
    "bestWeightPearson",
    "currentWeightPearson",
  ] as const) {
    if (!isCorrelationOrNull(summary[field])) {
      blockers.push(`${blockerPrefix}_${field}_invalid`);
    }
  }
  validateComponentCorrelationMap(
    summary.componentPearson,
    `${blockerPrefix}_component_pearson`,
    blockers
  );
  validateComponentCorrelationMap(
    summary.componentSpearman,
    `${blockerPrefix}_component_spearman`,
    blockers
  );
  if (summary.bestWeights !== null) {
    validateWeightSet(
      summary.bestWeights,
      `${blockerPrefix}_best_weights`,
      blockers
    );
  }
  validateWeightHoldout(
    summary.reweightingHoldout,
    summary,
    `${blockerPrefix}_reweighting_holdout`,
    blockers
  );
  validateRatingBuckets(summary.ratingBuckets, blockerPrefix, blockers);
}

function validateWeightHoldout(
  value: unknown,
  summary: Record<string, unknown>,
  blockerPrefix: string,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push(`${blockerPrefix}_invalid`);
    return;
  }
  if (value.strategy !== "user-deterministic-80-20") {
    blockers.push(`${blockerPrefix}_strategy_invalid`);
  }
  for (const field of [
    "trainScoredCount",
    "trainUserCount",
    "holdoutScoredCount",
    "holdoutUserCount",
  ] as const) {
    if (!isNonNegativeIntegerValue(value[field])) {
      blockers.push(`${blockerPrefix}_${field}_invalid`);
    }
  }
  for (const field of ["trainPearson", "holdoutPearson"] as const) {
    if (!isCorrelationOrNull(value[field])) {
      blockers.push(`${blockerPrefix}_${field}_invalid`);
    }
  }
  if (value.trainedWeights !== null) {
    validateWeightSet(
      value.trainedWeights,
      `${blockerPrefix}_trained_weights`,
      blockers
    );
  }
  if (
    isNonNegativeIntegerValue(value.trainScoredCount) &&
    isNonNegativeIntegerValue(value.holdoutScoredCount) &&
    isNonNegativeIntegerValue(summary.scoredCount) &&
    value.trainScoredCount + value.holdoutScoredCount !== summary.scoredCount
  ) {
    blockers.push(`${blockerPrefix}_scored_count_inconsistent`);
  }
  if (
    isNonNegativeIntegerValue(value.trainUserCount) &&
    isNonNegativeIntegerValue(value.holdoutUserCount) &&
    isNonNegativeIntegerValue(summary.userCount) &&
    value.trainUserCount + value.holdoutUserCount !== summary.userCount
  ) {
    blockers.push(`${blockerPrefix}_user_count_inconsistent`);
  }
}

function validateRpcFloorDiagnostic(
  diagnostic: unknown,
  reportSummary: unknown,
  blockers: string[]
): void {
  if (!isRecord(diagnostic)) {
    blockers.push("rpc_floor_diagnostic_invalid");
    return;
  }
  if (diagnostic.profileScope !== "user") {
    blockers.push("rpc_floor_diagnostic_profile_scope_invalid");
  }
  if (diagnostic.historyMode !== "prior-only") {
    blockers.push("rpc_floor_diagnostic_history_mode_invalid");
  }
  if (diagnostic.minHistory !== RPC_FLOOR_DIAGNOSTIC_MIN_HISTORY) {
    blockers.push("rpc_floor_diagnostic_min_history_invalid");
  }
  if (diagnostic.productionEvidence !== false) {
    blockers.push("rpc_floor_diagnostic_production_evidence_not_false");
  }
  if (typeof diagnostic.warning !== "string") {
    blockers.push("rpc_floor_diagnostic_warning_invalid");
  }
  validateSummary(diagnostic.summary, "rpc_floor_summary", blockers);

  if (!isRecord(reportSummary) || !isRecord(diagnostic.summary)) {
    return;
  }
  if (
    diagnostic.summary.loadedCount !== reportSummary.loadedCount ||
    diagnostic.summary.usableCount !== reportSummary.usableCount ||
    diagnostic.summary.loadedUserCount !== reportSummary.loadedUserCount
  ) {
    blockers.push("rpc_floor_summary_loaded_sample_mismatch");
  }
}

function validateCohortDiagnostic(
  diagnostic: unknown,
  blockers: string[]
): void {
  if (diagnostic === null) {
    return;
  }
  if (!isRecord(diagnostic)) {
    blockers.push("cohort_diagnostic_invalid");
    return;
  }
  if (diagnostic.profileScope !== "cohort") {
    blockers.push("cohort_diagnostic_profile_scope_invalid");
  }
  if (diagnostic.historyMode !== "leave-one-out") {
    blockers.push("cohort_diagnostic_history_mode_invalid");
  }
  if (!isNonNegativeIntegerValue(diagnostic.minHistory)) {
    blockers.push("cohort_diagnostic_min_history_invalid");
  }
  if (typeof diagnostic.warning !== "string") {
    blockers.push("cohort_diagnostic_warning_invalid");
  }
  validateSummary(diagnostic.summary, "cohort_summary", blockers);
}

function validateCohortSanityCheck(
  sanityCheck: unknown,
  cohortDiagnostic: unknown,
  blockers: string[]
): void {
  if (!isRecord(sanityCheck)) {
    blockers.push("cohort_sanity_check_invalid");
    return;
  }
  if (
    sanityCheck.verdict !== "aligned" &&
    sanityCheck.verdict !== "not-aligned" &&
    sanityCheck.verdict !== "insufficient-signal"
  ) {
    blockers.push("cohort_sanity_verdict_invalid");
  }
  if (sanityCheck.productionEvidence !== false) {
    blockers.push("cohort_sanity_production_evidence_not_false");
  }
  validateCohortSanityCriteria(sanityCheck.criteria, blockers);
  validateObserved(sanityCheck.observed, "cohort_sanity", blockers, [
    "currentWeightPearson",
    "currentWeightSpearman",
    "bestWeightPearson",
  ]);
  validateStringArray(
    sanityCheck.findings,
    "cohort_sanity_findings",
    blockers
  );
  validateFindingCodes(
    sanityCheck.findingCodes,
    "cohort_sanity_finding_codes",
    [
      "cohort_diagnostic_missing",
      "cohort_scored_sessions_floor",
      "cohort_scored_users_floor",
      "cohort_current_weight_pearson_unavailable",
      "cohort_current_weight_pearson_floor",
      "cohort_current_weights_aligned",
      "cohort_not_production_evidence",
    ],
    blockers
  );

  if (
    sanityCheck.verdict === "aligned" &&
    Array.isArray(sanityCheck.findingCodes) &&
    !sanityCheck.findingCodes.includes("cohort_current_weights_aligned")
  ) {
    blockers.push("cohort_sanity_aligned_code_missing");
  }
  if (
    Array.isArray(sanityCheck.findingCodes) &&
    !sanityCheck.findingCodes.includes("cohort_not_production_evidence")
  ) {
    blockers.push("cohort_sanity_non_production_code_missing");
  }

  if (!isRecord(cohortDiagnostic)) {
    return;
  }
  const diagnosticSummary = isRecord(cohortDiagnostic.summary)
    ? cohortDiagnostic.summary
    : null;
  const observed = isRecord(sanityCheck.observed)
    ? sanityCheck.observed
    : null;
  const criteria = isRecord(sanityCheck.criteria)
    ? sanityCheck.criteria
    : null;

  if (
    criteria &&
    isNonNegativeIntegerValue(cohortDiagnostic.minHistory) &&
    criteria.minHistory !== cohortDiagnostic.minHistory
  ) {
    blockers.push("cohort_sanity_min_history_mismatch");
  }
  if (!diagnosticSummary || !observed) {
    return;
  }
  if (
    observed.scoredCount !== diagnosticSummary.scoredCount ||
    observed.userCount !== diagnosticSummary.userCount ||
    observed.currentWeightPearson !== diagnosticSummary.currentWeightPearson ||
    observed.currentWeightSpearman !== diagnosticSummary.scoreSpearman ||
    observed.bestWeightPearson !== diagnosticSummary.bestWeightPearson
  ) {
    blockers.push("cohort_sanity_observed_mismatch");
  }
}

function validateCohortSanityCriteria(
  criteria: unknown,
  blockers: string[]
): void {
  if (!isRecord(criteria)) {
    blockers.push("cohort_sanity_criteria_invalid");
    return;
  }
  if (criteria.profileScope !== "cohort") {
    blockers.push("cohort_sanity_criteria_profile_scope_invalid");
  }
  if (criteria.historyMode !== "leave-one-out") {
    blockers.push("cohort_sanity_criteria_history_mode_invalid");
  }
  if (!isNonNegativeIntegerValue(criteria.minHistory)) {
    blockers.push("cohort_sanity_criteria_min_history_invalid");
  }
  if (!isPositiveInteger(criteria.minScoredSessions)) {
    blockers.push("cohort_sanity_criteria_min_scored_sessions_invalid");
  }
  if (!isPositiveInteger(criteria.minUsers)) {
    blockers.push("cohort_sanity_criteria_min_users_invalid");
  }
  if (
    typeof criteria.minPearson !== "number" ||
    !Number.isFinite(criteria.minPearson) ||
    criteria.minPearson <= 0 ||
    criteria.minPearson > 1
  ) {
    blockers.push("cohort_sanity_criteria_min_pearson_invalid");
  }
}

function validateCurrentHeuristicBlock(
  validation: unknown,
  blockers: string[]
): void {
  if (!isRecord(validation)) {
    blockers.push("current_heuristic_validation_invalid");
    return;
  }
  if (
    validation.verdict !== "validated" &&
    validation.verdict !== "not-validated"
  ) {
    blockers.push("current_heuristic_verdict_invalid");
  }
  validateCriteria(validation.criteria, "current_heuristic", blockers);
  validateObserved(validation.observed, "current_heuristic", blockers, [
    "currentWeightPearson",
    "currentWeightSpearman",
  ]);
  validateStringArray(
    validation.findings,
    "current_heuristic_findings",
    blockers
  );
  validateFindingCodes(
    validation.findingCodes,
    "current_heuristic_finding_codes",
    [
      "current_scored_sessions_floor",
      "current_scored_users_floor",
      "current_weight_pearson_unavailable",
      "current_weight_pearson_floor",
      "current_weights_validated",
    ],
    blockers
  );
  if (
    validation.verdict === "validated" &&
    Array.isArray(validation.findingCodes) &&
    !validation.findingCodes.includes("current_weights_validated")
  ) {
    blockers.push("current_heuristic_validated_code_missing");
  }
}

function validateReweightingReadinessBlock(
  readiness: unknown,
  blockers: string[]
): void {
  if (!isRecord(readiness)) {
    blockers.push("reweighting_readiness_invalid");
    return;
  }
  if (readiness.verdict !== "candidate" && readiness.verdict !== "not-ready") {
    blockers.push("reweighting_verdict_invalid");
  }
  if (typeof readiness.readyForExperiment !== "boolean") {
    blockers.push("reweighting_ready_for_experiment_invalid");
  }
  if (readiness.readyForProduction !== false) {
    blockers.push("reweighting_ready_for_production_not_false");
  }
  validateCriteria(readiness.criteria, "reweighting", blockers);
  validateObserved(readiness.observed, "reweighting", blockers, [
    "bestWeightPearson",
  ]);
  validateStringArray(readiness.findings, "reweighting_findings", blockers);
  validateFindingCodes(
    readiness.findingCodes,
    "reweighting_finding_codes",
    [
      "scored_sessions_floor",
      "scored_users_floor",
      "best_grid_pearson_unavailable",
      "best_grid_pearson_floor",
      "holdout_grid_pearson_unavailable",
      "holdout_grid_pearson_floor",
      "reweighting_candidate_not_production_approval",
    ],
    blockers
  );
  if (isRecord(readiness.observed)) {
    if (!isNonNegativeIntegerValue(readiness.observed.holdoutScoredCount)) {
      blockers.push("reweighting_observed_holdout_scored_count_invalid");
    }
    if (!isNonNegativeIntegerValue(readiness.observed.holdoutUserCount)) {
      blockers.push("reweighting_observed_holdout_user_count_invalid");
    }
    if (!isCorrelationOrNull(readiness.observed.holdoutWeightPearson)) {
      blockers.push("reweighting_observed_holdoutWeightPearson_invalid");
    }
  }
  if (
    (readiness.verdict === "candidate") !==
    (readiness.readyForExperiment === true)
  ) {
    blockers.push("reweighting_verdict_experiment_mismatch");
  }
}

function validateCriteria(
  criteria: unknown,
  blockerPrefix: string,
  blockers: string[]
): void {
  if (!isRecord(criteria)) {
    blockers.push(`${blockerPrefix}_criteria_invalid`);
    return;
  }
  if (!isHistoryMode(criteria.historyMode)) {
    blockers.push(`${blockerPrefix}_criteria_history_mode_invalid`);
  }
  if (!isPositiveInteger(criteria.minScoredSessions)) {
    blockers.push(`${blockerPrefix}_criteria_min_scored_sessions_invalid`);
  }
  if (!isPositiveInteger(criteria.minUsers)) {
    blockers.push(`${blockerPrefix}_criteria_min_users_invalid`);
  }
  if (
    typeof criteria.minPearson !== "number" ||
    !Number.isFinite(criteria.minPearson) ||
    criteria.minPearson <= 0 ||
    criteria.minPearson > 1
  ) {
    blockers.push(`${blockerPrefix}_criteria_min_pearson_invalid`);
  }
}

function validateObserved(
  observed: unknown,
  blockerPrefix: string,
  blockers: string[],
  correlationFields: string[]
): void {
  if (!isRecord(observed)) {
    blockers.push(`${blockerPrefix}_observed_invalid`);
    return;
  }
  if (!isNonNegativeIntegerValue(observed.scoredCount)) {
    blockers.push(`${blockerPrefix}_observed_scored_count_invalid`);
  }
  if (!isNonNegativeIntegerValue(observed.userCount)) {
    blockers.push(`${blockerPrefix}_observed_user_count_invalid`);
  }
  for (const field of correlationFields) {
    if (!isCorrelationOrNull(observed[field])) {
      blockers.push(`${blockerPrefix}_observed_${field}_invalid`);
    }
  }
}

function validateComponentCorrelationMap(
  value: unknown,
  blockerPrefix: string,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push(`${blockerPrefix}_invalid`);
    return;
  }
  for (const component of componentOrder()) {
    if (!isCorrelationOrNull(value[component])) {
      blockers.push(`${blockerPrefix}_${component}_invalid`);
    }
  }
}

function validateWeightSet(
  value: unknown,
  blockerPrefix: string,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push(`${blockerPrefix}_invalid`);
    return;
  }
  let total = 0;
  for (const component of componentOrder()) {
    const weight = value[component];
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      blockers.push(`${blockerPrefix}_${component}_invalid`);
      return;
    }
    total += weight;
  }
  if (Math.abs(total - 1) > 0.001) {
    blockers.push(`${blockerPrefix}_sum_invalid`);
  }
}

function validateRatingBuckets(
  value: unknown,
  blockerPrefix: string,
  blockers: string[]
): void {
  if (!Array.isArray(value)) {
    blockers.push(`${blockerPrefix}_rating_buckets_invalid`);
    return;
  }
  for (const bucket of value) {
    if (
      !isRecord(bucket) ||
      !isPositiveInteger(bucket.rating) ||
      bucket.rating > 5 ||
      !isNonNegativeIntegerValue(bucket.count) ||
      typeof bucket.averageScore !== "number" ||
      !Number.isFinite(bucket.averageScore) ||
      bucket.averageScore < 0 ||
      bucket.averageScore > 10
    ) {
      blockers.push(`${blockerPrefix}_rating_buckets_invalid`);
      return;
    }
  }
}

function validateStringArray(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    blockers.push(blockerCode);
  }
}

function validateFindingCodes(
  value: unknown,
  blockerCode: string,
  allowedCodes: readonly string[],
  blockers: string[]
): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (code) => typeof code !== "string" || !allowedCodes.includes(code)
    )
  ) {
    blockers.push(blockerCode);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHistoryMode(value: unknown): value is MatchHistoryMode {
  return value === "prior-only" || value === "leave-one-out";
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function isNonNegativeIntegerValue(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isCorrelationOrNull(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= -1 &&
      value <= 1)
  );
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function componentOrder(): MatchComponent[] {
  return ["wave", "period", "wind", "tide", "windDir"];
}

function componentLabel(component: MatchComponent): string {
  switch (component) {
    case "wave":
      return "Wave height";
    case "period":
      return "Period";
    case "wind":
      return "Wind speed";
    case "tide":
      return "Tide";
    case "windDir":
      return "Wind direction";
  }
}

function formatWeight(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatMaybe(value: number | null): string {
  return value == null ? "n/a" : value.toFixed(3);
}

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/validate-match-score-heuristic.ts [--months 12]
  yarn tsx scripts/validate-match-score-heuristic.ts --min-history 5
  yarn tsx scripts/validate-match-score-heuristic.ts --history-mode prior-only
  yarn tsx scripts/validate-match-score-heuristic.ts --history-mode leave-one-out
  yarn tsx scripts/validate-match-score-heuristic.ts --min-scored-sessions 100 --min-users 25 --min-pearson 0.2 --fail-on-not-ready
  yarn tsx scripts/validate-match-score-heuristic.ts --output-json /tmp/quiver-match-score-heuristic-validation.json
  yarn tsx scripts/validate-match-score-heuristic.ts --validate-output-json /tmp/quiver-match-score-heuristic-validation.json --max-report-age-hours 24`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.validateOutputJsonPath) {
    const result = validateMatchHeuristicValidationReportFile(
      options.validateOutputJsonPath,
      {
        maxReportAgeHours: options.maxReportAgeHours,
      }
    );
    if (!result.ok) {
      throw new Error(
        `Match heuristic validation report JSON failed validation:\n- ${result.blockers.join(
          "\n- "
        )}`
      );
    }
    console.log(
      `Match heuristic validation report JSON is valid: ${options.validateOutputJsonPath}`
    );
    return;
  }
  const supabase = createAdminClient();
  const generatedAtDate = new Date();
  const measurementWindow = buildMatchHeuristicMeasurementWindow(
    options.months,
    generatedAtDate
  );
  const { sessions, ratingInventory } = await fetchRatedSessionValidationInput(
    supabase,
    options,
    measurementWindow
  );
  const summary = validateMatchHeuristic(
    sessions,
    options.minHistory,
    options.historyMode
  );
  const rpcFloorDiagnostic = buildRpcFloorDiagnosticSummary(sessions);
  const cohortDiagnostic = buildCohortDiagnosticSummary(sessions);
  const readiness = buildReweightingReadiness(summary, options);
  if (options.outputJsonPath) {
    const outputPath = writeMatchHeuristicValidationReportJson(
      options.outputJsonPath,
      buildMatchHeuristicValidationReport(
        summary,
        options,
        rpcFloorDiagnostic,
        generatedAtDate.toISOString(),
        ratingInventory,
        cohortDiagnostic,
        measurementWindow
      )
    );
    console.error(`Wrote match heuristic validation JSON: ${outputPath}`);
  }
  printReport(
    summary,
    options,
    rpcFloorDiagnostic,
    ratingInventory,
    cohortDiagnostic,
    measurementWindow
  );
  if (options.failOnNotReady && !readiness.readyForExperiment) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
