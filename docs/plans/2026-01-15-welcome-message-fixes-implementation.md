# Welcome Message Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three issues in the welcome message: cap scores at 9.9, add threshold-based condition badges, and clamp time windows to civil twilight.

**Architecture:** Three isolated changes: (1) score formatting utility update, (2) badge component addition to hero-recommendation, (3) sunrise time fetching and window clamping in discovery service.

**Tech Stack:** TypeScript, React, Supabase, suncalc library

---

## Task 1: Score Formatting - Cap at 9.9 and Smart Decimals

**Files:**
- Modify: `lib/utils/rating-formatters.ts:112-114`
- Test: `__tests__/utils/rating-formatters.test.ts` (create if needed)

**Step 1: Write the failing test**

Create `__tests__/utils/rating-formatters.test.ts`:

```typescript
import { formatDiscoveryScore } from '@/lib/utils/rating-formatters';

describe('formatDiscoveryScore', () => {
  it('caps score at 9.9 for perfect 100', () => {
    expect(formatDiscoveryScore(100)).toBe('9.9');
  });

  it('caps score at 9.9 for scores above 99', () => {
    expect(formatDiscoveryScore(105)).toBe('9.9');
  });

  it('formats whole numbers without decimal', () => {
    expect(formatDiscoveryScore(80)).toBe('8');
    expect(formatDiscoveryScore(70)).toBe('7');
    expect(formatDiscoveryScore(90)).toBe('9');
  });

  it('formats non-whole numbers with one decimal', () => {
    expect(formatDiscoveryScore(85)).toBe('8.5');
    expect(formatDiscoveryScore(73)).toBe('7.3');
    expect(formatDiscoveryScore(99)).toBe('9.9');
  });

  it('handles zero', () => {
    expect(formatDiscoveryScore(0)).toBe('0');
  });

  it('handles low scores', () => {
    expect(formatDiscoveryScore(15)).toBe('1.5');
    expect(formatDiscoveryScore(10)).toBe('1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/utils/rating-formatters.test.ts`
Expected: FAIL - tests for capping and smart decimals fail

**Step 3: Write minimal implementation**

Modify `lib/utils/rating-formatters.ts`:

```typescript
/**
 * Format a surf discovery score from 0-100 scale to X.X display format.
 * Specifically for SurfDiscoveryRecommendation scores.
 *
 * - Caps at 9.9 (perfect conditions are theoretical)
 * - Whole numbers display without decimal (e.g., "8" not "8.0")
 * - Non-whole numbers show one decimal (e.g., "8.5")
 *
 * @param score - The score value (0-100)
 * @returns Formatted string like "8.5" or "8" (without the "/10" suffix)
 */
export function formatDiscoveryScore(score: number): string {
  // Cap at 99 (which becomes 9.9)
  const cappedScore = Math.min(score, 99);
  const displayValue = cappedScore / 10;

  // Check if it's a whole number (no decimal needed)
  if (displayValue % 1 === 0) {
    return displayValue.toString();
  }

  return displayValue.toFixed(1);
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/utils/rating-formatters.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/rating-formatters.ts __tests__/utils/rating-formatters.test.ts
git commit -m "feat(scoring): cap display score at 9.9, format whole numbers without decimal"
```

---

## Task 2: Add Condition Badges to Hero Recommendation

**Files:**
- Modify: `components/home-screen/hero-recommendation.tsx:263-289`
- Modify: `types/personalization.ts` (add conditionBadges to SurfDiscoveryRecommendation)
- Modify: `lib/services/surf-discovery-service.ts` (generate badges in scoring)
- Test: `__tests__/components/hero-recommendation.test.tsx` (if exists, add badge tests)

### Task 2a: Define Badge Types

**Step 1: Add badge type to personalization types**

Modify `types/personalization.ts`, add after line ~35:

```typescript
/** Condition badge shown on recommendations */
export interface ConditionBadge {
  /** Badge label (e.g., "Glass", "Clean Swell") */
  label: string;
  /** Score contribution (for ranking top badges) */
  contribution: number;
}
```

Add `conditionBadges` to `SurfDiscoveryRecommendation` interface (around line 160):

```typescript
  /** Top condition badges explaining why conditions are good */
  conditionBadges?: ConditionBadge[];
```

**Step 2: Commit types**

```bash
git add types/personalization.ts
git commit -m "feat(types): add ConditionBadge type to personalization"
```

### Task 2b: Generate Badges in Scoring

**Step 1: Add badge generation to surf-discovery-service**

Modify `lib/services/surf-discovery-service.ts`. Add helper function after imports (~line 40):

