/**
 * Preference Learning Service
 *
 * Learns user surf preferences from session history by keeping condition
 * signals separate:
 * - wave_quality teaches wave size/period preference
 * - rating teaches overall enjoyment
 * - actual logged condition fields win over forecast snapshots
 *
 * Algorithm:
 * - Wave ranges: 10th-90th percentile of good sessions
 * - Wind tolerance: 90th percentile
 * - Wind directions: Mode detection with cardinal clustering (15% frequency)
 * - Tide preferences: Mode detection (20% frequency threshold)
 * - Confidence: Sigmoid function based on sample size
 *
 * Requires minimum 5 rated sessions for statistical validity.
 *
 * @see supabase/migrations/20251103000003_user_surf_preferences.sql
 * @see docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md Phase 5
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * User surf preferences (matches database schema)
 */
export interface UserSurfPreferences {
  wave_min_ft: number | null;
  wave_max_ft: number | null;
  wave_period_min_s: number | null;
  wave_period_max_s: number | null;
  max_wind_mph: number | null;
  preferred_wind_directions: number[] | null;
  preferred_tide_statuses: string[] | null;
  confidence: number;
  sample_size: number;
  eligible_session_count?: number;
  avoidance_by_beach?: AvoidanceByBeach;
  validated_at?: string | null;
  manual_override?: boolean | null;
}

export interface AvoidancePattern {
  negative_sample_size: number;
  confidence: number;
  wave_min_ft: number | null;
  wave_max_ft: number | null;
  period_min_s: number | null;
  period_max_s: number | null;
  wind_directions: number[] | null;
  tide_statuses: string[] | null;
  last_session_at: string | null;
}

export type AvoidanceByBeach = Record<string, AvoidancePattern>;

export interface AvoidanceForecastInput {
  wave_height?: number | string | null;
  wave_period?: number | string | null;
  wind_direction?: number | string | null;
  tide_status?: string | null;
}

/**
 * Session with forecast snapshot (for analysis)
 */
interface SessionWithConditions {
  id: string;
  session_id: string;
  forecast_snapshot: {
    wave_height: number | string | null;
    wave_height_ft?: number | string | null;
    wave_period: number | string | null;
    wave_period_s?: number | string | null;
    wind_speed: number | string | null;
    wind_speed_mph?: number | string | null;
    wind_direction: number | string | null;
    wind_direction_deg?: number | string | null;
    tide_status: string | null;
    tide_height?: number | string | null;
    tide_height_ft?: number | string | null;
    [key: string]: any;
  };
  actual_conditions: {
    rating?: number | string | null;
    wave_quality?: number | string | null;
    notes?: string | null;
    wave_height_ft?: number | string | null;
    wind_speed_mph?: number | string | null;
    wind_direction?: number | string | null;
    tide_status?: string | null;
    tide_height_ft?: number | string | null;
    [key: string]: any;
  } | null;
  session?: {
    id?: string | null;
    beach_id?: string | null;
    created_at?: string | null;
    status?: string | null;
    board_id?: string | null;
    board_snapshot?: Record<string, unknown> | null;
    goals?: string[] | null;
    notes?: string | null;
    source?: string | null;
    rating?: number | string | null;
    wave_quality?: number | string | null;
    wave_height_ft?: number | string | null;
    wind_speed_mph?: number | string | null;
    wind_direction?: string | null;
    tide_status?: string | null;
    recommendation_id?: string | null;
    recommendation_call_accuracy?: string | null;
    forecast_wave_height_ft?: number | string | null;
    forecast_tide_status?: string | null;
    wave_height_correct?: boolean | null;
    tide_status_correct?: boolean | null;
  } | Array<{
    id?: string | null;
    beach_id?: string | null;
    created_at?: string | null;
    status?: string | null;
    board_id?: string | null;
    board_snapshot?: Record<string, unknown> | null;
    goals?: string[] | null;
    notes?: string | null;
    source?: string | null;
    rating?: number | string | null;
    wave_quality?: number | string | null;
    wave_height_ft?: number | string | null;
    wind_speed_mph?: number | string | null;
    wind_direction?: string | null;
    tide_status?: string | null;
    recommendation_id?: string | null;
    recommendation_call_accuracy?: string | null;
    forecast_wave_height_ft?: number | string | null;
    forecast_tide_status?: string | null;
    wave_height_correct?: boolean | null;
    tide_status_correct?: boolean | null;
  }> | null;
  sessions?: {
    id?: string | null;
    beach_id?: string | null;
    created_at?: string | null;
    status?: string | null;
    board_id?: string | null;
    board_snapshot?: Record<string, unknown> | null;
    goals?: string[] | null;
    notes?: string | null;
    source?: string | null;
  } | Array<{
    id?: string | null;
    beach_id?: string | null;
    created_at?: string | null;
    status?: string | null;
    board_id?: string | null;
    board_snapshot?: Record<string, unknown> | null;
    goals?: string[] | null;
    notes?: string | null;
    source?: string | null;
  }> | null;
}

