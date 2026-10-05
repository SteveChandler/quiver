// lib/services/discovery/swell-outlook-sticky.ts
import {
  SWELL_EVENT_THRESHOLDS,
  parseSwellPartitions,
  swellPartitionFaceHeightFt,
  type SwellEventBeach,
  type SwellEventForecastRow,
} from '@/lib/alerts/swell-events';
import type { BoardClass } from '@/lib/domains/rideability';
import { angleDifference } from '@/lib/domains/shared/angle-utils';
import type { SkillLevel } from '@/lib/domains/user-preferences';

import { swellFitFor } from './swell-outlook-fit';
import { faceHeightRange } from './swell-outlook-source';
import type { OutlookSwell, StoredOutlookList } from './swell-outlook-types';

const HOUR_MS = 60 * 60 * 1000;
const MATCH_PEAK_MS = 36 * HOUR_MS;
const ARRIVED_CARRY_MS = 12 * HOUR_MS;
export const STICKY_MIN_FACE_FT = 2;

export interface CarryOverInput {
  previous: StoredOutlookList | null;
  current: readonly OutlookSwell[];
  forecastsByBeach: ReadonlyMap<string, readonly SwellEventForecastRow[]>;
  beachesById: ReadonlyMap<string, SwellEventBeach>;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  now: Date;
}

function isSameSwell(left: Pick<OutlookSwell, 'directionDeg' | 'peakAt'>, right: Pick<OutlookSwell, 'directionDeg' | 'peakAt'>): boolean {
  return angleDifference(left.directionDeg, right.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    && Math.abs(Date.parse(left.peakAt) - Date.parse(right.peakAt)) <= MATCH_PEAK_MS;
}

function livePeakFaceFt(previous: OutlookSwell, input: CarryOverInput): number | null {
  const beach = input.beachesById.get(previous.beach.id);
  if (!beach) return null;
  const peakMs = Date.parse(previous.peakAt);
  let best: number | null = null;
  for (const row of input.forecastsByBeach.get(previous.beach.id) ?? []) {
    if (Math.abs(Date.parse(row.forecast_at) - peakMs) > MATCH_PEAK_MS) continue;
    const partitions = parseSwellPartitions(row).filter((partition) => (
      angleDifference(partition.directionDeg, previous.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    ));
    if (partitions.length === 0) continue;
    const face = swellPartitionFaceHeightFt(partitions, beach);
    if (face !== null && (best === null || face > best)) best = face;
  }
  return best;
}

// Sticky tracking preserves the listing tier even when the remaining forecast grows.
export function carryOverSwells(input: CarryOverInput): OutlookSwell[] {
  const nowMs = input.now.getTime();
  const carried: OutlookSwell[] = [];
  for (const previous of input.previous?.swells ?? []) {
    if (previous.status === 'faded') continue;
    if (input.current.some((entry) => entry.id === previous.id || isSameSwell(entry, previous))) continue;

    const peakMs = Date.parse(previous.peakAt);
    if (peakMs <= nowMs) {
      if (nowMs - peakMs <= ARRIVED_CARRY_MS) carried.push({ ...previous, status: 'arrived', change: 'steady' });
      continue;
    }

    const face = livePeakFaceFt(previous, input);
    if (face === null || face < STICKY_MIN_FACE_FT) {
      carried.push({ ...previous, status: 'faded', change: 'downgraded' });
      continue;
    }
    carried.push({
      ...previous,
      status: 'shrinking',
      change: 'downgraded',
      faceHeightFt: faceHeightRange(face),
      fit: swellFitFor({ faceHeightFt: face, skillLevel: input.skillLevel, boardClasses: input.boardClasses }),
    });
  }
  return carried;
}
