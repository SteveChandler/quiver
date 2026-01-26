# IOOS Service Architecture

This document describes the architecture of the IOOS (Integrated Ocean Observing System) service module, which fetches wave buoy data from ERDDAP APIs.

## Overview

The IOOS service provides:

- **Station Discovery**: Find wave-capable buoy stations from ERDDAP
- **Observation Fetching**: Retrieve wave height, period, direction, and environmental data
- **Variable Mapping**: Handle diverse ERDDAP variable naming schemes
- **Caching**: Reduce API calls with intelligent in-memory caching
- **Database Integration**: Link stations to beaches and store observations

## Module Structure

```
lib/services/ioos/
├── index.ts                    # Barrel export with public API
├── types.ts                    # Internal type definitions
├── constants.ts                # Service-specific constants
├── url-builder.ts              # ERDDAP URL construction
├── api-client.ts               # HTTP client for ERDDAP API
├── data-parser.ts              # Data parsing and transformation
├── cache.ts                    # Observation caching
├── ioos-service.ts             # Main orchestration class
└── ARCHITECTURE.md             # This file
```

### Backwards Compatibility

The original `lib/services/ioos-service.ts` has been converted to a thin re-export layer for backwards compatibility. New code should import from `@/lib/services/ioos`.

```typescript
// ✅ Preferred (new code)
import { IOOSService } from '@/lib/services/ioos';

// ⚠️ Deprecated (backwards compatibility)
import { IOOSService } from '@/lib/services/ioos-service';
```

## Module Responsibilities

### index.ts

**Barrel export** providing the public API surface.

**Exports:**
- `IOOSService` - Main service class
- `getIOOSService()` - Singleton instance getter
- Parsing utilities: `buildVariableMap`, `parseObservationRow`, etc.
- URL builders: `buildDynamicObservationUrl`, etc.
- Types: `ParsedObservation`, `StationVariablesResult`, etc.

### types.ts

**Internal type definitions** complementing `@/types/ioos.ts`.

**Key Types:**
- `ParsedObservation` - Canonical observation format with snake_case fields
- `CacheEntry` - Cache metadata wrapper
- `StationVariablesResult` - Result from variable discovery

### constants.ts

**Service-specific constants** for implementation details.

**Key Constants:**
- `NETWORK_PATTERNS` - Network name parsing patterns
- `STATION_ID_PATTERN` - Station ID validation regex
- `STATION_FILTERS` - Station filtering rules
- `ISM_FILTER_WARNING_THRESHOLD` - API health monitoring
- `NEARBY_STATIONS_LIMIT` - Query safety limit

For API-level constants (URLs, variable names, thresholds), see `@/lib/constants/ioos-config.ts`.

### url-builder.ts

**URL construction** for ERDDAP API endpoints with proper encoding and validation.

**Key Functions:**

```typescript
// Build dynamic observation URL based on station's variables
buildDynamicObservationUrl(stationId, variableMap, now?): string | null

// Build legacy observation URL (hardcoded variables)
buildObservationUrl(stationId): string

// Build station info URL for variable discovery
buildStationInfoUrl(stationId): string

// Build all datasets URL for station discovery
buildAllDatasetsUrl(): string
```

**Security Features:**
- Station ID validation to prevent URL injection
- Proper URL encoding of query parameters
- Null return for invalid inputs

### api-client.ts

**HTTP client** for ERDDAP API with error handling, timeouts, and response parsing.

**Key Functions:**

```typescript
// Generic ERDDAP fetch with timeout and auth
fetchERDDAP<T>(url, config?): Promise<T>

// Fetch all datasets
fetchAllDatasets(url, config?): Promise<ERDDAPTableResponse>

// Fetch observation (returns null for missing variables)
fetchObservation(url, config?): Promise<ERDDAPTableResponse | null>

// Fetch station info (returns null for 404)
fetchStationInfo(url, config?): Promise<ERDDAPInfoResponse | null>

// Check for "Unrecognized variable" errors
isUnrecognizedVariableError(response): Promise<boolean>
```

