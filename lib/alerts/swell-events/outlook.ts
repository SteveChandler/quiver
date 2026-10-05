import { degreeToCardinal, degreesToCardinal } from "@/lib/utils/geo-utils";
import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";

import {
  SWELL_EVENT_BASELINE_LOOKBACK_HOURS,
  buildTracks,
  componentDays,
  componentEnergy,
  exposedSwellRows,
  tracksSwellComponent,
  type BeachSwellEvent,
  type DayPeak,
  type ExposedSwellRow,
  type SwellEventBeach,
  type SwellEventForecastRow,
} from "./detector";
import { swellWindowForBeach } from "./exposure";

export const SWELL_OUTLOOK_PULSE_DETECTOR_VERSION = "swell-outlook-pulse.v1";

export const SWELL_OUTLOOK_PULSE_THRESHOLDS = {
  minFaceHeightFt: 1.5,
  minPeriodS: 9,
  minProminenceRatio: 0.25,
  minRegionBeaches: 3,
  regionRadiusMiles: 40,
  horizonDays: 9,
} as const;

const HOUR_MS = 60 * 60 * 1000;
// Same window as the cross-run key reuse: closer than this is one swell.
const DUPLICATE_PEAK_MS = 36 * HOUR_MS;

function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Topographic prominence of energies[index] as a share of its own height. */
export function prominenceRatio(energies: readonly number[], index: number): number {
  const peak = energies[index];
  if (!(peak > 0)) return 0;
  let leftBase = peak;
  for (let at = index - 1; at >= 0 && energies[at] <= peak; at -= 1) leftBase = Math.min(leftBase, energies[at]);
  let rightBase = peak;
  for (let at = index + 1; at < energies.length && energies[at] <= peak; at += 1) rightBase = Math.min(rightBase, energies[at]);
  return (peak - Math.max(leftBase, rightBase)) / peak;
}

function pulseFrom(args: {
  beach: SwellEventBeach;
  rows: readonly ExposedSwellRow[];
  day: DayPeak;
  baselineEnergy: number;
}): BeachSwellEvent | null {
  const peak = args.day.partition;
  if (!peak) return null;
  const onset = args.baselineEnergy + 0.5 * (args.day.energy - args.baselineEnergy);
  let arrivalIndex = args.day.rowIndex;
  while (arrivalIndex - 1 >= 0 && componentEnergy(args.rows[arrivalIndex - 1], peak) >= onset) arrivalIndex -= 1;
  let fadeAt: string | null = null;
  for (let index = args.day.rowIndex + 1; index < args.rows.length; index += 1) {
    if (componentEnergy(args.rows[index], peak) < onset) {
      fadeAt = args.rows[index].iso;
      break;
    }
  }
  const directionBand = degreesToCardinal(peak.directionDeg);
  return {
    beachId: args.beach.id,
    // The ":p" marker keeps pulse keys apart from notable keys in the shared snapshot table.
    eventKey: `${args.beach.id}:${directionBand}:${args.day.localDate}:p`,
    directionDeg: peak.directionDeg,
    directionBand,
    directionLabel: degreeToCardinal(peak.directionDeg),
    periodS: peak.periodS,
    peakOffshoreHeightFt: peak.heightFt,
    peakFaceHeightFt: args.day.faceHeightFt,
    baselineFaceHeightFt: 0,
    peakEnergy: args.day.energy,
    baselineEnergy: args.baselineEnergy,
    energyRatio: args.baselineEnergy > 0 ? Math.min(99, args.day.energy / args.baselineEnergy) : 99,
    exposure: peak.exposure,
    arrivalAt: args.rows[arrivalIndex].iso,
    peakAt: args.rows[args.day.rowIndex].iso,
    fadeAt,
    peakLocalDate: args.day.localDate,
  };
}

/**
 * Local maxima of each tracked component's daily energy with at least
 * minProminenceRatio prominence, above the face and period floors. A swell
 * still rising on the last horizon day has no right-hand neighbour and is
 * picked up by the next run.
 */
export function detectBeachSwellPulses(input: {
  beach: SwellEventBeach;
  forecasts: readonly SwellEventForecastRow[];
  now: Date;
  timezone: string;
}): BeachSwellEvent[] {
  const window = swellWindowForBeach(input.beach);
  if (!window) return [];
  const thresholds = SWELL_OUTLOOK_PULSE_THRESHOLDS;
  const today = getLocalDateStr(input.now, input.timezone);
  const lookbackStart = new Date(input.now.getTime() - SWELL_EVENT_BASELINE_LOOKBACK_HOURS * HOUR_MS);
  const rows = exposedSwellRows(input.forecasts, window, input.timezone, {
    firstDate: getLocalDateStr(lookbackStart, input.timezone),
    lastDate: addLocalDays(today, thresholds.horizonDays - 1),
  });

  const found: BeachSwellEvent[] = [];
  for (const track of buildTracks(rows)) {
    const days = componentDays(rows, track, input.beach);
    const energies = days.map((day) => day.energy);
    for (let index = 1; index < days.length - 1; index += 1) {
      const day = days[index];
      if (!day.partition || day.energy <= 0) continue;
      if (!(energies[index] >= energies[index - 1] && energies[index] > energies[index + 1])) continue;
      if (day.localDate <= today) continue;
      if (day.faceHeightFt < thresholds.minFaceHeightFt || day.partition.periodS < thresholds.minPeriodS) continue;
      if (prominenceRatio(energies, index) < thresholds.minProminenceRatio) continue;
      const pulse = pulseFrom({
        beach: input.beach,
        rows,
        day,
        baselineEnergy: Math.min(...energies.slice(0, index + 1)),
      });
      if (pulse) found.push(pulse);
    }
  }

  // Two tracks can split one swell (a period jump between rows); keep the stronger.
  const kept: BeachSwellEvent[] = [];
  for (const pulse of found.sort((left, right) => right.peakEnergy - left.peakEnergy)) {
    const duplicate = kept.some((other) => (
      tracksSwellComponent(other, pulse)
      && Math.abs(Date.parse(other.peakAt) - Date.parse(pulse.peakAt)) <= DUPLICATE_PEAK_MS
    ));
    if (!duplicate) kept.push(pulse);
  }
  return kept.sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
}
