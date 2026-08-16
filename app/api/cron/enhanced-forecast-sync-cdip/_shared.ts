/**
 * Shared handler for CDIP-only enhanced forecast sync cron entrypoints.
 *
 * Mirrors the canonical enhanced forecast sync cron patterns:
 * - prod-only guard
 * - validateCronRequest()
 * - deadline/time-budget passing to the updater
 * - structured logs via forecastLogger
 */

import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { forecastLogger } from "@/lib/monitoring/forecast-logger";
import { updateCdipBeachForecasts } from "@/lib/utils/forecast-server-utils";
import { withCronOutcome } from "@/lib/cron/outcome";
import {
  startCronCheckIn,
  completeCronCheckIn,
} from "@/lib/monitoring/sentry-cron";

export const MAX_DURATION_SECONDS = 300;
const DEFAULT_SAFETY_MARGIN_MS = 20_000;

function getCronDeadlineMs(): {
  deadlineMs: number;
  timeBudgetMs: number;
  safetyMarginMs: number;
} {
  const hardLimitMs = MAX_DURATION_SECONDS * 1000;
  const safetyMarginMs = Number(
    process.env.FORECAST_CRON_SAFETY_MARGIN_MS ?? DEFAULT_SAFETY_MARGIN_MS
  );
  const overrideBudgetMsRaw = process.env.FORECAST_CRON_TIME_BUDGET_MS;
  const overrideBudgetMs =
    overrideBudgetMsRaw != null && overrideBudgetMsRaw.trim() !== ""
      ? Number(overrideBudgetMsRaw)
      : null;

  const computedBudgetMs = hardLimitMs - safetyMarginMs;
  const requestedBudgetMs =
    overrideBudgetMs != null && Number.isFinite(overrideBudgetMs)
      ? overrideBudgetMs
      : computedBudgetMs;

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

export async function runEnhancedForecastSyncCdip(
  request: NextRequest
): Promise<Response> {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

  forecastLogger.cronStart(executionId, {
    triggeredBy: request.headers.get("user-agent"),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    supabaseProjectRef: getSupabaseProjectRef(),
    mode: "cdip_only",
  });

  let checkInId = "";
  const monitorSlug = "forecast-cdip-sync";

  try {
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

    // Sentry cron monitoring — only authenticated production cron traffic
    // should affect monitor status.
    checkInId = startCronCheckIn({ slug: monitorSlug, schedule: "0 * * * *" });

    const { deadlineMs, timeBudgetMs, safetyMarginMs } = getCronDeadlineMs();
    const result = await withCronOutcome(
      {
        job: "/api/cron/enhanced-forecast-sync-cdip",
        unit: "forecasts_written",
        expectedMin: 1,
        getProduced: (value) => value.summary?.successful ?? 0,
      },
      () => updateCdipBeachForecasts({ deadlineMs }),
    );
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
      mode: "cdip_only",
    });

    await completeCronCheckIn(
      checkInId,
      monitorSlug,
      failed > 0 ? "error" : "ok",
      duration,
    );

    return createSuccessResponse(
      {
        executionId,
        ...result,
        message: `CDIP enhanced forecast sync completed: ${successful}/${attempted} beaches updated (${successRate})`,
      },
      200
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    if (checkInId) {
      await completeCronCheckIn(checkInId, monitorSlug, "error", duration);
    }

    forecastLogger.cronFailed(
      executionId,
      error instanceof Error ? error : new Error(errorMessage),
      { duration, mode: "cdip_only" }
    );

    return createErrorResponse(
      "CDIP enhanced forecast sync failed",
      {
        error: errorMessage,
        duration: `${duration}ms`,
        executionId,
      },
      500
    );
  }
}
export async function runEnhancedForecastSyncCdipHead(
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

    return createSuccessResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: env,
      mode: "cdip_only",
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