interface CompletedSessionRow {
  id: string;
  beach_id: string | null;
  created_at: string | null;
  status: string | null;
  notes: string | null;
  source: string | null;
}

const MIN_SIGNAL_SAMPLE_SIZE = 5;
const ENJOYED_RATING_MIN = 3;
const POSITIVE_WAVE_QUALITY_MIN = 4;
const NEGATIVE_WAVE_QUALITY_MAX = 2;
const LOW_CONFIDENCE_THRESHOLD = 0.5;
const SMALL_WAVE_MODALITY_MAX_FT = 2;
const SEED_SESSION_MARKERS = ['[SEED_SIMILARITY_V2]'];

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
  NORTH: 0,
  NORTHEAST: 45,
  EAST: 90,
  SOUTHEAST: 135,
  SOUTH: 180,
  SOUTHWEST: 225,
  WEST: 270,
  NORTHWEST: 315,
};

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Extract a numeric value from stored forecast fields.
 *
 * Production snapshots commonly store display strings such as "1 ft", "8s",
 * "4 mph", or ranges like "2-3 ft". The learner needs the numeric value,
 * not the display text.
 */
export function parseForecastNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedForNumbers = trimmed.replace(/(\d)\s*-\s*(\d)/g, '$1 to $2');
  const matches = normalizedForNumbers.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) {
    return null;
  }

  const numbers = matches.map(Number).filter(Number.isFinite);
  if (numbers.length === 0) {
    return null;
  }

  const looksLikeRange = /\d\s*(?:-|to)\s*\d/i.test(trimmed);
  if (looksLikeRange && numbers.length >= 2) {
    return (numbers[0] + numbers[1]) / 2;
  }

  return numbers[0];
}

/**
 * Convert stored wind direction values to degrees.
 *
 * Enhanced forecast snapshots may store numeric degrees, degree strings, or
 * compass labels such as "ESE".
 */
export function parseWindDirection(value: unknown): number | null {
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

  const numeric = parseForecastNumber(value);
  return numeric === null ? null : normalizeDegrees(numeric);
}

