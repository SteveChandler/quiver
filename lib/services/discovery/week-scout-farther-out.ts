import 'server-only';

import { performance } from 'node:perf_hooks';
import { MILES_PER_DRIVE_MINUTE } from '@/lib/profile/drive-range';
import { recordStage, runWithStageTimings } from '@/lib/observability/request-timing';
import { bearingDegreesFromTo } from '@/lib/utils/distance-utils';
import { createContextLogger } from '@/lib/logger';
import {
  generateWeekScoutForecastForDays,
  type CanonicalWeekScoutResponse,
  type WeekScoutFartherOut,
  type WeekScoutPersonalLabel,
  type WeekScoutRequest,
} from './week-scout';
import { buildDriveRangeCandidatePool } from './weekend-scout-candidate-pool';

const log = createContextLogger('WeekScoutFartherOut');

export const FARTHER_OUT_MAX_DRIVE_MINUTES = 45;
export const FARTHER_OUT_MAX_MILES = FARTHER_OUT_MAX_DRIVE_MINUTES * MILES_PER_DRIVE_MINUTE;
/** Nearest outer-ring beaches ranked (skill-first, as the in-range cap); bounds the extra ranking CPU. */
export const FARTHER_OUT_POOL_CAP = 20;
/** Early-look days (7+) get no row, so the outer pass ranks only the headline week. */
const FARTHER_OUT_DAY_COUNT = 7;
const LABEL_RANK: Record<WeekScoutPersonalLabel, number> = { MEH: 0, RIDEABLE: 1, FAIR: 2, GOOD: 3, EPIC: 4 };
const DIRECTIONS = ['north', 'east', 'south', 'west'] as const;

interface Coordinates {
  lat: number;
  lon: number;
}

export interface FartherOutCandidate {
  beach: { id: string; name: string; lat: number; lon: number };
  distanceMiles: number | null;
}

type FartherOutDays = Map<string, WeekScoutFartherOut>;
type DaysSource = Pick<CanonicalWeekScoutResponse, 'days' | 'recommendationAvailability'>;

/** Default on; `WEEK_SCOUT_FARTHER_OUT=false` turns the outer pass off. */
export function isWeekScoutFartherOutEnabled(): boolean {
  return process.env.WEEK_SCOUT_FARTHER_OUT !== 'false';
}

export async function loadFartherOutPool(
  userId: string,
  options: {
    anchor: Coordinates;
    homeBeachId: string | null;
    innerRadiusMiles: number;
    experienceLevel: unknown;
    filters?: Parameters<typeof buildDriveRangeCandidatePool>[1]['filters'];
  },
): Promise<FartherOutCandidate[]> {
  const pool = await buildDriveRangeCandidatePool(userId, {
    anchor: options.anchor,
    homeBeachId: options.homeBeachId,
    maxDriveMinutes: FARTHER_OUT_MAX_DRIVE_MINUTES,
    experienceLevel: options.experienceLevel,
    filters: options.filters,
    widenEmptyRange: false,
    beyondMiles: options.innerRadiusMiles,
    nearbyCap: FARTHER_OUT_POOL_CAP,
  });
  return pool.candidates;
}

/**
 * Ranks the outer ring with the in-range code path (same holds, personal call
 * and session-time day best) and returns the days that earn a row.
 */
export async function rankFartherOut(
  userId: string,
  args: {
    pool: readonly FartherOutCandidate[];
    inRangeIds: readonly string[];
    innerRadiusMiles: number;
    anchor: Coordinates;
    request: Omit<WeekScoutRequest, 'candidateBeachIds' | 'includeSwells'>;
    inRange: Promise<DaysSource>;
  },
): Promise<FartherOutDays> {
  const inRangeIds = new Set(args.inRangeIds);
  const outer = args.pool.filter(({ beach, distanceMiles }) => (
    !inRangeIds.has(beach.id)
    && distanceMiles !== null
    && distanceMiles > args.innerRadiusMiles
    && distanceMiles <= FARTHER_OUT_MAX_MILES
  ));
  if (outer.length === 0) return new Map();
  const startedAt = performance.now();
  // Its own stage list, so the timing line shows one farther-out stage, not a second set of ws-* stages.
  const { result } = runWithStageTimings(() => generateWeekScoutForecastForDays(userId, {
    ...args.request,
    dayCount: Math.min(args.request.dayCount, FARTHER_OUT_DAY_COUNT),
    candidateBeachIds: outer.map(({ beach }) => beach.id),
  }));
  const outerResponse = await result.finally(() => recordStage('farther-out', performance.now() - startedAt));
  // A failed main answer fails the request on its own path; it is not an outer-pass failure.
  const inRange = await args.inRange.catch(() => null);
  return inRange ? selectFartherOut(inRange, outerResponse, outer, args.anchor) : new Map();
}

export function selectFartherOut(
  inRange: DaysSource,
  outer: DaysSource,
  outerPool: readonly FartherOutCandidate[],
  anchor: Coordinates,
): FartherOutDays {
  const selected: FartherOutDays = new Map();
  if (inRange.recommendationAvailability.state !== 'available') return selected;
  if (outer.recommendationAvailability.state !== 'available') return selected;
  const poolById = new Map(outerPool.map((candidate) => [candidate.beach.id, candidate]));
  const outerByDate = new Map(outer.days.map((day) => [day.localDate, day]));
  for (const day of inRange.days) {
    const inRangeLabel = day.bestDayWindow?.personalLabel;
    if (day.earlyLook || !inRangeLabel) continue;
    const best = outerByDate.get(day.localDate)?.bestDayWindow;
    if (!best?.personalLabel || best.personalVerdict === 'no') continue;
    if (best.verdict === null || best.verdict === 'skip' || best.safe !== true || best.rideable !== true) continue;
    if (LABEL_RANK[best.personalLabel] - LABEL_RANK[inRangeLabel] < 1) continue;
    const candidate = poolById.get(best.beachId);
    if (!candidate || candidate.distanceMiles === null) continue;
    selected.set(day.localDate, {
      beachId: best.beachId,
      beachName: candidate.beach.name,
      waveHeight: best.forecast.waveHeight,
      personalLabel: best.personalLabel,
      displayWindowStart: best.displayWindowStart,
      displayWindowEnd: best.displayWindowEnd,
      driveMinutes: Math.round(candidate.distanceMiles / MILES_PER_DRIVE_MINUTE / 5) * 5,
      direction: DIRECTIONS[Math.round(bearingDegreesFromTo(anchor, candidate.beach) / 90) % 4],
    });
  }
  return selected;
}

/** Never rejects: any outer-pass failure means no row, never a changed or failed response. */
export function settleFartherOut(pending: Promise<FartherOutDays>): Promise<FartherOutDays | null> {
  return pending.catch((error: unknown) => {
    log.warn('Week Scout farther-out pass failed; omitting fartherOut', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
}
