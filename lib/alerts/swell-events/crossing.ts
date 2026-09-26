import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { degreeToCardinal } from "@/lib/utils/geo-utils";

import {
  componentEnergy,
  exposedSwellRows,
  tracksSwellComponent,
  type BeachSwellEvent,
  type ExposedSwellPartition,
  type SwellEventBeach,
  type SwellEventForecastRow,
} from "./detector";
import { SWELL_EVENT_THRESHOLDS, swellWindowForBeach } from "./exposure";

export interface SwellCrossing {
  directionDeg: number;
  directionLabel: string;
  periodS: number;
  peakOffshoreHeightFt: number;
  /** Separation from the main swell, 0..180. */
  angleDeg: number;
  overlapStartAt: string;
  overlapEndAt: string;
}

interface OverlapRow {
  iso: string;
  mainEnergy: number;
  partitions: ExposedSwellPartition[];
}

function crossesMain(
  partition: ExposedSwellPartition,
  main: Pick<BeachSwellEvent, "directionDeg" | "periodS">,
  referenceDeg: number,
): boolean {
  const thresholds = SWELL_EVENT_THRESHOLDS;
  return partition.energy > 0
    && partition.periodS >= thresholds.crossingMinPeriodS
    && angleDifference(partition.directionDeg, referenceDeg) >= thresholds.crossingMinAngleDeg
    && !tracksSwellComponent(main, partition);
}

function strongEnough(energy: number, mainEnergy: number): boolean {
  return mainEnergy > 0 && energy >= SWELL_EVENT_THRESHOLDS.crossingMinEnergyShare * mainEnergy;
}

/**
 * A second swell crossing the main one at this beach during the main swell's
 * arrival→fade span. The other component need not qualify as an event (an 8 s
 * wind swell counts) but must be far enough apart, long enough in period, and
 * carry a real share of the main swell's exposed energy at the overlap peak.
 */
export function detectSwellCrossing(input: {
  beach: SwellEventBeach;
  forecasts: readonly SwellEventForecastRow[];
  main: Pick<BeachSwellEvent, "directionDeg" | "periodS" | "arrivalAt" | "fadeAt">;
  /** Direction the separation is measured from; defaults to the main swell's own. */
  referenceDirectionDeg?: number;
  timezone: string;
}): SwellCrossing | null {
  const window = swellWindowForBeach(input.beach);
  if (!window) return null;

  const referenceDeg = input.referenceDirectionDeg ?? input.main.directionDeg;
  const start = Date.parse(input.main.arrivalAt);
  const end = input.main.fadeAt ? Date.parse(input.main.fadeAt) : Number.POSITIVE_INFINITY;
  const rows: OverlapRow[] = exposedSwellRows(input.forecasts, window, input.timezone)
    .filter((row) => row.at >= start && row.at <= end)
    .map((row) => ({ iso: row.iso, mainEnergy: componentEnergy(row, input.main), partitions: row.partitions }));

  let peakIndex = -1;
  let crossing: ExposedSwellPartition | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].mainEnergy <= 0) continue;
    for (const partition of rows[index].partitions) {
      if (crossesMain(partition, input.main, referenceDeg) && (!crossing || partition.energy > crossing.energy)) {
        crossing = partition;
        peakIndex = index;
      }
    }
  }
  if (!crossing || !strongEnough(crossing.energy, rows[peakIndex].mainEnergy)) return null;
  const reference = crossing;

  const overlaps = (row: OverlapRow): boolean => row.partitions.some((partition) => (
    tracksSwellComponent(reference, partition)
    && crossesMain(partition, input.main, referenceDeg)
    && strongEnough(partition.energy, row.mainEnergy)
  ));
  let first = peakIndex;
  while (first - 1 >= 0 && overlaps(rows[first - 1])) first -= 1;
  let last = peakIndex;
  while (last + 1 < rows.length && overlaps(rows[last + 1])) last += 1;

  return {
    directionDeg: reference.directionDeg,
    directionLabel: degreeToCardinal(reference.directionDeg),
    periodS: reference.periodS,
    peakOffshoreHeightFt: reference.heightFt,
    angleDeg: angleDifference(reference.directionDeg, referenceDeg),
    overlapStartAt: rows[first].iso,
    overlapEndAt: rows[last].iso,
  };
}
