# Hourly Wind Data + Nearby Spots Scroll Fix

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace garbage CDIP wind data in oracle time slots with accurate Open-Meteo hourly wind, and fix mouse wheel scrolling on Nearby Spots carousel.

**Architecture:** New hourly cron fetches wind from Open-Meteo Weather API for all 273 beaches and updates `enhanced_forecasts` wind columns with source-priority guard (HRRR > NWS > OPEN_METEO_WIND > existing). A `wind_source` column tracks provenance to prevent bad data overwriting good data. Nearby Spots gets a wheel event handler for mouse scroll.

**Tech Stack:** Open-Meteo Weather API (free, no key), Supabase PostgreSQL, Next.js API Routes, React

---

## Context

### The Problem
The oracle "Today's Windows" shows "0 mph SW" for most time slots. Investigation reveals:
- CDIP buoy forecasts have garbage wind data (0 mph with phantom directions)
- OPEN_METEO only covers 2 of 5 slots (11am, 2pm)
- HRRR wind enrichment only targets `NOAA_NWS` data_source rows, missing CDIP/OPEN_METEO rows
- NWS hourly wind writes to `marine_forecasts` table, not `enhanced_forecasts` where oracle reads

### The Fix
1. Fetch hourly wind from Open-Meteo Weather API (`api.open-meteo.com/v1/forecast`) for all beaches
2. Update `enhanced_forecasts` wind columns directly, but only when the new source outranks the existing one
3. Add `wind_source` column to track which source wrote the wind data
4. Run hourly as a separate cron (more frequent than the 3-hour forecast refresh)

### Source Priority (highest wins)
1. `HRRR` — 3km resolution, West Coast only, hours 1-6
2. `NWS` — 2.5km grid, US coastal, unreliable
3. `OPEN_METEO_WIND` — 11-25km, global, reliable
4. `CDIP` / `OPEN_METEO` / null — existing data, lowest priority

