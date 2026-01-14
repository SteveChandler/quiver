# TypeScript ML Module Architecture

> Forecast text parsing utilities for the ML bias correction pipeline.

**Location:** `lib/ml/`
**Last Updated:** January 2026

## Overview

This module provides TypeScript utilities for parsing NOAA forecast text fields into numeric values suitable for ML model input. It bridges the gap between human-readable forecast text (e.g., "3-4ft") and the metric values required by the Python ML service.

## Directory Structure

```
lib/ml/
+-- parse-wave-height.ts    # Wave and wind parsing functions
+-- ARCHITECTURE.md         # This file

__tests__/lib/ml/
+-- parse-wave-height.test.ts   # Unit tests
```

## API Reference

### parseWaveHeight(text)

Converts NOAA wave height text to meters.

**Signature:**
```typescript
function parseWaveHeight(text: string | null | undefined): number | null
```

**Supported Formats:**

| Input | Output | Notes |
|-------|--------|-------|
| `"3-4ft"` | `1.07` | Range: midpoint in meters |
| `"3 to 4 ft"` | `1.07` | Alternative range format |
| `"3-4 ft plus"` | `1.07` | Ignores qualifiers |
| `"3ft"` | `0.91` | Single value |
| `"3 ft"` | `0.91` | Space-separated |
| `"Flat"` | `0.15` | Default flat value |
| `"flat"` | `0.15` | Case-insensitive |
| `null` | `0.15` | Defaults to flat |
| `""` | `0.15` | Empty string = flat |
| `"unknown"` | `null` | Unparseable |

**Algorithm:**
1. Check for null/empty/flat -> return 0.15m
2. Extract all numeric values from text
3. If 2 values: return midpoint in meters
4. If 1 value: return value in meters
5. Otherwise: return null

**Usage:**
```typescript
import { parseWaveHeight } from '@/lib/ml/parse-wave-height';

const heightM = parseWaveHeight('3-4ft');
// Returns: 1.07 (midpoint of 3.5ft converted to meters)

const flat = parseWaveHeight('Flat');
// Returns: 0.15
```

### parseWindSpeed(text)

Converts NOAA wind speed text to m/s.

**Signature:**
```typescript
function parseWindSpeed(text: string | null | undefined): number | null
```

**Supported Units:**

| Input | Output | Conversion |
|-------|--------|------------|
| `"10 mph"` | `4.47` | mph * 0.44704 |
| `"10 kts"` | `5.14` | knots * 0.514444 |
| `"10 knots"` | `5.14` | knots * 0.514444 |
| `"10"` | `10.0` | Assumed m/s |
| `null` | `null` | No value |

**Usage:**
```typescript
import { parseWindSpeed } from '@/lib/ml/parse-wave-height';

const windMS = parseWindSpeed('10 mph');
// Returns: 4.47

const windKnots = parseWindSpeed('15 kts');
// Returns: 7.72
```

## Constants

**File:** `parse-wave-height.ts`

```typescript
const FEET_TO_METERS = 0.3048;
const MPH_TO_MS = 0.44704;
const KTS_TO_MS = 0.514444;
```

## Integration with Cron Jobs

**Location:** `app/api/cron/ml/correct-forecasts/route.ts`

```typescript
import { parseWaveHeight, parseWindSpeed } from '@/lib/ml/parse-wave-height';

// Parse NOAA text fields before sending to ML service
const parsed = forecasts.map((f) => ({
  beach_id: f.beach_id,
  forecast_ts: `${f.forecast_date}T${f.forecast_time}`,
  wave_height_m: parseWaveHeight(f.wave_height),      // "3-4ft" -> 1.07
  wave_period_s: parseFloat(f.wave_period) || 10,
  wave_direction_deg: parseFloat(f.wave_direction) || 270,
  wind_speed_ms: parseWindSpeed(f.wind_speed),        // "10 mph" -> 4.47
  wind_direction_deg: parseFloat(f.wind_direction) || 270,
})).filter((f) => f.wave_height_m !== null);
```

## Testing

### Run Tests

```bash
yarn test __tests__/lib/ml/parse-wave-height.test.ts
```

### Test Coverage

**File:** `__tests__/lib/ml/parse-wave-height.test.ts`

| Test Case | Input | Expected |
|-----------|-------|----------|
| Range format | `"3-4ft"` | ~1.07m |
| Range with spaces | `"3 to 4 ft"` | ~1.07m |
| Single value | `"3ft"` | ~0.91m |
| Flat (uppercase) | `"Flat"` | 0.15m |
| Flat (lowercase) | `"flat"` | 0.15m |
| Null input | `null` | 0.15m |
| Empty string | `""` | 0.15m |
| Unparseable | `"unknown"` | `null` |
| MPH wind | `"10 mph"` | ~4.47 m/s |
| Null wind | `null` | `null` |

### Test File

```typescript
import { parseWaveHeight, parseWindSpeed } from '@/lib/ml/parse-wave-height';

describe('parseWaveHeight', () => {
  it('parses range format', () => {
    expect(parseWaveHeight('3-4ft')).toBeCloseTo(1.07, 1);
  });

  it('parses range with spaces', () => {
    expect(parseWaveHeight('3 to 4 ft')).toBeCloseTo(1.07, 1);
  });

  it('parses single value', () => {
    expect(parseWaveHeight('3ft')).toBeCloseTo(0.91, 1);
  });

  it('handles flat', () => {
    expect(parseWaveHeight('Flat')).toBe(0.15);
    expect(parseWaveHeight('flat')).toBe(0.15);
  });

  it('handles null/empty', () => {
    expect(parseWaveHeight(null)).toBe(0.15);
    expect(parseWaveHeight('')).toBe(0.15);
  });

  it('returns null for unparseable', () => {
    expect(parseWaveHeight('unknown')).toBeNull();
  });
});

describe('parseWindSpeed', () => {
  it('parses mph format', () => {
    expect(parseWindSpeed('10 mph')).toBeCloseTo(4.47, 1);
  });

  it('returns null for null input', () => {
    expect(parseWindSpeed(null)).toBeNull();
  });
});
```

## Design Decisions

### Why Midpoint for Ranges?

NOAA forecasts often use ranges like "3-4ft". Taking the midpoint:
- Provides a single value for ML input
- Represents the expected value of a uniform distribution
- Is more conservative than taking max

### Why 0.15m for Flat?

When NOAA reports "Flat" or null:
- 0.15m (~6 inches) represents minimal wave activity
- Prevents divide-by-zero in downstream calculations
- Provides a physically reasonable minimum

### Why Default to m/s for Wind?

Some NOAA sources provide wind speed without units:
- Defaulting to m/s is safest (no conversion)
- Most NOAA marine forecasts use knots, which are explicitly labeled

## Error Handling

The parsers are designed to be resilient:

| Scenario | Behavior |
|----------|----------|
| Null/undefined input | Returns default (0.15 for waves, null for wind) |
| Empty string | Returns default |
| Unparseable format | Returns null (filtered by cron job) |
| Unexpected units | Returns value as-is (assumed m/s) |

## Related Documentation

- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md)
- [Python ML Service](/ml/ARCHITECTURE.md)
- [Cron Jobs Architecture](/app/api/cron/ml/ARCHITECTURE.md)

---

**Last Updated:** January 2026
