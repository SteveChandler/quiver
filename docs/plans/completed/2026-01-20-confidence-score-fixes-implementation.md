# Confidence Score Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address code review findings from the confidence score bug fix: remove redundant code, add Sentry telemetry, add regression tests, and document confidence scale conventions.

**Architecture:** The fix involves cleaning up defensive code in `forecast-weighting-service.ts`, adding Sentry warnings when the defensive minimum triggers in `enhanced-forecast-service.ts`, creating unit tests for `ForecastWeightingService.blendForecast()`, and documenting the 0-100 vs 0-1 scale conventions.

**Tech Stack:** TypeScript, Jest, Sentry (`@sentry/nextjs`)

---

## Task 1: Remove Redundant Defensive Code

**Files:**
- Modify: `lib/services/forecast-weighting-service.ts:83-85`

**Step 1: Read the current file**

Verify the redundant line exists at line 85:
```typescript
confidence: automatedForecast.confidence,
```

**Step 2: Remove the redundant line**

Change from:
```typescript
if (!calibration) {
  // No expert data available, return automated forecast as-is
  // Explicitly preserve confidence to ensure it's not lost during spread
  return {
    ...automatedForecast,
    confidence: automatedForecast.confidence,
    blend_ratio: {
      automated: 1.0,
      expert: 0.0,
    },
  };
}
```

To:
```typescript
if (!calibration) {
  // No expert data available, return automated forecast as-is
  return {
    ...automatedForecast,
    blend_ratio: {
      automated: 1.0,
      expert: 0.0,
    },
  };
}
```

**Step 3: Run existing tests to verify no regression**

Run: `yarn test:unit --testPathPattern="forecast" --passWithNoTests`
Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/services/forecast-weighting-service.ts
git commit -m "refactor: remove redundant confidence assignment in blendForecast

The explicit confidence assignment was defensive code added when the
root cause was unclear. Now that we know the issue was scale mismatch
(fixed in enhanced-forecast-service.ts), the spread operator correctly
copies confidence from automatedForecast.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Sentry Telemetry for Defensive Minimum

**Files:**
- Modify: `lib/services/enhanced-forecast-service.ts:440-451`

**Step 1: Read the current file around line 440**

Verify the current implementation has the `Math.max()` defensive minimum.

**Step 2: Add Sentry import if not present**

Check top of file for Sentry import. If missing, add:
```typescript
import * as Sentry from '@sentry/nextjs';
```

**Step 3: Refactor confidence_score assignment with telemetry**

Change from:
```typescript
const updatedForecast = {
  ...forecast,
  wave_height: formatHeight(weightedForecast.wave_height_ft),
  wave_period: formatPeriod(weightedForecast.wave_period_s),
  confidence_score: Math.max(
    forecast.confidence_score ?? 70,
    Math.round(weightedForecast.confidence * 100)
  ),
  // Note: No visible attribution to expert sources - silent integration
};
```

To:
```typescript
// Calculate confidence with defensive minimum
const originalConfidence = forecast.confidence_score ?? 70;
const blendedConfidence = Math.round(weightedForecast.confidence * 100);
const defensiveMinimumApplied = blendedConfidence < originalConfidence;

if (defensiveMinimumApplied) {
  Sentry.captureMessage('Confidence defensive minimum applied', {
    level: 'warning',
    tags: { component: 'forecast-weighting' },
    extra: {
      beachId: forecast.beach_id,
      beachName,
      originalConfidence,
      blendedConfidence,
      delta: originalConfidence - blendedConfidence,
    },
  });
}

const updatedForecast = {
  ...forecast,
  wave_height: formatHeight(weightedForecast.wave_height_ft),
  wave_period: formatPeriod(weightedForecast.wave_period_s),
  confidence_score: Math.max(originalConfidence, blendedConfidence),
  // Note: No visible attribution to expert sources - silent integration
};
```

**Step 4: Run existing tests to verify no regression**

Run: `yarn test:unit --testPathPattern="enhanced-forecast" --passWithNoTests`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/services/enhanced-forecast-service.ts
git commit -m "feat: add Sentry telemetry when confidence defensive minimum applies

Fires a warning-level Sentry event when expert calibration would have
lowered confidence below the original calculated value. This helps
detect potential regressions or informs future product decisions about
whether experts should be able to lower confidence.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Regression-Focused Unit Tests

**Files:**
- Create: `__tests__/lib/services/forecast-weighting-service.test.ts`

**Step 1: Create test file with mock setup**

```typescript
/**
 * Regression tests for ForecastWeightingService.blendForecast()
 *
 * These tests specifically guard against the confidence score bug where
 * 70% confidence was incorrectly converted to 1% due to scale mismatch.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Supabase to avoid actual database calls
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock environment variables
const originalEnv = process.env;

describe('ForecastWeightingService.blendForecast - confidence regression tests', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('preserves 70% confidence when no calibration exists', async () => {
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 4,
      wave_period_s: 12,
      wave_direction_deg: 270,
      confidence: 0.7, // 70% in 0-1 scale
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    expect(result.confidence).toBeCloseTo(0.7, 2);
    expect(result.blend_ratio).toEqual({ automated: 1.0, expert: 0.0 });
  });

  it('preserves 85% CDIP confidence when no calibration exists', async () => {
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 5,
      wave_period_s: 14,
      wave_direction_deg: 280,
      confidence: 0.85, // 85% CDIP confidence
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    expect(result.confidence).toBeCloseTo(0.85, 2);
  });

  it('REGRESSION: 0.7 confidence never produces ~0.01 output', async () => {
    // THE KEY REGRESSION TEST
    // Guards against the "70% becomes 1%" bug where confidence_score=70
    // was passed to 0-1 scale service and capped at 1.0
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 4,
      wave_period_s: 12,
      wave_direction_deg: 270,
      confidence: 0.7,
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    // Must be greater than 0.1 (would be ~0.01 if bug existed)
    expect(result.confidence).toBeGreaterThan(0.1);
    // Must be at least the input value (no calibration = no change)
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    // Must be capped at 1.0
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  it('caps confidence at 1.0 maximum', async () => {
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 6,
      wave_period_s: 16,
      wave_direction_deg: 290,
      confidence: 0.99, // Very high confidence
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });
});
```

