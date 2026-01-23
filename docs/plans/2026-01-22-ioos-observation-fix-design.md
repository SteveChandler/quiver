# IOOS Observation Fix Design

**Date:** 2026-01-22
**Status:** Draft
**Author:** Brainstorming Session

---

## Problem Statement

Three intertwined bugs are causing IOOS integration to fail:

1. **Null columns** - Only wave height is fetched; period/direction/temp stay null
2. **Ancient timestamps** - Time constraint `max(time)-1hour` returns 2001/2004 data from offline stations
3. **Scoring ignores cache** - Even when cron writes good rows, scoring hits live ERDDAP instead of cached observations

### Current State

- 158 observations in `ioos_observations`
- Only 99 are recent (2025+), 59 are garbage from years ago
- All observations have null for period, direction, temp, wind
- Scoring calls `fetchObservation()` which hits ERDDAP live, ignoring cached data

---

## Goals

1. Always store a fresh "latest observation" per station (within a freshness window)
2. Populate canonical columns: Hs, period, direction, water temp, wind (when available)
3. Never 400 because a variable doesn't exist
4. Scoring reads cached observations first, falls back to live fetch second
5. Deterministic station selection with configurable priorities

---

## Section 1: Data Model Changes

### 1A) Add station "capabilities" columns

Store what each station actually supports so URL building is dynamic.

**Migration:**

```sql
ALTER TABLE ioos_stations
  ADD COLUMN IF NOT EXISTS available_variables JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS variable_map JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS variables_last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ioos_stations_network ON ioos_stations(source_network);
CREATE INDEX IF NOT EXISTS idx_ioos_stations_vars_synced ON ioos_stations(variables_last_synced_at);
```

| Column | Purpose |
|--------|---------|
| `available_variables` | Raw list from ERDDAP `/info/.../index.json` |
| `variable_map` | Mapping from canonical field to actual ERDDAP variable name |
| `variables_last_synced_at` | For debugging/refresh tracking |

### 1B) Ensure observations table supports partial data

```sql
-- observed_at should already exist, but ensure index
CREATE INDEX IF NOT EXISTS idx_ioos_obs_station_time
  ON ioos_observations(station_id, observed_at DESC);

-- Add freshness helper (optional, can compute in query)
ALTER TABLE ioos_observations
  ADD COLUMN IF NOT EXISTS is_fresh BOOLEAN GENERATED ALWAYS AS (
    observed_at >= NOW() - INTERVAL '4 hours'
  ) STORED;
```

---

## Section 2: Capability Discovery

### 2A) Canonical fields and alias sets

```typescript
export type CanonicalVar =
  | "wave_height"
  | "wave_period"
  | "wave_direction"
  | "water_temp"
  | "wind_speed"
  | "wind_direction";

export const IOOS_VARIABLE_ALIASES: Record<CanonicalVar, readonly string[]> = {
  wave_height: [
    "sea_surface_wave_significant_height",
  ],
  wave_period: [
    "sea_surface_wave_period_at_variance_spectral_density_maximum", // Tp (peak)
    "sea_surface_wave_peak_period",
    "sea_surface_wave_mean_period",
  ],
  wave_direction: [
    "sea_surface_wave_from_direction",
    "sea_surface_wave_to_direction",
    "mean_wave_direction",
  ],
  water_temp: [
    "sea_surface_temperature",
    "sea_water_temperature",
  ],
  wind_speed: [
    "wind_speed",
    "wind_speed_of_gust",
  ],
  wind_direction: [
    "wind_from_direction",
    "wind_to_direction",
  ],
} as const;
```

### 2B) Build variable_map from ERDDAP /info endpoint

During station sync (or separate capability refresh):

1. `GET https://erddap.sensors.ioos.us/erddap/info/{datasetId}/index.json`
2. Parse variable rows into a string set
3. For each `CanonicalVar`, pick first alias present in the set
4. Save `available_variables` and `variable_map`

**Example variable_map:**

