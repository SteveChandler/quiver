/**
 * Forecast Staleness Threshold Usage Examples
 *
 * This file demonstrates how to use the new source-specific
 * staleness threshold system in Quiver.
 */

import { isDataStale, getStalenessDetails } from '@/lib/utils/forecast-client-utils';
import { getStalenessThreshold, STALENESS_THRESHOLDS } from '@/lib/config/forecast-staleness';
import type { EnhancedForecastEntity } from '@/types/forecast';

// ============================================================================
// Example 1: Basic Staleness Check in a Component
// ============================================================================

function ForecastCard({ forecast }: { forecast: EnhancedForecastEntity }) {
  // Simple boolean check - is the data stale?
  const isStale = isDataStale(forecast.updated_at, forecast.data_source);

  return (
    <div className={isStale ? 'opacity-60' : ''}>
      {isStale && (
        <div className="text-yellow-600 text-sm">
          ⚠️ This forecast data may be outdated
        </div>
      )}
      <div>Wave Height: {forecast.wave_height}</div>
      <div>Data Source: {forecast.data_source}</div>
    </div>
  );
}

// ============================================================================
// Example 2: Detailed Staleness Information for Logging
// ============================================================================

function logForecastStatus(forecast: EnhancedForecastEntity) {
  const details = getStalenessDetails(forecast.updated_at, forecast.data_source);

  console.log('Forecast Status:', {
    beachId: forecast.beach_id,
    dataSource: forecast.data_source,
    lastUpdated: forecast.updated_at,
    hoursSinceUpdate: details.hoursSinceUpdate.toFixed(2),
    stalenessThreshold: details.threshold,
    isStale: details.isStale,
    status: details.reason,
  });

  // Example output for CDIP data 2 hours old:
  // {
  //   beachId: 'abc-123',
  //   dataSource: 'CDIP',
  //   lastUpdated: '2024-01-15T10:00:00Z',
  //   hoursSinceUpdate: '2.00',
  //   stalenessThreshold: 4,
  //   isStale: true,
  //   status: 'Exceeded source-specific threshold'
  // }
}

// ============================================================================
// Example 3: API Response with Staleness Metadata
// ============================================================================

async function getForecastWithMetadata(beachId: string) {
  const response = await fetch(`/api/forecasts/update-enhanced?beachId=${beachId}`);
  const data = await response.json();

  // Response now includes staleness metadata:
  // {
  //   data: {
  //     forecasts: [...],
  //     metadata: {
  //       dataSource: 'CDIP',
  //       lastUpdated: '2024-01-15T10:00:00Z',
  //       isStale: true,
  //       stalenessThreshold: 1.5,
  //       dataAge: '2h old'
  //     }
  //   }
  // }

  return data;
}

// ============================================================================
// Example 4: Direct Threshold Access
// ============================================================================

function displayThresholds() {
  console.log('Staleness Thresholds:');
  console.log('CDIP (buoy data):', getStalenessThreshold('CDIP'), 'hours');
  console.log('NOAA WaveWatch:', getStalenessThreshold('NOAA_NWS'), 'hours');
  console.log('Fallback data:', getStalenessThreshold('FALLBACK'), 'hours');
  console.log('Unknown source:', getStalenessThreshold('UNKNOWN'), 'hours');

  // Or access the constants directly:
  console.log('All thresholds:', STALENESS_THRESHOLDS);
  // {
  //   CDIP: 4,
  //   NOAA_NWS: 12,
  //   FALLBACK: 12,
  //   DEFAULT: 6
  // }
}

// ============================================================================
// Example 5: Conditional UI Based on Data Source and Freshness
// ============================================================================

function ForecastFreshnessIndicator({ forecast }: { forecast: EnhancedForecastEntity }) {
  const details = getStalenessDetails(forecast.updated_at, forecast.data_source);
  const dataSource = forecast.data_source || 'UNKNOWN';

  // Different messages based on source and staleness
  if (!details.isStale) {
    if (dataSource === 'CDIP') {
      return (
        <div className="bg-green-100 text-green-800 p-2 rounded">
          ✅ Live buoy data (updated within last {details.threshold}h)
        </div>
      );
    } else if (dataSource === 'NOAA_NWS') {
      return (
        <div className="bg-blue-100 text-blue-800 p-2 rounded">
          📊 Fresh forecast model data
        </div>
      );
    }
  } else {
    const hoursSinceUpdate = Math.floor(details.hoursSinceUpdate);
    return (
      <div className="bg-yellow-100 text-yellow-800 p-2 rounded">
        ⚠️ Data from {hoursSinceUpdate}h ago (threshold: {details.threshold}h for {dataSource})
      </div>
    );
  }

  return null;
}

// ============================================================================
// Example 6: Server-Side Metadata Extraction
// ============================================================================

function extractForecastMetadata(forecast: EnhancedForecastEntity) {
  const dataSource = forecast.data_source || 'FALLBACK';
  const staleData = isDataStale(forecast.updated_at, dataSource);

  return {
    primarySource: dataSource,
    confidenceScore: forecast.confidence_score ?? 50,
    lastUpdated: forecast.updated_at,
    isRealTimeData: forecast.data_source === 'CDIP',
    isStaleData: staleData,
    // Include threshold for transparency
    stalenessThreshold: getStalenessThreshold(dataSource),
  };
}

// ============================================================================
// Example 7: Real-World Component Usage
// ============================================================================

function BeachForecastTab({ forecasts }: { forecasts: EnhancedForecastEntity[] }) {
  const currentForecast = forecasts[0];

  if (!currentForecast) return null;

  const dataSource = currentForecast.data_source || 'FALLBACK';
  const isStale = isDataStale(currentForecast.updated_at, dataSource);
  const threshold = getStalenessThreshold(dataSource);

  return (
    <div className="space-y-4">
      {/* Forecast Data Source Indicator */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Data Source: {dataSource}</p>
            <p className="text-sm text-gray-600">
              Updates {dataSource === 'CDIP' ? 'hourly' : 'every 6 hours'}
            </p>
          </div>
          <div className={`px-3 py-1 rounded ${isStale ? 'bg-yellow-200' : 'bg-green-200'}`}>
            {isStale ? `Stale (>${threshold}h)` : 'Fresh'}
          </div>
        </div>
      </div>

      {/* Forecast Details */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-600">Wave Height</p>
          <p className="text-2xl font-bold">{currentForecast.wave_height}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Wind Speed</p>
          <p className="text-2xl font-bold">{currentForecast.wind_speed}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Confidence</p>
          <p className="text-2xl font-bold">{currentForecast.confidence_score}%</p>
        </div>
      </div>

      {/* Staleness Warning */}
      {isStale && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
          <p className="text-sm text-yellow-800">
            ℹ️ This forecast was last updated more than {threshold} hours ago.
            A background job should refresh it soon.
          </p>
        </div>
      )}
    </div>
  );
}

export {
  ForecastCard,
  logForecastStatus,
  getForecastWithMetadata,
  displayThresholds,
  ForecastFreshnessIndicator,
  extractForecastMetadata,
  BeachForecastTab,
};
