import {
  SKILL_WAVE_RANGES,
  type SkillLevel,
} from '@/lib/domains/user-preferences/skill-level';
import type { BoardClass } from './board-class';

export interface RideabilityBand {
  readonly ideal: { readonly min: number; readonly max: number };
  readonly acceptable: { readonly min: number; readonly max: number };
  /** true when clean/glassy conditions matter more than size */
  readonly prefersClean: boolean;
  /** -1..+1: negative favors small/soft surf, positive favors power */
  readonly powerBias: number;
}

interface BoardShape {
  readonly lo: number;
  readonly hi: number;
  readonly prefersClean: boolean;
  readonly powerBias: number;
}

const BOARD_SHAPE: Readonly<Record<BoardClass, BoardShape>> = {
  foamie: { lo: 0.5, hi: 0.6, prefersClean: true, powerBias: -0.9 },
  longboard: { lo: 0.5, hi: 0.7, prefersClean: true, powerBias: -0.7 },
  'mid-length': { lo: 0.7, hi: 0.85, prefersClean: true, powerBias: -0.3 },
  funboard: { lo: 0.6, hi: 0.8, prefersClean: true, powerBias: -0.5 },
  fish: { lo: 0.85, hi: 0.95, prefersClean: false, powerBias: 0 },
  shortboard: { lo: 1.15, hi: 1.05, prefersClean: false, powerBias: 0.6 },
  'step-up': { lo: 1.4, hi: 1.15, prefersClean: false, powerBias: 0.9 },
  gun: { lo: 1.6, hi: 1.2, prefersClean: false, powerBias: 1 },
  sup: { lo: 0.4, hi: 0.6, prefersClean: true, powerBias: -0.9 },
  foil: { lo: 0.2, hi: 0.5, prefersClean: false, powerBias: -1 },
  bodyboard: { lo: 1, hi: 1, prefersClean: false, powerBias: 0.2 },
};

export function getRideabilityBand(
  skill: SkillLevel,
  board: BoardClass | null
): RideabilityBand {
  const base = SKILL_WAVE_RANGES[skill];

  if (!board) {
    return {
      ideal: { ...base.ideal },
      acceptable: { ...base.acceptable },
      prefersClean: false,
      powerBias: 0,
    };
  }

  const shape = BOARD_SHAPE[board];

  return {
    ideal: shapeBand(base.ideal, shape),
    acceptable: shapeBand(base.acceptable, shape),
    prefersClean: shape.prefersClean,
    powerBias: shape.powerBias,
  };
}

export function getBoardPowerBias(board: BoardClass): number {
  return BOARD_SHAPE[board].powerBias;
}

function shapeBand(
  band: { readonly min: number; readonly max: number },
  shape: BoardShape
): { readonly min: number; readonly max: number } {
  const min = Math.max(0.3, round1(band.min * shape.lo));
  const max = Math.max(min + 0.5, round1(band.max * shape.hi));

  return { min, max };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
