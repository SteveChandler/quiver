// lib/services/discovery/swell-outlook.ts
import {
  SWELL_EVENT_THRESHOLDS,
  isSwellEventCurrent,
  swellWindowForBeach,
  toSwellEventBeach,
  type BeachSwellEvent,
  type SwellEventForecastRow,
  type SwellEventSnapshot,
} from '@/lib/alerts/swell-events';
import type { PoolBeach } from '@/lib/alerts/user-pool';
import { tracksSwellComponent } from '@/lib/alerts/swell-events/detector';
import type { BoardClass } from '@/lib/domains/rideability';
import { angleDifference } from '@/lib/domains/shared/angle-utils';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { getLocalDateStr } from '@/lib/services/discovery/window-selector/time-slot-utils';
import { degreeToCardinal } from '@/lib/utils/geo-utils';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { Beach } from '@/types/database';

import type { ActiveStorm } from './nhc-storms';
import { swellFitFor } from './swell-outlook-fit';
import { carryOverSwells } from './swell-outlook-sticky';
import { faceHeightRange, matchStormOnBearing, sizeByOrientation, swellSourceFor } from './swell-outlook-source';
import type { OutlookSwell, StoredOutlookList, SwellOutlookResponse } from './swell-outlook-types';
import { changeFor, confidenceFor, groupEvents, isPreviousRun, round, SWELL_TRACKING_RULES, type SwellGroup } from './swell-tracking';

export type * from './swell-outlook-types';

export const SWELL_OUTLOOK_HORIZON_DAYS = 9;

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_LEAD_HOURS = 120;
const WINDOW_HALF_HOURS = 12;
const NOTABLE_MATCH_PEAK_MS = 36 * HOUR_MS;

export interface BuildSwellOutlookInput {
  pool: ReadonlyArray<Pick<PoolBeach, 'beach' | 'relation'>>;
  homeBeachId: string | null;
  pulseSnapshots: readonly SwellEventSnapshot[];
  notableSnapshots: readonly SwellEventSnapshot[];
  forecastsByBeach: ReadonlyMap<string, readonly SwellEventForecastRow[]>;
  previous: StoredOutlookList | null;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  storms: readonly ActiveStorm[];
  now: Date;
}

interface BuiltSwellOutlook {
  response: SwellOutlookResponse;
  list: StoredOutlookList;
}

export function resolveOutlookRunDate(snapshots: readonly SwellEventSnapshot[], now: Date): string {
  return snapshots.reduce((latest, snapshot) => (snapshot.runDate > latest ? snapshot.runDate : latest), '')
    || now.toISOString().slice(0, 10);
}

function eventFromSnapshot(snapshot: SwellEventSnapshot, timezone: string): BeachSwellEvent {
  return {
    beachId: snapshot.beachId,
    eventKey: snapshot.eventKey,
    directionDeg: snapshot.directionDeg,
    directionBand: snapshot.directionBand,
    directionLabel: degreeToCardinal(snapshot.directionDeg),
    periodS: snapshot.periodS,
    peakOffshoreHeightFt: snapshot.peakOffshoreHeightFt,
    peakFaceHeightFt: snapshot.peakFaceHeightFt,
    baselineFaceHeightFt: 0,
    peakEnergy: snapshot.exposure * snapshot.peakOffshoreHeightFt ** 2 * snapshot.periodS,
    baselineEnergy: 0,
    energyRatio: snapshot.energyRatio,
    exposure: snapshot.exposure,
    arrivalAt: snapshot.arrivalAt,
    peakAt: snapshot.peakAt,
    fadeAt: snapshot.fadeAt,
    peakLocalDate: getLocalDateStr(new Date(snapshot.peakAt), timezone),
  };
}

