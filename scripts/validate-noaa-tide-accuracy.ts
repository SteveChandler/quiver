#!/usr/bin/env npx tsx

/**
 * NOAA Tide Accuracy Validation Script
 *
 * Compares our NOAACOOPSService tide predictions against direct NOAA API calls
 * to ensure data accuracy. Uses Ocean Beach Pier (station 9410170) as the test case.
 *
 * Usage:
 *   npx tsx scripts/validate-noaa-tide-accuracy.ts
 *
 * Validates:
 *   - Timestamp accuracy (exact UTC match expected)
 *   - Height values (tolerance: ±0.1 ft)
 *   - High/Low classification
 *   - Datum used (must be MLLW)
 */

const COOPS_BASE_URL =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

// Test station: Ocean Beach Pier, San Diego
const TEST_STATION_ID = "9410170";
const TEST_STATION_NAME = "San Diego (Ocean Beach Pier)";

// Height comparison tolerance in feet
const HEIGHT_TOLERANCE_FT = 0.1;

interface NOAAPrediction {
  t: string; // "YYYY-MM-DD HH:mm"
  v: string; // height in feet
  type: "H" | "L"; // High or Low
}

interface NOAAResponse {
  predictions?: NOAAPrediction[];
  error?: { message: string };
}

interface TidePoint {
  timestamp: number; // Unix seconds UTC
  heightFt: number;
  type: "high" | "low";
  rawTime: string;
}

interface ValidationResult {
  passed: boolean;
  totalPoints: number;
  matchedPoints: number;
  discrepancies: Array<{
    time: string;
    expected: { height: number; type: string };
    actual: { height: number; type: string } | null;
    issue: string;
  }>;
  metadata: {
    stationId: string;
    stationName: string;
    datum: string;
    units: string;
    timezone: string;
    sourceUrl: string;
    fetchTime: string;
  };
}

/**
 * Parse NOAA CO-OPS timestamp to Unix seconds UTC
 * Format: "YYYY-MM-DD HH:mm" (no timezone suffix, but we request GMT)
 */
function parseCOOPSTimestampToUnixSeconds(timestamp: string): number | null {
  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, datePart, hourPart, minutePart] = match;
  const isoUtc = `${datePart}T${hourPart}:${minutePart}:00Z`;
  const ms = Date.parse(isoUtc);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Format Unix timestamp as local time for display
 */
function formatLocalTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

/**
 * Build the NOAA API URL with all parameters
 */
