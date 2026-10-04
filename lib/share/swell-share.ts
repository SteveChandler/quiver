import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getSwellCardHeadline,
  isSwellKind,
  type SwellKind,
} from "@/lib/notifications/copy/swell-card-headline";
import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";
import { degreeToCardinal } from "@/lib/utils/geo-utils";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-utils";

export type { SwellKind };

type SwellShareStatus = "forecast" | "arrived" | "passed" | "dropped";
export type SwellShareImageFormat = "og" | "card";

interface SwellShareHistoryEntry {
  runDate: string;
  peakAt: string | null;
  faceHeightFt: number | null;
  periodS: number | null;
}

/** The public GET /api/swell/[eventKey] 200 body. */
export interface SwellSharePayload {
  eventKey: string;
  beach: { id: string; name: string; slug: string };
  status: SwellShareStatus;
  faceHeightFt: number | null;
  periodS: number | null;
  directionLabel: string | null;
  peakAt: string | null;
  peakLocalDate: string | null;
  history: SwellShareHistoryEntry[];
}

export interface SwellShareEvent {
  payload: SwellSharePayload;
  timezone: string;
}

export interface SwellCardStat {
  label: string;
  value: string;
  unit: string;
}

/** The `card` object of GET /api/swell/[eventKey]: the same values the page and images draw. */
export interface SwellCard {
  kind: SwellKind;
  titleId: string;
  headline: string;
  /** Whole feet, as the card shows it. */
  sizeFt: number | null;
  /** Whole seconds, as the card shows it. */
  periodS: number | null;
  /** Short weekday, e.g. "Thu". */
  whenDayLabel: string | null;
  /** Short month and day, e.g. "Oct 8". */
  whenDateLabel: string | null;
  serious: boolean;
}

export interface SwellCardView {
  kind: SwellKind;
  titleId: string | null;
  headline: string;
  beachName: string;
  sizeFt: number | null;
  periodS: number | null;
  whenDayLabel: string | null;
  whenDateLabel: string | null;
  stats: SwellCardStat[];
  serious: boolean;
  /** True when the event could not be resolved and the card carries no forecast. */
  generic: boolean;
}

// <beach uuid>:<direction band>:<beach-local peak date>, plus the ":<n>" suffix
// resolveEventKeys adds when two detections would share a key.
const EVENT_KEY_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):[NESW]{1,3}:\d{4}-\d{2}-\d{2}(?::\d{1,2})?$/i;
const TITLE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
const HISTORY_LIMIT = 60;
const HOUR_MS = 60 * 60 * 1000;
// Snapshots are written once a day; this tolerates one missed run before an
// event that stopped being detected ahead of its peak reads as dropped.
const DROPPED_AFTER_HOURS = 60;
const PASSED_AFTER_PEAK_HOURS = 24;
/** Same line the alert runner draws for its "serious" title tag. */
const SERIOUS_FACE_HEIGHT_FT = 8;
const SITE_ORIGIN = "https://www.quiversurf.app";
const GENERIC_HEADLINE = "There's swell on the way somewhere.";
const GENERIC_BEACH_NAME = "Find out where in Quiver";

export function parseSwellEventKey(
  value: string | null | undefined,
): { eventKey: string; beachId: string } | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const match = EVENT_KEY_PATTERN.exec(decoded.trim());
  if (!match) return null;
  // Stored keys carry a lowercase uuid; the direction band stays uppercase.
  const beachId = match[1].toLowerCase();
  return { eventKey: `${beachId}${decoded.trim().slice(beachId.length)}`, beachId };
}

export function parseSwellKind(value: string | null | undefined): SwellKind {
  return isSwellKind(value) ? value : "coming";
}

export function parseSwellTitleId(
  value: string | null | undefined,
): string | undefined {
  return value && TITLE_ID_PATTERN.test(value) ? value : undefined;
}

export function parseSwellImageFormat(
  value: string | null | undefined,
): SwellShareImageFormat {
  return value === "card" ? "card" : "og";
}

function swellQuery(kind: SwellKind, titleId?: string | null): string {
  const search = new URLSearchParams({ k: kind });
  if (titleId) search.set("t", titleId);
  return search.toString();
}

export function buildSwellSharePath(
  eventKey: string,
  kind: SwellKind,
  titleId?: string | null,
): string {
  return `/app/swell/${encodeURIComponent(eventKey)}?${swellQuery(kind, titleId)}`;
}

export function buildSwellShareUrl(
  eventKey: string,
  kind: SwellKind,
  titleId?: string | null,
): string {
  return `${SITE_ORIGIN}${buildSwellSharePath(eventKey, kind, titleId)}`;
}

/** Custom scheme only: the universal-link contract does not cover /app/swell. */
export function buildSwellAppUrl(
  eventKey: string,
  kind: SwellKind,
  titleId?: string | null,
): string {
  return `quiver://swell/${encodeURIComponent(eventKey)}?${swellQuery(kind, titleId)}`;
}