export function normalizeTideStatus(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function firstPresentValue(
  record: Record<string, unknown>,
  keys: readonly string[]
): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function getActualConditions(snapshot: SessionWithConditions): Record<string, unknown> {
  return asRecord(snapshot.actual_conditions);
}

function getForecastSnapshot(snapshot: SessionWithConditions): Record<string, unknown> {
  return asRecord(snapshot.forecast_snapshot);
}

function getSessionRelation(snapshot: SessionWithConditions): Record<string, unknown> {
  const relation = snapshot.session ?? snapshot.sessions;
  if (Array.isArray(relation)) {
    return asRecord(relation[0]);
  }

  return asRecord(relation);
}

function getSessionBeachId(snapshot: SessionWithConditions): string | null {
  const relation = getSessionRelation(snapshot);
  return typeof relation.beach_id === 'string' ? relation.beach_id : null;
}

function getSessionCreatedAt(snapshot: SessionWithConditions): string | null {
  const relation = getSessionRelation(snapshot);
  return typeof relation.created_at === 'string' ? relation.created_at : null;
}

function getSessionNumber(
  snapshot: SessionWithConditions,
  actualKeys: readonly string[],
  forecastKeys: readonly string[]
): number | null {
  const actual = parseForecastNumber(firstPresentValue(getActualConditions(snapshot), actualKeys));
  if (actual !== null) {
    return actual;
  }

  const session = parseForecastNumber(firstPresentValue(getSessionRelation(snapshot), actualKeys));
  if (session !== null) {
    return session;
  }

  return parseForecastNumber(firstPresentValue(getForecastSnapshot(snapshot), forecastKeys));
}

function getSessionWindDirection(snapshot: SessionWithConditions): number | null {
  const actual = parseWindDirection(
    firstPresentValue(getActualConditions(snapshot), ['wind_direction'])
  );
  if (actual !== null) {
    return actual;
  }

  const session = parseWindDirection(
    firstPresentValue(getSessionRelation(snapshot), ['wind_direction'])
  );
  if (session !== null) {
    return session;
  }

  return parseWindDirection(
    firstPresentValue(getForecastSnapshot(snapshot), ['wind_direction_deg', 'wind_direction'])
  );
}

function getSessionTideStatus(snapshot: SessionWithConditions): string | null {
  const actual = normalizeTideStatus(
    firstPresentValue(getActualConditions(snapshot), ['tide_status'])
  );
  if (actual) {
    return actual;
  }

  const session = normalizeTideStatus(
    firstPresentValue(getSessionRelation(snapshot), ['tide_status'])
  );
  if (session) {
    return session;
  }

  return normalizeTideStatus(
    firstPresentValue(getForecastSnapshot(snapshot), ['tide_status'])
  );
}

function getRating(snapshot: SessionWithConditions): number | null {
  const actual = parseForecastNumber(firstPresentValue(getActualConditions(snapshot), ['rating']));
  if (actual !== null) {
    return actual;
  }

  return parseForecastNumber(firstPresentValue(getSessionRelation(snapshot), ['rating']));
}

function getWaveQuality(snapshot: SessionWithConditions): number | null {
  const actual = parseForecastNumber(firstPresentValue(getActualConditions(snapshot), ['wave_quality']));
  if (actual !== null) {
    return actual;
  }

  return parseForecastNumber(firstPresentValue(getSessionRelation(snapshot), ['wave_quality']));
}

function getRecommendationCallAccuracy(snapshot: SessionWithConditions): string | null {
  const relation = getSessionRelation(snapshot);
  return typeof relation.recommendation_call_accuracy === 'string'
    ? relation.recommendation_call_accuracy
    : null;
}

function isSeededOrTestSession(snapshot: SessionWithConditions): boolean {
  const actual = getActualConditions(snapshot);
  const session = getSessionRelation(snapshot);
  const haystack = [
    actual.notes,
    actual.source,
    session.notes,
    session.source,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  if (SEED_SESSION_MARKERS.some((marker) => haystack.includes(marker.toLowerCase()))) {
    return true;
  }

  const source = String(actual.source ?? session.source ?? '').toLowerCase();
  return source === 'seed' || source === 'test' || source === 'mock';
}

function getGoalStrings(snapshot: SessionWithConditions): string[] {
  const relation = getSessionRelation(snapshot);
  const goals = relation.goals;
  if (!Array.isArray(goals)) {
    return [];
  }

  return goals.filter((goal): goal is string => typeof goal === 'string');
}

function getBoardStrings(snapshot: SessionWithConditions): string[] {
  const relation = getSessionRelation(snapshot);
  const boardSnapshot = asRecord(relation.board_snapshot);
  const boardFields = ['name', 'board_type', 'type', 'category', 'shape', 'size'];

  return boardFields
    .map((field) => boardSnapshot[field])
    .filter((value): value is string => typeof value === 'string');
}

function hasBoardContext(snapshot: SessionWithConditions): boolean {
  const relation = getSessionRelation(snapshot);
  return Boolean(relation.board_id) || getBoardStrings(snapshot).length > 0;
}

function hasSmallWaveIntent(snapshot: SessionWithConditions): boolean {
  const tokens = [...getGoalStrings(snapshot), ...getBoardStrings(snapshot)]
    .join(' ')
    .toLowerCase();

  return [
    'longboard',
    'log',
    'foam',
    'foamie',
    'soft top',
    'funboard',
    'midlength',
    'small wave',
    'small-wave',
    'practice',
    'beginner',
    'cruise',
    'grovel',
  ].some((term) => tokens.includes(term));
}

function isModalitySpecificSmallWaveSession(snapshot: SessionWithConditions): boolean {
  const waveHeight = getSessionNumber(
    snapshot,
    ['wave_height_ft'],
    ['wave_height', 'wave_height_ft']
  );

  if (waveHeight === null || waveHeight >= SMALL_WAVE_MODALITY_MAX_FT) {
    return false;
  }

  return hasSmallWaveIntent(snapshot) || hasBoardContext(snapshot);
}

function hasPositiveWaveQuality(snapshot: SessionWithConditions): boolean {
  const waveQuality = getWaveQuality(snapshot);
  return waveQuality !== null && waveQuality >= POSITIVE_WAVE_QUALITY_MIN;
}

function hasNegativeWaveQuality(snapshot: SessionWithConditions): boolean {
  const waveQuality = getWaveQuality(snapshot);
  return waveQuality !== null && waveQuality <= NEGATIVE_WAVE_QUALITY_MAX;
}

function hasNegativeSignal(snapshot: SessionWithConditions): boolean {
  const rating = getRating(snapshot);
  if (rating !== null && rating <= 2) {
    return true;
  }

  if (getRecommendationCallAccuracy(snapshot) === 'wrong') {
    return true;
  }

  return hasNegativeWaveQuality(snapshot);
}

function hasEnjoymentSignal(snapshot: SessionWithConditions): boolean {
  const rating = getRating(snapshot);
  if (rating !== null && rating >= ENJOYED_RATING_MIN) {
    return true;
  }

  return hasPositiveWaveQuality(snapshot);
}

function canUseRatingAsWaveFallback(snapshot: SessionWithConditions): boolean {
  if (getWaveQuality(snapshot) !== null) {
    return false;
  }

  const rating = getRating(snapshot);
  return rating !== null && rating >= ENJOYED_RATING_MIN;
}

function isSeededOrTestCompletedSession(session: CompletedSessionRow): boolean {
  const haystack = [session.notes, session.source]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  if (SEED_SESSION_MARKERS.some((marker) => haystack.includes(marker.toLowerCase()))) {
    return true;
  }

  const source = String(session.source ?? '').toLowerCase();
  return source === 'seed' || source === 'test' || source === 'mock';
}

function hasUsableAvoidanceConditions(snapshot: SessionWithConditions): boolean {
  return (
    getSessionNumber(snapshot, ['wave_height_ft'], ['wave_height', 'wave_height_ft']) !== null ||
    getSessionNumber(snapshot, [], ['wave_period', 'wave_period_s']) !== null ||
    getSessionWindDirection(snapshot) !== null ||
    getSessionTideStatus(snapshot) !== null
  );
}

function buildAvoidanceByBeach(sessions: SessionWithConditions[]): AvoidanceByBeach {
  const grouped = new Map<string, SessionWithConditions[]>();

  for (const session of sessions) {
    const beachId = getSessionBeachId(session);
    if (!beachId || !hasUsableAvoidanceConditions(session)) {
      continue;
    }

    const existing = grouped.get(beachId) ?? [];
    existing.push(session);
    grouped.set(beachId, existing);
  }

  const avoidanceByBeach: AvoidanceByBeach = {};
  for (const [beachId, beachSessions] of grouped.entries()) {
    const waveHeights = beachSessions
      .map((s) => getSessionNumber(s, ['wave_height_ft'], ['wave_height', 'wave_height_ft']))
      .filter((v): v is number => v !== null && v !== undefined);
    const wavePeriods = beachSessions
      .map((s) => getSessionNumber(s, [], ['wave_period', 'wave_period_s']))
      .filter((v): v is number => v !== null && v !== undefined);
    const windDirections = beachSessions
      .map((s) => getSessionWindDirection(s))
      .filter((v): v is number => v !== null && v !== undefined);
    const tideStatuses = beachSessions
      .map((s) => getSessionTideStatus(s))
      .filter((v): v is string => v !== null && v !== undefined && v !== '');
    const lastSessionAt = beachSessions
      .map((s) => getSessionCreatedAt(s))
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

    avoidanceByBeach[beachId] = {
      negative_sample_size: beachSessions.length,
      confidence: calculateConfidence(beachSessions.length),
      wave_min_ft: waveHeights.length > 0 ? percentile(waveHeights, 10) : null,
      wave_max_ft: waveHeights.length > 0 ? percentile(waveHeights, 90) : null,
      period_min_s: wavePeriods.length > 0 ? percentile(wavePeriods, 10) : null,
      period_max_s: wavePeriods.length > 0 ? percentile(wavePeriods, 90) : null,
      wind_directions: windDirections.length > 0 ? findModeDirections(windDirections, 45) : null,
      tide_statuses: tideStatuses.length > 0 ? findModes(tideStatuses, 0.2) : null,
      last_session_at: lastSessionAt,
    };
  }

  return avoidanceByBeach;
}

/**
 * Compute user surf preferences from their session history
 *
 * Analyzes sessions with rating >= 3 (good experiences) to learn:
 * - Preferred wave height and period ranges (10th-90th percentile)
 * - Maximum wind tolerance (90th percentile)
 * - Preferred wind directions (mode detection)
 * - Preferred tide statuses (mode detection)
 *
 * Automatically saves preferences to database via upsert.
 *
 * @param userId - The user ID
 * @returns Computed preferences or null if insufficient data (<5 sessions)
 *
 * @example
 * const preferences = await computeUserPreferences('user-123');
 * if (preferences) {
 *   console.log(`Wave range: ${preferences.wave_min_ft}-${preferences.wave_max_ft} ft`);
 *   console.log(`Confidence: ${preferences.confidence * 100}%`);
 * }
 */
export async function computeUserPreferences(
  userId: string
): Promise<UserSurfPreferences | null> {
  const supabase = createSupabaseServiceRoleClient();

  try {
    // 1. Count real completed sessions separately so older sessions without
    // forecast snapshots can unlock learned preference state.
    const [{ data: completedSessions, error: sessionsError }, { data: snapshots, error }] =
      await Promise.all([
        supabase
          .from('sessions')
          .select('id, beach_id, created_at, status, notes, source')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('session_forecast_snapshots')
          .select(`
            id,
            session_id,
            forecast_snapshot,
            actual_conditions,
            session:sessions (
              id,
              beach_id,
              created_at,
              status,
              board_id,
              board_snapshot,
              goals,
              notes,
              source,
              rating,
              wave_quality,
              wave_height_ft,
              wind_speed_mph,
              wind_direction,
              tide_status,
              recommendation_id,
              recommendation_call_accuracy,
              forecast_wave_height_ft,
              forecast_tide_status,
              wave_height_correct,
              tide_status_correct
            )
          `)
          .eq('user_id', userId)
          .order('session_date', { ascending: false })
          .limit(50),
      ]);

    if (sessionsError) {
      console.error(`Failed to fetch completed sessions for user ${userId}:`, sessionsError);
      return null;
    }

    if (error) {
      console.error(`Failed to fetch sessions for user ${userId}:`, error);
      return null;
    }

    const eligibleSessionCount = ((completedSessions ?? []) as CompletedSessionRow[])
      .filter((session) => !isSeededOrTestCompletedSession(session))
      .length;

    const cleanSessions = ((snapshots ?? []) as unknown as SessionWithConditions[]).filter(
      (snapshot) => !isSeededOrTestSession(snapshot)
    );

    const negativePreferenceSessions = cleanSessions.filter((snapshot) =>
      hasNegativeSignal(snapshot)
    );
    const avoidanceByBeach = buildAvoidanceByBeach(negativePreferenceSessions);
    const hasActionableAvoidance = Object.values(avoidanceByBeach).some(
      (pattern) => pattern.negative_sample_size >= 2
    );

    if (eligibleSessionCount < MIN_SIGNAL_SAMPLE_SIZE && !hasActionableAvoidance) {
      console.log(
        `Not enough completed sessions for user ${userId}: ${eligibleSessionCount} eligible sessions (need 5+)`
      );
      return null;
    }

    const waveQualitySessions = cleanSessions
      .filter((snapshot) => hasPositiveWaveQuality(snapshot))
      .filter((snapshot) => !isModalitySpecificSmallWaveSession(snapshot));

    const waveQualityConfidence = calculateConfidence(waveQualitySessions.length);
    const shouldUseRatingWaveFallback =
      waveQualitySessions.length < MIN_SIGNAL_SAMPLE_SIZE &&
      waveQualityConfidence < LOW_CONFIDENCE_THRESHOLD;

    const ratingFallbackWaveSessions = shouldUseRatingWaveFallback
      ? cleanSessions
          .filter((snapshot) => canUseRatingAsWaveFallback(snapshot))
          .filter((snapshot) => !hasNegativeWaveQuality(snapshot))
          .filter((snapshot) => !isModalitySpecificSmallWaveSession(snapshot))
      : [];

    const wavePreferenceSessions = [
      ...waveQualitySessions,
      ...ratingFallbackWaveSessions,
    ];

    const conditionPreferenceSessions = cleanSessions.filter((snapshot) =>
      hasEnjoymentSignal(snapshot)
    );

    const signalSampleSize = Math.max(
      wavePreferenceSessions.length,
      conditionPreferenceSessions.length
    );
    // 3. Extract arrays of values
    const waveHeights = wavePreferenceSessions
      .map((s) => getSessionNumber(s, ['wave_height_ft'], ['wave_height', 'wave_height_ft']))
      .filter((v): v is number => v !== null && v !== undefined);

    const wavePeriods = wavePreferenceSessions
      .map((s) => getSessionNumber(s, [], ['wave_period', 'wave_period_s']))
      .filter((v): v is number => v !== null && v !== undefined);

    const windSpeeds = conditionPreferenceSessions
      .map((s) => getSessionNumber(s, ['wind_speed_mph'], ['wind_speed', 'wind_speed_mph']))
      .filter((v): v is number => v !== null && v !== undefined);

    const windDirections = conditionPreferenceSessions
      .map((s) => getSessionWindDirection(s))
      .filter((v): v is number => v !== null && v !== undefined);

    const tideStatuses = conditionPreferenceSessions
      .map((s) => getSessionTideStatus(s))
      .filter((v): v is string => v !== null && v !== undefined && v !== '');

    // 4. Compute statistics
    const preferences: UserSurfPreferences = {
      wave_min_ft: waveHeights.length >= MIN_SIGNAL_SAMPLE_SIZE ? percentile(waveHeights, 10) : null,
      wave_max_ft: waveHeights.length >= MIN_SIGNAL_SAMPLE_SIZE ? percentile(waveHeights, 90) : null,
      wave_period_min_s: wavePeriods.length >= MIN_SIGNAL_SAMPLE_SIZE ? percentile(wavePeriods, 10) : null,
      wave_period_max_s: wavePeriods.length >= MIN_SIGNAL_SAMPLE_SIZE ? percentile(wavePeriods, 90) : null,
      max_wind_mph: windSpeeds.length >= MIN_SIGNAL_SAMPLE_SIZE ? percentile(windSpeeds, 90) : null,
      preferred_wind_directions:
        windDirections.length >= MIN_SIGNAL_SAMPLE_SIZE ? findModeDirections(windDirections, 45) : null,
      preferred_tide_statuses: tideStatuses.length >= MIN_SIGNAL_SAMPLE_SIZE ? findModes(tideStatuses, 0.2) : null,
      confidence: calculateConfidence(signalSampleSize),
      sample_size: signalSampleSize,
      eligible_session_count: eligibleSessionCount,
      avoidance_by_beach: avoidanceByBeach,
    };

    // 5. Upsert to database
    const { error: upsertError } = await (supabase as any)
      .from('user_surf_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
          last_computed_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (upsertError) {
      console.error(`Failed to save preferences for user ${userId}:`, upsertError);
      throw new Error(`Failed to save preferences: ${upsertError.message}`);
    }

    console.log(
      `✅ Computed preferences for user ${userId} (${signalSampleSize} positive sessions, ${eligibleSessionCount} eligible sessions)`
    );

    // Fire-and-forget milestone check after preferences are computed
    import('@/lib/services/personalization-milestone-service')
      .then(({ checkAndRecordMilestones }) => checkAndRecordMilestones(userId))
      .catch(() => {});

    return preferences;
  } catch (error) {
    console.error(`Error computing preferences for user ${userId}:`, error);
    return null;
  }
}

/**
 * Get user's learned surf preferences from database
 *
 * @param userId - The user ID
 * @returns User preferences or null if not found
 *
 * @example
 * const preferences = await getUserSurfPreferences('user-123');
 * if (preferences && preferences.confidence > 0.7) {
 *   // Use high-confidence preferences for recommendations
 * }
 */
export async function getUserSurfPreferences(
  userId: string
): Promise<UserSurfPreferences | null> {
  const supabase = createSupabaseServiceRoleClient();

  try {
    const { data, error } = await supabase
      .from('user_surf_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Not found is expected for new users
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`Failed to fetch preferences for user ${userId}:`, error);
      return null;
    }

    if (!data) return null;

    return {
      wave_min_ft: data.wave_min_ft,
      wave_max_ft: data.wave_max_ft,
      wave_period_min_s: data.wave_period_min_s,
      wave_period_max_s: data.wave_period_max_s,
      max_wind_mph: data.max_wind_mph,
      preferred_wind_directions: data.preferred_wind_directions,
      preferred_tide_statuses: data.preferred_tide_statuses,
      confidence: data.confidence,
      sample_size: data.sample_size,
      eligible_session_count: (data as any).eligible_session_count ?? data.sample_size,
      avoidance_by_beach: normalizeAvoidanceByBeach((data as any).avoidance_by_beach),
    };
  } catch (error) {
    console.error(`Error fetching preferences for user ${userId}:`, error);
    return null;
  }
}

export function normalizeAvoidanceByBeach(value: unknown): AvoidanceByBeach {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: AvoidanceByBeach = {};
  for (const [beachId, rawPattern] of Object.entries(value as Record<string, unknown>)) {
    const pattern = asRecord(rawPattern);
    normalized[beachId] = {
      negative_sample_size: Number(pattern.negative_sample_size ?? 0),
      confidence: Number(pattern.confidence ?? 0),
      wave_min_ft: parseForecastNumber(pattern.wave_min_ft),
      wave_max_ft: parseForecastNumber(pattern.wave_max_ft),
      period_min_s: parseForecastNumber(pattern.period_min_s),
      period_max_s: parseForecastNumber(pattern.period_max_s),
      wind_directions: Array.isArray(pattern.wind_directions)
        ? pattern.wind_directions
            .map((direction) => parseWindDirection(direction))
            .filter((direction): direction is number => direction !== null)
        : null,
      tide_statuses: Array.isArray(pattern.tide_statuses)
        ? pattern.tide_statuses
            .map((status) => normalizeTideStatus(status))
            .filter((status): status is string => status !== null)
        : null,
      last_session_at:
        typeof pattern.last_session_at === 'string' ? pattern.last_session_at : null,
    };
  }

  return normalized;
}

export function getAvoidancePatternForBeach(
  preferences: Pick<UserSurfPreferences, 'eligible_session_count' | 'avoidance_by_beach'> | null,
  beachId: string
): AvoidancePattern | null {
  if (!preferences) {
    return null;
  }

  const pattern = preferences.avoidance_by_beach?.[beachId] ?? null;
  if (!pattern) {
    return null;
  }

  if (
    (preferences.eligible_session_count ?? 0) >= MIN_SIGNAL_SAMPLE_SIZE ||
    pattern.negative_sample_size >= 2
  ) {
    return pattern;
  }

  return null;
}

function isInRangeWithTolerance(
  value: number | null,
  min: number | null,
  max: number | null,
  tolerance: number
): boolean | null {
  if (value === null || (min === null && max === null)) {
    return null;
  }

  if (min !== null && value < min - tolerance) {
    return false;
  }

  if (max !== null && value > max + tolerance) {
    return false;
  }

  return true;
}

function degreesWithinTolerance(a: number, b: number, tolerance: number): boolean {
  const delta = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(delta, 360 - delta) <= tolerance;
}

export function calculateAvoidancePenalty(
  forecast: AvoidanceForecastInput,
  pattern: AvoidancePattern | null
): number {
  if (!pattern || pattern.negative_sample_size <= 0 || pattern.confidence <= 0) {
    return 0;
  }

  const checks: boolean[] = [];
  const waveMatch = isInRangeWithTolerance(
    parseForecastNumber(forecast.wave_height),
    pattern.wave_min_ft,
    pattern.wave_max_ft,
    0.5
  );
  if (waveMatch !== null) checks.push(waveMatch);

  const periodMatch = isInRangeWithTolerance(
    parseForecastNumber(forecast.wave_period),
    pattern.period_min_s,
    pattern.period_max_s,
    2
  );
  if (periodMatch !== null) checks.push(periodMatch);

  const forecastWindDirection = parseWindDirection(forecast.wind_direction);
  if (forecastWindDirection !== null && pattern.wind_directions?.length) {
    checks.push(
      pattern.wind_directions.some((direction) =>
        degreesWithinTolerance(forecastWindDirection, direction, 35)
      )
    );
  }

  const forecastTideStatus = normalizeTideStatus(forecast.tide_status);
  if (forecastTideStatus && pattern.tide_statuses?.length) {
    checks.push(pattern.tide_statuses.includes(forecastTideStatus));
  }

  if (checks.length === 0) {
    return 0;
  }

  const matchRatio = checks.filter(Boolean).length / checks.length;
  return Math.round(Math.min(1, matchRatio * pattern.confidence) * 100) / 100;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentile of an array
 *
 * Uses linear interpolation between closest ranks.
 *
 * @param arr - Array of numbers
 * @param p - Percentile (0-100)
 * @returns The percentile value
 *
 * @example
 * percentile([1, 2, 3, 4, 5], 50) // Returns 3 (median)
 * percentile([1, 2, 3, 4, 5], 90) // Returns 4.6 (90th percentile)
 */
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];

  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) return sorted[lower];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Find most common wind directions (within tolerance)
 *
 * Normalizes directions to 8 cardinal directions (N, NE, E, SE, S, SW, W, NW)
 * and returns up to 3 mode directions that appear with at least 15% frequency.
 *
 * @param directions - Array of wind directions in degrees (0-360)
 * @param tolerance - Angular tolerance for clustering (default: 45 degrees)
 * @returns Array of up to 3 mode directions (cardinal degrees)
 *
 * @example
 * findModeDirections([5, 10, 355, 180, 185], 45)
 * // Returns [0, 180] - North and South are the modes
 */
export function findModeDirections(directions: number[], tolerance: number = 45): number[] {
  if (directions.length === 0) return [];

  // 8 cardinal directions (N, NE, E, SE, S, SW, W, NW)
  const cardinals = [0, 45, 90, 135, 180, 225, 270, 315];
  const counts = new Map<number, number>();

  for (const dir of directions) {
    // Normalize direction to 0-360
    const normalized = ((dir % 360) + 360) % 360;

    // Find nearest cardinal
    const nearest = cardinals.reduce((prev, curr) => {
      const prevDist = Math.min(
        Math.abs(prev - normalized),
        360 - Math.abs(prev - normalized)
      );
      const currDist = Math.min(
        Math.abs(curr - normalized),
        360 - Math.abs(curr - normalized)
      );
      return currDist < prevDist ? curr : prev;
    });

    counts.set(nearest, (counts.get(nearest) || 0) + 1);
  }

  // Sort by frequency and return top 3 with at least 15% frequency
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([_, count]) => count / directions.length >= 0.15)
    .map(([dir, _]) => dir);
}

