import 'server-only';

import { createHash } from 'node:crypto';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { resolveRecommendationLabel } from './recommendation-label';
import { getCanonicalRecommendationLabel } from '@/lib/recommendations/canonical-decision/discovery-adapter';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';
import { batchFetchForecasts } from '@/lib/services/discovery/forecast-batch-fetcher';
import { getBatchSunTimes } from '@/lib/services/discovery/surf-discovery-orchestrator';
import {
  fetchWeekScoutRankingContext,
  fetchWeekScoutMatchEvidence,
  calculatePersonalizationBonus,
  type PersonalizationContext,
} from '@/lib/services/discovery/personalization-layer';
import {
  selectBestWindows,
  scoreWindowConditionScore,
  scoreWindowWithComposite,
  getLocalDateStr,
} from '@/lib/services/discovery/window-selector';
import {
  daypartForTime,
  selectBeachDayWindows,
  type AuthoritativeWindow,
} from '@/lib/services/discovery/window-authority';
import {
  beachToSpotProfile,
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
} from '@/lib/domains/scoring';
import { rerankHero, type RerankResult } from '@/lib/services/discovery/hero-ranking';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
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
import type { WaterQualityHoldResolution } from '@/lib/recommendations/major-event-hold/water-quality';
import type { MajorEventHoldCandidate } from '@/lib/recommendations/major-event-hold/types';
import {
  calculateDistancePenalty,
  compareDiscoveryRecommendations,
  WORTH_THE_DRIVE_DISTANCE_MILES,
  WORTH_THE_DRIVE_REASON,
} from '@/lib/services/discovery/distance-friction';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';
import { getStalenessDetails } from '@/lib/utils/forecast-service-utils';
import { getDirectionDegrees } from '@/lib/utils/number-parsing';
import { pickDominantSwell } from '@/lib/domains/conditions';
import type { Coordinates } from '@/lib/types/coordinates';
import {
  buildCanonicalSessionDecision,
  candidateHasSafetyVeto,
  type CanonicalDecisionCandidate,
  type CanonicalSessionDecision,
} from '@/lib/recommendations/canonical-decision';

import { overlapsSessionTime, type SessionTime } from '@/lib/scoring/session-time-preference';

const WEEK_SCOUT_SCORER_VERSION = 'week-scout-v2:day-window-authority-v1';
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
  /** Complete-radius routes opt into row-level source freshness enforcement. */
  requirePerRowFreshness?: boolean;
  /** profiles.preferred_session_time; the session pick stays inside it when any window does. */
  sessionTime?: SessionTime | null;
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
    components?: WeekScoutForecastComponent[];
    /** Existing scorer's dominant partition, only when all inputs identify one. */
    scoringComponent?: WeekScoutForecastComponent['kind'] | null;
  };
}

/**
 * A source partition from the exact forecast row scored for this window.
 * This is presentation data only; it must not be used to alter ranking.
 */
export interface WeekScoutForecastComponent {
  kind: 'swell_1' | 'swell_2' | 'wind_sea';
  height: string | null;
  period: string | null;
  direction: string | null;
  heightUnit: 'ft';
  periodUnit: 's';
  directionUnit: null;
  validAt: string;
  source: string | null;
}

export interface WeekScoutWindowResponse {
  id: string;
  bucket: WeekScoutBucket;
  start: string;
  end: string;
  displayWindowStart: string;
  displayWindowEnd: string;
  peakTime: string;
  beachId: string;
  isBeachDayBest: boolean;
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
    components?: WeekScoutForecastComponent[];
    /** Existing scorer's dominant partition, only when all inputs identify one. */
    scoringComponent?: WeekScoutForecastComponent['kind'] | null;
    waterTemp?: string | null;
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
  bestDayWindow: WeekScoutWindowResponse | null;
  exclusionReasons: WeekScoutDayExclusionReason[];
}

export interface WeekScoutResponse {
  generatedAt: string;
  scorerVersion: string;
  candidateFingerprint: string;
  days: WeekScoutDayResponse[];
}

interface WeekScoutCoverageBucket {
  bucket: WeekScoutBucket;
  eligible: number;
  evaluated: number;
  missing: number;
  /** Rows reached selection but did not form a viable/daily window. */
  noWindow: number;
  /** Filled after hold evaluation; null means the service cannot isolate it. */
  held: number | null;
}

interface WeekScoutCoverageDay {
  localDate: string;
  eligible: number;
  evaluated: number;
  missing: number;
  excluded: null;
  buckets: WeekScoutCoverageBucket[];
}

export interface WeekScoutCoverage {
  expiresAt: string;
  days: WeekScoutCoverageDay[];
}

