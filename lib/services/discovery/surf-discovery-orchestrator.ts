/**
 * Surf Discovery Orchestrator
 *
 * Orchestrates the surf discovery flow by composing modular services:
 * 1. CandidatePoolBuilder - Builds the candidate pool from GPS proximity,
 *    re-ordered by the user's stored preferences (see candidate-pool-fit)
 * 2. ForecastBatchFetcher - Fetches forecasts for all candidates in parallel
 * 3. WindowSelector - Selects best surf window for each beach
 * 4. ResponseFormatter - Enriches recommendations with photos and summaries
 *
 * This is the main entry point for surf discovery, extracted from surf-discovery-service.ts
 * for better modularity and testability.
 *
 * Performance: 3 DB queries total, parallel forecast fetching, 12s timeout
 *
 * @module lib/services/discovery/surf-discovery-orchestrator
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import { createContextLogger } from '@/lib/logger';
import { getFavoriteBeachesFromDb } from '@/lib/services/beach-query-service';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
  SurfDiscoveryOptions,
  DetailedScore,
  EveningTransition,
  PersonalizedForecastWindow,
} from '@/types/personalization';
import type { ConditionBadge } from '@/types/personalization';
import {
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
  beachToSpotProfile,
  forecastToSnapshot,
  getConditionCharacter,
} from '@/lib/domains/scoring';
import type { ConditionCharacterCategory } from '@/lib/domains/scoring';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { parseSkillLevel, getSkillLevelOrDefault, SKILL_WAVE_RANGES } from '@/lib/domains/user-preferences';
import { normalizeBoardClass, type BoardClass } from '@/lib/domains/rideability';
import { formatWaveHeightRangeString } from '@/lib/utils/wave-formatters';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { isFutureDayInTimezone } from '@/lib/utils/condition-tier-utils';
import { localDateTimeToUTC, resolveForecastTime } from '@/lib/utils/forecast-time-resolver';
import {
  getConditionBoardPick,
  toForecastForScoring,
  type BoardForPick,
} from '@/lib/scoring';
import {
  getNativeConditionMatchQuality,
  scoreNativeForecastSlot,
} from '@/lib/scoring/native-condition-score';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rankBeaches } from '@/lib/recommendations/selection';

// Import from other discovery modules
import {
  buildCandidatePool,
  CANDIDATE_POOL_LIMIT,
  MAX_CANDIDATE_RADIUS_MILES,
} from './candidate-pool-builder';
import { batchFetchForecasts } from './forecast-batch-fetcher';
import {
  calculateDistancePenalty,
  compareDiscoveryRecommendations,
  WORTH_THE_DRIVE_DISTANCE_MILES,
  WORTH_THE_DRIVE_REASON,
} from './distance-friction';
import {
  selectBestWindow,
  selectBestWindows,
  getLocalDateStr,
  getLocalHour,
  MIN_SESSION_HOURS,
  FORECAST_WINDOW_DURATION_MINUTES,
  PAST_WINDOW_TOLERANCE_MINUTES,
  scoreWindowConditionScore,
} from './window-selector';
import { scoreWindowConditionDetails } from './window-selector/window-scorer';
import {
  enrichWithPhotos,
  generateDiscoverySummary,
  getRecommendationLabel,
  getRecommendationLabelGated,
  buildDiscoveryMessage,
} from './response-formatter';
import { fetchPersonalizationContext, calculatePersonalizationBonus } from './personalization-layer';
import { applySimilarityLayer } from './similarity-layer';
import { computeWindowDistinctionReason } from './window-distinction';
import {
  aggregateBreakBehaviorSessions,
  applyBreakBehaviorScore,
  calculateBreakBehaviorScore,
  fetchBreakBehaviorSessionRows,
  groupBreakBehaviorRowsByBeach,
} from './break-behavior-score';
import { assignStrategyTags } from '@/lib/services/discovery/strategy-tags';
import { generateRegionalCall } from '@/lib/services/discovery/regional-call';
import type { WindSnapshot } from '@/lib/services/discovery/regional-call';
import { isAfterSunset, buildRestOfToday } from '@/lib/services/discovery/evening-transition';
import { logHeroRankingDiagnostic } from '@/lib/services/discovery/hero-ranking/diagnostics';
import { rerankHero } from '@/lib/services/discovery/hero-ranking';
import {
  buildRecommendationsV2,
  type RecommendationV2Candidate,
  type RecommendationV2SourceState,
} from '@/lib/services/discovery/recommendations-v2';
import { buildRecommendationEvidence } from '@/lib/services/discovery/recommendation-evidence';
import { FEATURE_HERO_WINDOW_SCORE } from '@/lib/constants/feature-flags';
import type { ScoringEngine } from '@/lib/domains/scoring';
import { resolveWavePunchiness } from '@/lib/domains/spot-profile/wave-punchiness';
import { boardStyleFit } from './board-style-fit';
import { resolveForecastAlignment } from './forecast-alignment';

const log = createContextLogger('SurfDiscoveryOrchestrator');

/**
 * Discovery reports an available pool: it filters resolved water-quality
 * closures per beach and never suppresses the response as a whole.
 */
const DISCOVERY_AVAILABILITY_HOLD_EPOCH = 'discovery-water-quality-filtered';

type BoardPickRow = {
  id: unknown;
  name: unknown;
  board_type: unknown;
  volume?: unknown;
};

type UserBoardContextRow = BoardPickRow & {
  session_count?: unknown;
};

interface UserBoardContext {
  dominantBoardClass: BoardClass | null;
  boardClasses: BoardClass[];
  boardsForPicks: BoardForPick[];
}

type BeachWithWavePunchiness = Beach & {
  wave_punchiness?: unknown;
  wave_punchiness_ai?: unknown;
  wave_punchiness_ai_confidence?: unknown;
};

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CONCURRENT = 5; // Increased from 3 for discovery
const DEFAULT_TIMEOUT_MS = 5000; // Per-beach timeout
const DEFAULT_OVERALL_TIMEOUT_MS = 12000; // Increased from 8s for more beaches
const MAX_INCLUDED_BEACH_IDS = 12;
const MAX_PUBLIC_CUSTOM_SPOTS = 5;

export type SurfDiscoveryOperationalErrorCode =
  | 'forecast_unavailable'
  | 'timeout'
  | 'internal_error';

export class SurfDiscoveryOperationalError extends Error {
  readonly retryable = true;

  constructor(
    readonly code: SurfDiscoveryOperationalErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SurfDiscoveryOperationalError';
  }
}

interface CustomSpotDiscoveryRow {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lon: number;
  visibility: string;
  nearest_beach_id: string | null;
  nearest_beach_distance_mi: number | null;
  break_type: string | null;
  facing_direction_deg: number | null;
  swell_window_min_deg: number | null;
  swell_window_max_deg: number | null;
  offshore_direction_deg: number | null;
  exposure_level: string | null;
  deleted_at: string | null;
}

interface CustomSpotDiscoveryCandidate {
  spot: CustomSpotDiscoveryRow;
  nearestBeach: Beach;
  isOwn: boolean;
  distanceMiles: number;
}

// ============================================================================
// Badge Generation
// ============================================================================

/**
 * Format wave height as a range string for badge display.
 * Uses actual min/max from a set of forecasts when provided.
 * Falls back to a floor/ceil bracket of the single-point face Hs otherwise.
 * Returns null for flat conditions (< 0.5ft average).
 *
 * @param waveHeight - Face wave height in feet (used for flat check and fallback)
 * @param forecasts - Optional hourly forecasts to derive actual min/max from
 * @returns Range string like "3-4ft" or null if flat
 */
export function formatWaveHeightRange(
  waveHeight: number,
  forecasts?: EnhancedForecastEntity[]
): string | null {
  if (waveHeight < 0.5) return null;

  if (forecasts && forecasts.length > 0) {
    const heights = forecasts
      .map((f) => parseFloat(String(f.wave_height ?? '')))
      .filter((h) => !isNaN(h) && h > 0);

    if (heights.length >= 2) {
      const min = Math.min(...heights);
      const max = Math.max(...heights);
      if (max > min) {
        return formatWaveHeightRangeString(min, max);
      }
    }
  }

  // Fallback: single-point face Hs, bracketed floor/ceil for Surfline parity.
  return formatWaveHeightRangeString(waveHeight, waveHeight);
}

function formatWindowWaveHeightBadge(
  forecasts: EnhancedForecastEntity[]
): string | null {
  const heights = forecasts
    .map((f) => parseFloat(String(f.wave_height ?? '')))
    .filter((h) => !isNaN(h) && h > 0);

  if (heights.length === 0) return null;
  return formatWaveHeightRangeString(Math.min(...heights), Math.max(...heights));
}

export function applyWindowWaveHeightBadgesForRecommendations(
  recommendations: SurfDiscoveryRecommendation[],
  forecastsByBeachId: Map<string, EnhancedForecastEntity[]>
): SurfDiscoveryRecommendation[] {
  return recommendations.map((rec) => {
    const allHourly = forecastsByBeachId.get(rec.beach.id) ?? [];
    const windowForecasts = allHourly.filter((f) => {
      const t = new Date(f.forecast_at);
      return t >= rec.window.start && t <= rec.window.end;
    });
    const waveHeightBadge = formatWindowWaveHeightBadge(windowForecasts);
    return waveHeightBadge ? { ...rec, waveHeightBadge } : rec;
  });
}

/**
 * Generate condition badges based on thresholds
 * Returns top 2-3 badges sorted by contribution
 */
function generateConditionBadges(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  subscores: { waveHeightFit: number; periodEnergyScore: number; windAlignment: number; tideFit: number }
): ConditionBadge[] {
  const badges: ConditionBadge[] = [];

  const windSpeed = parseFloat(String(forecast.wind_speed ?? '0'));
  const windDirection = forecast.wind_direction_deg ?? null;
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const offshoreDir = beach.wind_offshore_deg ?? 90;

  // Glass: wind < 5 mph
  if (windSpeed < 5) {
    badges.push({ label: 'Glass', contribution: subscores.windAlignment });
  }
  // Light Offshore: offshore direction AND < 10 mph
  else if (windDirection !== null && windSpeed < 10) {
    const angleDiff = Math.abs(windDirection - offshoreDir) % 360;
    const isOffshore = angleDiff <= 45 || angleDiff >= 315;
    if (isOffshore) {
      badges.push({ label: 'Light Offshore', contribution: subscores.windAlignment });
    }
  }

  // Clean Swell: period >= 12s
  if (wavePeriod >= 12) {
    badges.push({ label: 'Clean Swell', contribution: subscores.periodEnergyScore });
  }

  // Good Tide: if tide score is high (>= 12 out of 15)
  if (subscores.tideFit >= 12) {
    const tideStatus = forecast.tide_status?.toLowerCase() || '';
    if (tideStatus.includes('rising') || tideStatus.includes('incoming')) {
      badges.push({ label: 'Rising Tide', contribution: subscores.tideFit });
    } else if (tideStatus.includes('falling') || tideStatus.includes('outgoing')) {
      badges.push({ label: 'Falling Tide', contribution: subscores.tideFit });
    } else {
      badges.push({ label: 'Good Tide', contribution: subscores.tideFit });
    }
  }

  // Sort by contribution descending, take top 3
  return badges
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);
}

// ============================================================================
// Sun Time Fetching
// ============================================================================

/**
 * Batch fetch sun times (sunrise and sunset) for multiple beaches.
 * Returns a Map keyed by beachId -> { sunrises: Date[], sunsets: Date[] }
 */
