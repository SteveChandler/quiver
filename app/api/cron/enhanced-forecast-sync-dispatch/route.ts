/**
 * Enhanced Forecast Sync — consolidated dispatch entrypoint.
 *
 * Single Vercel cron (`0,30 * * * *`) that picks one of the 4 shards
 * based on current UTC hour/minute. Collapses four vercel.json entries
 * into one, freeing slots below the 40/40 Pro cron cap.
 *
 * Shard mapping (matches the previous fixed-offset schedules):
 *   UTC hour even, minute  0 → shard 0
 *   UTC hour even, minute 30 → shard 1
 *   UTC hour odd,  minute  0 → shard 2
 *   UTC hour odd,  minute 30 → shard 3
 *
 * Manual overrides still work via the original URL-parameterised route
 * `/api/cron/enhanced-forecast-sync?shard=N&shardCount=M` — this route
 * only exists as the cron-scheduled entry point.
 */

import { NextRequest } from "next/server";
import {
  runEnhancedForecastSync,
  runEnhancedForecastSyncHead,
} from "../enhanced-forecast-sync/_shared";

export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request, { resolveShardFromTime: true });
}

export async function POST(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request, { resolveShardFromTime: true });
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSyncHead(request);
}