/**
 * Find mode values (values appearing with >minFreq frequency)
 *
 * Returns all values that appear with at least the specified minimum frequency,
 * sorted by frequency (most common first).
 *
 * @param arr - Array of values
 * @param minFreq - Minimum frequency threshold (0-1, default: 0.2 = 20%)
 * @returns Array of mode values
 *
 * @example
 * findModes(['rising', 'rising', 'high', 'low'], 0.2)
 * // Returns ['rising', 'high'] - both appear >= 20% of the time
 */
export function findModes<T>(arr: T[], minFreq: number = 0.2): T[] {
  if (arr.length === 0) return [];

  const counts = new Map<T, number>();

  for (const val of arr) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([_, count]) => count / arr.length >= minFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([val, _]) => val);
}

/**
 * Calculate confidence score based on sample size
 *
 * Uses sigmoid function to prevent overconfidence from small datasets:
 * - 5 sessions → 0.5 confidence (50%)
 * - 10 sessions → 0.73 confidence (73%)
 * - 20+ sessions → 0.95+ confidence (95%+)
 *
 * Formula: 1 / (1 + exp(-k * (n - n0)))
 * Where k ≈ 0.2 (steepness), n0 = 5 (midpoint at 50%)
 *
 * @param n - Number of sessions (sample size)
 * @returns Confidence score (0-1)
 *
 * @example
 * calculateConfidence(5)  // Returns ~0.5
 * calculateConfidence(10) // Returns ~0.73
 * calculateConfidence(20) // Returns ~0.95
 */
export function calculateConfidence(n: number): number {
  if (n <= 0) return 0;

  // Sigmoid: 1 / (1 + exp(-k * (n - n0)))
  // Tuned so that: 5 sessions → 0.5, 10 sessions → 0.73, 20+ sessions → 0.95+
  const k = 0.2; // Steepness factor (derived from target values)
  const n0 = 5; // Midpoint (50% confidence at 5 sessions)
  const confidence = 1 / (1 + Math.exp(-k * (n - n0)));

  // Round to 2 decimal places
  return Math.round(confidence * 100) / 100;
}
