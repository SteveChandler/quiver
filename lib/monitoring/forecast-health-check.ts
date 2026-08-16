/**
 * Forecast Health Check Utility
 * 
 * Analyzes forecast data freshness across all beaches and provides
 * comprehensive health metrics for monitoring and alerting.
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { MONITORING_CONFIG, HealthStatus, DataSourceType } from './forecast-monitoring-config';

type HealthSourceKey = 'enhanced' | 'marine' | 'tide' | 'sun' | 'ioos';

export interface ForecastSourceHealthMetrics {
  source: HealthSourceKey;
  /**
   * Whether the underlying query for this source succeeded.
   * If false, metrics reflect "unavailable" (not "0 coverage").
   */
  available: boolean;
  beachesWithData: number;
  coveragePercentage: number;
  beachesWithStaleData: number;
  beachesWithCriticalStaleData: number;
  beachesWithWarningStaleData: number;
  oldestAgeHours: number;
  averageAgeHours: number;
  thresholds: {
    warningHours: number;
    criticalHours: number;
  };
}

/**
 * IOOS station health row from database query
 */
interface IOOSStationHealthRow {
  station_id: string;
  source_network: string | null;
  last_seen_at: string;
  active: boolean;
  nearest_beach_id: string | null;
}

export interface ForecastHealthMetrics {
  totalBeaches: number;
  /**
   * Whether enhanced (primary) latest-per-beach metrics were successfully computed.
   * When false, coverage/age rollups are not meaningful and should be treated as unavailable.
   */
  enhancedAvailable: boolean;
  /**
   * Backwards-compatible: this refers to enhanced forecasts coverage.
   */
  beachesWithForecasts: number;
  beachesWithStaleData: number;
  beachesWithCriticalStaleData: number;
  beachesWithWarningStaleData: number;
  coveragePercentage: number;
  oldestForecastAge: number;
  averageForecastAge: number;
  dataSourceBreakdown: Record<string, number>;
  sources: Record<HealthSourceKey, ForecastSourceHealthMetrics>;
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
  const emptySource = (source: HealthSourceKey): ForecastSourceHealthMetrics => ({
    source,
    available: false,
    beachesWithData: 0,
    coveragePercentage: 0,
    beachesWithStaleData: 0,
    beachesWithCriticalStaleData: 0,
    beachesWithWarningStaleData: 0,
    oldestAgeHours: 0,
    averageAgeHours: 0,
    thresholds: { warningHours: 0, criticalHours: 0 },
  });

  return {
    totalBeaches: 0,
    enhancedAvailable: false,
    beachesWithForecasts: 0,
    beachesWithStaleData: 0,
    beachesWithCriticalStaleData: 0,
    beachesWithWarningStaleData: 0,
    coveragePercentage: 0,
    oldestForecastAge: 0,
    averageForecastAge: 0,
    dataSourceBreakdown: {},
    sources: {
      enhanced: emptySource('enhanced'),
      marine: emptySource('marine'),
      tide: emptySource('tide'),
      sun: emptySource('sun'),
      ioos: emptySource('ioos'),
    },
    healthStatus: status,
    issues,
    staleBeaches: [],
  };
}

function mergeHealthStatus(current: HealthStatus, next: HealthStatus): HealthStatus {
  if (current === 'critical' || next === 'critical') return 'critical';
  if (current === 'degraded' || next === 'degraded') return 'degraded';
  return 'healthy';
}

