import { PEAK_BAND_POINTS } from "./score";
import { formatShare, joinNames, type DataBackedSeasonView } from "./season-view";
import { BIG_DAY_FT, BIG_DAY_MIN_HOURS, LONG_PERIOD_S, SMALL_DAY_FT } from "./stats";
import type { Sector, SurfClimatologyDataset } from "./types";

export interface SeasonCopyContext {
  dataset: SurfClimatologyDataset;
  view: DataBackedSeasonView;
}

export interface SeasonCopySource {
  label: string;
  url: string;
}

export interface SeasonCopy {
  answerHeading: (context: SeasonCopyContext) => string;
  answer: (context: SeasonCopyContext) => string[];
  comparisonHeading: string;
  comparison: (context: SeasonCopyContext) => string[];
  limitsHeading: string;
  limits: (context: SeasonCopyContext) => string[];
  sources: SeasonCopySource[];
  /** A city-specific section on how to read the buoy's season. */
  seasonNote?: {
    heading: string;
    paragraphs: (context: SeasonCopyContext) => string[];
    chart?: {
      primarySectors: readonly Sector[];
      primaryLabel: string;
      secondarySectors: readonly Sector[];
      secondaryLabel: string;
    };
  };
  /** Replaces the view's best-month FAQ answer. */
  bestMonthFaq?: (context: SeasonCopyContext) => string;
}

export const NOAA_WAVE_HEIGHT_SOURCE: SeasonCopySource = {
  label: "NOAA NDBC: how wave height is measured",
  url: "https://www.ndbc.noaa.gov/faq/measdes.shtml",
};

export const SIGNIFICANT_HEIGHT_SENTENCE =
  "The buoy reports significant wave height, which NOAA defines as the average height of the highest third of the waves it measures.";

export const formatKm = (km: number): string => `${Math.round(km * 10) / 10} km`;

/** The opening paragraphs for a buoy-backed city. Every number comes from the view. */
export function describePeakAndQuiet(view: DataBackedSeasonView): string[] {
  const { peakMonth, peakBand, quietMonth, primary } = view;
  if (!peakMonth?.waves || peakMonth.score === null) {
    return [`There isn't enough ${primary.name} buoy data to name a best month.`];
  }

  if (!view.hasClearSeason && view.scoreRange) {
    const medians = view.months.flatMap((month) => (month.waves ? [month.waves.hsFt.median] : []));
    return [
      `Every month scores between ${view.scoreRange.min} and ${view.scoreRange.max} on the ${primary.name} buoy record, so the buoy on its own doesn't pick a season. ${peakMonth.name} scores highest, ${peakMonth.score}/100.`,
      `The buoy's monthly median reading stays between ${Math.min(...medians)} and ${Math.max(...medians)} ft all year.`,
    ];
  }

  const others = peakBand.filter((month) => month.month !== peakMonth.month).map((month) => month.name);
  const paragraphs = [
    `${peakMonth.name} scores highest on the ${primary.name} buoy record, ${peakMonth.score}/100.` +
      (others.length > 0
        ? ` ${joinNames(others)} ${others.length === 1 ? "is" : "are"} within ${PEAK_BAND_POINTS} points of it.`
        : ""),
    `In ${peakMonth.name} the buoy's median reading is ${peakMonth.waves.hsFt.median} ft. ` +
      `${formatShare(peakMonth.waves.bigDayShare)} of its days held ${BIG_DAY_FT} ft or more for at least ${BIG_DAY_MIN_HOURS} hours, ` +
      `and ${formatShare(peakMonth.waves.periodMix.atLeast10)} of its hours had swell of ${LONG_PERIOD_S} seconds or longer.`,
  ];
  if (quietMonth?.waves && quietMonth.month !== peakMonth.month) {
    paragraphs.push(
      `${quietMonth.name} is the quietest month: on ${formatShare(quietMonth.waves.smallDayShare)} of its days the daytime median stayed under ${SMALL_DAY_FT} ft.`,
    );
  }
  return paragraphs;
}