export type CanonicalWeekScoutResponse = MajorEventHoldWeekScoutResponse & {
  sessionDecision: CanonicalSessionDecision;
  coverage?: WeekScoutCoverage;
  /** The preferred session time the session pick was limited to; null when it came from all windows. */
  sessionTimePreference?: SessionTime | null;
};

interface GeneratedWeekScoutContext {
  heldResponse: MajorEventHoldWeekScoutResponse;
  beaches: Beach[];
  forecastsByBeach: Map<string, EnhancedForecastEntity[]>;
  userSkillLevel: SkillLevel | null;
  boardClasses: BoardClass[];
  generatedAt: string;
  now: Date;
  coverage: WeekScoutCoverage;
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
    options?: { requirePerRowFreshness?: boolean },
  ) => Promise<Map<string, EnhancedForecastEntity[]>>;
  fetchSunTimes: (
    beachIds: string[],
    dates: string[],
  ) => Promise<Map<string, { sunrises: Date[]; sunsets: Date[] }>>;
  fetchRankingContext: typeof fetchWeekScoutRankingContext;
  fetchSkill: (userId: string) => Promise<SkillLevel | null>;
  fetchBoardClasses?: (userId: string) => Promise<BoardClass[]>;
  fetchMatchEvidence: typeof fetchWeekScoutMatchEvidence;
  calculatePersonalizationBonus: (
    beach: Beach,
    forecast: EnhancedForecastEntity,
    context: PersonalizationContext,
  ) => PersonalizationBonus;
  selectBestWindows: typeof selectBestWindows;
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

const BUCKETS: readonly WeekScoutBucket[] = ['morning', 'midday', 'evening'];

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
    const bucket = daypartForTime(date, timezone);
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

function forecastComponents(forecast: EnhancedForecastEntity): WeekScoutForecastComponent[] {
  // `data_source` describes the assembled forecast row, not each partition.
  // Do not fabricate per-component provider provenance from that aggregate.
  const source = null;
  const validAt = forecast.forecast_at;
  const partitions: Array<Pick<WeekScoutForecastComponent, 'kind' | 'height' | 'period' | 'direction'>> = [
    { kind: 'swell_1', height: forecast.swell_1_height ?? null, period: forecast.swell_1_period ?? null, direction: forecast.swell_1_direction ?? null },
    { kind: 'swell_2', height: forecast.swell_2_height ?? null, period: forecast.swell_2_period ?? null, direction: forecast.swell_2_direction ?? null },
    { kind: 'wind_sea', height: forecast.wind_wave_height ?? null, period: forecast.wind_wave_period ?? null, direction: forecast.wind_wave_direction ?? null },
  ];
  return partitions
    .filter((partition) => partition.height !== null || partition.period !== null || partition.direction !== null)
    .map((partition) => ({ ...partition, heightUnit: 'ft', periodUnit: 's', directionUnit: null, validAt, source }));
}

function scoringComponentForForecast(
  forecast: EnhancedForecastEntity,
): WeekScoutForecastComponent['kind'] | null {
  const partition = (
    height: string | number | null | undefined,
    period: string | number | null | undefined,
    direction: string | number | null | undefined,
  ) => {
    const heightFt = finiteNumber(height);
    const periodSeconds = finiteNumber(period);
    const directionDegrees = getDirectionDegrees(direction);
    if (heightFt === null || periodSeconds === null || directionDegrees === null) return null;
    return { height: heightFt, period: periodSeconds, direction: directionDegrees };
  };
  const dominant = pickDominantSwell({
    swell_1: partition(forecast.swell_1_height, forecast.swell_1_period, forecast.swell_1_direction),
    swell_2: partition(forecast.swell_2_height, forecast.swell_2_period, forecast.swell_2_direction),
    wind_wave: partition(forecast.wind_wave_height, forecast.wind_wave_period, forecast.wind_wave_direction),
  });
  if (!dominant) return null;
  return dominant.source === 'wind_wave' ? 'wind_sea' : dominant.source;
}

