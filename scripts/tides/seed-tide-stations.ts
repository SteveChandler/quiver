/**
 * Loads scripts/tides/data/tide-stations.json.gz into public.tide_stations.
 * Idempotent: upserts on id, so a re-run updates rows in place.
 *
 * Requires migration 20261110200000_create_tide_stations.sql to be applied first.
 * Writes to the database named by NEXT_PUBLIC_SUPABASE_URL (shared prod/dev):
 * run only with approval.
 *
 *   node --import tsx scripts/tides/seed-tide-stations.ts --dry-run
 *   node --import tsx scripts/tides/seed-tide-stations.ts
 */
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

import { config } from "../load-env.mjs";

const BATCH_SIZE = 250;
const DATA_PATH = "scripts/tides/data/tide-stations.json.gz";

interface SeedRow {
  id: string;
  slug: string;
  commercial_use: boolean;
  [column: string]: unknown;
}

async function main(): Promise<void> {
  config({ path: ".env.local" });
  const dryRun = process.argv.includes("--dry-run");
  const rows = JSON.parse(gunzipSync(await readFile(DATA_PATH)).toString("utf8")) as SeedRow[];
  if (rows.some((row) => row.commercial_use !== true)) {
    throw new Error("Seed file contains a row without commercial_use; rebuild it");
  }
  console.log(`${rows.length} stations in ${DATA_PATH}`);
  if (dryRun) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows
      .slice(start, start + BATCH_SIZE)
      .map((row) => ({ ...row, active: true, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("tide_stations").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Batch at ${start} failed: ${error.message}`);
    console.log(`upserted ${Math.min(start + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }
}

if (require.main === module) main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
