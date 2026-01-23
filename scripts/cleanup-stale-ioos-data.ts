#!/usr/bin/env npx tsx
/**
 * Cleanup script for stale IOOS data
 *
 * Removes:
 * - Observations older than maxStorageAgeHours (24h default)
 * - Observations with null wave height
 * - Duplicate observations for same station/time
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { IOOS_OBSERVATION_CONFIG } from "../lib/constants/ioos-config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface CleanupStats {
  totalBefore: number;
  oldDeleted: number;
  nullDeleted: number;
  dupesDeleted: number;
  totalAfter: number;
}

async function countObservations(): Promise<number> {
  const { count, error } = await supabase
    .from("ioos_observations")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error counting observations:", error);
    return 0;
  }
  return count || 0;
}

async function deleteOldObservations(): Promise<number> {
  const cutoff = new Date(
    Date.now() - IOOS_OBSERVATION_CONFIG.maxStorageAgeHours * 3600_000
  ).toISOString();

  const { data, error } = await supabase
    .from("ioos_observations")
    .delete()
    .lt("observed_at", cutoff)
    .select("id");

  if (error) {
    console.error("Error deleting old observations:", error);
    return 0;
  }
  return data?.length || 0;
}

async function deleteNullWaveHeightObservations(): Promise<number> {
  const { data, error } = await supabase
    .from("ioos_observations")
    .delete()
    .is("wave_height_m", null)
    .select("id");

  if (error) {
    console.error("Error deleting null observations:", error);
    return 0;
  }
  return data?.length || 0;
}

async function deleteDuplicateObservations(): Promise<number> {
  // Find duplicates - keep the one with lowest ID (first inserted)
  const { data: dupes, error: findError } = await supabase.rpc(
    "find_duplicate_ioos_observations"
  );

  if (findError) {
    // RPC might not exist, try manual approach
    console.log("RPC not available, using manual duplicate detection...");

    // Get all observations grouped by station_id and observed_at
    const { data: obs, error: obsError } = await supabase
      .from("ioos_observations")
      .select("id, station_id, observed_at")
      .order("station_id")
      .order("observed_at")
      .order("id");

    if (obsError || !obs) {
      console.error("Error fetching observations:", obsError);
      return 0;
    }

    // Find duplicates (same station_id + observed_at, keep lowest ID)
    const seen = new Map<string, number>();
    const toDelete: number[] = [];

    for (const o of obs) {
      const key = `${o.station_id}|${o.observed_at}`;
      if (seen.has(key)) {
        toDelete.push(o.id);
      } else {
        seen.set(key, o.id);
      }
    }

    if (toDelete.length === 0) {
      return 0;
    }

    // Delete in batches
    let deleted = 0;
    const batchSize = 100;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const { error: delError } = await supabase
        .from("ioos_observations")
        .delete()
        .in("id", batch);

      if (!delError) {
        deleted += batch.length;
      }
    }
    return deleted;
  }

  // Use RPC results
  if (!dupes || dupes.length === 0) {
    return 0;
  }

  const dupeIds = dupes.map((d: { id: number }) => d.id);
  const { error: delError } = await supabase
    .from("ioos_observations")
    .delete()
    .in("id", dupeIds);

  if (delError) {
    console.error("Error deleting duplicates:", delError);
    return 0;
  }
  return dupeIds.length;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("🧹 IOOS Data Cleanup\n");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Max storage age: ${IOOS_OBSERVATION_CONFIG.maxStorageAgeHours}h\n`);

  const stats: CleanupStats = {
    totalBefore: 0,
    oldDeleted: 0,
    nullDeleted: 0,
    dupesDeleted: 0,
    totalAfter: 0,
  };

  // Count before
  stats.totalBefore = await countObservations();
  console.log(`Observations before cleanup: ${stats.totalBefore}\n`);

  if (dryRun) {
    // Count what would be deleted
    const cutoff = new Date(
      Date.now() - IOOS_OBSERVATION_CONFIG.maxStorageAgeHours * 3600_000
    ).toISOString();

    const { count: oldCount } = await supabase
      .from("ioos_observations")
      .select("*", { count: "exact", head: true })
      .lt("observed_at", cutoff);

    const { count: nullCount } = await supabase
      .from("ioos_observations")
      .select("*", { count: "exact", head: true })
      .is("wave_height_m", null);

    console.log(`Would delete:`);
    console.log(`  - Old observations (>${IOOS_OBSERVATION_CONFIG.maxStorageAgeHours}h): ${oldCount || 0}`);
    console.log(`  - Null wave height: ${nullCount || 0}`);
    console.log(`  - Duplicates: (checking...)`);

    stats.totalAfter = stats.totalBefore;
    console.log("\nDry run complete. Run without --dry-run to apply changes.");
    return;
  }

  // Delete old observations
  console.log("Deleting old observations...");
  stats.oldDeleted = await deleteOldObservations();
  console.log(`  Deleted: ${stats.oldDeleted}`);

  // Delete null wave height
  console.log("Deleting null wave height observations...");
  stats.nullDeleted = await deleteNullWaveHeightObservations();
  console.log(`  Deleted: ${stats.nullDeleted}`);

  // Delete duplicates
  console.log("Deleting duplicate observations...");
  stats.dupesDeleted = await deleteDuplicateObservations();
  console.log(`  Deleted: ${stats.dupesDeleted}`);

  // Count after
  stats.totalAfter = await countObservations();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Cleanup Summary\n");
  console.log(`Before: ${stats.totalBefore}`);
  console.log(`Old (>${IOOS_OBSERVATION_CONFIG.maxStorageAgeHours}h) deleted: ${stats.oldDeleted}`);
  console.log(`Null wave height deleted: ${stats.nullDeleted}`);
  console.log(`Duplicates deleted: ${stats.dupesDeleted}`);
  console.log(`Total deleted: ${stats.oldDeleted + stats.nullDeleted + stats.dupesDeleted}`);
  console.log(`After: ${stats.totalAfter}`);
}

main().catch(console.error);
