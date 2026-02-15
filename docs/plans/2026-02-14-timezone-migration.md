# Enhanced Forecasts Timezone Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate `enhanced_forecasts` from ambiguous `forecast_date` + `forecast_time` (bare date/time without timezone) to a single `forecast_at timestamptz` column, fixing an 8-hour tide/conditions shift bug and eliminating all timezone confusion across ~45 source files.

**Architecture:** Add `forecast_at` alongside existing columns, migrate all consumers in phases, then drop old columns. A `forecastAtAdapter` utility provides backward-compatible extraction during transition. All internal operations use UTC; display converts using `beach.timezone` via existing `Intl.DateTimeFormat` helpers in `timezone-utils.ts`.

**Tech Stack:** PostgreSQL `timestamptz`, Next.js API routes on Vercel (UTC), `Intl.DateTimeFormat` for display, existing `getLocalDateString`/`getLocalHour` from `lib/utils/timezone-utils.ts`.

---

## Context: The Bug

The `enhanced_forecasts` table stores `forecast_time` as `time without time zone`. The forecast builder writes UTC hours (via `date.getHours()` on Vercel) but consumers read them as Pacific local time. This creates an 8-hour shift — tide data labeled "6 AM" is actually the tide at 10 PM PST the night before. The bug affects tide status, tide height, daily intel, discovery windows, NPC messages, and forecast alerts.

**Audit reports:** See conversation history for the full timezone audit (code-archaeologist) and research report (general-purpose agent).

---

## Phase 0: Foundation (Adapter + Types)

### Task 1: Create `forecastAtAdapter` utility

**Files:**
- Create: `lib/utils/forecast-at-adapter.ts`
- Create: `__tests__/lib/utils/forecast-at-adapter.test.ts`

**Step 1: Write the failing tests**

