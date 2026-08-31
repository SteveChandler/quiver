import 'server-only';

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  buildWeekendScoutCandidatePool,
  type WeekendScoutCandidate,
  type WeekendScoutCandidatePool,
} from '@/lib/services/discovery/weekend-scout-candidate-pool';
import {
  parseWeekendScoutRanking,
  WEEKEND_SCOUT_CONTRACT_VERSION,
  type WeekendScoutRankingV1,
  type WeekendScoutResultV1,
} from '@/lib/services/discovery/weekend-scout-contract';
import { calculateDistancePenalty } from '@/lib/services/discovery/distance-friction';
import {
  generateWeekScoutRankingForDays,
  type WeekScoutDaysRequest,
  type WeekScoutWindowResponse,
} from '@/lib/services/discovery/week-scout';
import type {
  MajorEventHoldWeekScoutResponse,
  MajorEventHoldWeekScoutWindow,
} from '@/lib/recommendations/major-event-hold/adapters/week-scout';

export const LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOCATION_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_DRIVE_MINUTES = 200;
const MIN_CONFIGURED_DRIVE_MINUTES = 15;
const MAX_CONFIGURED_DRIVE_MINUTES = 90;
const MILES_PER_DRIVE_MINUTE = 0.5;

export interface WeekendScoutLocation {
  lat: number;
  lon: number;
  timezone: string;
  capturedAt: string;
}

export interface WeekendScoutUserContext {
  maxDriveMinutes: number | null;
  homeBeachId: string | null;
  savedBeachIds: Set<string>;
}

export interface WeekendScoutDependencies {
  now: Date;
  fetchLocation: (userId: string) => Promise<WeekendScoutLocation | null>;
  fetchUserContext: (userId: string) => Promise<WeekendScoutUserContext>;
  buildCandidatePool: (
    userId: string,
    options: { userLocation: { lat: number; lon: number }; radiusMiles: number },
  ) => Promise<WeekendScoutCandidatePool>;
  generateForecast: (
    userId: string,
    request: WeekScoutDaysRequest,
  ) => Promise<MajorEventHoldWeekScoutResponse>;
}

export type WeekendScoutBuildResult =
  | { status: 'ready'; ranking: WeekendScoutRankingV1; maxDriveMinutes: number }
  | {
      status:
        | 'missing_location'
        | 'stale_location'
        | 'candidate_limit_reached'
        | 'no_candidates'
        | 'no_qualifying_windows';
    };

interface RankedWindow {
  candidate: WeekendScoutCandidate;
  window: RankableWeekScoutWindow;
  adjustedScore: number;
}

type RankableWeekScoutWindow = MajorEventHoldWeekScoutWindow & {
  conditionScore: number;
  rankingScore: number;
  verdict: 'worth_it';
  rideable: true;
  safe: true;
};

function defaultDependencies(now: Date): WeekendScoutDependencies {
  const supabase = createSupabaseServiceRoleClient();

  return {
    now,
    fetchLocation: async (userId) => {
      const { data, error } = await (supabase as any)
        .from('user_location_snapshots')
        .select('lat, lon, timezone, captured_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load Weekend Scout location: ${error.message}`);
      if (!data) return null;
      return {
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone,
        capturedAt: data.captured_at,
      };
    },
    fetchUserContext: async (userId) => {
      const [profileResult, favoritesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('max_drive_minutes, home_beach_id')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('favorite_beaches')
          .select('beach_id')
          .eq('user_id', userId),
      ]);
      if (profileResult.error) {
        throw new Error(`Failed to load Weekend Scout profile: ${profileResult.error.message}`);
      }
      if (favoritesResult.error) {
        throw new Error(`Failed to load Weekend Scout favorites: ${favoritesResult.error.message}`);
      }
      return {
        maxDriveMinutes: profileResult.data?.max_drive_minutes ?? null,
        homeBeachId: profileResult.data?.home_beach_id ?? null,
        savedBeachIds: new Set(
          (favoritesResult.data ?? [])
            .map((row) => row.beach_id)
            .filter((beachId): beachId is string => beachId !== null),
        ),
      };
    },
    buildCandidatePool: (userId, options) => buildWeekendScoutCandidatePool(userId, options),
    generateForecast: (userId, request) => generateWeekScoutRankingForDays(userId, request),
  };
}

function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes): string => (
    parts.find((part) => part.type === type)?.value ?? ''
  );
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function resolveMaxDriveMinutes(configuredMinutes: number | null): number {
  if (configuredMinutes === null || !Number.isFinite(configuredMinutes)) {
    return DEFAULT_MAX_DRIVE_MINUTES;
  }
  return Math.min(
    MAX_CONFIGURED_DRIVE_MINUTES,
    Math.max(MIN_CONFIGURED_DRIVE_MINUTES, Math.round(configuredMinutes)),
  );
}

