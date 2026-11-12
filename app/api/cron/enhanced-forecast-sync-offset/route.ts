/**
 * Enhanced Forecast Sync Cron Job API (Offset Schedule)
 *
 * This endpoint exists to support a staggered cron schedule (effective 90-minute cadence)
 * without relying on multiple cron entries targeting the same path.
 */

import { NextRequest } from "next/server";
import { runEnhancedForecastSync, runEnhancedForecastSyncHead } from "../enhanced-forecast-sync/_shared";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

// Next.js requires `maxDuration` to be statically analyzable (literal).
export const maxDuration = 300;

async function handleGet(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request);
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSyncHead(request);
}

export const GET = withErrorNoStore(handleGet);
