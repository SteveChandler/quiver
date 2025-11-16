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

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // Run health check
    const metrics = await checkForecastHealth();
    
    // Log the health check results
    forecastLogger.healthCheck(metrics.healthStatus, {
      coverage: `${(metrics.coveragePercentage * 100).toFixed(1)}%`,
      staleBeaches: metrics.beachesWithStaleData,
      criticalStale: metrics.beachesWithCriticalStaleData,
      warningStale: metrics.beachesWithWarningStaleData,
      oldestForecastAge: `${metrics.oldestForecastAge.toFixed(2)}h`,
      averageForecastAge: `${metrics.averageForecastAge.toFixed(2)}h`,
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
    metrics.staleBeaches.slice(0, 10).forEach(beach => {
      forecastLogger.staleDataDetected(
        beach.beachId,
        beach.beachName,
        beach.ageHours,
        beach.dataSource,
        beach.ageHours > 24 ? 'critical' : beach.ageHours > 12 ? 'error' : 'warning'
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