export async function getBatchSunTimes(
  beachIds: string[],
  dates: string[]
): Promise<Map<string, { sunrises: Date[]; sunsets: Date[] }>> {
  const supabase = createSupabaseServiceRoleClient();

  const uniqueBeachIds = [...new Set(beachIds)];
  const uniqueDates = [...new Set(dates)];

  if (uniqueBeachIds.length === 0 || uniqueDates.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('sun_times')
    .select('beach_id, sunrise_utc, sunset_utc')
    .in('beach_id', uniqueBeachIds)
    .in('date', uniqueDates)
    .order('sunrise_utc', { ascending: true });

  if (error) {
    log.error('Error fetching sun times:', error);
    return new Map();
  }

  const sunMap = new Map<string, { sunrises: Date[]; sunsets: Date[] }>();

  data?.forEach((row) => {
    const beachId = row.beach_id;

    if (!sunMap.has(beachId)) {
      sunMap.set(beachId, { sunrises: [], sunsets: [] });
    }

    const entry = sunMap.get(beachId)!;

    if (row.sunrise_utc) {
      entry.sunrises.push(new Date(row.sunrise_utc));
    }
    if (row.sunset_utc) {
      entry.sunsets.push(new Date(row.sunset_utc));
    }
  });

  // Sort arrays
  sunMap.forEach((entry) => {
    entry.sunrises.sort((a, b) => a.getTime() - b.getTime());
    entry.sunsets.sort((a, b) => a.getTime() - b.getTime());
  });

  return sunMap;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function boundingBoxForRadius(
  center: { lat: number; lon: number },
  radiusMiles: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusMiles / 69;
  const lonScale = Math.cos((center.lat * Math.PI) / 180);
  const lonDelta = lonScale === 0 ? 180 : radiusMiles / (69 * Math.abs(lonScale));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLon: center.lon - lonDelta,
    maxLon: center.lon + lonDelta,
  };
}

function swellCenterAndHalfwidth(
  minDeg: number | null,
  maxDeg: number | null,
): { centerDeg: number | null; halfwidthDeg: number | null } {
  if (minDeg == null || maxDeg == null) {
    return { centerDeg: null, halfwidthDeg: null };
  }

  const normalizedMin = ((minDeg % 360) + 360) % 360;
  const normalizedMax = ((maxDeg % 360) + 360) % 360;
  let clockwiseSpan = (normalizedMax - normalizedMin + 360) % 360;
  if (clockwiseSpan === 0 && maxDeg !== minDeg) {
    clockwiseSpan = 360;
  }
  const centerDeg = (normalizedMin + clockwiseSpan / 2) % 360;
  return {
    centerDeg,
    halfwidthDeg: clockwiseSpan / 2,
  };
}

/**
 * Generate a primary recommendation reason based on skill match and conditions.
 * This becomes the hero subtitle in the Oracle UI.
 */
/** @internal Exported for testing */
export function generatePrimaryReason(
  beach: Beach,
  forecast: EnhancedForecastEntity,
  userSkillLevel: SkillLevel | null
): string | null {
  if (!userSkillLevel) return null;

  const waveHeight = parseFloat(String(forecast.wave_height ?? '0'));
  const beachSkill = parseSkillLevel(beach.skill_level);
  const userSkill = getSkillLevelOrDefault(userSkillLevel);
  const userRanges = SKILL_WAVE_RANGES[userSkill];

  const SKILL_RANK: Record<string, number> = {
    beginner: 0, intermediate: 1, advanced: 2, expert: 3,
  };

  const skillGap = (beachSkill ? SKILL_RANK[beachSkill] : 1) - SKILL_RANK[userSkill];
  const wavesManageable = waveHeight <= userRanges.ideal.max;

  if (skillGap <= 0) {
    return `Conditions at ${beach.name} match your experience level today`;
  }

  if (skillGap > 0 && wavesManageable) {
    const label = beachSkill ?? 'advanced';
    const heightDisplay = waveHeight > 0 ? ` ${Math.round(waveHeight * 10) / 10}ft` : '';
    return `${beach.name} is an ${label} spot, but today's${heightDisplay} conditions are manageable`;
  }

  const heightDisplay = waveHeight > 0 ? `${Math.round(waveHeight * 10) / 10}ft` : '';
  return `Heads up: ${beach.name} is pumping today —${heightDisplay ? ` ${heightDisplay}` : ''} waves are above your usual range`;
}

/**
 * Empty response for successful no-candidate and legacy fallback cases.
 */
function emptyResponse(
  maxResults: number,
  outcome: SurfDiscoveryResponse['metadata']['outcome'],
): SurfDiscoveryResponse {
  const generatedAt = new Date();
  return {
    recommendations: [],
    recommendationsV2: buildRecommendationsV2({
      candidates: [],
      now: generatedAt,
    }),
    searchCriteria: {
      maxResults,
    },
    metadata: {
      outcome,
      totalBeachesConsidered: 0,
      successfulForecasts: 0,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: generatedAt.toISOString(),
    },
    regionalCall: '',
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function deriveRecommendationV2SourceState(
  rec: SurfDiscoveryRecommendation,
  usingStaleData: boolean,
): RecommendationV2SourceState {
  if (usingStaleData) return 'degraded';
  if (rec.similarity?.state === 'onboarding') return 'starter_fit';
  if (rec.similarity?.state === 'ready' && rec.similarity.score < 6) {
    return 'low_confidence';
  }

  const copy = [
    rec.personalExplanation,
    rec.similarity?.state === 'ready' ? rec.similarity.reason : null,
    ...rec.reasons,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();

  if (/\b(avoid|avoided|skip|skipped|rough|too big|too small)\b/.test(copy)) {
    return 'avoidance_learning';
  }

  return 'learned';
}

function toRecommendationV2Candidate(
  rec: SurfDiscoveryRecommendation,
  rankingPosition: number,
  usingStaleData: boolean,
): RecommendationV2Candidate {
  const sourceState = deriveRecommendationV2SourceState(rec, usingStaleData);
  const conditionScore = typeof rec.window.score === 'number'
    ? rec.window.score
    : rec.score;
  const personalMatchScore = rec.similarity?.state === 'ready'
    ? rec.similarity.score
    : rec.similarity?.state === 'onboarding'
      ? 6
      : rec.score / 10;
  const label = rec.recommendationLabel ?? rec.matchQuality.toUpperCase();
  const forecastAt =
    typeof rec.forecast.forecast_at === 'string'
      ? rec.forecast.forecast_at
      : rec.window.start.toISOString();
  const recommendationEntityId =
    rec.kind === 'custom_spot' && rec.customSpotId
      ? `custom:${rec.customSpotId}`
      : `beach:${rec.beach.id}`;
  const evidence = buildRecommendationEvidence({
    sourceState,
    similarity: rec.similarity,
    personalExplanation: rec.personalExplanation,
    reasons: rec.reasons,
    summary: rec.summary,
    conditionBadges: rec.conditionBadges,
    conditionPositiveSessionCount: rec.similarity?.state === 'ready'
      ? rec.similarity.sessionCount
      : undefined,
    boardPick: rec.boardPick,
    boardLinkedPositiveCount: rec.similarity?.state === 'ready' && rec.boardPick
      ? rec.similarity.sessionCount
      : undefined,
  });

  return {
    recommendationId: `${recommendationEntityId}:${forecastAt}`,
    sourceState,
    beach: {
      id: rec.beach.id,
      name: rec.beach.name,
      lat: rec.beach.lat ?? null,
      lon: rec.beach.lon ?? null,
      photo_url: rec.beach.photo_url ?? null,
    },
    window: {
      start: rec.window.start,
      end: rec.window.end,
      timezone: rec.window.timezone,
    },
    conditionScore: clamp(conditionScore, 0, 100),
    personalMatchScore: clamp(personalMatchScore, 0, 10),
    overallScore: clamp(rec.score, 0, 100),
    label,
    reasonType: evidence.reasonType,
    proofSummary: evidence.proofSummary,
    evidenceFacts: evidence.evidenceFacts,
    rankingPosition,
  };
}

// ============================================================================
// Scoring Engine
// ============================================================================

// Singleton scoring engine instance for performance
let _discoveryScoringEngine: ReturnType<typeof createDiscoveryScoringEngine> | null = null;

function getDiscoveryScoringEngine() {
  if (!_discoveryScoringEngine) {
    _discoveryScoringEngine = createDiscoveryScoringEngine();
  }
  return _discoveryScoringEngine;
}

function normalizeBoardForPick(row: BoardPickRow): BoardForPick | null {
  if (
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.board_type !== 'string'
  ) {
    return null;
  }

  const volume =
    typeof row.volume === 'number' && Number.isFinite(row.volume)
      ? row.volume
      : null;

  return {
    id: row.id,
    name: row.name,
    board_type: row.board_type,
    volume,
  };
}

function resolveDominantBoardClass(rows: UserBoardContextRow[]): BoardClass | null {
  const candidates = rows
    .map((row) => {
      const boardClass =
        (typeof row.board_type === 'string' ? normalizeBoardClass(row.board_type) : null) ??
        (typeof row.name === 'string' ? normalizeBoardClass(row.name) : null);
      const sessionCount =
        typeof row.session_count === 'number' && Number.isFinite(row.session_count)
          ? row.session_count
          : 0;

      return { boardClass, sessionCount };
    })
    .filter(
      (c): c is { boardClass: BoardClass; sessionCount: number } => c.boardClass !== null
    );

  if (candidates.length === 0) return null;

  // Dominant board = most sessions; ties don't matter for a ±5 signal.
  candidates.sort((a, b) => b.sessionCount - a.sessionCount);
  return candidates[0].boardClass;
}

function resolveBoardClasses(rows: UserBoardContextRow[]): BoardClass[] {
  return Array.from(
    new Set(
      rows
        .map((row) => (
          typeof row.board_type === 'string' ? normalizeBoardClass(row.board_type) : null
        ))
        .filter((boardClass): boardClass is BoardClass => boardClass !== null)
    )
  );
}

function getWavePunchiness(beach: Beach): number | null {
  const b = beach as BeachWithWavePunchiness;
  return resolveWavePunchiness({
    override: typeof b.wave_punchiness === 'number' ? b.wave_punchiness : null,
    ai: typeof b.wave_punchiness_ai === 'number' ? b.wave_punchiness_ai : null,
    aiConfidence:
      typeof b.wave_punchiness_ai_confidence === 'number'
        ? b.wave_punchiness_ai_confidence
        : null,
    persona: beach.persona,
    break_type: beach.break_type,
    skill_level: beach.skill_level,
  });
}

async function fetchIncludedBeachCandidates(
  includeBeachIds: string[] | undefined,
  allowRecommendationIneligible: boolean,
): Promise<Beach[]> {
  const uniqueIds = Array.from(new Set(includeBeachIds ?? [])).slice(0, MAX_INCLUDED_BEACH_IDS);
  if (uniqueIds.length === 0) return [];

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('beaches')
    .select('*')
    .in('id', uniqueIds);

  if (error) {
    log.warn(`[discoverSurfSpots] Failed to fetch included beaches: ${error.message}`);
    return [];
  }

  const byId = new Map(
    ((data ?? []) as unknown as Array<Beach & { recommendation_eligible?: boolean }>)
      .filter(
        (beach) =>
          beach?.id &&
          beach.is_private !== true &&
          (allowRecommendationIneligible || beach.recommendation_eligible !== false),
      )
      .map((beach) => [beach.id, beach])
  );

  return uniqueIds
    .map((id) => byId.get(id))
    .filter((beach): beach is Beach => Boolean(beach));
}

async function fetchCustomSpotRows(
  userId: string,
  userLocation: { lat: number; lon: number },
  radiusMiles: number,
): Promise<CustomSpotDiscoveryRow[]> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const selectColumns = [
      'id',
      'user_id',
      'name',
      'lat',
      'lon',
      'visibility',
      'nearest_beach_id',
      'nearest_beach_distance_mi',
      'break_type',
      'facing_direction_deg',
      'swell_window_min_deg',
      'swell_window_max_deg',
      'offshore_direction_deg',
      'exposure_level',
      'deleted_at',
    ].join(', ');
    const bounds = boundingBoxForRadius(userLocation, radiusMiles);

    const [ownResult, publicResult] = await Promise.all([
      supabase
        .from('custom_spots')
        .select(selectColumns)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('lat', bounds.minLat)
        .lte('lat', bounds.maxLat)
        .gte('lon', bounds.minLon)
        .lte('lon', bounds.maxLon),
      supabase
        .from('custom_spots')
        .select(selectColumns)
        .eq('visibility', 'public')
        .is('deleted_at', null)
        .neq('user_id', userId)
        .gte('lat', bounds.minLat)
        .lte('lat', bounds.maxLat)
        .gte('lon', bounds.minLon)
        .lte('lon', bounds.maxLon),
    ]);

    if (ownResult.error) {
      log.warn(`[discoverSurfSpots] Failed to fetch own custom spots: ${ownResult.error.message}`);
    }
    if (publicResult.error) {
      log.warn(`[discoverSurfSpots] Failed to fetch public custom spots: ${publicResult.error.message}`);
    }

    const ownRows = ((ownResult.data ?? []) as unknown as CustomSpotDiscoveryRow[])
      .filter((spot) => spot.nearest_beach_id)
      .map((spot) => ({
        spot,
        distanceMiles: calculateDistance(userLocation, { lat: spot.lat, lon: spot.lon }),
      }))
      .filter(({ distanceMiles }) => Number.isFinite(distanceMiles) && distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .map(({ spot }) => spot);
    const publicRows = ((publicResult.data ?? []) as unknown as CustomSpotDiscoveryRow[])
      .filter((spot) => spot.nearest_beach_id)
      .map((spot) => ({
        spot,
        distanceMiles: calculateDistance(userLocation, { lat: spot.lat, lon: spot.lon }),
      }))
      .filter(({ distanceMiles }) => Number.isFinite(distanceMiles) && distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, MAX_PUBLIC_CUSTOM_SPOTS)
      .map(({ spot }) => spot);

    const byId = new Map<string, CustomSpotDiscoveryRow>();
    for (const spot of [...ownRows, ...publicRows]) {
      if (spot.id) byId.set(spot.id, spot);
    }
    return Array.from(byId.values());
  } catch (error) {
    log.warn('[discoverSurfSpots] Custom spot candidate lookup failed; continuing with beaches only', error);
    return [];
  }
}

async function buildCustomSpotCandidates(
  userId: string,
  userLocation: { lat: number; lon: number },
  radiusMiles: number,
): Promise<CustomSpotDiscoveryCandidate[]> {
  const spots = await fetchCustomSpotRows(userId, userLocation, radiusMiles);
  const nearestBeachIds = Array.from(
    new Set(spots.map((spot) => spot.nearest_beach_id).filter((id): id is string => Boolean(id)))
  );
  if (nearestBeachIds.length === 0) return [];

  const nearestBeaches = await fetchIncludedBeachCandidates(nearestBeachIds, true);
  const beachesById = new Map(nearestBeaches.map((beach) => [beach.id, beach]));

  return spots
    .map((spot) => {
      const nearestBeach = spot.nearest_beach_id ? beachesById.get(spot.nearest_beach_id) : undefined;
      if (!nearestBeach) return null;
      return {
        spot,
        nearestBeach,
        isOwn: spot.user_id === userId,
        distanceMiles: calculateDistance(userLocation, { lat: spot.lat, lon: spot.lon }),
      };
    })
    .filter((candidate): candidate is CustomSpotDiscoveryCandidate => candidate !== null);
}

function buildCustomSpotBeach(
  spot: CustomSpotDiscoveryRow,
  nearestBeach: Beach,
): Beach {
  const minDeg = spot.swell_window_min_deg ?? nearestBeach.swell_window_min_deg;
  const maxDeg = spot.swell_window_max_deg ?? nearestBeach.swell_window_max_deg;
  const computedSwellWindow = swellCenterAndHalfwidth(minDeg, maxDeg);

  return {
    ...nearestBeach,
    name: spot.name,
    lat: spot.lat,
    lon: spot.lon,
    break_type: spot.break_type ?? nearestBeach.break_type,
    aspect_deg: spot.facing_direction_deg ?? nearestBeach.aspect_deg,
    wind_offshore_deg: spot.offshore_direction_deg ?? nearestBeach.wind_offshore_deg,
    swell_window_min_deg: minDeg,
    swell_window_max_deg: maxDeg,
    swell_window_center_deg:
      computedSwellWindow.centerDeg ?? nearestBeach.swell_window_center_deg,
    swell_window_halfwidth_deg:
      computedSwellWindow.halfwidthDeg ?? nearestBeach.swell_window_halfwidth_deg,
  };
}

/**
 * Concatenate candidate sources, keeping the first occurrence of each beach.
 * Earlier pools win, so the ordering the pool builder produced survives.
 */
function mergeCandidatePools(...pools: Beach[][]): Beach[] {
  const byId = new Map<string, Beach>();
  for (const pool of pools) {
    for (const beach of pool) {
      if (beach?.id && !byId.has(beach.id)) {
        byId.set(beach.id, beach);
      }
    }
  }
  return Array.from(byId.values());
}

export function hasUsableTodayForecastForFallback(args: {
  forecasts: EnhancedForecastEntity[];
  beachTz: string;
  sunset: Date | null;
  now: Date;
}): boolean {
  const pastToleranceMs =
    (FORECAST_WINDOW_DURATION_MINUTES + PAST_WINDOW_TOLERANCE_MINUTES) * 60 * 1000;
  const usableCutoffMs = args.now.getTime() - pastToleranceMs;

  return args.forecasts.some((forecast) => {
    const forecastTime = new Date(forecast.forecast_at).getTime();
    if (!Number.isFinite(forecastTime) || forecastTime < usableCutoffMs) {
      return false;
    }
    const localHour = getLocalHour(new Date(forecastTime), args.beachTz);
    if (localHour === null || localHour < 6) return false;

    if (args.sunset) {
      return (
        forecastTime <=
        args.sunset.getTime() - MIN_SESSION_HOURS * 60 * 60 * 1000
      );
    }

    // When sun-times data is unavailable, use the selector's own defensive
    // daylight bounds. This lets an evening request move to tomorrow while
    // retaining today's pre-dawn/daytime rows as an intentional no-fallback
    // answer when they are still eligible for selection.
    return localHour < 18;
  });
}

function recommendationKey(rec: Pick<SurfDiscoveryRecommendation, 'kind' | 'customSpotId' | 'beach'>): string {
  return rec.kind === 'custom_spot'
    ? `custom:${rec.customSpotId ?? rec.beach.id}`
    : `beach:${rec.beach.id}`;
}

function recommendationIdFor(
  rec: Pick<
    SurfDiscoveryRecommendation,
    'kind' | 'customSpotId' | 'beach' | 'forecast' | 'window'
  >,
): string {
  const forecastAt =
    typeof rec.forecast.forecast_at === 'string'
      ? rec.forecast.forecast_at
      : rec.window.start.toISOString();
  return `${recommendationKey(rec)}:${forecastAt}`;
}

const CANONICAL_MATCH_LABELS = new Set([
  'EPIC',
  'GOOD',
  'FAIR',
  'RIDEABLE',
  'MEH',
]);

function hasCanonicalLearnedMatch(
  rec: SurfDiscoveryRecommendation,
): boolean {
  return (
    rec.similarity?.state === 'ready' &&
    CANONICAL_MATCH_LABELS.has(rec.similarity.label)
  );
}

function compareLearnedWindowCandidates(
  a: SurfDiscoveryRecommendation,
  b: SurfDiscoveryRecommendation,
): number {
  const aSimilarity = a.similarity?.state === 'ready' ? a.similarity : null;
  const bSimilarity = b.similarity?.state === 'ready' ? b.similarity : null;
  const matchDelta = (bSimilarity?.score ?? 0) - (aSimilarity?.score ?? 0);
  if (matchDelta !== 0) return matchDelta;

  const confidenceRank = { low: 0, medium: 1, high: 2 };
  const confidenceDelta =
    confidenceRank[bSimilarity?.confidence ?? 'low'] -
    confidenceRank[aSimilarity?.confidence ?? 'low'];
  if (confidenceDelta !== 0) return confidenceDelta;

  const physicalDelta = b.score - a.score;
  if (physicalDelta !== 0) return physicalDelta;

  const startDelta = a.window.start.getTime() - b.window.start.getTime();
  if (startDelta !== 0) return startDelta;

  return recommendationIdFor(a).localeCompare(recommendationIdFor(b));
}

function collapseWindowCandidates(
  recommendations: SurfDiscoveryRecommendation[],
): SurfDiscoveryRecommendation[] {
  const candidatesByRecommendation = new Map<
    string,
    SurfDiscoveryRecommendation[]
  >();
  for (const rec of recommendations) {
    const key = recommendationKey(rec);
    const candidates = candidatesByRecommendation.get(key) ?? [];
    candidates.push(rec);
    candidatesByRecommendation.set(key, candidates);
  }

  return Array.from(candidatesByRecommendation.values()).map((candidates) => {
    const learnedCandidates = candidates.filter(hasCanonicalLearnedMatch);
    if (learnedCandidates.length > 0) {
      return [...learnedCandidates].sort(compareLearnedWindowCandidates)[0];
    }

    return [...candidates].sort((a, b) => {
      const physicalDelta = compareDiscoveryRecommendations(a, b);
      if (physicalDelta !== 0) return physicalDelta;
      const startDelta = a.window.start.getTime() - b.window.start.getTime();
      if (startDelta !== 0) return startDelta;
      return recommendationIdFor(a).localeCompare(recommendationIdFor(b));
    })[0];
  });
}

function applyWorthTheDriveReasons(
  recommendations: SurfDiscoveryRecommendation[]
): SurfDiscoveryRecommendation[] {
  return recommendations.map((rec, index) => {
    if (
      index > 1 ||
      rec.distanceMiles === undefined ||
      rec.distanceMiles <= WORTH_THE_DRIVE_DISTANCE_MILES ||
      rec.reasons.includes(WORTH_THE_DRIVE_REASON)
    ) {
      return rec;
    }

    const reasons = [
      WORTH_THE_DRIVE_REASON,
      ...rec.reasons.filter((reason) => reason !== WORTH_THE_DRIVE_REASON),
    ].slice(0, 5);

    return {
      ...rec,
      reasons,
      message: buildDiscoveryMessage(
        rec.score,
        reasons,
        rec.warnings,
        rec.recommendationLabel
      ),
    };
  });
}

async function fetchUserBoardContext(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string,
  isPro: boolean
): Promise<UserBoardContext> {
  const { data, error } = await supabase
    .from('boards')
    .select('id, name, board_type, volume, session_count')
    .eq('user_id', userId);

  if (error) {
    log.warn(`Failed to fetch boards for discovery board context: ${error.message}`);
    return {
      dominantBoardClass: null,
      boardClasses: [],
      boardsForPicks: [],
    };
  }

  if (!Array.isArray(data)) {
    return {
      dominantBoardClass: null,
      boardClasses: [],
      boardsForPicks: [],
    };
  }

  const rows = data as UserBoardContextRow[];

  return {
    dominantBoardClass: resolveDominantBoardClass(rows),
    boardClasses: resolveBoardClasses(rows),
    boardsForPicks: isPro
      ? rows
          .map((row) => normalizeBoardForPick(row))
          .filter((board): board is BoardForPick => board !== null)
      : [],
  };
}

/**
 * Score every hourly forecast row inside the candidate's selected window
 * using the native-compatible condition score shown to users.
 *
 * Contract:
 *  - SpotProfile: rebuilt from `rec.beach` so it matches the profile that
 *    produced `rec.score` (orchestrator does not stash the SpotProfile on
 *    the rec; recreating it via `beachToSpotProfile` is referentially
 *    equivalent for the same beach row).
 *  - User context: passes `preferences: null` to mirror `build-recs.ts` and
 *    keep production output deterministic vs the test harness. Personalization
 *    that already lives in `rec.score` (affinityBonus / personalizationBonus)
 *    flows through `representativeSlotScore`, not the per-slot scores.
 *  - Engine: retained in the signature for test/backcompat; numeric output
 *    now comes from the native-compatible scorer.
 *  - Window bounds: filters `allHourly` to `forecast_at ∈ [start, end)`
 *    (inclusive start, exclusive end), then sorts ascending by `forecast_at`.
 *  - Missing data: malformed rows score 0.
 *  - Empty window: returns `[]`.
 *  - Return order: ascending by `forecast_at`, one entry per hourly row.
 */
/** @internal Exported for testing — see `__tests__/.../window-slot-scores.test.ts` */
export function computeWindowSlotScores(
  rec: SurfDiscoveryRecommendation,
  allHourly: EnhancedForecastEntity[],
  _scoringEngine: ScoringEngine,
  userSkillLevel?: SkillLevel | string | null,
  boardClasses: readonly BoardClass[] = [],
): number[] {
  const start = rec.window?.start;
  const end = rec.window?.end;
  if (!start || !end) return [];

  const startMs = start instanceof Date ? start.getTime() : Date.parse(String(start));
  const endMs = end instanceof Date ? end.getTime() : Date.parse(String(end));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];

  const inWindow = allHourly
    .filter((f) => {
      const t = new Date(f.forecast_at).getTime();
      return Number.isFinite(t) && t >= startMs && t < endMs;
    })
    .sort(
      (a, b) =>
        new Date(a.forecast_at).getTime() - new Date(b.forecast_at).getTime(),
    );

  if (inWindow.length === 0) return [];

  return inWindow.map((f) => {
    try {
      return boardClasses.length > 0
        ? scoreWindowConditionScore(f, rec.beach, userSkillLevel, null, boardClasses)
        : scoreNativeForecastSlot(f, userSkillLevel);
    } catch {
      return 0;
    }
  });
}

interface DiscoveryDisplayScore {
  displayConditionScore: number;
  /** Condition-only, clamped 0-100. Displayed, and drives the verdict. */
  total: number;
  /**
   * Condition score plus personalization/affinity/distance/board-fit, left
   * UNCLAMPED on purpose. Clamping this at 100 is what collapsed the ranked
   * list into ties: a spot at 88 conditions and one at 97 both landed on 100
   * once a +12 personalization bonus was added. Ordering only.
   */
  rankingTotal: number;
  matchQuality: DetailedScore['matchQuality'];
}

function clampDiscoveryScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/**
 * The number surfaces display: conditions only, clamped to the 0-100 scale the
 * UI and the verdict thresholds both assume.
 */
export function toDisplayConditionScore(conditionScore: number): number {
  return clampDiscoveryScore(conditionScore);
}

/**
 * The number that decides order. Personalization, affinity, distance and
 * board-fit belong here and nowhere else.
 *
 * Deliberately NOT clamped. When these bonuses were added into the displayed
 * score and the sum was capped at 100, every spot with decent conditions
 * reached the cap: ten recommendations rendered as "Score 100" and the ranked
 * list showed an order it could not justify. Leaving the ranking value
 * unbounded keeps those spots separable above the display ceiling.
 */
export function composeRankingScore(args: {
  conditionScore: number;
  affinityBonus: number;
  distancePenalty: number;
  personalizationBonus: number;
  boardStyleFitPoints: number;
}): number {
  return (
    args.conditionScore +
    args.affinityBonus +
    args.distancePenalty +
    args.personalizationBonus +
    args.boardStyleFitPoints
  );
}

function buildDiscoveryDisplayScore(args: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  userSkillLevel: SkillLevel | null;
  affinityBonus: number;
  distancePenalty: number;
  personalizationBonus: number;
  boardStyleFitPoints: number;
  boardClasses: readonly BoardClass[];
}): DiscoveryDisplayScore {
  const displayConditionScore = args.boardClasses.length > 0
    ? scoreWindowConditionScore(
        args.forecast,
        args.beach,
        args.userSkillLevel,
        null,
        args.boardClasses,
      )
    : scoreNativeForecastSlot(args.forecast, args.userSkillLevel);
  const nativeMatchQuality = getNativeConditionMatchQuality(displayConditionScore);

  return {
    displayConditionScore,
    // Displayed + verdict: conditions only, so the number and the label mean
    // the same thing.
    total: toDisplayConditionScore(displayConditionScore),
    // Ranking: personalization still decides order, it just no longer
    // contaminates (or saturates) the public number.
    rankingTotal: composeRankingScore({
      conditionScore: displayConditionScore,
      affinityBonus: args.affinityBonus,
      distancePenalty: args.distancePenalty,
      personalizationBonus: args.personalizationBonus,
      boardStyleFitPoints: args.boardStyleFitPoints,
    }),
    matchQuality: nativeMatchQuality === 'skip' ? 'minimal' : nativeMatchQuality,
  };
}

/**
 * Score beach for discovery with detailed sub-score breakdown.
 * Uses the domain-driven pluggable scoring engine.
 */
async function scoreBeachForDiscovery(args: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  /** Pre-parsed and validated skill level from candidate pool builder */
  userSkillLevel: SkillLevel | null;
  distanceMiles?: number;
  affinityBonus?: number;
  personalizationBonus?: number;
  personalizationReasons?: string[];
  dominantBoardClass?: BoardClass | null;
  boardClasses?: readonly BoardClass[];
}): Promise<DetailedScore & { rankingTotal: number }> {
  const { beach, forecast, userSkillLevel, distanceMiles } = args;

  // Keep domain-engine details for reasons/subscores; replace the displayed
  // total below with the native-compatible condition score.
  const engine = getDiscoveryScoringEngine();

  // Use affinity bonus from personalization layer if provided
  const affinityBonus = args.affinityBonus ?? 0;

  const distancePenalty = calculateDistancePenalty(distanceMiles);

  // userSkillLevel is pre-parsed as SkillLevel | null from candidate pool builder.
  const explanationScore = scoreBeachWithEngine(engine, beach, forecast, {
    affinityBonus,
    distancePenalty,
    userSkillLevel,
    beachSkillLevel: beach.skill_level,
  });

  const persBonus = args.personalizationBonus ?? 0;
  const boardStyle = boardStyleFit(
    getWavePunchiness(beach),
    args.dominantBoardClass ?? null
  );
  const displayScore = buildDiscoveryDisplayScore({
    beach,
    forecast,
    userSkillLevel,
    affinityBonus,
    distancePenalty,
    personalizationBonus: persBonus,
    boardStyleFitPoints: boardStyle.points,
    boardClasses: args.boardClasses ?? [],
  });

  const detailedScore = {
    ...explanationScore,
    total: displayScore.total,
    rankingTotal: displayScore.rankingTotal,
    matchQuality: displayScore.matchQuality,
  };
  if (persBonus !== 0) {
    detailedScore.subscores.personalizationBonus = persBonus;
  }

  // Merge personalization reasons
  if (args.personalizationReasons && args.personalizationReasons.length > 0) {
    detailedScore.reasons = [...args.personalizationReasons, ...detailedScore.reasons];
  }

  if (boardStyle.reason) {
    detailedScore.reasons = [boardStyle.reason, ...detailedScore.reasons];
  }
  if (boardStyle.warning) {
    detailedScore.warnings.push(boardStyle.warning);
  }

  // Add distance warning if far
  if (distanceMiles !== undefined && distanceMiles > 30) {
    detailedScore.warnings.push(`${Math.round(distanceMiles)} miles away - long drive`);
  }

  // Generate primary recommendation reason for skill-aware communication
  const primaryReason = generatePrimaryReason(beach, forecast, userSkillLevel);
  if (primaryReason) {
    detailedScore.reasons = [primaryReason, ...detailedScore.reasons.filter(r => r !== primaryReason)];
  }

  // Generate condition badges (keep existing badge generation)
  const conditionBadges = generateConditionBadges(forecast, beach, detailedScore.subscores);

  // Generate wave height badge from forecast
  const waveHeight = parseFloat(String(forecast.wave_height ?? '0'));
  const waveHeightBadge = formatWaveHeightRange(waveHeight);

  return {
    ...detailedScore,
    conditionBadges,
    waveHeightBadge: waveHeightBadge ?? undefined,
    reasons: detailedScore.reasons.slice(0, 5),
  };
}

