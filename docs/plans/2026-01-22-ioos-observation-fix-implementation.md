# IOOS Observation Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix IOOS integration so observations have complete data (period, direction, temp), fresh timestamps, and scoring uses cached data first.

**Architecture:** Per-station variable discovery via ERDDAP `/info` endpoint, dynamic URL building based on `variable_map`, absolute time constraints, cached-first scoring with station ranking.

**Tech Stack:** TypeScript, Supabase/PostgreSQL, Next.js API routes, ERDDAP REST API

---

## Task 1: Database Migration - Add Station Capabilities

**Files:**
- Create: `supabase/migrations/20260122200000_add_ioos_station_capabilities.sql`

**Step 1: Write the migration**

```sql
-- Add capability columns to ioos_stations for dynamic variable discovery
-- available_variables: raw list from ERDDAP /info endpoint
-- variable_map: canonical field -> actual ERDDAP variable name

ALTER TABLE ioos_stations
  ADD COLUMN IF NOT EXISTS available_variables JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS variable_map JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS variables_last_synced_at TIMESTAMPTZ;

-- Index for filtering by network (used in station ranking)
CREATE INDEX IF NOT EXISTS idx_ioos_stations_network ON ioos_stations(source_network);

-- Index for finding stations needing variable refresh
CREATE INDEX IF NOT EXISTS idx_ioos_stations_vars_synced ON ioos_stations(variables_last_synced_at);

-- Improve observation query performance for cached-first scoring
CREATE INDEX IF NOT EXISTS idx_ioos_obs_station_observed
  ON ioos_observations(station_id, observed_at DESC);

COMMENT ON COLUMN ioos_stations.available_variables IS 'Raw variable list from ERDDAP /info endpoint';
COMMENT ON COLUMN ioos_stations.variable_map IS 'Mapping: canonical field name -> actual ERDDAP variable name';
COMMENT ON COLUMN ioos_stations.variables_last_synced_at IS 'Last time we refreshed variable info from ERDDAP';
```

**Step 2: Apply migration locally**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Verify columns exist**

Run: `npx tsx -e "const { config } = require('dotenv'); config({ path: '.env.local' }); const { createClient } = require('@supabase/supabase-js'); const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); sb.from('ioos_stations').select('variable_map').limit(1).then(r => console.log('Column exists:', !r.error));"`
Expected: `Column exists: true`

**Step 4: Commit**

```bash
git add supabase/migrations/20260122200000_add_ioos_station_capabilities.sql
git commit -m "feat(db): add variable_map and available_variables to ioos_stations"
```

---

## Task 2: Update Types - Add Canonical Variables

**Files:**
- Modify: `types/ioos.ts`
- Modify: `lib/constants/ioos-config.ts`

**Step 1: Add CanonicalVar type and aliases to ioos-config.ts**

Add after the existing exports in `lib/constants/ioos-config.ts`:

```typescript
/**
 * Canonical variable names used internally
 */
export type CanonicalVar =
  | "wave_height"
  | "wave_period"
  | "wave_direction"
  | "water_temp"
  | "wind_speed"
  | "wind_direction";

/**
 * ERDDAP variable name aliases for each canonical variable
 * Order matters: first match wins during capability discovery
 */
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

/**
 * Network priority weights for station ranking
 * Higher = more trusted/preferred
 */
export const IOOS_NETWORK_PRIORITY: Record<string, number> = {
  CDIP: 0.30,      // Wave-focused, lots of nearshore buoys
  NDBC: 0.15,      // Reliable, broad coverage, often more offshore
  CeNCOOS: 0.05,   // Regional IOOS networks
  SCCOOS: 0.05,
  NERACOOS: 0.05,
  PacIOOS: 0.05,
  SECOORA: 0.05,
  MARACOOS: 0.05,
  GCOOS: 0.05,
};

/**
 * Observation fetching and caching configuration
 */
export const IOOS_OBSERVATION_CONFIG = {
  /** How far back to query ERDDAP for observations */
  lookbackHours: 12,
  /** Buffer for clock skew (allow slightly future timestamps) */
  maxFutureMinutes: 10,
  /** Max staleness for scoring to use cached observation */
  maxCacheAgeHours: 4,
  /** Don't store observations older than this */
  maxStorageAgeHours: 24,
  /** Try this many stations before giving up on live fetch */
  maxLiveFetchAttempts: 3,
  /** Re-check station variables after this many days */
  variableRefreshDays: 7,
} as const;
```

**Step 2: Update IOOSStation type in types/ioos.ts**

Find the `IOOSStation` interface and add:

```typescript
export interface IOOSStation {
  station_id: string;
  source_network: IOOSNetwork;
  name: string | null;
  latitude: number;
  longitude: number;
  sensors: string[] | null;
  has_wave_data: boolean;
  nearest_beach_id: string | null;
  distance_to_beach_km: number | null;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  // New capability fields
  available_variables?: string[];
  variable_map?: Partial<Record<CanonicalVar, string>>;
  variables_last_synced_at?: string | null;
}
```

Add the import at the top:

```typescript
import type { CanonicalVar } from "@/lib/constants/ioos-config";
```

**Step 3: Verify TypeScript compiles**

Run: `yarn typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/constants/ioos-config.ts types/ioos.ts
git commit -m "feat(types): add canonical variables, network priority, and observation config"
```

---

## Task 3: Capability Discovery - Fetch Station Variables

**Files:**
- Modify: `lib/services/ioos-service.ts`
- Create: `__tests__/lib/services/ioos-capability.test.ts`

**Step 1: Write failing test for buildVariableMap**

Create `__tests__/lib/services/ioos-capability.test.ts`:

```typescript
import { buildVariableMap } from "@/lib/services/ioos-service";
import { CanonicalVar } from "@/lib/constants/ioos-config";

describe("buildVariableMap", () => {
  it("should map available ERDDAP variables to canonical names", () => {
    const availableVars = [
      "time",
      "latitude",
      "longitude",
      "sea_surface_wave_significant_height",
      "sea_surface_wave_mean_period",
      "sea_surface_wave_from_direction",
      "sea_surface_temperature",
    ];

    const result = buildVariableMap(availableVars);

    expect(result.wave_height).toBe("sea_surface_wave_significant_height");
    expect(result.wave_period).toBe("sea_surface_wave_mean_period");
    expect(result.wave_direction).toBe("sea_surface_wave_from_direction");
    expect(result.water_temp).toBe("sea_surface_temperature");
    expect(result.wind_speed).toBeUndefined();
    expect(result.wind_direction).toBeUndefined();
  });

  it("should prefer earlier aliases (peak period over mean period)", () => {
    const availableVars = [
      "time",
      "sea_surface_wave_significant_height",
      "sea_surface_wave_period_at_variance_spectral_density_maximum",
      "sea_surface_wave_mean_period",
    ];

    const result = buildVariableMap(availableVars);

    // Should pick the peak period (first in alias list) over mean
    expect(result.wave_period).toBe(
      "sea_surface_wave_period_at_variance_spectral_density_maximum"
    );
  });

  it("should return empty object when no wave variables available", () => {
    const availableVars = ["time", "latitude", "longitude", "air_temperature"];

    const result = buildVariableMap(availableVars);

    expect(Object.keys(result)).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts`
Expected: FAIL - `buildVariableMap` not exported

**Step 3: Implement buildVariableMap in ioos-service.ts**

Add to `lib/services/ioos-service.ts`:

```typescript
import {
  IOOS_API_CONFIG,
  IOOS_ENDPOINTS,
  IOOS_WAVE_VARIABLES,
  IOOS_QUALITY_THRESHOLDS,
  IOOS_VARIABLE_ALIASES,
  CanonicalVar,
} from "@/lib/constants/ioos-config";

/**
 * Build a variable map by matching available ERDDAP variables to canonical names
 * Uses alias priority: first match in the alias list wins
 */
export function buildVariableMap(
  availableVars: string[]
): Partial<Record<CanonicalVar, string>> {
  const varSet = new Set(availableVars);
  const result: Partial<Record<CanonicalVar, string>> = {};

  for (const [canonical, aliases] of Object.entries(IOOS_VARIABLE_ALIASES)) {
    for (const alias of aliases) {
      if (varSet.has(alias)) {
        result[canonical as CanonicalVar] = alias;
        break; // First match wins
      }
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/ioos-service.ts __tests__/lib/services/ioos-capability.test.ts
git commit -m "feat(ioos): add buildVariableMap for canonical variable discovery"
```

---

## Task 4: Capability Discovery - Fetch from ERDDAP /info

**Files:**
- Modify: `lib/services/ioos-service.ts`
- Modify: `__tests__/lib/services/ioos-capability.test.ts`

**Step 1: Write failing test for fetchStationVariables**

Add to `__tests__/lib/services/ioos-capability.test.ts`:

```typescript
import { IOOSService, buildVariableMap } from "@/lib/services/ioos-service";

describe("IOOSService.fetchStationVariables", () => {
  it("should fetch and parse variables from ERDDAP /info endpoint", async () => {
    const service = new IOOSService();

    // Use a known CDIP station
    const result = await service.fetchStationVariables("edu_ucsd_cdip_073");

    expect(result).not.toBeNull();
    expect(result!.availableVariables).toContain("time");
    expect(result!.availableVariables).toContain("sea_surface_wave_significant_height");
    expect(result!.variableMap.wave_height).toBe("sea_surface_wave_significant_height");
  }, 30000);

  it("should return null for non-existent station", async () => {
    const service = new IOOSService();

    const result = await service.fetchStationVariables("nonexistent_station_xyz");

    expect(result).toBeNull();
  }, 30000);
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts -t "fetchStationVariables"`
Expected: FAIL - method does not exist

**Step 3: Implement fetchStationVariables**

Add to `IOOSService` class in `lib/services/ioos-service.ts`:

```typescript
/**
 * Fetch available variables for a station from ERDDAP /info endpoint
 * Returns both raw variable list and computed variable_map
 */
async fetchStationVariables(stationId: string): Promise<{
  availableVariables: string[];
  variableMap: Partial<Record<CanonicalVar, string>>;
} | null> {
  try {
    const url = `${this.config.baseUrl}/info/${stationId}/index.json`;

    const response = await fetchWithTimeout(url, {
      timeoutMs: this.config.timeoutMs,
      init: {
        headers: {
          "User-Agent": this.config.userAgent,
        },
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Station doesn't exist
      }
      console.error(`[IOOS] Failed to fetch variables for ${stationId}: ${response.status}`);
      return null;
    }

    const json = await response.json();
    const rows = json?.table?.rows || [];
    const columnNames = json?.table?.columnNames || [];

    // Find the column indices
    const rowTypeIdx = columnNames.indexOf("Row Type");
    const varNameIdx = columnNames.indexOf("Variable Name");

    if (rowTypeIdx === -1 || varNameIdx === -1) {
      console.error(`[IOOS] Unexpected /info response format for ${stationId}`);
      return null;
    }

    // Extract variable names from rows where Row Type is "variable"
    const availableVariables: string[] = [];
    for (const row of rows) {
      if (row[rowTypeIdx] === "variable") {
        const varName = row[varNameIdx];
        if (typeof varName === "string") {
          availableVariables.push(varName);
        }
      }
    }

    const variableMap = buildVariableMap(availableVariables);

    return { availableVariables, variableMap };
  } catch (error) {
    console.error(`[IOOS] Error fetching variables for ${stationId}:`, error);
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts -t "fetchStationVariables"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/ioos-service.ts __tests__/lib/services/ioos-capability.test.ts
git commit -m "feat(ioos): add fetchStationVariables to discover ERDDAP variables"
```

---

## Task 5: Dynamic Observation URL Builder

**Files:**
- Modify: `lib/services/ioos-service.ts`
- Modify: `__tests__/lib/services/ioos-capability.test.ts`

