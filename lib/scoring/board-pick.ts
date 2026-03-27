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
import { angleDifference } from './surf-conditions-scorer';

// Threshold for "onshore" wind detection (degrees from onshore direction)
const ONSHORE_TOLERANCE_DEG = 60;
// Default offshore direction used if beach not provided
const DEFAULT_OFFSHORE_DEG = 90;
// Wind speed above which conditions are considered choppy (onshore)
const CHOPPY_WIND_SPEED_MPH = 10;

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

/**
 * Picks the best board from a user's quiver for the given forecast conditions.
 *
 * Uses condition range → board type heuristics (priority-ordered). Returns the
 * first board in the user's quiver that matches the preferred type. If the user
 * has only one board, it is always returned (the scorer handles whether to surf,
 * not the board pick). Returns null if the quiver is empty.
 *
 * @param forecast - The forecast conditions
 * @param boards - The user's boards
 * @param beach - Optional beach config (used for wind direction context)
 * @returns BoardPickResult or null if quiver is empty
 */
export function getConditionBoardPick(
  forecast: ForecastForScoring,
  boards: BoardForPick[],
  beach?: BeachWithThresholds
): BoardPickResult | null {
  if (boards.length === 0) return null;

  // Single-board quiver — always return it
  if (boards.length === 1) {
    const board = boards[0];
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

  const picked = findBoardForTier(boards, priorityList);

  if (!picked) {
    // None of the priority types match — fall back to first board in quiver
    const fallback = boards[0];
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
