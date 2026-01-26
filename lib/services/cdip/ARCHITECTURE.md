# CDIP Service Architecture

## Overview

The CDIP (Coastal Data Information Program) service provides high-quality wave data from buoy stations along the California coast. The service integrates with the CDIP ERDDAP API operated by Scripps Institution of Oceanography.

This module has been refactored into a modular structure for improved maintainability, testability, and separation of concerns.

## Module Structure

```
lib/services/cdip/
├── index.ts                    # Barrel export - public API
├── types.ts                    # Type definitions
├── constants.ts                # Configuration and constants
├── cache.ts                    # Caching logic
├── data-parser.ts              # Data transformation utilities
├── api-client.ts               # HTTP client for CDIP API
├── cdip-service.ts             # Main orchestration class
└── ARCHITECTURE.md             # This file
```

## Module Responsibilities

### `index.ts` - Barrel Export
- Public API for the CDIP module
- Re-exports main service class, types, constants, and utilities
- Primary entry point for consumers

### `types.ts` - Type Definitions
- Re-exports CDIP types from main types file (`@/types/forecast`)
- Defines module-specific types (e.g., `CDIPCacheEntry`)
- Provides type safety throughout the module

### `constants.ts` - Configuration
- Re-exports station configurations from main constants file
- Defines module-specific constants:
  - `CACHE_TIMEOUT_MS`: Cache expiration time (30 minutes)
  - `MAX_CONCURRENT_REQUESTS`: Concurrent request limit (3)
  - `BATCH_DELAY_MS`: Delay between request batches (1000ms)
  - `USER_AGENT`: HTTP User-Agent string
  - `DEFAULT_MAX_DISTANCE_KM`: Default search radius (50km)
  - `MAX_CACHE_SIZE`: Maximum cached entries (20)
  - `DEFAULT_BLACKLIST`: Known problematic stations
  - `SWELL_ESTIMATION`: Factors for estimating swell characteristics

### `cache.ts` - Caching Layer
**Class: `CDIPCache`**

Provides in-memory caching with TTL and automatic cleanup.

**Methods:**
- `get(stationId: string)`: Get cached buoy data
- `set(stationId: string, data: CDIPBuoyData)`: Store buoy data
- `clear()`: Clear all cached data
- `size()`: Get number of cached entries

**Features:**
- Automatic expiration based on TTL
- LRU-style cleanup when max size exceeded
- Thread-safe for concurrent access

### `data-parser.ts` - Data Transformation
**Functions:**

- `transformERDDAPToDataResponse(erddapData: any, stationId: string)`: Transform ERDDAP API response to internal format
- `isValidDataPoint(timestamp, waveHeight, period, direction)`: Validate a single data point
- `transformToCDIPBuoyData(stationId, rawData)`: Transform raw data to standardized buoy data
- `calculateDataQualityScore(buoyData)`: Calculate quality score (0-100)
- `normalizeStationIdForErddap(stationId)`: Normalize station IDs for ERDDAP API

**Responsibilities:**
- Parse and validate CDIP API responses
- Convert ERDDAP format to internal data structures
- Handle unit conversions (meters to feet)
- Apply data quality thresholds
- Estimate swell characteristics when not provided

### `api-client.ts` - HTTP Client
**Class: `CDIPApiClient`**

Handles all HTTP communication with CDIP ERDDAP API.

**Methods:**
- `fetchWaveData(stationId: string)`: Fetch wave data for a station
- `fetchMetadata(stationId: string)`: Fetch station metadata
- `canMakeRequest()`: Check rate limit status
- `getTimeUntilReset()`: Get time until rate limit resets
- `recordRequest(endpoint: string)`: Record successful request

**Features:**
- Rate limiting integration
- Retry logic via shared API client
- Error handling and logging
- Verbose logging support

### `cdip-service.ts` - Main Service Class
**Class: `CDIPService`**

Primary orchestration class that coordinates all operations.

**Public Methods:**
- `fetchBuoyData(stationId: string)`: Fetch data for a single station
- `fetchMultipleStations(stationIds: string[])`: Fetch data for multiple stations
- `getSouthernCaliforniaStations()`: Get SoCal station IDs
- `getNearestStation(lat, lon, maxDistanceKm)`: Find nearest station
- `fetchStationMetadata(stationId: string)`: Get station metadata
- `getDataQualityScore(buoyData)`: Calculate data quality score

**Features:**
- In-flight request deduplication
- Station blacklist management
- Caching integration
- Batch processing with rate limiting
- Distance-based station lookup

## Data Flow

### Fetching Buoy Data

```
User Request
    ↓
CDIPService.fetchBuoyData(stationId)
    ↓
Check blacklist → Return null if blacklisted
    ↓
Check cache → Return cached if valid
    ↓
Check in-flight requests → Join existing if present
    ↓
Check rate limit → Return null if exceeded
    ↓
CDIPApiClient.fetchWaveData(stationId)
    ↓
HTTP Request → ERDDAP API
    ↓
transformERDDAPToDataResponse(response)
    ↓
transformToCDIPBuoyData(stationId, data)
    ↓
Validate and transform each data point
    ↓
Apply swell estimation
    ↓
Cache result
    ↓
Return CDIPBuoyData
```

