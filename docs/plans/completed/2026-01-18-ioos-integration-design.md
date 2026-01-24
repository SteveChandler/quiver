# IOOS Integration Design

**Date:** 2026-01-18
**Status:** Approved
**Author:** Brainstorming Session
**Last Updated:** 2026-01-22

---

## Overview

Add IOOS (Integrated Ocean Observing System) as a supplementary data source for wave observations, prioritizing Hawaii and East Coast coverage while architecting for full US expansion.

### Goals

1. Expand wave buoy coverage beyond CDIP/NDBC
2. Prioritize Hawaii (PacIOOS) and East Coast regions
3. Feed historical observations into ML training pipeline
4. Provide fallback when CDIP/NDBC stations are unavailable

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Integration approach | Parallel with fallback | Keep CDIP/NDBC primary, IOOS as fallback + expansion |
| Refresh strategy | Scheduled sync (every 2 hours) | Predictable API usage, enables offline resilience |
| Station filtering | Wave-only within 100km of beaches | Starts with ~200-500 relevant stations |
| Data storage | Database (not cache) | Enables ML training on historical observations |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Flow                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │  IOOS    │────▶│ ioos-sync    │────▶│ ioos_stations  │  │
│  │  ERDDAP  │     │ cron job     │     │ table (new)    │  │
│  └──────────┘     │ (every 2hr)  │     └───────┬────────┘  │
│                   └──────────────┘             │            │
│                                                ▼            │
│  ┌──────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │  CDIP    │────▶│ Existing     │────▶│ Enhanced       │  │
│  │  NDBC    │     │ services     │     │ Forecast API   │  │
│  └──────────┘     └──────────────┘     └────────────────┘  │
│                                                              │
│  Fallback chain: CDIP → NDBC → IOOS → cached data          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### New Components

1. `ioos_stations` table - Stores station metadata + latest observations
2. `ioos_observations` table - Historical observations for ML training
3. `lib/services/ioos-service.ts` - Fetches from IOOS ERDDAP API
4. `/api/cron/ioos-sync` - Scheduled job to refresh station data
5. Updates to existing forecast service to use IOOS as fallback

---

## Database Schema

### ioos_stations

Stores station metadata, synced weekly (~500 rows).

```sql
CREATE TABLE ioos_stations (
  station_id TEXT PRIMARY KEY,
  source_network TEXT NOT NULL,          -- e.g., "NDBC", "PacIOOS", "SECOORA"
  name TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  coordinates GEOMETRY(Point, 4326),
  sensors JSONB,                         -- Available sensor types
  has_wave_data BOOLEAN DEFAULT FALSE,
  nearest_beach_id UUID REFERENCES beaches(id),
  distance_to_beach_km NUMERIC,
  active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ioos_stations_geo
  ON ioos_stations USING GIST(coordinates);
CREATE INDEX idx_ioos_stations_active
  ON ioos_stations(active) WHERE active = true;
CREATE INDEX idx_ioos_stations_beach
  ON ioos_stations(nearest_beach_id);
```

### ioos_observations

Append-only observation history for ML training.

```sql
CREATE TABLE ioos_observations (
  id BIGSERIAL PRIMARY KEY,
  station_id TEXT REFERENCES ioos_stations(station_id),
  observed_at TIMESTAMPTZ NOT NULL,
  wave_height_m NUMERIC,
  wave_period_s NUMERIC,
  wave_direction_deg NUMERIC,
  water_temp_c NUMERIC,
  wind_speed_ms NUMERIC,
  wind_direction_deg NUMERIC,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ioos_obs_station_time
  ON ioos_observations(station_id, observed_at DESC);
CREATE INDEX idx_ioos_obs_time
  ON ioos_observations(observed_at DESC);
```

### Data Retention

- `ioos_stations`: Updated in place (upsert)
- `ioos_observations`: Keep 90 days for ML training, archive/delete older rows

---

## IOOS Service

**File:** `lib/services/ioos-service.ts`

### Class Structure

```typescript
export class IOOSService {
  private readonly baseUrl = "https://erddap.ioos.us/erddap";
  private readonly userAgent = "quiver-surf-app/1.0";

  // Station discovery - finds wave-capable stations
  async discoverStations(bounds?: GeoBounds): Promise<IOOSStation[]>

  // Fetch observations for a single station
  async fetchObservation(stationId: string): Promise<IOOSObservation | null>

  // Batch fetch for multiple stations (respects rate limits)
  async fetchBatch(stationIds: string[], batchSize = 10): Promise<Map<string, IOOSObservation>>

  // Find stations near a beach (uses PostGIS)
  async findNearbyStations(lat: number, lon: number, radiusKm = 100): Promise<IOOSStation[]>
}
```

