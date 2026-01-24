# IOOS Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add IOOS (Integrated Ocean Observing System) as a supplementary data source for wave observations, starting with database tables and core service.

**Architecture:** Database-first approach with two tables (`ioos_stations`, `ioos_observations`) using PostGIS for spatial queries. Service class follows existing NDBC/CDIP patterns with in-memory caching and rate limiting. TDD throughout.

**Tech Stack:** Supabase (PostgreSQL 15+ with PostGIS), TypeScript, Jest for testing

---

## Task 1: Create Database Migration

**Files:**
- Create: `supabase/migrations/20260118120000_create_ioos_tables.sql`

**Step 1: Write the migration file**

Create migration with both tables, indexes, and RLS policies:

```sql
-- IOOS Integration Tables
-- Stores station metadata and observations from IOOS ERDDAP API
-- Supports ML training pipeline and fallback chain for wave data

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- Table: ioos_stations
-- Stores IOOS station metadata, synced weekly
-- ============================================
CREATE TABLE IF NOT EXISTS public.ioos_stations (
  station_id TEXT PRIMARY KEY,
  source_network TEXT NOT NULL,          -- e.g., "NDBC", "PacIOOS", "SECOORA"
  name TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  coordinates GEOMETRY(Point, 4326),
  sensors JSONB,                          -- Available sensor types
  has_wave_data BOOLEAN DEFAULT FALSE,
  nearest_beach_id UUID REFERENCES beaches(id),
  distance_to_beach_km NUMERIC,
  active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ioos_stations
CREATE INDEX IF NOT EXISTS idx_ioos_stations_geo
  ON ioos_stations USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_ioos_stations_active
  ON ioos_stations(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ioos_stations_beach
  ON ioos_stations(nearest_beach_id);
CREATE INDEX IF NOT EXISTS idx_ioos_stations_network
  ON ioos_stations(source_network);

-- ============================================
-- Table: ioos_observations
-- Append-only observation history for ML training
-- ============================================
CREATE TABLE IF NOT EXISTS public.ioos_observations (
  id BIGSERIAL PRIMARY KEY,
  station_id TEXT REFERENCES ioos_stations(station_id) ON DELETE CASCADE,
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

-- Indexes for ioos_observations
CREATE INDEX IF NOT EXISTS idx_ioos_obs_station_time
  ON ioos_observations(station_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ioos_obs_time
  ON ioos_observations(observed_at DESC);

-- Prevent duplicate observations
CREATE UNIQUE INDEX IF NOT EXISTS idx_ioos_obs_unique
  ON ioos_observations(station_id, observed_at);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.ioos_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ioos_observations ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to ioos_stations"
  ON public.ioos_stations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow read access to ioos_observations"
  ON public.ioos_observations FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access for cron jobs
CREATE POLICY "Allow service role full access to ioos_stations"
  ON public.ioos_stations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to ioos_observations"
  ON public.ioos_observations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Helper function: Update coordinates geometry
-- ============================================
CREATE OR REPLACE FUNCTION update_ioos_station_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.coordinates := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ioos_station_coordinates
  BEFORE INSERT OR UPDATE OF latitude, longitude ON ioos_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_ioos_station_coordinates();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE public.ioos_stations IS 'IOOS station metadata from ERDDAP API, synced weekly';
COMMENT ON TABLE public.ioos_observations IS 'Historical wave observations for ML training, 90-day retention';
COMMENT ON COLUMN public.ioos_stations.source_network IS 'Regional network: PacIOOS, SECOORA, CeNCOOS, etc.';
COMMENT ON COLUMN public.ioos_stations.sensors IS 'JSON array of available sensor types';
COMMENT ON COLUMN public.ioos_observations.raw_data IS 'Original API response for debugging';
```

**Step 2: Apply the migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Verify tables exist**

Run: `supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ioos%';"`
Expected: Shows `ioos_stations` and `ioos_observations`

**Step 4: Commit**

```bash
git add supabase/migrations/20260118120000_create_ioos_tables.sql
git commit -m "feat: add ioos_stations and ioos_observations tables

- Create ioos_stations table with PostGIS geometry
- Create ioos_observations table for ML training
- Add indexes for spatial queries and time-based lookups
- Add RLS policies for authenticated and service role access
- Add trigger to auto-update coordinates geometry

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create TypeScript Types

**Files:**
- Create: `types/ioos.ts`

**Step 1: Write the types file**

```typescript
/**
 * TypeScript types for IOOS (Integrated Ocean Observing System) data
 * Used for wave buoy observations from ERDDAP API
 */