```typescript
// __tests__/lib/utils/forecast-at-adapter.test.ts
import {
  extractForecastDate,
  extractForecastTime,
  extractLocalHour,
  toForecastAt,
  sortByForecastAt,
  groupByForecastDate,
  isForecastAtInFuture,
} from "@/lib/utils/forecast-at-adapter";

describe("forecastAtAdapter", () => {
  describe("extractForecastDate", () => {
    it("extracts YYYY-MM-DD from ISO 8601 timestamptz", () => {
      expect(extractForecastDate("2026-02-14T14:00:00Z")).toBe("2026-02-14");
    });

    it("extracts date from timestamptz with offset", () => {
      expect(extractForecastDate("2026-02-14T06:00:00-08:00")).toBe("2026-02-14");
    });

    it("extracts local date when timezone provided", () => {
      // 2026-02-15T02:00:00Z = Feb 14 at 6 PM PST
      expect(extractForecastDate("2026-02-15T02:00:00Z", "America/Los_Angeles")).toBe("2026-02-14");
    });
  });

  describe("extractForecastTime", () => {
    it("extracts HH:MM:SS from ISO 8601", () => {
      expect(extractForecastTime("2026-02-14T14:00:00Z")).toBe("14:00:00");
    });

    it("extracts local time when timezone provided", () => {
      // 14:00 UTC = 06:00 PST
      expect(extractForecastTime("2026-02-14T14:00:00Z", "America/Los_Angeles")).toBe("06:00:00");
    });
  });

  describe("extractLocalHour", () => {
    it("returns UTC hour when no timezone", () => {
      expect(extractLocalHour("2026-02-14T14:00:00Z")).toBe(14);
    });

    it("returns local hour when timezone provided", () => {
      expect(extractLocalHour("2026-02-14T14:00:00Z", "America/Los_Angeles")).toBe(6);
    });
  });

  describe("toForecastAt", () => {
    it("combines forecast_date + forecast_time into ISO 8601 UTC", () => {
      // Existing data: forecast_date is actually UTC date, forecast_time is UTC time
      const result = toForecastAt("2026-02-14", "06:00:00");
      expect(result).toBe("2026-02-14T06:00:00Z");
    });
  });

  describe("sortByForecastAt", () => {
    it("sorts forecasts chronologically", () => {
      const forecasts = [
        { forecast_at: "2026-02-14T12:00:00Z", id: "b" },
        { forecast_at: "2026-02-14T06:00:00Z", id: "a" },
        { forecast_at: "2026-02-14T18:00:00Z", id: "c" },
      ];
      const sorted = sortByForecastAt(forecasts);
      expect(sorted.map((f) => f.id)).toEqual(["a", "b", "c"]);
    });
  });

  describe("groupByForecastDate", () => {
    it("groups forecasts by local date in given timezone", () => {
      const forecasts = [
        { forecast_at: "2026-02-14T14:00:00Z" }, // Feb 14 6AM PST
        { forecast_at: "2026-02-15T02:00:00Z" }, // Feb 14 6PM PST
        { forecast_at: "2026-02-15T14:00:00Z" }, // Feb 15 6AM PST
      ];
      const grouped = groupByForecastDate(forecasts, "America/Los_Angeles");
      expect(Object.keys(grouped)).toEqual(["2026-02-14", "2026-02-15"]);
      expect(grouped["2026-02-14"]).toHaveLength(2);
      expect(grouped["2026-02-15"]).toHaveLength(1);
    });
  });

  describe("isForecastAtInFuture", () => {
    it("returns true for future timestamps", () => {
      const future = new Date(Date.now() + 3600000).toISOString();
      expect(isForecastAtInFuture(future)).toBe(true);
    });

    it("returns false for past timestamps", () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      expect(isForecastAtInFuture(past)).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/utils/forecast-at-adapter.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// lib/utils/forecast-at-adapter.ts
/**
 * Forecast At Adapter
 *
 * Utilities for working with the `forecast_at` timestamptz column.
 * Provides backward-compatible extraction of date/time parts and
 * timezone-aware grouping/sorting during the migration from
 * forecast_date + forecast_time to forecast_at.
 */

import { getLocalDateString, getLocalHour } from "./timezone-utils";

/**
 * Extract YYYY-MM-DD date string from a forecast_at ISO 8601 timestamp.
 * When timezone is provided, returns the date in that timezone.
 * Without timezone, returns the UTC date portion.
 */
export function extractForecastDate(
  forecastAt: string,
  timezone?: string
): string {
  if (timezone) {
    return getLocalDateString(new Date(forecastAt), timezone);
  }
  return forecastAt.split("T")[0];
}

/**
 * Extract HH:MM:SS time string from a forecast_at ISO 8601 timestamp.
 * When timezone is provided, returns the time in that timezone.
 * Without timezone, returns the UTC time portion.
 */
export function extractForecastTime(
  forecastAt: string,
  timezone?: string
): string {
  const date = new Date(forecastAt);
  if (timezone) {
    const hour = getLocalHour(date, timezone);
    const minutes = date.getUTCMinutes();
    return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  }
  return forecastAt.split("T")[1]?.split(/[Z+-]/)[0] || "00:00:00";
}

/**
 * Extract hour (0-23) from a forecast_at ISO 8601 timestamp.
 * When timezone is provided, returns the hour in that timezone.
 */
export function extractLocalHour(
  forecastAt: string,
  timezone?: string
): number {
  const date = new Date(forecastAt);
  if (timezone) {
    return getLocalHour(date, timezone);
  }
  return date.getUTCHours();
}

/**
 * Combine legacy forecast_date + forecast_time into an ISO 8601 UTC string.
 * Used during backfill and for code that still receives the old format.
 */
export function toForecastAt(
  forecastDate: string,
  forecastTime: string
): string {
  return `${forecastDate}T${forecastTime}Z`;
}

/**
 * Sort an array of objects with forecast_at chronologically.
 */
export function sortByForecastAt<T extends { forecast_at: string }>(
  forecasts: T[]
): T[] {
  return [...forecasts].sort(
    (a, b) =>
      new Date(a.forecast_at).getTime() - new Date(b.forecast_at).getTime()
  );
}

/**
 * Group forecasts by local date in the given timezone.
 */
export function groupByForecastDate<T extends { forecast_at: string }>(
  forecasts: T[],
  timezone: string
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const forecast of forecasts) {
    const date = extractForecastDate(forecast.forecast_at, timezone);
    if (!groups[date]) groups[date] = [];
    groups[date].push(forecast);
  }
  return groups;
}

/**
 * Check if a forecast_at timestamp is in the future.
 */
export function isForecastAtInFuture(forecastAt: string): boolean {
  return new Date(forecastAt).getTime() > Date.now();
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/utils/forecast-at-adapter.test.ts --no-coverage`
Expected: PASS — all 9 tests green

**Step 5: Commit**

```bash
git add lib/utils/forecast-at-adapter.ts __tests__/lib/utils/forecast-at-adapter.test.ts
git commit -m "feat: add forecast-at-adapter utility for timezone migration"
```

---

### Task 2: Add `forecast_at` to `EnhancedForecastEntity` type

**Files:**
- Modify: `types/forecast.ts:117-121`

**Step 1: Write the failing test**

