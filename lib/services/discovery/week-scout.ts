import 'server-only';

import { createHash } from 'node:crypto';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';
import { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import { batchFetchForecasts } from '@/lib/services/discovery/forecast-batch-fetcher';
import { getBatchSunTimes } from '@/lib/services/discovery/surf-discovery-orchestrator';
import {
  fetchPersonalizationContext,
  calculatePersonalizationBonus,
  type PersonalizationContext,
} from '@/lib/services/discovery/personalization-layer';
import {
  selectBestWindow,
  scoreWindowConditionScore,
  getLocalDateStr,
  getLocalHourFormatter,
} from '@/lib/services/discovery/window-selector';
import {
  beachToSpotProfile,
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
} from '@/lib/domains/scoring';
import { rerankHero, type RerankResult } from '@/lib/services/discovery/hero-ranking';
import { localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';
import {
  getSkillLevelOrDefault,
  type SkillLevel,
} from '@/lib/domains/user-preferences';
import {
  getRideabilityBand,
  normalizeBoardClass,
  type BoardClass,
} from '@/lib/domains/rideability';
import type { SpotProfile } from '@/lib/domains/spot-profile/types';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  DetailedScore,
  PersonalizedForecastWindow,
  SurfDiscoveryRecommendation,
} from '@/types/personalization';
import {
  sanitizeWeekScoutForMajorEventHold,
  type MajorEventHoldWeekScoutResponse,
} from '@/lib/recommendations/major-event-hold/adapters/week-scout';
import { evaluateMajorEventHoldCandidates } from '@/lib/recommendations/major-event-hold/service';
import { rankBeaches } from '@/lib/recommendations/selection';
import type { MajorEventHoldCandidate } from '@/lib/recommendations/major-event-hold/types';
import {
  calculateDistancePenalty,
  compareDiscoveryRecommendations,
  WORTH_THE_DRIVE_DISTANCE_MILES,
  WORTH_THE_DRIVE_REASON,
} from '@/lib/services/discovery/distance-friction';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';
import type { Coordinates } from '@/lib/types/coordinates';
import {
  buildCanonicalSessionDecision,
  type CanonicalDecisionCandidate,
  type CanonicalSessionDecision,
} from '@/lib/recommendations/canonical-decision';

export const WEEK_SCOUT_SCORER_VERSION = 'week-scout-v1:discovery-hero-v1';
const WEEK_SCOUT_RESPONSE_RANK_LIMIT = 8;

export type WeekScoutBucket = 'morning' | 'midday' | 'evening';
export type WeekScoutVerdict = 'worth_it' | 'maybe' | 'skip';
export type WeekScoutDayExclusionReason =
  | 'no_forecasts'
  | 'no_safe_windows'
  | 'no_rideable_windows'
  | 'no_recommendable_windows'
  | 'major_event_hold';

export interface WeekScoutRequest {
  candidateBeachIds: string[];
  localTimezone: string;
  startLocalDate: string;
  dayCount: 7;
  userLocation?: Coordinates;
}

export interface WeekScoutDaysRequest extends Omit<WeekScoutRequest, 'dayCount'> {
  dayCount: number;
}

export interface WeekScoutRankedSpotResponse {
  beachId: string;
  beachName: string;
  conditionScore: number;
  rankingScore: number;
  verdict: WeekScoutVerdict;
  reason?: string;
  /**
   * This spot's own conditions at the window.
   *
   * Additive, and the point of the field: clients had only three scores per
   * ranked spot, so every row in the list could say no more than "good
   * conditions" — identical text for every entry, since the window's own
   * `forecast` describes the representative beach, not each spot. The data was
   * already computed here and discarded during the mapping below.
   */
  forecast: {
    waveHeight: string | null;
    period: string | null;
    swellDirection: string | null;
    windSpeed: string | null;
    windDirection: string | null;
  };
}

export interface WeekScoutWindowResponse {
  id: string;
  bucket: WeekScoutBucket;
  start: string;
  end: string;
  peakTime: string;
  beachId: string;
  conditionScore: number;
  rankingScore: number;
  verdict: WeekScoutVerdict;
  rideable: boolean;
  safe: boolean;
  confidence: number | null;
  forecast: {
    waveHeight: string | null;
    period: string | null;
    swellDirection: string | null;
    windSpeed: string | null;
    windDirection: string | null;
    tideHeightFt: number | null;
    tidePhase: string | null;
    freshnessAt: string;
  };
  takeaway: string | null;
  rankedSpots: WeekScoutRankedSpotResponse[];
}

export interface WeekScoutDayResponse {
  localDate: string;
  windows: WeekScoutWindowResponse[];
  bestWindowId: string | null;
  exclusionReasons: WeekScoutDayExclusionReason[];
}

export interface WeekScoutResponse {
  generatedAt: string;
  scorerVersion: string;
  candidateFingerprint: string;
  days: WeekScoutDayResponse[];
}

export type CanonicalWeekScoutResponse = MajorEventHoldWeekScoutResponse & {
  sessionDecision: CanonicalSessionDecision;
};

interface GeneratedWeekScoutContext {
  heldResponse: MajorEventHoldWeekScoutResponse;
  beaches: Beach[];
  forecastsByBeach: Map<string, EnhancedForecastEntity[]>;
  userSkillLevel: SkillLevel | null;
  boardClasses: BoardClass[];
  generatedAt: string;
  now: Date;
}

interface PersonalizationBonus {
  affinityBonus: number;
  personalizationBonus: number;
  reasons: string[];
}

interface ScoreBeachOptions {
  affinityBonus?: number;
  userSkillLevel?: SkillLevel | null;
  beachSkillLevel?: string | null;
}

export interface WeekScoutServiceDependencies {
  now: Date;
  fetchBeaches: (ids: string[]) => Promise<Beach[]>;
  fetchForecasts: (
    beaches: Beach[],
    forecastWindowHours: number,
  ) => Promise<Map<string, EnhancedForecastEntity[]>>;
  fetchSunTimes: (
    beachIds: string[],
    dates: string[],
  ) => Promise<Map<string, { sunrises: Date[]; sunsets: Date[] }>>;
  fetchPreferences: (userId: string) => ReturnType<typeof getUserSurfPreferences>;
  fetchSkill: (userId: string) => Promise<SkillLevel | null>;
  fetchBoardClasses?: (userId: string) => Promise<BoardClass[]>;
  fetchPersonalizationContext: (
    userId: string,
    beachIds: string[],
  ) => Promise<PersonalizationContext | null>;
  calculatePersonalizationBonus: (
    beach: Beach,
    forecast: EnhancedForecastEntity,
    context: PersonalizationContext,
  ) => PersonalizationBonus;
  selectBestWindow: (options: {
    forecasts: EnhancedForecastEntity[];
    beach: Beach;
    userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>>;
    sunTimesCache: Map<string, { sunrises: Date[]; sunsets: Date[] }>;
    now: Date;
    userSkillLevel: SkillLevel | null;
    boardClasses?: readonly BoardClass[];
  }) => PersonalizedForecastWindow | null;
  scoreWindowCondition: (
    forecast: EnhancedForecastEntity,
    beach: Beach,
    skillLevel?: SkillLevel | null,
    boardClasses?: readonly BoardClass[],
  ) => number;
  scoreBeach: (
    beach: Beach,
    forecast: EnhancedForecastEntity,
    options?: ScoreBeachOptions,
  ) => DetailedScore;
  beachToSpotProfile: (beach: Beach) => SpotProfile;
  rankWindows: (recommendations: SurfDiscoveryRecommendation[]) => RerankResult;
}

interface DraftWindow {
  response: Omit<WeekScoutWindowResponse, 'rankingScore' | 'rankedSpots'>;
  recommendation: SurfDiscoveryRecommendation;
}

const BUCKETS: ReadonlyArray<{
  bucket: WeekScoutBucket;
  startHour: number;
  endHour: number | null;
}> = [
  { bucket: 'morning', startHour: 6, endHour: 10 },
  { bucket: 'midday', startHour: 10, endHour: 14 },
  { bucket: 'evening', startHour: 14, endHour: null },
];

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localHour(date: Date, timezone: string): number | null {
  try {
    const hour = Number(getLocalHourFormatter(timezone).format(date));
    return Number.isFinite(hour) ? hour % 24 : null;
  } catch {
    return null;
  }
}

function bucketForLocalHour(hour: number): WeekScoutBucket | null {
  const match = BUCKETS.find(({ startHour, endHour }) => (
    hour >= startHour && (endHour === null || hour < endHour)
  ));
  return match?.bucket ?? null;
}

function slotKey(localDate: string, bucket: WeekScoutBucket): string {
  return `${localDate}|${bucket}`;
}

/**
 * Bucket a beach's forecast rows by local date and daypart in a single pass.
 *
 * The naive form re-derives each row's local date and hour once per
 * (day x bucket) pair — 21 times over a 7-day request — and each derivation
 * built a fresh Intl.DateTimeFormat. Resolving every row once keeps the output
 * identical (buckets are ordered and disjoint, and insertion order preserves
 * the original row order) while cutting the timezone work by 21x.
 */
function groupForecastsByLocalSlot(
  forecasts: EnhancedForecastEntity[],
  timezone: string,
): Map<string, EnhancedForecastEntity[]> {
  const grouped = new Map<string, EnhancedForecastEntity[]>();

  for (const row of forecasts) {
    const date = new Date(row.forecast_at);
    const hour = localHour(date, timezone);
    if (hour === null) continue;

    const bucket = bucketForLocalHour(hour);
    if (!bucket) continue;

    const key = slotKey(getLocalDateStr(date, timezone), bucket);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }
    grouped.set(key, [row]);
  }

  return grouped;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function verdictForScore(score: number): WeekScoutVerdict {
  if (score >= 70) return 'worth_it';
  if (score >= 40) return 'maybe';
  return 'skip';
}

function isSafe(score: DetailedScore): boolean {
  return !score.warnings.some((warning) => (
    /\b(danger|hazard|closure|unsafe|above your usual range)\b/i.test(warning)
  ));
}

function isRideable(
  forecast: EnhancedForecastEntity,
  skillLevel: SkillLevel | null,
  boardClasses: readonly BoardClass[] = [],
): boolean {
  const waveHeight = finiteNumber(forecast.wave_height);
  if (waveHeight === null) return false;

  const resolvedSkillLevel = getSkillLevelOrDefault(skillLevel);
  if (boardClasses.length === 0) {
    const band = getRideabilityBand(resolvedSkillLevel, null).acceptable;
    return waveHeight >= band.min && waveHeight <= band.max;
  }

  return boardClasses.some((boardClass) => {
    const band = getRideabilityBand(resolvedSkillLevel, boardClass).acceptable;
    return waveHeight >= band.min && waveHeight <= band.max;
  });
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function defaultDependencies(now: Date): WeekScoutServiceDependencies {
  const scoringEngine = createDiscoveryScoringEngine();

  return {
    now,
    fetchBeaches: async (ids) => {
      const supabase = createSupabaseServiceRoleClient();
      const { data, error } = await supabase
        .from('beaches')
        .select('*')
        .in('id', ids)
        .eq('is_private', false);
      if (error) throw new Error(`Failed to load Week Scout beaches: ${error.message}`);

      const byId = new Map(((data ?? []) as Beach[]).map((candidate) => [candidate.id, candidate]));
      return ids.map((id) => byId.get(id)).filter((candidate): candidate is Beach => Boolean(candidate));
    },
    fetchForecasts: async (beaches, forecastWindowHours) => {
      const result = await batchFetchForecasts(beaches, { forecastWindowHours });
      return new Map(result.successful.map(({ beach, forecasts }) => [beach.id, forecasts]));
    },
    fetchSunTimes: getBatchSunTimes,
    fetchPreferences: getUserSurfPreferences,
    fetchSkill: async (userId) => (
      getProfileExperienceLevel(createSupabaseServiceRoleClient(), userId)
    ),
    fetchBoardClasses: async (userId) => {
      const { data, error } = await createSupabaseServiceRoleClient()
        .from('boards')
        .select('board_type')
        .eq('user_id', userId);
      if (error || !Array.isArray(data)) return [];

      return Array.from(
        new Set(
          data
            .map((row) => normalizeBoardClass(row.board_type))
            .filter((boardClass): boardClass is BoardClass => boardClass !== null)
        )
      );
    },
    fetchPersonalizationContext: async (userId, beachIds) => (
      fetchPersonalizationContext(userId, beachIds)
    ),
    calculatePersonalizationBonus,
    selectBestWindow,
    scoreWindowCondition: (forecast, beach, skillLevel, boardClasses) => (
      scoreWindowConditionScore(forecast, beach, skillLevel, null, boardClasses)
    ),
    scoreBeach: (beach, forecast, options) => (
      scoreBeachWithEngine(scoringEngine, beach, forecast, options)
    ),
    beachToSpotProfile,
    rankWindows: rerankHero,
  };
}

function representativeForecast(
  forecasts: EnhancedForecastEntity[],
  window: PersonalizedForecastWindow,
): EnhancedForecastEntity | null {
  if (window.sourceForecast) return window.sourceForecast;
  if (forecasts.length === 0) return null;

  const target = window.peakTime?.getTime() ?? window.start.getTime();
  return forecasts.reduce((closest, candidate) => (
    Math.abs(new Date(candidate.forecast_at).getTime() - target)
      < Math.abs(new Date(closest.forecast_at).getTime() - target)
      ? candidate
      : closest
  ));
}

function capWindowEnd(
  window: PersonalizedForecastWindow,
  localDate: string,
  timezone: string,
  bucketEndHour: number | null,
): Date {
  if (bucketEndHour === null) return window.end;
  const boundary = localDateTimeToUTC(
    localDate,
    `${String(bucketEndHour).padStart(2, '0')}:00:00`,
    timezone,
  );
  return window.end > boundary ? boundary : window.end;
}

function buildDraftWindow(args: {
  beach: Beach;
  bucket: WeekScoutBucket;
  localDate: string;
  timezone: string;
  bucketEndHour: number | null;
  forecasts: EnhancedForecastEntity[];
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>>;
  userSkillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  sunTimes: Map<string, { sunrises: Date[]; sunsets: Date[] }>;
  personalizationContext: PersonalizationContext | null;
  generatedAt: string;
  distanceMiles?: number;
  deps: WeekScoutServiceDependencies;
}): DraftWindow | null {
  const window = args.deps.selectBestWindow({
    forecasts: args.forecasts,
    beach: args.beach,
    userPrefs: args.userPrefs,
    sunTimesCache: args.sunTimes,
    now: args.deps.now,
    userSkillLevel: args.userSkillLevel,
    boardClasses: args.boardClasses,
  });
  if (!window) return null;

  const forecast = representativeForecast(args.forecasts, window);
  if (!forecast) return null;

  const personalization = args.personalizationContext
    ? args.deps.calculatePersonalizationBonus(args.beach, forecast, args.personalizationContext)
    : { affinityBonus: 0, personalizationBonus: 0, reasons: [] };
  const detailed = args.deps.scoreBeach(args.beach, forecast, {
    affinityBonus: personalization.affinityBonus,
    userSkillLevel: args.userSkillLevel,
    beachSkillLevel: args.beach.skill_level,
  });
  const conditionScore = args.deps.scoreWindowCondition(
    forecast,
    args.beach,
    args.userSkillLevel,
    args.boardClasses,
  );
  const representativeScore = clampScore(
    conditionScore + personalization.affinityBonus + personalization.personalizationBonus,
  );
  const end = capWindowEnd(window, args.localDate, args.timezone, args.bucketEndHour);
  if (end <= window.start) return null;

  const id = hash([
    args.beach.id,
    args.localDate,
    args.bucket,
    WEEK_SCOUT_SCORER_VERSION,
  ]).slice(0, 24);
  const verdict = verdictForScore(representativeScore);
  const slotScores = args.forecasts
    .filter((row) => {
      const time = new Date(row.forecast_at).getTime();
      return time >= window.start.getTime() && time < end.getTime();
    })
    .map((row) => args.deps.scoreWindowCondition(
      row,
      args.beach,
      args.userSkillLevel,
      args.boardClasses,
    ));
  const subscores = {
    ...detailed.subscores,
    personalizationBonus: personalization.personalizationBonus,
  };
  const reasons = [...personalization.reasons, ...detailed.reasons];

  return {
    response: {
      id,
      bucket: args.bucket,
      start: window.start.toISOString(),
      end: end.toISOString(),
      peakTime: (window.peakTime ?? window.start).toISOString(),
      beachId: args.beach.id,
      conditionScore,
      verdict,
      rideable: isRideable(forecast, args.userSkillLevel, args.boardClasses),
      safe: isSafe(detailed),
      confidence: finiteNumber(forecast.confidence_score),
      forecast: {
        waveHeight: forecast.wave_height ?? null,
        period: forecast.wave_period ?? null,
        swellDirection: forecast.wave_direction ?? null,
        windSpeed: forecast.wind_speed ?? null,
        windDirection: forecast.wind_direction ?? null,
        tideHeightFt: finiteNumber(forecast.tide_height),
        tidePhase: forecast.tide_status ?? null,
        freshnessAt: forecast.updated_at ?? forecast.forecast_at,
      },
      takeaway: reasons[0] ?? null,
    },
    recommendation: {
      recommendationId: id,
      beach: args.beach,
      window: { ...window, end },
      forecast,
      score: representativeScore,
      matchQuality: detailed.matchQuality,
      subscores,
      summary: reasons[0] ?? '',
      reasons,
      warnings: detailed.warnings,
      spotProfile: args.deps.beachToSpotProfile(args.beach),
      windowSlotScores: slotScores,
      similarity: null,
      distanceMiles: args.distanceMiles,
      generated_at: args.generatedAt,
    },
  };
}

function rankDrafts(
  drafts: DraftWindow[],
  deps: WeekScoutServiceDependencies,
): WeekScoutWindowResponse[] {
  if (drafts.length === 0) return [];

  const ranked = deps.rankWindows(drafts.map((draft) => draft.recommendation));
  const scoreById = new Map(ranked.reranked.map((recommendation, index) => [
    recommendation.recommendationId,
    ranked.diagnostics[index]?.heroWindowScore ?? recommendation.score,
  ]));
  const draftById = new Map(drafts.map((draft) => [draft.response.id, draft]));
  const distanceOf = (windowId: string): number | undefined =>
    draftById.get(windowId)?.recommendation.distanceMiles;
  const responses = drafts
    .map((draft) => ({
      ...draft.response,
      rankingScore: (
        scoreById.get(draft.response.id) ?? draft.recommendation.score
      ) + calculateDistancePenalty(draft.recommendation.distanceMiles),
    }))
    .sort((left, right) =>
      compareWeekScoutWindows(left, right, distanceOf(left.id), distanceOf(right.id)));
  const rankedSpots = responses.map((window, index): WeekScoutRankedSpotResponse => ({
    beachId: window.beachId,
    beachName: draftById.get(window.id)?.recommendation.beach.name ?? '',
    conditionScore: window.conditionScore,
    rankingScore: window.rankingScore,
    verdict: window.verdict,
    ...(index <= 1
      && (draftById.get(window.id)?.recommendation.distanceMiles ?? 0)
        > WORTH_THE_DRIVE_DISTANCE_MILES
      ? { reason: WORTH_THE_DRIVE_REASON }
      : {}),
    // Carry each spot's own conditions through instead of dropping them.
    forecast: {
      waveHeight: window.forecast.waveHeight,
      period: window.forecast.period,
      swellDirection: window.forecast.swellDirection,
      windSpeed: window.forecast.windSpeed,
      windDirection: window.forecast.windDirection,
    },
  }));

  return responses.map((window) => ({ ...window, rankedSpots }));
}

function compareWeekScoutWindows(
  left: Pick<WeekScoutWindowResponse, 'conditionScore' | 'rankingScore'>,
  right: Pick<WeekScoutWindowResponse, 'conditionScore' | 'rankingScore'>,
  leftDistance: number | undefined,
  rightDistance: number | undefined,
): number {
  if (leftDistance === undefined || rightDistance === undefined) {
    return right.rankingScore - left.rankingScore;
  }

  return compareDiscoveryRecommendations(
    {
      score: left.conditionScore,
      rankingScore: left.rankingScore,
      distanceMiles: leftDistance,
    },
    {
      score: right.conditionScore,
      rankingScore: right.rankingScore,
      distanceMiles: rightDistance,
    },
  );
}

function nearestForecastForWindow(
  forecasts: readonly EnhancedForecastEntity[],
  peakTime: string,
): EnhancedForecastEntity | null {
  if (forecasts.length === 0) return null;
  const target = Date.parse(peakTime);
  return forecasts.reduce((closest, candidate) => (
    Math.abs(Date.parse(candidate.forecast_at) - target)
      < Math.abs(Date.parse(closest.forecast_at) - target)
      ? candidate
      : closest
  ));
}

function canonicalLabelForVerdict(
  verdict: WeekScoutVerdict,
): CanonicalDecisionCandidate['recommendationLabel'] {
  if (verdict === 'worth_it') return 'Worth it';
  if (verdict === 'maybe') return 'Maybe';
  return 'Skip';
}

function buildWeekScoutCanonicalCandidates(args: {
  response: MajorEventHoldWeekScoutResponse;
  beaches: readonly Beach[];
  forecastsByBeach: ReadonlyMap<string, EnhancedForecastEntity[]>;
  timezone: string;
}): CanonicalDecisionCandidate[] {
  const beachById = new Map(args.beaches.map((candidate) => [candidate.id, candidate]));

  return args.response.days.flatMap((day) =>
    day.windows.flatMap((window) => {
      const beach = beachById.get(window.beachId);
      if (
        !beach
        || window.rankingScore === null
        || window.verdict === null
      ) {
        return [];
      }
      const forecast = nearestForecastForWindow(
        args.forecastsByBeach.get(window.beachId) ?? [],
        window.peakTime,
      );

      return [{
        candidateId: window.id,
        beachId: window.beachId,
        beachName: beach.name,
        beachSkillLevel: beach.skill_level,
        windowStart: window.start,
        windowEnd: window.end,
        timezone: args.timezone,
        forecastId: forecast?.id ?? '',
        forecastAt: forecast?.forecast_at ?? '',
        waveHeight: window.forecast.waveHeight,
        utilityScore: window.rankingScore,
        recommendationLabel: canonicalLabelForVerdict(window.verdict),
      }];
    }),
  );
}

function applyCanonicalDecisionToWeekScout(
  response: MajorEventHoldWeekScoutResponse,
  sessionDecision: CanonicalSessionDecision,
): CanonicalWeekScoutResponse {
  return {
    ...response,
    sessionDecision,
  };
}

function exclusionReasonsForDay(
  windows: readonly WeekScoutWindowResponse[],
  bestWindowId: string | null,
): WeekScoutDayExclusionReason[] {
  if (bestWindowId !== null) return [];
  if (windows.length === 0) return ['no_forecasts'];
  const safeWindows = windows.filter((window) => window.safe);
  if (safeWindows.length === 0) return ['no_safe_windows'];
  const rideableWindows = safeWindows.filter((window) => window.rideable);
  if (rideableWindows.length === 0) return ['no_rideable_windows'];
  const recommendableWindows = rideableWindows.filter(
    (window) => window.verdict !== 'skip',
  );
  if (recommendableWindows.length === 0) {
    return ['no_recommendable_windows'];
  }
  return [];
}

function compactHeldResponse(
  response: MajorEventHoldWeekScoutResponse,
): MajorEventHoldWeekScoutResponse {
  return {
    ...response,
    days: response.days.map((day) => {
      const windows = BUCKETS.flatMap(({ bucket }) => {
        const bucketWindows = day.windows.filter((window) => window.bucket === bucket);
        const visibleWindows = bucketWindows.filter((window) => window.rankingScore !== null);
        const selected = (
          visibleWindows.length > 0 ? visibleWindows : bucketWindows
        ).slice(0, WEEK_SCOUT_RESPONSE_RANK_LIMIT);
        const bestWindow = bucketWindows.find((window) => window.id === day.bestWindowId);

        if (
          bestWindow
          && !selected.some((window) => window.id === bestWindow.id)
        ) {
          selected.splice(
            Math.max(0, selected.length - 1),
            selected.length === 0 ? 0 : 1,
            bestWindow,
          );
        }

        return selected.map((window) => ({
          ...window,
          rankedSpots: window.rankedSpots.slice(0, WEEK_SCOUT_RESPONSE_RANK_LIMIT),
        }));
      });

      return {
        ...day,
        windows,
      };
    }),
  };
}

async function generateWeekScoutForecastInternal(
  userId: string,
  request: WeekScoutDaysRequest,
  dependencies?: WeekScoutServiceDependencies,
): Promise<GeneratedWeekScoutContext> {
  const deps = dependencies ?? defaultDependencies(new Date());
  const generatedAt = deps.now.toISOString();
  const localDates = Array.from(
    { length: request.dayCount },
    (_, index) => addLocalDays(request.startLocalDate, index),
  );
  const beaches = await deps.fetchBeaches(request.candidateBeachIds);
  const beachIds = beaches.map((candidate) => candidate.id);
  const [forecastsByBeach, sunTimes, userPrefs, userSkillLevel, personalizationContext, boardClasses] = await Promise.all([
    deps.fetchForecasts(beaches, 24 * (request.dayCount + 1)),
    deps.fetchSunTimes(beachIds, localDates),
    deps.fetchPreferences(userId),
    deps.fetchSkill(userId),
    deps.fetchPersonalizationContext(userId, beachIds),
    deps.fetchBoardClasses?.(userId) ?? Promise.resolve([]),
  ]);

  const slotsByBeach = new Map(beaches.map((candidate) => [
    candidate.id,
    groupForecastsByLocalSlot(
      forecastsByBeach.get(candidate.id) ?? [],
      request.localTimezone,
    ),
  ]));
  const distanceByBeachId = new Map(beaches.map((candidate) => {
    if (!request.userLocation) return [candidate.id, undefined] as const;
    const distanceMiles = calculateDistanceInMiles(request.userLocation, {
      lat: candidate.lat,
      lon: candidate.lon,
    });
    return [
      candidate.id,
      Number.isFinite(distanceMiles) ? distanceMiles : undefined,
    ] as const;
  }));

  const days = localDates.map((localDate): WeekScoutDayResponse => {
    const windows = BUCKETS.flatMap(({ bucket, endHour }) => {
      const drafts = beaches.flatMap((candidate) => {
        const forecasts = slotsByBeach.get(candidate.id)?.get(slotKey(localDate, bucket)) ?? [];
        if (forecasts.length === 0) return [];

        const draft = buildDraftWindow({
          beach: candidate,
          bucket,
          localDate,
          timezone: request.localTimezone,
          bucketEndHour: endHour,
          forecasts,
          userPrefs,
          userSkillLevel,
          boardClasses,
          sunTimes,
          personalizationContext,
          generatedAt,
          distanceMiles: distanceByBeachId.get(candidate.id),
          deps,
        });
        return draft ? [draft] : [];
      });

      return rankDrafts(drafts, deps);
    });
    const best = windows
      .filter((candidate) => (
        candidate.safe && candidate.rideable && candidate.verdict !== 'skip'
      ))
      .reduce<WeekScoutWindowResponse | null>((current, candidate) => (
        !current || compareWeekScoutWindows(
          candidate,
          current,
          distanceByBeachId.get(candidate.beachId),
          distanceByBeachId.get(current.beachId),
        ) < 0 ? candidate : current
      ), null);

    return {
      localDate,
      windows,
      bestWindowId: best?.id ?? null,
      exclusionReasons: exclusionReasonsForDay(windows, best?.id ?? null),
    };
  });

  let response: WeekScoutResponse = {
    generatedAt,
    scorerVersion: WEEK_SCOUT_SCORER_VERSION,
    candidateFingerprint: hash([...beachIds].sort()),
    days,
  };
  const safeWindows = await rankBeaches(
    response.days.flatMap((day) => day.windows).map((window) => ({
      id: window.beachId,
      window,
    })),
    {
      compare: (left, right) =>
        right.window.rankingScore - left.window.rankingScore,
    },
  );
  const safeWindowIds = new Set(safeWindows.map(({ window }) => window.id));
  response = {
    ...response,
    days: response.days.map((day) => {
      // `rankedSpots` was baked into every window by rankDrafts before this
      // safety filter ran, so dropping a beach's windows here leaves the
      // survivors pointing at a beach that no longer has one in their bucket.
      // The major-event-hold adapter treats that dangling reference as a
      // structurally untrustworthy response and voids the ENTIRE week for every
      // beach — one held spot took Week Scout dark. Prune the references with
      // the windows so the survivors stay internally consistent.
      const kept = day.windows.filter((window) => safeWindowIds.has(window.id));
      const beachIdsByBucket = new Map<string, Set<string>>();
      for (const window of kept) {
        const bucketBeaches = beachIdsByBucket.get(window.bucket) ?? new Set<string>();
        bucketBeaches.add(window.beachId);
        beachIdsByBucket.set(window.bucket, bucketBeaches);
      }
      const windows = kept.map((window) => ({
        ...window,
        rankedSpots: window.rankedSpots.filter((spot) =>
          beachIdsByBucket.get(window.bucket)?.has(spot.beachId) === true,
        ),
      }));
      const bestWindowId = day.bestWindowId && safeWindowIds.has(day.bestWindowId)
        ? day.bestWindowId
        : null;
      return {
        ...day,
        windows,
        bestWindowId,
        exclusionReasons: exclusionReasonsForDay(windows, bestWindowId),
      };
    }),
  };
  const candidates: MajorEventHoldCandidate[] = response.days.flatMap((day) =>
    day.windows.map((window) => ({
      candidateId: window.id,
      beachId: window.beachId,
      startsAt: window.start,
      endsAt: window.end,
    })),
  );
  const decisions = await evaluateMajorEventHoldCandidates({
    candidates,
    profileExperience: userSkillLevel,
    applyWaterQualityHolds: true,
  });
  const heldResponse = compactHeldResponse(sanitizeWeekScoutForMajorEventHold(
    response,
    candidates,
    decisions,
  ));

  return {
    heldResponse,
    beaches,
    forecastsByBeach,
    userSkillLevel,
    boardClasses,
    generatedAt,
    now: deps.now,
  };
}

function validateDayCount(dayCount: number): void {
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 7) {
    throw new Error('Week Scout dayCount must be between 1 and 7');
  }
}

function buildCanonicalWeekScoutResponse(
  context: GeneratedWeekScoutContext,
  request: WeekScoutDaysRequest,
): CanonicalWeekScoutResponse {
  const canonicalCandidates = buildWeekScoutCanonicalCandidates({
    response: context.heldResponse,
    beaches: context.beaches,
    forecastsByBeach: context.forecastsByBeach,
    timezone: request.localTimezone,
  });
  const sessionDecision = buildCanonicalSessionDecision({
    anchorTime: context.generatedAt,
    scope: {
      kind: 'plan_next_session',
      windowStart: context.generatedAt,
      windowEnd: new Date(
        context.now.getTime() + request.dayCount * 24 * 60 * 60 * 1000,
      ).toISOString(),
      timezone: request.localTimezone,
    },
    profileExperience: context.userSkillLevel,
    recommendationAvailability: context.heldResponse.recommendationAvailability,
    candidates: canonicalCandidates,
  });

  return applyCanonicalDecisionToWeekScout(context.heldResponse, sessionDecision);
}

export async function generateWeekScoutForecastForDays(
  userId: string,
  request: WeekScoutDaysRequest,
  dependencies?: WeekScoutServiceDependencies,
): Promise<CanonicalWeekScoutResponse> {
  validateDayCount(request.dayCount);
  const context = await generateWeekScoutForecastInternal(userId, request, dependencies);
  return buildCanonicalWeekScoutResponse(context, request);
}

export async function generateWeekScoutRankingForDays(
  userId: string,
  request: WeekScoutDaysRequest,
  dependencies?: WeekScoutServiceDependencies,
): Promise<MajorEventHoldWeekScoutResponse> {
  validateDayCount(request.dayCount);
  const context = await generateWeekScoutForecastInternal(userId, request, dependencies);
  return context.heldResponse;
}

export async function generateWeekScoutForecast(
  userId: string,
  request: WeekScoutRequest,
  dependencies?: WeekScoutServiceDependencies,
): Promise<CanonicalWeekScoutResponse> {
  const context = await generateWeekScoutForecastInternal(userId, request, dependencies);
  return buildCanonicalWeekScoutResponse(context, request);
}