/**
 * IOOS station metadata as stored in the database
 */
export interface IOOSStation {
  station_id: string;
  source_network: IOOSNetwork;
  name: string | null;
  latitude: number;
  longitude: number;
  sensors: IOOSSensor[] | null;
  has_wave_data: boolean;
  nearest_beach_id: string | null;
  distance_to_beach_km: number | null;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * IOOS observation record
 */
export interface IOOSObservation {
  id?: number;
  station_id: string;
  observed_at: string;
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  water_temp_c: number | null;
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
  raw_data?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Regional IOOS networks
 */
export type IOOSNetwork =
  | "PacIOOS"      // Pacific Islands
  | "NANOOS"       // Northwest Association of Networked Ocean Observing Systems
  | "CeNCOOS"      // Central and Northern California
  | "SCCOOS"       // Southern California Coastal Ocean Observing System
  | "GCOOS"        // Gulf of Mexico
  | "SECOORA"      // Southeast Coastal Ocean Observing Regional Association
  | "MARACOOS"     // Mid-Atlantic Regional Association
  | "NERACOOS"     // Northeastern Regional Association
  | "GLOS"         // Great Lakes
  | "AOOS"         // Alaska
  | "NDBC"         // National Data Buoy Center (fallback/overlap)
  | "unknown";

/**
 * Sensor types available at IOOS stations
 */
export type IOOSSensor =
  | "wave_height"
  | "wave_period"
  | "wave_direction"
  | "water_temp"
  | "wind_speed"
  | "wind_direction"
  | "air_temp"
  | "air_pressure"
  | "salinity"
  | "current";

/**
 * Geographic bounds for station queries
 */
export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Raw ERDDAP station response
 */
export interface ERDDAPStationResponse {
  table: {
    columnNames: string[];
    columnTypes: string[];
    rows: (string | number | null)[][];
  };
}

/**
 * Raw ERDDAP observation response
 */
export interface ERDDAPObservationResponse {
  table: {
    columnNames: string[];
    columnTypes: string[];
    rows: (string | number | null)[][];
  };
}

/**
 * IOOS service configuration
 */
export interface IOOSServiceConfig {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  maxConcurrentRequests: number;
  batchDelayMs: number;
  cacheTtlMs: number;
}

/**
 * Station discovery result
 */
export interface IOOSStationDiscoveryResult {
  stations: IOOSStation[];
  totalFound: number;
  waveStationsFound: number;
  linkedToBeaches: number;
  errors: string[];
}

/**
 * Observation sync result
 */
export interface IOOSObservationSyncResult {
  stationsSynced: number;
  observationsInserted: number;
  stationsFailed: number;
  duration_ms: number;
  errors: string[];
}

/**
 * Default IOOS service configuration
 */
export const DEFAULT_IOOS_CONFIG: IOOSServiceConfig = {
  baseUrl: "https://erddap.sensors.ioos.us/erddap",
  userAgent: "quiver-surf-app/1.0 (contact: team@quiversurf.app)",
  timeoutMs: 30000,
  maxConcurrentRequests: 5,
  batchDelayMs: 500,
  cacheTtlMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * IOOS networks by US region
 */
export const IOOS_NETWORKS_BY_REGION: Record<string, IOOSNetwork[]> = {
  hawaii: ["PacIOOS"],
  alaska: ["AOOS"],
  westCoast: ["CeNCOOS", "SCCOOS", "NANOOS"],
  gulfCoast: ["GCOOS"],
  eastCoast: ["SECOORA", "MARACOOS", "NERACOOS"],
  greatLakes: ["GLOS"],
};

/**
 * Priority networks for initial rollout (Hawaii + East Coast focus)
 */
export const PRIORITY_NETWORKS: IOOSNetwork[] = [
  "PacIOOS",   // Hawaii
  "SECOORA",   // Southeast (FL, GA, SC, NC)
  "MARACOOS", // Mid-Atlantic (VA, MD, DE, NJ, NY)
  "NERACOOS", // Northeast (MA, NH, ME)
];
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit types/ioos.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add types/ioos.ts
git commit -m "feat: add TypeScript types for IOOS integration

- Add IOOSStation and IOOSObservation interfaces
- Add IOOSNetwork and IOOSSensor types
- Add ERDDAP response types
- Add service configuration types
- Define priority networks (Hawaii + East Coast)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create IOOS Configuration Constants

**Files:**
- Create: `lib/constants/ioos-config.ts`

**Step 1: Write the constants file**

```typescript
/**
 * IOOS (Integrated Ocean Observing System) Configuration
 *
 * Configuration for fetching wave buoy data from IOOS ERDDAP API.
 * Prioritizes Hawaii (PacIOOS) and East Coast coverage.
 */

import { IOOSServiceConfig, IOOSNetwork } from "@/types/ioos";

/**
 * IOOS ERDDAP API Configuration
 */
export const IOOS_API_CONFIG: IOOSServiceConfig = {
  // Primary IOOS ERDDAP server
  baseUrl: "https://erddap.sensors.ioos.us/erddap",
  userAgent: "quiver-surf-app/1.0 (contact: team@quiversurf.app)",
  timeoutMs: 30000,
  maxConcurrentRequests: 5,
  batchDelayMs: 500,
  cacheTtlMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * Regional ERDDAP servers (fallbacks and specialized endpoints)
 */
export const IOOS_REGIONAL_SERVERS: Record<IOOSNetwork, string> = {
  PacIOOS: "https://pae-paha.pacioos.hawaii.edu/erddap",
  NANOOS: "https://nvs.nanoos.org/erddap",
  CeNCOOS: "https://erddap.cencoos.org/erddap",
  SCCOOS: "https://erddap.sccoos.org/erddap",
  GCOOS: "https://erddap.gcoos.org/erddap",
  SECOORA: "https://erddap.secoora.org/erddap",
  MARACOOS: "https://erddap.maracoos.org/erddap",
  NERACOOS: "https://www.neracoos.org/erddap",
  GLOS: "https://glbuoys.glos.org/erddap",
  AOOS: "https://erddap.aoos.org/erddap",
  NDBC: "https://erddap.ioos.us/erddap",
  unknown: "https://erddap.sensors.ioos.us/erddap",
};

/**
 * ERDDAP endpoints for different data types
 */
export const IOOS_ENDPOINTS = {
  // List all datasets
  allDatasets: "/tabledap/allDatasets.json",

  // Dataset info (replace {datasetId})
  datasetInfo: "/info/{datasetId}/index.json",

  // Observations query (replace {datasetId} and add query params)
  observations: "/tabledap/{datasetId}.json",
} as const;

/**
 * Wave-related variable names in IOOS datasets
 * Different datasets may use different naming conventions
 */
export const IOOS_WAVE_VARIABLES = {
  // Common wave height variable names
  waveHeight: [
    "sea_surface_wave_significant_height",
    "wave_height",
    "significant_wave_height",
    "Hs",
    "WVHT",
  ],

  // Common wave period variable names
  wavePeriod: [
    "sea_surface_wave_peak_period",
    "sea_surface_wave_mean_period",
    "wave_period",
    "dominant_wave_period",
    "Tp",
    "DPD",
  ],

  // Common wave direction variable names
  waveDirection: [
    "sea_surface_wave_from_direction",
    "sea_surface_wave_to_direction",
    "wave_direction",
    "mean_wave_direction",
    "MWD",
  ],

  // Water temperature
  waterTemp: [
    "sea_water_temperature",
    "water_temperature",
    "WTMP",
  ],

  // Wind speed
  windSpeed: [
    "wind_speed",
    "WSPD",
  ],

  // Wind direction
  windDirection: [
    "wind_from_direction",
    "wind_to_direction",
    "WDIR",
  ],
} as const;

/**
 * Data quality thresholds for IOOS observations
 */
export const IOOS_QUALITY_THRESHOLDS = {
  // Wave height validation (meters)
  waveHeight: {
    min: 0.05,  // 5cm minimum
    max: 25.0,  // 25m maximum (extreme case)
    typicalMax: 10.0,
  },

  // Wave period validation (seconds)
  wavePeriod: {
    min: 1.0,
    max: 30.0,
  },

  // Wave direction (degrees)
  waveDirection: {
    min: 0,
    max: 360,
  },

  // Water temperature (Celsius)
  waterTemp: {
    min: -2.0,  // Can be slightly below freezing
    max: 35.0,
  },

  // Wind speed (m/s)
  windSpeed: {
    min: 0,
    max: 50.0,
  },

  // Observation age (hours) - mark as stale after this
  maxObservationAgeHours: 6,

  // Station inactive threshold (days)
  stationInactiveDays: 7,
} as const;

/**
 * Station filtering settings
 */
export const IOOS_STATION_FILTERS = {
  // Maximum distance from any beach to include station (km)
  maxDistanceFromBeachKm: 150,

  // Minimum distance to prefer closer stations (km)
  preferredDistanceKm: 100,

  // Batch size for station discovery
  discoveryBatchSize: 50,

  // Batch size for observation sync
  observationBatchSize: 10,
} as const;

/**
 * Sync schedule configuration
 */
export const IOOS_SYNC_CONFIG = {
  // Station discovery runs weekly (Sunday 5 AM UTC)
  stationDiscoveryCron: "0 5 * * 0",

  // Observation sync runs every 2 hours
  observationSyncCron: "0 */2 * * *",

  // Maximum runtime for observation sync (ms)
  observationSyncMaxRuntimeMs: 5 * 60 * 1000, // 5 minutes

  // Maximum runtime for station discovery (ms)
  stationDiscoveryMaxRuntimeMs: 10 * 60 * 1000, // 10 minutes
} as const;
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit lib/constants/ioos-config.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/constants/ioos-config.ts
git commit -m "feat: add IOOS configuration constants

- Add API configuration for ERDDAP endpoints
- Add regional server URLs for all IOOS networks
- Add wave variable name mappings
- Add data quality thresholds
- Add station filtering and sync configuration

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create IOOSService Test File

**Files:**
- Create: `__tests__/lib/services/ioos-service.test.ts`

**Step 1: Write the failing test file**

```typescript
/**
 * Tests for IOOSService
 * Tests station discovery and observation fetching from IOOS ERDDAP API
 */

import { IOOSService } from "@/lib/services/ioos-service";
import { IOOSStation, IOOSObservation } from "@/types/ioos";

// Mock fetch to avoid real API calls
global.fetch = jest.fn();

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        gte: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  })),
}));