```typescript
import type { ConditionBadge } from '@/types/personalization';

/**
 * Generate condition badges based on thresholds
 * Returns top 2-3 badges sorted by contribution
 */
function generateConditionBadges(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  subscores: { waveHeightFit: number; periodEnergy: number; windAlignment: number; tideFit: number }
): ConditionBadge[] {
  const badges: ConditionBadge[] = [];

  const windSpeed = forecast.wind_speed ?? 0;
  const windDirection = forecast.wind_direction ?? null;
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const offshoreDir = beach.wind_offshore_deg ?? 90;

  // Glass: wind < 5 mph
  if (windSpeed < 5) {
    badges.push({ label: 'Glass', contribution: subscores.windAlignment });
  }
  // Light Offshore: offshore direction AND < 10 mph
  else if (windDirection !== null && windSpeed < 10) {
    const angleDiff = Math.abs(windDirection - offshoreDir) % 360;
    const isOffshore = angleDiff <= 45 || angleDiff >= 315;
    if (isOffshore) {
      badges.push({ label: 'Light Offshore', contribution: subscores.windAlignment });
    }
  }

  // Clean Swell: period >= 12s
  if (wavePeriod >= 12) {
    badges.push({ label: 'Clean Swell', contribution: subscores.periodEnergy });
  }

  // Good Tide: if tide score is high (>= 12 out of 15)
  if (subscores.tideFit >= 12) {
    const tideStatus = forecast.tide_status?.toLowerCase() || '';
    if (tideStatus.includes('rising') || tideStatus.includes('incoming')) {
      badges.push({ label: 'Rising Tide', contribution: subscores.tideFit });
    } else if (tideStatus.includes('falling') || tideStatus.includes('outgoing')) {
      badges.push({ label: 'Falling Tide', contribution: subscores.tideFit });
    } else {
      badges.push({ label: 'Good Tide', contribution: subscores.tideFit });
    }
  }

  // Sort by contribution descending, take top 3
  return badges
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);
}
```

**Step 2: Call badge generation in scoreBeachForDiscovery**

In `scoreBeachForDiscovery` function (~line 627), after subscores are calculated, add:

```typescript
// Generate condition badges
const conditionBadges = generateConditionBadges(forecast, beach, {
  waveHeightFit: subscores.waveHeightFit,
  periodEnergy: subscores.periodEnergy,
  windAlignment: subscores.windAlignment,
  tideFit: subscores.tideFit,
});
```

Include `conditionBadges` in the returned DetailedScore object.

**Step 3: Commit scoring changes**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat(scoring): generate threshold-based condition badges"
```

### Task 2c: Display Badges in Hero Component

**Step 1: Update hero-recommendation.tsx to show badges**

Modify `components/home-screen/hero-recommendation.tsx`. In the component (after line 226):

```typescript
const { beach, score, window, matchQuality, recommendationLabel, message, conditionBadges } = recommendation;
```

Replace the badge section (lines 263-289) with:

```typescript
{/* Time window and condition badges */}
<div className="flex flex-wrap items-center gap-2">
  <Badge
    variant="outline"
    className="text-xs sm:text-sm font-medium bg-white/10 text-white border-white/20 py-1.5 px-2.5"
  >
    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
    {timeWindow}
  </Badge>

  {/* Recommendation label badge (Perfect Match for high scores) */}
  {score >= 90 && (
    <Badge
      variant="outline"
      className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
    >
      Perfect Match
    </Badge>
  )}

  {/* Condition badges */}
  {conditionBadges?.slice(0, 3).map((badge) => (
    <Badge
      key={badge.label}
      variant="outline"
      className="text-xs sm:text-sm font-medium py-1.5 px-2.5 bg-white/10 text-white border-white/20"
    >
      {badge.label}
    </Badge>
  ))}
</div>
```

**Step 2: Run dev server and verify visually**

Run: `yarn dev`
Navigate to home screen, verify badges appear.

**Step 3: Commit component changes**

```bash
git add components/home-screen/hero-recommendation.tsx
git commit -m "feat(ui): display condition badges in hero recommendation"
```

---

## Task 3: Clamp Time Window to Civil Twilight

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:50-90` (fetch sunrise times)
- Modify: `lib/services/surf-discovery-service.ts:1108-1294` (clamp start time)
- Test: `__tests__/services/select-best-window-sunrise.test.ts` (create)

### Task 3a: Fetch Sunrise Times

**Step 1: Modify getBatchSunTimes to include sunrise**

Update `lib/services/surf-discovery-service.ts` function `getBatchSunTimes` (~line 50):

```typescript
/**
 * Batch fetch sun times (sunrise and sunset) for multiple beaches.
 * Returns a Map keyed by beachId -> { sunrises: Date[], sunsets: Date[] }
 */
export async function getBatchSunTimes(
  beachIds: string[],
  dates: string[]
): Promise<Map<string, { sunrises: Date[]; sunsets: Date[] }>> {
  const supabase = createSupabaseServiceRoleClient();

  const uniqueBeachIds = [...new Set(beachIds)];
  const uniqueDates = [...new Set(dates)];

  if (uniqueBeachIds.length === 0 || uniqueDates.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('sun_times')
    .select('beach_id, sunrise_utc, sunset_utc')
    .in('beach_id', uniqueBeachIds)
    .in('date', uniqueDates)
    .order('sunrise_utc', { ascending: true });

  if (error) {
    console.error('Error fetching sun times:', error);
    return new Map();
  }

  const sunMap = new Map<string, { sunrises: Date[]; sunsets: Date[] }>();

  data?.forEach((row) => {
    const beachId = row.beach_id;

    if (!sunMap.has(beachId)) {
      sunMap.set(beachId, { sunrises: [], sunsets: [] });
    }

    const entry = sunMap.get(beachId)!;

    if (row.sunrise_utc) {
      entry.sunrises.push(new Date(row.sunrise_utc));
    }
    if (row.sunset_utc) {
      entry.sunsets.push(new Date(row.sunset_utc));
    }
  });

  // Sort arrays
  sunMap.forEach((entry) => {
    entry.sunrises.sort((a, b) => a.getTime() - b.getTime());
    entry.sunsets.sort((a, b) => a.getTime() - b.getTime());
  });

  return sunMap;
}
```