**Error Handling:**
- Distinguishes between network errors and data unavailability
- Gracefully handles 400 (bad variable), 404 (not found), timeout
- Returns null for expected failures, throws for unexpected errors

### data-parser.ts

**Data parsing and transformation** utilities for ERDDAP responses.

**Key Functions:**

```typescript
// Format date as ERDDAP Zulu string
isoZulu(date): string

// Safe number conversion
toNumber(value): number | null

// Map available variables to canonical names
buildVariableMap(availableVars): Partial<Record<CanonicalVar, string>>

// Parse observation row (object format)
parseObservationRow(row, variableMap): ParsedObservation | null

// Parse observation row (array format - legacy)
parseObservationArray(stationId, row, columnNames): IOOSObservation

// Parse network from dataset ID and institution
parseNetwork(datasetId, institution): IOOSNetwork

// Convert array row to object
rowToObject(row, columnNames): Record<string, unknown>
```

**Data Quality:**
- Validates wave height bounds
- Handles missing/null values gracefully
- Supports multiple variable naming conventions

### cache.ts

**In-memory caching** for observation data with TTL support.

**ObservationCache Class:**

```typescript
class ObservationCache {
  constructor(cacheTtlMs: number)

  // Get cached observation (undefined if not found/expired)
  get(key): IOOSObservation | ParsedObservation | null | undefined

  // Store observation
  set(key, data): void

  // Check if cached and fresh
  has(key): boolean

  // Clear all entries
  clear(): void

  // Get cache size
  size(): number

  // Remove expired entries
  prune(): number
}
```

**Caching Strategy:**
- Cache successful observations (non-null)
- Cache failed attempts (null) to avoid repeated failures
- TTL-based expiration (default: 10 minutes)
- Separate cache keys for legacy vs dynamic fetches

### ioos-service.ts

**Main orchestration class** coordinating all other modules.

**IOOSService Class:**

```typescript
class IOOSService {
  constructor(configOverrides?: Partial<IOOSServiceConfig>)

  // Station discovery
  discoverStations(bounds?): Promise<IOOSStationDiscoveryResult>

  // Observation fetching (legacy format)
  fetchObservation(stationId): Promise<IOOSObservation | null>

  // Batch fetching
  fetchBatch(stationIds, batchSize?): Promise<Map<string, IOOSObservation>>

  // Observation fetching (dynamic format)
  fetchObservationDynamic(stationId, variableMap): Promise<ParsedObservation | null>

  // Variable discovery
  fetchStationVariables(stationId): Promise<StationVariablesResult | null>

  // Database integration
  findNearbyStations(lat, lon, radiusKm?): Promise<IOOSStation[]>

  // Cache management
  clearCache(): void

  // Diagnostics
  getStationsWithoutWaveData(): string[]
  clearStationsWithoutWaveData(): void
  getConfig(): IOOSServiceConfig
}
```

**Singleton Pattern:**

```typescript
// Get shared instance
const service = getIOOSService();
```

## Data Flow

### Station Discovery Flow

```
IOOSService.discoverStations(bounds?)
  ↓
buildAllDatasetsUrl()
  ↓
fetchAllDatasets(url)
  ↓
Filter stations:
  - Skip ISM-prefixed (incompatible)
  - Apply geographic bounds
  - Detect wave capability keywords
  ↓
parseNetwork(datasetId, institution)
  ↓
Return IOOSStationDiscoveryResult
```

### Observation Fetching Flow (Dynamic)

```
IOOSService.fetchObservationDynamic(stationId, variableMap)
  ↓
Check cache → Return if fresh
  ↓
buildDynamicObservationUrl(stationId, variableMap)
  ↓
fetchObservation(url)
  ↓
rowToObject(row, columnNames)
  ↓
parseObservationRow(rowObj, variableMap)
  ↓
Validate observation age
  ↓
Cache and return ParsedObservation
```