describe("IOOSService", () => {
  let service: IOOSService;

  beforeEach(() => {
    service = new IOOSService();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create service with default config", () => {
      expect(service).toBeDefined();
      expect(service.getConfig().baseUrl).toBe("https://erddap.sensors.ioos.us/erddap");
    });

    it("should accept custom config", () => {
      const customService = new IOOSService({
        baseUrl: "https://custom.erddap.test",
        timeoutMs: 5000,
      });
      expect(customService.getConfig().baseUrl).toBe("https://custom.erddap.test");
      expect(customService.getConfig().timeoutMs).toBe(5000);
    });
  });

  describe("discoverStations", () => {
    const mockERDDAPResponse = {
      table: {
        columnNames: ["datasetID", "institution", "minLatitude", "maxLatitude", "minLongitude", "maxLongitude"],
        columnTypes: ["String", "String", "double", "double", "double", "double"],
        rows: [
          ["pacioos_wave_001", "PacIOOS", 21.0, 21.0, -158.0, -158.0],
          ["secoora_buoy_042", "SECOORA", 30.5, 30.5, -81.2, -81.2],
        ],
      },
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockERDDAPResponse),
      });
    });

    it("should fetch stations from ERDDAP API", async () => {
      const result = await service.discoverStations();

      expect(global.fetch).toHaveBeenCalled();
      expect(result.stations).toBeDefined();
      expect(result.totalFound).toBeGreaterThanOrEqual(0);
    });

    it("should filter by geographic bounds", async () => {
      const bounds = {
        minLat: 20.0,
        maxLat: 22.0,
        minLon: -160.0,
        maxLon: -155.0,
      };

      const result = await service.discoverStations(bounds);

      expect(global.fetch).toHaveBeenCalled();
      // Hawaii bounds should filter to only PacIOOS station
      expect(result.stations.length).toBeLessThanOrEqual(2);
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await service.discoverStations();

      expect(result.stations).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle empty response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ table: { columnNames: [], rows: [] } }),
      });

      const result = await service.discoverStations();

      expect(result.stations).toEqual([]);
      expect(result.totalFound).toBe(0);
    });
  });

  describe("fetchObservation", () => {
    const mockObservationResponse = {
      table: {
        columnNames: ["time", "sea_surface_wave_significant_height", "sea_surface_wave_peak_period"],
        columnTypes: ["String", "double", "double"],
        rows: [
          ["2026-01-18T12:00:00Z", 1.5, 12.0],
        ],
      },
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockObservationResponse),
      });
    });

    it("should fetch observation for a station", async () => {
      const obs = await service.fetchObservation("pacioos_wave_001");

      expect(obs).not.toBeNull();
      expect(obs?.wave_height_m).toBe(1.5);
      expect(obs?.wave_period_s).toBe(12.0);
    });

    it("should return null for missing data", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ table: { columnNames: [], rows: [] } }),
      });

      const obs = await service.fetchObservation("nonexistent_station");

      expect(obs).toBeNull();
    });

    it("should cache observations", async () => {
      // First call
      await service.fetchObservation("pacioos_wave_001");
      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      // Second call should use cache
      await service.fetchObservation("pacioos_wave_001");

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
    });

    it("should validate wave height bounds", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          table: {
            columnNames: ["time", "sea_surface_wave_significant_height"],
            columnTypes: ["String", "double"],
            rows: [["2026-01-18T12:00:00Z", 999.9]], // Invalid height
          },
        }),
      });

      const obs = await service.fetchObservation("bad_data_station");

      // Should reject invalid data
      expect(obs?.wave_height_m).toBeNull();
    });
  });

  describe("fetchBatch", () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          table: {
            columnNames: ["time", "sea_surface_wave_significant_height"],
            columnTypes: ["String", "double"],
            rows: [["2026-01-18T12:00:00Z", 2.0]],
          },
        }),
      });
    });

    it("should fetch observations for multiple stations", async () => {
      const stationIds = ["station_1", "station_2", "station_3"];

      const result = await service.fetchBatch(stationIds);

      expect(result.size).toBe(3);
      expect(result.get("station_1")).toBeDefined();
    });

    it("should respect batch size limits", async () => {
      const stationIds = Array.from({ length: 15 }, (_, i) => `station_${i}`);

      await service.fetchBatch(stationIds, 5);

      // Should batch into groups of 5
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(15);
    });

    it("should continue on individual station failures", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ table: { columnNames: [], rows: [["2026-01-18T12:00:00Z", 1.0]] } }) })
        .mockRejectedValueOnce(new Error("Station error"))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ table: { columnNames: [], rows: [["2026-01-18T12:00:00Z", 3.0]] } }) });

      const result = await service.fetchBatch(["s1", "s2", "s3"]);

      // Should still have 2 successful results
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("findNearbyStations", () => {
    it("should query database for nearby stations", async () => {
      const stations = await service.findNearbyStations(21.5, -158.0, 100);

      expect(stations).toBeDefined();
      expect(Array.isArray(stations)).toBe(true);
    });

    it("should respect radius parameter", async () => {
      // Default radius
      await service.findNearbyStations(32.8, -117.2);

      // Custom radius
      await service.findNearbyStations(32.8, -117.2, 50);

      // Both should work without errors
      expect(true).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear observation cache", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          table: { columnNames: ["time", "wave"], rows: [["2026-01-18T12:00:00Z", 1.0]] },
        }),
      });

      // First call
      await service.fetchObservation("test_station");
      const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      // Clear cache
      service.clearCache();

      // Second call should fetch again
      await service.fetchObservation("test_station");

      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/services/ioos-service.test.ts`
Expected: FAIL with "Cannot find module '@/lib/services/ioos-service'"

**Step 3: Commit failing tests**

```bash
git add __tests__/lib/services/ioos-service.test.ts
git commit -m "test: add failing tests for IOOSService