function coverageExpiry(
  forecastsByBeach: Map<string, EnhancedForecastEntity[]>,
  generatedAt: string,
): string {
  let earliestDeadline: number | null = null;
  const recordDeadline = (deadline: number): void => {
    earliestDeadline = earliestDeadline === null ? deadline : Math.min(earliestDeadline, deadline);
  };
  for (const rows of forecastsByBeach.values()) {
    for (const row of rows) {
      if (typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at))) {
        const details = getStalenessDetails(row.updated_at, row.data_source);
        recordDeadline(Date.parse(row.updated_at) + details.threshold * 60 * 60 * 1000);
      }
      // Open-Meteo's receipt timestamp is a separate cache deadline. It does
      // not become provider issue/observation freshness in the API contract.
      if (row.data_source === 'OPEN_METEO' && typeof row.om_fetched_at === 'string' && Number.isFinite(Date.parse(row.om_fetched_at))) {
        const details = getStalenessDetails(row.om_fetched_at, row.data_source);
        recordDeadline(Date.parse(row.om_fetched_at) + details.threshold * 60 * 60 * 1000);
      }
    }
  }
  const generatedMs = Date.parse(generatedAt);
  // No returned rows means there is no stale forecast to conceal. Keep the
  // empty/incomplete response readable for one bounded refresh interval.
  const earliest = earliestDeadline ?? generatedMs + 60 * 1000;
  return new Date(Math.min(earliest, generatedMs + 60 * 1000)).toISOString();
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
      const rows: Beach[] = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await supabase
          .from('beaches')
          .select('*')
          .in('id', ids.slice(offset, offset + 100))
          .eq('is_private', false);
        if (error) throw new Error(`Failed to load Week Scout beaches: ${error.message}`);
        rows.push(...((data ?? []) as Beach[]));
      }
      const byId = new Map(rows.map((candidate) => [candidate.id, candidate]));
      return ids.map((id) => byId.get(id)).filter((candidate): candidate is Beach => Boolean(candidate));
    },
    fetchForecasts: async (beaches, forecastWindowHours, options) => {
      const result = await batchFetchForecasts(beaches, {
        forecastWindowHours,
        requirePerRowFreshness: options?.requirePerRowFreshness,
      });
      return new Map(result.successful.map(({ beach, forecasts }) => [beach.id, forecasts]));
    },
    fetchSunTimes: getBatchSunTimes,
    fetchRankingContext: fetchWeekScoutRankingContext,
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
    fetchMatchEvidence: fetchWeekScoutMatchEvidence,
    calculatePersonalizationBonus,
    selectBestWindows,
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