**Step 1: Write failing test for buildDynamicObservationUrl**

Add to `__tests__/lib/services/ioos-capability.test.ts`:

```typescript
import { buildDynamicObservationUrl } from "@/lib/services/ioos-service";

describe("buildDynamicObservationUrl", () => {
  const now = new Date("2026-01-22T12:00:00Z");

  it("should build URL with only available variables", () => {
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
      wave_period: "sea_surface_wave_mean_period",
    };

    const url = buildDynamicObservationUrl("test_station", variableMap, now);

    expect(url).not.toBeNull();
    expect(url).toContain("test_station.json");
    expect(url).toContain("time");
    expect(url).toContain("sea_surface_wave_significant_height");
    expect(url).toContain("sea_surface_wave_mean_period");
    expect(url).not.toContain("water_temp");
  });

  it("should include proper time constraints with URL encoding", () => {
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
    };

    const url = buildDynamicObservationUrl("test_station", variableMap, now);

    // Should have encoded time>= constraint (12 hours back from now)
    expect(url).toContain(encodeURIComponent("time>=2026-01-22T00:00:00Z"));
    // Should have encoded orderByMax
    expect(url).toContain(encodeURIComponent('orderByMax("time")'));
  });

  it("should return null when no wave variables available", () => {
    const variableMap = {}; // No wave height

    const url = buildDynamicObservationUrl("test_station", variableMap, now);

    expect(url).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts -t "buildDynamicObservationUrl"`
Expected: FAIL - function not exported

**Step 3: Implement buildDynamicObservationUrl**

Add to `lib/services/ioos-service.ts`:

```typescript
import { IOOS_OBSERVATION_CONFIG } from "@/lib/constants/ioos-config";

/**
 * Format date as ISO Zulu string without milliseconds (ERDDAP format)
 */
function isoZulu(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Build observation URL dynamically based on station's variable_map
 * Uses absolute time constraints to avoid ancient data
 * Returns null if station has no wave height variable
 */
export function buildDynamicObservationUrl(
  stationId: string,
  variableMap: Partial<Record<CanonicalVar, string>>,
  now: Date = new Date()
): string | null {
  // Must have at least wave height to be useful
  if (!variableMap.wave_height) {
    return null;
  }

  const { lookbackHours, maxFutureMinutes } = IOOS_OBSERVATION_CONFIG;
  const minTime = new Date(now.getTime() - lookbackHours * 3600_000);
  const maxTime = new Date(now.getTime() + maxFutureMinutes * 60_000);

  // Build variable list from what's available
  const vars: string[] = ["time"];
  if (variableMap.wave_height) vars.push(variableMap.wave_height);
  if (variableMap.wave_period) vars.push(variableMap.wave_period);
  if (variableMap.wave_direction) vars.push(variableMap.wave_direction);
  if (variableMap.water_temp) vars.push(variableMap.water_temp);
  if (variableMap.wind_speed) vars.push(variableMap.wind_speed);
  if (variableMap.wind_direction) vars.push(variableMap.wind_direction);

  const base = `${IOOS_API_CONFIG.baseUrl}/tabledap/${stationId}.json`;

  // Build constraints with proper URL encoding
  const constraints = [
    `time>=${isoZulu(minTime)}`,
    `time<=${isoZulu(maxTime)}`,
    `orderByMax("time")`,
  ].map(c => encodeURIComponent(c));

  return `${base}?${vars.join(",")}&${constraints.join("&")}`;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts -t "buildDynamicObservationUrl"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/ioos-service.ts __tests__/lib/services/ioos-capability.test.ts
git commit -m "feat(ioos): add buildDynamicObservationUrl with absolute time constraints"
```

---

## Task 6: Observation Parsing with Canonical Fields

**Files:**
- Modify: `lib/services/ioos-service.ts`
- Modify: `__tests__/lib/services/ioos-capability.test.ts`

**Step 1: Write failing test for parseObservationRow**

Add to `__tests__/lib/services/ioos-capability.test.ts`:

```typescript
import { parseObservationRow } from "@/lib/services/ioos-service";

describe("parseObservationRow", () => {
  it("should parse ERDDAP row into canonical observation", () => {
    const row = {
      time: "2026-01-22T10:30:00Z",
      sea_surface_wave_significant_height: 1.5,
      sea_surface_wave_mean_period: 8.2,
      sea_surface_wave_from_direction: 270,
      sea_surface_temperature: 15.5,
    };
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
      wave_period: "sea_surface_wave_mean_period",
      wave_direction: "sea_surface_wave_from_direction",
      water_temp: "sea_surface_temperature",
    };

    const result = parseObservationRow(row, variableMap);

    expect(result).not.toBeNull();
    expect(result!.observedAt).toBe("2026-01-22T10:30:00Z");
    expect(result!.waveHeightM).toBe(1.5);
    expect(result!.wavePeriodS).toBe(8.2);
    expect(result!.waveDirectionDeg).toBe(270);
    expect(result!.waterTempC).toBe(15.5);
    expect(result!.windSpeedMS).toBeNull();
    expect(result!.windDirectionDeg).toBeNull();
  });

  it("should handle null/missing values gracefully", () => {
    const row = {
      time: "2026-01-22T10:30:00Z",
      sea_surface_wave_significant_height: 1.5,
      sea_surface_wave_mean_period: null,
    };
    const variableMap = {
      wave_height: "sea_surface_wave_significant_height",
      wave_period: "sea_surface_wave_mean_period",
    };

    const result = parseObservationRow(row, variableMap);

    expect(result!.waveHeightM).toBe(1.5);
    expect(result!.wavePeriodS).toBeNull();
  });

  it("should return null if time is missing", () => {
    const row = { sea_surface_wave_significant_height: 1.5 };
    const variableMap = { wave_height: "sea_surface_wave_significant_height" };

    const result = parseObservationRow(row, variableMap);

    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts -t "parseObservationRow"`