// Immediate discovery ranks the forecast bucket that covers "right now".
// Keep this separate from daypart window selection so "now" cannot drift into
// a future best-window scan.
const IMMEDIATE_FORECAST_BUCKET_MAX_HOURS = 4;

interface ImmediateForecastBucket {
  forecast: EnhancedForecastEntity;
  start: Date;
  end: Date;
}

function capImmediateEndAtSunset(
  end: Date,
  now: Date,
  beachTz: string,
  sunTimes: { sunrises: Date[]; sunsets: Date[] } | undefined
): Date {
  const todayStr = getLocalDateStr(now, beachTz);
  const sameDaySunset = sunTimes?.sunsets.find(
    (sunset) => getLocalDateStr(sunset, beachTz) === todayStr
  );
  // Only trim once we know sunset is still ahead. Past sunset the trim pulled
  // end back before now, and the caller reads end <= now as "no window" — that
  // emptied the Now feed for the whole evening.
  if (sameDaySunset && sameDaySunset < end && sameDaySunset > now) {
    return sameDaySunset;
  }
  if (!sameDaySunset) {
    try {
      const localDateParts = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: beachTz,
      }).formatToParts(now);

      const year = localDateParts.find((part) => part.type === 'year')?.value;
      const month = localDateParts.find((part) => part.type === 'month')?.value;
      const day = localDateParts.find((part) => part.type === 'day')?.value;
      if (!year || !month || !day) return end;

      const conservative6pm = localDateTimeToUTC(`${year}-${month}-${day}`, '18:00:00', beachTz);
      if (conservative6pm < end) {
        return conservative6pm;
      }
    } catch {
      return end;
    }
  }
  return end;
}

