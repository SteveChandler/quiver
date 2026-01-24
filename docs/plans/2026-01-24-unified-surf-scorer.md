# Unified Surf Scorer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate data mismatch between Today's Surf Call banner and Best Time to Surf Today card by having both consume the same score-based data source, removing the separate AI intel timing and Magic Hour card.

**Architecture:** The banner's existing pipeline (`selectBestWindow` → `computeSurfCall`) is already the "Referee" — score-based, sunset-aware, with a proper verdict. The forecast card currently uses a separate system (AI intel + legacy scorer + magic hour). We extend `SurfCallResult` with peak time + trend tags, then refactor the card to consume it.

**Tech Stack:** TypeScript, React, Next.js server actions, existing `lib/scoring` module

---

## Task 1: Add Peak Time to SurfCallResult

**Files:**
- Modify: `lib/utils/surf-call-logic.ts`
- Modify: `lib/scoring/types.ts` (already has `peakTime?: Date` in OptimalWindow)
- Test: `__tests__/lib/utils/surf-call-logic.test.ts`

**Step 1: Write the failing test**

```typescript
// In __tests__/lib/utils/surf-call-logic.test.ts
import { computeSurfCall } from '@/lib/utils/surf-call-logic';

describe('computeSurfCall peak time', () => {
  it('returns peakTime as ISO string when window exists', () => {
    const window = {
      start: '2026-01-24T14:00:00Z',
      end: '2026-01-24T18:00:00Z',
      score: 75,
      confidence: 80,
      waveHeight: '3 ft',
      peakTime: new Date('2026-01-24T16:00:00Z'),
    };
    const forecasts = makeMockForecasts('2026-01-24', ['14:00', '15:00', '16:00', '17:00', '18:00']);
    const beach = makeMockBeach();

    const result = computeSurfCall(window, forecasts, beach);

    expect(result.peakTime).toBe('2026-01-24T16:00:00.000Z');
  });

  it('returns null peakTime when no window', () => {
    const result = computeSurfCall(null, [], makeMockBeach());
    expect(result.peakTime).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/utils/surf-call-logic.test.ts --testNamePattern="peak" -v`
Expected: FAIL - `peakTime` property doesn't exist on SurfCallResult

**Step 3: Add peakTime to SurfCallResult type and computeSurfCall logic**

In `lib/utils/surf-call-logic.ts`:

```typescript
// Add to SurfCallResult interface:
peakTime: string | null; // ISO string of peak scoring moment within window

// In computeSurfCall, after computing verdict:
// Extract peakTime from window if available
const peakTime = (window as any).peakTime instanceof Date
  ? (window as any).peakTime.toISOString()
  : null;

// Add to return object:
peakTime,
```

Also update `baseResult` to include `peakTime: null`.

**Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/utils/surf-call-logic.test.ts --testNamePattern="peak" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/surf-call-logic.ts __tests__/lib/utils/surf-call-logic.test.ts
git commit -m "feat(scoring): add peakTime to SurfCallResult"
```

---

## Task 2: Add Trend Tags Computation

**Files:**
- Create: `lib/scoring/trend-tags.ts`
- Test: `__tests__/lib/scoring/trend-tags.test.ts`

**Step 1: Write the failing tests**

```typescript
// __tests__/lib/scoring/trend-tags.test.ts
import { computeTrendTags } from '@/lib/scoring/trend-tags';
import type { EnhancedForecastEntity } from '@/types/forecast';