function weekendDates(now: Date, timezone: string): { start: string; end: string } {
  const today = localDate(now, timezone);
  const date = new Date(`${today}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const daysToSaturday = day === 0 ? -1 : (6 - day + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysToSaturday);
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 1);
  return { start, end: date.toISOString().slice(0, 10) };
}

function localWindowLabel(window: WeekScoutWindowResponse, timezone: string): string {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(new Date(window.peakTime));
  return `${weekday} ${window.bucket}`;
}

function sourceLabels(
  beachId: string,
  context: WeekendScoutUserContext,
): WeekendScoutResultV1['sourceLabels'] {
  const labels: WeekendScoutResultV1['sourceLabels'] = ['nearby'];
  if (context.homeBeachId === beachId) labels.push('home');
  if (context.savedBeachIds.has(beachId)) labels.push('saved');
  return labels;
}

function rankedWindows(
  candidates: WeekendScoutCandidate[],
  forecast: MajorEventHoldWeekScoutResponse,
): RankedWindow[] {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.beach.id, candidate]));
  const bestByBeach = new Map<string, RankedWindow>();

  for (const window of forecast.days.flatMap((day) => day.windows)) {
    if (
      window.safe !== true
      || window.rideable !== true
      || window.verdict !== 'worth_it'
      || window.rankingScore === null
      || window.conditionScore === null
    ) {
      continue;
    }
    const rankableWindow = window as RankableWeekScoutWindow;
    const candidate = candidatesById.get(window.beachId);
    if (!candidate) continue;
    const adjustedScore = Math.max(
      0,
      Math.min(
        100,
        rankableWindow.rankingScore + calculateDistancePenalty(candidate.distanceMiles),
      ),
    );
    const ranked = { candidate, window: rankableWindow, adjustedScore };
    const current = bestByBeach.get(window.beachId);
    if (
      !current
      || ranked.adjustedScore > current.adjustedScore
      || (
        ranked.adjustedScore === current.adjustedScore
        && ranked.window.start < current.window.start
      )
    ) {
      bestByBeach.set(window.beachId, ranked);
    }
  }

  return [...bestByBeach.values()].sort((left, right) => (
    right.adjustedScore - left.adjustedScore
    || left.candidate.distanceMiles - right.candidate.distanceMiles
    || left.candidate.beach.id.localeCompare(right.candidate.beach.id)
  ));
}

export async function buildWeekendScoutRanking(
  userId: string,
  dependencies?: WeekendScoutDependencies,
): Promise<WeekendScoutBuildResult> {
  const deps = dependencies ?? defaultDependencies(new Date());
  const location = await deps.fetchLocation(userId);
  if (!location) return { status: 'missing_location' };

  const capturedAt = new Date(location.capturedAt).getTime();
  if (
    !Number.isFinite(capturedAt)
    || capturedAt > deps.now.getTime() + LOCATION_MAX_FUTURE_SKEW_MS
    || deps.now.getTime() - capturedAt > LOCATION_MAX_AGE_MS
  ) {
    return { status: 'stale_location' };
  }

  const context = await deps.fetchUserContext(userId);
  const maxDriveMinutes = resolveMaxDriveMinutes(context.maxDriveMinutes);
  const pool = await deps.buildCandidatePool(userId, {
    userLocation: { lat: location.lat, lon: location.lon },
    radiusMiles: maxDriveMinutes * MILES_PER_DRIVE_MINUTE,
  });
  if (pool.wasTruncated) return { status: 'candidate_limit_reached' };
  if (pool.candidates.length === 0) return { status: 'no_candidates' };

  const weekend = weekendDates(deps.now, location.timezone);
  const forecast = await deps.generateForecast(userId, {
    candidateBeachIds: pool.candidates.map((candidate) => candidate.beach.id),
    localTimezone: location.timezone,
    startLocalDate: weekend.start,
    dayCount: 2,
  });
  const qualified = rankedWindows(pool.candidates, forecast).slice(0, 3);
  if (qualified.length === 0) return { status: 'no_qualifying_windows' };

  const ranking = parseWeekendScoutRanking({
    contractVersion: WEEKEND_SCOUT_CONTRACT_VERSION,
    weekendStart: weekend.start,
    weekendEnd: weekend.end,
    generatedAt: forecast.generatedAt,
    locationCapturedAt: location.capturedAt,
    timezone: location.timezone,
    qualifyingCount: qualified.length,
    scorerVersion: forecast.scorerVersion,
    results: qualified.map(({ candidate, window, adjustedScore }, index) => ({
      rank: index + 1,
      beachId: candidate.beach.id,
      beachName: candidate.beach.name,
      beachSlug: candidate.beach.slug ?? null,
      distanceMiles: candidate.distanceMiles,
      sourceLabels: sourceLabels(candidate.beach.id, context),
      bestWindow: {
        start: window.start,
        end: window.end,
        peakTime: window.peakTime,
        localLabel: localWindowLabel(window, location.timezone),
        waveHeight: window.forecast.waveHeight,
        period: window.forecast.period,
        windSpeed: window.forecast.windSpeed,
        windDirection: window.forecast.windDirection,
        tideHeightFt: window.forecast.tideHeightFt,
        tidePhase: window.forecast.tidePhase,
        confidence: window.confidence,
        freshnessAt: window.forecast.freshnessAt,
      },
      conditionScore: window.conditionScore,
      rankingScore: adjustedScore,
      takeaway: window.takeaway ?? `${candidate.beach.name} has the best nearby window.`,
    })),
  });

  return { status: 'ready', ranking, maxDriveMinutes };
}