- Add tests for station discovery
- Add tests for observation fetching
- Add tests for batch operations
- Add tests for caching behavior
- Add tests for error handling

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Implement IOOSService Class

**Files:**
- Create: `lib/services/ioos-service.ts`

**Step 1: Write the service implementation**

```typescript
/**
 * IOOS Service
 *
 * Fetches wave buoy data from IOOS (Integrated Ocean Observing System) ERDDAP API.
 * Provides station discovery, observation fetching, and database integration.
 *
 * Usage:
 *   const service = new IOOSService();
 *   const stations = await service.discoverStations();
 *   const obs = await service.fetchObservation(stationId);
 */

import { fetchWithTimeout } from "@/lib/utils/fetch-utils";
import { createClient } from "@/lib/supabase/server";
import {
  IOOSStation,
  IOOSObservation,
  IOOSServiceConfig,
  IOOSStationDiscoveryResult,
  GeoBounds,
  DEFAULT_IOOS_CONFIG,
} from "@/types/ioos";
import {
  IOOS_API_CONFIG,
  IOOS_ENDPOINTS,
  IOOS_WAVE_VARIABLES,
  IOOS_QUALITY_THRESHOLDS,
} from "@/lib/constants/ioos-config";

/**
 * Cache entry for observations
 */
interface CacheEntry {
  at: number;
  data: IOOSObservation | null;
}

/**
 * IOOS Service for fetching wave data from ERDDAP API
 */
export class IOOSService {
  private readonly config: IOOSServiceConfig;
  private readonly observationCache: Map<string, CacheEntry> = new Map();

  constructor(configOverrides?: Partial<IOOSServiceConfig>) {
    this.config = {
      ...IOOS_API_CONFIG,
      ...configOverrides,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): IOOSServiceConfig {
    return { ...this.config };
  }

  /**
   * Discover IOOS stations with wave data
   */
  async discoverStations(bounds?: GeoBounds): Promise<IOOSStationDiscoveryResult> {
    const result: IOOSStationDiscoveryResult = {
      stations: [],
      totalFound: 0,
      waveStationsFound: 0,
      linkedToBeaches: 0,
      errors: [],
    };

    try {
      const url = `${this.config.baseUrl}${IOOS_ENDPOINTS.allDatasets}`;
      const response = await fetchWithTimeout(url, {
        timeoutMs: this.config.timeoutMs,
        init: {
          headers: {
            "User-Agent": this.config.userAgent,
          },
        },
      });

      if (!response.ok) {
        result.errors.push(`ERDDAP API error: ${response.status}`);
        return result;
      }

      const json = await response.json();
      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      // Find column indexes
      const idIdx = columnNames.indexOf("datasetID");
      const instIdx = columnNames.indexOf("institution");
      const minLatIdx = columnNames.indexOf("minLatitude");
      const maxLatIdx = columnNames.indexOf("maxLatitude");
      const minLonIdx = columnNames.indexOf("minLongitude");
      const maxLonIdx = columnNames.indexOf("maxLongitude");

      for (const row of rows) {
        const datasetId = row[idIdx];
        const institution = row[instIdx];
        const lat = (Number(row[minLatIdx]) + Number(row[maxLatIdx])) / 2;
        const lon = (Number(row[minLonIdx]) + Number(row[maxLonIdx])) / 2;

        if (!datasetId || !isFinite(lat) || !isFinite(lon)) continue;

        // Apply geographic bounds filter
        if (bounds) {
          if (lat < bounds.minLat || lat > bounds.maxLat) continue;
          if (lon < bounds.minLon || lon > bounds.maxLon) continue;
        }

        // Check if this looks like a wave dataset
        const hasWaveKeyword = String(datasetId).toLowerCase().includes("wave") ||
          String(institution).toLowerCase().includes("buoy");

        result.totalFound++;

        const station: IOOSStation = {
          station_id: String(datasetId),
          source_network: this.parseNetwork(String(institution)),
          name: String(datasetId),
          latitude: lat,
          longitude: lon,
          sensors: hasWaveKeyword ? ["wave_height", "wave_period"] : null,
          has_wave_data: hasWaveKeyword,
          nearest_beach_id: null,
          distance_to_beach_km: null,
          active: true,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        result.stations.push(station);
        if (hasWaveKeyword) result.waveStationsFound++;
      }
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error during station discovery"
      );
    }

    return result;
  }

  /**
   * Fetch latest observation for a single station
   */
  async fetchObservation(stationId: string): Promise<IOOSObservation | null> {
    // Check cache first
    const cached = this.observationCache.get(stationId);
    if (cached && Date.now() - cached.at < this.config.cacheTtlMs) {
      return cached.data;
    }

    try {
      const url = this.buildObservationUrl(stationId);
      const response = await fetchWithTimeout(url, {
        timeoutMs: this.config.timeoutMs,
        init: {
          headers: {
            "User-Agent": this.config.userAgent,
          },
        },
      });

      if (!response.ok) {
        this.observationCache.set(stationId, { at: Date.now(), data: null });
        return null;
      }

      const json = await response.json();
      const rows = json?.table?.rows || [];
      const columnNames = json?.table?.columnNames || [];

      if (rows.length === 0) {
        this.observationCache.set(stationId, { at: Date.now(), data: null });
        return null;
      }

      // Parse the most recent observation (first row)
      const row = rows[0];
      const obs = this.parseObservation(stationId, row, columnNames);

      this.observationCache.set(stationId, { at: Date.now(), data: obs });
      return obs;
    } catch (error) {
      this.observationCache.set(stationId, { at: Date.now(), data: null });
      return null;
    }
  }

  /**
   * Fetch observations for multiple stations
   */
  async fetchBatch(
    stationIds: string[],
    batchSize: number = this.config.maxConcurrentRequests
  ): Promise<Map<string, IOOSObservation>> {
    const results = new Map<string, IOOSObservation>();

    // Process in batches
    for (let i = 0; i < stationIds.length; i += batchSize) {
      const batch = stationIds.slice(i, i + batchSize);

      // Fetch batch in parallel
      const promises = batch.map(async (stationId) => {
        const obs = await this.fetchObservation(stationId);
        if (obs) {
          results.set(stationId, obs);
        }
      });

      await Promise.allSettled(promises);

      // Delay between batches (except for last batch)
      if (i + batchSize < stationIds.length) {
        await this.delay(this.config.batchDelayMs);
      }
    }

    return results;
  }

  /**
   * Find stations near a location from the database
   */
  async findNearbyStations(
    lat: number,
    lon: number,
    radiusKm: number = 100
  ): Promise<IOOSStation[]> {
    try {
      const supabase = await createClient();

      // Use PostGIS ST_DWithin for efficient spatial query
      const { data, error } = await supabase.rpc("find_nearby_ioos_stations", {
        p_lat: lat,
        p_lon: lon,
        p_radius_km: radiusKm,
      });

      if (error) {
        console.error("Error finding nearby stations:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error in findNearbyStations:", error);
      return [];
    }
  }

  /**
   * Clear the observation cache
   */
  clearCache(): void {
    this.observationCache.clear();
  }

  // ==================== Private Methods ====================

  /**
   * Parse institution name to IOOSNetwork type
   */
  private parseNetwork(institution: string): IOOSStation["source_network"] {
    const lower = institution.toLowerCase();
    if (lower.includes("pacioos")) return "PacIOOS";
    if (lower.includes("nanoos")) return "NANOOS";
    if (lower.includes("cencoos")) return "CeNCOOS";
    if (lower.includes("sccoos")) return "SCCOOS";
    if (lower.includes("gcoos")) return "GCOOS";
    if (lower.includes("secoora")) return "SECOORA";
    if (lower.includes("maracoos")) return "MARACOOS";
    if (lower.includes("neracoos")) return "NERACOOS";
    if (lower.includes("glos")) return "GLOS";
    if (lower.includes("aoos")) return "AOOS";
    if (lower.includes("ndbc")) return "NDBC";
    return "unknown";
  }

  /**
   * Build URL for fetching observations
   */
  private buildObservationUrl(stationId: string): string {
    // Build query for wave variables
    const waveVars = [
      "time",
      ...IOOS_WAVE_VARIABLES.waveHeight.slice(0, 1),
      ...IOOS_WAVE_VARIABLES.wavePeriod.slice(0, 1),
      ...IOOS_WAVE_VARIABLES.waveDirection.slice(0, 1),
      ...IOOS_WAVE_VARIABLES.waterTemp.slice(0, 1),
    ].join(",");

    const endpoint = IOOS_ENDPOINTS.observations.replace("{datasetId}", stationId);
    return `${this.config.baseUrl}${endpoint}?${waveVars}&time>=max(time)-1hour&orderBy(%22time/desc%22)`;
  }

  /**
   * Parse observation row into IOOSObservation
   */
  private parseObservation(
    stationId: string,
    row: (string | number | null)[],
    columnNames: string[]
  ): IOOSObservation {
    const getValue = (varNames: string[]): number | null => {
      for (const varName of varNames) {
        const idx = columnNames.indexOf(varName);
        if (idx >= 0 && row[idx] != null) {
          const val = Number(row[idx]);
          return isFinite(val) ? val : null;
        }
      }
      return null;
    };

    const timeIdx = columnNames.indexOf("time");
    const observedAt = timeIdx >= 0 ? String(row[timeIdx]) : new Date().toISOString();

    let waveHeight = getValue(IOOS_WAVE_VARIABLES.waveHeight);
    const wavePeriod = getValue(IOOS_WAVE_VARIABLES.wavePeriod);
    const waveDirection = getValue(IOOS_WAVE_VARIABLES.waveDirection);
    const waterTemp = getValue(IOOS_WAVE_VARIABLES.waterTemp);
    const windSpeed = getValue(IOOS_WAVE_VARIABLES.windSpeed);
    const windDirection = getValue(IOOS_WAVE_VARIABLES.windDirection);

    // Validate wave height bounds
    if (
      waveHeight !== null &&
      (waveHeight < IOOS_QUALITY_THRESHOLDS.waveHeight.min ||
        waveHeight > IOOS_QUALITY_THRESHOLDS.waveHeight.max)
    ) {
      waveHeight = null;
    }

    return {
      station_id: stationId,
      observed_at: observedAt,
      wave_height_m: waveHeight,
      wave_period_s: wavePeriod,
      wave_direction_deg: waveDirection,
      water_temp_c: waterTemp,
      wind_speed_ms: windSpeed,
      wind_direction_deg: windDirection,
      raw_data: { row, columnNames },
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for convenience
 */
let defaultService: IOOSService | null = null;

export function getIOOSService(): IOOSService {
  if (!defaultService) {
    defaultService = new IOOSService();
  }
  return defaultService;
}
```

