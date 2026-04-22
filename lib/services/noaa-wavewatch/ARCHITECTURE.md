# NOAA WaveWatch III Service Architecture

This document describes the architecture and patterns used in the NOAA WaveWatch III wave forecast service.

## Overview

The NOAA WaveWatch III service provides wave forecast data for surf spots by fetching data from multiple sources with automatic fallback handling:

1. **Primary Source**: NOAA National Weather Service (NWS) API
2. **Fallback Source**: Open-Meteo Marine API
3. **Last Resort**: Synthetic data generation based on location and seasonal patterns

## Module Structure

```
lib/services/noaa-wavewatch/
├── index.ts                    # Barrel export - public API surface
├── types.ts                    # TypeScript type definitions
├── constants.ts                # API URLs, regional configurations, conversion factors
├── api-client.ts               # HTTP client for external APIs
├── wave-analysis.ts            # Wave data analysis and utility functions
├── data-processors.ts          # Data transformation from API responses
├── fallback-generator.ts       # Synthetic wave forecast generation
├── noaa-wavewatch-service.ts   # Main orchestration class
└── ARCHITECTURE.md             # This file
```

### Legacy Compatibility

The original `noaa-wavewatch-service.ts` file (at parent level) now serves as a thin re-export layer for backwards compatibility:

```typescript
// Old imports still work:
import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch-service";

// New imports are preferred:
import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch";
```

## Module Responsibilities

### `types.ts` - Type Definitions

Defines all TypeScript interfaces and types used throughout the service:

- `NOAAWavePoint`: NOAA NWS Point API response structure
- `NOAAGridData`: NOAA NWS Grid Data API response structure
- `WaveWatchData`: Individual wave forecast data point
- `WaveWatchForecast`: Complete forecast response with metadata
- `OpenMeteoMarineResponse`: Open-Meteo API response structure

### `constants.ts` - Configuration & Constants

Centralizes all configuration values, API endpoints, and lookup tables:

- **API Endpoints**: URLs for NOAA NWS and Open-Meteo APIs
- **Wave Regions**: Geographic region definitions with baseline characteristics
- **Seasonal Factors**: Seasonal adjustment multipliers for wave heights
- **Forecast Config**: Timing, intervals, and thresholds
- **Compass Directions**: Mapping of degrees to compass text
- **Unit Conversions**: Meters/feet conversion factors
- **HTTP Config**: User agent and default headers

### `api-client.ts` - HTTP Client

Handles all external HTTP requests with error handling and logging:

**Functions:**
- `fetchNOAAPointData()`: Get grid point information from NOAA
- `fetchNOAAGridData()`: Fetch grid forecast data
- `constructGridUrl()`: Build grid URL from point data
- `fetchOpenMeteoData()`: Get marine forecast from Open-Meteo

**Features:**
- Standardized error handling
- Debug logging for all requests
- Proper User-Agent headers
- Null-safe response handling

### `wave-analysis.ts` - Analysis & Utilities

Pure utility functions for wave data analysis and calculations:

**Geographic Functions:**
- `getBaseWaveHeight()`: Location-based baseline wave height
- `getSeasonalFactor()`: Seasonal adjustment factor
- `getPrevailingWaveDirection()`: Typical wave direction for location

**Unit Conversions:**
- `metersToFeet()`: Convert wave height m → ft
- `feetToMeters()`: Convert wave height ft → m
- `getWaveDirectionText()`: Convert degrees to compass direction

**Data Extraction:**
- `getValueAtIndex()`: Extract value from NOAA time series
- `getTimestampForIndex()`: Calculate forecast timestamp
- `hasValidWaveData()`: Validate data quality
- `logWaveDataAvailability()`: Debug logging for data quality

### `data-processors.ts` - Data Transformation

Transforms raw API responses into standardized wave forecast format:

**Functions:**
- `processNOAAGridData()`: Transform NOAA grid data to `WaveWatchData[]`
- `processOpenMeteoData()`: Transform Open-Meteo response to `WaveWatchData[]`