```typescript
// __tests__/types/forecast-at-type.test.ts
import type { EnhancedForecastEntity } from "@/types/forecast";

describe("EnhancedForecastEntity", () => {
  it("accepts forecast_at field", () => {
    const entity: Partial<EnhancedForecastEntity> = {
      forecast_at: "2026-02-14T14:00:00Z",
      forecast_date: "2026-02-14",
      forecast_time: "14:00:00",
      beach_id: "test-beach-id",
    };
    expect(entity.forecast_at).toBe("2026-02-14T14:00:00Z");
  });

  it("works without forecast_date and forecast_time (post-migration)", () => {
    const entity: Partial<EnhancedForecastEntity> = {
      forecast_at: "2026-02-14T14:00:00Z",
      beach_id: "test-beach-id",
    };
    expect(entity.forecast_at).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/types/forecast-at-type.test.ts --no-coverage`
Expected: FAIL — `forecast_at` does not exist on type

**Step 3: Add `forecast_at` to the type (keep old fields optional during transition)**

In `types/forecast.ts`, change lines 117-121 from:
```typescript
export interface EnhancedForecastEntity {
  id: string;
  beach_id: string;
  forecast_date: string;
  forecast_time: string;
```

To:
```typescript
export interface EnhancedForecastEntity {
  id: string;
  beach_id: string;
  /** ISO 8601 UTC timestamptz — canonical forecast time (replaces forecast_date + forecast_time) */
  forecast_at: string;
  /** @deprecated Use forecast_at. Bare date without timezone — ambiguous. */
  forecast_date: string;
  /** @deprecated Use forecast_at. Bare time without timezone — ambiguous. */
  forecast_time: string;
```

Also update `ForecastTimePoint` (lines 101-106) from:
```typescript
  readonly forecastDate: string;
  readonly forecastTime: string;
```

To:
```typescript
  readonly forecastAt: string;
  /** @deprecated Use forecastAt */
  readonly forecastDate: string;
  /** @deprecated Use forecastAt */
  readonly forecastTime: string;
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/types/forecast-at-type.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add types/forecast.ts __tests__/types/forecast-at-type.test.ts
git commit -m "feat: add forecast_at field to EnhancedForecastEntity type"
```

---

## Phase 1: Database Migration

### Task 3: Add `forecast_at` column and backfill

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_forecast_at_column.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: Add forecast_at timestamptz column to enhanced_forecasts
-- The existing forecast_date + forecast_time columns store UTC values
-- (written by Vercel server using date.getHours() which returns UTC).
-- We combine them into a proper timestamptz column.

BEGIN;

-- 1. Add the new column (nullable initially for backfill)
ALTER TABLE public.enhanced_forecasts
  ADD COLUMN IF NOT EXISTS forecast_at timestamptz;

-- 2. Backfill from existing data
-- forecast_date + forecast_time are UTC values (generated on Vercel UTC server)
UPDATE public.enhanced_forecasts
SET forecast_at = (forecast_date || 'T' || forecast_time || 'Z')::timestamptz
WHERE forecast_at IS NULL;

-- 3. Make it NOT NULL after backfill
ALTER TABLE public.enhanced_forecasts
  ALTER COLUMN forecast_at SET NOT NULL;

-- 4. Add new index for common query pattern (beach + time range)
CREATE INDEX IF NOT EXISTS idx_ef_beach_forecast_at
  ON public.enhanced_forecasts (beach_id, forecast_at);

-- 5. Add unique constraint for upserts (will coexist with old constraint during transition)
ALTER TABLE public.enhanced_forecasts
  ADD CONSTRAINT enhanced_forecasts_beach_forecast_at_unique
  UNIQUE (beach_id, forecast_at);

COMMIT;
```

**Step 2: Apply migration to Supabase**

Use the Supabase MCP `apply_migration` tool with the SQL above. Name: `add_forecast_at_column`.

**Step 3: Verify the column exists and data is populated**

```sql
SELECT forecast_at, forecast_date, forecast_time
FROM enhanced_forecasts
WHERE beach_id = (SELECT id FROM beaches WHERE name = 'Scripps' LIMIT 1)
  AND forecast_at >= CURRENT_DATE