### IOOS ERDDAP Endpoints

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| Station list | `/tabledap/allDatasets.json` | Filter by `datasetID LIKE '%wave%'` |
| Observations | `/tabledap/{datasetId}.json?time,latitude,longitude,wave_height,...` | Same pattern as CDIP |
| Metadata | `/info/{datasetId}/index.json` | Sensor capabilities |

### Rate Limiting Strategy

- Max 5 concurrent requests
- 500ms delay between batches
- Exponential backoff on 429/503 errors

### Fallback Integration

```typescript
// In forecast service
async getWaveData(lat: number, lon: number): Promise<WaveData> {
  // Try CDIP first (highest quality for CA)
  const cdip = await this.cdipService.getNearestStation(lat, lon);
  if (cdip) return cdip;

  // Try NDBC
  const ndbc = await this.ndbcService.getNearestStation(lat, lon);
  if (ndbc) return ndbc;

  // Fallback to IOOS (queries DB, not live API)
  const ioos = await this.ioosService.findNearbyStations(lat, lon);
  if (ioos.length) return this.getLatestIOOSObservation(ioos[0]);

  return null;
}
```

---

## Cron Job

**File:** `app/api/cron/ioos-sync/route.ts`

### Two-Phase Sync Strategy

| Phase | Frequency | Purpose |
|-------|-----------|---------|
| Station Discovery | Weekly (Sundays) | Find new stations, update metadata, link to beaches |
| Observation Sync | Every 2 hours | Fetch latest wave data from active stations |

### Cron Schedule

```json
{
  "path": "/api/cron/ioos-sync?phase=observations",
  "schedule": "0 */2 * * *"
},
{
  "path": "/api/cron/ioos-sync?phase=stations",
  "schedule": "0 5 * * 0"
}
```

### Observation Sync Flow

1. Query `ioos_stations WHERE active = true AND has_wave_data = true` (~200-500 stations)
2. Batch into groups of 10 stations
3. For each batch:
   - Fetch observations from IOOS ERDDAP (parallel, 5 concurrent max)
   - Insert into `ioos_observations` table
   - Update `ioos_stations.last_seen_at`
   - Wait 500ms before next batch
4. Mark stations as inactive if no data for 7 days
5. Log summary: stations synced, failures, duration

### Station Discovery Flow

1. Fetch all IOOS datasets with wave parameters
2. For each station:
   - Check if within 150km of any beach in our database
   - If yes, upsert into `ioos_stations`
   - Link to nearest beach (`nearest_beach_id`)
   - Calculate `distance_to_beach_km`
3. Deactivate stations not seen in discovery
4. Log: new stations added, total active count

---

## ML Pipeline Integration

### Unified Observations View

```sql
CREATE VIEW unified_wave_observations AS
SELECT
  'ioos' as source,
  station_id,
  observed_at,
  wave_height_m,
  wave_period_s,
  wave_direction_deg,
  s.latitude,
  s.longitude,
  s.nearest_beach_id
FROM ioos_observations o
JOIN ioos_stations s USING (station_id)

UNION ALL

SELECT
  'cdip' as source,
  -- ... similar for CDIP if stored

UNION ALL

SELECT
  'ndbc' as source,
  -- ... similar for NDBC if stored
;
```

### ML Training Query Example

```sql
-- Get forecast vs observation pairs for training
SELECT
  o.observed_at,
  o.wave_height_m as actual_height,
  f.predicted_wave_height_m as forecast_height,
  o.wave_height_m - f.predicted_wave_height_m as error,
  o.source,
  b.name as beach_name
FROM unified_wave_observations o
JOIN enhanced_forecasts f
  ON o.nearest_beach_id = f.beach_id
  AND o.observed_at BETWEEN f.forecast_time - interval '1 hour'
                        AND f.forecast_time + interval '1 hour'
JOIN beaches b ON b.id = o.nearest_beach_id
WHERE o.observed_at > NOW() - interval '90 days';
```

---

## Error Handling & Monitoring

### Error Scenarios

| Scenario | Detection | Response |
|----------|-----------|----------|
| IOOS API down | 5xx responses, timeouts | Use cached DB data, alert if >1 hour stale |
| Station offline | No data for 7+ days | Mark `active = false`, exclude from sync |
| Rate limited | 429 response | Exponential backoff, reduce batch size |
| Bad data | Validation fails (wave_height > 30m) | Log warning, skip observation, don't store |
| Partial batch failure | >20% stations fail | Complete batch, log alert, continue |

### Health Monitoring

Add to `/api/monitoring/forecast-health`:

```typescript
{
  ioos: {
    status: "healthy" | "degraded" | "down",
    active_stations: 342,
    last_sync_at: "2026-01-18T16:00:00Z",
    last_sync_duration_ms: 45000,
    stations_with_fresh_data: 338,
    stations_stale: 4,
    sync_failure_rate_24h: 0.02,
  }
}
```