**Step 2: Update callers to use new structure**

Update `selectBestWindow` (~line 1141) to use new structure:

```typescript
// Get sorted sun times for this beach
const sunTimes = sunTimesCache?.get(beach.id);
const sunsets = sunTimes?.sunsets || [];
const sunrises = sunTimes?.sunrises || [];
```

**Step 3: Commit fetch changes**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat(sun-times): fetch sunrise along with sunset"
```

### Task 3b: Calculate Civil Twilight and Clamp Start Time

**Step 1: Write the failing test**

Create `__tests__/services/select-best-window-sunrise.test.ts`:

```typescript
import { selectBestWindow } from '@/lib/services/surf-discovery-service';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

describe('selectBestWindow - sunrise clamping', () => {
  const mockBeach: Beach = {
    id: 'test-beach',
    name: 'Test Beach',
    lat: 32.8,
    lon: -117.2,
    // ... other required fields
  } as Beach;

  it('clamps start time to civil twilight when window starts before first light', () => {
    // Sunrise at 6:30am, civil twilight ~6:00am
    const sunrise = new Date('2024-01-15T14:30:00Z'); // 6:30am PST
    const sunTimes = new Map([
      ['test-beach', { sunrises: [sunrise], sunsets: [new Date('2024-01-15T01:00:00Z')] }]
    ]);

    // Forecast starting at 4:00am (before civil twilight)
    const forecasts: EnhancedForecastEntity[] = [
      {
        beach_id: 'test-beach',
        forecast_date: '2024-01-15',
        forecast_time: '12:00:00', // 4am PST (UTC-8)
        wave_height: '3.5 ft',
        wave_period: '14s',
        wind_speed: 3,
        wind_direction: 90,
        tide_height: 3.5,
        tide_status: 'Rising',
        confidence_score: 80,
      } as EnhancedForecastEntity,
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, undefined, sunTimes);

    // Start time should be clamped to civil twilight (sunrise - 30min = 6:00am)
    expect(result).not.toBeNull();
    const startHour = result!.start.getUTCHours();
    expect(startHour).toBeGreaterThanOrEqual(14); // 6am PST = 14:00 UTC
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/services/select-best-window-sunrise.test.ts`
Expected: FAIL

**Step 3: Add civil twilight clamping in selectBestWindow**

Modify `lib/services/surf-discovery-service.ts` in `selectBestWindow` function.

Add constant at top (~line 107):

```typescript
const CIVIL_TWILIGHT_MINUTES = 30; // Civil twilight is ~30 min before sunrise
```

In the loop (~line 1143), after getting sunrises, add clamping logic:

```typescript
// Find next sunrise for civil twilight calculation
const nextSunrise = sunrises.find(s => s.getTime() > now.getTime());
let civilTwilight: Date | null = null;
if (nextSunrise) {
  civilTwilight = new Date(nextSunrise.getTime() - CIVIL_TWILIGHT_MINUTES * 60 * 1000);
}

// Clamp start time to civil twilight
let effectiveStartTime = startTime;
if (civilTwilight && startTime < civilTwilight) {
  effectiveStartTime = civilTwilight;
}
```

Use `effectiveStartTime` instead of `startTime` for window start in the result.

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/services/select-best-window-sunrise.test.ts`
Expected: PASS

**Step 5: Commit clamping logic**

```bash
git add lib/services/surf-discovery-service.ts __tests__/services/select-best-window-sunrise.test.ts
git commit -m "feat(windows): clamp start time to civil twilight"
```

---

## Task 4: Integration Testing

**Step 1: Run full test suite**

```bash
yarn test
```

**Step 2: Run E2E tests for home screen**

```bash
yarn test:e2e --grep "home"
```

**Step 3: Manual verification**

1. Start dev server: `yarn dev`
2. Navigate to home screen
3. Verify:
   - Score shows without ".0" for whole numbers
   - Score never exceeds 9.9
   - Condition badges appear (Glass, Clean Swell, etc.)
   - Time window starts no earlier than ~30 min before sunrise

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "test: add integration tests for welcome message fixes"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Score formatting | `rating-formatters.ts` |
| 2a | Badge types | `types/personalization.ts` |
| 2b | Badge generation | `surf-discovery-service.ts` |
| 2c | Badge display | `hero-recommendation.tsx` |
| 3a | Sunrise fetching | `surf-discovery-service.ts` |
| 3b | Civil twilight clamping | `surf-discovery-service.ts` |
| 4 | Integration testing | Various test files |
