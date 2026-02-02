/**
 * Tide Cache Monitor
 *
 * Centralized monitoring and observability utilities for tide cache operations.
 * Separates Sentry instrumentation from business logic.
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Event data for tide cache monitoring
 */
export interface TideCacheEvent {
  /** Beach UUID */
  beachId: string;
  /** Number of rows in the cache */
  rowCount: number;
  /** Number of extrema detected (optional) */
  extremaCount?: number;
}

/**
 * Monitor for tide cache operations.
 * Provides centralized logging and Sentry breadcrumbs.
 */
export class TideCacheMonitor {
  /**
   * Log when no cached data is found for a beach
   */
  static logNoData(event: TideCacheEvent): void {
    Sentry.addBreadcrumb({
      category: "tide-cache",
      message: `Cache fallback - no data for beach ${event.beachId}`,
      level: "warning",
      data: {
        beachId: event.beachId,
        rowCount: event.rowCount,
      },
    });
  }

  /**
   * Log when no extrema are found in cached data
   */
  static logNoExtrema(event: TideCacheEvent): void {
    Sentry.addBreadcrumb({
      category: "tide-cache",
      message: `Cache fallback - no extremes found for beach ${event.beachId}`,
      level: "warning",
      data: {
        beachId: event.beachId,
        rowCount: event.rowCount,
      },
    });
  }

  /**
   * Log successful cache hit with extrema count
   */
  static logSuccess(event: TideCacheEvent): void {
    Sentry.addBreadcrumb({
      category: "tide-cache",
      message: `Cache hit for beach ${event.beachId}`,
      level: "info",
      data: {
        beachId: event.beachId,
        rowCount: event.rowCount,
        extremaCount: event.extremaCount,
      },
    });
  }

  /**
   * Log cache query error
   */
  static logError(beachId: string, error: unknown): void {
    Sentry.addBreadcrumb({
      category: "tide-cache",
      message: `Cache error for beach ${beachId}`,
      level: "error",
      data: {
        beachId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
