/**
 * Condition-based board pick
 *
 * Matches forecast conditions to the best board from a user's quiver
 * using condition range → board type heuristics. Returns the first board
 * in the user's quiver that matches the preferred type for the conditions.
 *
 * This is a pure function — no async, no DB access.
 */

import type { ForecastForScoring, BeachWithThresholds } from './types';
import { angleDifference } from '@/lib/domains/shared';
import { normalizeBoardClass, type BoardClass } from '@/lib/domains/rideability';

// Threshold for "onshore" wind detection (degrees from onshore direction)
const ONSHORE_TOLERANCE_DEG = 60;
// Default offshore direction used if beach not provided
const DEFAULT_OFFSHORE_DEG = 90;
// Wind speed above which conditions are considered choppy (onshore)
const CHOPPY_WIND_SPEED_MPH = 10;
const POWER_DAY_MIN_HEIGHT_FT = 3;
const POWER_DAY_CHURCH_STRICT_HEIGHT_FT = 4;
const POWER_DAY_MIN_PERIOD_S = 15;
const POWER_DAY_MIN_DIRECTION_DEG = 175;
const POWER_DAY_MAX_DIRECTION_DEG = 220;

const ALWAYS_BLOCKED_POWER_DAY_TYPES = new Set([
  'softboard',
  'foil',
  'sup',
  'groveler',
  'small-wave',
  'small_wave',
  'foamie-first',
  'foamie_first',
  'mellow',
]);

const LOWERS_EXTRA_BLOCKED_TYPES = new Set(['longboard', 'funboard']);
const CHURCH_STRICT_EXTRA_BLOCKED_TYPES = new Set(['longboard', 'funboard']);

export interface BoardForPick {
  id: string;
  name: string;
  board_type: string;
  volume?: number | null;
}

export interface BoardPickResult {
  boardId: string;
  boardName: string;
  boardType: string;
  /** Natural language reason for the recommendation */
  reason: string;
}

export type BoardPickContext =
  | { kind: 'heuristic' }
  | { kind: 'scored'; boardClass: BoardClass | null };

/**
 * Determine whether conditions are "choppy" (onshore wind above threshold)
 * or "clean" (offshore/cross-shore or light wind).
 */
function isChoppy(
  forecast: ForecastForScoring,
  beach?: BeachWithThresholds
): boolean {
  if (forecast.windSpeed <= 5) return false; // Light wind is always clean
  if (forecast.windDirection == null) return false; // Unknown direction — assume clean

  const offshoreDir = beach?.wind_offshore_deg ?? DEFAULT_OFFSHORE_DEG;
  const onshoreDir = (offshoreDir + 180) % 360;

  const isOnshore = angleDifference(forecast.windDirection, onshoreDir) <= ONSHORE_TOLERANCE_DEG;
  return isOnshore && forecast.windSpeed >= CHOPPY_WIND_SPEED_MPH;
}

/**
 * Board type priority lists for each condition tier.
 * Priority order: first match in user's quiver wins.
 *
 * Tiers:
 *  flat      : < 1ft, clean   → foil > longboard > sup > mid-length > funboard
 *  tiny-clean: 1-2ft, clean   → longboard > mid-length > funboard > fish > foil
 *  tiny-chop : 1-2ft, choppy  → longboard > funboard > softboard > mid-length
 *  small-clean: 2-3ft, clean  → mid-length > fish > longboard > shortboard
 *  small-chop : 2-3ft, choppy → fish > funboard > mid-length > shortboard
 *  medium    : 3-5ft, clean   → shortboard > fish > step-up > mid-length
 *  large     : 5ft+           → shortboard > step-up > gun
 */
type ConditionTier =
  | 'flat'
  | 'tiny-clean'
  | 'tiny-chop'
  | 'small-clean'
  | 'small-chop'
  | 'medium'
  | 'large';

const BOARD_PRIORITY: Record<ConditionTier, string[]> = {
  'flat':        ['foil', 'longboard', 'sup', 'mid-length', 'funboard'],
  'tiny-clean':  ['longboard', 'mid-length', 'funboard', 'fish', 'foil'],
  'tiny-chop':   ['longboard', 'funboard', 'softboard', 'mid-length'],
  'small-clean': ['mid-length', 'fish', 'longboard', 'shortboard'],
  'small-chop':  ['fish', 'funboard', 'mid-length', 'shortboard'],
  'medium':      ['shortboard', 'fish', 'step-up', 'mid-length'],
  'large':       ['shortboard', 'step-up', 'gun'],
};

/**
 * Reason templates for board picks.
 */
function buildReason(boardName: string, tier: ConditionTier): string {
  switch (tier) {
    case 'flat':
      return `${boardName} is the move on these ultra-small days`;
    case 'tiny-clean':
      return `${boardName} will love these small clean waves`;
    case 'tiny-chop':
      return `${boardName} is the most forgiving in these choppy small conditions`;
    case 'small-clean':
      return `Perfect size for ${boardName} — enjoy the clean faces`;
    case 'small-chop':
      return `${boardName} will handle the chop better than a high-perf board`;
    case 'medium':
      return `${boardName} conditions — enjoy the fun waves`;
    case 'large':
      return `${boardName} for these solid waves`;
  }
}

/**
 * Determine the condition tier for a forecast.
 */
