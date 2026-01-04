/**
 * Enhanced Forecast Sync Cron Job API (Offset Schedule)
 *
 * This endpoint exists to support a staggered cron schedule (effective 90-minute cadence)
 * without relying on multiple cron entries targeting the same path.
 */

import { NextRequest } from "next/server";
import { MAX_DURATION_SECONDS, runEnhancedForecastSync, runEnhancedForecastSyncHead } from "../enhanced-forecast-sync/_shared";

export const maxDuration = MAX_DURATION_SECONDS;

export async function GET(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request);
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSyncHead(request);
}













