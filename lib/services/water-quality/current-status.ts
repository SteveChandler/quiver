import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  COUNTY_FEED_SOURCE_IDENTIFIER,
  COUNTY_GENERAL_ADVISORY_MIN_SITES,
  COUNTY_MAX_FUTURE_SKEW_MS,
  COUNTY_MAX_MATCH_DISTANCE_METERS,
  COUNTY_MAX_STALENESS_MS,
} from "@/lib/services/county-beach-advisories/types";
import { distanceMeters } from "@/lib/services/county-beach-advisories/normalizer";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import {
  memoizedBeachRowsRead,
  memoizedWaterQualityRead,
} from "@/lib/recommendations/major-event-hold/read-scope";
import { insideCountyFeed, readBeachPoints, type BeachPoint } from "./county-coverage";

const RUN_SELECT = "id, status, source_identifier, fetched_at, advisory_count, closure_count, warning_count";
const NOTICE_SELECT = "beach_id, source_site_identifier, advisory_type, county_latitude, county_longitude";

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
  /** "general" = the County's county-wide advisory (after rain), not a sampled site. */
  county_advisory_kind?: "general" | "site";
  county_checked_at?: string;
}

export interface CountyProjectionInput {
  run: unknown;
  notices: unknown;
  owners: unknown;
  /** Beach coordinates keyed by lowercase id; decides County coverage and matching. */
  points: ReadonlyMap<string, BeachPoint>;
  now?: Date;
  /** Limit County coverage to these beaches; others pass through unchanged. */
  onlyBeachIds?: readonly string[];
}

function coveredIds(
  rows: readonly SampleQualityRow[],
  points: ReadonlyMap<string, BeachPoint>,
  onlyBeachIds?: readonly string[],
): Set<string> {
  const allowed = onlyBeachIds ? new Set(onlyBeachIds.map((beachId) => beachId.toLowerCase())) : null;
  return new Set(rows.map((row) => row.beach_id.toLowerCase())
    .filter((beachId) => (!allowed || allowed.has(beachId)) && insideCountyFeed(points.get(beachId))));
}

function unavailable<T extends SampleQualityRow>(rows: readonly T[], covered: ReadonlySet<string>): Array<T & CountyStatusMetadata> {
  return rows.map((row) => covered.has(row.beach_id.toLowerCase())
    ? { ...row, county_advisory_status: "unavailable" } : row);
}

/** Pure projection: never changes stored samples or equates no notice with safe water. */
export function projectCurrentWaterQuality<T extends SampleQualityRow>(
  rows: readonly T[], input: CountyProjectionInput,
): Array<T & CountyStatusMetadata> {
  const { points, now = new Date() } = input;
  const covered = coveredIds(rows, points, input.onlyBeachIds);
  const parsedRun = runSchema.safeParse(input.run);
  const parsedNotices = z.array(noticeSchema).safeParse(input.notices);
  const parsedOwners = z.array(z.object({ beach_id: z.string().uuid() })).safeParse(input.owners);
  if (!parsedRun.success || !parsedNotices.success || !parsedOwners.success) return unavailable(rows, covered);
  const fetchedAt = Date.parse(parsedRun.data.fetched_at);
  const age = now.getTime() - fetchedAt;
  if (!Number.isFinite(age) || age >= COUNTY_MAX_STALENESS_MS || age < -COUNTY_MAX_FUTURE_SKEW_MS) return unavailable(rows, covered);
  const counts = { advisory: 0, closure: 0, warning: 0 };
  const keys = new Set<string>();
  for (const notice of parsedNotices.data) {
    const key = `${notice.advisory_type}:${notice.source_site_identifier}`;
    if (keys.has(key)) return unavailable(rows, covered);
    keys.add(key);
    counts[notice.advisory_type]++;
  }
  if (counts.advisory !== parsedRun.data.advisory_count
    || counts.closure !== parsedRun.data.closure_count
    || counts.warning !== parsedRun.data.warning_count) return unavailable(rows, covered);
  const general = parsedRun.data.advisory_count >= COUNTY_GENERAL_ADVISORY_MIN_SITES;
  const held = new Set(parsedOwners.data.map((row) => row.beach_id.toLowerCase()));
  return rows.map((row) => {
    const id = row.beach_id.toLowerCase();
    if (!covered.has(id) || held.has(id)) return row;
    const point = points.get(id);
    // Ingest assigns each County site only to its nearest beach, so a second
    // beach within the radius (Pacific Beach next to Crystal Pier) is matched here.
    const local = parsedNotices.data.filter((notice) => notice.beach_id?.toLowerCase() === id
      || (point?.lat != null && point.lon != null
        && distanceMeters(notice.county_latitude, notice.county_longitude, point.lat, point.lon)
          <= COUNTY_MAX_MATCH_DISTANCE_METERS));
    const status = local.some((notice) => notice.advisory_type === "closure") ? "closure"
      : local.length > 0 || general ? "advisory" : "clear";
    const kind = status === "clear" ? undefined
      : status === "advisory" && general ? "general" as const : "site" as const;
    return { ...row, county_advisory_status: status,
      ...(kind ? { county_advisory_kind: kind } : {}),
      county_checked_at: parsedRun.data.fetched_at,
      // Existing consumers understand unknown; do not send a "good/all clear" signal.
      status: status === "clear" ? "unknown" : status };
  });
}

