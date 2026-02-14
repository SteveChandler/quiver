/**
 * Shared handler for enhanced forecast sync cron entrypoints.
 *
 * We keep this logic in one place so multiple cron schedules/paths can invoke it
 * without copy/paste divergence.
 */

import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  validateCronRequest,
} from "@/lib/api-utils";
import { forecastLogger } from "@/lib/monitoring/forecast-logger";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-server-utils";
import {
  startCronCheckIn,
  completeCronCheckIn,
  getEnhancedShardMonitorSlug,
  getEnhancedShardSchedule,
} from "@/lib/monitoring/sentry-cron";

// Allow up to 5 minutes for the cron job to complete (Vercel limit)
export const MAX_DURATION_SECONDS = 300;
const DEFAULT_SAFETY_MARGIN_MS = 20_000;

function getCronDeadlineMs(): { deadlineMs: number; timeBudgetMs: number; safetyMarginMs: number } {
  const hardLimitMs = MAX_DURATION_SECONDS * 1000;
  const safetyMarginMs = Number(process.env.FORECAST_CRON_SAFETY_MARGIN_MS ?? DEFAULT_SAFETY_MARGIN_MS);
  const overrideBudgetMsRaw = process.env.FORECAST_CRON_TIME_BUDGET_MS;
  const overrideBudgetMs =
    overrideBudgetMsRaw != null && overrideBudgetMsRaw.trim() !== ""
      ? Number(overrideBudgetMsRaw)
      : null;

  const computedBudgetMs = hardLimitMs - safetyMarginMs;
  const requestedBudgetMs =
    overrideBudgetMs != null && Number.isFinite(overrideBudgetMs) ? overrideBudgetMs : computedBudgetMs;

  // Never exceed the hard limit; also never go negative.
  const timeBudgetMs = Math.max(0, Math.min(hardLimitMs, requestedBudgetMs));
  return { deadlineMs: Date.now() + timeBudgetMs, timeBudgetMs, safetyMarginMs };
}

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

function parseShardParams(url: URL): { shard?: number; shardCount?: number } {
  const shardRaw = url.searchParams.get("shard");
  const shardCountRaw = url.searchParams.get("shardCount");
  
  let shard: number | undefined;
  let shardCount: number | undefined;
  
  if (shardCountRaw != null) {
    const parsed = parseInt(shardCountRaw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      shardCount = parsed;
    }
  }
  
  if (shardRaw != null && shardCount != null) {
    const parsed = parseInt(shardRaw, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed < shardCount) {
      shard = parsed;
    }
  }
  
  return { shard, shardCount };
}

export async function runEnhancedForecastSync(
  request: NextRequest
): Promise<Response> {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

  // Parse shard parameters from URL
  const url = new URL(request.url);
  const { shard, shardCount } = parseShardParams(url);
  const isSharded = shard !== undefined && shardCount !== undefined;

  // Log cron job start
  forecastLogger.cronStart(executionId, {
    triggeredBy: request.headers.get("user-agent"),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    supabaseProjectRef: getSupabaseProjectRef(),
    ...(isSharded ? { shard, shardCount } : {}),
  });

  // Sentry cron monitoring — alerts if this cron stops firing on schedule
  const monitorSlug = getEnhancedShardMonitorSlug(shard);
  const monitorSchedule = getEnhancedShardSchedule(shard);
  const checkInId = startCronCheckIn({ slug: monitorSlug, schedule: monitorSchedule });

  try {
    // Only allow running in production to avoid accidental dev/preview execution
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    if (env !== "production") {
      forecastLogger.cronFailed(
        executionId,
        new Error(`Cron disabled for environment: ${env}`)
      );
      return createErrorResponse(
        "Forbidden",
        `Cron disabled for environment: ${env}`,
        403
      );
    }

    // Validate cron origin (Vercel Cron header or Bearer secret)
    if (!validateCronRequest(request)) {
      forecastLogger.cronFailed(
        executionId,
        new Error("Invalid cron authentication")
      );
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    const { deadlineMs, timeBudgetMs, safetyMarginMs } = getCronDeadlineMs();
    const result = await updateAllBeachForecasts({ deadlineMs, shard, shardCount });
    const duration = Date.now() - startTime;
    const summary = (result as any)?.summary as
      | {
          total: number;
          successful: number;
          failed: number;
          duration?: string;
          attempted?: number;
          stoppedEarly?: boolean;
          stopReason?: string;
        }
      | undefined;
    const plannedTotal = summary?.total ?? 0;
    const successful = summary?.successful ?? 0;
    const failed = summary?.failed ?? 0;
    const attempted = summary?.attempted ?? plannedTotal;
    const successRate =
      attempted > 0 ? `${((successful / attempted) * 100).toFixed(1)}%` : "N/A";
    const stoppedEarly = summary?.stoppedEarly ?? false;
    const stopReason = summary?.stopReason ?? undefined;

    // Log cron completion
    forecastLogger.cronComplete(executionId, {
      executionId,
      duration,
      totalBeaches: attempted,
      plannedBeaches: plannedTotal,
      successful,
      failed,
      successRate,
      stoppedEarly,
      stopReason,
      timeBudgetMs,
      safetyMarginMs,
      deadlineMs,
      ...(isSharded ? { shard, shardCount } : {}),
    });

    completeCronCheckIn(checkInId, monitorSlug, failed > 0 ? "error" : "ok");

    return createSuccessResponse(
      {
        executionId,
        ...result,
        message: `Enhanced forecast sync completed: ${successful}/${attempted} beaches updated (${successRate})`,
      },
      200
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    completeCronCheckIn(checkInId, monitorSlug, "error");

    forecastLogger.cronFailed(
      executionId,
      error instanceof Error ? error : new Error(errorMessage),
      { duration }
    );

    return createErrorResponse(
      "Enhanced forecast sync failed",
      {
        error: errorMessage,
        duration: `${duration}ms`,
        executionId,
      },
      500
    );
  }
}

export async function runEnhancedForecastSyncHead(
  request: NextRequest
): Promise<Response> {
  try {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    if (env !== "production") {
      return createErrorResponse(
        "Forbidden",
        `Health check disabled for environment: ${env}`,
        403
      );
    }

    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    // Keep this endpoint lightweight and focused on auth/env readiness.
    return createSuccessResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: env,
    });
  } catch (error) {
    return createErrorResponse(
      "Health check failed",
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
}