**Processing Logic:**
- Unit conversion (feet to meters for NOAA data)
- Missing data inference from available fields
- Swell component decomposition
- Wind wave separation
- Precision rounding (heights to cm, periods to 0.1s, directions to degrees)

### `fallback-generator.ts` - Synthetic Data

Generates realistic synthetic wave forecasts when real data is unavailable:

**Function:**
- `generateFallbackData()`: Create location and season-appropriate forecasts

**Features:**
- Location-aware baseline conditions
- Seasonal adjustments (winter higher, summer lower)
- Realistic variability using sine waves + random noise
- Proper swell/wind wave decomposition
- Pacific-appropriate wave periods (12-16s typical)

### `noaa-wavewatch-service.ts` - Main Service

Orchestrates the entire data fetching process with fallback logic:

**Public Methods:**
- `fetchWaveWatchForecast()`: Main entry point for wave forecasts
- `metersToFeet()`: Utility for unit conversion
- `getWaveDirectionText()`: Utility for direction display

**Private Methods:**
- `fetchRealNOAAData()`: Coordinate real data sources
- `fetchNOAANWSData()`: NOAA NWS specific logic
- `fetchOpenMeteoDataWrapper()`: Open-Meteo specific logic

**Fallback Strategy:**
1. Try NOAA NWS API
2. If no wave data or failure → Try Open-Meteo
3. If Open-Meteo fails → Generate synthetic fallback
4. Always return valid forecast data

### `index.ts` - Barrel Export

Public API surface for the module with organized exports:

**Exports:**
- Main service class
- Type definitions
- Constants (for advanced usage)
- Utility functions (for testing/reuse)
- Data processors (for testing)

## Data Flow

```
┌─────────────────────────────────────────────────┐
│  fetchWaveWatchForecast(lat, lon, days)        │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
            ┌────────────────┐
            │ fetchRealNOAAData │
            └────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ NOAA NWS API │          │ Open-Meteo   │
│              │          │ Marine API   │
└──────┬───────┘          └──────┬───────┘
       │                         │
       │ ┌───────────────────┐   │
       └─┤ Data Processors   ├───┘
         └────────┬──────────┘
                  │
         ┌────────┴─────────┐
         │  Valid forecast? │
         └────────┬─────────┘
                  │
         ┌────────┴─────────┐
         │  Yes      No     │
         ▼          ▼       │
    ┌────────┐  ┌──────────┴──────┐
    │ Return │  │ Fallback         │
    │ Data   │  │ Generator        │
    └────────┘  └──────┬───────────┘
                       │
                       ▼
                  ┌────────┐
                  │ Return │
                  │ Data   │
                  └────────┘
```

## Wave Data Structure

Each forecast point contains comprehensive wave information:

```typescript
{
  timestamp: "2026-01-25T12:00:00Z",

  // Combined wave metrics
  significant_wave_height: 1.2,  // meters
  peak_wave_period: 14.5,        // seconds
  peak_wave_direction: 270,      // degrees

  // Primary swell — longest-period real partition (dominant by period, not by NOAA's height-based label)
  swell_1_height: 0.9,           // meters
  swell_1_period: 16.0,          // seconds
  swell_1_direction: 265,        // degrees

  // Secondary swell — real second partition, or 0 sentinel when no second train exists
  swell_2_height: 0.3,           // meters (or 0 sentinel)
  swell_2_period: 13.0,          // seconds (or 0 sentinel)
  swell_2_direction: 310,        // degrees (or 0 sentinel)

  // Wind waves (local chop)
  wind_wave_height: 0.2,         // meters
  wind_wave_period: 6.0,         // seconds
  wind_wave_direction: 280,      // degrees

  data_source: "NOAA_NWS"        // or "OPEN_METEO" or "FALLBACK"
}
```

### Swell partition parsing (real, not synthesized)

The NOAA branch of `data-processors.ts` parses real partition fields from NWS gridpoints:

- `primarySwellHeight` / `primarySwellDirection`
- `secondarySwellHeight` / `secondarySwellDirection`
- `wavePeriod` (paired with primary) / `wavePeriod2` (paired with secondary)

