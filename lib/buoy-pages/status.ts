/**
 * Freshness and index rules for buoy pages. One rule set serves the page chip,
 * page robots metadata and the sitemap, so they cannot disagree.
 */

import type { WaveStationRow, WaveStationSource } from "@/lib/services/wave-stations/types";

const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const OFFLINE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type StationStatus = "fresh" | "stale" | "offline";

const MINUTE_MS = 60 * 1000;

/**
 * How late each source's readings normally arrive and how often we fetch it
 * (minutes), measured in the 2026-11-11 dry runs. Kept here, not in the
 * adapters, so the client chip can import it without the fetch code.
 */
const SOURCE_FRESHNESS: Record<WaveStationSource, { expectedLatencyMinutes: number; cadenceMinutes: number }> = {
  ndbc: { expectedLatencyMinutes: 60, cadenceMinutes: 15 },
  marine_ie: { expectedLatencyMinutes: 80, cadenceMinutes: 60 },
  aodn: { expectedLatencyMinutes: 60, cadenceMinutes: 30 },
  fmi: { expectedLatencyMinutes: 90, cadenceMinutes: 30 },
  smhi: { expectedLatencyMinutes: 30, cadenceMinutes: 60 },
  // 95th percentile of (file LastModified - newest wave reading) over 214 stations: 212 min.
  copernicus: { expectedLatencyMinutes: 210, cadenceMinutes: 60 },
};

/** Queensland's AODN buoys publish 2.5-2.9 h after the reading (owner = the AODN institution). */
const QUEENSLAND_AODN_LATENCY_MINUTES = 175;

type FreshnessStation = Pick<WaveStationRow, "source" | "owner">;

function expectedLatencyMinutes(station: FreshnessStation): number {
  if (station.source === "aodn" && station.owner?.startsWith("Queensland Department of Environment and Science")) {
    return QUEENSLAND_AODN_LATENCY_MINUTES;
  }
  return SOURCE_FRESHNESS[station.source]?.expectedLatencyMinutes ?? 0;
}

/** A reading counts as Live for max(3 h, expected latency + 2 fetch intervals). */
export function liveLimitMs(station: FreshnessStation): number {
  const cadence = SOURCE_FRESHNESS[station.source]?.cadenceMinutes ?? 0;
  return Math.max(STALE_AFTER_MS, (expectedLatencyMinutes(station) + 2 * cadence) * MINUTE_MS);
}

/**
 * fresh: wave reading within the Live limit (3 h, or longer for a late
 * source, see liveLimitMs); stale: within 30 days; offline: older or none.
 */
export function classifyStationStatus(
  lastWaveObservedAt: string | null | undefined,
  nowMs: number,
  freshForMs: number = STALE_AFTER_MS,
): StationStatus {
  const at = lastWaveObservedAt ? Date.parse(lastWaveObservedAt) : NaN;
  if (!Number.isFinite(at)) return "offline";
  const age = nowMs - at;
  if (age <= freshForMs) return "fresh";
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