ORDER BY forecast_at
LIMIT 8;
```

Expected: `forecast_at` values should match `forecast_date || 'T' || forecast_time || 'Z'`.

**Step 4: Run security advisors**

Use Supabase MCP `get_advisors` for security and performance to check for any issues with the new column.

**Step 5: Regenerate TypeScript types**

Use Supabase MCP `generate_typescript_types` and update `types/database.generated.ts`.

**Step 6: Commit**

```bash
git add supabase/migrations/ types/database.generated.ts
git commit -m "feat: add forecast_at timestamptz column to enhanced_forecasts"
```

---

## Phase 2: Write Path

### Task 4: Fix `datetime-utils.ts` to produce `forecast_at`

**Files:**
- Modify: `lib/services/forecast/datetime-utils.ts`
- Create: `__tests__/lib/services/forecast/datetime-utils.test.ts`

**Step 1: Write failing tests**

```typescript
// __tests__/lib/services/forecast/datetime-utils.test.ts
import {
  getNormalizedForecastAt,
  getNormalizedDateString,
  getNormalizedTimeString,
} from "@/lib/services/forecast/datetime-utils";

describe("getNormalizedForecastAt", () => {
  it("returns ISO 8601 UTC string rounded to 3-hour intervals", () => {
    // Feb 14, 2026 at 14:30 UTC → rounds down to 12:00
    const date = new Date("2026-02-14T14:30:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T12:00:00Z");
  });

  it("rounds 05:00 UTC down to 03:00", () => {
    const date = new Date("2026-02-14T05:00:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T03:00:00Z");
  });

  it("keeps exact 3-hour boundaries unchanged", () => {
    const date = new Date("2026-02-14T06:00:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T06:00:00Z");
  });

  it("handles midnight correctly", () => {
    const date = new Date("2026-02-14T00:00:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T00:00:00Z");
  });

  it("handles 23:59 UTC → rounds to 21:00", () => {
    const date = new Date("2026-02-14T23:59:00Z");
    expect(getNormalizedForecastAt(date)).toBe("2026-02-14T21:00:00Z");
  });
});