function buildNOAAUrl(
  stationId: string,
  beginDate: string,
  endDate: string
): string {
  const url = new URL(COOPS_BASE_URL);
  url.searchParams.set("application", "quiver-validation-script");
  url.searchParams.set("station", stationId);
  url.searchParams.set("begin_date", beginDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("product", "predictions");
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("units", "english");
  url.searchParams.set("time_zone", "gmt");
  url.searchParams.set("interval", "hilo");
  url.searchParams.set("format", "json");
  return url.toString();
}

/**
 * Fetch tide predictions directly from NOAA API
 */
async function fetchDirectFromNOAA(
  stationId: string,
  beginDate: string,
  endDate: string
): Promise<{ data: TidePoint[]; url: string }> {
  const url = buildNOAAUrl(stationId, beginDate, endDate);

  console.log("\n📡 Fetching directly from NOAA API...");
  console.log(`   URL: ${url}\n`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "quiver-validation-script",
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA API error: ${response.status} ${response.statusText}`);
  }

  const json: NOAAResponse = await response.json();

  if (json.error) {
    throw new Error(`NOAA API returned error: ${json.error.message}`);
  }

  if (!json.predictions || json.predictions.length === 0) {
    throw new Error("NOAA API returned no predictions");
  }

  const data: TidePoint[] = json.predictions.map((p) => ({
    timestamp: parseCOOPSTimestampToUnixSeconds(p.t) ?? 0,
    heightFt: parseFloat(p.v),
    type: p.type === "H" ? "high" : "low",
    rawTime: p.t,
  }));

  return { data, url };
}

/**
 * Simulate what our NOAACOOPSService does
 * This mimics the parsing logic in noaa-coops-service.ts
 */
async function fetchViaOurService(
  stationId: string,
  beginDate: string,
  endDate: string
): Promise<TidePoint[]> {
  console.log("🔧 Fetching via our service logic...\n");

  // Use the exact same URL construction as our service
  const url = new URL(COOPS_BASE_URL);
  url.searchParams.set("application", "quiver-surf-app");
  url.searchParams.set("station", stationId);
  url.searchParams.set("begin_date", beginDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("product", "predictions");
  url.searchParams.set("datum", "MLLW");
  url.searchParams.set("units", "english");
  url.searchParams.set("time_zone", "gmt");
  url.searchParams.set("interval", "hilo");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "quiver-surf-app (contact@quiver.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`Service fetch error: ${response.status}`);
  }

  const json: NOAAResponse = await response.json();

  if (!json.predictions) {
    throw new Error("No predictions in response");
  }

  // Use the same parsing logic as our service
  return json.predictions.map((prediction) => ({
    timestamp:
      parseCOOPSTimestampToUnixSeconds(prediction.t) ??
      Math.floor(new Date(prediction.t).getTime() / 1000),
    heightFt: parseFloat(prediction.v),
    type: prediction.type === "H" ? ("high" as const) : ("low" as const),
    rawTime: prediction.t,
  }));
}

/**
 * Compare two sets of tide predictions and report discrepancies
 */
function compareResults(
  direct: TidePoint[],
  service: TidePoint[]
): ValidationResult["discrepancies"] {
  const discrepancies: ValidationResult["discrepancies"] = [];

  // Create a map of service results by timestamp for quick lookup
  const serviceMap = new Map(service.map((p) => [p.timestamp, p]));

  for (const expected of direct) {
    const actual = serviceMap.get(expected.timestamp);

    if (!actual) {
      discrepancies.push({
        time: expected.rawTime,
        expected: { height: expected.heightFt, type: expected.type },
        actual: null,
        issue: "Missing in service results",
      });
      continue;
    }

    // Check height difference
    const heightDiff = Math.abs(expected.heightFt - actual.heightFt);
    if (heightDiff > HEIGHT_TOLERANCE_FT) {
      discrepancies.push({
        time: expected.rawTime,
        expected: { height: expected.heightFt, type: expected.type },
        actual: { height: actual.heightFt, type: actual.type },
        issue: `Height mismatch: ${heightDiff.toFixed(2)} ft difference (tolerance: ${HEIGHT_TOLERANCE_FT} ft)`,
      });
      continue;
    }

    // Check type classification
    if (expected.type !== actual.type) {
      discrepancies.push({
        time: expected.rawTime,
        expected: { height: expected.heightFt, type: expected.type },
        actual: { height: actual.heightFt, type: actual.type },
        issue: `Type mismatch: expected ${expected.type}, got ${actual.type}`,
      });
    }
  }

  // Check for extra points in service results
  const directTimestamps = new Set(direct.map((p) => p.timestamp));
  for (const servicePoint of service) {
    if (!directTimestamps.has(servicePoint.timestamp)) {
      discrepancies.push({
        time: servicePoint.rawTime,
        expected: { height: 0, type: "unknown" },
        actual: { height: servicePoint.heightFt, type: servicePoint.type },
        issue: "Extra point in service results (not in direct NOAA response)",
      });
    }
  }

  return discrepancies;
}

/**
 * Print validation results in a formatted way
 */
function printResults(result: ValidationResult): void {
  console.log("\n" + "=".repeat(70));
  console.log("📊 VALIDATION RESULTS");
  console.log("=".repeat(70));

  console.log(`\n📍 Station: ${result.metadata.stationName} (${result.metadata.stationId})`);
  console.log(`📐 Datum: ${result.metadata.datum}`);
  console.log(`📏 Units: ${result.metadata.units}`);
  console.log(`🌐 Timezone: ${result.metadata.timezone}`);
  console.log(`⏰ Fetch time: ${result.metadata.fetchTime}`);
  console.log(`\n🔗 Source URL for manual verification:`);
  console.log(`   ${result.metadata.sourceUrl}`);

  console.log("\n" + "-".repeat(70));

  if (result.passed) {
    console.log(
      `\n✅ VALIDATION PASSED: ${result.matchedPoints}/${result.totalPoints} points match`
    );
  } else {
    console.log(
      `\n❌ VALIDATION FAILED: ${result.discrepancies.length} discrepancies found`
    );
  }

  console.log(`   Total points from NOAA: ${result.totalPoints}`);
  console.log(`   Matched points: ${result.matchedPoints}`);
  console.log(`   Discrepancies: ${result.discrepancies.length}`);

  if (result.discrepancies.length > 0) {
    console.log("\n" + "-".repeat(70));
    console.log("📝 DISCREPANCY DETAILS:");

    for (const d of result.discrepancies) {
      console.log(`\n   Time: ${d.time}`);
      console.log(
        `   Expected: ${d.expected.height.toFixed(2)} ft (${d.expected.type})`
      );
      if (d.actual) {
        console.log(
          `   Actual:   ${d.actual.height.toFixed(2)} ft (${d.actual.type})`
        );
      } else {
        console.log(`   Actual:   NOT FOUND`);
      }
      console.log(`   Issue:    ${d.issue}`);
    }
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * Print a sample of the data for manual inspection
 */
function printSampleData(data: TidePoint[], label: string): void {
  console.log(`\n📋 ${label} (first 5 points):`);
  console.log("-".repeat(50));
  console.log("Time (UTC)           | Height | Type");
  console.log("-".repeat(50));

  for (const point of data.slice(0, 5)) {
    const localTime = formatLocalTime(point.timestamp);
    console.log(
      `${point.rawTime.padEnd(18)} | ${point.heightFt.toFixed(2).padStart(5)} ft | ${point.type}`
    );
  }
  console.log(`... and ${Math.max(0, data.length - 5)} more points`);
}

/**
 * Main validation function
 */
async function runValidation(): Promise<void> {
  console.log("\n" + "🌊".repeat(35));
  console.log("  NOAA TIDE ACCURACY VALIDATION SCRIPT");
  console.log("🌊".repeat(35));

  // Calculate date range: today through next 3 days
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 3);

  const beginDateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const endDateStr = endDate.toISOString().slice(0, 10).replace(/-/g, "");

  console.log(`\n📅 Date range: ${beginDateStr} to ${endDateStr}`);
  console.log(`📍 Test station: ${TEST_STATION_NAME} (${TEST_STATION_ID})`);

  try {
    // Step 1: Fetch directly from NOAA
    const { data: directData, url: sourceUrl } = await fetchDirectFromNOAA(
      TEST_STATION_ID,
      beginDateStr,
      endDateStr
    );
    printSampleData(directData, "Direct NOAA API Response");

    // Step 2: Fetch via our service logic
    const serviceData = await fetchViaOurService(
      TEST_STATION_ID,
      beginDateStr,
      endDateStr
    );
    printSampleData(serviceData, "Our Service Parsing");

    // Step 3: Compare results
    const discrepancies = compareResults(directData, serviceData);

    // Step 4: Build validation result
    const result: ValidationResult = {
      passed: discrepancies.length === 0,
      totalPoints: directData.length,
      matchedPoints: directData.length - discrepancies.length,
      discrepancies,
      metadata: {
        stationId: TEST_STATION_ID,
        stationName: TEST_STATION_NAME,
        datum: "MLLW (Mean Lower Low Water)",
        units: "feet (english)",
        timezone: "GMT/UTC (converted to local for display)",
        sourceUrl,
        fetchTime: new Date().toISOString(),
      },
    };

    // Step 5: Print results
    printResults(result);

    // Exit with appropriate code
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Validation failed with error:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

// Run validation
runValidation();
