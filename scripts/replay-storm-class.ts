/**
 * Replays the regional storm class on the stored forecasts (enhanced_forecasts) as they are now:
 * for every beach in each region, runs detectBeachSwellEvents with { stormClass: true, horizonDays: 12 }
 * (what buildRegionEvents runs), groups the beach events into regional events the same way, and
 * prints per region: beaches, swell events, storm events, and which beaches see each storm.
 *
 *   node --env-file=<path to .env.local> --import tsx scripts/replay-storm-class.ts \
 *     [--regions="San Diego,Orange County,Los Angeles"] [--face=5] [--rise=3] [--ratio=2.5] [--period=5]
 *     [--diagnose=2026-11-06]
 *
 * --diagnose prints, per beach, the biggest short-period (storm-band) partition in daylight on that
 * local date: offshore height, period, direction, exposure, projected face, and whether a storm was found.
 *
 * Read-only: SELECTs on beaches and enhanced_forecasts with the service-role key. Writes nothing.
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  SWELL_EVENT_BASELINE_LOOKBACK_HOURS,
  detectBeachSwellEvents,
  exposedSwellRows,
  isSwellEventCurrent,
  swellPartitionFaceHeightFt,
  toSwellEventBeach,
  type BeachSwellEvent,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events/detector";
import { STORM_EVENT_THRESHOLDS, SWELL_EVENT_THRESHOLDS, swellWindowForBeach } from "@/lib/alerts/swell-events/exposure";
import { loadSwellForecastRows } from "@/lib/alerts/swell-events/forecast-rows";
import { readAllPages } from "@/lib/alerts/swell-events/paging";
import { groupEvents } from "@/lib/services/discovery/swell-tracking";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { Database } from "@/types/database.generated";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HORIZON_DAYS = 12;
const CHUNK = 20;
const DEFAULT_REGIONS = ["San Diego", "Orange County", "Los Angeles"];
const BEACH_COLUMNS = "id, name, region, timezone, swell_window_center_deg, swell_window_halfwidth_deg, swell_access_factors, terrain_enabled, shoaling_factors, deepwater_decay_factor";

const OVERRIDE_FLAGS = {
  face: "minPeakFaceHeightFt",
  rise: "minFaceRiseFt",
  ratio: "minEnergyRatio",
  period: "minPeriodS",
} as const;

type Client = SupabaseClient<Database>;
type BeachRow = Parameters<typeof toSwellEventBeach>[0] & { id: string; name: string; region: string; timezone: string | null };

function arg(name: string): string | undefined {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function applyOverrides(): void {
  for (const [flag, key] of Object.entries(OVERRIDE_FLAGS)) {
    const raw = arg(flag);
    if (raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`--${flag} must be a number`);
    (STORM_EVENT_THRESHOLDS as Record<string, number>)[key] = value;
  }
}

async function readBeaches(client: Client, region: string): Promise<BeachRow[]> {
  return readAllPages(async (offset, limit) => {
    const { data, error } = await client.from("beaches")
      .select(BEACH_COLUMNS)
      .eq("region", region)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`beaches: ${error.message}`);
    return (data ?? []) as unknown as BeachRow[];
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

async function replayRegion(client: Client, region: string, now: Date): Promise<void> {
  const beaches = await readBeaches(client, region);
  const timezone = resolveBeachTimezone(beaches[0]?.timezone ?? null);
  const from = new Date(now.getTime() - SWELL_EVENT_BASELINE_LOOKBACK_HOURS * HOUR_MS);
  const to = new Date(now.getTime() + HORIZON_DAYS * DAY_MS);
  const rowsByBeach = new Map<string, SwellEventForecastRow[]>();
  for (let index = 0; index < beaches.length; index += CHUNK) {
    const chunk = beaches.slice(index, index + CHUNK).map((beach) => beach.id);
    for (const [id, rows] of await loadSwellForecastRows(client, chunk, from, to)) rowsByBeach.set(id, rows);
  }

  const withWindow = beaches.filter((beach) => beach.swell_window_center_deg != null && beach.swell_window_halfwidth_deg != null);
  const detected: BeachSwellEvent[] = beaches.flatMap((beach) => detectBeachSwellEvents(
    { beach: toSwellEventBeach(beach), forecasts: rowsByBeach.get(beach.id) ?? [], now, timezone },
    { stormClass: true, horizonDays: HORIZON_DAYS },
  )).filter((event) => isSwellEventCurrent(event, now));

  const swells = groupEvents(detected.filter((event) => event.kind !== "storm"));
  const storms = groupEvents(detected.filter((event) => event.kind === "storm"));
  const names = new Map(beaches.map((beach) => [beach.id, beach.name]));

  console.log(`\n## ${region} (${timezone})`);
  console.log(`beaches ${beaches.length} · with swell window ${withWindow.length} · with rows ${rowsByBeach.size}`);
  console.log(`regional events: swell ${swells.length} · storm ${storms.length}`);
  for (const [label, groups] of [["swell", swells], ["storm", storms]] as const) {
    for (const group of [...groups].sort((left, right) => Date.parse(left.lead.peakAt) - Date.parse(right.lead.peakAt))) {
      const { lead } = group;
      const members = group.members.map((member) => names.get(member.beachId) ?? member.beachId).sort();
      console.log(
        `  ${label.padEnd(5)} peak ${lead.peakLocalDate} ${lead.directionLabel} ${round1(lead.periodS)} s`
          + ` offshore ${round1(lead.peakOffshoreHeightFt)} ft face ${round1(lead.peakFaceHeightFt)} ft`
          + ` (base ${round1(lead.baselineFaceHeightFt)} ft, x${round1(lead.energyRatio)})`
          + ` · ${group.members.length}/${withWindow.length} beaches: ${members.join(", ")}`,
      );
    }
  }

  const diagnoseDate = arg("diagnose");
  if (!diagnoseDate) return;
  const stormBeaches = new Set(detected.filter((event) => event.kind === "storm" && event.peakLocalDate === diagnoseDate)
    .map((event) => event.beachId));
  console.log(`  per-beach storm-band peak on ${diagnoseDate} (period ${STORM_EVENT_THRESHOLDS.minPeriodS}-${SWELL_EVENT_THRESHOLDS.minPeriodS} s):`);
  for (const beach of [...beaches].sort((left, right) => left.name.localeCompare(right.name))) {
    const window = swellWindowForBeach(beach);
    if (!window) {
      console.log(`    ${beach.name}: no swell window`);
      continue;
    }
    const rows = exposedSwellRows(rowsByBeach.get(beach.id) ?? [], window, timezone, { firstDate: diagnoseDate, lastDate: diagnoseDate });
    const band = rows.filter((row) => row.daylight).flatMap((row) => row.partitions)
      .filter((partition) => partition.periodS >= STORM_EVENT_THRESHOLDS.minPeriodS && partition.periodS < SWELL_EVENT_THRESHOLDS.minPeriodS);
    if (band.length === 0) {
      console.log(`    ${beach.name}: no storm-band partition`);
      continue;
    }
    const peak = band.reduce((max, partition) => (partition.energy > max.energy ? partition : max));
    const face = swellPartitionFaceHeightFt([peak], toSwellEventBeach(beach)) ?? 0;
    console.log(
      `    ${beach.name}: ${round1(peak.heightFt)} ft ${round1(peak.periodS)} s ${Math.round(peak.directionDeg)}°`
        + ` window ${window.centerDeg}±${window.halfWidthDeg} exposure ${round1(peak.exposure)} face ${round1(face)} ft`
        + `${stormBeaches.has(beach.id) ? " STORM" : ""}`,
    );
  }
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  applyOverrides();
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const regions = arg("regions")?.split(",").map((region) => region.trim()).filter(Boolean) ?? DEFAULT_REGIONS;
  const now = new Date(arg("now") ?? Date.now());
  console.log(`# Storm-class replay on stored forecasts, now ${now.toISOString()}, horizon ${HORIZON_DAYS} d`);
  console.log(`storm thresholds ${JSON.stringify(STORM_EVENT_THRESHOLDS)}`);
  for (const region of regions) await replayRegion(client, region, now);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
