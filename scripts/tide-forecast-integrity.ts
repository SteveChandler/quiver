import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "./load-env.mjs";
import path from "node:path";
import { tideCleanupRows, type TideIntegrityRow } from "../lib/services/tide-forecast-batch-utils";

loadEnv({ path: path.resolve(process.cwd(), ".env") });
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv({ path: path.resolve(process.cwd(), ".env.production.local"), override: true });

const HOUR_MS = 3_600_000;
const PAGE_SIZE = 500;

export type TideReportRow = TideIntegrityRow & { id: string };

export function parseWindow(args: string[]): { from: string; to: string } {
  const now = Date.now();
  const option = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  const fromOption = option("--from");
  const toOption = option("--to");
  if ((args.includes("--from") && !fromOption) || (args.includes("--to") && !toOption)) {
    throw new Error("--from and --to require ISO timestamps");
  }
  const fromMs = fromOption ? Date.parse(fromOption) : now - HOUR_MS;
  const toMs = toOption ? Date.parse(toOption) : now + 10 * 24 * HOUR_MS;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs || toMs - fromMs > 31 * 24 * HOUR_MS) {
    throw new Error("Specify a valid --from/--to window no longer than 31 days");
  }
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };
}

export function tideReportClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function fetchTideWindow(client: SupabaseClient, from: string, to: string, beachIds: readonly string[]): Promise<TideReportRow[]> {
  const rows: TideReportRow[] = [];
  // The unique (beach_id, ts, source) index keeps each bounded beach batch cheap.
  for (let beachOffset = 0; beachOffset < beachIds.length; beachOffset += 10) {
    const batch = beachIds.slice(beachOffset, beachOffset + 10);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.from("tide_forecasts")
        .select("id,beach_id,ts,source,station_id,created_at,tide_height_m,tide_phase")
        .in("beach_id", batch).gte("ts", from).lte("ts", to)
        .order("beach_id").order("ts").order("source").range(offset, offset + PAGE_SIZE - 1);
      if (error || !data) throw new Error(`Tide page ${beachOffset}/${offset}: ${error?.message ?? "no data"}`);
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

export async function fetchTideBeachIds(client: SupabaseClient): Promise<{ allIds: string[]; selectedIds: string[] }> {
  const allIds: string[] = [];
  const selectedIds: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from("beaches").select("id,lat,lon")
      .order("id").range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) throw new Error(`Beach page ${offset}: ${error?.message ?? "no data"}`);
    for (const row of data) {
      allIds.push(row.id);
      if (row.lat !== null && row.lon !== null) selectedIds.push(row.id);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return { allIds, selectedIds };
}

export function summarizeTideWindow(rows: readonly TideReportRow[], beachIds: readonly string[], from: string, to: string) {
  const byHour = new Map<string, TideReportRow[]>();
  const nonHourly: string[] = [];
  const nullStations: string[] = [];
  const covered = new Set<string>();
  for (const row of rows) {
    const timestamp = Date.parse(row.ts);
    const key = `${row.beach_id} ${new Date(Math.floor(timestamp / HOUR_MS) * HOUR_MS).toISOString()}`;
    const group = byHour.get(key) ?? [];
    group.push(row);
    byHour.set(key, group);
    if (timestamp % HOUR_MS !== 0) nonHourly.push(`${row.beach_id} ${row.ts}`);
    else covered.add(key);
    if (row.station_id === null) nullStations.push(`${row.beach_id} ${row.ts}`);
  }
  const multiStation: string[] = [];
  const dualSource: string[] = [];
  for (const [key, group] of byHour) {
    if (new Set(group.map((row) => row.station_id)).size > 1) multiStation.push(key);
    const byStation = new Map<string | null, Set<string>>();
    for (const row of group) {
      const sources = byStation.get(row.station_id) ?? new Set<string>();
      sources.add(row.source);
      byStation.set(row.station_id, sources);
    }
    if ([...byStation.values()].some((sources) => sources.has("noaa") && sources.has("noaa_hilo_interpolated"))) dualSource.push(key);
  }
  const gaps: string[] = [];
  const start = Math.ceil(Date.parse(from) / HOUR_MS) * HOUR_MS;
  const end = Math.floor(Date.parse(to) / HOUR_MS) * HOUR_MS;
  for (const beachId of beachIds) {
    for (let at = start; at <= end; at += HOUR_MS) {
      const key = `${beachId} ${new Date(at).toISOString()}`;
      if (!covered.has(key)) gaps.push(key);
    }
  }
  return { multiStation, dualSource, nonHourly, nullStations, gaps,
    beachesWithGaps: new Set(gaps.map((key) => key.split(" ")[0])).size,
    rows: rows.length, beaches: beachIds.length, deleteRows: tideCleanupRows(rows) };
}

export function printTideReport(report: ReturnType<typeof summarizeTideWindow>, from: string, to: string): void {
  console.log(`Tide integrity ${from} .. ${to}`);
  console.table([
    { metric: "rows", count: report.rows },
    { metric: "selected beaches", count: report.beaches },
    { metric: "multi-station beach-hours", count: report.multiStation.length },
    { metric: "same-station dual-source beach-hours", count: report.dualSource.length },
    { metric: "non-hour-aligned rows", count: report.nonHourly.length },
    { metric: "null-station rows", count: report.nullStations.length },
    { metric: "beaches with missing hours", count: report.beachesWithGaps },
    { metric: "missing beach-hours", count: report.gaps.length },
  ]);
  for (const key of ["multiStation", "dualSource", "nonHourly", "nullStations", "gaps"] as const) {
    console.log(`${key} samples:`, report[key].slice(0, 5));
  }
}

async function main(): Promise<void> {
  const { from, to } = parseWindow(process.argv.slice(2));
  const client = tideReportClient();
  const { allIds, selectedIds } = await fetchTideBeachIds(client);
  const rows = await fetchTideWindow(client, from, to, allIds);
  printTideReport(summarizeTideWindow(rows, selectedIds, from, to), from, to);
}

if (process.argv[1]?.endsWith("tide-forecast-integrity.ts")) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