function buildDraftWindow(args: {
  beach: Beach;
  bucket: WeekScoutBucket;
  localDate: string;
  window: AuthoritativeWindow;
  isBeachDayBest: boolean;
  forecasts: EnhancedForecastEntity[];
  userSkillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  personalizationContext: PersonalizationContext | null;
  generatedAt: string;
  distanceMiles?: number;
  deps: WeekScoutServiceDependencies;
}): DraftWindow | null {
  const skillLevel = getSkillLevelOrDefault(args.userSkillLevel);
  const { window } = args;

  const forecast = representativeForecast(args.forecasts, window);
  if (!forecast) return null;

  const personalization = args.personalizationContext
    ? args.deps.calculatePersonalizationBonus(args.beach, forecast, args.personalizationContext)
    : { affinityBonus: 0, personalizationBonus: 0, reasons: [] };
  const detailed = args.deps.scoreBeach(args.beach, forecast, {
    affinityBonus: personalization.affinityBonus,
    userSkillLevel: skillLevel,
    beachSkillLevel: args.beach.skill_level,
  });
  const conditionScore = args.deps.scoreWindowCondition(
    forecast,
    args.beach,
    skillLevel,
    args.boardClasses,
  );
  const representativeScore = clampScore(
    conditionScore + personalization.affinityBonus + personalization.personalizationBonus,
  );
  const id = hash([
    args.beach.id,
    args.localDate,
    args.bucket,
    WEEK_SCOUT_SCORER_VERSION,
  ]).slice(0, 24);
  const windowForecasts = args.forecasts.filter((row) => {
    const time = new Date(row.forecast_at).getTime();
    return time >= window.start.getTime() && time < window.end.getTime();
  });
  const sourcesDisagree = windowForecasts.some((row) =>
    row.raw_forecast?.wave_source_selection?.disagreement === true,
  );
  const { label, character } = resolveRecommendationLabel({
    beach: args.beach, forecast, score: conditionScore,
  });
  const slotScores = windowForecasts
    .map((row) => args.deps.scoreWindowCondition(
      row,
      args.beach,
      skillLevel,
      args.boardClasses,
    ));
  const subscores = {
    ...detailed.subscores,
    personalizationBonus: personalization.personalizationBonus,
  };
  const reasons = [
    ...(sourcesDisagree ? ['Wave forecasts disagree; check conditions before choosing this window.'] : []),
    ...personalization.reasons, ...detailed.reasons,
  ];

  return {
    response: {
      id,
      bucket: args.bucket,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      displayWindowStart: window.displayWindowStart.toISOString(),
      displayWindowEnd: window.displayWindowEnd.toISOString(),
      peakTime: window.peakTime.toISOString(),
      beachId: args.beach.id,
      isBeachDayBest: args.isBeachDayBest,
      conditionScore,
      verdict: sourcesDisagree ? 'skip' : 'maybe',
      rideable: isRideable(forecast, args.userSkillLevel, args.boardClasses),
      safe: isSafe(detailed),
      confidence: finiteNumber(forecast.confidence_score),
      forecast: {
        waveHeight: forecast.wave_height ?? null,
        period: forecast.wave_period ?? null,
        swellDirection: forecast.wave_direction ?? null,
        windSpeed: forecast.wind_speed ?? null,
        windDirection: forecast.wind_direction ?? null,
        components: forecastComponents(forecast),
        scoringComponent: scoringComponentForForecast(forecast),
        waterTemp: forecast.water_temp ?? null,
        tideHeightFt: finiteNumber(forecast.tide_height),
        tidePhase: forecast.tide_status ?? null,
        freshnessAt: forecast.updated_at ?? forecast.forecast_at,
      },
      takeaway: reasons[0] ?? null,
    },
    recommendation: {
      recommendationId: id,
      beach: args.beach,
      window,
      forecast,
      score: representativeScore,
      recommendationLabel: sourcesDisagree ? 'Skip' : label,
      character,
      effects: detailed.effects,
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
  const rankedSpots = responses
    .filter((window) => window.safe && window.rideable && window.verdict !== 'skip')
    .map((window, index): WeekScoutRankedSpotResponse => ({
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
        components: window.forecast.components,
        scoringComponent: window.forecast.scoringComponent,
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
  profileExperience: unknown;
  response: MajorEventHoldWeekScoutResponse;
  beaches: readonly Beach[];
  forecastsByBeach: ReadonlyMap<string, EnhancedForecastEntity[]>;
  /** Each beach's best window per day inside the preferred session time; replaces the day best. */
  eligibleWindowIds?: ReadonlySet<string>;
}): CanonicalDecisionCandidate[] {
  const beachById = new Map(args.beaches.map((candidate) => [candidate.id, candidate]));

  return args.response.days.flatMap((day) =>
    day.windows.flatMap((window) => {
      const beach = beachById.get(window.beachId);
      const eligible = args.eligibleWindowIds
        ? args.eligibleWindowIds.has(window.id)
        : window.isBeachDayBest === true;
      if (
        !beach
        || !eligible
        || window.rankingScore === null
        || window.verdict === null
      ) {
        return [];
      }
      const forecast = nearestForecastForWindow(
        args.forecastsByBeach.get(window.beachId) ?? [],
        window.peakTime,
      );

      const candidate: CanonicalDecisionCandidate = {
        candidateId: window.id,
        beachId: window.beachId,
        beachName: beach.name,
        beachSkillLevel: beach.skill_level,
        windowStart: window.start,
        windowEnd: window.end,
        timezone: resolveBeachTimezone(beach.timezone),
        forecastId: forecast?.id ?? '',
        forecastAt: forecast?.forecast_at ?? '',
        waveHeight: window.forecast.waveHeight,
        utilityScore: window.rankingScore,
        // Same decision effects as surf/call and bulk, so a tide or swell
        // ceiling also caps the ranking-score label here.
        effects: forecast ? [...(scoreWindowWithComposite(forecast, beach).effects ?? [])] : [],
        // window.verdict already carries personal history (applied once in the
        // verdict pass), so the pool gets no second personal-match input.
        recommendationLabel: canonicalLabelForVerdict(window.verdict),
      };
      // Skips stay out, as on main, except unsafe or unrideable ones the engine
      // will veto: those go in so the decision carries the specific safety reason.
      if (
        window.verdict === 'skip'
        && !((!window.safe || !window.rideable) && candidateHasSafetyVeto(candidate, args.profileExperience))
      ) {
        return [];
      }
      return [candidate];
    }),
  );
}

/**
 * The day that holds the session pick names that pick as its best, so the day
 * cards and the Best card cannot name different beaches for the same day.
 * Distance friction still orders each day's list and picks every other day.
 */
export function alignDayBestWithSessionPick<T extends MajorEventHoldWeekScoutResponse>(
  response: T,
  sessionDecision: CanonicalSessionDecision,
): T {
  const selectedId = sessionDecision.verdict === 'no' ? null : sessionDecision.selection?.candidateId ?? null;
  if (!selectedId) return response;
  return {
    ...response,
    days: response.days.map((day) => {
      if (day.bestWindowId === null || day.bestWindowId === selectedId) return day;
      if (!day.windows.some((window) => window.id === selectedId)) return day;
      return {
        ...day,
        bestWindowId: selectedId,
        exclusionReasons: exclusionReasonsForDay(day.windows, selectedId),
      };
    }),
  };
}

function applyCanonicalDecisionToWeekScout(
  response: MajorEventHoldWeekScoutResponse,
  sessionDecision: CanonicalSessionDecision,
): CanonicalWeekScoutResponse {
  return {
    ...alignDayBestWithSessionPick(response, sessionDecision),
    sessionDecision,
  };
}

function exclusionReasonsForDay(
  windows: ReadonlyArray<MajorEventHoldWeekScoutResponse['days'][number]['windows'][number]>,
  bestWindowId: string | null,
): WeekScoutDayExclusionReason[] {
  if (bestWindowId !== null) return [];
  if (windows.length === 0) return ['no_forecasts'];
  const dayBestWindows = windows.filter((window) => window.isBeachDayBest);
  if (dayBestWindows.length === 0) return ['no_recommendable_windows'];
  const safeWindows = dayBestWindows.filter((window) => window.safe);
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

function compactHeldResponse<T extends MajorEventHoldWeekScoutResponse>(
  response: T,
  selectedWindowId?: string | null,
): T {
  return {
    ...response,
    days: response.days.map((day) => {
      const windows = BUCKETS.flatMap((bucket) => {
        const bucketWindows = day.windows.filter((window) => window.bucket === bucket);
        const visibleWindows = bucketWindows.filter((window) => window.rankingScore !== null);
        const selected = (
          visibleWindows.length > 0 ? visibleWindows : bucketWindows
        ).slice(0, WEEK_SCOUT_RESPONSE_RANK_LIMIT);
        const required = bucketWindows.filter((window) => (
          window.isBeachDayBest === true
          || window.id === day.bestWindowId
          || window.id === selectedWindowId
        ));
        const missingRequired = required.filter((window) => !selected.some((item) => item.id === window.id));
        if (missingRequired.length > 0) {
          const requiredIds = new Set(required.map((window) => window.id));
          const alreadySelectedRequired = selected.filter((window) => requiredIds.has(window.id));
          const nonRequired = selected.filter((window) => !requiredIds.has(window.id));
          const preservedRequired = [...alreadySelectedRequired, ...missingRequired];
          const availableSlots = Math.max(0, WEEK_SCOUT_RESPONSE_RANK_LIMIT - preservedRequired.length);
          selected.splice(0, selected.length, ...nonRequired.slice(0, availableSlots), ...preservedRequired);
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
  } as T;
}

function attachBestDayWindows<T extends MajorEventHoldWeekScoutResponse>(response: T): T {
  return {
    ...response,
    days: response.days.map((day) => ({
      ...day,
      bestDayWindow: day.windows.find((window) => window.id === day.bestWindowId) ?? null,
    })),
  } as T;
}

async function generateWeekScoutForecastInternal(
  userId: string,
  request: WeekScoutDaysRequest,
  dependencies?: WeekScoutServiceDependencies,
  compactResponse = true,
): Promise<GeneratedWeekScoutContext> {
  const deps = dependencies ?? defaultDependencies(new Date());
  const generatedAt = deps.now.toISOString();
  const localDates = Array.from(
    { length: request.dayCount },
    (_, index) => addLocalDays(request.startLocalDate, index),
  );
  // Canonical order breaks exact ties consistently before shared-setup ranking.
  const requestedEligibleCount = new Set(request.candidateBeachIds).size;
  const beaches = [...await deps.fetchBeaches(request.candidateBeachIds)]
    .sort((left, right) => left.id.localeCompare(right.id));
  const beachIds = beaches.map((candidate) => candidate.id);
  const forecastRequest = request.requirePerRowFreshness
    ? deps.fetchForecasts(beaches, 24 * (request.dayCount + 1), { requirePerRowFreshness: true })
    : deps.fetchForecasts(beaches, 24 * (request.dayCount + 1));
  const [forecastsByBeach, sunTimes, personalizationContext, userSkillLevel, boardClasses] = await Promise.all([
    forecastRequest,
    deps.fetchSunTimes(beachIds, localDates),
    deps.fetchRankingContext(userId),
    deps.fetchSkill(userId),
    deps.fetchBoardClasses?.(userId) ?? Promise.resolve([]),
  ]);

  const userPrefs = personalizationContext?.learnedPrefs ?? null;
  const draftsById = new Map<string, DraftWindow>();
  const draftsBySlot = new Map<string, DraftWindow>();

  const slotsByBeach = new Map(beaches.map((candidate) => [
    candidate.id,
    groupForecastsByLocalSlot(
      forecastsByBeach.get(candidate.id) ?? [],
      resolveBeachTimezone(candidate.timezone),
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

  const authoritiesByDate = new Map(localDates.map((localDate) => [
    localDate,
    new Map(beaches.map((candidate) => [
      candidate.id,
      selectBeachDayWindows({
        forecasts: forecastsByBeach.get(candidate.id) ?? [],
        beach: candidate,
        userPrefs,
        sunTimesCache: sunTimes,
        now: deps.now,
        userSkillLevel: getSkillLevelOrDefault(userSkillLevel),
        boardClasses,
        localDate,
        selectWindows: deps.selectBestWindows,
      }),
    ])),
  ]));
  const coverageByDate = new Map<string, WeekScoutCoverageDay>();
  const days = localDates.map((localDate): WeekScoutDayResponse => {
    const authoritiesByBeach = authoritiesByDate.get(localDate)!;
    const bucketCoverage: WeekScoutCoverageBucket[] = [];
    const windows = BUCKETS.flatMap((bucket) => {
      let evaluated = 0;
      let noWindow = 0;
      const drafts = beaches.flatMap((candidate) => {
        const bucketForecasts = slotsByBeach.get(candidate.id)?.get(slotKey(localDate, bucket)) ?? [];
        const authority = authoritiesByBeach.get(candidate.id);
        const window = authority?.dayparts[bucket] ?? null;
        if (bucketForecasts.length > 0) {
          evaluated += 1;
          if (!window) noWindow += 1;
        }
        if (!window) return [];

        const draft = buildDraftWindow({
          beach: candidate,
          bucket,
          localDate,
          window,
          isBeachDayBest: window === authority?.bestDayWindow,
          forecasts: forecastsByBeach.get(candidate.id) ?? [],
          userSkillLevel,
          boardClasses,
          personalizationContext,
          generatedAt,
          distanceMiles: distanceByBeachId.get(candidate.id),
          deps,
        });
        if (draft) {
          draftsById.set(draft.response.id, draft);
          draftsBySlot.set(`${localDate}:${bucket}:${candidate.id}`, draft);
        }
        return draft ? [draft] : [];
      });

      bucketCoverage.push({
        bucket,
        eligible: requestedEligibleCount,
        evaluated,
        missing: Math.max(0, requestedEligibleCount - evaluated),
        noWindow,
        held: null,
      });

      for (const draft of drafts) {
        const label = getCanonicalRecommendationLabel({
          ...draft.recommendation, score: draft.response.conditionScore,
        }, userSkillLevel);
        draft.response.verdict = label === 'Worth it' ? 'worth_it' : label === 'Maybe' ? 'maybe' : 'skip';
      }
      return rankDrafts(drafts, deps);
    });
    const best = windows
      .filter((candidate) => (
        candidate.isBeachDayBest
        && candidate.safe
        && candidate.rideable
        && candidate.verdict !== 'skip'
      ))
      .reduce<WeekScoutWindowResponse | null>((current, candidate) => (
        !current || compareWeekScoutWindows(
          candidate,
          current,
          distanceByBeachId.get(candidate.beachId),
          distanceByBeachId.get(current.beachId),
        ) < 0 ? candidate : current
      ), null);

    coverageByDate.set(localDate, {
      localDate,
      eligible: requestedEligibleCount,
      evaluated: new Set(bucketCoverage.flatMap((coverage) => {
        const matching = beaches.filter((beach) => (
          (slotsByBeach.get(beach.id)?.get(slotKey(localDate, coverage.bucket)) ?? []).length > 0
        ));
        return matching.map((beach) => beach.id);
      })).size,
      missing: 0,
      excluded: null,
      buckets: bucketCoverage,
    });
    const coverage = coverageByDate.get(localDate)!;
    coverage.missing = Math.max(0, coverage.eligible - coverage.evaluated);

    return {
      localDate,
      windows,
      bestWindowId: best?.id ?? null,
      bestDayWindow: null,
      exclusionReasons: exclusionReasonsForDay(windows, best?.id ?? null),
    };
  });
  const coverage: WeekScoutCoverage = {
    expiresAt: coverageExpiry(forecastsByBeach, generatedAt),
    days: localDates.map((localDate) => coverageByDate.get(localDate)!),
  };

  let response: WeekScoutResponse = {
    generatedAt,
    scorerVersion: WEEK_SCOUT_SCORER_VERSION,
    candidateFingerprint: hash([...beachIds].sort()),
    days,
  };
  let waterQualityResolution: WaterQualityHoldResolution | undefined;
  const safeWindows = await rankBeaches(
    response.days.flatMap((day) => day.windows).map((window) => ({
      id: window.beachId,
      window,
    })),
    {
      compare: (left, right) =>
        right.window.rankingScore - left.window.rankingScore,
      onWaterQualityResolution: (resolution) => { waterQualityResolution = resolution; },
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
  }, waterQualityResolution ? {
    // Both gates evaluate the same fresh beach-level evidence within this request.
    resolveWaterQualityHolds: async () => waterQualityResolution!,
  } : undefined);
  let heldResponse = sanitizeWeekScoutForMajorEventHold(
    response,
    candidates,
    decisions,
  );
  for (const coverageDay of coverage.days) {
    const before = response.days.find((day) => day.localDate === coverageDay.localDate);
    const after = heldResponse.days.find((day) => day.localDate === coverageDay.localDate);
    for (const bucketCoverage of coverageDay.buckets) {
      const beforeIds = new Set(
        before?.windows
          .filter((window) => window.bucket === bucketCoverage.bucket)
          .map((window) => window.id) ?? [],
      );
      const afterIds = new Set(
        after?.windows
          .filter((window) => window.bucket === bucketCoverage.bucket)
          .map((window) => window.id) ?? [],
      );
      bucketCoverage.held = [...beforeIds].filter((id) => !afterIds.has(id)).length;
    }
  }

  if (compactResponse) heldResponse = compactHeldResponse(heldResponse);
  const returnedDrafts = new Map<string, DraftWindow>();
  for (const day of heldResponse.days) {
    for (const window of day.windows) {
      if (window.verdict === null) continue;
      const draft = draftsById.get(window.id);
      if (draft) returnedDrafts.set(window.id, draft);
      for (const spot of window.rankedSpots) {
        const spotDraft = draftsBySlot.get(`${day.localDate}:${window.bucket}:${spot.beachId}`);
        if (spotDraft) returnedDrafts.set(spotDraft.response.id, spotDraft);
      }
    }
  }
  const similarity = await deps.fetchMatchEvidence(userId, beachIds,
    [...returnedDrafts.values()].map((draft) => draft.recommendation.forecast));
  const verdicts = new Map<string, WeekScoutVerdict>();
  for (const [id, draft] of returnedDrafts) {
    const forecast = draft.recommendation.forecast;
    // Personal history may only move safe, rideable windows.
    const eligibleForPersonal = draft.response.safe && draft.response.rideable;
    const label = getCanonicalRecommendationLabel({
      ...draft.recommendation, score: draft.response.conditionScore,
      similarity: eligibleForPersonal
        ? similarity.get(`${forecast.beach_id}:${forecast.forecast_at}`) ?? null
        : null,
    }, userSkillLevel);
    verdicts.set(id, label === 'Worth it' ? 'worth_it' : label === 'Maybe' ? 'maybe' : 'skip');
  }
  for (const day of heldResponse.days) {
    for (const window of day.windows) {
      if (window.verdict === null) continue;
      window.verdict = verdicts.get(window.id) ?? window.verdict;
      for (const spot of window.rankedSpots) {
        const draft = draftsBySlot.get(`${day.localDate}:${window.bucket}:${spot.beachId}`);
        if (draft) spot.verdict = verdicts.get(draft.response.id) ?? spot.verdict;
      }
    }
    // Preserve hold fallback selection; only replace a day best rejected by its new personal verdict.
    if (!day.bestWindowId || day.windows.find((window) => window.id === day.bestWindowId)?.verdict !== 'skip') continue;
    const best = day.windows.filter((window) => window.isBeachDayBest && window.safe
      && window.rideable && window.verdict !== null && window.verdict !== 'skip')
      .sort((left, right) => compareWeekScoutWindows(
        { conditionScore: left.conditionScore ?? 0, rankingScore: left.rankingScore ?? 0 },
        { conditionScore: right.conditionScore ?? 0, rankingScore: right.rankingScore ?? 0 },
        distanceByBeachId.get(left.beachId), distanceByBeachId.get(right.beachId)))[0];
    day.bestWindowId = best?.id ?? null;
    day.exclusionReasons = exclusionReasonsForDay(day.windows, day.bestWindowId);
  }

  return {
    heldResponse,
    beaches,
    forecastsByBeach,
    userSkillLevel,
    boardClasses,
    generatedAt,
    now: deps.now,
    coverage,
  };
}

function validateDayCount(dayCount: number): void {
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 7) {
    throw new Error('Week Scout dayCount must be between 1 and 7');
  }
}

/**
 * Window ids of each beach's highest-ranked window per day whose displayed
 * window overlaps the preferred hours. Raw windows can span most of a day, so
 * the check uses the range people actually see.
 */
function preferredSessionWindowIds(
  response: MajorEventHoldWeekScoutResponse,
  beaches: readonly Beach[],
  sessionTime: SessionTime | null | undefined,
): Set<string> | null {
  if (!sessionTime || sessionTime === 'any') return null;
  const timezoneByBeach = new Map(beaches.map((beach) => [beach.id, resolveBeachTimezone(beach.timezone)]));
  const best = new Map<string, { id: string; score: number }>();
  for (const day of response.days) {
    for (const window of day.windows) {
      const timezone = timezoneByBeach.get(window.beachId);
      if (!timezone || window.rankingScore === null || window.verdict === null) continue;
      if (!overlapsSessionTime(new Date(window.displayWindowStart), new Date(window.displayWindowEnd), timezone, sessionTime)) continue;
      const key = `${day.localDate}:${window.beachId}`;
      const current = best.get(key);
      if (!current || window.rankingScore > current.score) best.set(key, { id: window.id, score: window.rankingScore });
    }
  }
  return best.size > 0 ? new Set([...best.values()].map((entry) => entry.id)) : null;
}

/**
 * Each day's best window drawn from the preferred-time windows, so the day
 * cards agree with the session pick. A day with no preferred window keeps its
 * unfiltered best, and a day with no best (held, all skips) stays empty.
 */
function applyPreferredDayBest(
  response: MajorEventHoldWeekScoutResponse,
  preferredIds: ReadonlySet<string> | null,
  beaches: readonly Beach[],
  userLocation: Coordinates | undefined,
): MajorEventHoldWeekScoutResponse {
  if (!preferredIds) return response;
  const distanceByBeachId = new Map(beaches.map((beach) => {
    if (!userLocation) return [beach.id, undefined] as const;
    const miles = calculateDistanceInMiles(userLocation, { lat: beach.lat, lon: beach.lon });
    return [beach.id, Number.isFinite(miles) ? miles : undefined] as const;
  }));
  return {
    ...response,
    days: response.days.map((day) => {
      if (day.bestWindowId === null) return day;
      const best = day.windows
        .filter((window) => (
          preferredIds.has(window.id)
          && window.safe
          && window.rideable
          && window.verdict !== null
          && window.verdict !== 'skip'
          && window.rankingScore !== null
        ))
        .reduce<(typeof day.windows)[number] | null>((current, candidate) => (
          !current || compareWeekScoutWindows(
            { conditionScore: candidate.conditionScore ?? 0, rankingScore: candidate.rankingScore ?? 0 },
            { conditionScore: current.conditionScore ?? 0, rankingScore: current.rankingScore ?? 0 },
            distanceByBeachId.get(candidate.beachId),
            distanceByBeachId.get(current.beachId),
          ) < 0 ? candidate : current
        ), null);
      if (!best) return day;
      return {
        ...day,
        bestWindowId: best.id,
        exclusionReasons: exclusionReasonsForDay(day.windows, best.id),
      };
    }),
  };
}

function buildCanonicalWeekScoutResponse(
  context: GeneratedWeekScoutContext,
  request: WeekScoutDaysRequest,
): CanonicalWeekScoutResponse {
  const candidateArgs = {
    profileExperience: context.userSkillLevel,
    response: context.heldResponse,
    beaches: context.beaches,
    forecastsByBeach: context.forecastsByBeach,
  };
  // A preferred session time limits the pick to each beach's best window inside
  // those hours; with none available, fall back to every day-best window.
  const preferredIds = preferredSessionWindowIds(context.heldResponse, context.beaches, request.sessionTime);
  const preferredCandidates = preferredIds
    ? buildWeekScoutCanonicalCandidates({ ...candidateArgs, eligibleWindowIds: preferredIds })
    : [];
  const sessionTimePreference = preferredCandidates.length > 0 ? request.sessionTime ?? null : null;
  const canonicalCandidates = preferredCandidates.length > 0
    ? preferredCandidates
    : buildWeekScoutCanonicalCandidates(candidateArgs);
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

  const dayBestResponse = sessionTimePreference
    ? applyPreferredDayBest(context.heldResponse, preferredIds, context.beaches, request.userLocation)
    : context.heldResponse;
  const compacted = compactHeldResponse(
    {
      ...applyCanonicalDecisionToWeekScout(dayBestResponse, sessionDecision),
      coverage: context.coverage,
    },
    sessionDecision.selection?.candidateId,
  );
  return { ...attachBestDayWindows(compacted), sessionTimePreference };
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
  const context = await generateWeekScoutForecastInternal(userId, request, dependencies, false);
  return attachBestDayWindows(context.heldResponse);
}

export async function generateWeekScoutForecast(
  userId: string,
  request: WeekScoutRequest,
  dependencies?: WeekScoutServiceDependencies,
): Promise<CanonicalWeekScoutResponse> {
  const context = await generateWeekScoutForecastInternal(userId, request, dependencies);
  return buildCanonicalWeekScoutResponse(context, request);
}
