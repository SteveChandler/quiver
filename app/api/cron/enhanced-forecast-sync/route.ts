/**
 * Enhanced Forecast Sync Cron Job API
 * Orchestrates CDIP + NOAA data ingestion for all beaches
 * Now includes comprehensive logging and monitoring
 */

import { NextRequest } from "next/server";
import {
  MAX_DURATION_SECONDS,
  runEnhancedForecastSync,
  runEnhancedForecastSyncHead,
} from "./_shared";

// Allow up to 5 minutes for the cron job to complete (Vercel limit)
export const maxDuration = MAX_DURATION_SECONDS;

/**
 * GET - Vercel Cron entrypoint (Vercel scheduled crons issue GET requests)
 */
export async function GET(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request);
}

/**
 * POST - Manual trigger / alternate cron method
 */
export async function POST(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSync(request);
}

/**
 * HEAD - Health check endpoint
 */
export async function HEAD(request: NextRequest): Promise<Response> {
  return runEnhancedForecastSyncHead(request);
}
