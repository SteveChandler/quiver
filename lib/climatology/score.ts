import { waterTempComfortScore } from "@/lib/utils/surf-score-utils";
import type { ClimatologyMonth } from "./types";

export const BUOY_SCORE_VERSION = "buoy-v1" as const;
export const BUOY_SCORE_WEIGHTS = {
  surfDays: 0.45,
  groundswell: 0.25,
  cleanMornings: 0.2,
  waterComfort: 0.1,
} as const;
export const PEAK_BAND_POINTS = 10;

interface BuoyScoreInput {
  surfDayShare: number;
  groundswellShare: number;
  cleanMorningShare: number | null;
  waterMedianF: number;
}

export function computeBuoyScore(input: BuoyScoreInput): number {
  const weights = BUOY_SCORE_WEIGHTS;
  const water = waterTempComfortScore(input.waterMedianF) / 100;
  const base =
    weights.surfDays * input.surfDayShare +
    weights.groundswell * input.groundswellShare +
    weights.waterComfort * water;

  if (input.cleanMorningShare === null) {
    return Math.round((100 * base) / (1 - weights.cleanMornings));
  }
  return Math.round(100 * (base + weights.cleanMornings * input.cleanMorningShare));
}

export function scoreMonth(month: Omit<ClimatologyMonth, "score">, cityHasWind: boolean): number | null {
  if (!month.waves || !month.water) return null;
  if (cityHasWind && !month.wind) return null;
  return computeBuoyScore({
    surfDayShare: 1 - month.waves.smallDayShare,
    groundswellShare: month.waves.periodMix.atLeast10,
    cleanMorningShare: cityHasWind && month.wind ? month.wind.cleanMorningShare : null,
    waterMedianF: month.water.medianF,
  });
}

export function derivePeak(
  months: Array<{ month: number; score: number | null }>,
): { peakMonth: number | null; peakBand: number[] } {
  let peak: { month: number; score: number } | null = null;
  for (const entry of months) {
    if (entry.score === null) continue;
    if (peak === null || entry.score > peak.score) peak = { month: entry.month, score: entry.score };
  }
  if (peak === null) return { peakMonth: null, peakBand: [] };

  const floor = peak.score - PEAK_BAND_POINTS;
  return {
    peakMonth: peak.month,
    peakBand: months.filter((entry) => entry.score !== null && entry.score >= floor).map((entry) => entry.month),
  };
}