export interface CurrentWaterQualityOptions {
  /** Limit County coverage to these beaches (the recommendation hold path). */
  onlyBeachIds?: readonly string[];
}

/** Apply the same read-time policy to every consumer; old rows need no rewrite. */
export async function currentWaterQuality<T extends SampleQualityRow>(
  rows: readonly T[],
  providedClient?: WaterQualityHoldClient,
  now: Date = new Date(),
  options: CurrentWaterQualityOptions = {},
): Promise<Array<T & CountyStatusMetadata>> {
  const allowed = options.onlyBeachIds ? new Set(options.onlyBeachIds.map((beachId) => beachId.toLowerCase())) : null;
  const candidateIds = [...new Set(rows.map((row) => row.beach_id.toLowerCase()))]
    .filter((beachId) => !allowed || allowed.has(beachId));
  if (candidateIds.length === 0) return [...rows];
  let covered = new Set<string>();
  try {
    const client = providedClient ?? (createSupabaseServiceRoleClient() as unknown as WaterQualityHoldClient);
    const points = await readBeachPoints(client, candidateIds, "[water-quality:county-coverage-error]");
    // Without coordinates the covered set is unknown. Marking every row
    // unavailable would put a San Diego County notice on Hawaii beaches, so
    // these rows keep their sample status, as they did before County coverage.
    if (points === null) return [...rows];
    covered = coveredIds(rows, points, options.onlyBeachIds);
    if (covered.size === 0) return [...rows];
    const { data: runs, error } = await memoizedWaterQualityRead(
      client,
      `county_beach_advisory_runs|${RUN_SELECT}|latest|${COUNTY_FEED_SOURCE_IDENTIFIER}`,
      () => client.from("county_beach_advisory_runs")
        .select(RUN_SELECT)
        .eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
        .order("fetched_at", { ascending: false }).limit(1),
    );
    if (error || !Array.isArray(runs) || !runs[0]) return unavailable(rows, covered);
    // Do not fall back to an earlier success after a failed/in-progress run.
    const run = runSchema.safeParse(runs[0]);
    if (!run.success) return unavailable(rows, covered);
    const coveredBeachIds = [...covered];
    const [notices, owners] = await Promise.all([
      memoizedWaterQualityRead(
        client,
        `county_beach_advisories|${NOTICE_SELECT}|${run.data.id}`,
        () => client.from("county_beach_advisories")
          .select(NOTICE_SELECT)
          .eq("run_id", run.data.id),
      ),
      memoizedBeachRowsRead(
        client,
        "water_quality_held_beaches|beach_id",
        coveredBeachIds,
        () => client.from("water_quality_held_beaches").select("beach_id")
          .in("beach_id", coveredBeachIds),
      ),
    ]);
    if (notices.error || owners.error) return unavailable(rows, covered);
    return projectCurrentWaterQuality(rows, { run: runs[0], notices: notices.data, owners: owners.data,
      points, now, onlyBeachIds: options.onlyBeachIds });
  } catch {
    return unavailable(rows, covered);
  }
}
