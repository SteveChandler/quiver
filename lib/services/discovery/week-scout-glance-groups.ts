import { localDayDiff } from "@/lib/alerts/swell-events/regional-rating";
import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { COMPASS, directionIndex, periodClass, type RegionalSwellEvent } from "./week-scout-story-candidates";
import type { CandidateFacts } from "./week-scout-story-facts";
import { getLocalDateStr } from "./window-selector/time-slot-utils";

export const GROUP_PEAK_WINDOW_MS = 36 * 60 * 60 * 1000;
export const GROUP_DIRECTION_DEG = 45;
/** Local days 0–14 from today, the span the Swell Watch strip can show. */
export const STRIP_DAYS = 15;

export type GlanceNoun = "groundswell" | "mid-period swell" | "windswell" | "storm swell" | "swell";

export interface GlanceGroup {
  /** Anchor first, then by peak. */
  events: RegionalSwellEvent[];
  /** The biggest event; names the group. */
  lead: RegionalSwellEvent;
  label: string;
  noun: GlanceNoun;
  /** The earliest member arrival. */
  arrivalAt: string;
  arrivalDate: string;
  /** The anchor's peak, not the lead's: the group lands when its first swell peaks. */
  peakAt: string;
  peakDate: string;
  fadeDate: string | null;
  confidence: RegionalSwellEvent["confidence"];
  facts: CandidateFacts | null;
}

const CONFIDENCE_RANK: Record<RegionalSwellEvent["confidence"], number> = { on_the_radar: 0, likely: 1, locked: 2 };
const CLASS_NOUN: Record<ReturnType<typeof periodClass>, GlanceNoun> = { long: "groundswell", mid: "mid-period swell", short: "windswell" };

function localDate(at: string, timezone: string): string {
  return getLocalDateStr(new Date(at), timezone);
}

export function onGlanceStrip(event: { arrivalAt: string | null; peakAt: string; fadeAt: string | null }, today: string, timezone: string): boolean {
  const startDay = localDayDiff(today, localDate(event.arrivalAt ?? event.peakAt, timezone));
  const endDay = localDayDiff(today, localDate(event.fadeAt ?? event.peakAt, timezone));
  return startDay <= STRIP_DAYS - 1 && endDay >= 0;
}

function nounFor(events: readonly RegionalSwellEvent[]): GlanceNoun {
  const [first] = events;
  const uniform = events.every((event) => event.kind === first.kind && periodClass(event.periodS) === periodClass(first.periodS));
  if (!uniform) return "swell";
  if (first.kind === "storm") return "storm swell";
  return CLASS_NOUN[periodClass(first.periodS)];
}

/** Lead facts, with the standout range and words taken together from the one member with the biggest standout. */
function groupFacts(events: readonly RegionalSwellEvent[], lead: RegionalSwellEvent,
  factsFor: (event: RegionalSwellEvent) => CandidateFacts | null): CandidateFacts | null {
  const leadFacts = factsFor(lead);
  if (!leadFacts) return null;
  let standout: CandidateFacts | null = null;
  for (const event of events) {
    const facts = factsFor(event);
    if (!facts?.standoutFt) continue;
    if (!standout?.standoutFt || facts.standoutFt.max > standout.standoutFt.max) standout = facts;
  }
  if (!standout?.standoutFt) return leadFacts;
  // Both standout fields leave the lead, so its words never sit beside another event's range.
  const { standoutFt: _standoutFt, standoutSizes: _standoutSizes, ...rest } = leadFacts;
  return { ...rest, standoutFt: standout.standoutFt, ...(standout.standoutSizes ? { standoutSizes: standout.standoutSizes } : {}) };
}

export function groupGlanceEvents(events: readonly RegionalSwellEvent[], timezone: string,
  factsFor: (event: RegionalSwellEvent) => CandidateFacts | null): GlanceGroup[] {
  const faceMax = (event: RegionalSwellEvent): number => factsFor(event)?.faceFt?.max ?? -1;
  const sorted = [...events].sort((a, b) => Date.parse(a.peakAt) - Date.parse(b.peakAt) || faceMax(b) - faceMax(a));
  const grouped = new Set<RegionalSwellEvent>();
  const groups: GlanceGroup[] = [];
  for (const anchor of sorted) {
    if (grouped.has(anchor)) continue;
    const anchorPeakMs = Date.parse(anchor.peakAt);
    // Members join on distance from the anchor alone, so a group never chains past 36 h.
    const members = sorted.filter((event) => event === anchor || (!grouped.has(event)
      && Date.parse(event.peakAt) - anchorPeakMs >= 0
      && Date.parse(event.peakAt) - anchorPeakMs <= GROUP_PEAK_WINDOW_MS
      && angleDifference(event.directionDeg, anchor.directionDeg) <= GROUP_DIRECTION_DEG));
    for (const member of members) grouped.add(member);
    const lead = [...members].sort((a, b) => faceMax(b) - faceMax(a) || b.periodS - a.periodS
      || Date.parse(a.peakAt) - Date.parse(b.peakAt))[0];
    const arrivalAt = new Date(Math.min(...members.map((event) => Date.parse(event.arrivalAt)))).toISOString();
    const fades = members.flatMap((event) => event.fadeAt ? [Date.parse(event.fadeAt)] : []);
    groups.push({
      events: members,
      lead,
      label: COMPASS[directionIndex(lead.directionDeg)],
      noun: nounFor(members),
      arrivalAt,
      arrivalDate: localDate(arrivalAt, timezone),
      peakAt: anchor.peakAt,
      peakDate: localDate(anchor.peakAt, timezone),
      fadeDate: fades.length > 0 ? localDate(new Date(Math.max(...fades)).toISOString(), timezone) : null,
      confidence: members.reduce((low, event) => CONFIDENCE_RANK[event.confidence] < CONFIDENCE_RANK[low] ? event.confidence : low, anchor.confidence),
      facts: groupFacts(members, lead, factsFor),
    });
  }
  return groups;
}
