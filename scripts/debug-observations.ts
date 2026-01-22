#!/usr/bin/env npx tsx
/**
 * Debug script to verify IOOS observation fix
 *
 * Tests:
 * - Station capability discovery
 * - Dynamic URL building
 * - Observation field coverage
 * - Data freshness
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import {
  buildVariableMap,
  buildDynamicObservationUrl,
  parseObservationRow,
} from "../lib/services/ioos-service";
import {
  IOOS_API_CONFIG,
  IOOS_OBSERVATION_CONFIG,
  type CanonicalVar,
} from "../lib/constants/ioos-config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface StationInfo {
  station_id: string;
  source_network: string;
  available_variables: string[] | null;
  variable_map: Partial<Record<CanonicalVar, string>> | null;
  variables_last_synced_at: string | null;
}

interface TestResult {
  stationId: string;
  network: string;
  hasCapabilities: boolean;
  variableCount: number;
  mappedVars: string[];
  capabilityAge: string | null;
  urlBuilt: boolean;
  fetchStatus: number;
  rowCount: number;
  fields: {
    waveHeight: boolean;
    wavePeriod: boolean;
    waveDirection: boolean;
    waterTemp: boolean;
  };
  freshness: string | null;
  error?: string;
}

async function fetchWithDynamicUrl(
  stationId: string,
  variableMap: Partial<Record<CanonicalVar, string>>
): Promise<{
  status: number;
  rowCount: number;
  latestRow: Record<string, unknown> | null;
  error?: string;
}> {
  const url = buildDynamicObservationUrl(stationId, variableMap);
  if (!url) {
    return { status: 0, rowCount: 0, latestRow: null, error: "Could not build URL" };
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": IOOS_API_CONFIG.userAgent },
    });

    if (!response.ok) {
      const text = await response.text();
      return { status: response.status, rowCount: 0, latestRow: null, error: text.slice(0, 100) };
    }

    const data = await response.json();
    const columnNames: string[] = data.table?.columnNames || [];
    const rows: unknown[][] = data.table?.rows || [];

    if (rows.length === 0) {
      return { status: 200, rowCount: 0, latestRow: null };
    }

    // Convert latest row to object
    const latestRow: Record<string, unknown> = {};
    const lastRow = rows[rows.length - 1];
    for (let i = 0; i < columnNames.length; i++) {
      latestRow[columnNames[i]] = lastRow[i];
    }

    return { status: 200, rowCount: rows.length, latestRow };
  } catch (error) {
    return { status: 0, rowCount: 0, latestRow: null, error: String(error) };
  }
}

async function testStation(station: StationInfo): Promise<TestResult> {
  const result: TestResult = {
    stationId: station.station_id,
    network: station.source_network,
    hasCapabilities: false,
    variableCount: 0,
    mappedVars: [],
    capabilityAge: null,
    urlBuilt: false,
    fetchStatus: 0,
    rowCount: 0,
    fields: {
      waveHeight: false,
      wavePeriod: false,
      waveDirection: false,
      waterTemp: false,
    },
    freshness: null,
  };

  // Check capabilities
  const availableVars = station.available_variables || [];
  result.variableCount = availableVars.length;
  result.hasCapabilities = availableVars.length > 0;

  // Check capability age
  if (station.variables_last_synced_at) {
    const syncedAt = new Date(station.variables_last_synced_at);
    const ageHours = (Date.now() - syncedAt.getTime()) / 3600_000;
    result.capabilityAge =
      ageHours < 24
        ? `${ageHours.toFixed(1)}h ago`
        : `${(ageHours / 24).toFixed(1)}d ago`;
  }

  // Build or use variable map
  let variableMap = station.variable_map;
  if (!variableMap || Object.keys(variableMap).length === 0) {
    if (availableVars.length > 0) {
      variableMap = buildVariableMap(availableVars);
    } else {
      result.error = "No capabilities discovered";
      return result;
    }
  }

  result.mappedVars = Object.keys(variableMap);

  // Try to build URL
  const url = buildDynamicObservationUrl(station.station_id, variableMap);
  result.urlBuilt = !!url;

  if (!url) {
    result.error = "Could not build URL (missing wave_height)";
    return result;
  }

  // Fetch observation
  const fetchResult = await fetchWithDynamicUrl(station.station_id, variableMap);
  result.fetchStatus = fetchResult.status;
  result.rowCount = fetchResult.rowCount;

  if (fetchResult.error) {
    result.error = fetchResult.error;
    return result;
  }

  if (!fetchResult.latestRow) {
    result.error = "No data rows";
    return result;
  }

  // Parse the row
  const parsed = parseObservationRow(fetchResult.latestRow, variableMap);

  if (parsed) {
    result.fields.waveHeight = parsed.waveHeightM !== null;
    result.fields.wavePeriod = parsed.wavePeriodS !== null;
    result.fields.waveDirection = parsed.waveDirectionDeg !== null;
    result.fields.waterTemp = parsed.waterTempC !== null;

    // Calculate freshness
    const obsTime = new Date(parsed.observedAt);
    const ageMinutes = (Date.now() - obsTime.getTime()) / 60_000;
    if (ageMinutes < 60) {
      result.freshness = `${ageMinutes.toFixed(0)}m ago`;
    } else if (ageMinutes < 1440) {
      result.freshness = `${(ageMinutes / 60).toFixed(1)}h ago`;
    } else {
      result.freshness = `${(ageMinutes / 1440).toFixed(1)}d ago`;
    }
  }

  return result;
}

async function main() {
  const limit = parseInt(process.argv[2] || "10", 10);

  console.log("🔍 IOOS Observation Fix Verification\n");
  console.log(`Testing ${limit} stations with capability discovery...\n`);

  // Get stations with capabilities
  const { data: stations, error } = await supabase
    .from("ioos_stations")
    .select(
      "station_id, source_network, available_variables, variable_map, variables_last_synced_at"
    )
    .eq("active", true)
    .eq("has_wave_data", true)
    .not("available_variables", "is", null)
    .limit(limit);

  if (error) {
    console.error("Error fetching stations:", error);
    return;
  }

  if (!stations || stations.length === 0) {
    console.log("No stations with capabilities found.");
    console.log(
      "\nRun the capability refresh first to discover station variables."
    );

    // Show stations without capabilities
    const { data: unconfigured } = await supabase
      .from("ioos_stations")
      .select("station_id, source_network")
      .eq("active", true)
      .eq("has_wave_data", true)
      .is("available_variables", null)
      .limit(5);

    if (unconfigured && unconfigured.length > 0) {
      console.log("\nStations needing capability discovery:");
      for (const s of unconfigured) {
        console.log(`  - ${s.station_id} (${s.source_network})`);
      }
    }
    return;
  }

  console.log(`Found ${stations.length} stations with capabilities\n`);

  const results: TestResult[] = [];

  for (const station of stations) {
    const result = await testStation(station);
    results.push(result);

    // Print result
    const fieldIcons = [
      result.fields.waveHeight ? "H" : "-",
      result.fields.wavePeriod ? "P" : "-",
      result.fields.waveDirection ? "D" : "-",
      result.fields.waterTemp ? "T" : "-",
    ].join("");

    const statusIcon =
      result.fetchStatus === 200 && result.rowCount > 0 ? "✅" : "❌";

    console.log(
      `${statusIcon} ${result.stationId.padEnd(20)} [${result.network.padEnd(8)}] ` +
        `vars:${result.variableCount.toString().padStart(2)} ` +
        `fields:[${fieldIcons}] ` +
        `fresh:${(result.freshness || "N/A").padEnd(10)} ` +
        `${result.error ? `err: ${result.error.slice(0, 30)}` : ""}`
    );

    // Rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 Summary\n");

  const successful = results.filter((r) => r.fetchStatus === 200 && r.rowCount > 0);
  const failed = results.filter((r) => r.fetchStatus !== 200 || r.rowCount === 0);

  console.log(`Total tested: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  // Field coverage
  const withHeight = results.filter((r) => r.fields.waveHeight).length;
  const withPeriod = results.filter((r) => r.fields.wavePeriod).length;
  const withDirection = results.filter((r) => r.fields.waveDirection).length;
  const withTemp = results.filter((r) => r.fields.waterTemp).length;

  console.log("\nField Coverage (of successful):");
  console.log(`  Wave Height:     ${withHeight}/${successful.length}`);
  console.log(`  Wave Period:     ${withPeriod}/${successful.length}`);
  console.log(`  Wave Direction:  ${withDirection}/${successful.length}`);
  console.log(`  Water Temp:      ${withTemp}/${successful.length}`);

  // Freshness distribution
  const fresh = successful.filter((r) => {
    if (!r.freshness) return false;
    const match = r.freshness.match(/^(\d+(?:\.\d+)?)(m|h|d)/);
    if (!match) return false;
    const [, value, unit] = match;
    const minutes =
      unit === "m"
        ? parseFloat(value)
        : unit === "h"
          ? parseFloat(value) * 60
          : parseFloat(value) * 1440;
    return minutes <= IOOS_OBSERVATION_CONFIG.lookbackHours * 60;
  }).length;

  console.log(
    `\nFreshness (within ${IOOS_OBSERVATION_CONFIG.lookbackHours}h): ${fresh}/${successful.length}`
  );

  // Network breakdown
  const byNetwork: Record<string, { success: number; fail: number }> = {};
  for (const r of results) {
    if (!byNetwork[r.network]) {
      byNetwork[r.network] = { success: 0, fail: 0 };
    }
    if (r.fetchStatus === 200 && r.rowCount > 0) {
      byNetwork[r.network].success++;
    } else {
      byNetwork[r.network].fail++;
    }
  }

  console.log("\nBy Network:");
  for (const [network, counts] of Object.entries(byNetwork)) {
    console.log(
      `  ${network.padEnd(10)}: ${counts.success} success, ${counts.fail} failed`
    );
  }

  // Error breakdown
  if (failed.length > 0) {
    const errorTypes: Record<string, number> = {};
    for (const r of failed) {
      const errType = r.error?.includes("404")
        ? "404 Not Found"
        : r.error?.includes("500")
          ? "500 Server Error"
          : r.error?.includes("Unrecognized")
            ? "Unrecognized Variable"
            : r.error?.includes("No data")
              ? "No Recent Data"
              : r.error || "Unknown";
      errorTypes[errType] = (errorTypes[errType] || 0) + 1;
    }

    console.log("\nError Types:");
    for (const [err, count] of Object.entries(errorTypes)) {
      console.log(`  ${err}: ${count}`);
    }
  }
}

main().catch(console.error);