describe('computeTrendTags', () => {
  it('returns "Winds Dropping" when wind speed decreases across window', () => {
    const forecasts = [
      mockForecast({ forecast_time: '14:00', wind_speed: '15', wind_direction_deg: 90 }),
      mockForecast({ forecast_time: '15:00', wind_speed: '12', wind_direction_deg: 90 }),
      mockForecast({ forecast_time: '16:00', wind_speed: '8', wind_direction_deg: 90 }),
    ];
    const tags = computeTrendTags(forecasts);
    expect(tags).toContain('Winds Dropping');
  });

  it('returns "Winds Cleaning Up" when speed stable but direction improves', () => {
    const forecasts = [
      mockForecast({ forecast_time: '14:00', wind_speed: '10', wind_direction_deg: 270 }), // onshore
      mockForecast({ forecast_time: '15:00', wind_speed: '10', wind_direction_deg: 180 }), // cross
      mockForecast({ forecast_time: '16:00', wind_speed: '10', wind_direction_deg: 90 }),  // offshore
    ];
    const beach = { wind_offshore_deg: 90 };
    const tags = computeTrendTags(forecasts, beach);
    expect(tags).toContain('Winds Cleaning Up');
  });

  it('returns "Tide Filling In" when tide rises through window', () => {
    const forecasts = [
      mockForecast({ forecast_time: '14:00', tide_height: '1.5' }),
      mockForecast({ forecast_time: '15:00', tide_height: '2.5' }),
      mockForecast({ forecast_time: '16:00', tide_height: '3.5' }),
    ];
    const tags = computeTrendTags(forecasts);
    expect(tags).toContain('Tide Filling In');
  });

  it('returns "Clean Swell" when wave period is consistently high', () => {
    const forecasts = [
      mockForecast({ forecast_time: '14:00', wave_period: '12' }),
      mockForecast({ forecast_time: '15:00', wave_period: '13' }),
      mockForecast({ forecast_time: '16:00', wave_period: '12' }),
    ];
    const tags = computeTrendTags(forecasts);
    expect(tags).toContain('Clean Swell');
  });

  it('returns "Winds Building" when wind speed increases', () => {
    const forecasts = [
      mockForecast({ forecast_time: '14:00', wind_speed: '5' }),
      mockForecast({ forecast_time: '15:00', wind_speed: '10' }),
      mockForecast({ forecast_time: '16:00', wind_speed: '18' }),
    ];
    const tags = computeTrendTags(forecasts);
    expect(tags).toContain('Winds Building');
  });

  it('returns max 3 tags', () => {
    const forecasts = [
      mockForecast({ forecast_time: '14:00', wind_speed: '15', tide_height: '1.5', wave_period: '12' }),
      mockForecast({ forecast_time: '16:00', wind_speed: '5', tide_height: '3.5', wave_period: '14' }),
    ];
    const tags = computeTrendTags(forecasts);
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for single forecast', () => {
    const forecasts = [mockForecast({ forecast_time: '14:00' })];
    const tags = computeTrendTags(forecasts);
    expect(tags).toEqual([]);
  });
});

function mockForecast(overrides: Partial<EnhancedForecastEntity>): EnhancedForecastEntity {
  return {
    id: 'test',
    beach_id: 'test',
    forecast_date: '2026-01-24',
    forecast_time: '12:00',
    wave_height: '3',
    wave_period: '10',
    wave_direction: 'W',
    wind_speed: '10',
    wind_direction: 'E',
    wind_direction_deg: 90,
    tide_height: '3',
    tide_status: 'rising',
    created_at: '',
    updated_at: '',
    ...overrides,
  } as EnhancedForecastEntity;
}
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/scoring/trend-tags.test.ts -v`
Expected: FAIL - module not found

**Step 3: Implement trend-tags.ts**

```typescript
// lib/scoring/trend-tags.ts
import type { EnhancedForecastEntity } from '@/types/forecast';

interface BeachWindPrefs {
  wind_offshore_deg?: number | null;
}

type TrendTag =
  | 'Winds Dropping'
  | 'Winds Building'
  | 'Winds Cleaning Up'
  | 'Tide Filling In'
  | 'Tide Draining'
  | 'Clean Swell'
  | 'All-Day Conditions';

const MAX_TAGS = 3;

/**
 * Compute trend tags from forecast slot progression within a window.
 * Score determines IF a tag applies; raw data determines WHICH label.
 */