export function buildSwellImagePath(
  eventKey: string | null,
  kind: SwellKind,
  titleId: string | null | undefined,
  format: SwellShareImageFormat,
): string {
  const search = new URLSearchParams();
  if (eventKey) search.set("event_key", eventKey);
  search.set("k", kind);
  if (titleId) search.set("t", titleId);
  search.set("format", format);
  return `/api/og/swell?${search.toString()}`;
}

function numeric(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function instant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function roundTo(value: number | null, digits: number): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validTimezone(value: unknown): string {
  if (typeof value !== "string" || !value) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function resolveStatus(
  latest: Record<string, unknown>,
  now: Date,
): SwellShareStatus {
  const nowMs = now.getTime();
  const detectedAt = Date.parse(String(latest.detected_at));
  const peakAt = Date.parse(String(latest.peak_at));
  const arrivalAt = Date.parse(String(latest.arrival_at));
  const fadeAt = latest.fade_at ? Date.parse(String(latest.fade_at)) : Number.NaN;
  if (
    Number.isFinite(detectedAt) &&
    Number.isFinite(peakAt) &&
    detectedAt + DROPPED_AFTER_HOURS * HOUR_MS < Math.min(nowMs, peakAt)
  ) {
    return "dropped";
  }
  const endAt = Number.isFinite(fadeAt)
    ? fadeAt
    : peakAt + PASSED_AFTER_PEAK_HOURS * HOUR_MS;
  if (Number.isFinite(endAt) && nowMs > endAt) return "passed";
  if (Number.isFinite(arrivalAt) && nowMs >= arrivalAt) return "arrived";
  return "forecast";
}

/**
 * Reads one swell event's daily snapshots plus its beach. Returns null when
 * the key is malformed or nothing is stored for it. The snapshots table is
 * service-role only, so callers pass a service client; nothing here is personal.
 */
export async function loadSwellShareEvent(
  supabase: SupabaseClient,
  rawEventKey: string | null | undefined,
  now: Date = new Date(),
): Promise<SwellShareEvent | null> {
  const parsed = parseSwellEventKey(rawEventKey);
  if (!parsed) return null;

  const [snapshots, beach] = await Promise.all([
    supabase
      .from("swell_event_forecast_snapshots")
      .select(
        "run_date,detected_at,direction_deg,period_s,peak_face_height_ft,arrival_at,peak_at,fade_at",
      )
      .eq("beach_id", parsed.beachId)
      .eq("event_key", parsed.eventKey)
      .order("run_date", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("beaches")
      .select("id,name,slug,timezone")
      .eq("id", parsed.beachId)
      .maybeSingle(),
  ]);
  if (snapshots.error) {
    throw new Error(`Failed to load swell event: ${snapshots.error.message}`);
  }
  if (beach.error) {
    throw new Error(`Failed to load swell event beach: ${beach.error.message}`);
  }

  const rows = ((snapshots.data ?? []) as Array<Record<string, unknown>>).reverse();
  const beachRow = beach.data as Record<string, unknown> | null;
  const latest = rows[rows.length - 1];
  if (!latest || !beachRow || typeof beachRow.name !== "string" || typeof beachRow.slug !== "string") {
    return null;
  }

  const timezone = validTimezone(beachRow.timezone);
  const peakAt = instant(latest.peak_at);
  const directionDeg = numeric(latest.direction_deg);
  return {
    timezone,
    payload: {
      eventKey: parsed.eventKey,
      beach: { id: parsed.beachId, name: beachRow.name, slug: beachRow.slug },
      status: resolveStatus(latest, now),
      faceHeightFt: roundTo(numeric(latest.peak_face_height_ft), 1),
      periodS: roundTo(numeric(latest.period_s), 0),
      directionLabel: directionDeg === null ? null : degreeToCardinal(directionDeg),
      peakAt,
      peakLocalDate: peakAt ? getLocalDateStr(new Date(peakAt), timezone) : null,
      history: rows.map((row) => ({
        runDate: String(row.run_date),
        peakAt: instant(row.peak_at),
        faceHeightFt: roundTo(numeric(row.peak_face_height_ft), 1),
        periodS: roundTo(numeric(row.period_s), 0),
      })),
    },
  };
}

function weekday(localDate: string | null, style: "long" | "short"): string | null {
  if (!localDate) return null;
  const parsed = Date.parse(`${localDate}T12:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Intl.DateTimeFormat("en-US", { weekday: style, timeZone: "UTC" }).format(parsed);
}

function monthDay(localDate: string | null): string | null {
  if (!localDate) return null;
  const parsed = Date.parse(`${localDate}T12:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function wholeNumber(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function wholeFeet(value: number | null): string {
  return value === null ? "?" : String(Math.round(value));
}

/**
 * The card shown on the page and drawn by /api/og/swell. The headline only
 * ever comes from getSwellCardHeadline; nothing from the URL is rendered.
 */
export function buildSwellCardView(args: {
  event: SwellShareEvent | null;
  kind: SwellKind;
  titleId?: string;
}): SwellCardView {
  if (!args.event) {
    return {
      kind: args.kind,
      titleId: null,
      headline: GENERIC_HEADLINE,
      beachName: GENERIC_BEACH_NAME,
      sizeFt: null,
      periodS: null,
      whenDayLabel: null,
      whenDateLabel: null,
      stats: [],
      serious: false,
      generic: true,
    };
  }
  const { payload } = args.event;
  const serious = (payload.faceHeightFt ?? 0) >= SERIOUS_FACE_HEIGHT_FT;
  const { titleId, headline } = getSwellCardHeadline({
    titleId: args.titleId,
    kind: args.kind,
    eventKey: payload.eventKey,
    beachName: payload.beach.name,
    peakDayLabel: weekday(payload.peakLocalDate, "long") ?? undefined,
    serious,
    cardSuitable: true,
  });
  const gone = args.kind === "dropped" || payload.status === "dropped";
  // The stats are drawn from these same rounded values, so JSON and images agree.
  const sizeFt = wholeNumber(payload.faceHeightFt);
  const periodS = wholeNumber(payload.periodS);
  const whenDayLabel = weekday(payload.peakLocalDate, "short");
  const whenDateLabel = monthDay(payload.peakLocalDate);
  return {
    kind: args.kind,
    titleId,
    headline,
    beachName: payload.beach.name,
    sizeFt,
    periodS,
    whenDayLabel,
    whenDateLabel,
    stats: [
      { label: gone ? "Was" : "Size", value: sizeFt === null ? "?" : String(sizeFt), unit: "ft" },
      { label: "Period", value: periodS === null ? "?" : String(periodS), unit: "s" },
      { label: gone ? "Was due" : "When", value: whenDayLabel ?? "?", unit: whenDateLabel ?? "" },
    ],
    serious,
    generic: false,
  };
}

/** The JSON `card`: the page and both images draw from the same view. */
export function buildSwellCard(args: {
  event: SwellShareEvent;
  kind: SwellKind;
  titleId?: string;
}): SwellCard {
  const view = buildSwellCardView(args);
  return {
    kind: view.kind,
    titleId: view.titleId ?? "plain",
    headline: view.headline,
    sizeFt: view.sizeFt,
    periodS: view.periodS,
    whenDayLabel: view.whenDayLabel,
    whenDateLabel: view.whenDateLabel,
    serious: view.serious,
  };
}

const STEADY_BELOW_FT = 0.5;

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Whole feet for a change of 1 ft or more, one decimal below that; under 0.5 ft is steady. */
function describeSizeChange(from: number | null, to: number | null): string {
  if (from === null || to === null) return `Holding steady at ${wholeFeet(to)} ft`;
  const change = Math.round((to - from) * 10) / 10;
  if (Math.abs(change) < STEADY_BELOW_FT) return `Holding steady at ${wholeFeet(to)} ft`;
  const direction = change > 0 ? "Up" : "Down";
  if (Math.abs(change) >= 1) return `${direction} from ${wholeFeet(from)} ft to ${wholeFeet(to)} ft`;
  return `${direction} from ${oneDecimal(from)} ft to ${oneDecimal(to)} ft`;
}

/** One factual line on how the forecast has moved between daily runs. */
export function describeSwellHistory(event: SwellShareEvent): string {
  const { payload, timezone } = event;
  const { history } = payload;
  const first = history[0];
  const last = history[history.length - 1];
  const lastFeet = wholeFeet(last?.faceHeightFt ?? null);
  const peakDay = weekday(payload.peakLocalDate, "long");

  if (payload.status === "dropped") {
    return `This one fell off the forecast. The last read was ${lastFeet} ft.`;
  }
  if (payload.status === "passed") {
    return peakDay
      ? `This one has come and gone. It peaked ${peakDay} at ${lastFeet} ft.`
      : "This one has come and gone.";
  }
  const firstSeen = weekday(first?.runDate ?? null, "long");
  if (!first || !last || history.length < 2) {
    return firstSeen
      ? `New on the forecast as of ${firstSeen}. No revisions yet.`
      : "New on the forecast. No revisions yet.";
  }

  const size = describeSizeChange(first.faceHeightFt, last.faceHeightFt);
  const firstPeakDate = first.peakAt ? getLocalDateStr(new Date(first.peakAt), timezone) : null;
  const firstPeakDay = weekday(firstPeakDate, "long");
  const day =
    firstPeakDay && peakDay && firstPeakDate !== payload.peakLocalDate
      ? `peak moved from ${firstPeakDay} to ${peakDay}`
      : peakDay
        ? `peak still ${peakDay}`
        : null;
  return `${size} since ${firstSeen ?? "the first run"}${day ? `, ${day}` : ""}.`;
}
