import { spawn } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  loadPlaywrightEnv,
  requireEnv,
  requireLocalSupabaseEnv,
} from "./lib/playwright-env";
import { rebaseRows } from "./lib/rebase-forecasts";

type SnapshotRow = Record<string, unknown>;

interface BeachSnapshotRow extends SnapshotRow {
  id: string;
  name?: string | null;
  slug?: string | null;
}

interface ForecastTable {
  extraTimeFields?: string[];
  table: string;
  timeField: string;
}

const FORECAST_TABLES: ForecastTable[] = [
  {
    table: "enhanced_forecasts",
    timeField: "forecast_at",
    extraTimeFields: ["next_tide_at"],
  },
  { table: "tide_forecasts", timeField: "ts", extraTimeFields: ["ts_utc"] },
  {
    table: "beach_daily_intel",
    timeField: "generated_at",
    extraTimeFields: [
      "created_at",
      "updated_at",
      "forecast_date",
      "best_window_start",
      "best_window_end",
      "next_tide_time",
      "tide_time",
    ],
  },
];

const REFERENCE_TABLES = [
  "ccc_access_locations",
  "beach_amenity_sources",
] as const;

const GENERATED_COLUMNS_BY_TABLE: Record<string, string[]> = {
  beaches: ["geog"],
  ccc_access_locations: ["geog"],
  tide_forecasts: ["tide_ft", "ts_utc"],
};

const BEACH_REFERENCE_COLUMNS = [
  "beach_id",
  "nearest_beach_id",
  "best_beach_id",
] as const;

function getLocalDbUrl(): string {
  return (
    process.env.E2E_LOCAL_DB_URL ||
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  );
}

function normalizeBeachKey(value: string | null | undefined): string {
  return String(value || "").toLowerCase();
}

function stripGeneratedColumns(table: string, row: SnapshotRow): SnapshotRow {
  const generatedColumns = GENERATED_COLUMNS_BY_TABLE[table];
  if (!generatedColumns) return row;

  const next = { ...row };
  for (const column of generatedColumns) {
    delete next[column];
  }
  return next;
}

function remapBeachReferences(
  row: SnapshotRow,
  beachIdMap: Map<string, string>
): SnapshotRow {
  const next = { ...row };
  for (const column of BEACH_REFERENCE_COLUMNS) {
    const value = next[column];
    if (typeof value === "string" && beachIdMap.has(value)) {
      next[column] = beachIdMap.get(value);
    }
  }
  return next;
}

function dedupeRowsById(rows: SnapshotRow[]): SnapshotRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (typeof row.id !== "string") return true;
    if (seen.has(row.id)) return false;

    seen.add(row.id);
    return true;
  });
}

function dedupeRowsByKey(
  rows: SnapshotRow[],
  fields: string[]
): SnapshotRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = fields.map((field) => String(row[field] ?? "")).join("|");
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function dedupeRowsForTable(table: string, rows: SnapshotRow[]): SnapshotRow[] {
  const rowsById = dedupeRowsById(rows);
  if (table === "enhanced_forecasts") {
    return dedupeRowsByKey(rowsById, ["beach_id", "forecast_at"]);
  }
  if (table === "tide_forecasts") {
    return dedupeRowsByKey(rowsById, ["beach_id", "ts", "source"]);
  }
  if (table === "beach_daily_intel") {
    return dedupeRowsByKey(rowsById, [
      "beach_id",
      "forecast_date",
      "generation_time",
    ]);
  }

  return rowsById;
}

