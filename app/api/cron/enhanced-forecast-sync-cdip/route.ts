/**
 * Enhanced Forecast Sync Cron Job API (CDIP-only)
 *
 * Keeps CDIP-sourced enhanced forecasts fresh enough for strict cache consumers
 * (e.g. discovery, which treats CDIP as near-real-time).
 */

import { NextRequest } from "next/server";
import {
  runEnhancedForecastSyncCdip,
  runEnhancedForecastSyncCdipHead,
} from "./_shared";
import { withObservedCron } from "@/lib/cron/observability";

// Next.js requires `maxDuration` to be statically analyzable (literal).
export const maxDuration = 300;

async function _GET(request: Request): Promise<Response> {
  return runEnhancedForecastSyncCdip(request as NextRequest);
}

async function _POST(request: Request): Promise<Response> {
  return runEnhancedForecastSyncCdip(request as NextRequest);
}

async function _HEAD(request: Request): Promise<Response> {
  return runEnhancedForecastSyncCdipHead(request as NextRequest);
}

export const GET = withObservedCron("/api/cron/enhanced-forecast-sync-cdip", _GET);
export const POST = withObservedCron("/api/cron/enhanced-forecast-sync-cdip", _POST);
export const HEAD = withObservedCron("/api/cron/enhanced-forecast-sync-cdip", _HEAD);


