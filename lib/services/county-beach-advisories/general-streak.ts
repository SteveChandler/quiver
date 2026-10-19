import "server-only";

import { z } from "zod";
import {
  supportsCountyAdvisoryQuery,
  supportsCountyRainQuery,
  supportsCountyRunQuery,
  supportsCountyStreakQuery,
  type WaterQualityHoldClient,
} from "@/lib/recommendations/major-event-hold/water-quality";
import { memoizedWaterQualityRead } from "@/lib/recommendations/major-event-hold/read-scope";
import { COUNTY_RAIN_CLUSTER, RAIN_READING_MAX_AGE_MS } from "@/lib/services/water-quality/rainfall-runoff";
import { RAIN_ADVISORY_EVENTS_TABLE, rainAdvisoryEventSchema } from "@/lib/services/water-quality/rain-advisory-events";
import type { RainAdvisoryEvent } from "@/lib/services/water-quality/rain-advisory-events";
import {
  COUNTY_FEED_SOURCE_IDENTIFIER,
  COUNTY_GENERAL_ADVISORY_MIN_SITES,
  COUNTY_GENERAL_ADVISORY_TTL_MS,
} from "./types";

export interface CountyGeneralAdvisory {
  general: boolean;
  expired: boolean;
  streakStartedAt: string | null;
  siteIdentifiers: ReadonlySet<string> | null;
  rainState: "dry" | "wet" | "unknown" | null;
  event: { id: string; status: "active" | "ended"; startedAt: string; lastRainAt: string | null; expiresAt: string } | null;
}

const runColumns = "id, fetched_at, advisory_count";
const siteColumns = "source_site_identifier, advisory_type";
const rainColumns = "window_end, total_in, station_totals";
const runSchema = z.object({
  id: z.string().uuid(),
  fetched_at: z.string().datetime({ offset: true }),
  advisory_count: z.number().int().nonnegative(),
});
const noticeSchema = z.object({
  source_site_identifier: z.string().min(1),
  advisory_type: z.enum(["advisory", "closure", "warning"]),
});
const rainSchema = z.object({
  window_end: z.string().datetime({ offset: true }),
  total_in: z.coerce.number().finite().nonnegative(),
  station_totals: z.record(z.string(), z.coerce.number().finite().nonnegative()),
});

const unknownGeneral: CountyGeneralAdvisory = {
  general: true, expired: false, streakStartedAt: null, siteIdentifiers: null, rainState: null, event: null,
};