Expected: FAIL - function not exported

**Step 3: Implement parseObservationRow**

Add to `lib/services/ioos-service.ts`:

```typescript
/**
 * Parsed observation with canonical field names
 */
export interface ParsedObservation {
  observedAt: string;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDirectionDeg: number | null;
  waterTempC: number | null;
  windSpeedMS: number | null;
  windDirectionDeg: number | null;
  raw: Record<string, unknown>;
}

/**
 * Safely convert value to number, returning null for invalid values
 */
function toNumber(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse an ERDDAP response row into a canonical observation
 * Uses the station's variable_map to find the right columns
 */
export function parseObservationRow(
  row: Record<string, unknown>,
  variableMap: Partial<Record<CanonicalVar, string>>
): ParsedObservation | null {
  const time = row["time"];
  if (typeof time !== "string") return null;

  const get = (k?: string): unknown => (k ? row[k] : null);

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

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/services/ioos-capability.test.ts -t "parseObservationRow"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/ioos-service.ts __tests__/lib/services/ioos-capability.test.ts
git commit -m "feat(ioos): add parseObservationRow for canonical field extraction"
```

---

## Task 7: Update fetchObservation to Use Dynamic URL

**Files:**
- Modify: `lib/services/ioos-service.ts`

**Step 1: Update fetchObservation method**

Replace the existing `fetchObservation` method in `IOOSService` class:

```typescript
/**
 * Fetch latest observation for a single station using dynamic URL
 * Requires station to have variable_map populated
 */
async fetchObservationDynamic(
  stationId: string,
  variableMap: Partial<Record<CanonicalVar, string>>
): Promise<ParsedObservation | null> {
  // Check cache first
  const cacheKey = stationId;
  const cached = this.observationCache.get(cacheKey);
  if (cached && Date.now() - cached.at < this.config.cacheTtlMs) {
    return cached.data as ParsedObservation | null;
  }

  const url = buildDynamicObservationUrl(stationId, variableMap);
  if (!url) {
    console.log(`[IOOS] Station ${stationId} has no wave height variable, skipping`);
    return null;
  }

  try {
    const response = await fetchWithTimeout(url, {
      timeoutMs: this.config.timeoutMs,
      init: {
        headers: {
          "User-Agent": this.config.userAgent,
        },
      },
    });

    if (!response.ok) {
      if (response.status === 400) {
        // Likely variable mismatch - mark for re-sync
        console.warn(`[IOOS] Station ${stationId} returned 400, may need variable refresh`);
      }
      this.observationCache.set(cacheKey, { at: Date.now(), data: null });
      return null;
    }

    const json = await response.json();
    const rows = json?.table?.rows || [];
    const columnNames = json?.table?.columnNames || [];

    if (rows.length === 0) {
      this.observationCache.set(cacheKey, { at: Date.now(), data: null });
      return null;
    }

    // Convert array row to object using column names
    const rowObj: Record<string, unknown> = {};
    for (let i = 0; i < columnNames.length; i++) {
      rowObj[columnNames[i]] = rows[0][i];
    }

    const obs = parseObservationRow(rowObj, variableMap);

    // Validate observation is fresh enough to store
    if (obs) {
      const obsTime = new Date(obs.observedAt);
      const maxAge = IOOS_OBSERVATION_CONFIG.maxStorageAgeHours * 3600_000;
      if (Date.now() - obsTime.getTime() > maxAge) {
        console.log(`[IOOS] Station ${stationId} observation too old (${obs.observedAt}), skipping`);
        this.observationCache.set(cacheKey, { at: Date.now(), data: null });
        return null;
      }
    }

    this.observationCache.set(cacheKey, { at: Date.now(), data: obs });
    return obs;
  } catch (error) {
    console.error(`[IOOS] Error fetching observation for ${stationId}:`, error);
    this.observationCache.set(cacheKey, { at: Date.now(), data: null });
    return null;
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `yarn typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/services/ioos-service.ts
git commit -m "feat(ioos): add fetchObservationDynamic with dynamic URL and freshness check"
```

---

## Task 8: Update Cron Sync - Capability Refresh

**Files:**
- Modify: `app/api/cron/ioos-sync/route.ts`

**Step 1: Add capability refresh logic to syncObservations**

In `app/api/cron/ioos-sync/route.ts`, update the `syncObservations` function to refresh variable_map for stations that need it:

```typescript
// Add import at top
import { IOOS_OBSERVATION_CONFIG, CanonicalVar } from "@/lib/constants/ioos-config";

// Add helper function before syncObservations
async function refreshStationCapabilities(
  ioosService: IOOSService,
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  stationIds: string[]
): Promise<number> {
  let refreshed = 0;

  for (const stationId of stationIds) {
    const caps = await ioosService.fetchStationVariables(stationId);
    if (caps) {
      const { error } = await supabase
        .from("ioos_stations")
        .update({
          available_variables: caps.availableVariables,
          variable_map: caps.variableMap,
          variables_last_synced_at: new Date().toISOString(),
        })
        .eq("station_id", stationId);

      if (!error) refreshed++;
    }
    // Small delay to avoid rate limiting
    await delay(100);
  }

  return refreshed;
}

// In syncObservations, after getting stations, add:
// Find stations needing variable refresh
const refreshThreshold = new Date(
  Date.now() - IOOS_OBSERVATION_CONFIG.variableRefreshDays * 24 * 3600_000
).toISOString();

const stationsNeedingRefresh = (stations || [])
  .filter(s => !s.variables_last_synced_at || s.variables_last_synced_at < refreshThreshold)
  .map(s => s.station_id)
  .slice(0, 20); // Limit per run