```json
{
  "wave_height": "sea_surface_wave_significant_height",
  "wave_period": "sea_surface_wave_mean_period",
  "wave_direction": "sea_surface_wave_from_direction"
}
```

This is the key to never requesting a non-existent variable again.

---

## Section 3: Observation Fetching

### 3A) Use absolute time constraints

The "ancient timestamps" bug occurs because `max(time)-1hour` returns old data for offline stations.

**Fix:** Use absolute ISO timestamps with proper URL encoding.

```typescript
function isoZulu(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function encodeConstraint(c: string): string {
  return encodeURIComponent(c);
}
```

### 3B) Build URL from station's variable_map

```typescript
interface StationCaps {
  datasetId: string;
  variableMap: Partial<Record<CanonicalVar, string>>;
}

function buildObservationUrl(caps: StationCaps, now: Date): string | null {
  const LOOKBACK_HOURS = 12;
  const minTime = new Date(now.getTime() - LOOKBACK_HOURS * 3600_000);
  const maxTime = new Date(now.getTime() + 10 * 60_000); // +10 min buffer

  const vars: string[] = ["time"];
  const v = caps.variableMap;

  if (v.wave_height) vars.push(v.wave_height);
  if (v.wave_period) vars.push(v.wave_period);
  if (v.wave_direction) vars.push(v.wave_direction);
  if (v.water_temp) vars.push(v.water_temp);
  if (v.wind_speed) vars.push(v.wind_speed);
  if (v.wind_direction) vars.push(v.wind_direction);

  // If only time exists, station has no useful variables
  if (vars.length === 1) return null;

  const base = `https://erddap.sensors.ioos.us/erddap/tabledap/${caps.datasetId}.json`;

  const constraints = [
    `time>=${isoZulu(minTime)}`,
    `time<=${isoZulu(maxTime)}`,
    `orderByMax("time")`,
  ].map(encodeConstraint);

  return `${base}?${vars.join(",")}&${constraints.join("&")}`;
}
```

**Why this fixes ancient timestamps:**
- Even if station has 20 years of history, only rows in last 12h are allowed
- `orderByMax("time")` ensures you get the single newest row
- Malformed constraints return empty (logged) instead of silently accepting 2004 data

---

## Section 4: Parsing and Canonicalization

```typescript
function toNumber(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

interface ParsedObservation {
  observedAt: string;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDirectionDeg: number | null;
  waterTempC: number | null;
  windSpeedMS: number | null;
  windDirectionDeg: number | null;
  raw: Record<string, unknown>;
}

function parseErddapRow(
  row: Record<string, unknown>,
  variableMap: Partial<Record<CanonicalVar, string>>
): ParsedObservation | null {
  const time = row["time"];
  if (typeof time !== "string") return null;

  const get = (k?: string) => (k ? row[k] : null);

  return {
    observedAt: time,
    waveHeightM: toNumber(get(variableMap.wave_height)),
    wavePeriodS: toNumber(get(variableMap.wave_period)),
    waveDirectionDeg: toNumber(get(variableMap.wave_direction)),
    waterTempC: toNumber(get(variableMap.water_temp)),
    windSpeedMS: toNumber(get(variableMap.wind_speed)),
    windDirectionDeg: toNumber(get(variableMap.wind_direction)),
    raw: row,
  };
}
```

---

## Section 5: Sync Job Updates

In `/app/api/cron/ioos-sync/route.ts`:

1. Load active stations with `dataset_id`, `variable_map`
2. If `variable_map` empty or stale, refresh capabilities (Section 2)
3. Fetch observation using dynamic URL (Section 3)
4. Parse into canonical fields (Section 4)
5. **Skip ancient rows**: If `observed_at < now - 24h`, log and skip
6. Upsert observation row

---

## Section 6: Station Priority and Ranking

### 6A) What "priority" means

When multiple nearby stations exist, choose the one that maximizes:

1. **Freshness** (most important)
2. **Data completeness** (has Hs + period + direction)
3. **Relevance** (distance)
4. **Reliability** (network trust)

Network priority is a tie-breaker, not the only factor.

### 6B) Network priority weights

```typescript
export const IOOS_NETWORK_PRIORITY: Record<string, number> = {
  CDIP: 0.30,      // Wave-focused, lots of nearshore buoys
  NDBC: 0.15,      // Reliable, broad coverage, often more offshore
  CeNCOOS: 0.05,   // Regional IOOS
  SCCOOS: 0.05,
  NERACOOS: 0.05,
  // Unknown networks default to 0
};
```

### 6C) Station scoring function

```typescript
interface StationCandidate {
  stationId: string;
  distanceKm: number;
  network: string;
  latestObservedAt: Date | null;
  hasWaveHeight: boolean;
  hasPeriod: boolean;
  hasDirection: boolean;
}

function scoreStation(candidate: StationCandidate, now: Date): number {
  let score = 0;

  // Freshness score (biggest weight)
  if (candidate.latestObservedAt) {
    const ageHours = (now.getTime() - candidate.latestObservedAt.getTime()) / 3600_000;
    if (ageHours <= 2) score += 1.0;
    else if (ageHours <= 6) score += 0.5;
    else if (ageHours <= 12) score += 0.1;
    // >12h gets 0
  }

  // Completeness score
  if (candidate.hasWaveHeight) score += 0.3;
  if (candidate.hasPeriod) score += 0.18;      // 0.3 * 0.6
  if (candidate.hasDirection) score += 0.12;  // 0.3 * 0.4

  // Distance score (inverse, capped)
  const distanceScore = Math.max(0, 1 - candidate.distanceKm / 150);
  score += distanceScore * 0.2;

  // Network bonus
  const networkBonus = IOOS_NETWORK_PRIORITY[candidate.network] ?? 0;
  score += networkBonus;

  return score;
}
```

### 6D) Optional: Per-beach station overrides

For "golden stations" that are known-best for specific beaches:

```sql
ALTER TABLE beaches
  ADD COLUMN IF NOT EXISTS preferred_ioos_station_id TEXT;
```

**Rule:**
- If override station is fresh, use it
- If stale, fall back to scoring function

---

## Section 7: Scoring Integration (Cached-First)

### 7A) Read latest cached observation

```typescript
async function getLatestCachedObservation(
  stationId: string,
  maxAgeHours = 4
): Promise<IOOSObservation | null> {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();

  const { data, error } = await supabase
    .from("ioos_observations")
    .select("*")
    .eq("station_id", stationId)
    .gte("observed_at", cutoff)
    .order("observed_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}
```

### 7B) Updated selection flow

```typescript
async function getBuoyObservationForBeach(
  beachId: string,
  lat: number,
  lon: number
): Promise<BuoyObservation | null> {
  // 1. Find nearby stations
  const candidates = await findNearbyStations(lat, lon, 150);
  if (candidates.length === 0) return null;

  // 2. Attach latest cached obs for each station (batch query)
  const stationIds = candidates.map(c => c.station_id);
  const cachedObs = await getLatestCachedObservations(stationIds);

  // 3. Build scored candidates
  const now = new Date();
  const scored = candidates.map(c => ({
    ...c,
    latestObs: cachedObs.get(c.station_id),
    score: scoreStation({
      stationId: c.station_id,
      distanceKm: c.distance_to_beach_km,
      network: c.source_network,
      latestObservedAt: cachedObs.get(c.station_id)?.observed_at
        ? new Date(cachedObs.get(c.station_id)!.observed_at)
        : null,
      hasWaveHeight: cachedObs.get(c.station_id)?.wave_height_m != null,
      hasPeriod: cachedObs.get(c.station_id)?.wave_period_s != null,
      hasDirection: cachedObs.get(c.station_id)?.wave_direction_deg != null,
    }, now),
  }));

  // 4. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // 5. Try to use cached observation from best station
  const best = scored[0];
  if (best.latestObs && isObservationFresh(best.latestObs, 4)) {
    return formatObservation(best.latestObs, best);
  }

  // 6. Cache miss: live fetch top 1-3 stations
  for (const candidate of scored.slice(0, 3)) {
    const liveObs = await fetchLiveObservation(candidate.station_id);
    if (liveObs && isObservationFresh(liveObs, 12)) {
      // Write to cache
      await upsertObservation(liveObs);
      return formatObservation(liveObs, candidate);
    }
  }

  return null;
}
```

---

## Section 8: Configuration Constants

```typescript
// lib/constants/ioos-config.ts

export const IOOS_OBSERVATION_CONFIG = {
  // Fetching
  lookbackHours: 12,           // How far back to query ERDDAP
  maxFutureMinutes: 10,        // Buffer for clock skew

  // Caching
  maxCacheAgeHours: 4,         // Max staleness for scoring to use cache
  maxStorageAgeHours: 24,      // Don't store observations older than this

  // Live fetch fallback
  maxLiveFetchAttempts: 3,     // Try this many stations before giving up

  // Capability refresh
  variableRefreshDays: 7,      // Re-check station variables weekly
} as const;

export const IOOS_NETWORK_PRIORITY: Record<string, number> = {
  CDIP: 0.30,
  NDBC: 0.15,
  CeNCOOS: 0.05,
  SCCOOS: 0.05,
  NERACOOS: 0.05,
  PacIOOS: 0.05,
  SECOORA: 0.05,
  MARACOOS: 0.05,
  GCOOS: 0.05,
};
```

---

## Section 9: Telemetry and Debugging

### 9A) Cron job metrics

Log in the sync route:

- Stations processed
- Stations with empty `variable_map`
- Fetch success / empty / error counts
- Freshness distribution (how many <2h, <4h, >12h)
- Field coverage (% with Hs, Tp, Dir non-null)

### 9B) Debug script

Create `scripts/debug-ioos-observations.ts`:

```typescript
// For N sample stations, print:
// - variable_map
// - latest observed_at
// - which canonical fields present
// - scoring components
```

---

## Implementation Order

**Fastest path to "working":**

1. **Migration**: Add `available_variables` + `variable_map` to `ioos_stations`
2. **Capability refresh**: Implement ERDDAP `/info` fetching and alias matching
3. **Observation fetch update**:
   - Use `variable_map` to build URL
   - Apply absolute `time>=` constraint
   - Use `orderByMax("time")`
4. **Cron sync update**: Skip ancient rows, upsert parsed canonical fields
5. **Scoring update**: Cached-first with station ranking

This sequence fixes scoring degradation fastest because you stop depending on live ERDDAP during scoring.

---

## Files to Create/Modify

### New Files

- `supabase/migrations/YYYYMMDDHHMMSS_add_ioos_station_capabilities.sql`
- `lib/services/ioos-capability-service.ts` (or add to existing service)

### Modified Files

| File | Changes |
|------|---------|
| `lib/constants/ioos-config.ts` | Add `IOOS_VARIABLE_ALIASES`, `IOOS_NETWORK_PRIORITY`, `IOOS_OBSERVATION_CONFIG` |
| `types/ioos.ts` | Add `CanonicalVar`, update `IOOSStation` type |
| `lib/services/ioos-service.ts` | New `buildObservationUrl`, `parseErddapRow`, capability refresh |
| `app/api/cron/ioos-sync/route.ts` | Use dynamic URL, skip ancient rows, capability refresh |
| `lib/services/forecast/data-source-manager.ts` | Cached-first with station ranking |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Observations with wave_height | 99 | 100+ per sync |
| Observations with wave_period | 0 | 60%+ |
| Observations with wave_direction | 0 | 40%+ |
| Ancient observations (>24h old) | 59 | 0 |
| Scoring cache hit rate | 0% | 80%+ |
| Scoring latency (P95) | ~500ms (API) | <50ms (cache) |

---

*End of Design Document*
