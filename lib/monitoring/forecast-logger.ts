/**
 * Structured Logging for Forecast Operations
 * 
 * Provides consistent, structured logging for all forecast-related operations
 * to enable better debugging, monitoring, and alerting.
 */

import { AlertSeverity } from './forecast-monitoring-config';

export function isForecastVerboseLoggingEnabled(): boolean {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
  return process.env.FORECAST_VERBOSE_LOGS === 'true' || env !== 'production';
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

function logLine(
  level: 'log' | 'warn' | 'error',
  prefix: string,
  context: unknown
): void {
  const line = `${prefix} ${safeStringify(context)}`;
  // Avoid computed console access; ESLint can't statically verify allowed methods.
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

interface BaseLogContext {
  timestamp: string;
  [key: string]: any;
}

interface CronMetrics {
  executionId: string;
  duration?: number;
  totalBeaches?: number;
  successful?: number;
  failed?: number;
  successRate?: string;
  [key: string]: any;
}

interface APIErrorContext {
  endpoint: string;
  error: string;
  stack?: string;
  statusCode?: number;
  [key: string]: any;
}

/**
 * Structured logger for forecast operations
 */
export const forecastLogger = {
  /**
   * Log cron job start
   */
  cronStart: (executionId: string, metadata?: Record<string, any>) => {
    const context: BaseLogContext = {
      executionId,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    
    logLine('log', '[Forecast Cron] Started', context);
  },

  /**
   * Log cron job completion with metrics
   */
  cronComplete: (executionId: string, metrics: Omit<CronMetrics, 'executionId'>) => {
    const context = {
      executionId,
      timestamp: new Date().toISOString(),
      ...metrics,
    };

    logLine('log', '[Forecast Cron] Completed', context);
  },

  /**
   * Log cron job failure
   */
  cronFailed: (executionId: string, error: Error, context?: Record<string, any>) => {
    const errorContext = {
      executionId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context,
    };
    
    logLine('error', '[Forecast Cron] Failed', errorContext);
  },

  /**
   * Log API errors with full context
   */
  apiError: (endpoint: string, error: Error, context?: Record<string, any>) => {
    const errorContext: APIErrorContext = {
      endpoint,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context,
    };
    
    logLine('error', '[Forecast API Error]', errorContext);
  },

  /**
   * Log stale data detection
   */
  staleDataDetected: (
    beachId: string,
    beachName: string,
    ageHours: number,
    dataSource: string,
    severity: AlertSeverity = 'warning'
  ) => {
    const context = {
      beachId,
      beachName,
      ageHours: ageHours.toFixed(2),
      dataSource,
      severity,
      timestamp: new Date().toISOString(),
    };
    
    const logLevel = severity === 'critical' || severity === 'error' ? 'error' : 'warn';
    logLine(logLevel, '[Forecast Stale Data]', context);
  },

  /**
   * Log batch processing progress
   */
  batchProgress: (
    batchNumber: number,
    totalBatches: number,
    batchSize: number,
    processed: number,
    context?: Record<string, any>
  ) => {
    const progressContext = {
      batchNumber,
      totalBatches,
      batchSize,
      processed,
      progress: Math.round((processed / (totalBatches * batchSize)) * 100) + '%',
      timestamp: new Date().toISOString(),
      ...context,
    };
    
    if (!isForecastVerboseLoggingEnabled()) return;
    logLine('log', '[Forecast Batch Progress]', progressContext);
  },

  /**
   * Log rate limit warnings
   */
  rateLimitWarning: (service: string, resetTime: number, context?: Record<string, any>) => {
    const warningContext = {
      service,
      resetInMs: resetTime,
      resetInMinutes: (resetTime / 60000).toFixed(1),
      timestamp: new Date().toISOString(),
      ...context,
    };
    
    logLine('warn', '[Forecast Rate Limit]', warningContext);
  },

  /**
   * Log health check results
   */
  healthCheck: (
    status: 'healthy' | 'degraded' | 'critical',
    metrics: Record<string, any>
  ) => {
    const context = {
      status,
      timestamp: new Date().toISOString(),
      ...metrics,
    };
    
    const logLevel = status === 'critical' ? 'error' : status === 'degraded' ? 'warn' : 'log';
    if (status === 'healthy' && !isForecastVerboseLoggingEnabled()) return;
    logLine(logLevel, '[Forecast Health Check]', context);
  },

  /**
   * Log database query performance
   */
  slowQuery: (query: string, durationMs: number, context?: Record<string, any>) => {
    const queryContext = {
      query,
      durationMs,
      durationSeconds: (durationMs / 1000).toFixed(2),
      timestamp: new Date().toISOString(),
      ...context,
    };
    
    if (!isForecastVerboseLoggingEnabled()) return;
    logLine('warn', '[Forecast Slow Query]', queryContext);
  },

  /**
   * Log forecast generation metrics for a beach
   */
  forecastGenerated: (
    beachId: string,
    beachName: string,
    forecastCount: number,
    dataSource: string,
    durationMs: number
  ) => {
    const context = {
      beachId,
      beachName,
      forecastCount,
      dataSource,
      durationMs,
      timestamp: new Date().toISOString(),
    };
    
    if (!isForecastVerboseLoggingEnabled()) return;
    logLine('log', '[Forecast Generated]', context);
  },

  /**
   * Log coverage gaps
   */
  coverageGap: (
    totalBeaches: number,
    beachesWithForecasts: number,
    coverage: number,
    severity: AlertSeverity = 'warning'
  ) => {
    const context = {
      totalBeaches,
      beachesWithForecasts,
      coveragePercentage: (coverage * 100).toFixed(1) + '%',
      missingForecasts: totalBeaches - beachesWithForecasts,
      severity,
      timestamp: new Date().toISOString(),
    };
    
    const logLevel = severity === 'critical' ? 'error' : 'warn';
    logLine(logLevel, '[Forecast Coverage Gap]', context);
  },
};