function findImmediateForecastBucket(
  forecasts: EnhancedForecastEntity[],
  beachTz: string,
  now: Date
): ImmediateForecastBucket | null {
  const sortedForecasts = forecasts
    .map((forecast) => ({
      forecast,
      forecastTime: resolveForecastTime(forecast, beachTz),
    }))
    .filter(({ forecastTime }) => Number.isFinite(forecastTime.getTime()))
    .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());

  let activeBucket: ImmediateForecastBucket | null = null;
  const nowMs = now.getTime();

  for (let index = 0; index < sortedForecasts.length; index++) {
    const current = sortedForecasts[index];
    const next = sortedForecasts[index + 1];
    const fallbackEnd = new Date(
      current.forecastTime.getTime() + IMMEDIATE_FORECAST_BUCKET_MAX_HOURS * 60 * 60 * 1000
    );
    const gapHours = next
      ? (next.forecastTime.getTime() - current.forecastTime.getTime()) / (60 * 60 * 1000)
      : null;
    const bucketEnd =
      next && gapHours !== null && gapHours > 0 && gapHours <= IMMEDIATE_FORECAST_BUCKET_MAX_HOURS
        ? next.forecastTime
        : fallbackEnd;

    if (current.forecastTime.getTime() <= nowMs && bucketEnd.getTime() > nowMs) {
      activeBucket = {
        forecast: current.forecast,
        start: current.forecastTime,
        end: bucketEnd,
      };
    }
  }

  return activeBucket;
}

function selectImmediateWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  sunTimesCache: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  now: Date,
  userSkillLevel?: SkillLevel | string | null,
  boardClasses: readonly BoardClass[] = [],
): PersonalizedForecastWindow | null {
  if (forecasts.length === 0) return null;

  const beachTz =
    (beach as { timezone?: string | null }).timezone ||
    getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);
  const sunTimes = sunTimesCache.get(beach.id);

  // "Now" means now: no daylight gate. A surfer checking at 4am or after dark
  // still needs the current reading, and gating on local hour left the Now feed
  // empty every evening and every pre-dawn check.
  const bucket = findImmediateForecastBucket(forecasts, beachTz, now);
  if (!bucket) return null;

  const end = capImmediateEndAtSunset(bucket.end, now, beachTz, sunTimes);
  if (end.getTime() <= now.getTime()) return null;

  const wind = [bucket.forecast.wind_speed, bucket.forecast.wind_direction]
    .filter((part) => part != null && String(part).trim().length > 0)
    .join(' ');

  return {
    start: bucket.start,
    end,
    tide: bucket.forecast.tide_status || 'Unknown',
    wind: wind || 'Unknown',
    waveHeight: bucket.forecast.wave_height || 'Unknown',
    wavePeriod: bucket.forecast.wave_period || 'Unknown',
    dataSource: bucket.forecast.data_source || 'FALLBACK',
    confidence: bucket.forecast.confidence_score || 50,
    timezone: beachTz,
    usedTideBoundaries: false,
    score: scoreWindowConditionScore(
      bucket.forecast,
      beach,
      userSkillLevel,
      null,
      boardClasses,
    ),
    peakTime: now,
    sourceForecast: bucket.forecast,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Inner orchestration function that performs the actual discovery work.
 * Extracted for timeout wrapping with Promise.race.
 */
async function discoverSurfSpotsInner(
  userId: string,
  userLocation: { lat: number; lon: number },
  options: SurfDiscoveryOptions,
  startTime: number
): Promise<SurfDiscoveryResponse> {
  const {
    radiusMiles: requestedRadiusMiles,
    horizonHours,
    forecastAt,
    maxResults = DEFAULT_MAX_RESULTS,
    candidatePoolLimit = CANDIDATE_POOL_LIMIT,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    timeout = DEFAULT_TIMEOUT_MS,
    overallTimeout = DEFAULT_OVERALL_TIMEOUT_MS,
    timeSlot,
    discoveryMode = 'best-window',
    isPro = false,
    includeBeachIds,
    allowRecommendationIneligibleIncludes = false,
  } = options;
  // `candidatePoolLimit` (how many beaches get forecasts fetched and scored) is
  // NOT `maxResults` (how many are shown). Shrinking the pool to the size of the
  // result list narrows the ranking universe to the physically nearest handful
  // and quietly hides better spots a few miles further out.
  const effectiveCandidatePoolLimit = Math.min(
    CANDIDATE_POOL_LIMIT,
    Math.max(1, Math.floor(candidatePoolLimit)),
  );
  const radiusMiles =
    requestedRadiusMiles === undefined
      ? MAX_CANDIDATE_RADIUS_MILES
      : Math.min(Math.max(requestedRadiusMiles, 0), MAX_CANDIDATE_RADIUS_MILES);
  const requestedIncludeBeachIds = Array.from(new Set(includeBeachIds ?? []))
    .slice(0, MAX_INCLUDED_BEACH_IDS);
  const requestedIncludeBeachIdSet = new Set(requestedIncludeBeachIds);

  log.debug(`Discovering surf spots for user ${userId} (maxResults: ${maxResults})`);

  // 1. Build candidate pool (GPS-based, re-ordered by pre-forecast preference fit)
  const [{ candidates, userSkillLevel }, includedCandidates, customSpotCandidates] = await Promise.all([
    buildCandidatePool(userId, {
      userLocation,
      radiusMiles: requestedRadiusMiles,
    }),
    fetchIncludedBeachCandidates(
      requestedIncludeBeachIds,
      allowRecommendationIneligibleIncludes,
    ),
    buildCustomSpotCandidates(userId, userLocation, radiusMiles),
  ]);

  // Explicit include targets and custom-spot host beaches reserve their slots
  // first; whatever is left of the pool budget goes to nearby discovery.
  // Included beaches are capped separately at the route boundary so saved/home
  // targets can be scored without N native calls.
  const customNearestCandidates = customSpotCandidates.map((candidate) => candidate.nearestBeach);
  const nearbyCandidateSlots = Math.min(
    candidates.length,
    Math.max(
      0,
      effectiveCandidatePoolLimit - includedCandidates.length - customNearestCandidates.length
    )
  );
  // `candidates` arrives pool-ordered (pinned spots, then effective distance),
  // so taking a prefix keeps home/saved spots even when the cap bites.
  const nearbyCandidates = candidates.slice(0, nearbyCandidateSlots);
  const finalCandidates = mergeCandidatePools(
    nearbyCandidates,
    includedCandidates,
    customNearestCandidates,
  ).slice(0, effectiveCandidatePoolLimit);
  // A custom spot is only "primary" (eligible for the Now/Best feeds) when it's
  // as close as the nearby beaches — the same nearest-within-radius cut curated
  // beaches pass. Without this an own custom spot surfaces in Now/Best from
  // anywhere in radius and out-ranks the curated beach it borrows its forecast
  // from. Gated-out OWN spots still fall through to includedRecommendations
  // (My spots only); far public spots drop out entirely, same as a far beach.
  // Boundary is the furthest nearby beach once the pool cap bites; before that
  // every in-radius beach is nearby, so the boundary is the radius itself.
  const nearbyMaxMiles =
    candidates.length > nearbyCandidateSlots
      ? nearbyCandidates.reduce(
          (miles, beach) =>
            Math.max(miles, calculateDistance(userLocation, { lat: beach.lat || 0, lon: beach.lon || 0 })),
          0,
        )
      : radiusMiles;
  const primaryEligibleKeys = new Set<string>([
    ...nearbyCandidates.map((beach) => `beach:${beach.id}`),
    ...customSpotCandidates
      .filter((candidate) => candidate.distanceMiles <= nearbyMaxMiles)
      .map((candidate) => `custom:${candidate.spot.id}`),
  ]);
  const discoverableBeachIds = new Set(
    [...nearbyCandidates, ...includedCandidates].map((beach) => beach.id)
  );
  const customSpotCandidatesByNearestBeachId = new Map<string, CustomSpotDiscoveryCandidate[]>();
  for (const candidate of customSpotCandidates) {
    const nearestBeachId = candidate.nearestBeach.id;
    const existing = customSpotCandidatesByNearestBeachId.get(nearestBeachId) ?? [];
    existing.push(candidate);
    customSpotCandidatesByNearestBeachId.set(nearestBeachId, existing);
  }

  if (finalCandidates.length === 0) {
    log.warn(`No candidate beaches found for user ${userId}`);
    return emptyResponse(maxResults, 'no_candidates');
  }

  log.debug(
    `Found ${finalCandidates.length} candidate beaches ` +
    `(${nearbyCandidateSlots} nearby, ${includedCandidates.length} included, ` +
    `${customSpotCandidates.length} custom spots)`
  );

  // 2. Fetch forecasts for all candidates
  let { successful: beachForecasts, failed: failedForecasts, staleCount } = await batchFetchForecasts(finalCandidates, {
    maxConcurrent,
    timeout,
    overallTimeout,
  });

  let usingStaleData = false;

  const successRate = beachForecasts.length / finalCandidates.length;
  const successPercent = Math.round(successRate * 100);

  log.debug(
    `Retrieved forecasts: ${beachForecasts.length}/${finalCandidates.length} beaches (${successPercent}%)`
  );

  // Log failures and staleness context
  if (failedForecasts.length > 0 || staleCount > 0) {
    log.warn(
      `Forecast issues: ${failedForecasts.length} failed, ${staleCount} stale (stale data excluded)`
    );
  }

  // Stale-data fallback: when ALL beaches fail freshness check, retry with allowStale
  if (beachForecasts.length === 0) {
    const staleBeachCount = failedForecasts.filter(f => f.stale).length;
    if (staleBeachCount > 0) {
      log.error(
        `[STALE_FALLBACK] No fresh forecasts available — falling back to stale data for ${staleBeachCount}/${finalCandidates.length} beaches. ` +
        `Forecast pipeline may be down. Check cron jobs: enhanced-forecast-sync-cdip, enhanced-forecast-sync.`
      );
      const staleFallback = await batchFetchForecasts(finalCandidates, {
        maxConcurrent,
        timeout,
        overallTimeout,
        allowStale: true,
      });
      beachForecasts = staleFallback.successful;
      failedForecasts = staleFallback.failed;
      staleCount = staleFallback.staleCount;
      usingStaleData = true;
    }

    if (beachForecasts.length === 0) {
      log.error(`No forecasts retrieved for user ${userId} (even with stale fallback)`);
      throw new SurfDiscoveryOperationalError(
        'forecast_unavailable',
        'No forecasts were available for discovery candidates',
      );
    }
  }

  // Build a lookup map of all hourly forecasts keyed by beach ID.
  // Used later to compute per-slot wave heights and accurate waveHeightBadge for the top rec.
  const forecastsByBeachId = new Map<string, EnhancedForecastEntity[]>();
  for (const { beach, forecasts } of beachForecasts) {
    forecastsByBeachId.set(beach.id, forecasts);
  }

  // Collect all dates from forecasts and fetch sun times
  const allDates = new Set<string>();
  const allBeachIds = new Set<string>();

  for (const { beach, forecasts } of beachForecasts) {
    allBeachIds.add(beach.id);
    for (const f of forecasts) {
      // Extract date from forecast_at (UTC date portion) for sun times lookup
      allDates.add(f.forecast_at ? f.forecast_at.split('T')[0] : f.forecast_date);
    }
  }

  // CRITICAL: Always include today and next 2 days in UTC format
  // This fixes a bug where forecast_date values might not include today's date
  // when viewing in a timezone ahead of UTC (e.g., Hawaii beaches viewed in the afternoon).
  // The sun_times table stores dates in UTC, so we need to ensure we query for:
  // - Yesterday (in case of timezone edge cases)
  // - Today
  // - Tomorrow
  // - Day after tomorrow
  const now = new Date();
  for (let dayOffset = -1; dayOffset <= 2; dayOffset++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() + dayOffset);
    allDates.add(d.toISOString().split('T')[0]);
  }

  // Fetch sunsets (now returns Map<beachId, Date[]>)
  const uniqueDates = Array.from(allDates);
  const supabase = createSupabaseServiceRoleClient();
  const candidateBeachIds = Array.from(allBeachIds);

  // Only personalization depends on preferences; other reads can start immediately.
  const userPrefsPromise = getUserSurfPreferences(userId).catch((err) => {
    log.warn('Failed to fetch user surf preferences, continuing without them', err);
    return null;
  });

  // Batch-fetch sun times, water quality, personalization, behavior, and Pro board context in parallel
  const [
    sunTimesCache,
    wqResult,
    personalizationCtx,
    userBoardContext,
    breakBehaviorRows,
    userPrefs,
  ] = await Promise.all([
    getBatchSunTimes(Array.from(allBeachIds), uniqueDates),
    supabase
      .from('beach_water_quality')
      .select('beach_id, status')
      .in('beach_id', candidateBeachIds),
    userPrefsPromise.then((prefs) => fetchPersonalizationContext(userId, candidateBeachIds, prefs)),
    fetchUserBoardContext(supabase, userId, isPro),
    fetchBreakBehaviorSessionRows(supabase, candidateBeachIds, { now }),
    userPrefsPromise,
  ]);
  const {
    dominantBoardClass,
    boardClasses,
    boardsForPicks: userBoardsForPicks,
  } = userBoardContext;
  const breakBehaviorRowsByBeach = groupBreakBehaviorRowsByBeach(breakBehaviorRows);

  const wqMap = new Map<string, string>();
  for (const row of wqResult.data ?? []) {
    wqMap.set(row.beach_id, row.status);
  }

  // 3. Score each beach with detailed breakdown
  const scored: SurfDiscoveryRecommendation[] = [];

  const beachesWithNoWindow: string[] = [];
  for (const { beach, forecasts } of beachForecasts) {
    // Today-first: try today's forecasts first, fall back to all (matches beach detail page)
    const beachTz = getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);
    const requestedAlignment = forecastAt
      ? resolveForecastAlignment(forecasts, forecastAt)
      : null;
    const scopedForecasts = requestedAlignment?.forecast
      ? [requestedAlignment.forecast]
      : [];
    const selectionNow = forecastAt ? new Date(forecastAt) : new Date();
    const todayStr = getLocalDateStr(selectionNow, beachTz);
    const todayForecasts = forecasts.filter(f =>
      getLocalDateStr(new Date(f.forecast_at), beachTz) === todayStr
    );

    // Try today's forecasts first so we don't flip the hero to "Tomorrow's
    // dawn patrol" while today's dawn is still minutes away (the 6:23 AM
    // regression guarded by the no-fall-through test in this suite). Fall
    // through to the full forecast set in two cases:
    //   1. todayForecasts was empty (data only starts tomorrow)
    //   2. today-only returned null AND today is physically over for surf —
    //      either past sunset, OR within MIN_SESSION_HOURS of it so no
    //      remaining forecast can form a viable window. Mirrors the
    //      window-selector's own pre-sunset reject at
    //      window-selector-core.ts:565, closing the dead-zone where
    //      today-only returns null but we aren't technically past sunset
    //      yet (e.g. 19:21 PDT with sunset 19:31).
    const nowForFallback = selectionNow;
    const beachSunTimes = sunTimesCache.get(beach.id);
    const beachSameDaySunset = beachSunTimes?.sunsets.find(
      (s: Date) => getLocalDateStr(s, beachTz) === todayStr
    );
    const hoursUntilSunset = beachSameDaySunset
      ? (beachSameDaySunset.getTime() - nowForFallback.getTime()) / (60 * 60 * 1000)
      : null;
    // Forecasts arrive at 3-hour cadence, so the dead zone is wider than the
    // sunset proximity check alone catches: at 17:52 PDT with sunset 19:30,
    // hoursUntilSunset=1.6 (gate stays closed) but the only remaining today
    // slots are 20:00/23:00 (both post-sunset). Detect that case explicitly
    // by checking whether any cached today forecast is still pre-sunset AND
    // not yet stale per the window selector's own past-tolerance filter
    // (window-selector-core.ts:103-110). Mirroring that filter keeps this
    // gate aligned with what selectBestWindow actually accepts.
    const hasUsableTodayForecast = hasUsableTodayForecastForFallback({
      forecasts: todayForecasts,
      beachTz,
      sunset: beachSameDaySunset ?? null,
      now: nowForFallback,
    });
    const todayIsEffectivelyOver =
      (hoursUntilSunset !== null && hoursUntilSunset < MIN_SESSION_HOURS) ||
      (todayForecasts.length > 0 && !hasUsableTodayForecast);

    let selectedWindows =
      forecastAt
        ? scopedForecasts.length > 0
          ? selectBestWindows({
              forecasts: scopedForecasts,
              beach,
              userPrefs,
              horizonHours,
              sunTimesCache,
              timeSlot,
              now: selectionNow,
              maxWindows: 1,
              userSkillLevel,
              boardClasses,
            })
          : []
        : discoveryMode === 'now'
          ? [
              selectImmediateWindow(
                forecasts,
                beach,
                sunTimesCache,
                nowForFallback,
                userSkillLevel,
                boardClasses,
              ),
            ].filter(
              (window): window is PersonalizedForecastWindow => window !== null,
            )
          : todayForecasts.length > 0
            ? selectBestWindows({
                forecasts: todayForecasts,
                beach,
                userPrefs,
                horizonHours,
                sunTimesCache,
                timeSlot,
                now: nowForFallback,
                maxWindows: 3,
                userSkillLevel,
                boardClasses,
              })
            : [];

    if (
      discoveryMode !== 'now' &&
      !forecastAt &&
      selectedWindows.length === 0 &&
      (todayForecasts.length === 0 || todayIsEffectivelyOver)
    ) {
      selectedWindows = selectBestWindows({
        forecasts,
        beach,
        userPrefs,
        horizonHours,
        sunTimesCache,
        timeSlot,
        now: nowForFallback,
        maxWindows: 3,
        userSkillLevel,
        boardClasses,
      });
      if (selectedWindows.length === 0 && todayForecasts.length === 0) {
        log.warn(`[discoverSurfSpots] ${beach.name}: no today forecasts (total=${forecasts.length}), tomorrow fallback returned null`);
      } else if (selectedWindows.length === 0) {
        log.warn(`[discoverSurfSpots] ${beach.name}: pre/post-sunset fall-through failed (today=${todayForecasts.length}, total=${forecasts.length}, hoursUntilSunset=${hoursUntilSunset?.toFixed(2)})`);
      }
    }

    if (selectedWindows.length === 0) {
      beachesWithNoWindow.push(beach.name);
      log.debug(`[discoverSurfSpots] ${beach.name}: selectBestWindows returned no windows (forecasts=${forecasts.length})`);
      continue;
    }

    for (const bestWindow of selectedWindows) {
      // Diagnostic: capture tomorrow-flip events so we can debug cases where the
      // selector returns a next-day window even though today has viable data.
      // Expected to be quiet after the today-first no-fallback guard above.
      if (isFutureDayInTimezone(bestWindow.start, beachTz)) {
        log.info(
          `[tomorrow-flip-diag] ${beach.name}: bestWindow.start=${bestWindow.start.toISOString()} ` +
          `beachTz=${beachTz} todayStr=${todayStr} todayForecasts=${todayForecasts.length}/${forecasts.length}`
        );
      }

    // Use the exact forecast entity that the window selector scored.
    // sourceForecast carries the forecast through from window selection;
    // fuzzy-match fallback handles edge cases where it's absent.
    const selectionForecasts = forecastAt ? scopedForecasts : forecasts;
    const bestWindowForecast = bestWindow.sourceForecast
      ?? selectionForecasts.reduce((closest, f) => {
           const fTime = new Date(f.forecast_at).getTime();
           const closestTime = new Date(closest.forecast_at).getTime();
           const target = bestWindow.start.getTime();
           return Math.abs(fTime - target) < Math.abs(closestTime - target) ? f : closest;
         }, selectionForecasts[0]);

    // Strip sourceForecast to avoid bloating the API response
    const responseWindow: PersonalizedForecastWindow = { ...bestWindow };
    delete responseWindow.sourceForecast;

    // Calculate distance
    const distanceMiles = calculateDistance(userLocation, {
      lat: beach.lat || 0,
      lon: beach.lon || 0,
    });

    // Calculate personalization bonus for this beach
    const persResult = calculatePersonalizationBonus(beach, bestWindowForecast, personalizationCtx);

    // Detailed scoring
    const detailedScore = await scoreBeachForDiscovery({
      beach,
      forecast: bestWindowForecast,
      userPrefs,
      userSkillLevel,
      distanceMiles,
      affinityBonus: persResult.affinityBonus,
      personalizationBonus: persResult.personalizationBonus,
      personalizationReasons: persResult.reasons,
      dominantBoardClass,
      boardClasses,
    });

    // Apply water quality override after scoring
    const wqStatus = wqMap.get(beach.id);
    if (wqStatus === 'closure') {
      // Score to 0 and demote to 'fair' (lowest non-skip tier) so the beach
      // sorts last but still surfaces with a clear health warning.
      detailedScore.total = 0;
      // Rank it last too — zeroing only the displayed score would leave a
      // health-closed beach sorting above open ones on its ranking value.
      detailedScore.rankingTotal = 0;
      detailedScore.matchQuality = 'fair';
      detailedScore.warnings = ['Water quality closure — health advisory active'];
    } else if (wqStatus === 'advisory') {
      detailedScore.warnings.push('Water quality advisory — elevated bacteria levels');
    }

    const behaviorAggregate = aggregateBreakBehaviorSessions(
      breakBehaviorRowsByBeach.get(beach.id) ?? [],
      bestWindowForecast,
      { now }
    );
    const behaviorScore = calculateBreakBehaviorScore(behaviorAggregate);
    const behaviorApplied = applyBreakBehaviorScore(
      detailedScore.total,
      behaviorScore
    );
    if (behaviorApplied.appliedBehaviorScore > 0) {
      // Session-history boost describes the surfer, not the surf, so it moves
      // ranking only. It used to be added into the displayed total, pushing
      // already-good spots into the 100 ceiling.
      detailedScore.rankingTotal += behaviorApplied.appliedBehaviorScore;
      detailedScore.subscores.behaviorBonus = behaviorApplied.appliedBehaviorScore;
      detailedScore.reasons = [
        ...behaviorScore.reasons,
        ...detailedScore.reasons,
      ].slice(0, 5);
    }

    const distinction = computeWindowDistinctionReason(
      bestWindowForecast,
      forecasts,
      beach,
      beachTz,
      userSkillLevel,
      boardClasses,
    );
    if (distinction && !detailedScore.reasons.includes(distinction)) {
      detailedScore.reasons = [
        ...detailedScore.reasons.slice(0, 1),
        distinction,
        ...detailedScore.reasons.slice(1),
      ];
    }
    detailedScore.reasons = detailedScore.reasons.slice(0, 5);

    // Compute condition character using the new domain-engine classifier.
    // Re-runs the engine to obtain a CompositeScore (subscores Map keyed by
    // 'windQuality' / 'tideFit' on the 0-100 scale that getConditionCharacter
    // expects). Plugins are pure and the engine instance is a singleton, so
    // the duplicate score() call is microseconds — cheaper than maintaining
    // a parallel CompositeScore-bearing return type from scoreBeachForDiscovery
    // (which still hands back the lossy DetailedScore for the rest of the flow).
    let conditionCharacter: SurfDiscoveryRecommendation['character'] | undefined;
    try {
      const profile = beachToSpotProfile(beach);
      const snapshot = forecastToSnapshot(bestWindowForecast);
      const composite = getDiscoveryScoringEngine().score({
        profile,
        snapshot,
        window: null,
        preferences: null,
      });
      const character = getConditionCharacter(snapshot, profile, composite);
      conditionCharacter = {
        label: character.label,
        category: character.category,
      };
    } catch {
      // Non-fatal — character is optional
    }

    const recommendationLabel = getRecommendationLabelGated(
      detailedScore.total,
      (conditionCharacter?.category ?? null) as ConditionCharacterCategory | null,
    );
    const conditionBoardPick =
      userBoardsForPicks.length > 0
        ? getConditionBoardPick(
            toForecastForScoring(bestWindowForecast, beachTz),
            userBoardsForPicks,
            beach,
            {
              kind: 'scored',
              boardClass: scoreWindowConditionDetails(
                bestWindowForecast,
                beach,
                userSkillLevel,
                null,
                boardClasses,
              ).boardClass,
            },
          )
        : null;

    const baseRecommendation: SurfDiscoveryRecommendation = {
      kind: 'beach',
      customSpotId: null,
      visibility: null,
      isOwn: false,
      beach,
      window: responseWindow,
      forecast: bestWindowForecast,
      score: detailedScore.total,
      rankingScore: detailedScore.rankingTotal,
      matchQuality: detailedScore.matchQuality,
      character: conditionCharacter,
      // Carry the SpotProfile through so hero-ranking's setupSuitability
      // consumes the same window/exposure config the engine just used.
      spotProfile: beachToSpotProfile(beach),
      // PR 4: gate "Worth it" on character category — a high score with
      // medium-rough/medium-mixed character now caps at "Maybe" instead of
      // promoting NOW FIRING on a windy day. Falls back to score-only when
      // character is unavailable. The cast is safe because getConditionCharacter
      // produces values from the ConditionCharacterCategory union by construction.
      recommendationLabel,
      subscores: detailedScore.subscores,
      summary: generateDiscoverySummary(beach, responseWindow, detailedScore),
      message: buildDiscoveryMessage(
        detailedScore.total,
        detailedScore.reasons,
        detailedScore.warnings,
        recommendationLabel,
      ),
      reasons: detailedScore.reasons,
      warnings: detailedScore.warnings,
      effects: detailedScore.effects,
      conditionBadges: detailedScore.conditionBadges,
      waveHeightBadge: detailedScore.waveHeightBadge,
      boardPick: conditionBoardPick
        ? {
            boardName: conditionBoardPick.boardName,
            boardType: conditionBoardPick.boardType,
            reason: conditionBoardPick.reason,
          }
        : null,
      distanceMiles,
      drivingTimeMinutes: distanceMiles ? Math.round(distanceMiles * 1.5) : undefined,
      // Similarity is stamped later by applySimilarityLayer (Pro path) or
      // remains null for free users. Required field — initialize to null.
      similarity: null,
      generated_at: new Date().toISOString(),
    };
    baseRecommendation.recommendationId =
      recommendationIdFor(baseRecommendation);

    if (discoverableBeachIds.has(beach.id)) {
      scored.push(baseRecommendation);
    }

    const customCandidates = customSpotCandidatesByNearestBeachId.get(beach.id) ?? [];
    for (const customCandidate of customCandidates) {
      const customBeach = buildCustomSpotBeach(customCandidate.spot, beach);
      const customPersResult = calculatePersonalizationBonus(
        customBeach,
        bestWindowForecast,
        personalizationCtx,
      );
      const customDetailedScore = await scoreBeachForDiscovery({
        beach: customBeach,
        forecast: bestWindowForecast,
        userPrefs,
        userSkillLevel,
        distanceMiles: customCandidate.distanceMiles,
        affinityBonus: customPersResult.affinityBonus,
        personalizationBonus: customPersResult.personalizationBonus,
        personalizationReasons: customPersResult.reasons,
        dominantBoardClass,
        boardClasses,
      });

      if (wqStatus === 'closure') {
        customDetailedScore.total = 0;
        customDetailedScore.rankingTotal = 0;
        customDetailedScore.matchQuality = 'fair';
        customDetailedScore.warnings = ['Water quality closure — health advisory active'];
      } else if (wqStatus === 'advisory') {
        customDetailedScore.warnings.push('Water quality advisory — elevated bacteria levels');
      }

      const customDistinction = computeWindowDistinctionReason(
        bestWindowForecast,
        forecasts,
        customBeach,
        beachTz,
        userSkillLevel,
        boardClasses,
      );
      if (
        customDistinction &&
        !customDetailedScore.reasons.includes(customDistinction)
      ) {
        customDetailedScore.reasons = [
          ...customDetailedScore.reasons.slice(0, 1),
          customDistinction,
          ...customDetailedScore.reasons.slice(1),
        ];
      }
      customDetailedScore.reasons = customDetailedScore.reasons.slice(0, 5);

      let customConditionCharacter: SurfDiscoveryRecommendation['character'] | undefined;
      try {
        const profile = beachToSpotProfile(customBeach);
        const snapshot = forecastToSnapshot(bestWindowForecast);
        const composite = getDiscoveryScoringEngine().score({
          profile,
          snapshot,
          window: null,
          preferences: null,
        });
        const character = getConditionCharacter(snapshot, profile, composite);
        customConditionCharacter = {
          label: character.label,
          category: character.category,
        };
      } catch {
        // Non-fatal — character is optional
      }

      const customRecommendationLabel = getRecommendationLabelGated(
        customDetailedScore.total,
        (customConditionCharacter?.category ?? null) as ConditionCharacterCategory | null,
      );
      const customBoardPick =
        userBoardsForPicks.length > 0
          ? getConditionBoardPick(
              toForecastForScoring(bestWindowForecast, beachTz),
              userBoardsForPicks,
              customBeach,
              {
                kind: 'scored',
                boardClass: scoreWindowConditionDetails(
                  bestWindowForecast,
                  customBeach,
                  userSkillLevel,
                  null,
                  boardClasses,
                ).boardClass,
              },
            )
          : null;

      const customRecommendation: SurfDiscoveryRecommendation = {
        kind: 'custom_spot',
        customSpotId: customCandidate.spot.id,
        visibility: customCandidate.spot.visibility,
        isOwn: customCandidate.isOwn,
        beach: customBeach,
        window: { ...responseWindow },
        forecast: bestWindowForecast,
        score: customDetailedScore.total,
        rankingScore: customDetailedScore.rankingTotal,
        matchQuality: customDetailedScore.matchQuality,
        character: customConditionCharacter,
        spotProfile: beachToSpotProfile(customBeach),
        recommendationLabel: customRecommendationLabel,
        subscores: customDetailedScore.subscores,
        summary: generateDiscoverySummary(customBeach, responseWindow, customDetailedScore),
        message: buildDiscoveryMessage(
          customDetailedScore.total,
          customDetailedScore.reasons,
          customDetailedScore.warnings,
          customRecommendationLabel,
        ),
        reasons: customDetailedScore.reasons,
        warnings: customDetailedScore.warnings,
        conditionBadges: customDetailedScore.conditionBadges,
        waveHeightBadge: customDetailedScore.waveHeightBadge,
        boardPick: customBoardPick
          ? {
              boardName: customBoardPick.boardName,
              boardType: customBoardPick.boardType,
              reason: customBoardPick.reason,
            }
          : null,
        distanceMiles: customCandidate.distanceMiles,
        drivingTimeMinutes: customCandidate.distanceMiles
          ? Math.round(customCandidate.distanceMiles * 1.5)
          : undefined,
        similarity: null,
        generated_at: new Date().toISOString(),
      };
      customRecommendation.recommendationId =
        recommendationIdFor(customRecommendation);
      scored.push(customRecommendation);
    }

      log.info(
        `RANKING DEBUG: ${beach.name} score=${detailedScore.total} ` +
        `wave=${detailedScore.subscores.waveHeightFit} wind=${detailedScore.subscores.windAlignment} ` +
        `tide=${detailedScore.subscores.tideFit} dist=${distanceMiles?.toFixed(1)}mi ` +
        `height=${bestWindowForecast.wave_height}`
      );
    }
  }

  // Log beaches that had no window selected
  if (beachesWithNoWindow.length > 0) {
    log.warn(`[discoverSurfSpots] ${beachesWithNoWindow.length} beaches had no viable window: ${beachesWithNoWindow.join(', ')}`);
  }

  // Log all beach scores before ranking (for debugging)
  const allScoresSorted = [...scored].sort(compareDiscoveryRecommendations);
  log.debug(`[discoverSurfSpots] All ${scored.length} scored beaches (before top-N filter):`);
  allScoresSorted.forEach((rec, idx) => {
    const { waveHeightFit, periodEnergyScore, windAlignment, tideFit, distancePenalty, personalizationBonus, affinityBonus, behaviorBonus } = rec.subscores;
    log.debug(`  ${idx + 1}. ${rec.beach.name}: score=${rec.score} (wave=${waveHeightFit}, period=${periodEnergyScore}, wind=${windAlignment}, tide=${tideFit}, dist=${distancePenalty}, pers=${personalizationBonus}, affinity=${affinityBonus}, behavior=${behaviorBonus ?? 0})`);
  });

  // 4. Fetch and merge favorites
  let favoriteBeachIds = new Set<string>();
  try {
    const favoriteBeachesResponse = await getFavoriteBeachesFromDb(userId);
    if (favoriteBeachesResponse.success && favoriteBeachesResponse.data) {
      favoriteBeachIds = new Set(favoriteBeachesResponse.data.map((b: Beach) => b.id));
      log.debug(`Found ${favoriteBeachIds.size} favorite beaches for user ${userId}`);
    } else {
      log.warn(`Failed to fetch favorites: ${favoriteBeachesResponse.error || 'Unknown error'}`);
    }
  } catch (error) {
    log.error('Error fetching favorite beaches, continuing with regular recommendations:', error);
  }

  // Mark favorites with badge flag, but do NOT prioritize in ranking
  // All beaches are ranked purely by score - favorites just get a heart badge
  const allRecs: SurfDiscoveryRecommendation[] = [];

  for (const rec of scored) {
    // Null safety: skip malformed recommendations
    if (!rec?.beach?.id || typeof rec.score !== 'number') {
      log.warn('Skipping malformed recommendation in favorites loop', { rec });
      continue;
    }

    allRecs.push({
      ...rec,
      isFavorite: (rec.kind ?? 'beach') === 'beach' && favoriteBeachIds.has(rec.beach.id),
    });
  }

  // Sort ALL recommendations by score descending (pure score ranking)
  allRecs.sort(compareDiscoveryRecommendations);

  // Attach personal-match evidence for Pro/trial users before window
  // candidates collapse and the beach pool is truncated.
  //
  // - Free users: no RPC call; every rec keeps similarity:null.
  // - Pro users: one bulk RPC per beach scores up to three windows.
  //   Learned evidence selects the window within that beach; physical score
  //   remains unchanged and continues to rank beaches against one another.
  //
  // Candidate pools are typically 5-20 beaches, so one call per beach is
  // bounded while preserving the existing RPC contract.
  const similarityResult = await applySimilarityLayer({
    recommendations: allRecs,
    userId,
    isPro,
    supabase,
  });
  const allRecsScored = collapseWindowCandidates(
    similarityResult.recommendations,
  );
  const rankedRecommendations = await rankBeaches(
    allRecsScored.map((recommendation, index) => ({
      id: recommendation.beach.id,
      recommendation,
      index,
    })),
    {
      compare: (left, right) =>
        compareDiscoveryRecommendations(
          left.recommendation,
          right.recommendation,
        ) || left.index - right.index,
    },
  );
  // `rankBeaches` has already dropped any beach with a resolved water-quality
  // closure. An unreachable probe drops nothing, so the pool stays intact.
  const safeRecsScored = rankedRecommendations.map(
    ({ recommendation }) => recommendation,
  );

  // Water-quality filtering happens across the full sorted pool before this
  // top-N is consumed, so an allowed rank below a blocked result can fill the
  // response.
  const merged = safeRecsScored
    .filter((rec) => primaryEligibleKeys.has(recommendationKey(rec)))
    .slice(0, maxResults);

  // Phase 2: populate per-slot scorer outputs across each candidate's window
  // BEFORE rerank so hero-window-score's persistence/duration evidence is
  // grounded in real data (not a single representative-slot fallback).
  const scoringEngine = getDiscoveryScoringEngine();
  for (const rec of merged) {
    const allHourly = forecastsByBeachId.get(rec.beach.id) ?? [];
    rec.windowSlotScores = computeWindowSlotScores(
      rec,
      allHourly,
      scoringEngine,
      userSkillLevel,
      boardClasses,
    );
  }

  // Run rerank ALWAYS (cheap pure compute) so diagnostics are complete.
  // The flag below decides which array becomes the response; diagnostics
  // emit either way. Single source of truth: this orchestrator is the only
  // call site for `logHeroRankingDiagnostic`.
  const { reranked, diagnostics } = rerankHero(merged);
  diagnostics.forEach(logHeroRankingDiagnostic);

  // Flag-gated behavior: when off (default), return the engine-sorted slice
  // verbatim. When on, return the hero-lifted slice (only [0] moves;
  // remaining order is preserved).
  const rankedSlice = FEATURE_HERO_WINDOW_SCORE ? reranked : merged;
  const finalSlice = applyWorthTheDriveReasons(rankedSlice);
  const finalSliceKeys = new Set(finalSlice.map((rec) => recommendationKey(rec)));
  const includedSlice = safeRecsScored.filter((rec) => {
    if ((rec.kind ?? 'beach') === 'beach') {
      return (
        requestedIncludeBeachIdSet.has(rec.beach.id) &&
        !finalSliceKeys.has(`beach:${rec.beach.id}`)
      );
    }
    if (rec.kind === 'custom_spot' && rec.isOwn) {
      return !finalSliceKeys.has(`custom:${rec.customSpotId ?? rec.beach.id}`);
    }
    return false;
  });

  const favoriteCount = finalSlice.filter(r => r.isFavorite).length;
  log.debug(
    `Merged recommendations: ${favoriteCount} favorites in top ${finalSlice.length} (pure score ranking)`
  );

  // 5. Enrich with photos
  let enrichedRanked = applyWindowWaveHeightBadgesForRecommendations(
    await enrichWithPhotos(finalSlice),
    forecastsByBeachId
  );
  const enrichedIncluded = applyWindowWaveHeightBadgesForRecommendations(
    await enrichWithPhotos(includedSlice),
    forecastsByBeachId
  );

  // 6. Attach slotForecasts for Today's Windows to the top recommendation.
  // Wave-height badges for all recommendations were corrected above from
  // actual min/max within each recommendation's selected window.
  if (enrichedRanked.length > 0) {
    const topRec = enrichedRanked[0];
    const allHourly = forecastsByBeachId.get(topRec.beach.id) ?? [];

    // Compute per-slot wave heights for the same day as the top rec's window
    const SLOT_HOURS = [5, 8, 11, 14, 17];
    const slotForecasts: NonNullable<SurfDiscoveryRecommendation['slotForecasts']> = {};
    const beachTz = getTimezoneFromCoords(topRec.beach.lat || 0, topRec.beach.lon || 0);
    const windowDateStr = getLocalDateStr(topRec.window.start, beachTz);
    const sameDayForecasts = allHourly.filter((f) =>
      getLocalDateStr(new Date(f.forecast_at), beachTz) === windowDateStr
    );

    for (const slotHour of SLOT_HOURS) {
      // Collect forecasts whose local hour falls within the 3-hour slot window
      const slotHourlyForecasts = sameDayForecasts.filter((f) => {
        const localHour = getLocalHour(new Date(f.forecast_at), beachTz);
        if (localHour === null) return false;
        return localHour >= slotHour && localHour < slotHour + 3;
      });

      if (slotHourlyForecasts.length === 0) {
        continue;
      }

      const slotHeights = slotHourlyForecasts
        .map((f) => parseFloat(String(f.wave_height ?? '')))
        .filter((h) => !isNaN(h) && h > 0);

      if (slotHeights.length === 0) {
        continue;
      }

      const slotMin = Math.min(...slotHeights);
      const slotMax = Math.max(...slotHeights);

      // Single-height string for the slot (simple formatted value)
      const avgHeight = slotHeights.reduce((a, b) => a + b, 0) / slotHeights.length;
      const waveHeight = `${Math.round(avgHeight * 10) / 10} ft`;

      // Badge uses actual min/max when range is meaningful, otherwise single value
      const waveHeightBadge =
        slotMax > slotMin
          ? formatWaveHeightRangeString(slotMin, slotMax)
          : formatWaveHeightRangeString(slotMin, slotMin);

      const midIndex = Math.floor(slotHourlyForecasts.length / 2);
      const midForecast = slotHourlyForecasts[midIndex];

      slotForecasts[slotHour] = {
        waveHeight,
        waveHeightBadge,
        windSpeed: midForecast.wind_speed ?? null,
        windDirection: midForecast.wind_direction ?? null,
        tideHeight: midForecast.tide_height ?? null,
        tideStatus: midForecast.tide_status ?? null,
        // Prefer wave_period / wave_direction — already the dominant
        // partition per forecast-builder's getDominantSwellComponent. Reading
        // raw swell_1_* would mismatch the dominant-snapshot scoring on
        // mixed-swell or windswell-dominant rows ("verdict says one thing,
        // displayed swell description shows another"). swell_1_* stays as a
        // legacy fallback for rows that predate the dominant-write path.
        swellPeriod: midForecast.wave_period ?? midForecast.swell_1_period ?? null,
        swellDirection: midForecast.wave_direction ?? midForecast.swell_1_direction ?? null,
      };
    }

    if (Object.keys(slotForecasts).length > 0) {
      enrichedRanked[0] = {
        ...enrichedRanked[0],
        slotForecasts,
      };
    }
  }

  // 7. Compute sleep-in scores and assign strategy tags
  const sleepInScores = new Map<string, number>();
  if (discoveryMode !== 'now' && enrichedRanked.length > 1) {
    for (const rec of enrichedRanked.slice(1)) {
      const beachForecasts_ = forecastsByBeachId.get(rec.beach.id);
      if (!beachForecasts_) continue;

      const lateWindow = selectBestWindow({
        forecasts: beachForecasts_,
        beach: rec.beach,
        userPrefs,
        horizonHours,
        sunTimesCache,
        timeSlot: 'late-morning',
        userSkillLevel,
        boardClasses,
      });
      if (!lateWindow) continue;

      const lateForecast = lateWindow.sourceForecast
        ?? beachForecasts_.reduce((closest, f) => {
             const fTime = new Date(f.forecast_at).getTime();
             const closestTime = new Date(closest.forecast_at).getTime();
             const target = lateWindow.start.getTime();
             return Math.abs(fTime - target) < Math.abs(closestTime - target) ? f : closest;
           }, beachForecasts_[0]);

      const distMiles = rec.distanceMiles;
      const lateScore = await scoreBeachForDiscovery({
        beach: rec.beach,
        forecast: lateForecast,
        userPrefs,
        userSkillLevel,
        distanceMiles: distMiles,
        dominantBoardClass,
        boardClasses,
      });
      sleepInScores.set(rec.beach.id, lateScore.total);
    }
    // Pass an explicit `now` so time-of-day-sensitive tags (sleep_in) suppress
    // themselves once the relevant window is in the past at the candidate beach.
    assignStrategyTags(enrichedRanked, sleepInScores, new Date());
  }

  // 8. Generate regional call from hero's slot forecasts
  let regionalCall = '';
  if (enrichedRanked.length > 0) {
    const heroSlots = enrichedRanked[0].slotForecasts;
    let dawnWind: WindSnapshot | undefined;
    let middayWind: WindSnapshot | undefined;

    if (heroSlots) {
      const dawn = heroSlots[5];
      if (dawn?.windSpeed && dawn?.windDirection) {
        dawnWind = { speed: dawn.windSpeed, direction: dawn.windDirection };
      }
      const midday = heroSlots[11];
      if (midday?.windSpeed && midday?.windDirection) {
        middayWind = { speed: midday.windSpeed, direction: midday.windDirection };
      }
    }

    regionalCall = generateRegionalCall(enrichedRanked, { dawnWind, middayWind });
  }

  // 9. Build evening transition
  let eveningTransition: EveningTransition | undefined;
  if (enrichedRanked.length > 0) {
    const heroBeachId = enrichedRanked[0].beach.id;
    if (isAfterSunset(heroBeachId, now, sunTimesCache)) {
      const heroBeach = enrichedRanked[0].beach;
      const heroTz = getTimezoneFromCoords(heroBeach.lat || 0, heroBeach.lon || 0);

      // Use the hero's already-scored window if it's still today — selectBestWindow
      // rejects post-sunset windows so re-querying would always return null after sunset.
      const heroWindow = enrichedRanked[0].window;
      const heroWindowIsToday = heroWindow?.start
        ? !isFutureDayInTimezone(heroWindow.start, heroTz)
        : false;
      const remainingWindow = heroWindowIsToday ? heroWindow : null;
      const restOfToday = buildRestOfToday(remainingWindow, heroTz);

      eveningTransition = {
        active: true,
        restOfToday,
        tomorrowRegionalCall: regionalCall,
      };
    }
  }

  const recommendationV2Candidates = [
    ...enrichedRanked,
    ...enrichedIncluded,
  ].map((rec, index) =>
    toRecommendationV2Candidate(rec, index + 1, usingStaleData)
  );
  const recommendationsV2 = buildRecommendationsV2({
    candidates: recommendationV2Candidates,
    now,
  });

  const duration = Date.now() - startTime;
  log.debug(
    `Discovery complete in ${duration}ms: ${enrichedRanked.length} recommendations from ${finalCandidates.length} candidates`
  );

  return {
    recommendations: enrichedRanked,
    recommendationsV2,
    includedRecommendations: enrichedIncluded,
    searchCriteria: {
      userLocation,
      radiusMiles,
      maxResults,
    },
    metadata: {
      totalBeachesConsidered: finalCandidates.length,
      successfulForecasts: beachForecasts.length,
      partialSuccess: beachForecasts.length < finalCandidates.length,
      failedBeaches: failedForecasts.length,
      staleBeaches: staleCount,
      usingStaleData,
      generated_at: new Date().toISOString(),
    },
    regionalCall,
    eveningTransition,
    // Resolved water-quality closures were filtered out of the pool above.
    // Major-event holds are resolved at the serialization boundary
    // (`sanitizeSurfDiscoveryForSerializationMajorEventHold`), which overwrites
    // this; discovery itself never withholds the whole response.
    recommendationAvailability: {
      state: 'available',
      holdEpoch: DISCOVERY_AVAILABILITY_HOLD_EPOCH,
    },
  };
}

