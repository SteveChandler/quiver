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

import { getLocalDateStr } from './window-selector/time-slot-utils';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';

import { swellFitFor } from './swell-outlook-fit';
import { faceHeightRange, sizeByOrientation } from './swell-outlook-source';
import type { OutlookSwell, StoredOutlookList } from './swell-outlook-types';

const HOUR_MS = 60 * 60 * 1000;
const MATCH_PEAK_MS = 36 * HOUR_MS;
const ARRIVED_CARRY_MS = 12 * HOUR_MS;
export const STICKY_MIN_FACE_FT = 2;

export interface CarryOverInput {
  previous: StoredOutlookList | null;
  current: readonly OutlookSwell[];
  forecastsByBeach: ReadonlyMap<string, readonly SwellEventForecastRow[]>;
  beachesById: ReadonlyMap<string, SwellEventBeach & { timezone?: string | null }>;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  now: Date;
}

function isSameSwell(left: Pick<OutlookSwell, 'directionDeg' | 'peakAt'>, right: Pick<OutlookSwell, 'directionDeg' | 'peakAt'>): boolean {
  return angleDifference(left.directionDeg, right.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    && Math.abs(Date.parse(left.peakAt) - Date.parse(right.peakAt)) <= MATCH_PEAK_MS;
}

interface LivePeak {
  faceHeightFt: number;
  periodS: number;
  windowCenterDeg: number | null;
}

function livePeakFor(previous: OutlookSwell, input: CarryOverInput, peakMs: number): LivePeak | null {
  const beach = input.beachesById.get(previous.beach.id);
  if (!beach) return null;
  const nowMs = input.now.getTime();
  let best: LivePeak | null = null;
  for (const row of input.forecastsByBeach.get(previous.beach.id) ?? []) {
    const atMs = Date.parse(row.forecast_at);
    if (!Number.isFinite(atMs) || atMs < nowMs || Math.abs(atMs - peakMs) > MATCH_PEAK_MS) continue;
    const partitions = parseSwellPartitions(row).filter((partition) => (
      angleDifference(partition.directionDeg, previous.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    ));
    for (const partition of partitions) {
      const face = swellPartitionFaceHeightFt([partition], beach);
      if (face === null || (best !== null && face <= best.faceHeightFt)) continue;
      best = {
        faceHeightFt: face,
        periodS: Math.round(partition.periodS),
        windowCenterDeg: beach.swell_window_center_deg,
      };
    }
  }
  return best;
}

// Sticky tracking preserves the listing tier even when the remaining forecast grows.
export function carryOverSwells(input: CarryOverInput): OutlookSwell[] {
  const nowMs = input.now.getTime();
  const carried: OutlookSwell[] = [];
  for (const previous of input.previous?.swells ?? []) {
    if (previous.status === 'faded') continue;
    const peakMs = Date.parse(previous.peakAt);
    if (!Number.isFinite(peakMs)) continue;
    if (input.current.some((entry) => entry.id === previous.id || isSameSwell(entry, previous))) continue;

    if (peakMs <= nowMs) {
      if (nowMs - peakMs <= ARRIVED_CARRY_MS) carried.push({ ...previous, status: 'arrived', change: 'steady' });
      continue;
    }

    const timezone = resolveBeachTimezone(input.beachesById.get(previous.beach.id)?.timezone);
    const peakToday = getLocalDateStr(new Date(peakMs), timezone) === getLocalDateStr(input.now, timezone);
    const livePeak = livePeakFor(previous, input, peakMs);
    if (peakToday && livePeak === null) {
      carried.push({ ...previous, status: 'forecast', change: 'steady', firstSightingEligible: false });
      continue;
    }
    if (livePeak === null || (!peakToday && livePeak.faceHeightFt < STICKY_MIN_FACE_FT)) {
      carried.push({ ...previous, status: 'faded', change: 'downgraded' });
      continue;
    }
    carried.push({
      ...previous,
      status: peakToday ? 'forecast' : 'shrinking',
      change: peakToday ? 'steady' : 'downgraded',
      ...(peakToday ? { firstSightingEligible: false as const } : {}),
      faceHeightFt: faceHeightRange(livePeak.faceHeightFt),
      fit: swellFitFor({ faceHeightFt: livePeak.faceHeightFt, skillLevel: input.skillLevel, boardClasses: input.boardClasses }),
      periodS: livePeak.periodS,
      sizeByOrientation: sizeByOrientation([{ windowCenterDeg: livePeak.windowCenterDeg, faceHeightFt: livePeak.faceHeightFt }]),
    });
  }
  return carried;
}