async function latestSanDiegoEvent(client: WaterQualityHoldClient): Promise<RainAdvisoryEvent | null> {
  try {
    const query: unknown = client.from(RAIN_ADVISORY_EVENTS_TABLE).select("*");
    if (!supportsCountyRunQuery(query)) return null;
    const { data, error } = await memoizedWaterQualityRead(
      client,
      "county-general|rain-event|san_diego|latest",
      () => query.eq("region", COUNTY_RAIN_CLUSTER.id).order("started_at", { ascending: false }).limit(1),
    );
    if (error || !Array.isArray(data) || !data[0]) return null;
    const parsed = rainAdvisoryEventSchema.safeParse(data[0]);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function readSanDiegoRainState(
  client: WaterQualityHoldClient,
  now: Date,
): Promise<"dry" | "wet" | "unknown"> {
  try {
    const query: unknown = client.from("rainfall_runoff_readings").select(rainColumns);
    if (!supportsCountyRainQuery(query)) return "unknown";
    const cutoff = new Date(now.getTime() - RAIN_READING_MAX_AGE_MS).toISOString();
    const { data, error } = await memoizedWaterQualityRead(
      client,
      `county-general|rain|${COUNTY_RAIN_CLUSTER.id}|${cutoff}`,
      () => query.eq("cluster_id", COUNTY_RAIN_CLUSTER.id)
        .gte("window_end", cutoff)
        .order("window_end", { ascending: false }).limit(1),
    );
    if (error || !Array.isArray(data) || data.length !== 1) return "unknown";
    const parsed = rainSchema.safeParse(data[0]);
    if (!parsed.success) return "unknown";
    const { window_end, total_in, station_totals } = parsed.data;
    const end = Date.parse(window_end);
    if (end < now.getTime() - RAIN_READING_MAX_AGE_MS || end > now.getTime()) return "unknown";
    if (!COUNTY_RAIN_CLUSTER.stations.every((station) => Object.hasOwn(station_totals, station))) return "unknown";
    return total_in === 0 && COUNTY_RAIN_CLUSTER.stations.every((station) => station_totals[station] === 0)
      ? "dry" : "wet";
  } catch {
    return "unknown";
  }
}

/**
 * A streak contains consecutive completed general runs; failed/started runs are
 * ignored and a completed sub-threshold run resets it. Missing history or a
 * failed read keeps every current advisory active, as before.
 * The feed has no flag to distinguish site advisories first listed during a
 * streak; those are treated as general and expire with it.
 */
export async function resolveCountyGeneralAdvisory(
  client: WaterQualityHoldClient,
  latestRun: { id: string; fetched_at: string; advisory_count: number },
  now: Date,
): Promise<CountyGeneralAdvisory> {
  if (latestRun.advisory_count < COUNTY_GENERAL_ADVISORY_MIN_SITES) {
    return { general: false, expired: false, streakStartedAt: null, siteIdentifiers: null, rainState: null, event: null };
  }

  try {
    if (!runSchema.safeParse(latestRun).success || !Number.isFinite(now.getTime())) return unknownGeneral;
    const baselineQuery: unknown = client.from("county_beach_advisory_runs").select(runColumns);
    if (!supportsCountyStreakQuery(baselineQuery)) return unknownGeneral;
    const baselineResult = await memoizedWaterQualityRead(
      client,
      `county-general|baseline|${COUNTY_FEED_SOURCE_IDENTIFIER}|${latestRun.fetched_at}`,
      () => baselineQuery.eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
        .eq("status", "completed")
        .lt("fetched_at", latestRun.fetched_at)
        .lt("advisory_count", COUNTY_GENERAL_ADVISORY_MIN_SITES)
        .order("fetched_at", { ascending: false }).limit(1),
    );
    if (baselineResult.error || !Array.isArray(baselineResult.data) || baselineResult.data.length !== 1) return unknownGeneral;
    const baseline = runSchema.safeParse(baselineResult.data[0]);
    if (!baseline.success || baseline.data.advisory_count >= COUNTY_GENERAL_ADVISORY_MIN_SITES
      || Date.parse(baseline.data.fetched_at) >= Date.parse(latestRun.fetched_at)) return unknownGeneral;

    const firstQuery: unknown = client.from("county_beach_advisory_runs").select(runColumns);
    if (!supportsCountyStreakQuery(firstQuery)) return unknownGeneral;
    const firstResult = await memoizedWaterQualityRead(
      client,
      `county-general|first|${COUNTY_FEED_SOURCE_IDENTIFIER}|${baseline.data.fetched_at}`,
      () => firstQuery.eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
        .eq("status", "completed")
        .gt("fetched_at", baseline.data.fetched_at)
        .order("fetched_at", { ascending: true }).limit(1),
    );
    if (firstResult.error || !Array.isArray(firstResult.data) || firstResult.data.length !== 1) return unknownGeneral;
    const first = runSchema.safeParse(firstResult.data[0]);
    if (!first.success || first.data.advisory_count < COUNTY_GENERAL_ADVISORY_MIN_SITES
      || Date.parse(first.data.fetched_at) > Date.parse(latestRun.fetched_at)) return unknownGeneral;

    const siteQuery: unknown = client.from("county_beach_advisories").select(siteColumns);
    if (!supportsCountyAdvisoryQuery(siteQuery)) return unknownGeneral;
    const sitesResult = await memoizedWaterQualityRead(
      client,
      `county-general|baseline-sites|${baseline.data.id}`,
      () => siteQuery.eq("run_id", baseline.data.id),
    );
    const notices = z.array(noticeSchema).safeParse(sitesResult.data);
    if (sitesResult.error || !notices.success) return unknownGeneral;
    const advisorySites = notices.data.filter((notice) => notice.advisory_type === "advisory")
      .map((notice) => notice.source_site_identifier);
    if (advisorySites.length !== baseline.data.advisory_count
      || new Set(advisorySites).size !== advisorySites.length) return unknownGeneral;
    const eventRow = await latestSanDiegoEvent(client);
    const event = eventRow ? { id: eventRow.id, status: eventRow.status,
      startedAt: eventRow.started_at, lastRainAt: eventRow.last_rain_at, expiresAt: eventRow.expires_at } : null;
    if (eventRow?.status === "active") {
      return { general: true, expired: false, streakStartedAt: first.data.fetched_at,
        siteIdentifiers: new Set(advisorySites), rainState: null, event };
    }
    if (eventRow?.status === "ended" && Date.parse(eventRow.started_at) >= Date.parse(first.data.fetched_at)) {
      return { general: true, expired: true, streakStartedAt: first.data.fetched_at,
        siteIdentifiers: new Set(advisorySites), rainState: null, event };
    }
    const elapsed = now.getTime() - Date.parse(first.data.fetched_at);
    const rainState = elapsed >= COUNTY_GENERAL_ADVISORY_TTL_MS
      ? await readSanDiegoRainState(client, now) : null;
    return {
      general: true,
      expired: elapsed >= COUNTY_GENERAL_ADVISORY_TTL_MS && rainState === "dry",
      streakStartedAt: first.data.fetched_at,
      siteIdentifiers: new Set(advisorySites),
      rainState,
      event: null,
    };
  } catch {
    return unknownGeneral;
  }
}