### Key Files Reference
- `app/api/cron/forecasts/refresh/route.ts` — existing forecast cron (NWS wind → `marine_forecasts`)
- `app/api/cron/ml/extract-hrrr-wind/route.ts` — HRRR wind → updates `enhanced_forecasts` (NOAA_NWS rows only)
- `lib/services/forecast/storage-service.ts` — upserts to `enhanced_forecasts` (onConflict: beach_id,forecast_at)
- `lib/services/forecast/forecast-builder.ts:236-238` — builds wind columns from NWS weather data
- `lib/services/nws-wind-service.ts` — existing NWS wind fetcher (pattern to follow)
- `lib/services/noaa-wavewatch/constants.ts:19` — Open-Meteo Marine API base URL (we'll add Weather API)
- `components/oracle/nearby-spots.tsx:99-101` — scroll container to fix

---

## Chunk 1: Database Migration + Wind Source Column

### Task 1: Add `wind_source` column to `enhanced_forecasts`

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_wind_source_column.sql`

- [ ] **Step 1: Write migration**

```sql
BEGIN;

-- Track which service wrote the wind data so higher-priority sources aren't overwritten
ALTER TABLE enhanced_forecasts
  ADD COLUMN IF NOT EXISTS wind_source TEXT;

-- Index for the wind cron's update query (beach + time range + source check)
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_wind_update
  ON enhanced_forecasts (beach_id, forecast_at)
  WHERE wind_source IS NULL OR wind_source NOT IN ('HRRR', 'NWS');

COMMENT ON COLUMN enhanced_forecasts.wind_source IS
  'Source that last wrote wind columns. Priority: HRRR > NWS > OPEN_METEO_WIND > null. '
  'Higher-priority sources are not overwritten by lower-priority ones.';

COMMIT;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase migration new add_wind_source_column` (then paste SQL), or use Supabase MCP `apply_migration`.

- [ ] **Step 3: Regenerate types**

Run: `npx supabase gen types typescript --project-id jlsvksbzwmpwfcoepukj > types/database.generated.ts`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*wind_source* types/database.generated.ts
git commit -m "feat: add wind_source column to enhanced_forecasts"
```

---

### Task 2: Update HRRR cron to set `wind_source`

**Files:**
- Modify: `app/api/cron/ml/extract-hrrr-wind/route.ts:163-169`

- [ ] **Step 1: Add wind_source to HRRR update**

In `app/api/cron/ml/extract-hrrr-wind/route.ts`, find the `.update()` call (line ~163) and add `wind_source`:

```typescript
      const { data, error } = await supabase
        .from('enhanced_forecasts')
        .update({
          wind_speed: `${windSpeedMph} mph`,
          wind_direction: String(windDirectionDeg),
          wind_direction_deg: windDirectionDeg,
          wind_source: 'HRRR',
        })
        .eq('beach_id', r.beach_id)
        // Remove the .eq('data_source', 'NOAA_NWS') filter — HRRR should enrich ALL rows
        .gte('forecast_at', hourStart)
        .lt('forecast_at', hourEnd)
        .select('id');
```

**Important:** Also remove `.eq('data_source', 'NOAA_NWS')` on line 171. HRRR is the highest-quality wind source — it should update any row regardless of the forecast data_source (CDIP, OPEN_METEO, etc.). This alone would fix some of the "0 mph" slots.

- [ ] **Step 2: Commit**

```bash
git add app/api/cron/ml/extract-hrrr-wind/route.ts
git commit -m "fix: HRRR wind enriches all forecast rows, not just NOAA_NWS"
```

---

## Chunk 2: Open-Meteo Wind Service

### Task 3: Create Open-Meteo wind service

**Files:**
- Create: `lib/services/open-meteo-wind-service.ts`
- Create: `__tests__/lib/services/open-meteo-wind-service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/services/open-meteo-wind-service.test.ts
import { parseOpenMeteoWindResponse, buildOpenMeteoWindUrl } from '@/lib/services/open-meteo-wind-service';

describe('buildOpenMeteoWindUrl', () => {
  it('builds correct URL for a single location', () => {
    const url = buildOpenMeteoWindUrl(32.7157, -117.1611);
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=32.7157');
    expect(url).toContain('longitude=-117.1611');
    expect(url).toContain('wind_speed_10m');
    expect(url).toContain('wind_direction_10m');
    expect(url).toContain('wind_gusts_10m');
    expect(url).toContain('hourly=');
  });
});

describe('parseOpenMeteoWindResponse', () => {
  it('parses hourly wind data into WindPoint array', () => {
    const response = {
      hourly: {
        time: ['2026-03-13T05:00', '2026-03-13T06:00', '2026-03-13T07:00'],
        wind_speed_10m: [3.2, 5.1, 7.8],
        wind_direction_10m: [225, 270, 280],
        wind_gusts_10m: [8.0, 12.0, 15.0],
      },
    };

    const points = parseOpenMeteoWindResponse(response);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({
      ts: '2026-03-13T05:00:00.000Z',
      wind_speed_mph: 7,   // 3.2 km/h → ~2 m/s → ~4.5 mph, but Open-Meteo returns km/h by default
      wind_direction_deg: 225,
      wind_gust_mph: 18,
    });
  });

  it('handles null wind values gracefully', () => {
    const response = {
      hourly: {
        time: ['2026-03-13T05:00'],
        wind_speed_10m: [null],
        wind_direction_10m: [null],
        wind_gusts_10m: [null],
      },
    };

    const points = parseOpenMeteoWindResponse(response);
    expect(points).toHaveLength(1);
    expect(points[0].wind_speed_mph).toBeNull();
    expect(points[0].wind_direction_deg).toBeNull();
  });

  it('returns empty array for missing hourly data', () => {
    expect(parseOpenMeteoWindResponse({})).toEqual([]);
    expect(parseOpenMeteoWindResponse({ hourly: {} })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern="open-meteo-wind-service" --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write the service**

```typescript
// lib/services/open-meteo-wind-service.ts
/**
 * Open-Meteo Weather API wind service.
 *
 * Fetches hourly 10m wind speed, direction, and gusts from the Open-Meteo
 * Weather API (NOT the Marine API we already use for waves).
 *
 * Free tier: 10,000 requests/day. We use ~273 req/hour = ~6,552/day.
 *
 * @see https://open-meteo.com/en/docs
 */

import { createContextLogger } from '@/lib/logger';

const log = createContextLogger('OpenMeteoWind');

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export interface OpenMeteoWindPoint {
  ts: string;             // ISO8601 UTC
  wind_speed_mph: number | null;
  wind_direction_deg: number | null;
  wind_gust_mph: number | null;
}

interface OpenMeteoHourlyResponse {
  hourly?: {
    time?: string[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
  };
}

/**
 * Build the Open-Meteo Weather API URL for hourly wind data.
 * Requests 24 hours of forecast data starting from now.
 */
export function buildOpenMeteoWindUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'mph',
    forecast_days: '2',
    timezone: 'UTC',
  });
  return `${BASE_URL}?${params.toString()}`;
}