// Existing functions should still work (backward compat)
describe("getNormalizedDateString (legacy)", () => {
  it("still works for backward compatibility", () => {
    const date = new Date("2026-02-14T14:00:00Z");
    expect(getNormalizedDateString(date)).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/services/forecast/datetime-utils.test.ts --no-coverage`
Expected: FAIL — `getNormalizedForecastAt` not found

**Step 3: Add `getNormalizedForecastAt` to `datetime-utils.ts`**

Add to `lib/services/forecast/datetime-utils.ts`:

```typescript
/**
 * Get a normalized forecast_at ISO 8601 UTC timestamp rounded to 3-hour intervals.
 *
 * Uses UTC methods to avoid server-timezone dependency.
 * This replaces the old pattern of getNormalizedDateString + getNormalizedTimeString.
 *
 * Valid output hours: 00, 03, 06, 09, 12, 15, 18, 21 (all UTC)
 */
export function getNormalizedForecastAt(date: Date): string {
  const roundedHour = Math.floor(date.getUTCHours() / 3) * 3;
  const d = new Date(date);
  d.setUTCHours(roundedHour, 0, 0, 0);
  return d.toISOString().replace(".000Z", "Z");
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/services/forecast/datetime-utils.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/forecast/datetime-utils.ts __tests__/lib/services/forecast/datetime-utils.test.ts
git commit -m "feat: add getNormalizedForecastAt using UTC methods"
```

---

### Task 5: Update `forecast-builder.ts` to write `forecast_at`

**Files:**
- Modify: `lib/services/forecast/forecast-builder.ts:119,194-197`
- Modify: `__tests__/lib/services/forecast/forecast-builder.test.ts`

**Step 1: Write failing test**

Add to the existing test file `__tests__/lib/services/forecast/forecast-builder.test.ts`:

```typescript
it("includes forecast_at as ISO 8601 UTC string", () => {
  const forecasts = builder.buildForecasts(/* ... existing test params ... */);
  expect(forecasts[0].forecast_at).toBeDefined();
  expect(forecasts[0].forecast_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/);
});

it("forecast_at is consistent with forecast_date and forecast_time", () => {
  const forecasts = builder.buildForecasts(/* ... existing test params ... */);
  const f = forecasts[0];
  const expected = `${f.forecast_date}T${f.forecast_time}Z`;
  expect(f.forecast_at).toBe(expected);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/services/forecast/forecast-builder.test.ts --no-coverage`
Expected: FAIL — `forecast_at` is undefined

**Step 3: Update `buildSingleForecast` to include `forecast_at`**

In `lib/services/forecast/forecast-builder.ts`, import `getNormalizedForecastAt`:

```typescript
import { getNormalizedDateString, getNormalizedTimeString, getNormalizedForecastAt } from "./datetime-utils";
```

In `buildSingleForecast` (around line 194), add `forecast_at` to the returned object:

```typescript
    return {
      id: `forecast-${beach.id}-${forecastTime.getTime()}`,
      forecast_at: getNormalizedForecastAt(forecastTime),
      forecast_date: dateString,
      forecast_time: getNormalizedTimeString(forecastTime),
```

Also fix the `toLocaleTimeString` call at line 375-378 to use explicit timezone:

```typescript
      nextTideTime: nextTide
        ? new Date(nextTide.time * 1000).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "Unknown",
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/services/forecast/forecast-builder.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/forecast/forecast-builder.ts __tests__/lib/services/forecast/forecast-builder.test.ts
git commit -m "feat: forecast builder now writes forecast_at timestamptz"
```

---

### Task 6: Update `storage-service.ts` dedup key and upsert

**Files:**
- Modify: `lib/services/forecast/storage-service.ts:156,187`

**Step 1: Write failing test**

Add to existing tests or create `__tests__/lib/services/forecast/storage-service-dedup.test.ts`:

```typescript
import { ForecastStorageService } from "@/lib/services/forecast/storage-service";

describe("ForecastStorageService deduplication", () => {
  it("uses forecast_at for dedup key when available", () => {
    const service = new ForecastStorageService();
    const forecasts = [
      {
        beach_id: "beach-1",
        forecast_at: "2026-02-14T06:00:00Z",
        forecast_date: "2026-02-14",
        forecast_time: "06:00:00",
      },
      {
        beach_id: "beach-1",
        forecast_at: "2026-02-14T06:00:00Z",
        forecast_date: "2026-02-14",
        forecast_time: "06:00:00",
      },
    ] as any[];

    // Access private method via bracket notation for testing
    const deduped = (service as any).deduplicateForecasts(forecasts);
    expect(deduped.size).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/services/forecast/storage-service-dedup.test.ts --no-coverage`
Expected: FAIL (or pass with wrong key — depends on current implementation)

**Step 3: Update dedup key and upsert conflict clause**

In `lib/services/forecast/storage-service.ts`:

Line 156 — change dedup key:
```typescript
const key = forecast.forecast_at
  ? `${forecast.beach_id}|${forecast.forecast_at}`
  : `${forecast.beach_id}|${forecast.forecast_date}|${forecast.forecast_time}`;
```

Line 187 — change upsert conflict:
```typescript
onConflict: "beach_id,forecast_at",
```

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/services/forecast/storage-service-dedup.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/forecast/storage-service.ts __tests__/lib/services/forecast/storage-service-dedup.test.ts
git commit -m "feat: storage service uses forecast_at for dedup and upsert"
```

---

## Phase 3: Core Utilities Migration

### Task 7: Rewrite `current-forecast-utils.ts` to support `forecast_at`

**Files:**
- Modify: `lib/utils/current-forecast-utils.ts`
- Modify: `__tests__/lib/utils/current-forecast-utils.test.ts` (if exists, otherwise create)

**Step 1: Write failing tests**

```typescript
// __tests__/lib/utils/current-forecast-utils-v2.test.ts
import {
  getCurrentForecast,
  getBestForecastForDate,
  isForecastInFuture,
} from "@/lib/utils/current-forecast-utils";

describe("getCurrentForecast with forecast_at", () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
  const oneHourFromNow = new Date(now.getTime() + 3600000).toISOString();
  const twoHoursFromNow = new Date(now.getTime() + 7200000).toISOString();

  it("selects the next future forecast when forecast_at is present", () => {
    const forecasts = [
      { forecast_at: oneHourAgo, forecast_date: "", forecast_time: "" },
      { forecast_at: oneHourFromNow, forecast_date: "", forecast_time: "" },
      { forecast_at: twoHoursFromNow, forecast_date: "", forecast_time: "" },
    ];
    const result = getCurrentForecast(forecasts);
    expect(result?.forecast_at).toBe(oneHourFromNow);
  });
});

describe("isForecastInFuture with forecast_at", () => {
  it("returns true for future forecast_at", () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    expect(
      isForecastInFuture({ forecast_at: future, forecast_date: "", forecast_time: "" })
    ).toBe(true);
  });

  it("returns false for past forecast_at", () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(
      isForecastInFuture({ forecast_at: past, forecast_date: "", forecast_time: "" })
    ).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/utils/current-forecast-utils-v2.test.ts --no-coverage`
Expected: FAIL — `forecast_at` not used in logic

**Step 3: Update `ForecastTimeInfo` and functions to prefer `forecast_at`**

Update `lib/utils/current-forecast-utils.ts`:

```typescript
export interface ForecastTimeInfo {
  forecast_at?: string;
  /** @deprecated Use forecast_at */
  forecast_date: string;
  /** @deprecated Use forecast_at */
  forecast_time: string;
}

// Helper: get the timestamp for comparison
function getForecastTimestamp(forecast: ForecastTimeInfo): number {
  if (forecast.forecast_at) {
    return new Date(forecast.forecast_at).getTime();
  }
  // Legacy fallback
  return new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`).getTime();
}

// Helper: get the date string for grouping
function getForecastDateKey(forecast: ForecastTimeInfo): string {
  if (forecast.forecast_at) {
    return forecast.forecast_at.split("T")[0];
  }
  return forecast.forecast_date;
}
```

Then refactor `getCurrentForecast`, `getBestForecastForDate`, and `isForecastInFuture` to use these helpers instead of direct string manipulation. The logic stays the same but uses `getForecastTimestamp` for comparisons and `getForecastDateKey` for grouping.

**Step 4: Run all current-forecast-utils tests**

Run: `npx jest __tests__/lib/utils/current-forecast-utils --no-coverage`
Expected: PASS — both old and new tests green

**Step 5: Commit**

```bash
git add lib/utils/current-forecast-utils.ts __tests__/lib/utils/current-forecast-utils-v2.test.ts
git commit -m "feat: current-forecast-utils prefers forecast_at over legacy fields"
```

---

### Task 8: Fix `tide-chart-helpers.ts` date parsing

**Files:**
- Modify: `components/forecast/tide-chart/tide-chart-helpers.ts:24-58,189-192`

**Step 1: Write failing test**

```typescript
// __tests__/components/forecast/tide-chart/tide-chart-helpers-v2.test.ts
import { parseForecastDateTime } from "@/components/forecast/tide-chart/tide-chart-helpers";

describe("parseForecastDateTime with forecast_at", () => {
  it("parses forecast_at ISO string directly", () => {
    const result = parseForecastDateTime("2026-02-14T14:00:00Z");
    expect(result.getTime()).toBe(new Date("2026-02-14T14:00:00Z").getTime());
  });
});
```

**Step 2: Run test, verify failure, implement, verify pass, commit**

Update `parseForecastDateTime` to accept a single ISO string when called with one argument:

```typescript
export function parseForecastDateTime(
  forecastDateOrAt: string,
  forecastTime?: string
): Date {
  // New path: single forecast_at argument
  if (!forecastTime) {
    return new Date(forecastDateOrAt);
  }
  // Legacy path: forecast_date + forecast_time
  return new Date(`${forecastDateOrAt}T${forecastTime}Z`);
}
```

```bash
git commit -m "feat: parseForecastDateTime accepts single forecast_at string"
```

---

## Phase 4: Query Layer Migration

### Task 9: Update Supabase queries in `forecast-actions.ts`

**Files:**
- Modify: `actions/forecast-actions.ts` — 7 query locations (lines 57-59, 86-88, 133-146, 199-204, 242-246, 409-411, 454-456)

**Step 1: Write failing integration test**

```typescript
// __tests__/actions/forecast-actions-query.test.ts
// Verify that forecast actions return forecast_at field
describe("forecast actions include forecast_at", () => {
  it("getBeachForecasts returns forecast_at", async () => {
    // Mock supabase to verify the query uses forecast_at
    // The key assertion: .order("forecast_at") is called instead of
    // .order("forecast_date").order("forecast_time")
  });
});
```

**Step 2: Update all queries**

Pattern for every query in this file — change:
```typescript
.gte("forecast_date", today)
.order("forecast_date", { ascending: true })
.order("forecast_time", { ascending: true })
```

To:
```typescript
.gte("forecast_at", `${today}T00:00:00Z`)
.order("forecast_at", { ascending: true })
```

And change `.in("forecast_date", [today, tomorrow])` to:
```typescript
.gte("forecast_at", `${today}T00:00:00Z`)
.lt("forecast_at", `${dayAfterTomorrow}T00:00:00Z`)
```

**Step 3: Run relevant tests, commit**

```bash
git commit -m "refactor: forecast-actions uses forecast_at for all queries"
```

---

### Task 10: Update `forecast-service-utils.ts` queries

**Files:**
- Modify: `lib/utils/forecast-service-utils.ts:370-374,550-558`

Same pattern as Task 9. Replace all `.gte("forecast_date")`, `.order("forecast_date")`, `.order("forecast_time")` with `forecast_at` equivalents.

```bash
git commit -m "refactor: forecast-service-utils uses forecast_at for queries"
```

---

### Task 11: Update remaining server actions and API routes

**Files (batch — same mechanical transformation):**
- `actions/spot/spot-surf-report-actions.ts:125-128`
- `actions/forecast/intent-forecast-actions.ts:125,153,480-486`
- `actions/beginner/beginner-actions.ts:70-72,80-82,335-336`
- `app/api/session-planner/optimal-times/route.ts:112-113`
- `app/api/coast-pulse/summary/route.ts:92-93`
- `app/api/cron/ml/correct-forecasts/route.ts:101-107,170`
- `app/api/forecasts/update-enhanced/route.ts:48,89`
- `lib/services/coast-pulse/coast-pulse-service.ts:495-496,586`
- `lib/services/intel-generation-service.ts:173,176,179,188`
- `lib/npc/template-hydration.ts:50-52`
- `lib/npc/forecast-formatter.ts:215-218`
- `lib/seo/water-temp-meta-data.ts:46,48,62,64`
- `lib/monitoring/forecast-health-check.ts:578-582`

For each file, apply the same pattern:
1. Replace `.eq("forecast_date", date)` → `.gte("forecast_at", ...)` range filter
2. Replace `.order("forecast_date").order("forecast_time")` → `.order("forecast_at")`
3. Replace `new Date(\`${f.forecast_date}T${f.forecast_time}Z\`)` → `new Date(f.forecast_at)`
4. Replace `new Date(\`${f.forecast_date}T${f.forecast_time}\`)` → `new Date(f.forecast_at)`

Run each file's tests after updating. Commit in logical groups (3-4 files per commit).

---

## Phase 5: Client Components

### Task 12: Update client-side date filtering in components

**Files (batch):**
- `components/beach-detail/tabs/forecast-tab.tsx:108-111,137,170,177`
- `components/beach-detail/forecast-and-tides.tsx:75`
- `components/beach-detail/best-surf-window.tsx:132`
- `components/forecast/forecast-table.tsx:391`
- `components/forecast/enhanced-forecast-with-transparency.tsx:83`
- `components/forecast/beaches-enhanced-forecast-with-transparency.tsx:156,365,385`
- `components/forecast/tide-chart-enhanced.tsx:54-66`
- `components/beach-detail/todays-forecast.tsx:23,77`

For each component:
1. Replace `f.forecast_date === todayStr` → `extractForecastDate(f.forecast_at, beachTimezone) === todayStr`
2. Replace `new Date(\`${f.forecast_date}T${f.forecast_time}\`)` → `new Date(f.forecast_at)`
3. Replace direct `{forecast.forecast_date} {forecast.forecast_time}` rendering → format from `forecast_at`
4. Import `extractForecastDate` from `@/lib/utils/forecast-at-adapter`

Run component tests after each batch. Commit per component group.

---

### Task 13: Update client hooks

**Files:**
- `hooks/use-magic-hour.ts:152-155`
- `hooks/use-session-forecast.ts:73`
- `app/sessions/new/useSessionSubmission.ts:54,62,68,214,527`

Same mechanical transformation. Replace query filters and date construction patterns.

---

## Phase 6: Remaining Utilities and Scoring

### Task 14: Update scoring and analysis utilities

**Files:**
- `lib/scoring/types.ts:129`
- `lib/scorers/session-window-scorer.ts:64-65,298-300`
- `lib/analyzers/wind-analyzer.ts:63-64,88,94`
- `lib/services/forecast/confidence-scorer.ts:139-141,188`
- `lib/services/forecast-alerts.ts:186`
- `lib/services/magic-hour/magic-hour-finder.ts:126`
- `lib/services/magic-hour/types.ts:14-16,52-53`
- `lib/services/discovery/window-selector/window-selector-core.ts:74-76`
- `lib/services/discovery/surf-discovery-orchestrator.ts:431,477`
- `lib/domains/scoring/discovery-adapter.ts:108`
- `lib/utils/surf-call-logic.ts:464`
- `lib/utils/forecast-snapshot-utils.ts:34-35`
- `lib/utils/enriched-day-summary.ts:54-57`
- `lib/utils/horizon-strip-utils.ts:150-151`
- `lib/utils/regional-forecast-utils.ts:260,406,555`
- `lib/utils/date-utils.ts:363-401`
- `lib/utils.ts:9-21`

All follow the same pattern. The key fixes:

1. **`window-selector-core.ts:74-76`** — CRITICAL: Remove the `fromZonedTime()` double-conversion:
   ```typescript
   // BEFORE (double-converts, shifts by -8h):
   const forecastDate = fromZonedTime(`${forecast.forecast_date}T${forecast.forecast_time}`, beachTz);
   // AFTER (forecast_at is already UTC):
   const forecastDate = new Date(forecast.forecast_at);
   ```

2. **`discovery-adapter.ts:108`** — Fix the Invalid Date:
   ```typescript
   // BEFORE (produces Invalid Date):
   timestamp: new Date(forecast.forecast_time || Date.now()),
   // AFTER:
   timestamp: new Date(forecast.forecast_at),
   ```

3. **`date-utils.ts:363-401`** — Simplify `formatForecastTime` and `formatForecastTimeDetailed`:
   ```typescript
   // BEFORE: accepts (forecast_date, forecast_time), does split/setHours
   // AFTER: accepts forecast_at string, does new Date(forecast_at)
   ```

---

## Phase 7: Test Mock Updates

### Task 15: Update test mocks

**Files:** ~27 test files (see audit report for full list)

All test mocks that create forecast objects need `forecast_at` added. Use search-and-replace:

```typescript
// Pattern: wherever you see
forecast_date: "2026-02-14",
forecast_time: "06:00:00",

// Add above them:
forecast_at: "2026-02-14T06:00:00Z",
```

Commit in batches of 5-8 test files.

---

## Phase 8: Cleanup

### Task 16: Update `ten_day_enhanced_forecasts` view

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_update_ten_day_view_forecast_at.sql`

```sql
BEGIN;

CREATE OR REPLACE VIEW public.ten_day_enhanced_forecasts
WITH (security_invoker = true) AS
SELECT * FROM public.enhanced_forecasts
WHERE forecast_at >= NOW()
  AND forecast_at <= NOW() + INTERVAL '10 days'
ORDER BY beach_id, forecast_at;

COMMIT;
```

---

### Task 17: Drop old columns (FINAL — only after all consumers migrated)

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_drop_legacy_forecast_date_time.sql`

```sql
BEGIN;

-- Drop old unique constraint
ALTER TABLE public.enhanced_forecasts
  DROP CONSTRAINT IF EXISTS enhanced_forecasts_unique;

-- Drop old index
DROP INDEX IF EXISTS idx_enhanced_forecasts_beach_date_time;

-- Drop deprecated columns
ALTER TABLE public.enhanced_forecasts
  DROP COLUMN IF EXISTS forecast_date;
ALTER TABLE public.enhanced_forecasts
  DROP COLUMN IF EXISTS forecast_time;

COMMIT;
```

**WARNING:** Only apply this AFTER:
- [ ] All ~45 source files migrated to `forecast_at`
- [ ] All ~27 test files updated
- [ ] Full E2E test pass
- [ ] Production verified for at least 1 week with both columns present
- [ ] `forecast_date`/`forecast_time` confirmed unused in any query

After applying, regenerate TypeScript types and remove `@deprecated` markers from `EnhancedForecastEntity`.

---

## Verification Checklist

After each phase, run:

```bash
# Type check
npx tsc --noEmit

# Unit tests
npx jest --no-coverage

# Specific forecast tests
npx jest --testPathPattern="forecast" --no-coverage

# E2E smoke test (beach detail page with tide chart)
npx playwright test e2e/beach-detail.spec.ts

# Verify tide data is correct in production
# Query: compare enhanced_forecasts.tide_status against tide_forecasts for today
```

---

## Risk Mitigation

1. **Backward compatibility:** Old columns remain during transition. Both old and new unique constraints coexist.
2. **Rollback:** If issues arise, the old `forecast_date + forecast_time` columns still have data. Queries can be reverted.
3. **Incremental deployment:** Each phase can be deployed independently. Phase 2 (write path) starts writing `forecast_at` alongside old columns.
4. **No data loss:** The migration only adds a column and backfills from existing data. No destructive operations until Phase 8.

---

## File Count Summary

| Phase | Files Modified | Tests Created/Modified |
|-------|---------------|----------------------|
| Phase 0: Foundation | 2 created | 2 created |
| Phase 1: DB Migration | 1 migration + types regen | 0 |
| Phase 2: Write Path | 3 modified | 3 created/modified |
| Phase 3: Core Utils | 2 modified | 2 created/modified |
| Phase 4: Query Layer | ~19 modified | verify existing tests |
| Phase 5: Components | ~8 modified | verify existing tests |
| Phase 6: Scoring/Utils | ~17 modified | verify existing tests |
| Phase 7: Test Mocks | 0 | ~27 modified |
| Phase 8: Cleanup | 1 migration + types regen | 0 |
| **Total** | **~50 source + 2 migrations** | **~32 test files** |
