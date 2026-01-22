#!/usr/bin/env npx tsx
/**
 * Refresh station capabilities from ERDDAP /info endpoints
 *
 * Discovers available variables for each station and builds variable_map
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { IOOSService, buildVariableMap } from "../lib/services/ioos-service";
import { IOOS_OBSERVATION_CONFIG } from "../lib/constants/ioos-config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const ioosService = new IOOSService();

interface RefreshStats {
  total: number;
  refreshed: number;
  failed: number;
  skipped: number;
}

async function main() {
  const forceAll = process.argv.includes("--force");
  const limit = parseInt(
    process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "50",
    10
  );

  console.log("🔄 Refreshing Station Capabilities\n");
  console.log(`Mode: ${forceAll ? "FORCE ALL" : "Only stale/missing"}`);
  console.log(`Limit: ${limit} stations`);
  console.log(`Refresh threshold: ${IOOS_OBSERVATION_CONFIG.variableRefreshDays} days\n`);

  // Build query for stations needing refresh
  let query = supabase
    .from("ioos_stations")
    .select("station_id, source_network, variables_last_synced_at")
    .eq("active", true)
    .eq("has_wave_data", true)
    .limit(limit);

  if (!forceAll) {
    // Only stations that haven't been synced or are stale
    const staleThreshold = new Date(
      Date.now() - IOOS_OBSERVATION_CONFIG.variableRefreshDays * 86400_000
    ).toISOString();

    query = query.or(
      `variables_last_synced_at.is.null,variables_last_synced_at.lt.${staleThreshold}`
    );
  }

  const { data: stations, error } = await query;

  if (error) {
    console.error("Error fetching stations:", error);
    return;
  }

  if (!stations || stations.length === 0) {
    console.log("No stations need capability refresh.");
    return;
  }

  console.log(`Found ${stations.length} stations to refresh\n`);

  const stats: RefreshStats = {
    total: stations.length,
    refreshed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const station of stations) {
    process.stdout.write(`${station.station_id.padEnd(25)} `);

    try {
      const result = await ioosService.fetchStationVariables(station.station_id);

      if (!result) {
        console.log("❌ No response from /info endpoint");
        stats.failed++;
        continue;
      }

      const { availableVariables, variableMap } = result;

      if (availableVariables.length === 0) {
        console.log("⚠️  No variables found");
        stats.skipped++;
        continue;
      }

      // Update station
      const { error: updateError } = await supabase
        .from("ioos_stations")
        .update({
          available_variables: availableVariables,
          variable_map: variableMap,
          variables_last_synced_at: new Date().toISOString(),
        })
        .eq("station_id", station.station_id);

      if (updateError) {
        console.log(`❌ Update failed: ${updateError.message}`);
        stats.failed++;
        continue;
      }

      const mappedVars = Object.keys(variableMap).join(",");
      console.log(`✅ ${availableVariables.length} vars, mapped: [${mappedVars}]`);
      stats.refreshed++;
    } catch (err) {
      console.log(`❌ Error: ${String(err).slice(0, 50)}`);
      stats.failed++;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Refresh Summary\n");
  console.log(`Total processed: ${stats.total}`);
  console.log(`Successfully refreshed: ${stats.refreshed}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped (no variables): ${stats.skipped}`);

  // Show sample of refreshed stations
  const { data: sample } = await supabase
    .from("ioos_stations")
    .select("station_id, source_network, variable_map, variables_last_synced_at")
    .not("variable_map", "is", null)
    .order("variables_last_synced_at", { ascending: false })
    .limit(5);

  if (sample && sample.length > 0) {
    console.log("\nRecently refreshed stations:");
    for (const s of sample) {
      const vars = Object.keys(s.variable_map || {}).join(",");
      console.log(`  ${s.station_id} (${s.source_network}): [${vars}]`);
    }
  }
}

main().catch(console.error);