function latestPerKey(snapshots: readonly SwellEventSnapshot[]): SwellEventSnapshot[] {
  const latest = new Map<string, SwellEventSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.beachId}|${snapshot.eventKey}`;
    const current = latest.get(key);
    if (!current || Date.parse(snapshot.detectedAt) > Date.parse(current.detectedAt)) latest.set(key, snapshot);
  }
  return [...latest.values()];
}

function historyFor(
  snapshots: readonly SwellEventSnapshot[],
  beachId: string,
  eventKey: string,
): OutlookSwell['history'] {
  const byRun = new Map<string, SwellEventSnapshot>();
  for (const snapshot of snapshots) {
    if (snapshot.beachId !== beachId || snapshot.eventKey !== eventKey) continue;
    const current = byRun.get(snapshot.runDate);
    if (!current || Date.parse(snapshot.detectedAt) > Date.parse(current.detectedAt)) byRun.set(snapshot.runDate, snapshot);
  }
  return [...byRun.values()]
    .sort((left, right) => left.runDate.localeCompare(right.runDate))
    .map((snapshot) => ({
      runDate: snapshot.runDate,
      peakAt: snapshot.peakAt,
      faceHeightFt: round(snapshot.peakFaceHeightFt, 1),
      periodS: Math.round(snapshot.periodS),
    }));
}

function homeBeachFor(pool: BuildSwellOutlookInput['pool'], homeBeachId: string | null): Beach | null {
  const explicitHome = pool.find(({ beach }) => beach.id === homeBeachId)?.beach;
  if (explicitHome) return explicitHome;
  return pool.find(({ relation }) => relation === 'home')?.beach ?? null;
}

function representative(group: SwellGroup, homeBeachId: string | null): BeachSwellEvent {
  const home = group.members.find((member) => member.beachId === homeBeachId);
  if (home) return home;
  return [...group.members].sort((left, right) => (
    right.peakFaceHeightFt - left.peakFaceHeightFt || left.beachId.localeCompare(right.beachId)
  ))[0];
}

function matchNotable(rep: BeachSwellEvent, notable: readonly SwellEventSnapshot[]): SwellEventSnapshot | null {
  let best: { snapshot: SwellEventSnapshot; diff: number } | null = null;
  for (const snapshot of notable) {
    if (snapshot.beachId !== rep.beachId) continue;
    if (!tracksSwellComponent(snapshot, rep)) continue;
    if (snapshot.peakFaceHeightFt > rep.peakFaceHeightFt * SWELL_EVENT_THRESHOLDS.trackSizeRatio
      || rep.peakFaceHeightFt > snapshot.peakFaceHeightFt * SWELL_EVENT_THRESHOLDS.trackSizeRatio) continue;
    const diff = Math.abs(Date.parse(snapshot.peakAt) - Date.parse(rep.peakAt));
    if (diff <= NOTABLE_MATCH_PEAK_MS && (!best || diff < best.diff)) best = { snapshot, diff };
  }
  return best?.snapshot ?? null;
}

function assignGroupIds(
  groups: readonly SwellGroup[],
  previous: StoredOutlookList | null,
  homeBeachId: string | null,
): Array<{ group: SwellGroup; id: string }> {
  const ordered = groups.map((group) => ({
    group,
    rep: representative(group, homeBeachId),
    key: group.members.map((member) => `${member.beachId}|${member.eventKey}`).sort().join('|'),
  })).sort((left, right) => left.key.localeCompare(right.key));
  const previousEntries = previous?.swells.filter((entry) => entry.status !== 'faded') ?? [];
  const matches = ordered.flatMap((candidate) => previousEntries
    .filter((entry) => (
      angleDifference(entry.directionDeg, candidate.rep.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
      && Math.abs(Date.parse(entry.peakAt) - Date.parse(candidate.rep.peakAt)) <= NOTABLE_MATCH_PEAK_MS
      && (entry.periodS === null || Math.abs(entry.periodS - candidate.rep.periodS) <= SWELL_TRACKING_RULES.groupPeriodS)
    ))
    .map((entry) => ({
      candidate,
      id: entry.id,
      diff: Math.abs(Date.parse(entry.peakAt) - Date.parse(candidate.rep.peakAt)),
    })))
    .sort((left, right) => left.diff - right.diff
      || left.id.localeCompare(right.id)
      || left.candidate.key.localeCompare(right.candidate.key));

  const ids = new Map<SwellGroup, string>();
  const carriedIds = new Set<string>();
  for (const match of matches) {
    if (ids.has(match.candidate.group) || carriedIds.has(match.id)) continue;
    ids.set(match.candidate.group, match.id);
    carriedIds.add(match.id);
  }

  // An absent previous swell still owns its id while sticky tracking carries it.
  const usedIds = new Set([...previousEntries.map((entry) => entry.id), ...carriedIds]);
  return ordered.map(({ group }) => {
    const carriedId = ids.get(group);
    if (carriedId !== undefined) return { group, id: carriedId };
    const memberKeys = [...group.members].sort((left, right) => (
      Date.parse(left.peakAt) - Date.parse(right.peakAt) || left.eventKey.localeCompare(right.eventKey)
    )).map((member) => member.eventKey);
    const baseId = memberKeys.find((key) => !usedIds.has(key)) ?? memberKeys[0];
    let id = baseId;
    for (let suffix = 2; usedIds.has(id); suffix += 1) id = `${baseId}:${suffix}`;
    usedIds.add(id);
    return { group, id };
  });
}

function toOutlookSwell(
  group: SwellGroup,
  input: BuildSwellOutlookInput,
  beachesById: ReadonlyMap<string, Beach>,
  notableLatest: readonly SwellEventSnapshot[],
  id: string,
  runDate: string,
  homeBeachId: string | null,
): OutlookSwell | null {
  const pulse = representative(group, homeBeachId);
  const beach = beachesById.get(pulse.beachId);
  if (!beach) return null;
  const timezone = resolveBeachTimezone(beach.timezone);

  const previousRuns = input.pulseSnapshots.filter((snapshot) => (
    snapshot.beachId === pulse.beachId && snapshot.eventKey === pulse.eventKey
    && snapshot.runDate < runDate && isPreviousRun(snapshot, input.now)
  ));
  const notable = matchNotable(pulse, notableLatest);
  // A linked first sighting and its follow-up pin must describe the same detector event.
  const rep = notable ? eventFromSnapshot(notable, timezone) : pulse;
  const source = swellSourceFor({
    directionDeg: rep.directionDeg,
    periodS: Math.round(rep.periodS),
    peakAt: rep.peakAt,
    activeStorms: input.storms,
  });
  const leadHours = (Date.parse(rep.peakAt) - input.now.getTime()) / HOUR_MS;
  const peakMs = Date.parse(rep.peakAt);

  return {
    id,
    eventKey: rep.eventKey,
    tier: confidenceFor(pulse, previousRuns, input.now),
    status: Date.parse(rep.arrivalAt) <= input.now.getTime() ? 'arrived' : 'forecast',
    change: changeFor(pulse, previousRuns, input.pulseSnapshots, input.now, timezone)?.kind ?? 'new',
    arrivalAt: rep.arrivalAt,
    peakAt: rep.peakAt,
    fadeAt: rep.fadeAt ?? null,
    peakWindow: leadHours > WINDOW_LEAD_HOURS
      ? {
        from: new Date(peakMs - WINDOW_HALF_HOURS * HOUR_MS).toISOString(),
        to: new Date(peakMs + WINDOW_HALF_HOURS * HOUR_MS).toISOString(),
      }
      : null,
    faceHeightFt: faceHeightRange(rep.peakFaceHeightFt),
    periodS: Math.round(rep.periodS),
    directionDeg: Math.round(rep.directionDeg) % 360,
    directionLabel: degreeToCardinal(rep.directionDeg),
    beach: { id: beach.id, name: beach.name },
    beachCount: group.members.length,
    notable: notable !== null,
    fit: swellFitFor({ faceHeightFt: rep.peakFaceHeightFt, skillLevel: input.skillLevel, boardClasses: input.boardClasses }),
    source,
    stormName: source === 'tropical'
      ? matchStormOnBearing({ storms: input.storms, beach: { lat: beach.lat, lon: beach.lon }, directionDeg: rep.directionDeg })
      : null,
    sizeByOrientation: sizeByOrientation(group.members.map((member) => ({
      windowCenterDeg: swellWindowForBeach(beachesById.get(member.beachId) ?? {})?.centerDeg ?? null,
      faceHeightFt: member.beachId === rep.beachId ? rep.peakFaceHeightFt : member.peakFaceHeightFt,
    }))),
    history: historyFor(notable ? input.notableSnapshots : input.pulseSnapshots, rep.beachId, rep.eventKey),
  };
}

export function buildSwellOutlook(input: BuildSwellOutlookInput): BuiltSwellOutlook {
  const beachesById = new Map(input.pool.map(({ beach }) => [beach.id, beach]));
  const poolSnapshots = input.pulseSnapshots.filter((snapshot) => beachesById.has(snapshot.beachId));
  const runDate = resolveOutlookRunDate(poolSnapshots, input.now);
  const homeBeach = homeBeachFor(input.pool, input.homeBeachId);

  const events = latestPerKey(poolSnapshots.filter((snapshot) => snapshot.runDate === runDate))
    .map((snapshot) => eventFromSnapshot(snapshot, resolveBeachTimezone(beachesById.get(snapshot.beachId)?.timezone)))
    .filter((event) => isSwellEventCurrent(event, input.now));

  const notableLatest = latestPerKey(input.notableSnapshots.filter((snapshot) => snapshot.runDate === runDate));
  const groups = groupEvents(events.sort((left, right) => (
    left.eventKey.localeCompare(right.eventKey) || left.beachId.localeCompare(right.beachId)
  )));
  const current = assignGroupIds(groups, input.previous, homeBeach?.id ?? null).flatMap(({ group, id }) => {
    const swell = toOutlookSwell(group, input, beachesById, notableLatest, id, runDate, homeBeach?.id ?? null);
    return swell ? [swell] : [];
  });

  const carried = carryOverSwells({
    previous: input.previous,
    current,
    forecastsByBeach: input.forecastsByBeach,
    beachesById: new Map(input.pool.map(({ beach }) => [beach.id, { ...toSwellEventBeach(beach), timezone: beach.timezone }])),
    skillLevel: input.skillLevel,
    boardClasses: input.boardClasses,
    now: input.now,
  });

  const swells = [...current, ...carried].sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
  return {
    response: {
      generatedAt: input.now.toISOString(),
      runDate,
      horizonDays: SWELL_OUTLOOK_HORIZON_DAYS,
      homeBeach: homeBeach ? { id: homeBeach.id, name: homeBeach.name } : null,
      swells,
    },
    list: { runDate, swells },
  };
}
