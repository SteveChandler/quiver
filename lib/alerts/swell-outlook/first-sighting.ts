import type { TideAwareWindowResult } from '@/lib/alerts/surf-window/tide-aware-window';
import { formatWindowLabel } from '@/lib/notifications/copy/daily-call-copy';
import type { Tier } from '@/lib/alerts/entitlements';
import { buildSwellShareUrl, getSwellCardHeadline } from '@/lib/notifications/copy/swell-card-headline';
import {
  MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  parseMajorSwellNotificationPayload,
  type MajorSwellNotificationPayload,
} from '@/lib/notifications/types/major-swell';
import type { OutlookSwell } from '@/lib/services/discovery/swell-outlook-types';
import { getLocalDateString, getLocalHour } from '@/lib/utils/timezone-utils';

const SERIOUS_FACE_HEIGHT_FT = 8;
/** Android shows the full text when expanded; iOS shows about four lines and the rest on long-press. */
export const FIRST_SIGHTING_BODY_MAX_CHARS = 300;

export type FirstSightingHazard = 'high_surf' | 'high_rip_current' | 'tropical_cyclone';

const HAZARD_SENTENCES: Record<FirstSightingHazard, string> = {
  high_surf: 'NWS high surf advisory in effect.',
  high_rip_current: 'NWS beach hazards statement out for rip currents.',
  tropical_cyclone: 'NWS tropical storm alert in effect.',
};

/** Listed for the first time and in range for this user, biggest first; sticky and arrived entries never push. */
export function selectFirstSightingCandidates(args: {
  swells: readonly OutlookSwell[];
  homeBeachId: string | null;
  tier: Tier;
  /** Distance from the user's last location (or home beach) to each beach; closer wins a size tie. */
  distanceKmByBeach?: ReadonlyMap<string, number>;
}): OutlookSwell[] {
  const distance = (swell: OutlookSwell): number => args.distanceKmByBeach?.get(swell.beach.id) ?? Number.POSITIVE_INFINITY;
  return args.swells
    .filter((swell) => swell.status === 'forecast' && swell.firstSightingEligible !== false && swell.fit.status === 'in_range' && swell.periodS !== null)
    .filter((swell) => args.tier !== 'free' || (args.homeBeachId !== null && swell.beach.id === args.homeBeachId))
    .sort((left, right) => (right.faceHeightFt.max - left.faceHeightFt.max)
      || (distance(left) - distance(right))
      || (Date.parse(left.peakAt) - Date.parse(right.peakAt)));
}