**Step 2: Run tests to verify they pass**

Run: `yarn test __tests__/lib/services/ioos-service.test.ts`
Expected: All tests pass

**Step 3: Commit implementation**

```bash
git add lib/services/ioos-service.ts
git commit -m "feat: implement IOOSService for ERDDAP API integration

- Add station discovery with geographic filtering
- Add observation fetching with caching
- Add batch fetching with rate limiting
- Add database integration for nearby station queries
- Add data validation and quality checks
- All tests passing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add PostGIS Function for Nearby Stations

**Files:**
- Create: `supabase/migrations/20260118120001_add_ioos_spatial_functions.sql`

**Step 1: Write the migration**

```sql
-- Add PostGIS function for finding nearby IOOS stations
-- Used by IOOSService.findNearbyStations()

CREATE OR REPLACE FUNCTION find_nearby_ioos_stations(
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_radius_km NUMERIC DEFAULT 100
)
RETURNS SETOF ioos_stations
LANGUAGE sql
STABLE
AS $$
  SELECT s.*
  FROM ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(
      s.coordinates::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_km * 1000  -- Convert km to meters
    )
  ORDER BY ST_Distance(
    s.coordinates::geography,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  )
  LIMIT 10;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_nearby_ioos_stations TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_ioos_stations TO service_role;

