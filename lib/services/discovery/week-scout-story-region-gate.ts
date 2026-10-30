import { exposureFactor, exposureLabel, swellWindowForBeach } from "@/lib/alerts/swell-events/exposure";
import type { RegionBuild } from "@/lib/alerts/swell-events/regional";
import { ratingWindow } from "@/lib/alerts/swell-events/regional-rating";
import { parseWindSpeedOrNull } from "@/lib/utils/number-parsing";
import { localDate } from "./swell-briefing-input";
import { directionIndex, directionSector, periodBand, periodClass, storyEventKey, storyEventsFromRegion, type RegionalSwellEvent } from "./week-scout-story-candidates";
import type { StoryGate } from "./week-scout-story-types";

type Exposure = "open" | "partial" | "shadowed";
type Wind = "light" | "breezy" | "windy";

/** The region build as story gates read it, keyed by story event key. */
export interface RegionGateContext {
  /** Every forecast event in the build, chronological. */
  events: RegionalSwellEvent[];
  exposure(regionalEventKey: string, beachId: string): Exposure | null;
  wind(regionalEventKey: string, beachId: string): Wind | null;
}

const CONFIDENCE_RANK = { on_the_radar: 0, likely: 1, locked: 2 } as const;
const LIGHT_WIND_MPH = 8;
const BREEZY_WIND_MPH = 15;

function eventDate(at: string, timezone: string): string {
  return localDate(new Date(at), timezone);
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
  return {
    events: all,
    exposure(regionalEventKey, beachId) {
      const event = byKey.get(regionalEventKey);
      const beach = beaches.get(beachId);
      if (!event || !beach) return null;
      const factor = exposureFactor(event.directionDeg, swellWindowForBeach(beach));
      return factor === null ? null : exposureLabel(factor);
    },
    wind(regionalEventKey, beachId) {
      const event = byKey.get(regionalEventKey);
      if (!event) return null;
      // Rating rows are daylight rows in any event's window; keep this event's.
      const { startMs, endMs } = ratingWindow(event);
      const speeds = (build.rowsByBeach[beachId] ?? []).flatMap((row) => {
        const atMs = Date.parse(row.forecast_at);
        const mph = atMs >= startMs && atMs < endMs ? parseWindSpeedOrNull(row.wind_speed) : null;
        return mph === null ? [] : [mph];
      });
      if (speeds.length === 0) return null;
      const mean = speeds.reduce((sum, mph) => sum + mph, 0) / speeds.length;
      return mean < LIGHT_WIND_MPH ? "light" : mean < BREEZY_WIND_MPH ? "breezy" : "windy";
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
    case "beach": return region.exposure(gate.regionalEventKey, gate.beachId) === gate.exposure
      && region.wind(gate.regionalEventKey, gate.beachId) === gate.wind;
    case "quiet": return quietRefused(gate, region.events) ? false : null;
    case "origin":
    case "wind":
    case "wind_pattern":
    case "tide":
    case "change":
    case "day":
      return null;
  }
}
