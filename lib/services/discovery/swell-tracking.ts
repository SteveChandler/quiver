import {
  SWELL_EVENT_THRESHOLDS,
  type BeachSwellEvent,
  type SwellEventSnapshot,
} from '@/lib/alerts/swell-events';
import { angleDifference } from '@/lib/domains/shared/angle-utils';
import { getLocalDateStr, getLocalHour } from '@/lib/services/discovery/window-selector/time-slot-utils';

const HOUR_MS = 60 * 60 * 1000;

export const SWELL_TRACKING_RULES = {
  groupPeakHours: 36,
  groupPeriodS: 3,
  previousRunMinAgeHours: 18,
  stablePeakHours: 12,
  stableHeightRatio: 0.3,
  changeHeightRatio: 0.15,
  changePeakHours: 6,
  lockedLeadHours: 36,
  likelyLeadHours: 120,
} as const;

export type SwellConfidence = 'on_the_radar' | 'likely' | 'locked';
export type SwellChangeKind = 'new' | 'upgraded' | 'downgraded' | 'earlier' | 'later' | 'steady';

export interface SwellChange {
  kind: SwellChangeKind;
  comparedToIssuedAt: string;
  previousPeakOffshoreHeightFt: number | null;
  previousPeakAt: string | null;
  summary: string;
}

export interface SwellGroup {
  lead: BeachSwellEvent;
  members: BeachSwellEvent[];
}

export function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function hoursBetween(left: string, right: string): number {
  return Math.abs(Date.parse(left) - Date.parse(right)) / HOUR_MS;
}

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();
function weekdayName(date: Date, timezone: string): string {
  let formatter = weekdayFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone });
    weekdayFormatters.set(timezone, formatter);
  }
  return formatter.format(date);
}

type PartOfDay = 'early' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