function statusFromCounts(critical: number, warning: number, stale: number, thresholdBeaches: number): HealthStatus {
  if (critical > 0) return 'critical';
  if (stale > thresholdBeaches || warning > 0) return 'degraded';
  return 'healthy';
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
    
    const beachNameMap = new Map(beaches.map(b => [b.id, b.name]));

    /**
     * Read the latest rows per beach via DB views (1 row/beach).
     * This avoids PostgREST row-cap pitfalls on base tables.
     *
     * PERFORMANCE: All 4 view queries run in parallel to minimize latency.
     * Each query is independent and can execute concurrently.
     */
    const [
      latestEnhancedResult,
      latestMarineResult,
      latestTideResult,
      latestSunResult,
      ioosStationsResult,
    ] = await Promise.all([
      supabase.from('v_enhanced_forecast_latest').select('beach_id, updated_at, data_source'),
      supabase.from('v_marine_forecast_latest').select('beach_id, created_at, ts, source, is_observed'),
      supabase.from('v_tide_forecast_latest').select('beach_id, created_at, ts, source'),
      supabase.from('v_sun_times_latest').select('beach_id, created_at, date, source'),
      supabase.from('ioos_stations').select('station_id, source_network, last_seen_at, active, nearest_beach_id').eq('active', true),
    ]);

    const issues: string[] = [];
    let enhancedAvailable = true;
    let marineAvailable = true;
    let tideAvailable = true;
    let sunAvailable = true;
    let ioosAvailable = true;

    // Process enhanced forecasts
    const latestEnhancedByBeach = new Map<string, { beach_id: string; updated_at: string; data_source: string | null }>();
    if (latestEnhancedResult.error) {
      enhancedAvailable = false;
      issues.push('Failed to fetch latest enhanced forecasts: ' + latestEnhancedResult.error.message);
    } else {
      (latestEnhancedResult.data ?? []).forEach((row: any) => {
        if (!row?.beach_id || !row.updated_at) return;
        // Defensive: ignore orphaned forecast rows that don't map to a known beach.
        // (This can happen if the DB has legacy rows without FK constraints.)
        if (!beachNameMap.has(row.beach_id)) return;
        latestEnhancedByBeach.set(row.beach_id, {
          beach_id: row.beach_id,
          updated_at: row.updated_at,
          data_source: row.data_source ?? null,
        });
      });
    }

    // Process marine forecasts
    const latestMarineByBeach = new Map<string, { beach_id: string; created_at: string; ts: string; source: string | null; is_observed: boolean | null }>();
    if (latestMarineResult.error) {
      marineAvailable = false;
      issues.push('Failed to fetch latest marine forecasts: ' + latestMarineResult.error.message);
    } else {
      (latestMarineResult.data ?? []).forEach((row: any) => {
        if (!row?.beach_id || !row.created_at) return;
        if (!beachNameMap.has(row.beach_id)) return;
        latestMarineByBeach.set(row.beach_id, {
          beach_id: row.beach_id,
          created_at: row.created_at,
          ts: row.ts,
          source: row.source ?? null,
          is_observed: row.is_observed ?? null,
        });
      });
    }

    // Process tide forecasts
    const latestTideByBeach = new Map<string, { beach_id: string; created_at: string; ts: string; source: string | null }>();
    if (latestTideResult.error) {
      tideAvailable = false;
      issues.push('Failed to fetch latest tide forecasts: ' + latestTideResult.error.message);
    } else {
      (latestTideResult.data ?? []).forEach((row: any) => {
        if (!row?.beach_id || !row.created_at) return;
        if (!beachNameMap.has(row.beach_id)) return;
        latestTideByBeach.set(row.beach_id, {
          beach_id: row.beach_id,
          created_at: row.created_at,
          ts: row.ts,
          source: row.source ?? null,
        });
      });
    }

    // Process sun times
    const latestSunByBeach = new Map<string, { beach_id: string; created_at: string; date: string; source: string | null }>();
    if (latestSunResult.error) {
      sunAvailable = false;
      issues.push('Failed to fetch latest sun times: ' + latestSunResult.error.message);
    } else {
      (latestSunResult.data ?? []).forEach((row: any) => {
        if (!row?.beach_id || !row.created_at) return;
        if (!beachNameMap.has(row.beach_id)) return;
        latestSunByBeach.set(row.beach_id, {
          beach_id: row.beach_id,
          created_at: row.created_at,
          date: row.date,
          source: row.source ?? null,
        });
      });
    }
    
    const nowMs = Date.now();

    const ENHANCED_THRESHOLDS = {
      warningHours: MONITORING_CONFIG.WARNING_STALE_HOURS,
      criticalHours: MONITORING_CONFIG.CRITICAL_STALE_HOURS,
    };
    // Use configurable thresholds from MONITORING_CONFIG (aligned with cron refresh windows)
    const MARINE_THRESHOLDS = {
      warningHours: MONITORING_CONFIG.MARINE_WARNING_HOURS,
      criticalHours: MONITORING_CONFIG.MARINE_CRITICAL_HOURS,
    };
    const TIDE_THRESHOLDS = {
      warningHours: MONITORING_CONFIG.TIDE_WARNING_HOURS,
      criticalHours: MONITORING_CONFIG.TIDE_CRITICAL_HOURS,
    };
    const SUN_THRESHOLDS = {
      warningHours: MONITORING_CONFIG.SUN_WARNING_HOURS,
      criticalHours: MONITORING_CONFIG.SUN_CRITICAL_HOURS,
    };
    const IOOS_THRESHOLDS = {
      warningHours: MONITORING_CONFIG.IOOS_WARNING_HOURS,
      criticalHours: MONITORING_CONFIG.IOOS_CRITICAL_HOURS,
    };

    // Process IOOS stations (uses last_seen_at - measures station freshness by beach coverage)
    const ioosStationsByBeach = new Map<string, { station_id: string; last_seen_at: string; source_network: string | null }>();
    if (ioosStationsResult.error) {
      ioosAvailable = false;
      issues.push('Failed to fetch IOOS stations: ' + ioosStationsResult.error.message);
    } else {
      (ioosStationsResult.data ?? []).forEach((row: any) => {
        if (!row.station_id || !row.last_seen_at || !row.nearest_beach_id) return;
        // Track one station per beach (most recent wins)
        const existing = ioosStationsByBeach.get(row.nearest_beach_id);
        if (!existing || new Date(row.last_seen_at) > new Date(existing.last_seen_at)) {
          ioosStationsByBeach.set(row.nearest_beach_id, {
            station_id: row.station_id,
            last_seen_at: row.last_seen_at,
            source_network: row.source_network ?? null,
          });
        }
      });
    }

    const enhancedStaleBeaches: ForecastHealthMetrics['staleBeaches'] = [];
    const dataSourceCounts: Record<string, number> = {};

    // Enhanced (uses updated_at)
    let enhancedTotalAge = 0;
    let enhancedOldestAge = 0;
    let enhancedStale = 0;
    let enhancedCritical = 0;
    let enhancedWarning = 0;
    if (enhancedAvailable) {
      latestEnhancedByBeach.forEach((forecast, beachId) => {
        const age = (nowMs - new Date(forecast.updated_at).getTime()) / (1000 * 60 * 60);
        enhancedTotalAge += age;
        enhancedOldestAge = Math.max(enhancedOldestAge, age);
        const dataSource = forecast.data_source || 'UNKNOWN';
        dataSourceCounts[dataSource] = (dataSourceCounts[dataSource] || 0) + 1;

        if (age > ENHANCED_THRESHOLDS.warningHours) {
          enhancedStale += 1;
          if (age > ENHANCED_THRESHOLDS.criticalHours) enhancedCritical += 1;
          else enhancedWarning += 1;

          enhancedStaleBeaches.push({
            beachId,
            beachName: (beachNameMap.get(beachId) || 'Unknown Beach') as string,
            ageHours: age,
            dataSource,
            lastUpdate: forecast.updated_at,
          });
        }
      });
    }

    const enhancedBeachesWithData = latestEnhancedByBeach.size;
    const enhancedCoverage = Math.min(1, enhancedBeachesWithData / totalBeaches);
    const enhancedAvgAge = enhancedBeachesWithData > 0 ? enhancedTotalAge / enhancedBeachesWithData : 0;

    // Marine (uses created_at)
    let marineTotalAge = 0;
    let marineOldestAge = 0;
    let marineStale = 0;
    let marineCritical = 0;
    let marineWarning = 0;
    if (marineAvailable) {
      latestMarineByBeach.forEach((row) => {
        const age = (nowMs - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
        marineTotalAge += age;
        marineOldestAge = Math.max(marineOldestAge, age);
        if (age > MARINE_THRESHOLDS.warningHours) {
          marineStale += 1;
          if (age > MARINE_THRESHOLDS.criticalHours) marineCritical += 1;
          else marineWarning += 1;
        }
      });
    }
    const marineBeachesWithData = latestMarineByBeach.size;
    const marineCoverage = Math.min(1, marineBeachesWithData / totalBeaches);
    const marineAvgAge = marineBeachesWithData > 0 ? marineTotalAge / marineBeachesWithData : 0;

    // Tide (uses created_at)
    let tideTotalAge = 0;
    let tideOldestAge = 0;
    let tideStale = 0;
    let tideCritical = 0;
    let tideWarning = 0;
    if (tideAvailable) {
      latestTideByBeach.forEach((row) => {
        const age = (nowMs - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
        tideTotalAge += age;
        tideOldestAge = Math.max(tideOldestAge, age);
        if (age > TIDE_THRESHOLDS.warningHours) {
          tideStale += 1;
          if (age > TIDE_THRESHOLDS.criticalHours) tideCritical += 1;
          else tideWarning += 1;
        }
      });
    }
    const tideBeachesWithData = latestTideByBeach.size;
    const tideCoverage = Math.min(1, tideBeachesWithData / totalBeaches);
    const tideAvgAge = tideBeachesWithData > 0 ? tideTotalAge / tideBeachesWithData : 0;

    // Sun (uses created_at)
    let sunTotalAge = 0;
    let sunOldestAge = 0;
    let sunStale = 0;
    let sunCritical = 0;
    let sunWarning = 0;
    if (sunAvailable) {
      latestSunByBeach.forEach((row) => {
        const age = (nowMs - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
        sunTotalAge += age;
        sunOldestAge = Math.max(sunOldestAge, age);
        if (age > SUN_THRESHOLDS.warningHours) {
          sunStale += 1;
          if (age > SUN_THRESHOLDS.criticalHours) sunCritical += 1;
          else sunWarning += 1;
        }
      });
    }
    const sunBeachesWithData = latestSunByBeach.size;
    const sunCoverage = Math.min(1, sunBeachesWithData / totalBeaches);
    const sunAvgAge = sunBeachesWithData > 0 ? sunTotalAge / sunBeachesWithData : 0;

    // IOOS (uses last_seen_at - tracks station freshness per beach)
    let ioosTotalAge = 0;
    let ioosOldestAge = 0;
    let ioosStale = 0;
    let ioosCritical = 0;
    let ioosWarning = 0;
    if (ioosAvailable) {
      ioosStationsByBeach.forEach((station) => {
        const age = (nowMs - new Date(station.last_seen_at).getTime()) / (1000 * 60 * 60);
        ioosTotalAge += age;
        ioosOldestAge = Math.max(ioosOldestAge, age);
        if (age > IOOS_THRESHOLDS.warningHours) {
          ioosStale += 1;
          if (age > IOOS_THRESHOLDS.criticalHours) ioosCritical += 1;
          else ioosWarning += 1;
        }
      });
    }
    const ioosBeachesWithData = ioosStationsByBeach.size;
    const ioosCoverage = Math.min(1, ioosBeachesWithData / totalBeaches);
    const ioosAvgAge = ioosBeachesWithData > 0 ? ioosTotalAge / ioosBeachesWithData : 0;

    // Overall rollups (backwards-compatible fields reflect enhanced).
    let healthStatus: HealthStatus = 'healthy';

    // Coverage: keep existing minimum coverage check on enhanced forecasts.
    if (!enhancedAvailable) {
      issues.push('Enhanced forecast health is unavailable (latest view query failed)');
      healthStatus = 'critical';
    } else if (enhancedCoverage < MONITORING_CONFIG.MIN_FORECAST_COVERAGE) {
      issues.push(`Low enhanced forecast coverage: ${(enhancedCoverage * 100).toFixed(1)}% (threshold: ${(MONITORING_CONFIG.MIN_FORECAST_COVERAGE * 100).toFixed(0)}%)`);
      healthStatus = 'critical';
    }

    const enhancedStatus = enhancedAvailable
      ? statusFromCounts(
          enhancedCritical,
          enhancedWarning,
          enhancedStale,
          MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES
        )
      : 'critical';
    const marineStatus = marineAvailable
      ? statusFromCounts(marineCritical, marineWarning, marineStale, MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES)
      : 'degraded';
    const tideStatus = tideAvailable
      ? statusFromCounts(tideCritical, tideWarning, tideStale, MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES)
      : 'degraded';
    const sunStatus = sunAvailable
      ? statusFromCounts(sunCritical, sunWarning, sunStale, MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES)
      : 'degraded';
    const ioosStatus = ioosAvailable
      ? statusFromCounts(ioosCritical, ioosWarning, ioosStale, MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES)
      : 'degraded';

    /**
     * Overall health semantics:
     * - "critical" is reserved for enhanced forecast cache failures (coverage or critical staleness),
     *   because enhanced forecasts are the primary user-facing data source.
     * - marine/tide/sun/ioos issues can degrade experience but should not page/alert as "critical" by default.
     */
    healthStatus = mergeHealthStatus(healthStatus, enhancedStatus);
    if (healthStatus !== 'critical') {
      const secondaryStatuses: HealthStatus[] = [marineStatus, tideStatus, sunStatus, ioosStatus];
      if (secondaryStatuses.some((s) => s !== 'healthy')) {
        healthStatus = 'degraded';
      }
    }

    if (enhancedAvailable && enhancedCritical > 0) {
      issues.push(`${enhancedCritical} beaches have critically stale enhanced forecasts (>${ENHANCED_THRESHOLDS.criticalHours}h)`);
    }
    if (enhancedAvailable && enhancedStale > MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES) {
      issues.push(`${enhancedStale} beaches have stale enhanced forecasts (threshold: ${MONITORING_CONFIG.STALE_DATA_THRESHOLD_BEACHES})`);
    }
    if (enhancedAvailable && enhancedWarning > 0) {
      issues.push(`${enhancedWarning} beaches have warning-level enhanced forecast staleness (>${ENHANCED_THRESHOLDS.warningHours}h)`);
    }

    if (marineAvailable && marineCritical > 0) issues.push(`${marineCritical} beaches have critically stale marine data (>${MARINE_THRESHOLDS.criticalHours}h)`);
    if (tideAvailable && tideCritical > 0) issues.push(`${tideCritical} beaches have critically stale tide data (>${TIDE_THRESHOLDS.criticalHours}h)`);
    if (sunAvailable && sunCritical > 0) issues.push(`${sunCritical} beaches have critically stale sun times data (>${SUN_THRESHOLDS.criticalHours}h)`);
    if (ioosAvailable && ioosCritical > 0) issues.push(`${ioosCritical} beaches have critically stale IOOS data (>${IOOS_THRESHOLDS.criticalHours}h)`);

    // Sort stale beaches for reporting (enhanced only for now, keeps contract stable).
    enhancedStaleBeaches.sort((a, b) => b.ageHours - a.ageHours);

    const sources: ForecastHealthMetrics['sources'] = {
      enhanced: {
        source: 'enhanced',
        available: enhancedAvailable,
        beachesWithData: enhancedBeachesWithData,
        coveragePercentage: enhancedCoverage,
        beachesWithStaleData: enhancedStale,
        beachesWithCriticalStaleData: enhancedCritical,
        beachesWithWarningStaleData: enhancedWarning,
        oldestAgeHours: enhancedOldestAge,
        averageAgeHours: enhancedAvgAge,
        thresholds: ENHANCED_THRESHOLDS,
      },
      marine: {
        source: 'marine',
        available: marineAvailable,
        beachesWithData: marineBeachesWithData,
        coveragePercentage: marineCoverage,
        beachesWithStaleData: marineStale,
        beachesWithCriticalStaleData: marineCritical,
        beachesWithWarningStaleData: marineWarning,
        oldestAgeHours: marineOldestAge,
        averageAgeHours: marineAvgAge,
        thresholds: MARINE_THRESHOLDS,
      },
      tide: {
        source: 'tide',
        available: tideAvailable,
        beachesWithData: tideBeachesWithData,
        coveragePercentage: tideCoverage,
        beachesWithStaleData: tideStale,
        beachesWithCriticalStaleData: tideCritical,
        beachesWithWarningStaleData: tideWarning,
        oldestAgeHours: tideOldestAge,
        averageAgeHours: tideAvgAge,
        thresholds: TIDE_THRESHOLDS,
      },
      sun: {
        source: 'sun',
        available: sunAvailable,
        beachesWithData: sunBeachesWithData,
        coveragePercentage: sunCoverage,
        beachesWithStaleData: sunStale,
        beachesWithCriticalStaleData: sunCritical,
        beachesWithWarningStaleData: sunWarning,
        oldestAgeHours: sunOldestAge,
        averageAgeHours: sunAvgAge,
        thresholds: SUN_THRESHOLDS,
      },
      ioos: {
        source: 'ioos',
        available: ioosAvailable,
        beachesWithData: ioosBeachesWithData,
        coveragePercentage: ioosCoverage,
        beachesWithStaleData: ioosStale,
        beachesWithCriticalStaleData: ioosCritical,
        beachesWithWarningStaleData: ioosWarning,
        oldestAgeHours: ioosOldestAge,
        averageAgeHours: ioosAvgAge,
        thresholds: IOOS_THRESHOLDS,
      },
    };

    // Backwards-compatible rollups (enhanced forecasts only).
    return {
      totalBeaches,
      enhancedAvailable,
      beachesWithForecasts: enhancedBeachesWithData,
      beachesWithStaleData: enhancedStale,
      beachesWithCriticalStaleData: enhancedCritical,
      beachesWithWarningStaleData: enhancedWarning,
      coveragePercentage: enhancedCoverage,
      oldestForecastAge: enhancedOldestAge,
      averageForecastAge: enhancedAvgAge,
      dataSourceBreakdown: dataSourceCounts,
      sources,
      healthStatus,
      issues,
      staleBeaches: enhancedStaleBeaches,
    };
  } catch (error) {
    return createEmptyMetrics('critical', [
      'Health check failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    ]);
  }
}

async function getBeachForecastCoverage(beachId: string): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + MONITORING_CONFIG.MIN_FORECAST_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const futureDateNextDay = new Date(new Date(futureDate + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];

  const result = await supabase
    .from('enhanced_forecasts')
    .select('forecast_at', { count: 'exact', head: true })
    .eq('beach_id', beachId)
    .gte('forecast_at', `${today}T00:00:00Z`)
    .lt('forecast_at', `${futureDateNextDay}T00:00:00Z`);
  
  if (result.error) {
    console.error('Failed to get beach forecast coverage:', result.error);
    return 0;
  }
  
  return result.count ?? 0;
}