function buildBeachSnapshot(
  prodBeaches: BeachSnapshotRow[],
  localBeaches: BeachSnapshotRow[]
): { beachIdMap: Map<string, string>; beachesToUpsert: BeachSnapshotRow[] } {
  const localBySlug = new Map<string, BeachSnapshotRow>();
  const localByName = new Map<string, BeachSnapshotRow>();
  for (const beach of localBeaches) {
    const slug = normalizeBeachKey(beach.slug);
    const name = normalizeBeachKey(beach.name);
    if (slug) localBySlug.set(slug, beach);
    if (name) localByName.set(name, beach);
  }

  const beachIdMap = new Map<string, string>();
  const beachesToUpsert: BeachSnapshotRow[] = [];

  for (const beach of prodBeaches) {
    const localBeach =
      localBySlug.get(normalizeBeachKey(beach.slug)) ||
      localByName.get(normalizeBeachKey(beach.name));
    if (localBeach) {
      beachIdMap.set(beach.id, localBeach.id);
      beachesToUpsert.push({
        ...beach,
        id: localBeach.id,
        city: localBeach.city || beach.city,
        name: localBeach.name || beach.name,
        slug: localBeach.slug || beach.slug,
      });
    } else {
      beachIdMap.set(beach.id, beach.id);
      beachesToUpsert.push(beach);
    }
  }

  return { beachIdMap, beachesToUpsert };
}

function shiftDateValue(value: unknown, deltaMs: number): unknown {
  if (typeof value !== "string" || value.length === 0) return value;

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;

  const shifted = new Date(parsed + deltaMs);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? shifted.toISOString().slice(0, 10)
    : shifted.toISOString();
}

function getDeltaMs(
  rows: SnapshotRow[],
  field: string,
  anchorMs: number
): number {
  const times = rows.map((row) => Date.parse(String(row[field])));
  const maxMs = times.reduce(
    (currentMax, timestamp) => Math.max(currentMax, timestamp),
    Number.NEGATIVE_INFINITY
  );
  return anchorMs - maxMs;
}

function rebaseForecastRows(
  rows: SnapshotRow[],
  table: ForecastTable,
  anchorMs: number
): SnapshotRow[] {
  if (rows.length === 0) return rows;

  const deltaMs = getDeltaMs(rows, table.timeField, anchorMs);
  const rebased = rebaseRows(rows, table.timeField, anchorMs);
  const anchorISO = new Date(anchorMs).toISOString();

  return rebased.map((row) => {
    const next = { ...row };
    for (const field of table.extraTimeFields ?? []) {
      next[field] = shiftDateValue(row[field], deltaMs);
    }
    if (table.table === "enhanced_forecasts") {
      const forecastAt = String(next.forecast_at);
      next.forecast_date = forecastAt.slice(0, 10);
      next.forecast_time = forecastAt.slice(11, 19);
      next.created_at = anchorISO;
      next.updated_at = anchorISO;
      next.om_fetched_at = anchorISO;
    }
    if (table.table === "beach_daily_intel") {
      next.forecast_date = String(next.generated_at).slice(0, 10);
      next.created_at = anchorISO;
      next.updated_at = anchorISO;
    }
    return next;
  });
}

