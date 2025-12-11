/**
 * Structured Logging for Forecast Operations
 * 
 * Provides consistent, structured logging for all forecast-related operations
 * to enable better debugging, monitoring, and alerting.
 */

import { AlertSeverity } from './forecast-monitoring-config';

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
    
    console.log('[Forecast Cron] Started', JSON.stringify(context, null, 2));
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

    console.log('[Forecast Cron] Completed', JSON.stringify(context, null, 2));
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
    
    console.error('[Forecast Cron] Failed', JSON.stringify(errorContext, null, 2));
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
    
    console.error('[Forecast API Error]', JSON.stringify(errorContext, null, 2));
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
    console[logLevel]('[Forecast Stale Data]', JSON.stringify(context, null, 2));
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
    
    console.log('[Forecast Batch Progress]', JSON.stringify(progressContext, null, 2));
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
    
    console.warn('[Forecast Rate Limit]', JSON.stringify(warningContext, null, 2));
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
    console[logLevel]('[Forecast Health Check]', JSON.stringify(context, null, 2));
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
    
    console.warn('[Forecast Slow Query]', JSON.stringify(queryContext, null, 2));
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
    
    console.log('[Forecast Generated]', JSON.stringify(context, null, 2));
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
    console[logLevel]('[Forecast Coverage Gap]', JSON.stringify(context, null, 2));
  },
};
