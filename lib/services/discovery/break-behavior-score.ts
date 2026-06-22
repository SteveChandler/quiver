import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';
import type { EnhancedForecastEntity } from '@/types/forecast';

const BEHAVIOR_SCORE_CAP = 12;
const MIN_FORECAST_SCORE_FOR_BEHAVIOR_BOOST = 45;
const RECENT_ACTIVITY_TARGET = 8;
const LOW_COMPLETION_RATE_THRESHOLD = 0.35;
const DEFAULT_LOOKBACK_DAYS = 365;
const DEFAULT_LIMIT = 5000;
const PROFILE_CHUNK_SIZE = 400;

export interface BreakBehaviorSessionRow {
  beach_id: string | null;
  user_id: string | null;
  status: string | null;
  arrival_time: string | null;
  created_at: string | null;
  wave_height_ft: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  tide_status: string | null;
}

interface BreakBehaviorProfileRow {
  id: string;
  deleted_at: string | null;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
}

export interface BreakBehaviorAggregate {
  plannedSessions: number;
  completedSessions: number;
  uniqueUsers: number;
  repeatUsers: number;
  repeatCompletedSessionUsers: number;
  recentCompletedSessions: number;
  conditionObservedSessions: number;
  conditionMatchedSessions: number;
}

export interface BreakBehaviorScoreResult {
  score: number;
  confidenceLabel: 'sparse' | 'low' | 'medium' | 'high';
  components: {
    completedSessionRate: number;
    repeatUserRate: number;
    recentSessionActivity: number;
    conditionMatchHistory: number;
  };
  penalties: {
    sparseData: number;
    highIntentLowCompletion: number;
    staleBehavior: number;
  };
  reasons: string[];
}

export interface AppliedBreakBehaviorScore {
  score: number;
  appliedBehaviorScore: number;
  suppressed: boolean;
}

interface AggregateOptions {
  now?: Date;
}

interface FetchOptions {
  now?: Date;
  lookbackDays?: number;
  limit?: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const matches = value.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const values = matches.map(Number).filter(Number.isFinite);
  if (values.length === 0) {
    return null;
  }

  if (values.length >= 2 && /\d\s*(?:-|to)\s*\d/i.test(value)) {
    return (values[0] + values[1]) / 2;
  }

  return values[0];
}

const COMPASS_DEGREES: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function parseDirectionDegrees(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? normalizeDegrees(value) : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const compact = value.trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (!compact) {
    return null;
  }

  if (COMPASS_DEGREES[compact] !== undefined) {
    return COMPASS_DEGREES[compact];
  }

  const numeric = parseNumeric(value);
  return numeric === null ? null : normalizeDegrees(numeric);
}

function normalizeTide(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(diff, 360 - diff);
}

function isCompleted(status: string | null): boolean {
  return status === 'completed';
}