### Alerting Thresholds

- `degraded`: >10% stations stale or sync takes >5 minutes
- `down`: >50% stations stale or last sync >4 hours ago

---

## Troubleshooting

### ISM Federated Station ID Issue (Fixed: 2026-01-22)

**Problem:** The `ioos_observations` table was empty (0 rows), blocking the ML pipeline backfill which requires observation data for ground truth.

**Root Cause:** Station IDs were being stored in ISM (IOOS Sensor Map) federated format, but the ERDDAP tabledap API only accepts native dataset IDs.

| ID Type | Format Example | Works with tabledap? |
|---------|----------------|----------------------|
| ISM Federated | `ism-secoora-cap2wave-capers-near` | No (404 error) |
| Native | `cap2wave-capers-nearshore-wave` | Yes |

The ERDDAP `allDatasets` endpoint returns BOTH formats for the same physical station. When station discovery stored the ISM IDs, all subsequent observation fetches returned 404 errors because the tabledap endpoint does not recognize ISM-prefixed IDs.

**Solution Implemented:**

1. **Code Fix** (`lib/services/ioos-service.ts`, lines 107-116):
   ```typescript
   // Skip ISM federated IDs - they don't work with tabledap API
   if (String(datasetId).toLowerCase().startsWith("ism-")) {
     ismFilteredCount++;
     continue;
   }
   ```

2. **Database Cleanup** (`supabase/migrations/20260122170000_remove_ism_prefixed_ioos_stations.sql`):
   - Deletes ISM-prefixed observations (foreign key constraint)
   - Deletes ISM-prefixed stations
   - Refreshes `observable_beaches` materialized view

3. **Monitoring Added**:
   - Logs count of filtered ISM stations
   - Warns if >50% of stations are ISM-prefixed (potential API change indicator)

**Detection Method:**

If IOOS observations stop being ingested, check:

```sql
-- Check for ISM-prefixed stations (should be 0)
SELECT COUNT(*) FROM ioos_stations WHERE LOWER(station_id) LIKE 'ism-%';

-- Check observation ingestion health
SELECT
  COUNT(*) as total_obs,
  MAX(observed_at) as latest_obs,
  COUNT(DISTINCT station_id) as unique_stations
FROM ioos_observations
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Unit Tests Added** (`__tests__/lib/services/ioos-service.test.ts`):
- `should filter out ISM federated dataset IDs`
- `should handle case-insensitive ISM prefix`
- `should NOT filter dataset IDs that contain 'ism' but don't start with it`

**Files Modified:**
| File | Change |
|------|--------|
| `lib/services/ioos-service.ts` | Added ISM filter + logging/monitoring |
| `__tests__/lib/services/ioos-service.test.ts` | Added 3 unit tests for ISM filtering |
| `supabase/migrations/20260122170000_remove_ism_prefixed_ioos_stations.sql` | New migration |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

- [x] Create `ioos_stations` and `ioos_observations` tables with migrations
- [x] Implement `IOOSService` class with station discovery
- [x] Add basic observation fetching (single station)
- [x] Unit tests for service

### Phase 2: Sync Pipeline (Week 2)

- [ ] Implement `/api/cron/ioos-sync` route (both phases)
- [x] Add batch fetching with rate limiting
- [ ] Link stations to nearest beaches (PostGIS query)
- [ ] Add to `vercel.json` cron schedule
- [ ] Integration tests

### Phase 3: Fallback Integration (Week 3)

- [ ] Update forecast service with IOOS fallback chain
- [ ] Add IOOS to health monitoring endpoint
- [ ] Create `unified_wave_observations` view for ML
- [ ] Verify ML pipeline can query new data

### Phase 4: Validation & Tuning (Week 4)

- [ ] Monitor sync performance, adjust batch sizes
- [ ] Verify Hawaii + East Coast coverage improved
- [ ] Compare IOOS vs CDIP/NDBC at overlapping stations
- [ ] Add data retention cleanup job

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New stations added | 200-500 |
| Hawaii coverage | 15+ wave buoys (PacIOOS) |
| East Coast coverage | 50+ wave buoys |
| Sync reliability | >98% success rate |
| ML training data | +50% more observation points |

---

## Files to Create/Modify

### New Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_ioos_tables.sql`
- `lib/services/ioos-service.ts`
- `lib/constants/ioos-config.ts`
- `types/ioos.ts`
- `app/api/cron/ioos-sync/route.ts`
- `__tests__/lib/services/ioos-service.test.ts`

### Modified Files

- `vercel.json` - Add cron schedules
- `app/api/monitoring/forecast-health/route.ts` - Add IOOS health checks
- `lib/services/forecast-service.ts` (or equivalent) - Add IOOS fallback

---

*End of Design Document*