### Variable Discovery Flow

```
IOOSService.fetchStationVariables(stationId)
  ↓
buildStationInfoUrl(stationId)
  ↓
fetchStationInfo(url)
  ↓
Extract variable names from "Row Type" === "variable"
  ↓
buildVariableMap(availableVariables)
  ↓
Return { availableVariables, variableMap }
```

## Configuration

Service behavior is controlled by configuration objects:

### IOOSServiceConfig

Defined in `@/types/ioos.ts` and `@/lib/constants/ioos-config.ts`:

```typescript
interface IOOSServiceConfig {
  baseUrl: string;                // ERDDAP server URL
  userAgent: string;              // User agent for requests
  timeoutMs: number;              // Request timeout (default: 30s)
  maxConcurrentRequests: number;  // Batch concurrency (default: 5)
  batchDelayMs: number;           // Delay between batches (default: 500ms)
  cacheTtlMs: number;             // Cache TTL (default: 10 minutes)
}
```

### IOOS_OBSERVATION_CONFIG

Observation fetching parameters:

```typescript
const IOOS_OBSERVATION_CONFIG = {
  lookbackHours: 12,           // How far back to query
  maxFutureMinutes: 10,        // Clock skew buffer
  maxCacheAgeHours: 4,         // Max staleness for scoring
  maxStorageAgeHours: 24,      // Don't store older observations
  maxLiveFetchAttempts: 3,     // Try this many stations before giving up
  variableRefreshDays: 7,      // Re-check variables after this
};
```

## Variable Mapping System

ERDDAP datasets use diverse variable names. The service maps these to canonical names:

### Canonical Variables

```typescript
type CanonicalVar =
  | "wave_height"
  | "wave_period"
  | "wave_direction"
  | "water_temp"
  | "wind_speed"
  | "wind_direction";
```

### Variable Aliases

Defined in `IOOS_VARIABLE_ALIASES`:

```typescript
{
  wave_height: ["sea_surface_wave_significant_height"],
  wave_period: [
    "sea_surface_wave_period_at_variance_spectral_density_maximum",
    "sea_surface_wave_peak_period",
    "sea_surface_wave_mean_period"
  ],
  // ... etc
}
```

**Priority:** First match wins. Order aliases from most specific to most generic.

### Variable Discovery Process

1. Fetch `/info/{stationId}/index.json`
2. Extract variable names where `Row Type === "variable"`
3. Match against `IOOS_VARIABLE_ALIASES` (first match wins)
4. Store as `variable_map` in database
5. Use `variable_map` to build observation URLs

## Station Filtering

### ISM Prefix Filtering

ISM-federated station IDs (e.g., `ism-secoora-*`) are incompatible with the tabledap API. These are filtered during discovery with monitoring for API health.

**Monitoring:**
- Track ISM filter count
- Warn if >50% of stations are ISM-prefixed (potential API change)

### Wave Capability Detection

Heuristics for identifying wave-capable stations:

1. **CDIP stations** - Always have wave data
   - Institution contains "cdip"
   - Dataset ID starts with "edu_ucsd_cdip"

2. **Wave keyword in ID** - Likely has wave data
   - "wave", "cdip" in dataset ID

3. **NDBC ocean buoys** - Most have wave data
   - Institution contains "ndbc"
   - Dataset ID matches `wmo_4xxxx` or `wmo_5xxxx`

4. **DART buoys excluded** - Tsunami detection, not wave height
   - "dart" in dataset ID

**Note:** False positives are cleaned up during observation sync when stations fail to return wave data.

## Error Handling

### Expected Errors (Graceful Handling)

- **400 with "Unrecognized variable"** - Station lacks wave variables
  - Track in `stationsWithoutWaveData` set
  - Cache null result to avoid retries

- **404 Not Found** - Station doesn't exist
  - Return null

- **Empty response** - No recent observations
  - Cache null result

### Unexpected Errors (Throw)

- Network timeouts (after 30s)
- 500 Server errors
- Invalid JSON responses
- DNS failures

