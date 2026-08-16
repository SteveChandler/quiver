> Merged into [Forecast Monitoring and Operations](../../forecast/README.md).

# Forecast Staleness Thresholds

## Overview

Different forecast data sources update at different frequencies. To provide users with accurate freshness indicators, Quiver now uses **source-specific staleness thresholds** instead of a hardcoded 6-hour threshold for all sources.

## Threshold Configuration

Located in: `lib/config/forecast-staleness.ts`

| Data Source | Update Frequency | Staleness Threshold | Rationale |
|------------|------------------|---------------------|-----------|
| **CDIP** | Hourly | 4 hours | Buoy cron doesn't reliably update every beach every cycle; 4h prevents false staleness |
| **NOAA_NWS** | Daily (6 AM) | 12 hours | Enhanced forecasts regenerate once daily, 12h threshold provides buffer |
| **FALLBACK** | Variable | 12 hours | Fallback data is less critical, can tolerate longer staleness |
| **DEFAULT** | N/A | 6 hours | For unknown or unspecified sources |

## Usage

### Basic Staleness Check

```typescript
import { isDataStale } from '@/lib/utils/forecast-service-utils';

// Check if forecast data is stale
const isStale = isDataStale(forecast.updated_at, forecast.data_source);

if (isStale) {
  // Show staleness warning to user
}
```

### Detailed Staleness Information

For logging or debugging:

```typescript
import { getStalenessDetails } from '@/lib/utils/forecast-service-utils';

const details = getStalenessDetails(forecast.updated_at, forecast.data_source);

console.log('Forecast staleness:', {
  hoursSinceUpdate: details.hoursSinceUpdate,
  threshold: details.threshold,
  isStale: details.isStale,
  reason: details.reason
});
```

### Direct Threshold Access

```typescript
import { getStalenessThreshold } from '@/lib/config/forecast-staleness';

const threshold = getStalenessThreshold('CDIP'); // Returns 4
const threshold = getStalenessThreshold('NOAA_NWS'); // Returns 12
const threshold = getStalenessThreshold('UNKNOWN'); // Returns 6 (DEFAULT)
```

## Implementation Locations

### Frontend Components

1. **Beach Detail Forecast Tab** (`components/beach-detail/tabs/forecast-tab.tsx`)
   - Uses `isDataStale()` in `forecastMetadata` memo
   - Displays source-specific staleness indicators

2. **Home Screen Forecast Tab** (`components/home-screen/forecast-tab.tsx`)
   - Ready for implementation (currently shows freshness badge)

### Backend/API

1. **Forecast Actions** (`actions/forecast-actions.ts`)
   - `extractForecastMetadata()` function uses `isDataStale()`
   - Enriches forecast metadata with accurate staleness info

2. **API Endpoint** (`app/api/forecasts/update-enhanced/route.ts`)
   - Uses `getStalenessDetails()` for enhanced logging
   - Returns staleness metadata in API response

## Testing

Comprehensive test coverage:

- **Configuration Tests**: `__tests__/lib/config/forecast-staleness.test.ts`
  - Threshold values
  - Case-insensitive source matching
  - Edge cases (null/undefined sources)

- **Utility Function Tests**: `__tests__/lib/utils/forecast-service-utils-staleness.test.ts`
  - `isDataStale()` with various sources and timestamps
  - `getStalenessDetails()` return values
  - Fractional hour handling

All tests passing ✅

## API Response Enhancement

The `/api/forecasts/update-enhanced` endpoint now includes staleness metadata:

```json
{
  "data": {
    "forecasts": [...],
    "metadata": {
      "dataSource": "NOAA_NWS",
      "lastUpdated": "2024-01-15T06:00:00Z",
      "isStale": false,
      "stalenessThreshold": 12,
      "dataAge": "8h old"
    }
  }
}
```

## Future Enhancements

Potential improvements:

1. **Dynamic Thresholds**: Adjust thresholds based on time of day or known outages
2. **User Preferences**: Allow users to customize staleness tolerance
3. **Auto-Refresh**: Automatically trigger background refresh when data becomes stale
4. **Push Notifications**: Notify users when their favorite beach has fresh forecast data

## Benefits

✅ **More Accurate Indicators**: Users see staleness warnings appropriate to each data source
✅ **Better Debugging**: Enhanced logging helps diagnose forecast freshness issues
✅ **Aligned with Reality**: Thresholds match actual update frequencies
✅ **Transparency**: API responses include threshold information
✅ **Maintainable**: Centralized configuration easy to adjust

## Notes

- Thresholds are **case-insensitive** (e.g., "cdip", "CDIP", "Cdip" all work)
- Unknown sources default to 6-hour threshold (conservative approach)
- Edge case: Data exactly at threshold is considered **fresh** (not stale)
- System uses **wall clock time** for staleness calculation (Date.now())

---

**Implementation Date**: November 15, 2025
**Author**: Claude (nextjs-developer agent)
**Related**: CHANGELOG.md entry for November 15, 2025