export function computeTrendTags(
  forecasts: EnhancedForecastEntity[],
  beach?: BeachWindPrefs
): TrendTag[] {
  if (forecasts.length < 2) return [];

  const tags: TrendTag[] = [];
  const first = forecasts[0];
  const last = forecasts[forecasts.length - 1];

  // Wind speed trend
  const windFirst = parseFloat(first.wind_speed || '0');
  const windLast = parseFloat(last.wind_speed || '0');
  const windDelta = windLast - windFirst;
  const windStable = Math.abs(windDelta) < 3; // Less than 3mph change = stable

  if (windDelta <= -5) {
    tags.push('Winds Dropping');
  } else if (windDelta >= 5) {
    tags.push('Winds Building');
  } else if (windStable && beach?.wind_offshore_deg != null) {
    // Check if direction is improving (rotating toward offshore)
    const dirFirst = first.wind_direction_deg ?? null;
    const dirLast = last.wind_direction_deg ?? null;
    if (dirFirst !== null && dirLast !== null) {
      const offDiffFirst = circularDiff(dirFirst, beach.wind_offshore_deg);
      const offDiffLast = circularDiff(dirLast, beach.wind_offshore_deg);
      if (offDiffFirst - offDiffLast >= 30) {
        tags.push('Winds Cleaning Up');
      }
    }
  }

  // Tide trend
  const tideFirst = parseFloat(first.tide_height || '0');
  const tideLast = parseFloat(last.tide_height || '0');
  const tideDelta = tideLast - tideFirst;

  if (tideDelta >= 1.0) {
    tags.push('Tide Filling In');
  } else if (tideDelta <= -1.0) {
    tags.push('Tide Draining');
  }

  // Swell quality (consistent high period = clean swell)
  const periods = forecasts
    .map(f => parseFloat(f.wave_period || '0'))
    .filter(p => p > 0);

  if (periods.length >= 2) {
    const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
    const periodVariance = periods.reduce((sum, p) => sum + (p - avgPeriod) ** 2, 0) / periods.length;
    if (avgPeriod >= 10 && periodVariance < 4) {
      tags.push('Clean Swell');
    }
  }

  return tags.slice(0, MAX_TAGS);
}

function circularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/scoring/trend-tags.test.ts -v`
Expected: PASS

**Step 5: Export from scoring index**

In `lib/scoring/index.ts` add:
```typescript
export { computeTrendTags } from './trend-tags';
```

**Step 6: Commit**

```bash
git add lib/scoring/trend-tags.ts __tests__/lib/scoring/trend-tags.test.ts lib/scoring/index.ts
git commit -m "feat(scoring): add trend tag computation from forecast slopes"
```

---

## Task 3: Extend SurfCallResult with Trend Tags

**Files:**
- Modify: `lib/utils/surf-call-logic.ts`
- Modify: `actions/spot/spot-surf-report-actions.ts`
- Test: `__tests__/lib/utils/surf-call-logic.test.ts`

**Step 1: Write the failing test**

```typescript
describe('computeSurfCall trend tags', () => {
  it('includes trend tags derived from window forecasts', () => {
    const window = {
      start: '2026-01-24T14:00:00Z',
      end: '2026-01-24T18:00:00Z',
      score: 75,
      confidence: 80,
      waveHeight: '3 ft',
    };
    const forecasts = [
      makeForecast('14:00', { wind_speed: '15', tide_height: '1.5', wave_period: '12' }),
      makeForecast('15:00', { wind_speed: '12', tide_height: '2.0', wave_period: '12' }),
      makeForecast('16:00', { wind_speed: '8', tide_height: '2.5', wave_period: '13' }),
      makeForecast('17:00', { wind_speed: '6', tide_height: '3.0', wave_period: '12' }),
    ];
    const beach = makeMockBeach();

    const result = computeSurfCall(window, forecasts, beach);

    expect(result.trendTags).toContain('Winds Dropping');
    expect(result.trendTags.length).toBeLessThanOrEqual(3);
  });

  it('returns empty trendTags when no window', () => {
    const result = computeSurfCall(null, [], makeMockBeach());
    expect(result.trendTags).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/utils/surf-call-logic.test.ts --testNamePattern="trend" -v`
Expected: FAIL - `trendTags` not on SurfCallResult

**Step 3: Add trendTags to SurfCallResult and compute in computeSurfCall**

In `lib/utils/surf-call-logic.ts`:

```typescript
import { computeTrendTags } from '@/lib/scoring/trend-tags';

// Add to SurfCallResult interface:
trendTags: string[];

// In computeSurfCall, after getting windowForecasts:
const trendTags = computeTrendTags(effectiveForecasts, beach);

// Add to all return paths:
trendTags: [],  // for early returns
trendTags,      // for main return
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/utils/surf-call-logic.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/surf-call-logic.ts __tests__/lib/utils/surf-call-logic.test.ts
git commit -m "feat(scoring): integrate trend tags into SurfCallResult"
```

---

## Task 4: Pass SurfCallResult to Forecast Tab Card

**Files:**
- Modify: `components/beach-detail/tabs/forecast-tab.tsx`
- Modify: `components/beach-detail/best-surf-window.tsx`

**Step 1: Find where BestSurfWindow is rendered in forecast-tab**

The forecast tab renders `<BestSurfWindow>` with beachId, beachName, beachTimezone, and forecasts. We need to also pass the `SurfCallResult` that the parent page already computes for the top banner.

**Step 2: Add surfCall prop to BestSurfWindow**

In `components/beach-detail/best-surf-window.tsx`, update the interface:

```typescript
import type { SurfCallResult } from '@/lib/utils/surf-call-logic';

interface BestSurfWindowProps {
  beachId: string;
  beachName: string;
  beachTimezone?: string | null;
  forecasts?: EnhancedForecastEntity[];
  surfCall?: SurfCallResult | null; // New: from same source as banner
}
```

**Step 3: Thread surfCall from page → forecast-tab → BestSurfWindow**

Trace the data flow from the beach detail page to find where `getSpotSurfReport` is already called and pass its result down. The spot-surf-report component already receives this data. We need to expose it as a prop or use a shared context.

Check: `components/spots/spot-surf-report.tsx` already calls `getSpotSurfReport(beach)`. The result needs to also reach the forecast tab's `BestSurfWindow`.

The cleanest approach: have the parent page call `getSpotSurfReport` once and pass the result to both components.

**Step 4: Commit**

```bash
git add components/beach-detail/best-surf-window.tsx components/beach-detail/tabs/forecast-tab.tsx
git commit -m "feat(spots): thread SurfCallResult to forecast tab card"
```

---

## Task 5: Refactor BestSurfWindow to Single Card with Unified Data

**Files:**
- Modify: `components/beach-detail/best-surf-window.tsx`

This is the main UI refactor. When `surfCall` prop is provided, render the new single-card design. Fall back to existing behavior if surfCall is null (backwards compatible).

**Step 1: Implement new card layout**

When `surfCall` is available and has a window:

```tsx
// Single card: Window + Peak + Trend Tags
<Card className="rounded-3xl border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white shadow-lg">
  <CardHeader className="pb-3">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <CardTitle className="text-xl font-bold text-blue-900">
          🌊 Best Time to Surf Today
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Based on forecast data</p>
      </div>
      {/* Safe Mode Badge */}
      <span className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${
        surfCall.forecastConfidence >= 50
          ? 'bg-green-100 text-green-700'
          : 'bg-amber-100 text-amber-700'
      }`}>
        {surfCall.forecastConfidence >= 50 ? '● Live Data' : '⚠️ Forecast Only'}
      </span>
    </div>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* Window + Peak */}
    <div className="bg-gradient-to-br from-green-50/80 to-blue-50/50 rounded-xl p-4 border border-green-200/60">
      <p className="text-2xl font-bold text-green-600">
        {formatTime(surfCall.bestWindowStart)} – {formatTime(surfCall.bestWindowEnd)}
      </p>
      {surfCall.peakTime && (
        <p className="text-sm font-medium text-blue-700 mt-1">
          Peak: {formatTime(surfCall.peakTime)}
        </p>
      )}
    </div>

    {/* Trend Tags */}
    {surfCall.trendTags.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {surfCall.trendTags.map(tag => (
          <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            {tag}
          </span>
        ))}
      </div>
    )}

    {/* AI Narrative (whySentence as fallback) */}
    <p className="text-sm text-gray-700 leading-relaxed">
      {surfCall.whySentence}
    </p>
  </CardContent>
</Card>
```

**Step 2: Remove Magic Hour card rendering**

Remove all `magicHour?.found && (...)` blocks and the `useMagicHour` import/call when `surfCall` prop is provided.

**Step 3: Remove unused imports when surfCall path is active**

The `useMagicHour`, `findNextBestWindow`, `data.intel.getDaily` imports can be conditionally skipped. Keep them for the fallback path (when surfCall is null) for backwards compatibility during rollout.

**Step 4: Commit**

```bash
git add components/beach-detail/best-surf-window.tsx
git commit -m "feat(spots): refactor forecast card to single unified view with trend tags"
```

---

## Task 6: Pass peakTime from Window Selector

**Files:**
- Modify: `lib/services/discovery/window-selector.ts`
- Modify: `types/personalization.ts` (PersonalizedForecastWindow)

The window selector already scores each forecast. We need it to also output the peak-scoring forecast time as `peakTime` in `PersonalizedForecastWindow`.

**Step 1: Add peakTime to PersonalizedForecastWindow type**

```typescript
// In types/personalization.ts:
export interface PersonalizedForecastWindow {
  // ... existing fields
  peakTime?: string; // ISO string of highest-scoring forecast within window
}
```

**Step 2: In selectBestWindow, track the peak forecast time**

When building the window from scored forecasts, record which forecast had the highest score. Set `peakTime` to that forecast's timestamp.

**Step 3: Run existing window-selector tests**

Run: `npx jest --testPathPattern="window-selector" -v`
Expected: PASS (no breaking changes)

**Step 4: Commit**

```bash
git add lib/services/discovery/window-selector.ts types/personalization.ts
git commit -m "feat(scoring): output peakTime from window selector"
```

---

## Task 7: Wire Up Data Flow in Beach Detail Page

**Files:**
- Modify: The page component that renders both SpotSurfReport and the forecast tab

**Step 1: Find the parent page**

The beach detail page renders both the `SpotSurfReport` (banner) and the forecast tab containing `BestSurfWindow`. Locate it and ensure `getSpotSurfReport` is called once and its result is passed to both components.

**Step 2: Call getSpotSurfReport once and pass to both**

```typescript
const surfReportResult = await getSpotSurfReport(beach);
const surfCall = surfReportResult?.report ?? null;

// Pass to banner
<SpotSurfReport beach={beach} surfCall={surfCall} />

// Pass to forecast tab
<ForecastTab surfCall={surfCall} ... />
```

**Step 3: Verify both banner and card show the same window**

The key verification: both the top banner and the forecast card should display identical window times since they consume the same `SurfCallResult`.

**Step 4: Commit**

```bash
git add app/[intent]/[city]/[beachSlug]/ components/
git commit -m "feat(spots): unified data flow for surf call banner and forecast card"
```

---

## Task 8: Remove Magic Hour Dependencies (Cleanup)

**Files:**
- Modify: `components/beach-detail/best-surf-window.tsx` (remove fallback paths)
- Eventually delete: `hooks/use-magic-hour.ts`
- Eventually delete: `lib/services/magic-hour-finder.ts`
- Eventually delete: `lib/scorers/session-window-scorer.ts` (deprecated functions)

**Step 1: Verify no other consumers of useMagicHour**

Run: `grep -r "useMagicHour\|use-magic-hour" --include="*.ts" --include="*.tsx" -l`

If only `best-surf-window.tsx` uses it, remove the import and hook call.

**Step 2: Verify no other consumers of findNextBestWindow**

Run: `grep -r "findNextBestWindow\|session-window-scorer" --include="*.ts" --include="*.tsx" -l`

**Step 3: Remove dead code only if no other consumers**

Delete files that have zero remaining imports. If other files still reference them, leave them with a `@deprecated` note for a separate cleanup PR.

**Step 4: Run full test suite**

Run: `npx jest --passWithNoTests`
Expected: All existing tests pass (some magic-hour tests may need removal if the module is deleted)

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(scoring): remove magic hour dependencies from forecast card"
```

---

## Task 9: End-to-End Verification

**Files:**
- Test: `e2e/spots/best-surf-window.spec.ts` (create or update)

**Step 1: Verify visual consistency**

Write a Playwright test that navigates to a beach detail page and verifies:
1. The top banner shows a BEST WINDOW time
2. The forecast tab card shows the same time range
3. The Magic Hour card is NOT rendered
4. Trend tags are visible when conditions have clear trends

**Step 2: Run E2E tests**

Run: `npx playwright test e2e/spots/best-surf-window.spec.ts`
Expected: PASS

**Step 3: Final commit**

```bash
git add e2e/
git commit -m "test(e2e): verify unified surf window data consistency"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| AI intel determines card timing | Scorer determines all timing |
| Two cards (Best Window + Magic Hour) | Single card with peak time |
| Static tags ("Onshore winds") | Dynamic trend tags from slopes |
| Banner and card can disagree | Same `SurfCallResult` for both |
| No data source indicator | Safe Mode badge |
| `useMagicHour` hook + `findNextBestWindow` | Single `surfCall` prop from server action |

## Risk Mitigation

- **Backwards compatible**: The `surfCall` prop is optional. If null, existing behavior preserved.
- **Incremental rollout**: Each task can be merged independently.
- **No breaking changes to scoring**: We only ADD fields to existing types.
- **Tests at every step**: TDD with failing test first.
