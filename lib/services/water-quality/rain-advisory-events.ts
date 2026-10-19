import { z } from "zod";
import { COUNTY_RAIN_CLUSTER, RAIN_RUNOFF_THRESHOLD_IN } from "./rainfall-runoff";

export const RAIN_ADVISORY_EVENTS_TABLE = "rain_advisory_events";
export const RAIN_ADVISORY_DURATION_MS = 72 * 60 * 60 * 1000;

export type RainAdvisorySource = "county_general" | "metar_runoff";
export type RainAdvisoryEndReason = "dry_72h" | "county_lifted";

const timestamp = z.string().datetime({ offset: true });
export const rainAdvisoryEventSchema = z.object({
  id: z.string().uuid(),
  region: z.string().min(1),
  source: z.enum(["county_general", "metar_runoff"]),
  status: z.enum(["active", "ended"]),
  started_at: timestamp,
  last_rain_at: timestamp.nullable(),
  expires_at: timestamp,
  ended_at: timestamp.nullable(),
  end_reason: z.enum(["dry_72h", "county_lifted"]).nullable(),
  sources: z.record(z.string(), z.unknown()),
  created_at: timestamp,
  updated_at: timestamp,
});
export type RainAdvisoryEvent = z.infer<typeof rainAdvisoryEventSchema>;

export function rainAdvisoryExpiresAt(
  source: RainAdvisorySource,
  startedAt: string,
  lastRainAt: string | null,
): string {
  const start = Date.parse(startedAt);
  const last = lastRainAt === null ? start : Date.parse(lastRainAt);
  const anchor = source === "county_general" ? Math.max(start, last) : last;
  return new Date(anchor + RAIN_ADVISORY_DURATION_MS).toISOString();
}

export interface MetarRainSignal {
  region: string;
  windowEnd: string;
  totalIn: number | null;
  lastRainAt: string | null;
  dryConfirmed: boolean;
  stations: string[];
}

export interface CountyRainSignal {
  runFetchedAt: string;
  general: boolean;
  streakStartedAt: string | null;
  sanDiegoRainAt: string | null;
}

export type RainAdvisoryTransition =
  | { kind: "open"; event: Omit<RainAdvisoryEvent, "id" | "created_at" | "updated_at"> }
  | { kind: "extend"; id: string; last_rain_at: string; expires_at: string }
  | { kind: "end"; id: string; ended_at: string; end_reason: RainAdvisoryEndReason };

export function metarTransitions(
  signal: MetarRainSignal,
  active: RainAdvisoryEvent | null,
): RainAdvisoryTransition[] {
  if (active) {
    if (signal.lastRainAt && (!active.last_rain_at || Date.parse(signal.lastRainAt) > Date.parse(active.last_rain_at))) {
      return [{ kind: "extend", id: active.id, last_rain_at: signal.lastRainAt,
        expires_at: rainAdvisoryExpiresAt(active.source, active.started_at, signal.lastRainAt) }];
    }
    if (signal.dryConfirmed && Date.parse(signal.windowEnd) >= Date.parse(active.expires_at)) {
      return [{ kind: "end", id: active.id, ended_at: signal.windowEnd, end_reason: "dry_72h" }];
    }
    return [];
  }
  if (signal.region === COUNTY_RAIN_CLUSTER.id || signal.totalIn === null
    || signal.totalIn < RAIN_RUNOFF_THRESHOLD_IN || signal.lastRainAt === null) return [];
  return [{ kind: "open", event: {
    region: signal.region, source: "metar_runoff", status: "active",
    started_at: signal.windowEnd, last_rain_at: signal.lastRainAt,
    expires_at: rainAdvisoryExpiresAt("metar_runoff", signal.windowEnd, signal.lastRainAt),
    ended_at: null, end_reason: null,
    sources: { metar: { stations: signal.stations, total_in: signal.totalIn, window_end: signal.windowEnd } },
  } }];
}

export function countyTransitions(
  signal: CountyRainSignal,
  active: RainAdvisoryEvent | null,
  latest: RainAdvisoryEvent | null,
): RainAdvisoryTransition[] {
  if (!signal.general) {
    return active ? [{ kind: "end", id: active.id, ended_at: signal.runFetchedAt, end_reason: "county_lifted" }] : [];
  }
  if (active || !signal.streakStartedAt) return [];
  let startedAt = signal.streakStartedAt;
  let reopenedAfter: string | null = null;
  if (latest && Date.parse(latest.started_at) >= Date.parse(signal.streakStartedAt)) {
    if (latest.status !== "ended" || !latest.ended_at || !signal.sanDiegoRainAt
      || Date.parse(signal.sanDiegoRainAt) <= Date.parse(latest.ended_at)) return [];
    startedAt = signal.sanDiegoRainAt;
    reopenedAfter = latest.id;
  }
  return [{ kind: "open", event: {
    region: COUNTY_RAIN_CLUSTER.id, source: "county_general", status: "active",
    started_at: startedAt, last_rain_at: null,
    expires_at: rainAdvisoryExpiresAt("county_general", startedAt, null),
    ended_at: null, end_reason: null,
    sources: { county: { first_general_run_at: signal.streakStartedAt,
      opened_by_run_at: signal.runFetchedAt,
      ...(reopenedAfter ? { reopened_after_event_id: reopenedAfter } : {}) } },
  } }];
}

export function formatRainAdvisoryTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso)).replace(":00", "");
}

export function rainAdvisoryEndsLabel(expiresAt: string, now: Date): string | null {
  return Date.parse(expiresAt) > now.getTime() ? `ends ${formatRainAdvisoryTime(expiresAt)} if dry` : null;
}