/**
 * Discover surf spots for a user
 *
 * Orchestrates the full discovery flow:
 * 1. Build candidate pool using GPS proximity (requires userLocation)
 * 2. Batch fetch forecasts for all candidates
 * 3. Select best window for each beach
 * 4. Score and rank recommendations
 * 5. Enrich with photos and format response
 *
 * Returns ranked list of surf recommendations based on GPS proximity and condition scoring.
 * Each recommendation includes detailed scoring breakdown and match quality.
 * Favorites are marked with isFavorite flag but do not receive preferential ordering.
 *
 * @param userId - User ID
 * @param options - Discovery options (userLocation required for results)
 * @returns Surf discovery response with ranked recommendations
 *
 * @example
 * const discovery = await discoverSurfSpots('user-123', {
 *   userLocation: { lat: 32.7157, lon: -117.1611 },
 *   maxResults: 5
 * });
 * for (const rec of discovery.recommendations) {
 *   log.debug(`${rec.beach.name}: ${rec.score} (${rec.matchQuality})`);
 *   log.debug(rec.reasons.join(', '));
 * }
 */
export async function discoverSurfSpots(
  userId: string,
  options: SurfDiscoveryOptions = {}
): Promise<SurfDiscoveryResponse> {
  const startTime = Date.now();

  const {
    userLocation,
    maxResults = DEFAULT_MAX_RESULTS,
    overallTimeout = DEFAULT_OVERALL_TIMEOUT_MS,
    throwOnFailure = false,
  } = options;

  try {
    // GPS location is required for discovery
    if (!userLocation) {
      log.warn(`Discovery called without userLocation for user ${userId}`);
      return emptyResponse(maxResults, 'no_candidates');
    }

    // Enforce overall timeout with Promise.race
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Discovery timeout after ${overallTimeout}ms`)),
        overallTimeout
      );
    });

    try {
      const result = await Promise.race([
        discoverSurfSpotsInner(userId, userLocation, options, startTime),
        timeoutPromise,
      ]);
      return result;
    } finally {
      clearTimeout(timeoutId!);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(`Discovery failed after ${duration}ms for user ${userId}:`, error);
    if (throwOnFailure) {
      if (error instanceof SurfDiscoveryOperationalError) {
        throw error;
      }
      const isTimeout =
        error instanceof Error && error.message.startsWith('Discovery timeout');
      throw new SurfDiscoveryOperationalError(
        isTimeout ? 'timeout' : 'internal_error',
        isTimeout ? 'Surf discovery timed out' : 'Surf discovery failed',
        { cause: error },
      );
    }
    return emptyResponse(maxResults, 'no_candidates');
  }
}
