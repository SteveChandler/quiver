import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { COUNTY_FEED_SOURCE_IDENTIFIER, COUNTY_MAX_STALENESS_MS, COUNTY_MAX_FUTURE_SKEW_MS } from "@/lib/services/county-beach-advisories/types";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";

// Verified against the County sampling roster (EH-320, EH-330, FM-080),
// 2026-09-03: https://gis-public.sandiegocounty.gov/arcgis/rest/services/Hosted/DEHQ_BB_Sampling_update20211010/FeatureServer/0
// Opt-in coverage, not an exemption. Include the shoreline around the sites so
// unmatched/misassigned notices still prevent a false clearance.
const COVERAGE: Readonly<Record<string, readonly [number, number, number, number]>> = {
  "d291411d-d331-4bf1-ad1a-302da3c69de0": [32.850, 32.861, -117.266, -117.252],
};

const runSchema = z.object({
  id: z.string().uuid(), status: z.literal("completed"),
  source_identifier: z.literal(COUNTY_FEED_SOURCE_IDENTIFIER),
  fetched_at: z.string().datetime({ offset: true }),
  advisory_count: z.number().int().nonnegative(),
  closure_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
});
const noticeSchema = z.object({
  beach_id: z.string().uuid().nullable(),
  source_site_identifier: z.string().min(1),
  advisory_type: z.enum(["advisory", "closure", "warning"]),
  county_latitude: z.number().min(-90).max(90),
  county_longitude: z.number().min(-180).max(180),
});

interface SampleQualityRow {
  beach_id: string;
  status: string;
}
export interface CountyStatusMetadata {
  county_advisory_status?: "clear" | "advisory" | "closure" | "unavailable";
  county_checked_at?: string;
}

function unavailable<T extends SampleQualityRow>(rows: readonly T[]): Array<T & CountyStatusMetadata> {
  return rows.map((row) => COVERAGE[row.beach_id.toLowerCase()]
    ? { ...row, county_advisory_status: "unavailable" } : row);
}

/** Pure projection: never changes stored samples or equates no notice with safe water. */
export function projectCurrentWaterQuality<T extends SampleQualityRow>(
  rows: readonly T[], run: unknown, notices: unknown, owners: unknown,
  now: Date = new Date(),
): Array<T & CountyStatusMetadata> {
  const parsedRun = runSchema.safeParse(run);
  const parsedNotices = z.array(noticeSchema).safeParse(notices);
  const parsedOwners = z.array(z.object({ beach_id: z.string().uuid() })).safeParse(owners);
  if (!parsedRun.success || !parsedNotices.success || !parsedOwners.success) return unavailable(rows);
  const fetchedAt = Date.parse(parsedRun.data.fetched_at);
  const age = now.getTime() - fetchedAt;
  if (!Number.isFinite(age) || age >= COUNTY_MAX_STALENESS_MS || age < -COUNTY_MAX_FUTURE_SKEW_MS) return unavailable(rows);
  const counts = { advisory: 0, closure: 0, warning: 0 };
  const keys = new Set<string>();
  for (const notice of parsedNotices.data) {
    const key = `${notice.advisory_type}:${notice.source_site_identifier}`;
    if (keys.has(key)) return unavailable(rows);
    keys.add(key);
    counts[notice.advisory_type]++;
  }
  if (counts.advisory !== parsedRun.data.advisory_count
    || counts.closure !== parsedRun.data.closure_count
    || counts.warning !== parsedRun.data.warning_count) return unavailable(rows);
  const held = new Set(parsedOwners.data.map((row) => row.beach_id.toLowerCase()));
  return rows.map((row) => {
    const id = row.beach_id.toLowerCase();
    const bounds = COVERAGE[id];
    if (!bounds || held.has(id)) return row;
    const local = parsedNotices.data.filter((notice) => notice.beach_id?.toLowerCase() === id
      || (notice.county_latitude >= bounds[0] && notice.county_latitude <= bounds[1]
        && notice.county_longitude >= bounds[2] && notice.county_longitude <= bounds[3]));
    const status = local.some((notice) => notice.advisory_type === "closure") ? "closure"
      : local.length > 0 ? "advisory" : "clear";
    return { ...row, county_advisory_status: status,
      county_checked_at: parsedRun.data.fetched_at,
      // Existing consumers understand unknown; do not send a "good/all clear" signal.
      status: status === "clear" ? "unknown" : status };
  });
}

/** Apply the same read-time policy to every consumer; old rows need no rewrite. */
export async function currentWaterQuality<T extends SampleQualityRow>(
  rows: readonly T[],
  providedClient?: WaterQualityHoldClient,
  now: Date = new Date(),
): Promise<Array<T & CountyStatusMetadata>> {
  if (!rows.some((row) => COVERAGE[row.beach_id.toLowerCase()])) return [...rows];
  try {
    const client = providedClient ?? createSupabaseServiceRoleClient();
    const { data: runs, error } = await client.from("county_beach_advisory_runs")
      .select("id, status, source_identifier, fetched_at, advisory_count, closure_count, warning_count")
      .eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
      .order("fetched_at", { ascending: false }).limit(1);
    if (error || !Array.isArray(runs) || !runs[0]) return unavailable(rows);
    // Do not fall back to an earlier success after a failed/in-progress run.
    const run = runSchema.safeParse(runs[0]);
    if (!run.success) return unavailable(rows);
    const [notices, owners] = await Promise.all([
      client.from("county_beach_advisories")
        .select("beach_id, source_site_identifier, advisory_type, county_latitude, county_longitude")
        .eq("run_id", run.data.id),
      client.from("water_quality_held_beaches").select("beach_id")
        .in("beach_id", rows.map((row) => row.beach_id)),
    ]);
    if (notices.error || owners.error) return unavailable(rows);
    return projectCurrentWaterQuality(rows, runs[0], notices.data, owners.data, now);
  } catch {
    return unavailable(rows);
  }
}
