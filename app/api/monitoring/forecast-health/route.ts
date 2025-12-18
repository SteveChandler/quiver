/**
 * Forecast Health Monitoring API
 * 
 * GET /api/monitoring/forecast-health
 * Returns comprehensive health metrics for forecast data across all beaches
 */

import { NextResponse } from 'next/server';
import { checkForecastHealth } from '@/lib/monitoring/forecast-health-check';
import { forecastLogger } from '@/lib/monitoring/forecast-logger';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // Run health check
    const metrics = await checkForecastHealth();
    
    // Log the health check results
    const sources = metrics.sources;
    forecastLogger.healthCheck(metrics.healthStatus, {
      totalBeaches: metrics.totalBeaches,
      supabaseProjectRef: getSupabaseProjectRef(),
      coverage: `${(metrics.coveragePercentage * 100).toFixed(1)}%`,
      staleBeaches: metrics.beachesWithStaleData,
      criticalStale: metrics.beachesWithCriticalStaleData,
      warningStale: metrics.beachesWithWarningStaleData,
      oldestForecastAge: `${metrics.oldestForecastAge.toFixed(2)}h`,
      averageForecastAge: `${metrics.averageForecastAge.toFixed(2)}h`,
      sources: {
        enhanced: {
          coverage: `${(sources.enhanced.coveragePercentage * 100).toFixed(1)}%`,
          stale: sources.enhanced.beachesWithStaleData,
          critical: sources.enhanced.beachesWithCriticalStaleData,
          warning: sources.enhanced.beachesWithWarningStaleData,
          oldestAgeHours: Number(sources.enhanced.oldestAgeHours.toFixed(2)),
          averageAgeHours: Number(sources.enhanced.averageAgeHours.toFixed(2)),
        },
        marine: {
          coverage: `${(sources.marine.coveragePercentage * 100).toFixed(1)}%`,
          stale: sources.marine.beachesWithStaleData,
          critical: sources.marine.beachesWithCriticalStaleData,
          warning: sources.marine.beachesWithWarningStaleData,
          oldestAgeHours: Number(sources.marine.oldestAgeHours.toFixed(2)),
          averageAgeHours: Number(sources.marine.averageAgeHours.toFixed(2)),
        },
        tide: {
          coverage: `${(sources.tide.coveragePercentage * 100).toFixed(1)}%`,
          stale: sources.tide.beachesWithStaleData,
          critical: sources.tide.beachesWithCriticalStaleData,
          warning: sources.tide.beachesWithWarningStaleData,
          oldestAgeHours: Number(sources.tide.oldestAgeHours.toFixed(2)),
          averageAgeHours: Number(sources.tide.averageAgeHours.toFixed(2)),
        },
        sun: {
          coverage: `${(sources.sun.coveragePercentage * 100).toFixed(1)}%`,
          stale: sources.sun.beachesWithStaleData,
          critical: sources.sun.beachesWithCriticalStaleData,
          warning: sources.sun.beachesWithWarningStaleData,
          oldestAgeHours: Number(sources.sun.oldestAgeHours.toFixed(2)),
          averageAgeHours: Number(sources.sun.averageAgeHours.toFixed(2)),
        },
      },
      issues: metrics.issues,
    });
    
    // Log coverage gaps if present
    if (metrics.coveragePercentage < 0.9) {
      forecastLogger.coverageGap(
        metrics.totalBeaches,
        metrics.beachesWithForecasts,
        metrics.coveragePercentage,
        metrics.healthStatus === 'critical' ? 'critical' : 'warning'
      );
    }
    
    // Log individual stale beaches
    const enhancedWarningHours = sources.enhanced.thresholds.warningHours;
    const enhancedCriticalHours = sources.enhanced.thresholds.criticalHours;
    metrics.staleBeaches.slice(0, 10).forEach(beach => {
      forecastLogger.staleDataDetected(
        beach.beachId,
        beach.beachName,
        beach.ageHours,
        beach.dataSource,
        beach.ageHours > enhancedCriticalHours
          ? 'critical'
          : beach.ageHours > enhancedWarningHours
            ? 'error'
            : 'warning'
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
