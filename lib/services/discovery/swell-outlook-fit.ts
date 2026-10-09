import { getRideabilityBand, type BoardClass } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences';

import type { SwellFit } from './swell-outlook-types';

interface Range {
  readonly min: number;
  readonly max: number;
}

function contains(range: Range, value: number): boolean {
  return value >= range.min && value <= range.max;
}

export function swellFitFor(args: {
  faceHeightFt: number | null;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
}): SwellFit {
  const { faceHeightFt, skillLevel } = args;
  if (faceHeightFt === null || !Number.isFinite(faceHeightFt) || skillLevel === null) {
    return { status: 'unknown', boards: [] };
  }
  const boards = [...new Set(args.boardClasses)];
  const bands = boards.length === 0
    ? [{ board: null, band: getRideabilityBand(skillLevel, null) }]
    : boards.map((board) => ({ board, band: getRideabilityBand(skillLevel, board) }));

  const ideal = bands.filter(({ band }) => contains(band.ideal, faceHeightFt));
  if (ideal.length > 0) {
    return { status: 'in_range', boards: ideal.flatMap(({ board }) => (board ? [board] : [])) };
  }
  if (bands.some(({ band }) => contains(band.acceptable, faceHeightFt))) {
    return { status: 'rideable', boards: [] };
  }

  // Outside every acceptable band: the nearest edge decides, above wins a tie (prefer the safer upper-size warning).
  let nearest = { distance: Number.POSITIVE_INFINITY, status: 'above_range' as 'above_range' | 'below_range' };
  for (const { band } of bands) {
    const candidate = faceHeightFt > band.acceptable.max
      ? { distance: faceHeightFt - band.acceptable.max, status: 'above_range' as const }
      : { distance: band.acceptable.min - faceHeightFt, status: 'below_range' as const };
    if (candidate.distance < nearest.distance
      || (candidate.distance === nearest.distance && candidate.status === 'above_range')) {
      nearest = candidate;
    }
  }
  return { status: nearest.status, boards: [] };
}
