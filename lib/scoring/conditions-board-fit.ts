/**
 * Conditions-first board fit: which kind of board suits these waves, before any history.
 *
 * A board class fits a wave by its effective size: face height scaled for skill, then nudged by
 * power (period), wind cleanliness and tide stage at the spot. Those nudges are clamped so one bad
 * input cannot flip the class on its own. The class table is a surf-knowledge prior (advanced
 * surfer, neutral power and tide), not a fit to data; recalibrate once labelled sessions allow.
 */
import { normalizeBoardClass, type BoardClass } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import { parseWaveHeightMidpointFt } from '@/lib/alerts/forecast-parsers';
import { getDirectionDegrees } from '@/lib/utils/number-parsing';

interface ClassFitRow {
  /** Effective face height (ft) the class fits best. */
  centerFt: number;
  /** Log-height width of the fit curve. */
  width: number;
  /** Typical length (in), used only to size up long fish and twins. */
  lengthIn: number;
  /** Points swing between blown-out and glassy. */
  cleanSwing: number;
  /** An open side carries no penalty: a longboard is never "too small", a gun never "too big". */
  openSide?: 'small' | 'big';
}

const CLASS_FIT_TABLE: Partial<Record<BoardClass, ClassFitRow>> = {
  foamie: { centerFt: 1.6, width: 0.35, lengthIn: 84, cleanSwing: 12, openSide: 'small' },
  longboard: { centerFt: 2.0, width: 0.33, lengthIn: 108, cleanSwing: 16, openSide: 'small' },
  funboard: { centerFt: 2.6, width: 0.38, lengthIn: 80, cleanSwing: 10 },
  'mid-length': { centerFt: 3.3, width: 0.42, lengthIn: 84, cleanSwing: 10 },
  fish: { centerFt: 3.3, width: 0.44, lengthIn: 66, cleanSwing: 4 },
  shortboard: { centerFt: 4.8, width: 0.5, lengthIn: 72, cleanSwing: 8 },
  'step-up': { centerFt: 8.5, width: 0.3, lengthIn: 78, cleanSwing: 6 },
  gun: { centerFt: 13, width: 0.3, lengthIn: 90, cleanSwing: 4, openSide: 'big' },
  sup: { centerFt: 2.2, width: 0.4, lengthIn: 120, cleanSwing: 14, openSide: 'small' },
  foil: { centerFt: 2, width: 0.6, lengthIn: 60, cleanSwing: 6 },
  bodyboard: { centerFt: 3.5, width: 0.5, lengthIn: 44, cleanSwing: 4 },
};

// Less experienced surfers want more float at the same face height.
const SKILL_SIZE_FACTOR: Record<SkillLevel, number> = { beginner: 0.6, intermediate: 0.8, advanced: 1, expert: 1.1 };
// Float-and-glide classes pay for crossing swells, as the previous rule's prefersClean boards did.
const CLEAN_PREFERRING: ReadonlySet<BoardClass> = new Set<BoardClass>(['foamie', 'longboard', 'mid-length', 'funboard', 'sup']);
const WIND_BASE = { offshore: 0.98, 'cross-offshore': 0.92, 'cross-shore': 0.8, onshore: 0.7, unknown: 0.85 } as const;
const WIND_SLOPE = { offshore: 0.012, 'cross-offshore': 0.02, 'cross-shore': 0.04, onshore: 0.05, unknown: 0.03 } as const;
const OFFSHORE_TOLERANCE_DEG = 30;

interface FitForecast {
  forecast_at?: string | null;
  wave_height?: string | null;
  wave_period?: unknown;
  wave_period_om?: unknown;
  swell_1_height?: unknown;
  swell_1_period?: unknown;
  swell_2_height?: unknown;
  swell_2_period?: unknown;
  wind_wave_height?: unknown;
  wind_wave_period?: unknown;
  wind_speed?: unknown;
  wind_direction?: string | null;
  wind_direction_deg?: number | null;
  tide_height?: unknown;
  tide_status?: string | null;
}

interface FitBeach {
  wind_offshore_deg?: number | null;
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
  break_type?: string | null;
}

interface FitConditions {
  heightFt: number;
  periodSec: number | null;
  windMph: number | null;
  windDirDeg: number | null;
  offshoreDeg: number | null;
  tideFt: number | null;
  tideSoonFt: number | null;
  tideStatus: string | null;
  preferredTideMin: number | null;
  preferredTideMax: number | null;
  breakType: string | null;
  /** 0-100, 100 = one clean swell (swellInterferenceScorer). */
  interference: number | null;
}