function isRealProfile(profile: BreakBehaviorProfileRow | undefined): boolean {
  if (!profile) return true;
  if (profile.deleted_at !== null) return false;
  if (profile.is_mock === true) return false;
  if (profile.analytics_is_real_user === false) return false;
  if (profile.is_system_account === true) return false;
  return true;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchBehaviorProfiles(
  supabase: SupabaseClient<Database>,
  userIds: string[]
): Promise<Map<string, BreakBehaviorProfileRow>> {
  const rows: BreakBehaviorProfileRow[] = [];
  for (const chunk of chunkValues(userIds, PROFILE_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,deleted_at,is_mock,analytics_is_real_user,is_system_account')
      .in('id', chunk);

    if (error) {
      return new Map();
    }

    rows.push(...((data ?? []) as BreakBehaviorProfileRow[]));
  }

  return new Map(rows.map((row) => [row.id, row]));
}

function isRecentCompleted(row: BreakBehaviorSessionRow, now: Date): boolean {
  if (!isCompleted(row.status)) return false;
  const timestamp = row.arrival_time ?? row.created_at;
  if (!timestamp) return false;

  const sessionTime = new Date(timestamp).getTime();
  if (!Number.isFinite(sessionTime)) return false;

  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return now.getTime() - sessionTime <= ninetyDaysMs;
}

function forecastCondition(forecast: EnhancedForecastEntity): {
  waveHeight: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  tideStatus: string | null;
} {
  return {
    waveHeight: parseNumeric(forecast.wave_height),
    windSpeed: parseNumeric(forecast.wind_speed),
    windDirection: parseDirectionDegrees(
      forecast.wind_direction_deg ?? forecast.wind_direction
    ),
    tideStatus: normalizeTide(forecast.tide_status),
  };
}

function rowMatchesForecastCondition(
  row: BreakBehaviorSessionRow,
  forecast: EnhancedForecastEntity
): boolean | null {
  const target = forecastCondition(forecast);
  const comparisons: boolean[] = [];

  if (row.wave_height_ft !== null && target.waveHeight !== null) {
    comparisons.push(Math.abs(row.wave_height_ft - target.waveHeight) <= 1);
  }

  if (row.wind_speed_mph !== null && target.windSpeed !== null) {
    comparisons.push(Math.abs(row.wind_speed_mph - target.windSpeed) <= 5);
  }

  const rowWindDirection = parseDirectionDegrees(row.wind_direction);
  if (rowWindDirection !== null && target.windDirection !== null) {
    comparisons.push(angularDistance(rowWindDirection, target.windDirection) <= 45);
  }

  const rowTide = normalizeTide(row.tide_status);
  if (rowTide !== null && target.tideStatus !== null) {
    comparisons.push(rowTide === target.tideStatus);
  }

  if (comparisons.length < 2) {
    return null;
  }

  return comparisons.every(Boolean);
}

function confidenceLabelFor(
  aggregate: BreakBehaviorAggregate
): BreakBehaviorScoreResult['confidenceLabel'] {
  if (aggregate.plannedSessions < 5 || aggregate.completedSessions < 3) {
    return 'sparse';
  }

  if (aggregate.plannedSessions < 10 || aggregate.completedSessions < 5) {
    return 'low';
  }

  if (aggregate.plannedSessions < 20 || aggregate.completedSessions < 10) {
    return 'medium';
  }

  return 'high';
}

export function aggregateBreakBehaviorSessions(
  rows: BreakBehaviorSessionRow[],
  forecast: EnhancedForecastEntity,
  options: AggregateOptions = {}
): BreakBehaviorAggregate {
  const now = options.now ?? new Date();
  const allUserCounts = new Map<string, number>();
  const completedUserCounts = new Map<string, number>();
  let completedSessions = 0;
  let recentCompletedSessions = 0;
  let conditionObservedSessions = 0;
  let conditionMatchedSessions = 0;

  for (const row of rows) {
    if (row.user_id) {
      allUserCounts.set(row.user_id, (allUserCounts.get(row.user_id) ?? 0) + 1);
    }

    if (!isCompleted(row.status)) {
      continue;
    }

    completedSessions += 1;
    if (row.user_id) {
      completedUserCounts.set(
        row.user_id,
        (completedUserCounts.get(row.user_id) ?? 0) + 1
      );
    }

    if (isRecentCompleted(row, now)) {
      recentCompletedSessions += 1;
    }

    const conditionMatch = rowMatchesForecastCondition(row, forecast);
    if (conditionMatch !== null) {
      conditionObservedSessions += 1;
      if (conditionMatch) {
        conditionMatchedSessions += 1;
      }
    }
  }

  return {
    plannedSessions: rows.length,
    completedSessions,
    uniqueUsers: allUserCounts.size,
    repeatUsers: Array.from(allUserCounts.values()).filter((count) => count >= 2).length,
    repeatCompletedSessionUsers: Array.from(completedUserCounts.values()).filter(
      (count) => count >= 2
    ).length,
    recentCompletedSessions,
    conditionObservedSessions,
    conditionMatchedSessions,
  };
}

export function calculateBreakBehaviorScore(
  aggregate: BreakBehaviorAggregate
): BreakBehaviorScoreResult {
  const completedSessionRate =
    aggregate.plannedSessions > 0
      ? aggregate.completedSessions / aggregate.plannedSessions
      : 0;
  const repeatUserRate =
    aggregate.uniqueUsers > 0
      ? aggregate.repeatCompletedSessionUsers / aggregate.uniqueUsers
      : 0;
  const recentSessionActivity = Math.min(
    aggregate.recentCompletedSessions / RECENT_ACTIVITY_TARGET,
    1
  );
  const conditionMatchHistory =
    aggregate.conditionObservedSessions >= 3
      ? aggregate.conditionMatchedSessions / aggregate.conditionObservedSessions
      : 0;

  const components = {
    completedSessionRate: clamp(completedSessionRate, 0, 1),
    repeatUserRate: clamp(repeatUserRate, 0, 1),
    recentSessionActivity: clamp(recentSessionActivity, 0, 1),
    conditionMatchHistory: clamp(conditionMatchHistory, 0, 1),
  };

  const confidenceLabel = confidenceLabelFor(aggregate);
  const sparseDataPenalty = confidenceLabel === 'sparse' ? BEHAVIOR_SCORE_CAP : 0;
  const highIntentLowCompletionPenalty =
    aggregate.plannedSessions >= 5 &&
    components.completedSessionRate < LOW_COMPLETION_RATE_THRESHOLD
      ? ((LOW_COMPLETION_RATE_THRESHOLD - components.completedSessionRate) /
          LOW_COMPLETION_RATE_THRESHOLD) *
        4
      : 0;
  const staleBehaviorPenalty =
    aggregate.completedSessions >= 5 && aggregate.recentCompletedSessions === 0
      ? 2
      : 0;

  const rawScore =
    (components.completedSessionRate * 0.35 +
      components.repeatUserRate * 0.25 +
      components.recentSessionActivity * 0.2 +
      components.conditionMatchHistory * 0.2) *
    BEHAVIOR_SCORE_CAP;

  const score =
    sparseDataPenalty >= BEHAVIOR_SCORE_CAP
      ? 0
      : clamp(
          rawScore - highIntentLowCompletionPenalty - staleBehaviorPenalty,
          0,
          BEHAVIOR_SCORE_CAP
        );

  const reasons: string[] = [];
  if (aggregate.completedSessions >= 5 && components.completedSessionRate >= 0.6) {
    reasons.push('Completed-session history supports this break');
  }
  if (aggregate.repeatCompletedSessionUsers >= 2) {
    reasons.push('Repeat surfers come back here');
  }
  if (aggregate.recentCompletedSessions >= 3) {
    reasons.push('Recent sessions keep this signal fresh');
  }
  if (
    aggregate.conditionObservedSessions >= 3 &&
    components.conditionMatchHistory >= 0.4
  ) {
    reasons.push('Completed sessions match this forecast pattern');
  }
  if (highIntentLowCompletionPenalty > 0) {
    reasons.push('High planned volume has low completion');
  }
  if (sparseDataPenalty > 0) {
    reasons.push('Sparse session history; behavior boost suppressed');
  }
  if (staleBehaviorPenalty > 0) {
    reasons.push('Session behavior is stale');
  }

  return {
    score: Math.round(score * 10) / 10,
    confidenceLabel,
    components,
    penalties: {
      sparseData: sparseDataPenalty,
      highIntentLowCompletion: Math.round(highIntentLowCompletionPenalty * 10) / 10,
      staleBehavior: staleBehaviorPenalty,
    },
    reasons,
  };
}

export function applyBreakBehaviorScore(
  forecastScore: number,
  behavior: BreakBehaviorScoreResult,
  minForecastScoreForBoost = MIN_FORECAST_SCORE_FOR_BEHAVIOR_BOOST
): AppliedBreakBehaviorScore {
  if (forecastScore < minForecastScoreForBoost) {
    return {
      score: clamp(forecastScore, 0, 100),
      appliedBehaviorScore: 0,
      suppressed: true,
    };
  }

  const appliedBehaviorScore = clamp(behavior.score, 0, BEHAVIOR_SCORE_CAP);
  return {
    score: clamp(forecastScore + appliedBehaviorScore, 0, 100),
    appliedBehaviorScore,
    suppressed: false,
  };
}

export async function fetchBreakBehaviorSessionRows(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  options: FetchOptions = {}
): Promise<BreakBehaviorSessionRow[]> {
  const uniqueBeachIds = Array.from(new Set(beachIds.filter(Boolean)));
  if (uniqueBeachIds.length === 0) {
    return [];
  }

  const now = options.now ?? new Date();
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const lookbackStart = new Date(
    now.getTime() - lookbackDays * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(
        'beach_id,user_id,status,arrival_time,created_at,wave_height_ft,wind_speed_mph,wind_direction,tide_status'
      )
      .in('beach_id', uniqueBeachIds)
      .is('deleted_at', null)
      .gte('created_at', lookbackStart)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? DEFAULT_LIMIT);

    if (error) {
      return [];
    }

    const rows = (data ?? []) as BreakBehaviorSessionRow[];
    const userIds = Array.from(
      new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))
    );
    const profileById = await fetchBehaviorProfiles(supabase, userIds);

    return rows.filter((row) =>
      row.user_id ? isRealProfile(profileById.get(row.user_id)) : false
    );
  } catch {
    return [];
  }
}

export function groupBreakBehaviorRowsByBeach(
  rows: BreakBehaviorSessionRow[]
): Map<string, BreakBehaviorSessionRow[]> {
  const grouped = new Map<string, BreakBehaviorSessionRow[]>();
  for (const row of rows) {
    if (!row.beach_id) continue;
    const existing = grouped.get(row.beach_id) ?? [];
    existing.push(row);
    grouped.set(row.beach_id, existing);
  }
  return grouped;
}
