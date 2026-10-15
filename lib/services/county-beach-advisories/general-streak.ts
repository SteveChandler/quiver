import "server-only";

import { z } from "zod";
import {
  supportsCountyAdvisoryQuery,
  supportsCountyStreakQuery,
  type WaterQualityHoldClient,
} from "@/lib/recommendations/major-event-hold/water-quality";
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
    return { general: false, expired: false, streakStartedAt: null, siteIdentifiers: null };
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