// Same boundaries and wording as native's formatSwellPeakWhen, so the card
// title and this text never name different parts of the day for one peak.
function partOfDay(hour: number): PartOfDay {
  if (hour < 5) return 'early';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export function whenPhrase(iso: string, timezone: string, now: Date): string {
  const date = new Date(iso);
  const part = partOfDay((getLocalHour(date, timezone) ?? 12) % 24);
  const days = Math.round(
    (Date.parse(`${getLocalDateStr(date, timezone)}T12:00:00Z`)
      - Date.parse(`${getLocalDateStr(now, timezone)}T12:00:00Z`)) / (24 * HOUR_MS),
  );
  if (days === 0) {
    if (part === 'early') return 'early this morning';
    if (part === 'night') return 'tonight';
    return part === 'midday' ? 'midday today' : `this ${part}`;
  }
  const day = days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : weekdayName(date, timezone);
  if (part === 'early') return `early ${day} morning`;
  if (part === 'night' && days === -1) return 'last night';
  return `${day} ${part}`;
}

export function formatNumber(value: number): string {
  return String(round(value, 1));
}

export function groupEvents(events: readonly BeachSwellEvent[]): SwellGroup[] {
  const groups: SwellGroup[] = [];
  // Highest energy first, so each group's first member is its lead.
  for (const event of [...events].sort((left, right) => right.peakEnergy - left.peakEnergy)) {
    // Angle, not band: one swell at 200° and 205° must not split into S and SW cards.
    const group = groups.find((candidate) => (
      angleDifference(candidate.lead.directionDeg, event.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
      && hoursBetween(candidate.lead.peakAt, event.peakAt) <= SWELL_TRACKING_RULES.groupPeakHours
      && Math.abs(candidate.lead.periodS - event.periodS) <= SWELL_TRACKING_RULES.groupPeriodS
      && !candidate.members.some((member) => member.beachId === event.beachId)
    ));
    if (group) group.members.push(event);
    else groups.push({ lead: event, members: [event] });
  }
  return groups;
}

export function isPreviousRun(snapshot: SwellEventSnapshot, now: Date): boolean {
  return now.getTime() - Date.parse(snapshot.detectedAt) >= SWELL_TRACKING_RULES.previousRunMinAgeHours * HOUR_MS;
}

export function confidenceFor(
  lead: BeachSwellEvent,
  previousRuns: readonly SwellEventSnapshot[],
  now: Date,
): SwellConfidence {
  const leadHours = (Date.parse(lead.peakAt) - now.getTime()) / HOUR_MS;
  const stable = previousRuns.some((snapshot) => (
    hoursBetween(snapshot.peakAt, lead.peakAt) <= SWELL_TRACKING_RULES.stablePeakHours
    && Math.abs(lead.peakOffshoreHeightFt - snapshot.peakOffshoreHeightFt)
      <= SWELL_TRACKING_RULES.stableHeightRatio * snapshot.peakOffshoreHeightFt
  ));
  if (leadHours <= SWELL_TRACKING_RULES.lockedLeadHours) return stable ? 'locked' : 'likely';
  if (leadHours <= SWELL_TRACKING_RULES.likelyLeadHours) return stable ? 'likely' : 'on_the_radar';
  return 'on_the_radar';
}

function sincePhrase(issuedAt: string, now: Date, timezone: string): string {
  const ageHours = (now.getTime() - Date.parse(issuedAt)) / HOUR_MS;
  return ageHours < 42 ? 'yesterday' : weekdayName(new Date(issuedAt), timezone);
}

export function changeFor(
  lead: BeachSwellEvent,
  previousRuns: readonly SwellEventSnapshot[],
  allSnapshots: readonly SwellEventSnapshot[],
  now: Date,
  timezone: string,
): SwellChange | null {
  const previous = [...previousRuns].sort((left, right) => Date.parse(right.detectedAt) - Date.parse(left.detectedAt))[0];
  if (!previous) {
    // "New" needs proof an earlier run looked and did not see it.
    const earlierRun = allSnapshots
      .filter((snapshot) => isPreviousRun(snapshot, now))
      .sort((left, right) => Date.parse(right.detectedAt) - Date.parse(left.detectedAt))[0];
    if (!earlierRun) return null;
    const since = sincePhrase(earlierRun.detectedAt, now, timezone);
    return {
      kind: 'new',
      comparedToIssuedAt: earlierRun.detectedAt,
      previousPeakOffshoreHeightFt: null,
      previousPeakAt: null,
      summary: `Not in ${since}'s forecast`,
    };
  }

  const since = sincePhrase(previous.detectedAt, now, timezone);
  const heightChange = (lead.peakOffshoreHeightFt - previous.peakOffshoreHeightFt) / previous.peakOffshoreHeightFt;
  const peakShiftHours = (Date.parse(lead.peakAt) - Date.parse(previous.peakAt)) / HOUR_MS;
  const base = {
    comparedToIssuedAt: previous.detectedAt,
    previousPeakOffshoreHeightFt: round(previous.peakOffshoreHeightFt, 1),
    previousPeakAt: previous.peakAt,
  };
  if (heightChange >= SWELL_TRACKING_RULES.changeHeightRatio) {
    return { ...base, kind: 'upgraded', summary: `Up from ${formatNumber(previous.peakOffshoreHeightFt)} ft since ${since}` };
  }
  if (heightChange <= -SWELL_TRACKING_RULES.changeHeightRatio) {
    return { ...base, kind: 'downgraded', summary: `Down from ${formatNumber(previous.peakOffshoreHeightFt)} ft since ${since}` };
  }
  if (Math.abs(peakShiftHours) >= SWELL_TRACKING_RULES.changePeakHours) {
    return {
      ...base,
      kind: peakShiftHours < 0 ? 'earlier' : 'later',
      summary: `Peak moved to ${whenPhrase(lead.peakAt, timezone, now)}`,
    };
  }
  return { ...base, kind: 'steady', summary: `Holding steady since ${since}` };
}