export function firstSightingFaceHeightFt(swell: OutlookSwell): number {
  return Math.round(((swell.faceHeightFt.min + swell.faceHeightFt.max) / 2) * 10) / 10;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function weekday(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function dayPart(iso: string, timezone: string): string {
  const hour = getLocalHour(new Date(iso), timezone);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function sourcePhrase(swell: OutlookSwell): string {
  switch (swell.source) {
    case 'southern_hemisphere': return ' from the southern hemisphere';
    case 'north_pacific': return ' from the North Pacific';
    case 'tropical': return swell.stormName ? ` from tropical storm ${swell.stormName}` : ' from the tropics';
    default: return '';
  }
}

function shortWeekday(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(new Date(iso));
}

/** "Tue-Fri" from arrival to fade; a swell with no fade time is named by its arrival and peak days. */
function daySpan(swell: OutlookSwell, timezone: string): string {
  const start = swell.arrivalAt ?? swell.peakAt;
  const end = swell.fadeAt && Date.parse(swell.fadeAt) > Date.parse(swell.peakAt) ? swell.fadeAt : swell.peakAt;
  const from = shortWeekday(start, timezone);
  const to = shortWeekday(end, timezone);
  return from === to ? from : `${from}-${to}`;
}

/** Facts, not a title pool: direction, the days it is in the water and how big the sets get. */
export function renderFirstSightingTitle(swell: OutlookSwell, timezone: string): string {
  return `${swell.directionLabel} swell ${daySpan(swell, timezone)}, sets to ${formatNumber(swell.faceHeightFt.max)} ft`;
}

function timingSentence(swell: OutlookSwell, timezone: string): string {
  const peakDate = getLocalDateString(new Date(swell.peakAt), timezone);
  const peak = `peaks ${weekday(peakDate)} ${dayPart(swell.peakAt, timezone)}`;
  if (!swell.arrivalAt) return `${peak[0].toUpperCase()}${peak.slice(1)}.`;
  const arrivalDate = getLocalDateString(new Date(swell.arrivalAt), timezone);
  if (arrivalDate === peakDate) {
    const arrivalPart = dayPart(swell.arrivalAt, timezone);
    if (arrivalPart === dayPart(swell.peakAt, timezone)) return `${peak[0].toUpperCase()}${peak.slice(1)}.`;
    return `Fills in ${weekday(arrivalDate)} ${arrivalPart}, ${peak}.`;
  }
  return `Builds from ${weekday(arrivalDate)}, ${peak}.`;
}

function orientationSentence(swell: OutlookSwell): string | null {
  const { westFacing, southFacing } = swell.sizeByOrientation;
  if (westFacing && southFacing) {
    return `West-facing spots up to ${formatNumber(westFacing.max)} ft, south-facing up to ${formatNumber(southFacing.max)} ft.`;
  }
  return null;
}

/**
 * Reads like a short swell report: what is coming, when, how big and where, then anything official.
 * Lower-priority sentences drop first so the text never runs past what a notification can carry.
 */
export function renderFirstSightingBody(args: {
  swell: OutlookSwell;
  timezone: string;
  hazard: FirstSightingHazard | null;
  surfWindow?: TideAwareWindowResult;
}): string {
  const { swell, timezone, hazard } = args;
  const recommendedWindow = args.surfWindow?.state === 'recommended' ? args.surfWindow.window : null;
  const period = swell.periodS === null ? '' : `, ${formatNumber(swell.periodS)}s`;
  const sentences: Array<{ text: string; priority: number }> = [
    { text: `${swell.directionLabel} swell${sourcePhrase(swell)}${period}.`, priority: 0 },
    { text: timingSentence(swell, timezone), priority: recommendedWindow ? 2 : 0 },
    { text: `Sets up to ${formatNumber(swell.faceHeightFt.max)} ft at ${swell.beach.name}.`, priority: 0 },
  ];
  if (recommendedWindow) {
    const { start, end, timezone: beachTimezone } = recommendedWindow;
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: beachTimezone }).format(new Date(start));
    sentences.push({ text: `Best window ${day} ${formatWindowLabel(start, end, beachTimezone)}.`, priority: 0 });
    const reasons = args.surfWindow?.reasons ?? [];
    if (reasons.includes('better_tide_before_peak') || reasons.includes('better_tide_after_peak')) {
      const high = reasons.includes('high_tide_outside_preference');
      const before = reasons.includes('better_tide_before_peak');
      const text = high
        ? before ? 'Swell peaks at high tide; go before it fills in.' : 'Swell peaks at high tide; go as it drops.'
        : before ? 'Swell peaks at low tide; go before it drops.' : 'Swell peaks at low tide; go as it fills in.';
      sentences.push({ text, priority: 1 });
    }
  }
  const orientation = orientationSentence(swell);
  if (orientation) sentences.push({ text: orientation, priority: 2 });
  if (swell.fit.boards.length === 1) sentences.push({ text: `Good size for your ${swell.fit.boards[0]}.`, priority: 3 });
  if (swell.beachCount > 1) sentences.push({ text: `Showing at ${swell.beachCount} nearby breaks.`, priority: 4 });
  if (hazard) sentences.push({ text: HAZARD_SENTENCES[hazard], priority: 1 });

  const kept = [...sentences];
  const length = (): number => kept.map(({ text }) => text).join(' ').length;
  while (length() > FIRST_SIGHTING_BODY_MAX_CHARS) {
    const lowest = kept.reduce((worst, entry, index) => (entry.priority > kept[worst].priority ? index : worst), 0);
    if (kept[lowest].priority === 0) break;
    kept.splice(lowest, 1);
  }
  return kept.map(({ text }) => text).join(' ');
}

/** Plain facts only: a modest swell must not borrow the rarity titles written for the evening-before alert. */
export function buildFirstSightingPayload(args: {
  swell: OutlookSwell;
  timezone: string;
  hazard?: FirstSightingHazard | null;
  surfWindow?: TideAwareWindowResult;
}): MajorSwellNotificationPayload {
  const { swell, timezone } = args;
  const faceHeightFt = firstSightingFaceHeightFt(swell);
  const serious = faceHeightFt >= SERIOUS_FACE_HEIGHT_FT;
  const peakDate = getLocalDateString(new Date(swell.peakAt), timezone);
  const peakDayLabel = weekday(peakDate);
  const headline = getSwellCardHeadline({
    kind: 'coming',
    eventKey: swell.eventKey,
    beachName: swell.beach.name,
    peakDayLabel,
    serious,
  });
  const body = renderFirstSightingBody({ swell, timezone, hazard: args.hazard ?? null, surfWindow: args.surfWindow });
  return parseMajorSwellNotificationPayload({
    schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
    beach_id: swell.beach.id,
    beach_name: swell.beach.name,
    event_start_date: getLocalDateString(new Date(swell.arrivalAt ?? swell.peakAt), timezone),
    peak_date: peakDate,
    peak_height_ft: faceHeightFt,
    peak_period_s: swell.periodS ?? 1,
    forecast_at: swell.peakAt,
    awareness_mode: 'shadow',
    automation_enabled: false,
    awareness_signal: 'forecast_trend',
    awareness_severity: serious ? 'major' : 'significant',
    official_evidence_refs: [],
    would_suppress_cohorts: ['beginner', 'intermediate', 'unknown'],
    enforcement: null,
    title: renderFirstSightingTitle(swell, timezone),
    body,
    ...(args.surfWindow ? { surf_window: {
      state: args.surfWindow.state,
      start: args.surfWindow.window?.start ?? null,
      end: args.surfWindow.window?.end ?? null,
      local_date: args.surfWindow.window?.localDate ?? null,
      timezone: args.surfWindow.window?.timezone ?? null,
      reasons: args.surfWindow.reasons,
    } } : {}),
    beaches: [{ beach_id: swell.beach.id, beach_name: swell.beach.name, rank: 1 }],
    event_key: swell.eventKey,
    title_id: headline.titleId,
    kind: 'coming',
    share_url: buildSwellShareUrl(swell.eventKey, 'coming', headline.titleId),
  });
}
