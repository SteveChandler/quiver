import "server-only";

import { z } from "zod";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import { memoizedWaterQualityRead } from "@/lib/recommendations/major-event-hold/read-scope";
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
}

const runColumns = "id, fetched_at, advisory_count";
const siteColumns = "source_site_identifier, advisory_type";
const runSchema = z.object({
  id: z.string().uuid(),
  fetched_at: z.string().datetime({ offset: true }),
  advisory_count: z.number().int().nonnegative(),
});
const noticeSchema = z.object({
  source_site_identifier: z.string().min(1),
  advisory_type: z.enum(["advisory", "closure", "warning"]),
});

const unknownGeneral: CountyGeneralAdvisory = {
  general: true, expired: false, streakStartedAt: null, siteIdentifiers: null,
};

interface RunQuery {
  eq: (column: string, value: string) => RunQuery;
  lt: (column: string, value: string | number) => RunQuery;
  gt: (column: string, value: string) => RunQuery;
  order: (column: string, options: { ascending: boolean }) => RunQuery;
  limit: (count: number) => RunQuery;
  then: <TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => PromiseLike<TResult1 | TResult2>;
}

function supportsRunQuery(query: unknown): query is RunQuery {
  if (!query || typeof query !== "object") return false;
  const value = query as Record<string, unknown>;
  return ["eq", "lt", "gt", "order", "limit", "then"].every((key) => typeof value[key] === "function");
}

/**
 * A streak contains consecutive completed general runs; failed/started runs are
 * ignored and a completed sub-threshold run resets it. Missing history or a
 * failed read keeps every current advisory active, as before.
 */
export async function resolveCountyGeneralAdvisory(
  client: WaterQualityHoldClient,
  latestRun: { id: string; fetched_at: string; advisory_count: number },
  now: Date,
): Promise<CountyGeneralAdvisory> {
  if (latestRun.advisory_count < COUNTY_GENERAL_ADVISORY_MIN_SITES) {
    return { general: false, expired: false, streakStartedAt: null, siteIdentifiers: null };
  }

  try {
    if (!runSchema.safeParse(latestRun).success || !Number.isFinite(now.getTime())) return unknownGeneral;
    const baselineQuery = client.from("county_beach_advisory_runs").select(runColumns);
    if (!supportsRunQuery(baselineQuery)) return unknownGeneral;
    const baselineRunQuery: RunQuery = baselineQuery;
    const baselineResult = await memoizedWaterQualityRead(
      client,
      `county-general|baseline|${COUNTY_FEED_SOURCE_IDENTIFIER}|${latestRun.fetched_at}`,
      () => baselineRunQuery.eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
        .eq("status", "completed")
        .lt("fetched_at", latestRun.fetched_at)
        .lt("advisory_count", COUNTY_GENERAL_ADVISORY_MIN_SITES)
        .order("fetched_at", { ascending: false }).limit(1),
    );
    if (baselineResult.error || !Array.isArray(baselineResult.data) || baselineResult.data.length !== 1) return unknownGeneral;
    const baseline = runSchema.safeParse(baselineResult.data[0]);
    if (!baseline.success || baseline.data.advisory_count >= COUNTY_GENERAL_ADVISORY_MIN_SITES
      || Date.parse(baseline.data.fetched_at) >= Date.parse(latestRun.fetched_at)) return unknownGeneral;

    const firstQuery = client.from("county_beach_advisory_runs").select(runColumns);
    if (!supportsRunQuery(firstQuery)) return unknownGeneral;
    const firstRunQuery: RunQuery = firstQuery;
    const firstResult = await memoizedWaterQualityRead(
      client,
      `county-general|first|${COUNTY_FEED_SOURCE_IDENTIFIER}|${baseline.data.fetched_at}`,
      () => firstRunQuery.eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
        .eq("status", "completed")
        .gt("fetched_at", baseline.data.fetched_at)
        .order("fetched_at", { ascending: true }).limit(1),
    );
    if (firstResult.error || !Array.isArray(firstResult.data) || firstResult.data.length !== 1) return unknownGeneral;
    const first = runSchema.safeParse(firstResult.data[0]);
    if (!first.success || first.data.advisory_count < COUNTY_GENERAL_ADVISORY_MIN_SITES
      || Date.parse(first.data.fetched_at) > Date.parse(latestRun.fetched_at)) return unknownGeneral;

    const siteQuery = client.from("county_beach_advisories").select(siteColumns);
    if (!siteQuery || typeof siteQuery.eq !== "function" || typeof siteQuery.then !== "function") return unknownGeneral;
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
    return {
      general: true,
      expired: now.getTime() - Date.parse(first.data.fetched_at) >= COUNTY_GENERAL_ADVISORY_TTL_MS,
      streakStartedAt: first.data.fetched_at,
      siteIdentifiers: new Set(advisorySites),
    };
  } catch {
    return unknownGeneral;
  }
}
