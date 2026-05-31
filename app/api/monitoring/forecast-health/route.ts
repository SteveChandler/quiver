/**
 * Forecast Health Monitoring API
 * 
 * GET /api/monitoring/forecast-health
 * Returns comprehensive health metrics for forecast data across all beaches
 */

import { NextResponse } from 'next/server';
import { checkForecastHealth } from '@/lib/monitoring/forecast-health-check';
import { forecastLogger } from '@/lib/monitoring/forecast-logger';
import { withObservedCron } from '@/lib/cron/observability';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const SENTRY_MONITOR = {
  slug: "forecast-health",
  schedule: "*/30 * * * *",
  maxRuntimeMinutes: 3,
};

function formatCoverage(coverage: number): string {
  return `${(coverage * 100).toFixed(1)}%`;
}

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
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

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Run health check
    const metrics = await checkForecastHealth();
    
    // Log the health check results
    const sources = metrics.sources;
    forecastLogger.healthCheck(metrics.healthStatus, {
      totalBeaches: metrics.totalBeaches,
      supabaseProjectRef: getSupabaseProjectRef(),
      enhancedAvailable: metrics.enhancedAvailable,
      coverage: metrics.enhancedAvailable ? formatCoverage(metrics.coveragePercentage) : 'unavailable',
      staleBeaches: metrics.beachesWithStaleData,
      criticalStale: metrics.beachesWithCriticalStaleData,
      warningStale: metrics.beachesWithWarningStaleData,
      oldestForecastAge: metrics.enhancedAvailable ? formatHours(metrics.oldestForecastAge) : 'unavailable',
      averageForecastAge: metrics.enhancedAvailable ? formatHours(metrics.averageForecastAge) : 'unavailable',
      sources: {
        enhanced: {
          available: sources.enhanced.available,
          coverage: sources.enhanced.available ? formatCoverage(sources.enhanced.coveragePercentage) : 'unavailable',
          stale: sources.enhanced.beachesWithStaleData,
          critical: sources.enhanced.beachesWithCriticalStaleData,
          warning: sources.enhanced.beachesWithWarningStaleData,
          oldestAgeHours: sources.enhanced.available ? Number(sources.enhanced.oldestAgeHours.toFixed(2)) : null,
          averageAgeHours: sources.enhanced.available ? Number(sources.enhanced.averageAgeHours.toFixed(2)) : null,
        },
        marine: {
          available: sources.marine.available,
          coverage: sources.marine.available ? formatCoverage(sources.marine.coveragePercentage) : 'unavailable',
          stale: sources.marine.beachesWithStaleData,
          critical: sources.marine.beachesWithCriticalStaleData,
          warning: sources.marine.beachesWithWarningStaleData,
          oldestAgeHours: sources.marine.available ? Number(sources.marine.oldestAgeHours.toFixed(2)) : null,
          averageAgeHours: sources.marine.available ? Number(sources.marine.averageAgeHours.toFixed(2)) : null,
        },
        tide: {
          available: sources.tide.available,
          coverage: sources.tide.available ? formatCoverage(sources.tide.coveragePercentage) : 'unavailable',
          stale: sources.tide.beachesWithStaleData,
          critical: sources.tide.beachesWithCriticalStaleData,
          warning: sources.tide.beachesWithWarningStaleData,
          oldestAgeHours: sources.tide.available ? Number(sources.tide.oldestAgeHours.toFixed(2)) : null,
          averageAgeHours: sources.tide.available ? Number(sources.tide.averageAgeHours.toFixed(2)) : null,
        },
        sun: {
          available: sources.sun.available,
          coverage: sources.sun.available ? formatCoverage(sources.sun.coveragePercentage) : 'unavailable',
          stale: sources.sun.beachesWithStaleData,
          critical: sources.sun.beachesWithCriticalStaleData,
          warning: sources.sun.beachesWithWarningStaleData,
          oldestAgeHours: sources.sun.available ? Number(sources.sun.oldestAgeHours.toFixed(2)) : null,
          averageAgeHours: sources.sun.available ? Number(sources.sun.averageAgeHours.toFixed(2)) : null,
        },
        ioos: {
          available: sources.ioos.available,
          coverage: sources.ioos.available ? formatCoverage(sources.ioos.coveragePercentage) : 'unavailable',
          stale: sources.ioos.beachesWithStaleData,
          critical: sources.ioos.beachesWithCriticalStaleData,
          warning: sources.ioos.beachesWithWarningStaleData,
          oldestAgeHours: sources.ioos.available ? Number(sources.ioos.oldestAgeHours.toFixed(2)) : null,
          averageAgeHours: sources.ioos.available ? Number(sources.ioos.averageAgeHours.toFixed(2)) : null,
        },
      },
      issues: metrics.issues,
    });
    
    // Log coverage gaps if present
    if (metrics.enhancedAvailable && metrics.coveragePercentage < 0.9) {
      forecastLogger.coverageGap(
        metrics.totalBeaches,
        metrics.beachesWithForecasts,
        metrics.coveragePercentage,
        metrics.healthStatus === 'critical' ? 'critical' : 'warning'
      );
    }
    
    // Log individual stale beaches
    // NOTE: staleBeaches only contains beaches that exceed the warning threshold,
    // so severity is either 'critical' (>24h) or 'warning' (>12h but <=24h).
    const enhancedCriticalHours = sources.enhanced.thresholds.criticalHours;
    metrics.staleBeaches.slice(0, 10).forEach(beach => {
      forecastLogger.staleDataDetected(
        beach.beachId,
        beach.beachName,
        beach.ageHours,
        beach.dataSource,
        beach.ageHours > enhancedCriticalHours ? 'critical' : 'warning'
      );
    });
    
    const duration = Date.now() - startTime;
    
    // Return metrics
    return NextResponse.json({
      success: true,
      metrics,
      meta: {
        timestamp: new Date().toISOString(),
        durationMs: duration,
      },
    }, {
      status: metrics.healthStatus === 'critical' ? 503 : 200,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Forecast Health Check] Error:', error);
    
    forecastLogger.apiError('/api/monitoring/forecast-health', 
      error instanceof Error ? error : new Error(errorMessage)
    );
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export const GET = withObservedCron("/api/monitoring/forecast-health", _GET, SENTRY_MONITOR);
