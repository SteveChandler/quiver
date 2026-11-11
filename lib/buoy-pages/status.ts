/**
 * Freshness and index rules for buoy pages. One rule set serves the page chip,
 * page robots metadata and the sitemap, so they cannot disagree.
 */

import type { WaveStationRow } from "@/lib/services/wave-stations/types";

const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const OFFLINE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type StationStatus = "fresh" | "stale" | "offline";

/** fresh: wave reading within 3 h; stale: within 30 days; offline: older or none. */
export function classifyStationStatus(
  lastWaveObservedAt: string | null | undefined,
  nowMs: number,
): StationStatus {
  const at = lastWaveObservedAt ? Date.parse(lastWaveObservedAt) : NaN;
  if (!Number.isFinite(at)) return "offline";
  const age = nowMs - at;
  if (age <= STALE_AFTER_MS) return "fresh";
  if (age <= OFFLINE_AFTER_MS) return "stale";
  return "offline";
}

export const STATUS_LABELS: Record<StationStatus, string> = {
  fresh: "Live",
  stale: "Stale",
  offline: "Offline",
};

export type StationIndexReason = "live-waves" | "no-wave-data" | "inactive" | "offline";

export interface StationIndexDecision {
  indexable: boolean;
  reason: StationIndexReason;
}

/**
 * Index a station while it has reported waves in the last 30 days. A stale
 * buoy (a few hours to a few weeks quiet) stays in the index, so a short outage
 * does not flip the page out and back in; it leaves only after 30 days without
 * waves and returns with the first fresh reading.
 */
export function evaluateStationIndexability(
  station: Pick<WaveStationRow, "active" | "has_wave" | "last_wave_observed_at">,
  nowMs: number,
): StationIndexDecision {
  if (!station.active) return { indexable: false, reason: "inactive" };
  if (!station.has_wave) return { indexable: false, reason: "no-wave-data" };
  if (classifyStationStatus(station.last_wave_observed_at, nowMs) === "offline") {
    return { indexable: false, reason: "offline" };
  }
  return { indexable: true, reason: "live-waves" };
}