### Fetching Multiple Stations

```
User Request with stationIds[]
    ↓
CDIPService.fetchMultipleStations(stationIds)
    ↓
Split into batches (MAX_CONCURRENT_REQUESTS)
    ↓
For each batch:
    ├─ Fetch stations concurrently
    ├─ Collect results
    └─ Wait BATCH_DELAY_MS before next batch
    ↓
Return all results
```

## Key Design Patterns

### 1. Separation of Concerns
- API communication isolated in `api-client.ts`
- Data transformation isolated in `data-parser.ts`
- Caching isolated in `cache.ts`
- Service class orchestrates, doesn't implement details

### 2. Request Deduplication
- `inFlightFetches` Map tracks concurrent requests
- Multiple requests for same station join existing fetch
- Prevents redundant API calls

### 3. Multi-Layer Caching
- Check cache before rate limiting (instant cache hits)
- In-flight deduplication (prevent duplicate concurrent requests)
- TTL-based expiration (30 minutes)

### 4. Rate Limiting
- Integrated with shared `CDIPRateLimiter`
- Check before each API request
- Record after successful requests
- Return null if rate limit exceeded

### 5. Error Handling
- Graceful degradation (return null on errors)
- Comprehensive logging at each step
- Validation at data transformation layer
- Blacklist for known problematic stations

## Configuration

### Environment Variables

- `CDIP_BLACKLIST`: Comma-separated list of station IDs to skip (supplements defaults)

### Station Blacklist

Default blacklisted stations (known to have 404 issues):
- `46221`: Point Arena
- `46225`: Point Reyes
- `46236`: Monterey Bay

### Data Quality Thresholds

Imported from `@/lib/constants/cdip-stations`:
- Wave height: 0.1-15.0 meters
- Wave period: 1-30 seconds
- Wave direction: 0-360 degrees
- Data freshness:
  - Excellent: ≤10 minutes
  - Good: ≤30 minutes
  - Acceptable: ≤60 minutes
  - Stale: >60 minutes

## Swell Estimation

When swell separation data is not available, the service estimates swell characteristics:

- **Swell Height**: 80% of total wave height
- **Swell Period**: 110% of peak wave period (longer)
- **Wind Wave Height**: 20% of total wave height
- **Wind Wave Period**: 60% of peak wave period (shorter, min 3s)

## Testing Considerations

### Unit Testing
- Test each module independently
- Mock API responses for `api-client.ts`
- Test data transformation with known inputs
- Verify cache behavior (TTL, cleanup)

### Integration Testing
- Test service orchestration
- Verify request deduplication
- Test batch processing logic
- Verify rate limiting integration

### Test Data
Example ERDDAP response format:
```json
{
  "table": {
    "columnNames": ["station_id", "time", "waveHs", "waveTp", "waveTa", "waveDp"],
    "rows": [
      ["067", "2025-01-25T12:00:00Z", 1.5, 12.0, 10.0, 270.0]
    ]
  }
}
```

## Performance Characteristics

### Caching
- Cache hit: ~1ms
- Cache miss + API request: 200-1000ms
- Cache size: ~20 entries (configurable)
- TTL: 30 minutes

### Batch Processing
- Max concurrent requests: 3
- Batch delay: 1000ms
- 10 stations: ~4-5 seconds total

### Rate Limiting
- Managed by shared `CDIPRateLimiter`
- Prevents API abuse
- Returns null when limit exceeded

## Migration Guide

### From Legacy Import
```typescript
// OLD (deprecated)
import { CDIPService } from "@/lib/services/cdip-service";

// NEW (recommended)
import { CDIPService } from "@/lib/services/cdip";
```

### Backwards Compatibility
The original `cdip-service.ts` file now re-exports from the new module, so existing code continues to work without changes.

## Future Enhancements

### Potential Improvements
1. **Redis Caching**: Replace in-memory cache with Redis for multi-instance support
2. **Swell Separation API**: Use dedicated CDIP endpoint for accurate swell data
3. **Historical Data**: Add methods for historical wave data queries
4. **Spectral Analysis**: Parse and expose spectral wave data
5. **Station Discovery**: Auto-discover and cache available stations
6. **Metrics**: Add performance metrics and monitoring
7. **GraphQL Support**: Add GraphQL API for flexible queries

### Testing Enhancements
1. Add comprehensive unit tests for each module
2. Add integration tests for service orchestration
3. Add performance benchmarks
4. Add load testing for batch operations

## Related Documentation

- `/lib/constants/cdip-stations.ts`: Station configuration and mappings
- `/types/forecast.ts`: Core type definitions
- `/lib/utils/rate-limiter.ts`: Rate limiting utilities
- `/lib/utils/api-retry.ts`: Retry logic
- `/lib/utils/distance-utils.ts`: Distance calculations

## Version History

- **v2.0** (2026-01-25): Modular refactoring
  - Split into separate modules
  - Improved separation of concerns
  - Added comprehensive documentation

- **v1.0**: Original monolithic implementation
  - Single file with all functionality
  - 663 lines of code