if (stationsNeedingRefresh.length > 0) {
  console.log(`📡 Refreshing capabilities for ${stationsNeedingRefresh.length} stations...`);
  const refreshed = await refreshStationCapabilities(ioosService, supabase, stationsNeedingRefresh);
  console.log(`✅ Refreshed ${refreshed} station capabilities`);
}
```

**Step 2: Update the station query to include variable_map**

Change the station query in `syncObservations`:

```typescript
const { data: stations, error: stationsError } = await supabase
  .from("ioos_stations")
  .select("station_id, source_network, name, variable_map, variables_last_synced_at")
  .eq("active", true)
  .eq("has_wave_data", true)
  .limit(maxStations);
```

**Step 3: Update observation fetching to use dynamic method**

Replace the batch fetching loop:

```typescript
// Process in batches
for (let i = 0; i < stations.length; i += batchSize) {
  // Check runtime limit
  if (Date.now() - startTime > maxRuntime) {
    console.log(`⏱️ Reached max runtime (${maxRuntime}ms), stopping early`);
    result.stationsSkipped = stations.length - i;
    break;
  }

  const batch = stations.slice(i, i + batchSize);

  console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stations.length / batchSize)}...`);

  // Fetch observations for batch using dynamic URLs
  const batchResults: Array<{ stationId: string; obs: ParsedObservation | null }> = [];

  for (const station of batch) {
    const variableMap = (station.variable_map || {}) as Partial<Record<CanonicalVar, string>>;

    // Skip stations without variable_map (will be refreshed next run)
    if (!variableMap.wave_height) {
      result.stationsSkipped++;
      continue;
    }

    const obs = await ioosService.fetchObservationDynamic(station.station_id, variableMap);
    batchResults.push({ stationId: station.station_id, obs });
  }

  // Prepare observations for insert
  const observationsToInsert: Partial<IOOSObservation>[] = [];

  for (const { stationId, obs } of batchResults) {
    if (obs && obs.waveHeightM !== null) {
      observationsToInsert.push({
        station_id: stationId,
        observed_at: obs.observedAt,
        wave_height_m: obs.waveHeightM,
        wave_period_s: obs.wavePeriodS,
        wave_direction_deg: obs.waveDirectionDeg,
        water_temp_c: obs.waterTempC,
        wind_speed_ms: obs.windSpeedMS,
        wind_direction_deg: obs.windDirectionDeg,
        raw_data: obs.raw,
      });
      result.stationsSynced++;
    } else {
      result.stationsFailed++;
    }
  }

  // Insert observations (ignore duplicates)
  if (observationsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("ioos_observations")
      .upsert(observationsToInsert, {
        onConflict: "station_id,observed_at",
        ignoreDuplicates: true,
      });

    if (insertError) {
      result.errors.push(`Batch insert error: ${insertError.message}`);
    } else {
      result.observationsInserted += observationsToInsert.length;
    }
  }

  // Update last_seen_at for successful stations
  const successfulIds = batchResults
    .filter(r => r.obs !== null)
    .map(r => r.stationId);

  if (successfulIds.length > 0) {
    await supabase
      .from("ioos_stations")
      .update({ last_seen_at: new Date().toISOString() })
      .in("station_id", successfulIds);
  }

  // Small delay between batches
  if (i + batchSize < stations.length) {
    await delay(200);
  }
}
```

**Step 4: Verify TypeScript compiles**

Run: `yarn typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add app/api/cron/ioos-sync/route.ts
git commit -m "feat(cron): update ioos-sync to use dynamic URLs and capability refresh"
```

---

## Task 9: Station Scoring Function

**Files:**
- Create: `lib/services/ioos-station-scorer.ts`
- Create: `__tests__/lib/services/ioos-station-scorer.test.ts`

**Step 1: Write failing tests**

Create `__tests__/lib/services/ioos-station-scorer.test.ts`:

```typescript
import { scoreStation, StationCandidate } from "@/lib/services/ioos-station-scorer";

describe("scoreStation", () => {
  const now = new Date("2026-01-22T12:00:00Z");

  it("should heavily weight freshness", () => {
    const fresh: StationCandidate = {
      stationId: "fresh",
      distanceKm: 50,
      network: "NDBC",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"), // 1 hour ago
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const stale: StationCandidate = {
      stationId: "stale",
      distanceKm: 10, // Closer!
      network: "CDIP", // Higher priority!
      latestObservedAt: new Date("2026-01-22T00:00:00Z"), // 12 hours ago
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const freshScore = scoreStation(fresh, now);
    const staleScore = scoreStation(stale, now);

    // Fresh should beat stale despite being farther and lower priority network
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it("should prefer complete data over partial", () => {
    const complete: StationCandidate = {
      stationId: "complete",
      distanceKm: 50,
      network: "NDBC",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const partial: StationCandidate = {
      stationId: "partial",
      distanceKm: 50,
      network: "NDBC",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: false,
      hasDirection: false,
    };

    const completeScore = scoreStation(complete, now);
    const partialScore = scoreStation(partial, now);

    expect(completeScore).toBeGreaterThan(partialScore);
  });

  it("should apply network bonus", () => {
    const cdip: StationCandidate = {
      stationId: "cdip",
      distanceKm: 50,
      network: "CDIP",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const unknown: StationCandidate = {
      stationId: "unknown",
      distanceKm: 50,
      network: "unknown",
      latestObservedAt: new Date("2026-01-22T11:00:00Z"),
      hasWaveHeight: true,
      hasPeriod: true,
      hasDirection: true,
    };

    const cdipScore = scoreStation(cdip, now);
    const unknownScore = scoreStation(unknown, now);

    expect(cdipScore).toBeGreaterThan(unknownScore);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/services/ioos-station-scorer.test.ts`
Expected: FAIL - module not found

**Step 3: Implement station scorer**

Create `lib/services/ioos-station-scorer.ts`:

```typescript
import { IOOS_NETWORK_PRIORITY } from "@/lib/constants/ioos-config";

/**
 * Candidate station for ranking
 */
export interface StationCandidate {
  stationId: string;
  distanceKm: number;
  network: string;
  latestObservedAt: Date | null;
  hasWaveHeight: boolean;
  hasPeriod: boolean;
  hasDirection: boolean;
}

/**
 * Score a station for selection ranking
 * Higher score = better candidate
 *
 * Weights:
 * - Freshness: 0-1.0 (biggest factor)
 * - Completeness: 0-0.6 (Hs + period + direction)
 * - Distance: 0-0.2 (closer is better)
 * - Network: 0-0.3 (CDIP > NDBC > regional)
 */
export function scoreStation(candidate: StationCandidate, now: Date): number {
  let score = 0;

  // Freshness score (biggest weight)
  if (candidate.latestObservedAt) {
    const ageHours = (now.getTime() - candidate.latestObservedAt.getTime()) / 3600_000;
    if (ageHours <= 2) {
      score += 1.0;
    } else if (ageHours <= 6) {
      score += 0.5;
    } else if (ageHours <= 12) {
      score += 0.1;
    }
    // >12h gets 0
  }

  // Completeness score
  if (candidate.hasWaveHeight) score += 0.3;
  if (candidate.hasPeriod) score += 0.18;      // 0.3 * 0.6
  if (candidate.hasDirection) score += 0.12;  // 0.3 * 0.4

  // Distance score (inverse, capped at 150km)
  const distanceScore = Math.max(0, 1 - candidate.distanceKm / 150);
  score += distanceScore * 0.2;

  // Network bonus
  const networkBonus = IOOS_NETWORK_PRIORITY[candidate.network] ?? 0;
  score += networkBonus;

  return score;
}

/**
 * Rank stations by score (descending)
 */
export function rankStations(
  candidates: StationCandidate[],
  now: Date = new Date()
): Array<StationCandidate & { score: number }> {
  return candidates
    .map(c => ({ ...c, score: scoreStation(c, now) }))
    .sort((a, b) => b.score - a.score);
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/services/ioos-station-scorer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/ioos-station-scorer.ts __tests__/lib/services/ioos-station-scorer.test.ts
git commit -m "feat(ioos): add station scoring function for ranking candidates"
```

---

## Task 10: Cached-First Scoring Integration

**Files:**
- Modify: `lib/services/forecast/data-source-manager.ts`

**Step 1: Add helper to get cached observations**

Add to `data-source-manager.ts`:

```typescript
import { scoreStation, rankStations, StationCandidate } from "@/lib/services/ioos-station-scorer";
import { IOOS_OBSERVATION_CONFIG, CanonicalVar } from "@/lib/constants/ioos-config";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Get latest cached observations for multiple stations
 */
private async getLatestCachedObservations(
  stationIds: string[],
  maxAgeHours: number = IOOS_OBSERVATION_CONFIG.maxCacheAgeHours
): Promise<Map<string, {
  observed_at: string;
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  water_temp_c: number | null;
}>> {
  const supabase = createSupabaseServiceRoleClient();
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();

  const { data, error } = await supabase
    .from("ioos_observations")
    .select("station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg, water_temp_c")
    .in("station_id", stationIds)
    .gte("observed_at", cutoff)
    .order("observed_at", { ascending: false });

  if (error) {
    console.error("[DataSourceManager] Error fetching cached observations:", error);
    return new Map();
  }

  // Group by station, keep only most recent per station
  const result = new Map<string, typeof data[0]>();
  for (const row of data || []) {
    if (!result.has(row.station_id)) {
      result.set(row.station_id, row);
    }
  }

  return result;
}
```

**Step 2: Update fetchBuoyObservationWithFallback**

Replace the existing method:

```typescript
/**
 * Fetch buoy observation with cached-first strategy and station ranking
 *
 * Flow:
 * 1. Find nearby IOOS stations
 * 2. Get cached observations for all candidates
 * 3. Rank stations by freshness, completeness, distance, network
 * 4. Return best cached observation if fresh enough
 * 5. Otherwise, try live fetch for top candidates
 */
async fetchBuoyObservationWithFallback(
  location: Location,
  radiusKm: number = 150
): Promise<{
  source: "CDIP" | "IOOS";
  stationId: string;
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  waterTemp: number | null;
  observedAt: string;
} | null> {
  // Try CDIP first (primary for West Coast) - unchanged
  try {
    const cdipStation = await this.cdipService.getNearestStation(
      location.latitude,
      location.longitude,
      radiusKm
    );

    if (cdipStation) {
      const cdipData = await this.cdipService.fetchBuoyData(cdipStation);
      if (cdipData && cdipData.data && cdipData.data.length > 0) {
        const latestPoint = cdipData.data[cdipData.data.length - 1];
        if (latestPoint.significantWaveHeight !== null) {
          return {
            source: "CDIP",
            stationId: cdipStation,
            waveHeight: latestPoint.significantWaveHeight,
            wavePeriod: latestPoint.peakWavePeriod,
            waveDirection: latestPoint.peakWaveDirection,
            waterTemp: null,
            observedAt: latestPoint.timestamp || cdipData.lastUpdated,
          };
        }
      }
    }
  } catch (error) {
    console.debug('[DataSourceManager] CDIP buoy fetch failed, falling back to IOOS', {
      lat: location.latitude,
      lon: location.longitude,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // IOOS cached-first strategy
  try {
    // 1. Find nearby stations
    const ioosStations = await this.ioosService.findNearbyStations(
      location.latitude,
      location.longitude,
      radiusKm
    );

    if (ioosStations.length === 0) {
      return null;
    }

    // 2. Get cached observations
    const stationIds = ioosStations.map(s => s.station_id);
    const cachedObs = await this.getLatestCachedObservations(stationIds);

    // 3. Build candidates with observation data
    const now = new Date();
    const candidates: StationCandidate[] = ioosStations.map(s => {
      const obs = cachedObs.get(s.station_id);
      return {
        stationId: s.station_id,
        distanceKm: s.distance_to_beach_km || 999,
        network: s.source_network,
        latestObservedAt: obs ? new Date(obs.observed_at) : null,
        hasWaveHeight: obs?.wave_height_m != null,
        hasPeriod: obs?.wave_period_s != null,
        hasDirection: obs?.wave_direction_deg != null,
      };
    });

    // 4. Rank stations
    const ranked = rankStations(candidates, now);

    // 5. Try to use cached observation from best station
    const maxCacheAge = IOOS_OBSERVATION_CONFIG.maxCacheAgeHours * 3600_000;

    for (const candidate of ranked) {
      const obs = cachedObs.get(candidate.stationId);
      if (obs && candidate.latestObservedAt) {
        const age = now.getTime() - candidate.latestObservedAt.getTime();
        if (age <= maxCacheAge && obs.wave_height_m != null) {
          return {
            source: "IOOS",
            stationId: candidate.stationId,
            waveHeight: obs.wave_height_m,
            wavePeriod: obs.wave_period_s,
            waveDirection: obs.wave_direction_deg,
            waterTemp: obs.water_temp_c,
            observedAt: obs.observed_at,
          };
        }
      }
    }

    // 6. Cache miss: try live fetch for top candidates
    const maxAttempts = IOOS_OBSERVATION_CONFIG.maxLiveFetchAttempts;

    for (const candidate of ranked.slice(0, maxAttempts)) {
      const station = ioosStations.find(s => s.station_id === candidate.stationId);
      if (!station) continue;

      const variableMap = (station.variable_map || {}) as Partial<Record<CanonicalVar, string>>;
      if (!variableMap.wave_height) continue;

      const liveObs = await this.ioosService.fetchObservationDynamic(
        candidate.stationId,
        variableMap
      );

      if (liveObs && liveObs.waveHeightM != null) {
        // Write to cache (fire-and-forget)
        const supabase = createSupabaseServiceRoleClient();
        supabase.from("ioos_observations").upsert({
          station_id: candidate.stationId,
          observed_at: liveObs.observedAt,
          wave_height_m: liveObs.waveHeightM,
          wave_period_s: liveObs.wavePeriodS,
          wave_direction_deg: liveObs.waveDirectionDeg,
          water_temp_c: liveObs.waterTempC,
          wind_speed_ms: liveObs.windSpeedMS,
          wind_direction_deg: liveObs.windDirectionDeg,
          raw_data: liveObs.raw,
        }, {
          onConflict: "station_id,observed_at",
          ignoreDuplicates: true,
        }).then(() => {});

        return {
          source: "IOOS",
          stationId: candidate.stationId,
          waveHeight: liveObs.waveHeightM,
          wavePeriod: liveObs.wavePeriodS,
          waveDirection: liveObs.waveDirectionDeg,
          waterTemp: liveObs.waterTempC,
          observedAt: liveObs.observedAt,
        };
      }
    }

    return null;
  } catch (error) {
    console.debug('[DataSourceManager] IOOS observation fetch failed', {
      lat: location.latitude,
      lon: location.longitude,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
```

**Step 3: Add required imports**

At the top of `data-source-manager.ts`, add:

```typescript
import { rankStations, StationCandidate } from "@/lib/services/ioos-station-scorer";
import { IOOS_OBSERVATION_CONFIG, CanonicalVar } from "@/lib/constants/ioos-config";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
```

**Step 4: Verify TypeScript compiles**

Run: `yarn typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add lib/services/forecast/data-source-manager.ts
git commit -m "feat(scoring): implement cached-first IOOS observation fetching with station ranking"
```

---

## Task 11: Debug Script - Verify Fix

**Files:**
- Modify: `scripts/debug-observations.ts`

**Step 1: Update debug script**

Replace `scripts/debug-observations.ts`:

```typescript
#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { IOOSService } from "../lib/services/ioos-service";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function main() {
  console.log("🔍 IOOS Observation Health Check\n");

  // 1. Station capabilities
  const { data: stations } = await supabase
    .from("ioos_stations")
    .select("station_id, source_network, variable_map, variables_last_synced_at")
    .eq("active", true)
    .eq("has_wave_data", true);

  const withVarMap = (stations || []).filter(
    (s) => s.variable_map && Object.keys(s.variable_map).length > 0
  );
  const withoutVarMap = (stations || []).filter(
    (s) => !s.variable_map || Object.keys(s.variable_map).length === 0
  );

  console.log(`📡 Stations: ${stations?.length || 0} total`);
  console.log(`   With variable_map: ${withVarMap.length}`);
  console.log(`   Missing variable_map: ${withoutVarMap.length}`);

  // 2. Observation freshness
  const { data: obs } = await supabase
    .from("ioos_observations")
    .select("station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg, water_temp_c");

  const now = Date.now();
  const fresh2h = (obs || []).filter(
    (o) => now - new Date(o.observed_at).getTime() < 2 * 3600_000
  );
  const fresh6h = (obs || []).filter(
    (o) => now - new Date(o.observed_at).getTime() < 6 * 3600_000
  );
  const stale = (obs || []).filter(
    (o) => now - new Date(o.observed_at).getTime() > 24 * 3600_000
  );

  console.log(`\n📊 Observations: ${obs?.length || 0} total`);
  console.log(`   Fresh (<2h): ${fresh2h.length}`);
  console.log(`   Recent (<6h): ${fresh6h.length}`);
  console.log(`   Stale (>24h): ${stale.length}`);

  // 3. Field coverage
  const hasHeight = (obs || []).filter((o) => o.wave_height_m != null).length;
  const hasPeriod = (obs || []).filter((o) => o.wave_period_s != null).length;
  const hasDir = (obs || []).filter((o) => o.wave_direction_deg != null).length;
  const hasTemp = (obs || []).filter((o) => o.water_temp_c != null).length;

  console.log(`\n📈 Field coverage:`);
  console.log(`   wave_height: ${hasHeight} (${((hasHeight / (obs?.length || 1)) * 100).toFixed(0)}%)`);
  console.log(`   wave_period: ${hasPeriod} (${((hasPeriod / (obs?.length || 1)) * 100).toFixed(0)}%)`);
  console.log(`   wave_direction: ${hasDir} (${((hasDir / (obs?.length || 1)) * 100).toFixed(0)}%)`);
  console.log(`   water_temp: ${hasTemp} (${((hasTemp / (obs?.length || 1)) * 100).toFixed(0)}%)`);

  // 4. Sample variable maps
  console.log(`\n🔧 Sample variable maps:`);
  for (const s of withVarMap.slice(0, 5)) {
    console.log(`   ${s.station_id}: ${JSON.stringify(s.variable_map)}`);
  }

  // 5. Test live fetch with new dynamic URL
  console.log(`\n🧪 Testing dynamic fetch for sample station...`);
  const service = new IOOSService();
  const testStation = withVarMap[0];

  if (testStation) {
    const caps = await service.fetchStationVariables(testStation.station_id);
    if (caps) {
      console.log(`   Variables found: ${caps.availableVariables.length}`);
      console.log(`   Variable map: ${JSON.stringify(caps.variableMap)}`);

      const obs = await service.fetchObservationDynamic(
        testStation.station_id,
        caps.variableMap
      );
      if (obs) {
        console.log(`   ✅ Got observation: ${JSON.stringify({
          observedAt: obs.observedAt,
          waveHeightM: obs.waveHeightM,
          wavePeriodS: obs.wavePeriodS,
          waveDirectionDeg: obs.waveDirectionDeg,
        })}`);
      } else {
        console.log(`   ❌ No observation returned`);
      }
    }
  }
}

main().catch(console.error);
```