function getConditionTier(
  forecast: ForecastForScoring,
  beach?: BeachWithThresholds
): ConditionTier {
  const { waveHeight } = forecast;
  const choppy = isChoppy(forecast, beach);

  if (waveHeight < 1) return 'flat';
  if (waveHeight < 2) return choppy ? 'tiny-chop' : 'tiny-clean';
  if (waveHeight < 3) return choppy ? 'small-chop' : 'small-clean';
  if (waveHeight < 5) return 'medium';
  return 'large';
}

/**
 * Find the first board from the user's quiver that matches a type in the priority list.
 */
function findBoardForTier(
  boards: BoardForPick[],
  priorityList: string[]
): BoardForPick | null {
  for (const preferredType of priorityList) {
    const match = boards.find(
      b => b.board_type.toLowerCase() === preferredType.toLowerCase()
    );
    if (match) return match;
  }
  return null;
}

function isConfirmedSouthOcPowerDay(
  forecast: ForecastForScoring,
  beach?: BeachWithThresholds
): boolean {
  const slug = beach?.slug;
  if (slug !== 'lower-trestles' && slug !== 'church') return false;
  if (forecast.waveHeight < POWER_DAY_MIN_HEIGHT_FT) return false;
  const confirmedPeriodS =
    forecast.southOcSanoGuardrail?.confirmedPeriodS ?? forecast.wavePeriod;
  const confirmedDirectionDeg =
    forecast.southOcSanoGuardrail?.confirmedDirectionDeg ?? forecast.swellDirection;

  if (confirmedPeriodS < POWER_DAY_MIN_PERIOD_S) return false;
  if (confirmedDirectionDeg == null) return false;
  return (
    confirmedDirectionDeg >= POWER_DAY_MIN_DIRECTION_DEG &&
    confirmedDirectionDeg <= POWER_DAY_MAX_DIRECTION_DEG
  );
}

function isBlockedPowerDayBoard(
  board: BoardForPick,
  forecast: ForecastForScoring,
  beach?: BeachWithThresholds
): boolean {
  if (!isConfirmedSouthOcPowerDay(forecast, beach)) return false;

  const boardType = board.board_type.toLowerCase();
  if (ALWAYS_BLOCKED_POWER_DAY_TYPES.has(boardType)) return true;

  if (beach?.slug === 'lower-trestles') {
    return LOWERS_EXTRA_BLOCKED_TYPES.has(boardType);
  }

  if (beach?.slug === 'church' && forecast.waveHeight >= POWER_DAY_CHURCH_STRICT_HEIGHT_FT) {
    return CHURCH_STRICT_EXTRA_BLOCKED_TYPES.has(boardType);
  }

  return false;
}

/**
 * Picks the best board from a user's quiver for the given forecast conditions.
 *
 * Uses condition range → board type heuristics when no board-aware score is
 * available. A scored class is returned when its board is available, keeping
 * the displayed board tied to the board that produced the score. If scoring
 * chose no class, or no owned board matches the class, the heuristic remains a
 * useful fallback. A scored board that is excluded by a safety guard returns
 * null rather than displaying a different, unscored board.
 *
 * @param forecast - The forecast conditions
 * @param boards - The user's boards
 * @param beach - Optional beach config (used for wind direction context)
 * @param context - Whether scoring selected a class or the heuristic should be used
 * @returns BoardPickResult or null if quiver is empty or the scored board is blocked
 */
export function getConditionBoardPick(
  forecast: ForecastForScoring,
  boards: BoardForPick[],
  beach?: BeachWithThresholds,
  context: BoardPickContext = { kind: 'heuristic' },
): BoardPickResult | null {
  if (boards.length === 0) return null;

  const candidateBoards = isConfirmedSouthOcPowerDay(forecast, beach)
    ? boards.filter((board) => !isBlockedPowerDayBoard(board, forecast, beach))
    : boards;

  if (candidateBoards.length === 0) return null;

  if (context.kind === 'scored' && context.boardClass) {
    const winningBoard = candidateBoards.find(
      (board) => normalizeBoardClass(board.board_type) === context.boardClass
    );
    if (winningBoard) {
      return {
        boardId: winningBoard.id,
        boardName: winningBoard.name,
        boardType: winningBoard.board_type,
        reason: buildReason(winningBoard.name, getConditionTier(forecast, beach)),
      };
    }

    // A matching board may have been removed by a power-day safety guard. Do
    // not display a substitute whose class did not produce the score.
    const scoredBoardIsBlocked = boards.some(
      (board) => normalizeBoardClass(board.board_type) === context.boardClass
    );
    if (scoredBoardIsBlocked) return null;
  }

  // Single-board quiver — always return it
  if (candidateBoards.length === 1) {
    const board = candidateBoards[0];
    const tier = getConditionTier(forecast, beach);
    return {
      boardId: board.id,
      boardName: board.name,
      boardType: board.board_type,
      reason: buildReason(board.name, tier),
    };
  }

  const tier = getConditionTier(forecast, beach);
  const priorityList = BOARD_PRIORITY[tier];

  const picked = findBoardForTier(candidateBoards, priorityList);

  if (!picked) {
    // None of the priority types match — fall back to first board in quiver
    const fallback = candidateBoards[0];
    return {
      boardId: fallback.id,
      boardName: fallback.name,
      boardType: fallback.board_type,
      reason: buildReason(fallback.name, tier),
    };
  }

  return {
    boardId: picked.id,
    boardName: picked.name,
    boardType: picked.board_type,
    reason: buildReason(picked.name, tier),
  };
}
