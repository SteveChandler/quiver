/**
 * Monitoring and Telemetry for Beach Recommendation Service
 *
 * Provides observability for the GPS feature including:
 * - Performance tracking
 * - Error tracking
 * - Usage analytics
 * - Operational metrics
 *
 * Integrates with:
 * - Console logging (development)
 * - Sentry (error tracking - if available)
 * - Vercel Analytics (usage tracking - if available)
 */

interface PerformanceMetrics {
  operationId: string;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

interface ErrorMetrics {
  operationId: string;
  operation: string;
  error: Error | string;
  metadata?: Record<string, any>;
}

interface UsageMetrics {
  operationId: string;
  locationSource: "gps" | "home-beach" | "none";
  userId?: string;
  resultCount: number;
  metadata?: Record<string, any>;
}

/**
 * Performance thresholds (milliseconds)
 */
const PERFORMANCE_THRESHOLDS = {
  TOTAL_OPERATION: 2000, // Total getBestBeaches should complete in <2s
  DATABASE_QUERY: 500, // Individual DB queries should be <500ms
  PHOTO_LOAD: 1000, // Photo loading should be <1s
  WARNING_THRESHOLD: 1000, // Warn if operation takes >1s
  CRITICAL_THRESHOLD: 3000, // Critical if operation takes >3s
} as const;

/**
 * Operation types for tracking
 */
export const OPERATIONS = {
  GET_BEST_BEACHES: "get_best_beaches",
  DETERMINE_LOCATION: "determine_location",
  FETCH_NEARBY_BEACHES: "fetch_nearby_beaches",
  LOAD_BEACH_PHOTOS: "load_beach_photos",
  LOAD_BEACH_DETAILS: "load_beach_details",
  LOAD_INTEL_DATA: "load_intel_data",
  LOAD_FORECASTS: "load_forecasts",
  SCORE_AND_RANK: "score_and_rank_beaches",
} as const;

/**
 * Generates a unique operation ID for tracking
 */
export function generateOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Tracks performance metrics for an operation
 */
export function trackPerformance(metrics: PerformanceMetrics): void {
  const { operationId, operation, duration, success, metadata } = metrics;

  // Console logging for all environments
  if (duration > PERFORMANCE_THRESHOLDS.CRITICAL_THRESHOLD) {
    console.error(
      `[BeachRecommendation] 🔴 CRITICAL SLOW: ${operation} took ${duration}ms`,
      {
        operationId,
        duration,
        success,
        threshold: PERFORMANCE_THRESHOLDS.CRITICAL_THRESHOLD,
        ...metadata,
      }
    );
  } else if (duration > PERFORMANCE_THRESHOLDS.WARNING_THRESHOLD) {
    console.warn(
      `[BeachRecommendation] ⚠️ SLOW: ${operation} took ${duration}ms`,
      {
        operationId,
        duration,
        success,
        threshold: PERFORMANCE_THRESHOLDS.WARNING_THRESHOLD,
        ...metadata,
      }
    );
  } else {
    console.log(
      `[BeachRecommendation] ✅ ${operation} completed in ${duration}ms`,
      {
        operationId,
        duration,
        success,
        ...metadata,
      }
    );
  }

  // Send to external monitoring (Sentry, Vercel Analytics, etc.)
  // This will be no-op if services aren't configured
  sendPerformanceMetric(metrics);
}

/**
 * Tracks error occurrences
 */
export function trackError(errorMetrics: ErrorMetrics): void {
  const { operationId, operation, error, metadata } = errorMetrics;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[BeachRecommendation] ❌ ERROR in ${operation}:`, {
    operationId,
    message: errorMessage,
    stack: errorStack,
    ...metadata,
  });

  // Send to error tracking service
  sendErrorToMonitoring(errorMetrics);
}

/**
 * Tracks usage patterns and feature adoption
 */
export function trackUsage(usageMetrics: UsageMetrics): void {
  const { operationId, locationSource, userId, resultCount, metadata } =
    usageMetrics;

  console.log(
    `[BeachRecommendation] 📊 Usage: source=${locationSource}, results=${resultCount}`,
    {
      operationId,
      locationSource,
      userId: userId ? "provided" : "none", // Don't log actual user ID
      resultCount,
      ...metadata,
    }
  );

  // Send to analytics
  sendUsageAnalytics(usageMetrics);
}

/**
 * Sends performance metrics to external monitoring service
 */
function sendPerformanceMetric(metrics: PerformanceMetrics): void {
  try {
    // Sentry performance monitoring (if available)
    if (typeof window !== "undefined" && (window as any).Sentry) {
      const Sentry = (window as any).Sentry;
      Sentry.addBreadcrumb({
        category: "performance",
        message: `${metrics.operation} completed`,
        level: metrics.success ? "info" : "warning",
        data: {
          duration: metrics.duration,
          operation_id: metrics.operationId,
          ...metrics.metadata,
        },
      });
    }

    // Vercel Analytics (if available)
    if (typeof window !== "undefined" && (window as any).va) {
      const va = (window as any).va;
      va("track", "BeachRecommendation:Performance", {
        operation: metrics.operation,
        duration: metrics.duration,
        success: metrics.success,
      });
    }

    // Custom analytics endpoint (if configured)
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "performance",
          timestamp: new Date().toISOString(),
          ...metrics,
        }),
      }).catch(() => {
        // Silently fail - monitoring shouldn't break the app
      });
    }
  } catch (err) {
    // Never let monitoring errors affect the application
    console.debug("[Monitoring] Failed to send performance metric:", err);
  }
}

/**
 * Sends error information to monitoring service
 */
function sendErrorToMonitoring(errorMetrics: ErrorMetrics): void {
  try {
    // Sentry error tracking (if available)
    if (typeof window !== "undefined" && (window as any).Sentry) {
      const Sentry = (window as any).Sentry;
      const error =
        errorMetrics.error instanceof Error
          ? errorMetrics.error
          : new Error(String(errorMetrics.error));

      Sentry.captureException(error, {
        tags: {
          operation: errorMetrics.operation,
          operation_id: errorMetrics.operationId,
        },
        extra: errorMetrics.metadata,
      });
    }

    // Server-side error logging (Node.js)
    if (typeof window === "undefined") {
      // Could send to logging service like LogRocket, DataDog, etc.
      // For now, we rely on console.error which is typically captured by hosting platform
    }
  } catch (err) {
    console.debug("[Monitoring] Failed to send error metric:", err);
  }
}

/**
 * Sends usage analytics
 */
function sendUsageAnalytics(usageMetrics: UsageMetrics): void {
  try {
    // Vercel Analytics
    if (typeof window !== "undefined" && (window as any).va) {
      const va = (window as any).va;
      va("track", "BeachRecommendation:Usage", {
        location_source: usageMetrics.locationSource,
        result_count: usageMetrics.resultCount,
      });
    }

    // Google Analytics (if available)
    if (typeof window !== "undefined" && (window as any).gtag) {
      const gtag = (window as any).gtag;
      gtag("event", "beach_recommendation_usage", {
        location_source: usageMetrics.locationSource,
        result_count: usageMetrics.resultCount,
      });
    }

    // Custom analytics
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "usage",
          timestamp: new Date().toISOString(),
          ...usageMetrics,
        }),
      }).catch(() => {
        // Silently fail
      });
    }
  } catch (err) {
    console.debug("[Monitoring] Failed to send usage analytics:", err);
  }
}

/**
 * Creates a performance timer for an operation
 */
export function createPerformanceTimer(
  operation: string,
  operationId: string
): {
  finish: (success: boolean, metadata?: Record<string, any>) => void;
  getElapsed: () => number;
} {
  const startTime = performance.now();

  return {
    finish: (success: boolean, metadata?: Record<string, any>) => {
      const duration = Math.round(performance.now() - startTime);
      trackPerformance({
        operationId,
        operation,
        duration,
        success,
        metadata,
      });
    },
    getElapsed: () => Math.round(performance.now() - startTime),
  };
}

/**
 * Wraps an async operation with performance tracking
 */
export async function monitoredOperation<T>(
  operation: string,
  operationId: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const timer = createPerformanceTimer(operation, operationId);

  try {
    const result = await fn();
    timer.finish(true, metadata);
    return result;
  } catch (error) {
    timer.finish(false, { error: String(error), ...metadata });
    trackError({
      operationId,
      operation,
      error: error instanceof Error ? error : new Error(String(error)),
      metadata,
    });
    throw error;
  }
}

/**
 * Health check metrics for the beach recommendation system
 */
export interface HealthMetrics {
  avgResponseTime: number;
  errorRate: number;
  lastError?: {
    timestamp: string;
    message: string;
  };
  totalRequests: number;
  successfulRequests: number;
}

// In-memory metrics (could be moved to Redis or similar for production)
let healthMetrics: HealthMetrics = {
  avgResponseTime: 0,
  errorRate: 0,
  totalRequests: 0,
  successfulRequests: 0,
};

/**
 * Updates health metrics
 */
export function updateHealthMetrics(
  duration: number,
  success: boolean,
  error?: Error
): void {
  healthMetrics.totalRequests++;
  if (success) {
    healthMetrics.successfulRequests++;
  }

  // Rolling average response time
  healthMetrics.avgResponseTime =
    (healthMetrics.avgResponseTime * (healthMetrics.totalRequests - 1) +
      duration) /
    healthMetrics.totalRequests;

  // Error rate
  healthMetrics.errorRate =
    ((healthMetrics.totalRequests - healthMetrics.successfulRequests) /
      healthMetrics.totalRequests) *
    100;

  if (error) {
    healthMetrics.lastError = {
      timestamp: new Date().toISOString(),
      message: error.message,
    };
  }
}

/**
 * Gets current health metrics
 */
export function getHealthMetrics(): HealthMetrics {
  return { ...healthMetrics };
}

/**
 * Resets health metrics (useful for testing)
 */
export function resetHealthMetrics(): void {
  healthMetrics = {
    avgResponseTime: 0,
    errorRate: 0,
    totalRequests: 0,
    successfulRequests: 0,
  };
}