**Step 2: Run debug script**

Run: `npx tsx scripts/debug-observations.ts`
Expected: Should show station capabilities, observation freshness, and field coverage

**Step 3: Commit**

```bash
git add scripts/debug-observations.ts
git commit -m "chore(scripts): update debug script for new IOOS capabilities"
```

---

## Task 12: Clean Up Stale Data

**Files:**
- Create: `scripts/cleanup-stale-ioos-data.ts`

**Step 1: Create cleanup script**

```typescript
#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function main() {
  console.log("🧹 Cleaning up stale IOOS data...\n");

  // 1. Delete observations older than 90 days
  const retentionCutoff = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();

  const { data: oldObs, error: countError } = await supabase
    .from("ioos_observations")
    .select("id", { count: "exact", head: true })
    .lt("observed_at", retentionCutoff);

  console.log(`Found ${oldObs} observations older than 90 days`);

  const { error: deleteError } = await supabase
    .from("ioos_observations")
    .delete()
    .lt("observed_at", retentionCutoff);

  if (deleteError) {
    console.error("Error deleting old observations:", deleteError);
  } else {
    console.log("✅ Deleted old observations");
  }

  // 2. Delete ancient observations (>24h old from current sync)
  const freshnessCutoff = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { error: ancientError } = await supabase
    .from("ioos_observations")
    .delete()
    .lt("observed_at", freshnessCutoff);

  if (ancientError) {
    console.error("Error deleting ancient observations:", ancientError);
  } else {
    console.log("✅ Deleted ancient observations (>24h)");
  }

  // 3. Count remaining
  const { count: remaining } = await supabase
    .from("ioos_observations")
    .select("*", { count: "exact", head: true });

  console.log(`\n📊 Remaining observations: ${remaining}`);
}

main().catch(console.error);
```

**Step 2: Run cleanup**

Run: `npx tsx scripts/cleanup-stale-ioos-data.ts`
Expected: Deletes stale observations

**Step 3: Commit**

```bash
git add scripts/cleanup-stale-ioos-data.ts
git commit -m "chore(scripts): add IOOS data cleanup script"
```

---

## Task 13: Run Full Sync and Verify

**Step 1: Run capability refresh for all stations**

Create a one-time script `scripts/refresh-all-capabilities.ts`:

```typescript
#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { IOOSService } from "../lib/services/ioos-service";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function main() {
  console.log("🔄 Refreshing all station capabilities...\n");

  const service = new IOOSService();

  const { data: stations } = await supabase
    .from("ioos_stations")
    .select("station_id")
    .eq("active", true)
    .eq("has_wave_data", true);

  let success = 0;
  let failed = 0;

  for (const station of stations || []) {
    const caps = await service.fetchStationVariables(station.station_id);

    if (caps && Object.keys(caps.variableMap).length > 0) {
      const { error } = await supabase
        .from("ioos_stations")
        .update({
          available_variables: caps.availableVariables,
          variable_map: caps.variableMap,
          variables_last_synced_at: new Date().toISOString(),
        })
        .eq("station_id", station.station_id);

      if (!error) {
        success++;
        process.stdout.write(".");
      } else {
        failed++;
        process.stdout.write("x");
      }
    } else {
      failed++;
      process.stdout.write("x");
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n\n✅ Refreshed ${success} stations, ${failed} failed`);
}

main().catch(console.error);
```

**Step 2: Run capability refresh**

Run: `npx tsx scripts/refresh-all-capabilities.ts`
Expected: Refreshes variable_map for all stations

**Step 3: Run observation sync**

Run: `npx tsx scripts/run-obs-sync.ts`
Expected: Observations now have period, direction, temp populated

**Step 4: Verify with debug script**

Run: `npx tsx scripts/debug-observations.ts`
Expected:
- Most stations have variable_map
- Observations have >50% wave_period coverage
- Observations have >30% wave_direction coverage
- No stale (>24h) observations

**Step 5: Commit all scripts**

```bash
git add scripts/refresh-all-capabilities.ts
git commit -m "chore(scripts): add capability refresh script"
```

---

## Final Verification Checklist

- [ ] Migration applied (`supabase db push`)
- [ ] All tests passing (`yarn test`)
- [ ] TypeScript compiles (`yarn typecheck`)
- [ ] Capability refresh complete (>80% stations have variable_map)
- [ ] Debug script shows:
  - wave_height coverage: 100%
  - wave_period coverage: >50%
  - wave_direction coverage: >30%
  - No stale observations (>24h)
- [ ] Manual test: scoring uses cached observations

---

*End of Implementation Plan*