### Error Recovery

```typescript
// Retry logic for batch fetches
const results = await Promise.allSettled(promises);
// Failed fetches don't block successful ones

// Cache failed attempts to avoid repeated failures
if (error) {
  cache.set(stationId, null);
}
```

## Performance Optimizations

### Caching Strategy

- **Cache TTL**: 10 minutes (configurable)
- **Cache null results** to avoid repeated failures
- **Separate cache keys** for legacy vs dynamic fetches
  - `stationId` - Legacy fetch
  - `dynamic_${stationId}` - Dynamic fetch

### Batch Fetching

```typescript
// Process in batches with concurrency limit
for (let i = 0; i < stationIds.length; i += batchSize) {
  const batch = stationIds.slice(i, i + batchSize);
  await Promise.allSettled(batch.map(fetch));

  // Delay between batches (rate limiting)
  if (i + batchSize < stationIds.length) {
    await delay(batchDelayMs);
  }
}
```

**Benefits:**
- Limit concurrent requests (default: 5)
- Rate limiting between batches (default: 500ms)
- Failed fetches don't block batch

### Query Limits

- **Nearby stations**: Limited to 100 results
- **Time constraints**: 12-hour lookback window
- **Observation age**: Skip observations older than 24 hours

## Security Considerations

### URL Injection Prevention

```typescript
// Validate station ID format
const STATION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

if (!STATION_ID_PATTERN.test(stationId)) {
  console.warn(`Invalid station ID format: ${stationId}`);
  return null;
}
```

### Query Constraints

- Always encode URL parameters
- Use absolute time constraints (not relative like `time>max(time)-1hour`)
- Limit result set sizes

### Database Security

- Use RPC functions with row-level security
- Limit query results (e.g., 100 stations max)
- Service role client only for server-side code

## Testing Strategies

### Unit Tests

Test individual functions in isolation:

```typescript
// Data parser tests
describe('buildVariableMap', () => {
  it('should map wave height aliases', () => {
    const vars = ['sea_surface_wave_significant_height'];
    const map = buildVariableMap(vars);
    expect(map.wave_height).toBe('sea_surface_wave_significant_height');
  });
});

// URL builder tests
describe('buildDynamicObservationUrl', () => {
  it('should return null for invalid station ID', () => {
    const url = buildDynamicObservationUrl('invalid/../path', {});
    expect(url).toBeNull();
  });
});
```

### Integration Tests

Test service with mocked HTTP responses:

```typescript
describe('IOOSService', () => {
  it('should discover stations', async () => {
    // Mock fetchAllDatasets
    const service = new IOOSService();
    const result = await service.discoverStations();
    expect(result.totalFound).toBeGreaterThan(0);
  });
});
```

### E2E Tests

Test against live ERDDAP API (use sparingly):

```typescript
describe('ERDDAP API (E2E)', () => {
  it('should fetch observation for known station', async () => {
    const service = new IOOSService();
    const obs = await service.fetchObservation('edu_ucsd_cdip_155');
    expect(obs).toBeDefined();
  });
});
```

## Common Usage Patterns

### Station Discovery

```typescript
import { getIOOSService } from '@/lib/services/ioos';

const service = getIOOSService();

// Discover all stations
const result = await service.discoverStations();

// Discover stations in geographic bounds
const result = await service.discoverStations({
  minLat: 20, maxLat: 50,
  minLon: -130, maxLon: -60
});

console.log(`Found ${result.waveStationsFound} wave stations`);
```

### Fetch Single Observation

```typescript
// Legacy format (hardcoded variables)
const obs = await service.fetchObservation('edu_ucsd_cdip_155');
if (obs) {
  console.log(`Wave height: ${obs.wave_height_m}m`);
}

// Dynamic format (use station's variable_map)
const vars = await service.fetchStationVariables(stationId);
if (vars) {
  const obs = await service.fetchObservationDynamic(stationId, vars.variableMap);
  if (obs) {
    console.log(`Wave height: ${obs.waveHeightM}m`);
  }
}
```

