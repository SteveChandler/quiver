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

// Next.js requires `maxDuration` to be statically analyzable (literal).
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSyncCdip(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSyncCdip(request);
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSyncCdipHead(request);
}


