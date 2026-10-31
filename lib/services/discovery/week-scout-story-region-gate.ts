import { exposureFactor, exposureLabel, swellWindowForBeach } from "@/lib/alerts/swell-events/exposure";
import type { RatingRow, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { ratingWindow } from "@/lib/alerts/swell-events/regional-rating";
import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";
import { parseWindSpeedOrNull } from "@/lib/utils/number-parsing";
import { localDate } from "./swell-briefing-input";
import { directionIndex, directionSector, periodBand, periodClass, storyEventKey, storyEventsFromRegion, type RegionalSwellEvent } from "./week-scout-story-candidates";
import { beachDayFactsFromBuild, eventFactsFromBuild, LIGHT_WIND_MPH, type CandidateFacts } from "./week-scout-story-facts";
import type { StoryGate } from "./week-scout-story-types";

type BeachGate = Extract<StoryGate, { kind: "beach" }>;
type Exposure = BeachGate["exposure"];
type Facing = NonNullable<BeachGate["facing"]>;
type Wind = BeachGate["wind"];

/** The region build as story gates read it, keyed by story event key. */
export interface RegionGateContext {
  /** Every forecast event in the build, chronological. */
  events: RegionalSwellEvent[];
  exposure(regionalEventKey: string, beachId: string): Exposure | null;
  /** How squarely an open beach faces the event; null for a partial or shadowed beach, or one without a window. */
  facing(regionalEventKey: string, beachId: string): Facing | null;
  wind(regionalEventKey: string, beachId: string, localDate: string): Wind | null;
  eventFacts(regionalEventKey: string): CandidateFacts | null;
  beachDayFacts(regionalEventKey: string, beachId: string, localDate: string): CandidateFacts | null;
}

const CONFIDENCE_RANK = { on_the_radar: 0, likely: 1, locked: 2 } as const;
/** Mean wind under this is "light", under BREEZY_WIND_MPH "breezy", otherwise "windy". */
export { LIGHT_WIND_MPH } from "./week-scout-story-facts";
export const BREEZY_WIND_MPH = 15;
/**
 * An open beach faces a swell "direct" (dead on) when it comes from within this many degrees of the
 * swell window's centre, and within DEAD_ON_WINDOW_SHARE of the window's half-width; otherwise "angled".
 * The angle off the centre, not the exposure factor: the factor is 1 anywhere inside a window, and San
 * Diego's windows run a median 105° either side of centre.
 */
export const DEAD_ON_MAX_DEG = 22.5;
export const DEAD_ON_WINDOW_SHARE = 0.5;

function eventDate(at: string, timezone: string): string {
  return localDate(new Date(at), timezone);
}

/** The bucket for a beach's mean wind over rows in [startMs, endMs); null when none of them has a wind speed. */
export function windBucket(rows: readonly RatingRow[], startMs: number, endMs: number): Wind | null {
  const speeds = rows.flatMap((row) => {
    const atMs = Date.parse(row.forecast_at);
    const mph = atMs >= startMs && atMs < endMs ? parseWindSpeedOrNull(row.wind_speed) : null;
    return mph === null ? [] : [mph];
  });
  if (speeds.length === 0) return null;
  const mean = speeds.reduce((sum, mph) => sum + mph, 0) / speeds.length;
  return mean < LIGHT_WIND_MPH ? "light" : mean < BREEZY_WIND_MPH ? "breezy" : "windy";
}

export function buildRegionGateContext(build: RegionBuild, editionDate: string): RegionGateContext {
  const { all } = storyEventsFromRegion(build, editionDate);
  // The first event under a key, as buildStoryCandidates keeps the first.
  const byKey = new Map<string, RegionalSwellEvent>();
  for (const event of all) {
    const key = storyEventKey(event);
    if (!byKey.has(key)) byKey.set(key, event);
  }
  const beaches = new Map(build.beaches.map((beach) => [beach.id, beach]));
  const eventFactsCache = new Map<string, CandidateFacts | null>();
  const beachDayFactsCache = new Map<string, CandidateFacts | null>();
  const sighting = (regionalEventKey: string, beachId: string) => {
    const event = byKey.get(regionalEventKey);
    const beach = beaches.get(beachId);
    const window = beach ? swellWindowForBeach(beach) : null;
    if (!event || !window) return null;
    const factor = exposureFactor(event.directionDeg, window);
    return factor === null ? null : { event, window, exposure: exposureLabel(factor) };
  };
  return {
    events: all,
    exposure(regionalEventKey, beachId) {
      return sighting(regionalEventKey, beachId)?.exposure ?? null;
    },
    facing(regionalEventKey, beachId) {
      const seen = sighting(regionalEventKey, beachId);
      if (!seen || seen.exposure !== "open") return null;
      const offset = angleDifference(seen.event.directionDeg, seen.window.centerDeg);
      return offset <= Math.min(DEAD_ON_MAX_DEG, seen.window.halfWidthDeg * DEAD_ON_WINDOW_SHARE) ? "direct" : "angled";
    },
    eventFacts(regionalEventKey) {
      if (eventFactsCache.has(regionalEventKey)) return eventFactsCache.get(regionalEventKey) ?? null;
      const event = byKey.get(regionalEventKey);
      const facts = event ? eventFactsFromBuild(build, event) : null;
      eventFactsCache.set(regionalEventKey, facts);
      return facts;
    },
    beachDayFacts(regionalEventKey, beachId, date) {
      const cacheKey = JSON.stringify([regionalEventKey, beachId, date]);
      if (beachDayFactsCache.has(cacheKey)) return beachDayFactsCache.get(cacheKey) ?? null;
      const event = byKey.get(regionalEventKey);
      const facts = event ? beachDayFactsFromBuild(build, event, beachId, date) : null;
      beachDayFactsCache.set(cacheKey, facts);
      return facts;
    },
    wind(regionalEventKey, beachId, date) {
      const event = byKey.get(regionalEventKey);
      if (!event) return null;
      // Rating rows are daylight rows in any event's window; keep this event's.
      const { startMs, endMs } = ratingWindow(event);
      const rows = (build.rowsByBeach[beachId] ?? []).filter((row) => {
        const atMs = Date.parse(row.forecast_at);
        if (!Number.isFinite(atMs) || atMs < startMs || atMs >= endMs) return false;
        return getLocalDateStr(new Date(atMs), build.timezone) === date;
      });
      return windBucket(rows, startMs, endMs);
    },
  };
}

/** The sentence's event is still in the build with the same days, words, confidence and reach. */
function swellHolds(gate: Extract<StoryGate, { kind: "swell" }>, events: readonly RegionalSwellEvent[]): boolean {
  return events.some((event) => storyEventKey(event) === gate.regionalEventKey
    && directionSector(event.directionDeg) === gate.directionSector
    && periodBand(event.periodS) === gate.periodBand
    && (gate.directionIndex === undefined || directionIndex(event.directionDeg) === gate.directionIndex)
    && (gate.periodClass === undefined || periodClass(event.periodS) === gate.periodClass)
    && eventDate(event.arrivalAt, event.timezone) === gate.arrivalLocalDate
    && eventDate(event.peakAt, event.timezone) === gate.peakLocalDate
    // A null fade claims no fade day: cover and lead name none.
    && (gate.fadeLocalDate === null || (event.fadeAt !== null && eventDate(event.fadeAt, event.timezone) === gate.fadeLocalDate))
    && CONFIDENCE_RANK[event.confidence] >= CONFIDENCE_RANK[gate.confidence]
    && event.minimumBeaches >= gate.minimumBeaches);
}

/** Every beach the sentence names still sits as it says, and enough of them at the claimed exposure. */
function exposureHolds(gate: Extract<StoryGate, { kind: "exposure" }>, region: RegionGateContext): boolean {
  const event = region.events.find((item) => storyEventKey(item) === gate.regionalEventKey);
  if (!event || directionSector(event.directionDeg) !== gate.directionSector) return false;
  const named = gate.beaches ?? [];
  if (named.length === 0) return false;
  return named.every((claim) => region.exposure(gate.regionalEventKey, claim.beachId) === claim.exposure)
    && named.filter((claim) => claim.exposure === gate.exposure).length >= gate.minimumBeaches;
}

/**
 * The beach line's event (the first under its key, as the context reads it) still has the direction and
 * period class the line names, and the beach still sits and faces as it says, in the same wind.
 */
function beachHolds(gate: BeachGate, region: RegionGateContext): boolean {
  const event = region.events.find((item) => storyEventKey(item) === gate.regionalEventKey);
  if (!event) return false;
  return directionIndex(event.directionDeg) === gate.directionIndex
    && periodClass(event.periodS) === gate.periodClass
    && region.exposure(gate.regionalEventKey, gate.beachId) === gate.exposure
    && region.facing(gate.regionalEventKey, gate.beachId) === gate.facing
    && region.wind(gate.regionalEventKey, gate.beachId, gate.localDate) === gate.wind;
}

/** A quiet week can't stand while the region build has an event arriving or peaking on one of its days. */
function quietRefused(gate: Extract<StoryGate, { kind: "quiet" }>, events: readonly RegionalSwellEvent[]): boolean {
  return events.some((event) => gate.completeDates.includes(eventDate(event.arrivalAt, event.timezone))
    || gate.completeDates.includes(eventDate(event.peakAt, event.timezone)));
}

/**
 * Checks a swell, exposure or beach claim against the region build, and refuses a quiet week it has
 * an event in; null for what the live Week Scout response proves instead, including a quiet week the
 * build leaves to it.
 */
export function regionGateHolds(gate: StoryGate, region: RegionGateContext): boolean | null {
  switch (gate.kind) {
    case "swell": return swellHolds(gate, region.events);
    case "exposure": return exposureHolds(gate, region);
    case "beach": return beachHolds(gate, region);
    case "quiet": return quietRefused(gate, region.events) ? false : null;
    case "origin":
    case "wind":
    case "wind_pattern":
    case "tide":
    case "change":
    case "day_surf":
    case "day":
      return null;
  }
}
