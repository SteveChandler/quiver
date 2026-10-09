import type { SwellFollowupKind, SwellKind, SwellMoveDirection } from "@/lib/notifications/copy/swell-card-headline";
import { getLocalDateString, getLocalHour } from "@/lib/utils/timezone-utils";

const HOUR_MS = 60 * 60 * 1000;

export const SWELL_FOLLOWUP_THRESHOLDS = {
  confirmLeadHours: 48,
  /** Peak moved by at least this much -> moved. */
  movedMinHours: 12,
  /** Face height changed by at least this many feet -> bigger / smaller. */
  sizeMinDeltaFt: 1.5,
  /** ...or by at least this share of the last-told height. */
  sizeMinDeltaRatio: 0.3,
  /** Below this exposure the swell direction is out of the beach's window ("shadowed"). */
  minExposure: 0.25,
  /** At most one follow-up per user per event in this many hours. */
  minHoursBetweenFollowups: 24,
  /** Follow-ups are only evaluated in these local hours, so none waits out the night in the queue. */
  earliestLocalHour: 6,
  latestLocalHour: 21,
  /** A pinned event stops being tracked this long after its last-told peak. */
  expireAfterPeakHours: 24,
} as const;

export type SwellFollowupStatus = "active" | "arrived" | "dropped" | "passed";

/** What this user was last told about one pinned (event, beach). */
export interface SwellToldSnapshot {
  peakAt: string;
  faceHeightFt: number;
  toldKinds: readonly SwellKind[];
  lastFollowupAt: string | null;
  status: SwellFollowupStatus;
}

/** The current forecast for the pinned (event, beach); null when the event is no longer detected there. */
export interface SwellCurrentForecast {
  peakAt: string;
  faceHeightFt: number;
  /** 0..1 share of the swell that reaches the beach at its current direction. */
  exposure: number;
}

interface SwellFollowupInput {
  told: SwellToldSnapshot;
  current: SwellCurrentForecast | null;
  /** Null or absent means no independent earlier detector run is available. */
  previous?: { event: SwellCurrentForecast | null } | null;
  now: Date;
  timezone: string;
}

/** Tracking ends a day after the last-told peak, whether or not a follow-up went out. */
export function isSwellFollowupExpired(told: Pick<SwellToldSnapshot, "peakAt">, now: Date): boolean {
  return now.getTime() > Date.parse(told.peakAt) + SWELL_FOLLOWUP_THRESHOLDS.expireAfterPeakHours * HOUR_MS;
}

/** The caps that need no forecast: terminal kinds, local hours, and the 24 h spacing. */
export function isSwellFollowupWindowOpen(
  told: Pick<SwellToldSnapshot, "toldKinds" | "lastFollowupAt" | "status">,
  now: Date,
  timezone: string,
): boolean {
  if (told.status !== "active") return false;
  if (told.toldKinds.includes("arrived") || told.toldKinds.includes("dropped")) return false;

  const hour = getLocalHour(now, timezone);
  if (
    hour < SWELL_FOLLOWUP_THRESHOLDS.earliestLocalHour
    || hour > SWELL_FOLLOWUP_THRESHOLDS.latestLocalHour
  ) {
    return false;
  }

  const lastFollowupAt = Date.parse(told.lastFollowupAt ?? "");
  return !Number.isFinite(lastFollowupAt)
    || now.getTime() - lastFollowupAt >= SWELL_FOLLOWUP_THRESHOLDS.minHoursBetweenFollowups * HOUR_MS;
}

export function swellMoveDirection(toldPeakAt: string, currentPeakAt: string): SwellMoveDirection {
  return Date.parse(currentPeakAt) > Date.parse(toldPeakAt) ? "later" : "earlier";
}

/**
 * The one follow-up worth sending now, or null. Priority when several apply:
 * dropped, arrived, moved, bigger / smaller. Each kind goes out once per event.
 */
export function detectSwellFollowupKind(input: SwellFollowupInput): SwellFollowupKind | null {
  const kind = detectCurrentKind(input);
  if (!kind || kind === "arrived"
    || Date.parse(input.told.peakAt) - input.now.getTime() <= SWELL_FOLLOWUP_THRESHOLDS.confirmLeadHours * HOUR_MS) {
    return kind;
  }
  if (!input.previous) return null;
  return detectCurrentKind({ ...input, current: input.previous.event }) === kind ? kind : null;
}

function detectCurrentKind(input: SwellFollowupInput): SwellFollowupKind | null {
  const { told, current, now, timezone } = input;
  if (!isSwellFollowupWindowOpen(told, now, timezone)) return null;

  if (!current || current.exposure < SWELL_FOLLOWUP_THRESHOLDS.minExposure) {
    // A swell that vanishes after its told peak has passed, not dropped.
    return now.getTime() < Date.parse(told.peakAt) ? "dropped" : null;
  }

  const today = getLocalDateString(now, timezone);
  const peakDate = getLocalDateString(new Date(current.peakAt), timezone);
  if (peakDate === today) return "arrived";
  if (peakDate < today) return null;

  const movedHours = Math.abs(Date.parse(current.peakAt) - Date.parse(told.peakAt)) / HOUR_MS;
  if (movedHours >= SWELL_FOLLOWUP_THRESHOLDS.movedMinHours && !told.toldKinds.includes("moved")) {
    return "moved";
  }

  const delta = current.faceHeightFt - told.faceHeightFt;
  const material = Math.abs(delta) >= SWELL_FOLLOWUP_THRESHOLDS.sizeMinDeltaFt
    || (told.faceHeightFt > 0 && Math.abs(delta) / told.faceHeightFt >= SWELL_FOLLOWUP_THRESHOLDS.sizeMinDeltaRatio);
  if (!material) return null;
  const sizeKind: SwellFollowupKind = delta > 0 ? "bigger" : "smaller";
  return told.toldKinds.includes(sizeKind) ? null : sizeKind;
}
