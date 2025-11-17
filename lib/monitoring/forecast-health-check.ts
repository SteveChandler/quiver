/**
 * Forecast Health Check Utility
 * 
 * Analyzes forecast data freshness across all beaches and provides
 * comprehensive health metrics for monitoring and alerting.
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { isDataStale } from '@/lib/utils/forecast-client-utils';
import { MONITORING_CONFIG, HealthStatus, DataSourceType } from './forecast-monitoring-config';

export interface ForecastHealthMetrics {
  totalBeaches: number;
  beachesWithForecasts: number;
  beachesWithStaleData: number;
  beachesWithCriticalStaleData: number;
  beachesWithWarningStaleData: number;
  coveragePercentage: number;
  oldestForecastAge: number;
  averageForecastAge: number;
  dataSourceBreakdown: Record<string, number>;
  healthStatus: HealthStatus;
  issues: string[];
  staleBeaches: Array<{
    beachId: string;
    beachName: string;
    ageHours: number;
    dataSource: string;
    lastUpdate: string;
  }>;
}

function createEmptyMetrics(status: HealthStatus, issues: string[]): ForecastHealthMetrics {
  return {
    totalBeaches: 0,
    beachesWithForecasts: 0,
    beachesWithStaleData: 0,
    beachesWithCriticalStaleData: 0,
    beachesWithWarningStaleData: 0,
    coveragePercentage: 0,
    oldestForecastAge: 0,
    averageForecastAge: 0,
    dataSourceBreakdown: {},
    healthStatus: status,
    issues,
    staleBeaches: [],
  };
}

export async function checkForecastHealth(): Promise<ForecastHealthMetrics> {
  const supabase = createSupabaseServiceRoleClient();
  
  try {
    const beachesResult = await supabase
      .from('beaches')
      .select('id, name');
    
    if (beachesResult.error || !beachesResult.data) {
      return createEmptyMetrics('critical', ['Failed to fetch beaches: ' + (beachesResult.error?.message || 'Unknown error')]);
    }
    
    const beaches = beachesResult.data;
    const totalBeaches = beaches.length;
    
    if (totalBeaches === 0) {
      return createEmptyMetrics('critical', ['No beaches found in database']);
    }
    
    const forecastsResult = await supabase
      .from('enhanced_forecasts')
      .select('beach_id, updated_at, data_source')
      .order('updated_at', { ascending: false });
    
    if (forecastsResult.error) {
      return createEmptyMetrics('critical', ['Failed to fetch forecasts: ' + forecastsResult.error.message]);
    }
    
    const latestByBeach = new Map<string, any>();
    forecastsResult.data?.forEach(forecast => {
      if (!latestByBeach.has(forecast.beach_id)) {
        latestByBeach.set(forecast.beach_id, forecast);
      }
    });
    
    const beachNameMap = new Map(beaches.map(b => [b.id, b.name]));
    
    let staleCount = 0;
    let criticalStaleCount = 0;
    let warningStaleCount = 0;
    let totalAge = 0;
    let oldestAge = 0;
    const dataSourceCounts: Record<string, number> = {};
    const staleBeaches: Array<{
      beachId: string;
      beachName: string;
      ageHours: number;
      dataSource: string;
      lastUpdate: string;
    }> = [];
    
    latestByBeach.forEach((forecast, beachId) => {
      const age = (Date.now() - new Date(forecast.updated_at).getTime()) / (1000 * 60 * 60);
      totalAge += age;
      oldestAge = Math.max(oldestAge, age);
      
      const dataSource = forecast.data_source || 'UNKNOWN';
      dataSourceCounts[dataSource] = (dataSourceCounts[dataSource] || 0) + 1;
      
      if (isDataStale(forecast.updated_at, dataSource)) {
        staleCount++;
        
        const beachName = (beachNameMap.get(beachId) || 'Unknown Beach') as string;
        staleBeaches.push({
          beachId,
          beachName,
          ageHours: age,
          dataSource,
          lastUpdate: forecast.updated_at,
        });
        
        if (age > MONITORING_CONFIG.CRITICAL_STALE_HOURS) {
          criticalStaleCount++;
        } else if (age > MONITORING_CONFIG.WARNING_STALE_HOURS) {
          warningStaleCount++;
        }
      }
    });
    
    const beachesWithForecasts = latestByBeach.size;
    const coveragePercentage = beachesWithForecasts / totalBeaches;
    const averageForecastAge = beachesWithForecasts > 0 ? totalAge / beachesWithForecasts : 0;
    
    const issues: string[] = [];
    let healthStatus: HealthStatus = 'healthy';
    
    if (criticalStaleCount > 0) {
      issues.push(`${criticalStaleCount} beaches have critically stale data (>${MONITORING_CONFIG.CRITICAL_STALE_HOURS}h)`);
      healthStatus = 'critical';
    }
    
    if (coveragePercentage < MONITORING_CONFIG.MIN_FORECAST_COVERAGE) {
      issues.push(`Low coverage: ${(coveragePercentage * 100).toFixed(1)}% (threshold: ${(MONITORING_CONFIG.MIN_FORECAST_COVERAGE * 100).toFixed(0)}%)`);
      healthStatus = 'critical';
    }
    
    if (staleCount > MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES) {
      issues.push(`${staleCount} beaches have stale data (threshold: ${MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES})`);
      if (healthStatus !== 'critical') {
        healthStatus = 'degraded';
      }
    }
    
    if (warningStaleCount > 0) {
      issues.push(`${warningStaleCount} beaches have warning-level stale data (>${MONITORING_CONFIG.WARNING_STALE_HOURS}h)`);
      if (healthStatus === 'healthy') {
        healthStatus = 'degraded';
      }
    }
    
    staleBeaches.sort((a, b) => b.ageHours - a.ageHours);
    
    return {
      totalBeaches,
      beachesWithForecasts,
      beachesWithStaleData: staleCount,
      beachesWithCriticalStaleData: criticalStaleCount,
      beachesWithWarningStaleData: warningStaleCount,
      coveragePercentage,
      oldestForecastAge: oldestAge,
      averageForecastAge,
      dataSourceBreakdown: dataSourceCounts,
      healthStatus,
      issues,
      staleBeaches,
    };
  } catch (error) {
    return createEmptyMetrics('critical', [
      'Health check failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    ]);
  }
}

export async function getBeachForecastCoverage(beachId: string): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + MONITORING_CONFIG.MIN_FORECAST_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  
  const result = await supabase
    .from('enhanced_forecasts')
    .select('forecast_date', { count: 'exact', head: true })
    .eq('beach_id', beachId)
    .gte('forecast_date', today)
    .lte('forecast_date', futureDate);
  
  if (result.error) {
    console.error('Failed to get beach forecast coverage:', result.error);
    return 0;
  }
  
  return result.data?.length || 0;
}
