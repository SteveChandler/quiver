import {
  getBoardPowerBias,
  type BoardClass,
} from '@/lib/domains/rideability';

export interface BoardStyleFitResult {
  points: number;
  reason?: string;
  warning?: string;
}

const ALIGNED_MAX_DELTA = 0.35;
const OPPOSITE_MIN_DELTA = 1.1;

export function boardStyleFit(
  wavePunchiness: number | null,
  boardClass: BoardClass | null
): BoardStyleFitResult {
  if (boardClass === null || wavePunchiness === null || !Number.isFinite(wavePunchiness)) {
    return { points: 0 };
  }

  const spotPunchiness = clampToUnit(wavePunchiness);
  const boardPowerBias = clampToUnit(getBoardPowerBias(boardClass));
  const delta = Math.abs(spotPunchiness - boardPowerBias);

  if (delta <= ALIGNED_MAX_DELTA) {
    return {
      points: 5,
      reason: `Classic ${boardClass} wave`,
    };
  }

  if (delta >= OPPOSITE_MIN_DELTA) {
    return {
      points: -10,
      warning:
        spotPunchiness > boardPowerBias
          ? `Punchy, steep wave - rough on ${roughOnBoardLabel(boardClass)}`
          : `Soft, rolling wave - not much push for ${boardArticle(boardClass)}`,
    };
  }

  return { points: 0 };
}

function clampToUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function boardArticle(boardClass: BoardClass): string {
  return boardClass === 'sup' ? 'a SUP' : `a ${boardClass}`;
}

function roughOnBoardLabel(boardClass: BoardClass): string {
  return boardClass === 'longboard' ? 'a log' : boardArticle(boardClass);
}
