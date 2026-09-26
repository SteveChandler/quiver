import { getWetsuitRecommendation } from "@/lib/utils/wetsuit-utils";
import { haversineKm } from "./geo";
import { derivePeak, PEAK_BAND_POINTS } from "./score";
import {
  SECTORS,
  type ClimatologyPlace,
  type ClimatologyRole,
  type ClimatologyStation,
  type Sector,
  type SurfClimatologyDataset,
  type WaveMonthStats,
} from "./types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
export const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
export const SEASONS: ReadonlyArray<{ label: string; months: readonly number[] }> = [
  { label: "Dec–Feb", months: [12, 1, 2] },
  { label: "Mar–May", months: [3, 4, 5] },
  { label: "Jun–Aug", months: [6, 7, 8] },
  { label: "Sep–Nov", months: [9, 10, 11] },
];

export interface SeasonMonthView {
  month: number;
  name: string;
  abbrev: string;
  score: number | null;
  isPeak: boolean;
  waves: WaveMonthStats | null;
  waterMedianF: number | null;
  wetsuit: string | null;
}

export interface DataBackedSeasonView {
  primary: ClimatologyStation;
  comparison: ClimatologyStation | null;
  wind: ClimatologyStation | null;
  failedStations: ClimatologyStation[];
  months: SeasonMonthView[];
  current: SeasonMonthView;
  peakMonth: SeasonMonthView | null;
  peakBand: SeasonMonthView[];
  quietMonth: SeasonMonthView | null;
  hasClearSeason: boolean;
  scoreRange: { min: number; max: number } | null;
  weekAnswer: string;
  heroDetail: string;
  bestMonthFaq: string;
  waterFaq: string;
  yearRoundFaq: string;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function stationDistanceKm(station: ClimatologyStation, place: ClimatologyPlace): number {
  return Math.round(haversineKm(station, place) * 10) / 10;
}

export function seasonalDirectionMix(
  dataset: SurfClimatologyDataset,
  role: "waves" | "comparison-waves",
  months: readonly number[],
): Record<Sector, number> | null {
  const stats = dataset.months
    .filter((month) => months.includes(month.month))
    .map((month) => (role === "waves" ? month.waves : month.comparisonWaves))
    .filter((entry): entry is WaveMonthStats => entry !== null);
  const totalHours = stats.reduce((sum, entry) => sum + entry.validHours, 0);
  if (totalHours === 0) return null;
  return Object.fromEntries(
    SECTORS.map((sector) => [
      sector,
      Math.round((stats.reduce((sum, entry) => sum + entry.directionMix[sector] * entry.validHours, 0) / totalHours) * 100) / 100,
    ]),
  ) as Record<Sector, number>;
}

/** Share of observed days in `months` with a 3 ft+ buoy median mostly from `sectors`, weighted by observed days. */
export function threeFootDaysShare(
  dataset: SurfClimatologyDataset,
  sectors: readonly Sector[],
  months: readonly number[],
): number | null {
  const stats = dataset.months
    .filter((month) => months.includes(month.month))
    .map((month) => month.waves)
    .filter((waves): waves is WaveMonthStats => waves !== null);
  const days = stats.reduce((sum, waves) => sum + waves.observedDays, 0);
  if (days === 0) return null;
  const weighted = stats.reduce(
    (sum, waves) => sum + sectors.reduce((acc, sector) => acc + waves.threeFootDaysBySector[sector], 0) * waves.observedDays,
    0,
  );
  return Math.round((weighted / days) * 100) / 100;
}

function findStation(dataset: SurfClimatologyDataset, role: ClimatologyRole): ClimatologyStation | null {
  return dataset.stations.find((station) => station.role === role) ?? null;
}

function buildWeekAnswer(
  current: SeasonMonthView,
  peak: SeasonMonthView | null,
  band: SeasonMonthView[],
  primary: ClimatologyStation,
  hasClearSeason: boolean,
): string {
  if (current.score === null) {
    return `There isn't enough ${primary.name} buoy data to score ${current.name}.`;
  }
  const lead = `${current.name} scores ${current.score}/100 on the ${primary.name} buoy record.`;
  if (!peak) return lead;
  if (!hasClearSeason) {
    return peak.month === current.month
      ? `${lead} It's the highest-scoring month, and every month scores within ${PEAK_BAND_POINTS} points of it.`
      : `${lead} Every month scores within ${PEAK_BAND_POINTS} points of ${peak.name}, the highest, so the buoy doesn't single out a season.`;
  }
  if (peak.month === current.month) return `${lead} It's the highest-scoring month.`;
  if (current.isPeak) return `${lead} It's in the peak band, within ${PEAK_BAND_POINTS} points of ${peak.name}.`;
  return `${lead} The peak band runs ${joinNames(band.map((month) => month.name))}.`;
}

function buildHeroDetail(
  current: SeasonMonthView,
  peak: SeasonMonthView | null,
  primary: ClimatologyStation,
  hasClearSeason: boolean,
): string {
  const parts: string[] = [];
  if (current.waves) {
    const { median, p25, p75 } = current.waves.hsFt;
    parts.push(
      `Buoy median ${median} ft, typically ${p25}–${p75} ft, at ${primary.name}, ${primary.distanceKm} km from ${primary.referenceLabel}.`,
    );
  } else {
    parts.push(`Not enough buoy data for ${current.name}.`);
  }
  if (current.waterMedianF !== null) parts.push(`Water ${current.waterMedianF}°F.`);
  if (peak && peak.month !== current.month) {
    parts.push(`${hasClearSeason ? "Peak month" : "Highest month"}: ${peak.name}.`);
  }
  return parts.join(" ");
}

function buildWaterFaq(months: SeasonMonthView[], primary: ClimatologyStation): string {
  const withWater = months.filter((month) => month.waterMedianF !== null);
  if (withWater.length === 0) {
    return `The ${primary.name} buoy doesn't have enough water temperature readings to summarise.`;
  }
  const coldest = withWater.reduce((a, b) => ((b.waterMedianF ?? 0) < (a.waterMedianF ?? 0) ? b : a));
  const warmest = withWater.reduce((a, b) => ((b.waterMedianF ?? 0) > (a.waterMedianF ?? 0) ? b : a));
  const [firstYear, lastYear] = primary.yearsUsed;
  return (
    `At the ${primary.name} buoy, the median water temperature runs from ${coldest.waterMedianF}°F in ${coldest.name} ` +
    `to ${warmest.waterMedianF}°F in ${warmest.name} (${firstYear}–${lastYear}). ` +
    `Wetsuit: ${coldest.wetsuit} in ${coldest.name}, ${warmest.wetsuit} in ${warmest.name}.`
  );
}

export function buildDataBackedSeasonView(
  dataset: SurfClimatologyDataset,
  currentMonth: number,
): DataBackedSeasonView {
  const primary = findStation(dataset, "waves");
  if (!primary) throw new Error(`${dataset.citySlug} dataset has no wave station`);
  const passed = (role: ClimatologyRole): ClimatologyStation | null => {
    const station = findStation(dataset, role);
    return station && station.gate === "passed" ? station : null;
  };

  const { peakMonth, peakBand } = derivePeak(dataset.months);
  const scored = dataset.months.flatMap((month) => (month.score === null ? [] : [month.score]));
  const scoreRange = scored.length === 0 ? null : { min: Math.min(...scored), max: Math.max(...scored) };
  // When every scored month is inside the band, badges would mark the whole year.
  const hasClearSeason = peakBand.length < scored.length;
  const band = new Set(hasClearSeason ? peakBand : []);
  const months: SeasonMonthView[] = dataset.months.map((month) => ({
    month: month.month,
    name: MONTH_NAMES[month.month - 1],
    abbrev: MONTH_ABBREVS[month.month - 1],
    score: month.score,
    isPeak: band.has(month.month),
    waves: month.waves,
    waterMedianF: month.water?.medianF ?? null,
    wetsuit: month.water ? getWetsuitRecommendation(month.water.medianF).thickness : null,
  }));
  const byMonth = (monthNumber: number): SeasonMonthView => {
    const found = months.find((month) => month.month === monthNumber);
    if (!found) throw new Error(`${dataset.citySlug} dataset has no month ${monthNumber}`);
    return found;
  };

  const current = byMonth(currentMonth);
  const peak = peakMonth === null ? null : byMonth(peakMonth);
  const bandMonths = hasClearSeason ? peakBand.map(byMonth) : [];
  const quietMonth = months.reduce<SeasonMonthView | null>(
    (quietest, month) =>
      month.waves && (!quietest?.waves || month.waves.smallDayShare > quietest.waves.smallDayShare)
        ? month
        : quietest,
    null,
  );
  const [firstYear, lastYear] = primary.yearsUsed;
  const strongMonths = months.filter((month) => month.score !== null && month.score >= 50).length;

  return {
    primary,
    comparison: passed("comparison-waves"),
    wind: passed("wind"),
    failedStations: dataset.stations.filter((station) => station.gate === "failed"),
    months,
    current,
    peakMonth: peak,
    peakBand: bandMonths,
    quietMonth,
    hasClearSeason,
    scoreRange,
    weekAnswer: buildWeekAnswer(current, peak, bandMonths, primary, hasClearSeason),
    heroDetail: buildHeroDetail(current, peak, primary, hasClearSeason),
    bestMonthFaq: peak
      ? !hasClearSeason && scoreRange
        ? `${peak.name} scores highest for ${dataset.cityName} on Quiver's buoy score (${peak.score}/100), but every month scores between ${scoreRange.min} and ${scoreRange.max}, so the buoy record doesn't pick a season.`
        : `${peak.name} scores highest for ${dataset.cityName} on Quiver's buoy score (${peak.score}/100), based on ${primary.name} readings from ${firstYear} to ${lastYear}.`
      : `There isn't enough ${primary.name} buoy data to name a best month for ${dataset.cityName}.`,
    waterFaq: buildWaterFaq(months, primary),
    yearRoundFaq:
      `${strongMonths} of 12 months score 50 or more on Quiver's buoy score for ${dataset.cityName}.` +
      (peak ? ` ${peak.name} scores highest.` : ""),
  };
}