**Step 2: Run the new tests**

Run: `yarn test:unit --testPathPattern="forecast-weighting-service.test" -v`
Expected: 4 tests pass

**Step 3: Commit**

```bash
git add __tests__/lib/services/forecast-weighting-service.test.ts
git commit -m "test: add regression tests for ForecastWeightingService confidence

These tests specifically guard against the confidence score bug where
70% confidence was incorrectly converted to 1% due to scale mismatch
between calculateConfidenceScore (0-100) and ForecastWeightingService (0-1).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add JSDoc Documentation

**Files:**
- Modify: `lib/services/forecast/confidence-scorer.ts` (top of file)
- Modify: `lib/services/forecast-weighting-service.ts` (top of file)

**Step 1: Update confidence-scorer.ts JSDoc**

Find the `calculateConfidenceScore` function and update its JSDoc:

```typescript
/**
 * Calculate confidence score for a forecast.
 *
 * @returns Confidence score on 0-100 scale (e.g., 70 means 70%)
 *
 * IMPORTANT: ForecastWeightingService uses 0-1 scale internally.
 * Conversion happens at the boundary in enhanced-forecast-service.ts:
 * - Before weighting: confidenceDecimal = confidence_score / 100
 * - After weighting: confidence_score = Math.round(confidence * 100)
 */
export function calculateConfidenceScore({
```

**Step 2: Update forecast-weighting-service.ts class JSDoc**

Update the class comment at the top:

```typescript
/**
 * Forecast Weighting Service
 *
 * Silently blends multiple data sources (NOAA, CDIP, expert predictions)
 * to improve forecast accuracy without exposing individual sources.
 *
 * CONFIDENCE SCALE: This service uses 0-1 scale internally.
 * - 0.7 means 70% confidence
 * - 1.0 means 100% confidence
 *
 * The rest of the codebase uses 0-100 scale. Conversion happens
 * at the boundary in enhanced-forecast-service.ts.
 *
 * This service uses expert predictions to calibrate and weight automated
 * model forecasts, improving accuracy for SoCal beaches.
 */
```

**Step 3: Commit**

```bash
git add lib/services/forecast/confidence-scorer.ts lib/services/forecast-weighting-service.ts
git commit -m "docs: add JSDoc explaining confidence score scale conventions

Documents the 0-100 vs 0-1 scale difference between calculateConfidenceScore
and ForecastWeightingService, and where boundary conversion happens.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update Architecture Documentation

**Files:**
- Modify: `lib/services/ARCHITECTURE.md`

**Step 1: Read the current file to find insertion point**

Look for a good location to add a new section (after existing service documentation).

**Step 2: Add Confidence Score Conventions section**

Add the following section:

```markdown
## Confidence Score Conventions

| System | Scale | Example |
|--------|-------|---------|
| `calculateConfidenceScore()` | 0-100 | 70 means 70% |
| `ForecastWeightingService` | 0-1 | 0.7 means 70% |
| Database `confidence_score` | 0-100 | Stored as integer |
| UI display | 0-100% | Shown with % suffix |

**Boundary conversion** happens in `enhanced-forecast-service.ts`:
- Before weighting: `confidenceDecimal = confidence_score / 100`
- After weighting: `confidence_score = Math.round(confidence * 100)`

**Defensive minimum:** `Math.max(original, blended)` ensures confidence never
decreases after expert calibration. A Sentry warning fires if this applies,
helping detect potential issues or inform future product decisions.
```

**Step 3: Commit**

```bash
git add lib/services/ARCHITECTURE.md
git commit -m "docs: add confidence score conventions to ARCHITECTURE.md

Documents the scale differences (0-100 vs 0-1) and where boundary
conversion happens. Also explains the defensive minimum behavior.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Final Verification

**Step 1: Run all forecast-related tests**

Run: `yarn test:unit --testPathPattern="forecast" --passWithNoTests`
Expected: All tests pass (including new regression tests)

**Step 2: Run TypeScript check**

Run: `yarn typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `yarn lint`
Expected: No errors

**Step 4: Create summary commit if any cleanup needed**

If all passes, the implementation is complete.

---

## Success Criteria

- [ ] Redundant `confidence: automatedForecast.confidence` line removed
- [ ] Sentry telemetry fires when defensive minimum applies
- [ ] 4 regression tests pass for `ForecastWeightingService.blendForecast()`
- [ ] JSDoc added to `confidence-scorer.ts` and `forecast-weighting-service.ts`
- [ ] ARCHITECTURE.md updated with confidence score conventions
- [ ] All existing tests still pass
- [ ] TypeScript and lint checks pass
