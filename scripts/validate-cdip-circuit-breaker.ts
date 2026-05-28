#!/usr/bin/env tsx
/**
 * Read-only live diagnostic for CDIP circuit breaker isolation.
 *
 * Usage:
 *   yarn tsx scripts/validate-cdip-circuit-breaker.ts
 */

import { config } from "dotenv";
import { CDIPApiClient } from "../lib/services/cdip/api-client";
import { apiClient } from "../lib/utils/api-retry";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const STATIONS = ["45", "67", "153", "201"] as const;

async function main(): Promise<void> {
  const cdip = new CDIPApiClient();
  const results = [];

  for (const stationId of STATIONS) {
    const result = await cdip.fetchWaveDataWithDiagnostics(stationId);
    results.push({
      stationId,
      normalizedBreakerKey: result.breakerKey,
      skipReason: result.skipReason,
      status: result.status ?? null,
      pointCount: result.data?.data.length ?? 0,
    });
  }

  console.log("CDIP live station diagnostics");
  console.log(JSON.stringify(results, null, 2));
  console.log("Circuit breaker status");
  console.log(JSON.stringify(apiClient.getServiceStatus(), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
