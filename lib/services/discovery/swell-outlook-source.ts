// lib/services/discovery/swell-outlook-source.ts
import { angleDifference } from '@/lib/domains/shared/angle-utils';

import type { ActiveStorm } from './nhc-storms';
import type { FaceHeightRangeFt, SwellSource } from './swell-outlook-types';

const STORM_BEARING_TOLERANCE_DEG = 20;

/** May 15 through Nov 30, by the peak's UTC date. */
export function isEastPacificHurricaneSeason(at: Date): boolean {
  if (!Number.isFinite(at.getTime())) return false;
  const month = at.getUTCMonth() + 1;
  if (month < 5 || month > 11) return false;
  return month !== 5 || at.getUTCDate() >= 15;
}

function between(value: number, from: number, to: number): boolean {
  return value >= from && value <= to;
}

export function swellSourceFor(args: {
  directionDeg: number;
  periodS: number | null;
  peakAt: string;
  activeStorms: readonly ActiveStorm[];
}): SwellSource {
  const { directionDeg, periodS } = args;
  if (periodS === null || !Number.isFinite(periodS)) return 'unknown';
  const pacificSystem = args.activeStorms.some((storm) => storm.basin === 'ep' || storm.basin === 'cp');
  if (between(directionDeg, 150, 190) && pacificSystem && isEastPacificHurricaneSeason(new Date(args.peakAt))) {
    return 'tropical';
  }
  if (between(directionDeg, 180, 230) && periodS >= 14) return 'southern_hemisphere';
  if (between(directionDeg, 280, 320) && periodS >= 13) return 'north_pacific';
  if (periodS < 11) return 'local';
  return 'unknown';
}

function bearingDeg(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const rad = (degrees: number): number => (degrees * Math.PI) / 180;
  const phi1 = rad(from.lat);
  const phi2 = rad(to.lat);
  const lambda = rad(to.lon - from.lon);
  const y = Math.sin(lambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** A Pacific system whose bearing from the beach is within 20 deg of where the swell comes from. */
export function matchStormOnBearing(args: {
  storms: readonly ActiveStorm[];
  beach: { lat: number; lon: number };
  directionDeg: number;
}): string | null {
  let best: { name: string; offset: number } | null = null;
  for (const storm of args.storms) {
    if (storm.basin === 'other') continue;
    const offset = angleDifference(bearingDeg(args.beach, storm), args.directionDeg);
    if (offset <= STORM_BEARING_TOLERANCE_DEG && (!best || offset < best.offset)) best = { name: storm.name, offset };
  }
  return best?.name ?? null;
}

const roundHalf = (value: number): number => Math.round(value * 2) / 2;

/** +/-15% rounded to half feet, never narrower than one foot. */
export function faceHeightRange(faceFt: number): FaceHeightRangeFt {
  const min = roundHalf(faceFt * 0.85);
  const max = roundHalf(faceFt * 1.15);
  if (max - min >= 1) return { min, max };
  const floor = Math.max(0, roundHalf(faceFt - 0.5));
  return { min: floor, max: floor + 1 };
}

export function faceHeightSpan(values: readonly number[]): FaceHeightRangeFt | null {
  const finiteValues: number[] = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return null;
  const lowest = Math.min(...finiteValues);
  const highest = Math.max(...finiteValues);
  return { min: faceHeightRange(lowest).min, max: faceHeightRange(highest).max };
}

export function sizeByOrientation(
  members: ReadonlyArray<{ windowCenterDeg: number | null; faceHeightFt: number }>,
): { southFacing: FaceHeightRangeFt | null; westFacing: FaceHeightRangeFt | null } {
  const south: number[] = [];
  const west: number[] = [];
  for (const member of members) {
    if (member.windowCenterDeg === null || !Number.isFinite(member.faceHeightFt)) continue;
    if (angleDifference(member.windowCenterDeg, 180) <= 45) south.push(member.faceHeightFt);
    else if (angleDifference(member.windowCenterDeg, 270) <= 45) west.push(member.faceHeightFt);
  }
  return { southFacing: faceHeightSpan(south), westFacing: faceHeightSpan(west) };
}
