#!/usr/bin/env tsx
/**
 * Conservative enhanced forecast regeneration entrypoint.
 *
 * Usage:
 *   yarn tsx scripts/regenerate-enhanced-forecasts.ts --force-all --confirm-prod
 */

import { config } from "dotenv";
import type { CDIPSkipReason } from "../lib/services/cdip/types";
import type {
  BatchProcessResult,
  BeachProcessResult,
} from "../lib/services/forecast/batch-beach-processor";

interface RegenerateArgs {
  batchDelayMs?: string;
  batchSize?: string;
  confirmProd: boolean;
  forceAll: boolean;
  maxBeaches?: string;
}

function parseArgs(argv: string[]): RegenerateArgs {
  const args: RegenerateArgs = {
    confirmProd: false,
    forceAll: false,
  };

  for (const arg of argv) {
    if (arg === "--confirm-prod") {
      args.confirmProd = true;
      continue;
    }

    if (arg === "--force-all") {
      args.forceAll = true;
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      args.batchSize = arg.split("=")[1];
      continue;
    }

    if (arg.startsWith("--batch-delay-ms=")) {
      args.batchDelayMs = arg.split("=")[1];
      continue;
    }

    if (arg.startsWith("--max-beaches=")) {
      args.maxBeaches = arg.split("=")[1];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function requirePositiveInteger(name: string, value: string | undefined): void {
  if (value === undefined) return;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function applyRuntimeDefaults(args: RegenerateArgs): void {
  process.env.FORECAST_BATCH_SIZE = args.batchSize ?? "1";
  process.env.FORECAST_BATCH_DELAY_MS = args.batchDelayMs ?? "2000";

  if (args.maxBeaches) {
    process.env.FORECAST_MAX_BEACHES_PER_RUN = args.maxBeaches;
  }

  if (!args.forceAll) return;

  process.env.FORECAST_FRESHNESS_WINDOW_HOURS = "-1";
  process.env.FORECAST_MAX_BEACHES_PER_RUN = args.maxBeaches ?? "10000";
}

function groupNonSuccessCdipReasons(
  results: BeachProcessResult[]
): Partial<Record<Exclude<CDIPSkipReason, "success">, string[]>> {
  const grouped: Partial<Record<Exclude<CDIPSkipReason, "success">, string[]>> = {};

  for (const result of results) {
    const reason = result.cdip_skip_reason;
    if (!reason || reason === "success") continue;

    grouped[reason] = grouped[reason] ?? [];
    grouped[reason]?.push(result.beach);
  }

  return grouped;
}

function printSummary(result: BatchProcessResult): void {
  const summary = result.summary;
  const failed = summary?.failed ?? result.results.filter((item) => !item.success).length;
  const successful = summary?.successful ?? result.results.filter((item) => item.success).length;
  const attempted = summary?.attempted ?? result.results.length;
  const total = summary?.total ?? result.results.length;

  console.log("Enhanced forecast regeneration complete");
  console.log(
    JSON.stringify(
      {
        total,
        attempted,
        successful,
        failed,
        duration: summary?.duration,
        stoppedEarly: summary?.stoppedEarly ?? false,
        cdipSkipReasonCounts: summary?.cdipSkipReasonCounts ?? {},
      },
      null,
      2
    )
  );

  const grouped = groupNonSuccessCdipReasons(result.results);
  if (Object.keys(grouped).length > 0) {
    console.log("CDIP non-success reasons by beach:");
    console.log(JSON.stringify(grouped, null, 2));
  }
}

async function main(): Promise<void> {
  config({ path: ".env.local" });
  config({ path: ".env.production.local" });

  const args = parseArgs(process.argv.slice(2));
  if (!args.confirmProd) {
    throw new Error("Refusing to regenerate persisted forecasts without --confirm-prod");
  }

  requirePositiveInteger("--batch-size", args.batchSize);
  requirePositiveInteger("--batch-delay-ms", args.batchDelayMs);
  requirePositiveInteger("--max-beaches", args.maxBeaches);
  applyRuntimeDefaults(args);

  const { updateAllBeachForecasts } = await import("../lib/utils/forecast-server-utils");
  const result = await updateAllBeachForecasts();
  printSummary(result);

  const failed = result.summary?.failed ?? result.results.filter((item) => !item.success).length;
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