**Period-descending canonical order.** NOAA ranks partitions by height, which can land short-period wind-sea in the "primary" slot and real groundswell in "secondary" when heights are tied. The parser sorts by period descending before assigning to `swell_1_*` / `swell_2_*` so the longer-period component always wins the primary slot. Downstream consumers treat `swell_1` as "the swell that matters most" — period, not NOAA's height-based label, drives that.

**Offshore grid offset.** Beach coordinates often resolve to coastal-land NWS grids that return zeroed partitions. `grid-utils.ts:getOceanGridPoint` shifts the query coordinate ~0.05° (~5 km) toward deeper water (Pacific W, Atlantic E, Gulf S, HI W) before calling `/points/{lat},{lon}`. Per-beach 24h in-memory cache (`api-client.ts:pointCache`) avoids repeated metadata lookups.

**No fabrication.** When a secondary partition is absent, the OM branch only returns one partition, or the fallback-generator fires, `swell_2_height/period/direction` emit a `0` sentinel (never synthesized as `swell_1 * magic_numbers`). `forecast-builder.ts:getSwell2*` treats `swell_2_height === 0` as absent and returns `null` to the DB. The web forecast table renders an em-dash when `swell_2_height` is null.

## Geographic Regions

The service understands different wave characteristics by region:

### Pacific Coast (California)
- **Location**: 30°N-50°N, 130°W-115°W
- **Base Height**: 0.7m (~2.3ft typical San Diego conditions)
- **Prevailing Direction**: 270° (West)
- **Characteristics**: Long-period swells (12-16s), winter storms

### Atlantic Coast
- **Location**: 25°N-45°N, 85°W-70°W
- **Base Height**: 0.8m
- **Prevailing Direction**: 120° (Southeast)
- **Characteristics**: Hurricane swells, nor'easters

### Gulf of Mexico
- **Location**: 25°N-35°N, 100°W-80°W
- **Base Height**: 0.6m
- **Prevailing Direction**: 225° (Southwest)
- **Characteristics**: Smaller waves, wind-driven

## Seasonal Adjustments

Wave heights are adjusted by season:

- **Northern Hemisphere Winter** (Dec-Feb): 1.3x multiplier
- **Northern Hemisphere Summer** (Jun-Aug): 0.8x multiplier
- **Southern Hemisphere**: Opposite pattern
- **Spring/Fall**: 1.0x multiplier (baseline)

## API Integration

### NOAA NWS API

**Two-Step Process:**
1. **Points API**: Get grid coordinates for lat/lon
   ```
   GET https://api.weather.gov/points/{lat},{lon}
   → Returns: gridId, gridX, gridY
   ```

2. **Grid API**: Get forecast data for grid point
   ```
   GET https://api.weather.gov/gridpoints/{gridId}/{gridX},{gridY}
   → Returns: waveHeight, wavePeriod, waveDirection time series
   ```

**Data Quality Checks:**
- Validate wave height values exist and are non-zero
- Log warnings for limited data (single data point)
- Fall back if no usable wave data

**Known Issues:**
- Some grid points return `null` for `forecastGridData` URL
- Solution: Reconstruct URL from `gridId`/`gridX`/`gridY`
- Not all grid points have wave data (inland/coastal coverage gaps)

### Open-Meteo Marine API

**Single Request:**
```
GET https://marine-api.open-meteo.com/v1/marine?
    latitude={lat}&longitude={lon}
    &hourly=wave_height,wave_direction,wave_period,
            swell_wave_height,swell_wave_direction,swell_wave_period,
            wind_wave_height,wind_wave_direction,wind_wave_period
    &forecast_days={days}
```

**Advantages:**
- More reliable global coverage
- Already in metric units
- Includes swell and wind wave components
- Better uptime than NOAA grid data

**Limitations:**
- Max 7 days forecast
- Less detailed than NOAA for US coastal waters

## Error Handling Strategy

The service uses a **progressive degradation** approach:

1. **Try NOAA NWS**: Most authoritative for US waters
2. **Try Open-Meteo**: Reliable global coverage
3. **Generate Fallback**: Always provide data, mark as synthetic

**Error States:**
- API failures → Caught, logged, move to next source
- Missing data → Validate, fall back if insufficient
- Invalid coordinates → Return null

**Logging:**
- Debug level for normal operations
- Warn level for data quality issues
- Error level for API failures

## Testing Considerations

**Unit Testing:**
- Pure functions in `wave-analysis.ts` are easily testable
- Mock API responses for `data-processors.ts`
- Test fallback generation determinism

**Integration Testing:**
- Test full fetch flow with real coordinates
- Verify fallback cascade (NOAA → Open-Meteo → Synthetic)
- Validate data quality checks

**Example Test Locations:**
- San Diego: `32.7157, -117.1611` (reliable NOAA coverage)
- Hawaii: `21.3099, -157.8581` (test Open-Meteo fallback)
- Invalid: `0, 0` (test fallback generation)

## Performance Considerations

**Caching Opportunities:**
- Wave forecasts change slowly (hourly updates)
- Grid point lookups rarely change
- Consider 15-30 minute cache TTL

**Request Optimization:**
- NOAA API requires 2 sequential requests (points → grid)
- Open-Meteo requires 1 request
- Fallback generation is instant (no API call)

**Response Times:**
- NOAA NWS: ~500-1000ms (2 requests)
- Open-Meteo: ~300-500ms (1 request)
- Fallback: <10ms (synthetic)

## Usage Examples

### Basic Usage

```typescript
import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch";

const service = new NOAAWaveWatchService();

const forecast = await service.fetchWaveWatchForecast(
  32.7157,  // San Diego lat
  -117.1611, // San Diego lon
  10         // 10 days
);

if (forecast) {
  console.log(`Forecasts: ${forecast.forecast.length}`);
  console.log(`Source: ${forecast.data_source}`);

  const first = forecast.forecast[0];
  console.log(`Wave height: ${first.significant_wave_height}m`);
  console.log(`Wave period: ${first.peak_wave_period}s`);
  console.log(`Direction: ${service.getWaveDirectionText(first.peak_wave_direction)}`);
}
```

### Unit Conversion

```typescript
import { metersToFeet, getWaveDirectionText } from "@/lib/services/noaa-wavewatch";

const heightMeters = 1.5;
const heightFeet = metersToFeet(heightMeters); // 4.92
console.log(`${heightMeters}m = ${heightFeet.toFixed(1)}ft`);

const direction = 270;
const compassText = getWaveDirectionText(direction); // "W"
console.log(`${direction}° = ${compassText}`);
```

### Direct Data Processing (Testing)

```typescript
import { processNOAAGridData, generateFallbackData } from "@/lib/services/noaa-wavewatch";

// Process raw NOAA data
const waveData = processNOAAGridData(mockGridData, 7, 32.7157, -117.1611);

// Generate test data
const testData = generateFallbackData(32.7157, -117.1611, 3);
```

## Future Enhancements

**Potential Improvements:**
1. Add caching layer (Redis/in-memory)
2. Support for NOAA WaveWatch III NetCDF files (higher resolution)
3. Historical wave data for trend analysis
4. Wave spectral analysis (frequency domain)
5. Buoy data integration for validation
6. Multi-model ensemble forecasts

**API Alternatives:**
- NDBC (National Data Buoy Center) for real-time observations
- Surfline API (commercial, high accuracy)
- Stormglass API (aggregated sources)
- ECMWF Wave Model (global coverage)

## Related Services

- **NOAA CO-OPS Service**: Tide predictions (similar module structure)
- **Weather Service**: Wind forecasts (affects wave quality)
- **Beach Service**: Combines wave, tide, and wind data

## References

- [NOAA NWS API Documentation](https://www.weather.gov/documentation/services-web-api)
- [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api)
- [WaveWatch III Model](https://polar.ncep.noaa.gov/waves/wavewatch/)
- [Marine Forecasting Principles](https://www.weather.gov/marine/)

---

Last Updated: 2026-01-25