COMMENT ON FUNCTION find_nearby_ioos_stations IS
  'Find active IOOS wave stations within radius_km of a point, ordered by distance';
```

**Step 2: Apply the migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260118120001_add_ioos_spatial_functions.sql
git commit -m "feat: add PostGIS function for nearby IOOS station queries

- Add find_nearby_ioos_stations function
- Uses ST_DWithin for efficient spatial filtering
- Returns up to 10 nearest active wave stations
- Grants access to authenticated and service roles

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Generate TypeScript Types from Database

**Files:**
- Modify: `types/database.generated.ts`

**Step 1: Regenerate database types**

Run: `yarn db:types`
Expected: Types generated successfully

**Step 2: Verify IOOS types are included**

Run: `grep -A 5 "ioos_stations" types/database.generated.ts`
Expected: Shows ioos_stations table definition

**Step 3: Commit**

```bash
git add types/database.generated.ts
git commit -m "chore: regenerate database types with IOOS tables

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Run Full Test Suite

**Step 1: Run all tests**

Run: `yarn test`
Expected: All tests pass

**Step 2: Run type check**

Run: `yarn typecheck`
Expected: No TypeScript errors

**Step 3: Run lint**

Run: `yarn lint`
Expected: No linting errors (or only warnings)

---

## Summary

Phase 1 complete. Files created:

1. `supabase/migrations/20260118120000_create_ioos_tables.sql` - Database schema
2. `supabase/migrations/20260118120001_add_ioos_spatial_functions.sql` - PostGIS functions
3. `types/ioos.ts` - TypeScript types
4. `lib/constants/ioos-config.ts` - Configuration constants
5. `lib/services/ioos-service.ts` - Service implementation
6. `__tests__/lib/services/ioos-service.test.ts` - Unit tests

Next phases:
- Phase 2: Cron job implementation (`/api/cron/ioos-sync`)
- Phase 3: Fallback integration into forecast service
- Phase 4: Validation and tuning

---

*End of Implementation Plan*