### Batch Fetching

```typescript
const stationIds = ['edu_ucsd_cdip_155', 'wmo_46042', 'wmo_46086'];
const observations = await service.fetchBatch(stationIds);

observations.forEach((obs, stationId) => {
  console.log(`${stationId}: ${obs.wave_height_m}m`);
});
```

### Find Nearby Stations

```typescript
// Find stations within 100km of a beach
const stations = await service.findNearbyStations(
  33.7701, // Santa Monica latitude
  -118.1938, // Santa Monica longitude
  100 // radius in km
);

console.log(`Found ${stations.length} nearby stations`);
```

## Troubleshooting

### Station Returns No Data

**Symptoms:**
- `fetchObservation` returns null
- Station in `getStationsWithoutWaveData()` list

**Causes:**
- Station lacks wave height variable
- Station is inactive (no recent observations)
- Station has data gap

**Solutions:**
1. Check station variables: `fetchStationVariables(stationId)`
2. Use `fetchObservationDynamic` with correct variable map
3. Verify station is active in ERDDAP web interface

### Slow Discovery

**Symptoms:**
- `discoverStations()` takes >30 seconds
- Timeout errors

**Causes:**
- ERDDAP server is slow
- Large result set (no bounds)

**Solutions:**
1. Use geographic bounds to limit results
2. Increase timeout: `new IOOSService({ timeoutMs: 60000 })`
3. Check ERDDAP server status

### High ISM Filter Rate

**Symptoms:**
- Warning: "Over 50% of stations were ISM-prefixed"

**Causes:**
- ERDDAP API changed format
- ISM federation expanded

**Solutions:**
1. Review ISM filtering logic in `ioos-service.ts`
2. Check if ISM stations now work with tabledap
3. Update filtering rules if needed

### Cache Issues

**Symptoms:**
- Stale data returned
- Cache grows unbounded

**Solutions:**
1. Clear cache: `service.clearCache()`
2. Adjust TTL: `new IOOSService({ cacheTtlMs: 5 * 60 * 1000 })`
3. For long-running processes, periodically call `cache.prune()`

## Future Enhancements

### Potential Improvements

1. **Regional Server Support**
   - Add fallback to regional ERDDAP servers (PacIOOS, CeNCOOS, etc.)
   - Automatic server selection based on station network

2. **Enhanced Variable Detection**
   - Machine learning to improve variable mapping
   - Handle more exotic variable names

3. **Observation Validation**
   - Quality control flags (QARTOD)
   - Anomaly detection (sudden spikes, flatlines)

4. **Historical Data Support**
   - Fetch time series (not just latest)
   - Support for climatology queries

5. **Persistent Caching**
   - Redis cache for multi-instance deployments
   - Database caching layer

6. **GraphQL API**
   - Modern API layer over ERDDAP
   - Subscriptions for real-time updates

## Related Documentation

- **Type Definitions**: `/types/ioos.ts`
- **API Configuration**: `/lib/constants/ioos-config.ts`
- **Database Schema**: `/supabase/migrations/*_ioos_stations.sql`
- **Sync Jobs**: `/app/api/cron/ioos-observations/route.ts`

## Migration Guide

### From Legacy to Modular

**Old code:**

```typescript
import { IOOSService, buildDynamicObservationUrl } from '@/lib/services/ioos-service';
```

**New code:**

```typescript
import { IOOSService, buildDynamicObservationUrl } from '@/lib/services/ioos';
```

All exports remain the same. The legacy file still works but is deprecated.

## Changelog

### 2024-01-25 - Modular Refactoring

- Split monolithic `ioos-service.ts` into modular structure
- Extracted types, constants, parsers, URL builders, API client, cache
- Maintained backwards compatibility via re-export
- Added comprehensive JSDoc documentation
- Improved separation of concerns

### Previous Changes

See git history for earlier changes to the monolithic service.