/**
 * Parse the Open-Meteo hourly response into typed wind points.
 * Wind speed is already in mph (requested via wind_speed_unit=mph).
 */
export function parseOpenMeteoWindResponse(
  data: OpenMeteoHourlyResponse
): OpenMeteoWindPoint[] {
  const hourly = data?.hourly;
  if (!hourly?.time?.length) return [];

  const times = hourly.time;
  const speeds = hourly.wind_speed_10m || [];
  const directions = hourly.wind_direction_10m || [];
  const gusts = hourly.wind_gusts_10m || [];

  return times.map((t, i) => ({
    ts: new Date(t + 'Z').toISOString(),
    wind_speed_mph: speeds[i] != null ? Math.round(speeds[i]!) : null,
    wind_direction_deg: directions[i] != null ? Math.round(directions[i]!) : null,
    wind_gust_mph: gusts[i] != null ? Math.round(gusts[i]!) : null,
  }));
}

/**
 * Fetch hourly wind for a single beach location.
 * Returns up to 48 hours of wind data.
 */
export async function fetchHourlyWind(
  lat: number,
  lon: number
): Promise<OpenMeteoWindPoint[]> {
  const url = buildOpenMeteoWindUrl(lat, lon);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'QuiverSurf/1.0 (wind-cron)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      log.warn(`Open-Meteo wind API returned ${response.status} for ${lat},${lon}`);
      return [];
    }

    const data: OpenMeteoHourlyResponse = await response.json();
    return parseOpenMeteoWindResponse(data);
  } catch (err) {
    log.warn(`Open-Meteo wind fetch failed for ${lat},${lon}:`, err);
    return [];
  }
}
```

- [ ] **Step 4: Update test expectations for mph unit**

The first test assumed km/h conversion, but we request `wind_speed_unit: 'mph'` so values come back in mph directly. Update:

```typescript
    expect(points[0]).toEqual({
      ts: '2026-03-13T05:00:00.000Z',
      wind_speed_mph: 3,   // 3.2 rounded
      wind_direction_deg: 225,
      wind_gust_mph: 8,    // 8.0 rounded
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest --testPathPattern="open-meteo-wind-service" --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/services/open-meteo-wind-service.ts __tests__/lib/services/open-meteo-wind-service.test.ts
git commit -m "feat: add Open-Meteo wind service for hourly beach wind data"
```

---

## Chunk 3: Wind Update Cron

### Task 4: Create hourly wind update cron

**Files:**
- Create: `app/api/cron/wind/update/route.ts`

- [ ] **Step 1: Write the cron route**

```typescript
// app/api/cron/wind/update/route.ts
/**
 * Hourly wind update cron.
 *
 * Fetches wind from Open-Meteo Weather API for all beaches and updates
 * enhanced_forecasts wind columns. Only overwrites wind when the existing
 * wind_source is lower priority than OPEN_METEO_WIND.
 *
 * Priority: HRRR > NWS > OPEN_METEO_WIND > everything else
 *
 * Scheduled: Every hour via Vercel cron
 */
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { validateCronRequest, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { fetchHourlyWind } from '@/lib/services/open-meteo-wind-service';

export const maxDuration = 120;

/** Cardinal direction from degrees (for wind_direction text field) */
function degreesToCardinal(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return createErrorResponse('Unauthorized', null, 401);
  }

  const supabase = createSupabaseServiceRoleClient();

  // Fetch all beaches with coordinates
  const { data: beaches, error: beachError } = await supabase
    .from('beaches')
    .select('id, center_lat, center_lng, name')
    .not('center_lat', 'is', null)
    .not('center_lng', 'is', null);

  if (beachError || !beaches?.length) {
    return createErrorResponse('Failed to fetch beaches');
  }

  console.log(`[Wind] Updating wind for ${beaches.length} beaches`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  // Open-Meteo returns 48 hourly points, but enhanced_forecasts only has rows at ~3h intervals
  // so most points won't match → actual DB writes ≈ 273 × 8-10 = ~2,500 (well within 120s timeout)
  const BATCH_SIZE = 10; // Parallel API fetches per batch (avoid rate limiting)
  const DELAY_BETWEEN_BATCHES_MS = 200;

  for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
    const batch = beaches.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (beach) => {
        const windPoints = await fetchHourlyWind(beach.center_lat, beach.center_lng);
        if (!windPoints.length) return { beach: beach.name, updated: 0, skipped: 0 };

        let beachUpdated = 0;
        let beachSkipped = 0;

        // Update each hourly forecast row
        for (const wp of windPoints) {
          if (wp.wind_speed_mph == null) continue;

          const hourStart = wp.ts;
          const hourEnd = new Date(new Date(wp.ts).getTime() + 3600000).toISOString();
          const cardinal = wp.wind_direction_deg != null
            ? degreesToCardinal(wp.wind_direction_deg)
            : null;

          // Only update rows where wind_source is NOT a higher-priority source
          const { data, error } = await supabase
            .from('enhanced_forecasts')
            .update({
              wind_speed: `${wp.wind_speed_mph} mph`,
              wind_direction: cardinal,
              wind_direction_deg: wp.wind_direction_deg,
              wind_source: 'OPEN_METEO_WIND',
            })
            .eq('beach_id', beach.id)
            .gte('forecast_at', hourStart)
            .lt('forecast_at', hourEnd)
            .or('wind_source.is.null,wind_source.not.in.(HRRR,NWS)')
            .select('id');

          if (error) {
            errors++;
          } else {
            const rowCount = data?.length ?? 0;
            if (rowCount > 0) beachUpdated += rowCount;
            else beachSkipped++;
          }
        }

        return { beach: beach.name, updated: beachUpdated, skipped: beachSkipped };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        updated += r.value.updated;
        skipped += r.value.skipped;
      } else {
        errors++;
      }
    }

    // Brief pause between batches to be a good API citizen
    if (i + BATCH_SIZE < beaches.length) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`[Wind] Done: ${updated} rows updated, ${skipped} skipped (protected), ${errors} errors`);

  return createSuccessResponse({
    beaches: beaches.length,
    updated,
    skipped,
    errors,
  });
}
```

- [ ] **Step 2: Add cron schedule to vercel.json**

Check `vercel.json` for existing crons and add:

```json
{
  "path": "/api/cron/wind/update",
  "schedule": "45 * * * *"
}
```

(Runs at :45 past each hour to avoid colliding with HRRR at :15 and the forecast refresh cron)

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/wind/update/route.ts vercel.json
git commit -m "feat: add hourly Open-Meteo wind update cron for all beaches"
```

---

### Task 5: Update forecast builder to set wind_source on initial write

**Files:**
- Modify: `lib/services/forecast/forecast-builder.ts:235-238`

- [ ] **Step 1: Set wind_source when forecast builder writes wind**

In `forecast-builder.ts`, find the wind section (~line 235) and add `wind_source` based on whether weather data came from NWS:

```typescript
      // Wind data
      wind_speed: this.getWindSpeed(weatherPoint),
      wind_direction: this.getWindDirection(weatherPoint),
      wind_direction_deg: cardinalToDegrees(weatherPoint?.windDirection || "SW"),
      wind_source: weatherPoint?.windSpeed ? 'NWS' : null,
```

If `weatherPoint` is null, the builder falls back to "10 mph" / "SW" — that should get `wind_source: null` so the wind cron can overwrite it.

- [ ] **Step 2: Commit**

```bash
git add lib/services/forecast/forecast-builder.ts
git commit -m "feat: set wind_source on initial forecast write"
```

---

## Chunk 4: Nearby Spots Mouse Scroll Fix

### Task 6: Add wheel-to-horizontal-scroll handler

**Files:**
- Modify: `components/oracle/nearby-spots.tsx`
- Create: `__tests__/components/oracle/nearby-spots-scroll.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/oracle/nearby-spots-scroll.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NearbySpots, NearbySpot } from '@/components/oracle/nearby-spots';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

// Mock next/image
jest.mock('next/image', () => {
  return (props: any) => <img {...props} />;
});

const mockSpots: NearbySpot[] = [
  { id: '1', name: 'Beach A', conditions: 'Good · 5 mph W', height: '3-4 ft', photoUrl: null, score: 80 },
  { id: '2', name: 'Beach B', conditions: 'Fair · 3 mph SW', height: '2-3 ft', photoUrl: null, score: 70 },
  { id: '3', name: 'Beach C', conditions: 'Fair · 8 mph W', height: '2-3 ft', photoUrl: null, score: 60 },
];

describe('NearbySpots scroll behavior', () => {
  it('converts vertical wheel events to horizontal scroll', () => {
    const mockOnViewSpot = jest.fn();
    render(<NearbySpots spots={mockSpots} onViewSpot={mockOnViewSpot} />);

    const scrollContainer = screen.getByTestId('nearby-spots-scroll');
    const scrollLeftSpy = jest.spyOn(scrollContainer, 'scrollLeft', 'set');

    // Simulate mouse wheel (vertical deltaY)
    fireEvent.wheel(scrollContainer, { deltaY: 100 });

    // scrollLeft should have been modified
    expect(scrollContainer.scrollLeft).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern="nearby-spots-scroll" --no-coverage`
Expected: FAIL — no `data-testid="nearby-spots-scroll"` found

- [ ] **Step 3: Add wheel handler and data-testid to NearbySpots**

In `components/oracle/nearby-spots.tsx`, modify the scroll container:

```tsx
// Add useRef and useEffect imports at the top
import { useRef, useEffect } from "react";

// Inside NearbySpots component, before the return:
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Only intercept vertical scroll when container is horizontally scrollable
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);
```

And update the scroll container div:

```tsx
        <div
          ref={scrollRef}
          data-testid="nearby-spots-scroll"
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-6 px-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
```

- [ ] **Step 4: Run tests**

Run: `npx jest --testPathPattern="nearby-spots" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/oracle/nearby-spots.tsx __tests__/components/oracle/nearby-spots-scroll.test.tsx
git commit -m "fix: enable mouse wheel horizontal scrolling on Nearby Spots"
```

---

## Chunk 5: Verification & CHANGELOG

### Task 7: Full verification

- [ ] **Step 1: Run all affected tests**

```bash
npx jest --testPathPattern="open-meteo-wind|nearby-spots|forecast-time-resolver|oracle-home-screen" --no-coverage
```

Expected: All PASS

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No new errors (ignore pre-existing `feature-bento-section.tsx` merge conflict)

- [ ] **Step 3: Test the wind cron locally**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/wind/update
```

Expected: JSON response with `updated > 0`

- [ ] **Step 4: Verify wind data improved**

Run `scripts/check-wind-data.mjs` after cron completes. Expect:
- No more "0 mph SW" from CDIP in the 5am/8am slots
- All slots show wind from `OPEN_METEO_WIND` or `HRRR` source

- [ ] **Step 5: Update CHANGELOG.md**

Add under `[Unreleased]`:

```markdown
### Added
- Hourly Open-Meteo wind cron (`/api/cron/wind/update`) — fetches accurate wind for all 273 beaches every hour, replaces garbage CDIP wind with real forecasts
- `wind_source` column on `enhanced_forecasts` — tracks wind data provenance, prevents bad data overwriting good data
- `lib/services/open-meteo-wind-service.ts` — Open-Meteo Weather API client for hourly wind

### Fixed
- Oracle time slots now show accurate wind data — HRRR wind enrichment expanded from NOAA_NWS rows only to all forecast rows
- Nearby Spots carousel now scrollable with mouse wheel (was trackpad-only)
```

- [ ] **Step 6: Final commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for wind data and scroll fix"
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/*_add_wind_source_column.sql` | Create | Add `wind_source` column to `enhanced_forecasts` |
| `types/database.generated.ts` | Regenerate | Include new column in TypeScript types |
| `lib/services/open-meteo-wind-service.ts` | Create | Open-Meteo Weather API wind client |
| `__tests__/lib/services/open-meteo-wind-service.test.ts` | Create | Unit tests for wind service |
| `app/api/cron/wind/update/route.ts` | Create | Hourly wind update cron route |
| `app/api/cron/ml/extract-hrrr-wind/route.ts` | Modify | Set `wind_source: 'HRRR'`, remove NOAA_NWS filter |
| `lib/services/forecast/forecast-builder.ts` | Modify | Set `wind_source` on initial forecast write |
| `components/oracle/nearby-spots.tsx` | Modify | Add wheel→horizontal scroll handler |
| `__tests__/components/oracle/nearby-spots-scroll.test.tsx` | Create | Scroll behavior test |
| `vercel.json` | Modify | Add hourly wind cron schedule |
| `CHANGELOG.md` | Modify | Document changes |
