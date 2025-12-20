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
} from "@/lib/api-response-utils";
import { forecastLogger } from "@/lib/monitoring/forecast-logger";
import { updateAllBeachForecasts } from "@/lib/utils/forecast-server-utils";

// Allow up to 5 minutes for the cron job to complete (Vercel limit)
export const MAX_DURATION_SECONDS = 300;

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

export async function runEnhancedForecastSync(
  request: NextRequest
): Promise<Response> {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

  // Log cron job start
  forecastLogger.cronStart(executionId, {
    triggeredBy: request.headers.get("user-agent"),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    supabaseProjectRef: getSupabaseProjectRef(),
  });

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

    const result = await updateAllBeachForecasts();
    const duration = Date.now() - startTime;
    const summary = (result as any)?.summary as
      | { total: number; successful: number; failed: number; duration?: string }
      | undefined;
    const total = summary?.total ?? 0;
    const successful = summary?.successful ?? 0;
    const failed = summary?.failed ?? 0;
    const successRate =
      total > 0 ? `${((successful / total) * 100).toFixed(1)}%` : "N/A";

    // Log cron completion
    forecastLogger.cronComplete(executionId, {
      executionId,
      duration,
      totalBeaches: total,
      successful,
      failed,
      successRate,
    });

    return createSuccessResponse(
      {
        executionId,
        ...result,
      },
      `Enhanced forecast sync completed: ${successful}/${total} beaches updated (${successRate})`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

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
    return createSuccessResponse(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: env,
      },
      "Enhanced forecast sync service health check"
    );
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