async function fetchAllRows(
  client: SupabaseClient,
  table: string,
  filter?: (query: any) => any
): Promise<SnapshotRow[]> {
  const pageSize = 1000;
  const rows: SnapshotRow[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = client
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + pageSize - 1);

    if (filter) query = filter(query);

    const { data, error } = await query;
    if (error) throw error;

    rows.push(...((data ?? []) as SnapshotRow[]));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function fetchForecastRows(
  client: SupabaseClient,
  table: ForecastTable,
  sinceISO: string,
  untilISO: string,
  prodBeachIds: string[]
): Promise<SnapshotRow[]> {
  if (table.table === "enhanced_forecasts") {
    return fetchAllRows(client, table.table, (query) =>
      query.gte(table.timeField, sinceISO).lte(table.timeField, untilISO)
    );
  }

  const rows: SnapshotRow[] = [];
  const chunkSize = 1;
  for (let index = 0; index < prodBeachIds.length; index += chunkSize) {
    const beachIdChunk = prodBeachIds.slice(index, index + chunkSize);
    rows.push(
      ...(await fetchAllRows(client, table.table, (query) =>
        query
          .eq("beach_id", beachIdChunk[0])
          .gte(table.timeField, sinceISO)
          .lte(table.timeField, untilISO)
      ))
    );
  }

  return rows;
}

async function upsertRows(
  client: SupabaseClient,
  table: string,
  rows: SnapshotRow[],
  options?: { onConflict?: string }
): Promise<void> {
  if (rows.length === 0) return;

  const rowsToUpsert = dedupeRowsForTable(table, rows);
  const batchSize = 500;
  for (let index = 0; index < rowsToUpsert.length; index += batchSize) {
    const batch = rowsToUpsert
      .slice(index, index + batchSize)
      .map((row) => stripGeneratedColumns(table, row));
    const { error } = await client.from(table).upsert(batch, options);
    if (error) throw error;
  }
}

async function insertRows(
  table: string,
  rows: SnapshotRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const sanitizedRows = dedupeRowsForTable(table, rows).map((row) =>
    stripGeneratedColumns(table, row)
  );
  const columns = Object.keys(sanitizedRows[0]);
  const quotedColumns = columns.map(quoteIdent).join(", ");
  const copyCommand = `\\copy public.${quoteIdent(table)} (${quotedColumns}) FROM STDIN WITH (FORMAT csv, NULL '\\N')`;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("psql", [
      getLocalDbUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      copyCommand,
    ]);
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`psql copy failed for ${table}: ${stderr.trim()}`));
      }
    });

    for (const row of sanitizedRows) {
      child.stdin.write(
        `${columns.map((column) => csvField(row[column])).join(",")}\n`
      );
    }
    child.stdin.end();
  });
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function csvField(value: unknown): string {
  if (value === null || value === undefined) return "\\N";

  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function clearLocalForecastSnapshot(
  table: ForecastTable
): Promise<void> {
  const command = `delete from public.${quoteIdent(table.table)} where ${quoteIdent(
    table.timeField
  )} >= '1900-01-01T00:00:00.000Z';`;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("psql", [
      getLocalDbUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      command,
    ]);
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`psql delete failed for ${table.table}: ${stderr.trim()}`)
        );
      }
    });
  });
}

async function main(): Promise<void> {
  loadPlaywrightEnv();

  const localEnv = requireLocalSupabaseEnv();
  const prodUrl = requireEnv("E2E_PROD_READ_URL");
  const prodKey = requireEnv("E2E_PROD_READ_KEY");
  const prod = createClient(prodUrl, prodKey, {
    auth: { persistSession: false },
  });
  const local = createClient(localEnv.url, localEnv.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const anchor = Date.now();

  const beaches = await fetchAllRows(prod, "beaches");
  const localBeaches = await fetchAllRows(local, "beaches");
  const { beachIdMap, beachesToUpsert } = buildBeachSnapshot(
    beaches as BeachSnapshotRow[],
    localBeaches as BeachSnapshotRow[]
  );
  console.log(
    `[snapshot] beaches: ${beaches.length} (${beachesToUpsert.length} upserted)`
  );
  await upsertRows(local, "beaches", beachesToUpsert, { onConflict: "id" });

  for (const table of REFERENCE_TABLES) {
    const rows = (await fetchAllRows(prod, table)).map((row) =>
      remapBeachReferences(row, beachIdMap)
    );
    console.log(`[snapshot] ${table}: ${rows.length}`);
    await upsertRows(local, table, rows, { onConflict: "id" });
  }

  const { error: amenityRefreshError } = await local.rpc(
    "refresh_mv_beach_amenities"
  );
  if (amenityRefreshError) throw amenityRefreshError;
  console.log("[snapshot] mv_beach_amenities refreshed");

  const sinceISO = new Date(anchor - 2 * 24 * 3600 * 1000).toISOString();
  const untilISO = new Date(anchor + 8 * 24 * 3600 * 1000).toISOString();
  const prodBeachIds = (beaches as BeachSnapshotRow[]).map((beach) => beach.id);
  for (const table of FORECAST_TABLES) {
    await clearLocalForecastSnapshot(table);
    const data = await fetchForecastRows(
      prod,
      table,
      sinceISO,
      untilISO,
      prodBeachIds
    );
    const rebased = rebaseForecastRows(data, table, anchor).map((row) =>
      remapBeachReferences(row, beachIdMap)
    );
    console.log(
      `[snapshot] ${table.table}: ${rebased.length} (rebased on ${table.timeField})`
    );
    await insertRows(table.table, rebased);
  }

  console.log("[snapshot] done");
}

main().catch((error) => {
  console.error("[snapshot] FAILED", error);
  process.exit(1);
});
