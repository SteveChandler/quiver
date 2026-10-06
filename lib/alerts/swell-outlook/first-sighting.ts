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

/** Listed for the first time and in range for this user; sticky and arrived entries never push. */
export function selectFirstSightingCandidates(args: {
  swells: readonly OutlookSwell[];
  homeBeachId: string | null;
  tier: Tier;
}): OutlookSwell[] {
  return args.swells
    .filter((swell) => swell.status === 'forecast' && swell.firstSightingEligible !== false && swell.fit.status === 'in_range' && swell.periodS !== null)
    .filter((swell) => args.tier !== 'free' || (args.homeBeachId !== null && swell.beach.id === args.homeBeachId))
    .sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
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

/** Plain facts only: a modest swell must not borrow the rarity titles written for the evening-before alert. */
export function buildFirstSightingPayload(args: { swell: OutlookSwell; timezone: string }): MajorSwellNotificationPayload {
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
  const board = swell.fit.boards.length === 1 ? ` Good size for your ${swell.fit.boards[0]}.` : '';
  const body = `${swell.directionLabel} swell, ${formatNumber(faceHeightFt)}ft @ ${formatNumber(swell.periodS ?? 0)}s, `
    + `peaks ${peakDayLabel} ${dayPart(swell.peakAt, timezone)}.${board}`;
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
    title: headline.headline,
    body,
    beaches: [{ beach_id: swell.beach.id, beach_name: swell.beach.name, rank: 1 }],
    event_key: swell.eventKey,
    title_id: headline.titleId,
    kind: 'coming',
    share_url: buildSwellShareUrl(swell.eventKey, 'coming', headline.titleId),
  });
}
