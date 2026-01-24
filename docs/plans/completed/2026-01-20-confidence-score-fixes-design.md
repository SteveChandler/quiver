# Confidence Score Fixes Design

## Overview

Address code review findings from the confidence score bug fix. The root cause (scale mismatch between 0-100 and 0-1) has been identified and fixed. This design covers cleanup, telemetry, tests, and documentation.

## Background

### Original Bug
Beach detail pages displayed "1% confidence" even with CDIP + NOAA data sources. Root cause: `confidence_score=70` was passed directly to the weighting service (which expects 0-1 scale), resulting in `Math.min(1.0, 70.1) = 1.0`, displayed as "1%".

### Current State
The scale conversion fix is in place (`confidenceDecimal = confidence_score / 100`), but defensive code remains from when the root cause was unclear.

### Code Review Findings
1. Remove redundant explicit confidence assignment (line 85)
2. Add telemetry when Math.max() defensive minimum applies
3. Add unit tests for ForecastWeightingService.blendForecast()
4. Document confidence_score semantic meaning

## Design

### 1. Code Cleanup

**File:** `lib/services/forecast-weighting-service.ts`

Remove redundant defensive code at lines 83-90:

```typescript
// BEFORE
if (!calibration) {
  return {
    ...automatedForecast,
    confidence: automatedForecast.confidence,  // REMOVE
    blend_ratio: {
      automated: 1.0,
      expert: 0.0,
    },
  };
}

// AFTER
if (!calibration) {
  return {
    ...automatedForecast,
    blend_ratio: {
      automated: 1.0,
      expert: 0.0,
    },
  };
}
```

**Rationale:** The spread operator correctly copies `confidence`. This line was only needed when we thought spread wasn't working - the real bug was scale mismatch upstream.

### 2. Sentry Telemetry

**File:** `lib/services/enhanced-forecast-service.ts`

Add Sentry warning when defensive minimum kicks in:

```typescript
import * as Sentry from '@sentry/nextjs';

// In applyExpertWeighting, replace confidence_score assignment:
const originalConfidence = forecast.confidence_score ?? 70;
const blendedConfidence = Math.round(weightedForecast.confidence * 100);

if (blendedConfidence < originalConfidence) {
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
};
```

**Rationale:** With the scale mismatch fixed, this warning should be rare. If it fires frequently, it signals either a regression or a product decision needed about whether experts can lower confidence.

### 3. Regression-Focused Unit Tests

**File:** `__tests__/lib/services/forecast-weighting-service.test.ts` (new)

```typescript
import { ForecastWeightingService } from '@/lib/services/forecast-weighting-service';

describe('ForecastWeightingService.blendForecast - confidence regression', () => {
  it('preserves confidence when no calibration exists', async () => {
    const svc = new ForecastWeightingService();
    const automated = {
      confidence: 0.7,  // 70% in 0-1 scale
      wave_height_ft: 4,
      wave_period_s: 12,
      wave_direction_deg: 270,
    };

    const result = await svc.blendForecast(automated, 'Test Beach', new Date());

    expect(result.confidence).toBeCloseTo(0.7, 5);
    expect(result.blend_ratio).toEqual({ automated: 1.0, expert: 0.0 });
  });

  it('caps confidence at 1.0 maximum', async () => {
    // Mock calibration that would push confidence over 1.0
    const svc = new ForecastWeightingService();
    const automated = { confidence: 0.95 };

    const result = await svc.blendForecast(automated, 'Test Beach', new Date());

    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  it('REGRESSION: 0.7 input never produces ~0.01 output', async () => {
    // THE KEY REGRESSION TEST
    // Guards against the "70% becomes 1%" bug
    const svc = new ForecastWeightingService();
    const automated = { confidence: 0.7 };

    const result = await svc.blendForecast(automated, 'Test Beach', new Date());

    expect(result.confidence).toBeGreaterThan(0.1);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('REGRESSION: 0.85 CDIP confidence stays high', async () => {
    const svc = new ForecastWeightingService();
    const automated = { confidence: 0.85 };

    const result = await svc.blendForecast(automated, 'Test Beach', new Date());

    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });
});
```

**Test Strategy:**
- Mock `getExpertCalibration` to return null (no calibration path)
- Focus on confidence preservation, not all edge cases
- Explicit guards against the exact bug scenario

### 4. Documentation

**Part A: Inline JSDoc**

`lib/services/forecast/confidence-scorer.ts`:
```typescript
/**
 * Calculate confidence score for a forecast.
 *
 * @returns Confidence score on 0-100 scale (70 = 70% confidence)
 *
 * IMPORTANT: ForecastWeightingService uses 0-1 scale internally.
 * Conversion happens at the boundary in enhanced-forecast-service.ts.
 */
export function calculateConfidenceScore(...): number
```

`lib/services/forecast-weighting-service.ts`:
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
 */
```

**Part B: Architecture Doc**

Add to `lib/services/ARCHITECTURE.md`:

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
decreases after expert calibration. Sentry warning fires if this applies.
```

## Files Changed

| File | Change |
|------|--------|
| `lib/services/forecast-weighting-service.ts` | Remove redundant confidence assignment, add JSDoc |
| `lib/services/enhanced-forecast-service.ts` | Add Sentry telemetry for defensive minimum |
| `lib/services/forecast/confidence-scorer.ts` | Add JSDoc about scale convention |
| `lib/services/ARCHITECTURE.md` | Add "Confidence Score Conventions" section |
| `__tests__/lib/services/forecast-weighting-service.test.ts` | New regression tests |

## Success Criteria

- [ ] Redundant defensive code removed
- [ ] Sentry warning fires when defensive minimum applies (testable in staging)
- [ ] All regression tests pass
- [ ] Documentation clearly explains 0-100 vs 0-1 scale boundary
- [ ] No regression in confidence display (beaches still show correct %)

## Risk Assessment

**Low risk:**
- Removing redundant code: spread operator is standard JS behavior
- Adding telemetry: warning-level, no impact on functionality
- Adding tests: read-only verification
- Adding docs: no runtime impact

## Related Documents

- `docs/plans/completed/2026-01-20-confidence-score-investigation.md` - Root cause analysis