function numeric(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Whole-sea period: Open-Meteo mean, else energy-weighted partitions, else the stored period. */
function seaPeriodSec(row: FitForecast): number | null {
  const mean = numeric(row.wave_period_om);
  if (mean !== null && mean > 0) return mean;
  const parts: Array<[number, number]> = [];
  for (const [height, period] of [[row.swell_1_height, row.swell_1_period], [row.swell_2_height, row.swell_2_period], [row.wind_wave_height, row.wind_wave_period]]) {
    const h = numeric(height);
    const p = numeric(period);
    if (h && p) parts.push([h, p]);
  }
  if (parts.length) {
    const energy = parts.reduce((sum, [h]) => sum + h * h, 0);
    return parts.reduce((sum, [h, p]) => sum + h * h * p, 0) / energy;
  }
  return numeric(row.wave_period);
}

export function fitConditions(row: FitForecast, beach: FitBeach, interference: number | null): FitConditions | null {
  const heightFt = parseWaveHeightMidpointFt(row.wave_height ?? '');
  if (heightFt === null) return null;
  const tideFt = numeric(row.tide_height);
  const status = row.tide_status ?? null;
  const drift = /rising/i.test(status ?? '') ? 0.6 : /falling/i.test(status ?? '') ? -0.6 : 0;
  return {
    heightFt,
    periodSec: seaPeriodSec(row),
    windMph: numeric(row.wind_speed),
    windDirDeg: getDirectionDegrees(row.wind_direction_deg ?? null, row.wind_direction ?? null),
    offshoreDeg: beach.wind_offshore_deg ?? null,
    tideFt,
    // Where the tide is heading over the next hour or so; the session rides the coming water.
    tideSoonFt: tideFt === null ? null : tideFt + drift,
    tideStatus: status,
    preferredTideMin: beach.preferred_tide_ft_min ?? null,
    preferredTideMax: beach.preferred_tide_ft_max ?? null,
    breakType: beach.break_type ?? null,
    interference,
  };
}

type WindLabel = 'glassy' | keyof typeof WIND_BASE;

function windCleanliness(c: FitConditions): { clean: number; label: WindLabel } {
  const mph = c.windMph ?? 0;
  if (mph <= 3) return { clean: 0.95, label: 'glassy' };
  let label: keyof typeof WIND_BASE = 'unknown';
  if (c.windDirDeg !== null && c.offshoreDeg !== null) {
    const raw = Math.abs(c.windDirDeg - c.offshoreDeg) % 360;
    const off = Math.min(raw, 360 - raw);
    label = off <= OFFSHORE_TOLERANCE_DEG ? 'offshore' : off <= OFFSHORE_TOLERANCE_DEG * 1.5 ? 'cross-offshore' : off <= 90 ? 'cross-shore' : 'onshore';
  }
  return { clean: Math.max(0.05, Math.min(1, WIND_BASE[label] - WIND_SLOPE[label] * (mph - 3))), label };
}

/** +1 = high, filling water (fat, soft waves); -1 = low water (steep, fast waves). */
function tideShift(c: FitConditions): number {
  const h = c.tideSoonFt ?? c.tideFt;
  if (h === null) return 0;
  const middle = ((c.preferredTideMin ?? 0.5) + (c.preferredTideMax ?? 4.5)) / 2;
  return Math.max(-1, Math.min(1, (h - middle) / 3));
}

function tideBreakWeight(breakType: string | null): number {
  const s = (breakType ?? '').toLowerCase();
  if (s.includes('beach')) return 1;
  if (s.includes('point') || s.includes('jetty') || s.includes('breakwater')) return 0.6;
  if (s.includes('reef')) return 0.5;
  return 0.7;
}

interface FitFrame { effectiveFt: number; clean: number; windLabel: WindLabel; tide: number }

function fitFrame(c: FitConditions, skill: SkillLevel): FitFrame {
  const power = c.periodSec === null ? 0 : Math.max(-1, Math.min(1, (c.periodSec - 10) / 4));
  const wind = windCleanliness(c);
  const windShift = Math.max(-0.25, Math.min(0.04, 0.4 * (wind.clean - 0.85)));
  const tide = tideShift(c) * tideBreakWeight(c.breakType);
  // Conditions make a wave act at most ~26% smaller or ~28% bigger.
  const shift = Math.max(-0.3, Math.min(0.25, 0.22 * power + windShift - 0.25 * tide));
  return { effectiveFt: c.heightFt * SKILL_SIZE_FACTOR[skill] * Math.exp(shift), clean: wind.clean, windLabel: wind.label, tide };
}

export function boardLengthIn(dimensions: string | null | undefined): number | null {
  if (!dimensions) return null;
  const feet = dimensions.match(/(\d+)\s*['’′]\s*(\d+)?/);
  if (feet) return parseInt(feet[1], 10) * 12 + (feet[2] ? parseInt(feet[2], 10) : 0);
  const inches = dimensions.match(/^\s*(\d{2,3})\s*["”″]/);
  return inches ? parseInt(inches[1], 10) : null;
}

/** A specific name ("twin pin", "egg", "mini-mid") beats a generic shortboard type. */
export function resolvePickClass(board: { board_type: string; name: string }): BoardClass | null {
  const byType = normalizeBoardClass(board.board_type);
  if (byType === null || byType === 'shortboard') {
    const byName = normalizeBoardClass(board.name);
    if (byName && byName !== 'shortboard') return byName;
  }
  return byType ?? normalizeBoardClass(board.name);
}

export function classFitScore(c: FitConditions, skill: SkillLevel, boardClass: BoardClass, lengthIn: number | null = null): number | null {
  const row = CLASS_FIT_TABLE[boardClass];
  if (!row) return null;
  const f = fitFrame(c, skill);
  // A fish or twin longer than the class norm is a bigger-wave board (a 6'4 twin pin sits near 4 ft).
  const sizeUp = boardClass === 'fish' && lengthIn ? Math.max(1, Math.min(1.3, lengthIn / row.lengthIn)) ** 1.5 : 1;
  let z = Math.log(f.effectiveFt / (row.centerFt * sizeUp)) / row.width;
  if ((row.openSide === 'small' && z < 0) || (row.openSide === 'big' && z > 0)) z = 0;
  const fit = 100 * Math.exp(-0.5 * z * z);
  const crossing = CLEAN_PREFERRING.has(boardClass) && c.interference !== null ? 0.1 * (100 - c.interference) : 0;
  return fit + row.cleanSwing * (f.clean - 0.5) - crossing;
}

const ARCHETYPES: Record<string, readonly BoardClass[]> = {
  longboard: ['longboard', 'foamie'],
  'all-rounder': ['funboard', 'mid-length', 'fish'],
  shortboard: ['shortboard', 'step-up'],
  gun: ['gun'],
};
const ARCHETYPE_NOUN: Record<string, string> = {
  longboard: 'a longboard', 'all-rounder': 'an all-rounder', shortboard: 'a shortboard or step-up', gun: 'a gun',
};
const CLASS_NOUN: Partial<Record<BoardClass, string>> = {
  foamie: 'a longboard', longboard: 'a longboard', funboard: 'an all-rounder', 'mid-length': 'an all-rounder', fish: 'an all-rounder',
  shortboard: 'a shortboard', 'step-up': 'a step-up', gun: 'a gun',
};

function sizeBand(heightFt: number): string {
  const lo = Math.max(1, Math.round(heightFt - 0.5));
  return `${lo}-${Math.max(lo + 1, Math.round(heightFt + 0.5))} ft`;
}

/** Board-free advice for these conditions, e.g. "Ride an all-rounder in 3-4 ft waves". */
function conditionsAdvice(c: FitConditions, skill: SkillLevel): { headline: string; bestScore: number } {
  const groups = Object.entries(ARCHETYPES).map(([group, members]) => ({
    group, score: Math.max(...members.map((m) => classFitScore(c, skill, m) ?? -Infinity)),
  })).sort((a, b) => b.score - a.score);
  // When in doubt, the all-rounder is the safe call.
  const allRounder = groups.find((g) => g.group === 'all-rounder')!;
  const best = allRounder.score >= groups[0].score - 5 ? allRounder : groups[0];
  return { headline: `Ride ${ARCHETYPE_NOUN[best.group]} in ${sizeBand(c.heightFt)} waves`, bestScore: groups[0].score };
}

function conditionClauses(c: FitConditions, skill: SkillLevel): string[] {
  const f = fitFrame(c, skill);
  const out: string[] = [];
  if (c.tideSoonFt !== null && f.tide >= 0.5) out.push(/rising/i.test(c.tideStatus ?? '') ? 'the tide is filling in, so waves fatten up' : 'high water softens the waves');
  else if (c.tideSoonFt !== null && f.tide <= -0.5) out.push('low water makes steeper, faster faces');
  if (f.clean <= 0.5) out.push('choppy wind');
  else if (f.windLabel === 'glassy') out.push('glassy faces');
  else if (f.clean >= 0.9) out.push('clean offshore faces');
  if (c.periodSec !== null && c.periodSec <= 7) out.push('short-period, weak power');
  else if (c.periodSec !== null && c.periodSec >= 14) out.push('long-period power');
  return out.slice(0, 2);
}

/** The line shown beside a pick. Conditions only; never a session count. */
export function pickReasonText(c: FitConditions, skill: SkillLevel, boardName: string, boardClass: BoardClass, stretch: boolean): string {
  const clauses = conditionClauses(c, skill);
  const detail = clauses.length ? ` (${clauses.join('; ')})` : '';
  if (stretch) return `${conditionsAdvice(c, skill).headline}. Closest board you own: ${boardName}${detail}`;
  return `${boardName}: ${CLASS_NOUN[boardClass] ?? 'a board'} for ${sizeBand(c.heightFt)}${detail}`;
}
