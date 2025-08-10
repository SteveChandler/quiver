import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
}

export interface ForecastUpdateStats {
  total: number;
  successful: number;
  failed: number;
  duration?: string;
  results?: any[];
  failures?: any[];
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  status = 200
): NextResponse {
  const response: ApiSuccessResponse<T> = {
    success: true,
    timestamp: new Date().toISOString(),
  };

  if (data !== undefined) response.data = data;
  if (message) response.message = message;

  return NextResponse.json(response, { status });
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string,
  details?: any,
  status = 500
): NextResponse {
  const response: ApiErrorResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };

  if (details) response.details = details;

  return NextResponse.json(response, { status });
}

/**
 * Process forecast update results and calculate stats
 */
export function processForecastResults(
  results: Array<{ success: boolean; beach?: string; error?: string }>,
  startTime?: number
): ForecastUpdateStats {
  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;
  const failures = results.filter((r) => !r.success);

  const stats: ForecastUpdateStats = {
    total: results.length,
    successful,
    failed,
    results,
  };

  if (startTime) {
    stats.duration = `${Date.now() - startTime}ms`;
  }

  if (failures.length > 0) {
    stats.failures = failures.map((f) => ({
      beach: f.beach,
      error: f.error,
    }));
  }

  return stats;
}

/**
 * Create forecast update success response
 */
export function createForecastUpdateResponse(
  results: Array<{ success: boolean; beach?: string; error?: string }>,
  message: string,
  startTime?: number
): NextResponse {
  const stats = processForecastResults(results, startTime);

  return createSuccessResponse(stats, message);
}

/**
 * Validate cron authorization
 */
export function validateCronAuth(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
  return !cronSecret || authHeader === `Bearer ${cronSecret}`;
}

/**
 * Validate that a request originated from an approved cron source.
 *
 * Accepted sources:
 * - Vercel Cron: presence of the `x-vercel-cron` header
 * - Manual/External: Authorization header with `Bearer <CRON_SECRET>` or `CRON_SECRET_TOKEN`
 */
export function validateCronRequest(request: Request): boolean {
  // Vercel adds this header for scheduled cron invocations
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  if (vercelCronHeader) {
    return true;
  }

  // Some environments may omit the header; accept official Vercel Cron UA
  const userAgent = request.headers.get("user-agent") || "";
  if (userAgent.toLowerCase().startsWith("vercel-cron/")) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  return validateCronAuth(authHeader);
}
