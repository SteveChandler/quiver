# Quiver Codebase Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform poorly structured code into clean, maintainable code through systematic refactoring across 5 phases.

**Architecture:** Incremental refactoring using established patterns (API middleware, config extraction, service decomposition). Each phase delivers measurable improvements without breaking existing functionality. TDD approach where applicable.

**Tech Stack:** Next.js 14+, TypeScript, Supabase, React 18.3+

**Estimated Total Effort:** 16-24 weeks (can be executed incrementally)

---

## Table of Contents

1. [Phase 1: Quick Wins (1-2 weeks)](#phase-1-quick-wins)
2. [Phase 2: Middleware Consolidation (2-3 weeks)](#phase-2-middleware-consolidation)
3. [Phase 3: Service Extraction (3-4 weeks)](#phase-3-service-extraction)
4. [Phase 4: Component Refactoring (2-3 weeks)](#phase-4-component-refactoring)
5. [Phase 5: Infrastructure Improvements (4-6 weeks)](#phase-5-infrastructure-improvements)

---

## Phase 1: Quick Wins

**Duration:** 1-2 weeks
**Impact:** High value, low effort - immediate code clarity improvements

### Task 1.1: Create Discovery Configuration Constants

**Files:**
- Create: `lib/config/discovery-config.ts`
- Modify: `lib/services/surf-discovery-service.ts`
- Test: `__tests__/lib/config/discovery-config.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/config/discovery-config.test.ts
import {
  DISCOVERY_LIMITS,
  DISCOVERY_SCORING,
  DISCOVERY_TIMEOUTS,
} from '@/lib/config/discovery-config';

describe('discovery-config', () => {
  describe('DISCOVERY_LIMITS', () => {
    it('should have MAX_CANDIDATES defined as a positive number', () => {
      expect(DISCOVERY_LIMITS.MAX_CANDIDATES).toBeGreaterThan(0);
      expect(typeof DISCOVERY_LIMITS.MAX_CANDIDATES).toBe('number');
    });

    it('should have MAX_RESULTS defined as a positive number', () => {
      expect(DISCOVERY_LIMITS.MAX_RESULTS).toBeGreaterThan(0);
      expect(typeof DISCOVERY_LIMITS.MAX_RESULTS).toBe('number');
    });

    it('should have MAX_RESULTS <= MAX_CANDIDATES', () => {
      expect(DISCOVERY_LIMITS.MAX_RESULTS).toBeLessThanOrEqual(
        DISCOVERY_LIMITS.MAX_CANDIDATES
      );
    });
  });

  describe('DISCOVERY_SCORING', () => {
    it('should have scoring weights that sum to 1.0', () => {
      const sum =
        DISCOVERY_SCORING.CONDITIONS_WEIGHT +
        DISCOVERY_SCORING.CONFIDENCE_WEIGHT;
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('DISCOVERY_TIMEOUTS', () => {
    it('should have FORECAST_FETCH_MS as a positive number', () => {
      expect(DISCOVERY_TIMEOUTS.FORECAST_FETCH_MS).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/config/discovery-config.test.ts`
Expected: FAIL with "Cannot find module '@/lib/config/discovery-config'"

**Step 3: Write minimal implementation**

```typescript
// lib/config/discovery-config.ts
/**
 * Discovery Service Configuration
 *
 * Centralized configuration for the surf discovery service.
 * Extracted from hard-coded values to enable easy tuning and documentation.
 *
 * @see lib/services/surf-discovery-service.ts
 */

/**
 * Discovery result limits
 *
 * - MAX_CANDIDATES: Maximum beaches to consider in initial pool
 * - MAX_RESULTS: Maximum recommendations to return to client
 * - DEFAULT_RESULTS: Default number of results if not specified
 * - FORECAST_BATCH_SIZE: Beaches to fetch forecasts for in parallel
 */
export const DISCOVERY_LIMITS = {
  /** Maximum beaches to evaluate (controls DB query size) */
  MAX_CANDIDATES: 50,
  /** Maximum recommendations returned to client */
  MAX_RESULTS: 20,
  /** Default results when limit not specified */
  DEFAULT_RESULTS: 10,
  /** Parallel forecast fetch batch size */
  FORECAST_BATCH_SIZE: 20,
} as const;

/**
 * Scoring algorithm weights
 *
 * Composite score = (conditions * CONDITIONS_WEIGHT) + (confidence * CONFIDENCE_WEIGHT)
 */
export const DISCOVERY_SCORING = {
  /** Weight for conditions score (wave, wind, tide fit) */
  CONDITIONS_WEIGHT: 0.7,
  /** Weight for forecast confidence score */
  CONFIDENCE_WEIGHT: 0.3,
  /** Minimum score to include in results (0-100 scale) */
  MINIMUM_SCORE_THRESHOLD: 30,
} as const;

/**
 * Timeout configuration (milliseconds)
 */
export const DISCOVERY_TIMEOUTS = {
  /** Total timeout for discovery request */
  TOTAL_REQUEST_MS: 12000,
  /** Individual forecast fetch timeout */
  FORECAST_FETCH_MS: 8000,
  /** Database query timeout */
  DB_QUERY_MS: 5000,
} as const;

/**
 * Window selection configuration
 */
export const DISCOVERY_WINDOWS = {
  /** Hours in each forecast window */
  WINDOW_SIZE_HOURS: 3,
  /** Maximum hours ahead to look for windows */
  MAX_LOOKAHEAD_HOURS: 48,
  /** Prefer windows starting after this hour (24h format) */
  PREFERRED_START_HOUR: 6,
  /** Prefer windows ending before this hour (24h format) */
  PREFERRED_END_HOUR: 19,
} as const;

// Type exports for consumers
export type DiscoveryLimits = typeof DISCOVERY_LIMITS;
export type DiscoveryScoring = typeof DISCOVERY_SCORING;
export type DiscoveryTimeouts = typeof DISCOVERY_TIMEOUTS;
export type DiscoveryWindows = typeof DISCOVERY_WINDOWS;
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/config/discovery-config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/config/discovery-config.ts __tests__/lib/config/discovery-config.test.ts
git commit -m "$(cat <<'EOF'
feat(config): extract discovery service configuration constants

- Add DISCOVERY_LIMITS for candidate/result limits
- Add DISCOVERY_SCORING for algorithm weights
- Add DISCOVERY_TIMEOUTS for request timeouts
- Add DISCOVERY_WINDOWS for time window config
- Include comprehensive tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Create UI Display Configuration

**Files:**
- Create: `lib/config/ui-config.ts`
- Test: `__tests__/lib/config/ui-config.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/config/ui-config.test.ts
import { UI_LIMITS, CARD_DISPLAY } from '@/lib/config/ui-config';

describe('ui-config', () => {
  describe('UI_LIMITS', () => {
    it('should have PREVIEW_ITEMS defined', () => {
      expect(UI_LIMITS.PREVIEW_ITEMS).toBeGreaterThan(0);
    });

    it('should have CAROUSEL_ITEMS defined', () => {
      expect(UI_LIMITS.CAROUSEL_ITEMS).toBeGreaterThan(0);
    });

    it('should have TOP_SPOTS_DISPLAY defined', () => {
      expect(UI_LIMITS.TOP_SPOTS_DISPLAY).toBeGreaterThan(0);
    });
  });

  describe('CARD_DISPLAY', () => {
    it('should have BADGES_MAX defined', () => {
      expect(CARD_DISPLAY.BADGES_MAX).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/config/ui-config.test.ts`
Expected: FAIL with "Cannot find module '@/lib/config/ui-config'"

**Step 3: Write minimal implementation**

```typescript
// lib/config/ui-config.ts
/**
 * UI Display Configuration
 *
 * Centralized configuration for UI display limits and defaults.
 * Extracted from hard-coded .slice() calls throughout components.
 *
 * @example
 * // Before: topSpots.slice(0, 3)
 * // After: topSpots.slice(0, UI_LIMITS.TOP_SPOTS_DISPLAY)
 */

/**
 * List/collection display limits
 */
export const UI_LIMITS = {
  /** Preview items in collapsed views */
  PREVIEW_ITEMS: 3,
  /** Items in horizontal carousels */
  CAROUSEL_ITEMS: 5,
  /** Top spots shown on coach card */
  TOP_SPOTS_DISPLAY: 3,
  /** Beaches shown in search results */
  SEARCH_RESULTS: 10,
  /** Recent sessions on dashboard */
  RECENT_SESSIONS: 5,
  /** Intel posts per page */
  INTEL_PAGE_SIZE: 10,
  /** Photos in gallery preview */
  GALLERY_PREVIEW: 6,
} as const;

/**
 * Card component display settings
 */
export const CARD_DISPLAY = {
  /** Maximum condition badges shown */
  BADGES_MAX: 3,
  /** Maximum tags on intel posts */
  INTEL_TAGS_MAX: 3,
  /** Truncate description after N chars */
  DESCRIPTION_TRUNCATE: 150,
  /** Truncate title after N chars */
  TITLE_TRUNCATE: 50,
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  /** Default page size for paginated lists */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 100,
  /** Pages to show in pagination controls */
  VISIBLE_PAGES: 5,
} as const;

// Type exports
export type UILimits = typeof UI_LIMITS;
export type CardDisplay = typeof CARD_DISPLAY;
export type PaginationConfig = typeof PAGINATION;
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/config/ui-config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/config/ui-config.ts __tests__/lib/config/ui-config.test.ts
git commit -m "$(cat <<'EOF'
feat(config): extract UI display configuration constants

- Add UI_LIMITS for list/collection sizes
- Add CARD_DISPLAY for card component settings
- Add PAGINATION for pagination defaults
- Replace magic numbers like .slice(0, 3) with named constants

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Create Number Parsing Utilities

**Files:**
- Create: `lib/utils/number-parsing.ts`
- Test: `__tests__/lib/utils/number-parsing.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/utils/number-parsing.test.ts
import {
  parseFloatSafe,
  parseIntSafe,
  parseCoordinate,
  parseWaveHeight,
  parseWindSpeed,
} from '@/lib/utils/number-parsing';

describe('number-parsing', () => {
  describe('parseFloatSafe', () => {
    it('should parse valid float strings', () => {
      expect(parseFloatSafe('3.14', 0)).toBe(3.14);
      expect(parseFloatSafe('42', 0)).toBe(42);
      expect(parseFloatSafe('-1.5', 0)).toBe(-1.5);
    });

    it('should return fallback for invalid inputs', () => {
      expect(parseFloatSafe('abc', 0)).toBe(0);
      expect(parseFloatSafe('', 5)).toBe(5);
      expect(parseFloatSafe(null, 10)).toBe(10);
      expect(parseFloatSafe(undefined, 10)).toBe(10);
      expect(parseFloatSafe(NaN, 0)).toBe(0);
    });

    it('should handle number inputs', () => {
      expect(parseFloatSafe(3.14, 0)).toBe(3.14);
      expect(parseFloatSafe(42, 0)).toBe(42);
    });
  });

  describe('parseIntSafe', () => {
    it('should parse valid integer strings', () => {
      expect(parseIntSafe('42', 0)).toBe(42);
      expect(parseIntSafe('-10', 0)).toBe(-10);
    });

    it('should truncate floats', () => {
      expect(parseIntSafe('3.7', 0)).toBe(3);
      expect(parseIntSafe('3.2', 0)).toBe(3);
    });

    it('should return fallback for invalid inputs', () => {
      expect(parseIntSafe('abc', 0)).toBe(0);
      expect(parseIntSafe(null, 5)).toBe(5);
    });
  });

  describe('parseCoordinate', () => {
    it('should parse valid coordinates', () => {
      expect(parseCoordinate('33.7701')).toBe(33.7701);
      expect(parseCoordinate('-118.1937')).toBe(-118.1937);
    });

    it('should return null for invalid coordinates', () => {
      expect(parseCoordinate('abc')).toBeNull();
      expect(parseCoordinate('')).toBeNull();
      expect(parseCoordinate(null)).toBeNull();
    });

    it('should reject out-of-range coordinates', () => {
      expect(parseCoordinate('91')).toBeNull(); // lat > 90
      expect(parseCoordinate('-181')).toBeNull(); // lon < -180
    });
  });

  describe('parseWaveHeight', () => {
    it('should parse wave height strings with units', () => {
      expect(parseWaveHeight('3-5 ft')).toEqual({ min: 3, max: 5 });
      expect(parseWaveHeight('4ft')).toEqual({ min: 4, max: 4 });
      expect(parseWaveHeight('2-3')).toEqual({ min: 2, max: 3 });
    });

    it('should return null for invalid formats', () => {
      expect(parseWaveHeight('flat')).toBeNull();
      expect(parseWaveHeight('')).toBeNull();
    });
  });

  describe('parseWindSpeed', () => {
    it('should parse wind speed strings', () => {
      expect(parseWindSpeed('10 mph')).toBe(10);
      expect(parseWindSpeed('15mph')).toBe(15);
      expect(parseWindSpeed('8')).toBe(8);
    });

    it('should return fallback for invalid inputs', () => {
      expect(parseWindSpeed('calm', 0)).toBe(0);
      expect(parseWindSpeed('', 5)).toBe(5);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/utils/number-parsing.test.ts`
Expected: FAIL with "Cannot find module '@/lib/utils/number-parsing'"

**Step 3: Write minimal implementation**

```typescript
// lib/utils/number-parsing.ts
/**
 * Safe Number Parsing Utilities
 *
 * Provides consistent, safe parsing of numbers from various inputs.
 * Eliminates scattered parseFloat/parseInt calls with inconsistent NaN handling.
 *
 * @example
 * // Before: parseFloat(String(forecast.wind_speed ?? '0'))
 * // After: parseFloatSafe(forecast.wind_speed, 0)
 */

/**
 * Safely parse a float value with fallback
 *
 * @param value - Value to parse (string, number, null, undefined)
 * @param fallback - Value to return if parsing fails
 * @returns Parsed float or fallback
 */
export function parseFloatSafe(value: unknown, fallback: number): number {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : value;
  }

  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parse an integer value with fallback
 *
 * @param value - Value to parse
 * @param fallback - Value to return if parsing fails
 * @param radix - Radix for parseInt (default 10)
 * @returns Parsed integer or fallback
 */
export function parseIntSafe(
  value: unknown,
  fallback: number,
  radix: number = 10
): number {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : Math.trunc(value);
  }

  const parsed = parseInt(String(value), radix);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse a coordinate value with validation
 *
 * Returns null if the value is not a valid coordinate.
 * Validates range: latitude (-90 to 90), longitude (-180 to 180)
 *
 * @param value - Value to parse
 * @param type - Optional type for range validation ('lat' or 'lon')
 * @returns Parsed coordinate or null
 */
export function parseCoordinate(
  value: unknown,
  type?: 'lat' | 'lon'
): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = parseFloat(String(value));

  if (Number.isNaN(parsed)) {
    return null;
  }

  // Validate range based on type
  if (type === 'lat' && (parsed < -90 || parsed > 90)) {
    return null;
  }

  if (type === 'lon' && (parsed < -180 || parsed > 180)) {
    return null;
  }

  // If no type specified, check if it's within any valid range
  if (!type && (parsed < -180 || parsed > 180)) {
    return null;
  }

  return parsed;
}

/**
 * Parse wave height string (e.g., "3-5 ft", "4ft", "2-3")
 *
 * @param value - Wave height string
 * @returns Object with min/max or null if invalid
 */
export function parseWaveHeight(
  value: unknown
): { min: number; max: number } | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  // Remove units and extra spaces
  const cleaned = value.replace(/\s*(ft|feet|m|meters?)\s*/gi, '').trim();

  // Try range format: "3-5"
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return { min, max };
    }
  }

  // Try single value: "4"
  const singleMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    if (!Number.isNaN(val)) {
      return { min: val, max: val };
    }
  }

  return null;
}

/**
 * Parse wind speed string (e.g., "10 mph", "15mph", "8")
 *
 * @param value - Wind speed string
 * @param fallback - Value to return if parsing fails (default 0)
 * @returns Parsed wind speed or fallback
 */
export function parseWindSpeed(value: unknown, fallback: number = 0): number {
  if (!value) {
    return fallback;
  }

  const str = String(value);

  // Remove units
  const cleaned = str.replace(/\s*(mph|kph|knots?|kts?|m\/s)\s*/gi, '').trim();

  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse wave period string (e.g., "12s", "8 seconds", "10")
 *
 * @param value - Wave period string
 * @param fallback - Value to return if parsing fails (default 0)
 * @returns Parsed period in seconds or fallback
 */
export function parseWavePeriod(value: unknown, fallback: number = 0): number {
  if (!value) {
    return fallback;
  }

  const str = String(value);
  const cleaned = str.replace(/\s*(s|sec|seconds?)\s*/gi, '').trim();

  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? fallback : parsed;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/utils/number-parsing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/number-parsing.ts __tests__/lib/utils/number-parsing.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): add safe number parsing utilities

- Add parseFloatSafe/parseIntSafe with fallback support
- Add parseCoordinate with range validation
- Add parseWaveHeight for range parsing (e.g., "3-5 ft")
- Add parseWindSpeed for speed string parsing
- Add parseWavePeriod for period string parsing
- Comprehensive test coverage

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Create Time Parsing Utilities

**Files:**
- Create: `lib/utils/time-parsing.ts`
- Test: `__tests__/lib/utils/time-parsing.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/utils/time-parsing.test.ts
import {
  parseTimeToHour,
  toTimeString,
  formatTimeRange,
  isWithinTimeRange,
} from '@/lib/utils/time-parsing';

describe('time-parsing', () => {
  describe('parseTimeToHour', () => {
    it('should parse 24-hour format', () => {
      expect(parseTimeToHour('14:30')).toBe(14.5);
      expect(parseTimeToHour('08:00')).toBe(8);
      expect(parseTimeToHour('23:45')).toBe(23.75);
    });

    it('should parse 12-hour format', () => {
      expect(parseTimeToHour('2:30 PM')).toBe(14.5);
      expect(parseTimeToHour('8:00 AM')).toBe(8);
      expect(parseTimeToHour('12:00 PM')).toBe(12);
      expect(parseTimeToHour('12:00 AM')).toBe(0);
    });

    it('should return null for invalid formats', () => {
      expect(parseTimeToHour('invalid')).toBeNull();
      expect(parseTimeToHour('')).toBeNull();
      expect(parseTimeToHour('25:00')).toBeNull();
    });
  });

  describe('toTimeString', () => {
    it('should format hours to 12-hour string', () => {
      expect(toTimeString(14.5)).toBe('2:30 PM');
      expect(toTimeString(8)).toBe('8:00 AM');
      expect(toTimeString(0)).toBe('12:00 AM');
      expect(toTimeString(12)).toBe('12:00 PM');
    });

    it('should format to 24-hour when specified', () => {
      expect(toTimeString(14.5, { format24: true })).toBe('14:30');
      expect(toTimeString(8, { format24: true })).toBe('08:00');
    });
  });

  describe('formatTimeRange', () => {
    it('should format time ranges', () => {
      expect(formatTimeRange(6, 9)).toBe('6:00 AM - 9:00 AM');
      expect(formatTimeRange(14, 17)).toBe('2:00 PM - 5:00 PM');
    });
  });

  describe('isWithinTimeRange', () => {
    it('should check if hour is within range', () => {
      expect(isWithinTimeRange(7, 6, 9)).toBe(true);
      expect(isWithinTimeRange(5, 6, 9)).toBe(false);
      expect(isWithinTimeRange(10, 6, 9)).toBe(false);
    });

    it('should handle ranges crossing midnight', () => {
      expect(isWithinTimeRange(23, 22, 2)).toBe(true);
      expect(isWithinTimeRange(1, 22, 2)).toBe(true);
      expect(isWithinTimeRange(12, 22, 2)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/utils/time-parsing.test.ts`
Expected: FAIL with "Cannot find module '@/lib/utils/time-parsing'"

**Step 3: Write minimal implementation**

```typescript
// lib/utils/time-parsing.ts
/**
 * Time Parsing and Formatting Utilities
 *
 * Consolidates time parsing logic scattered across the codebase.
 * Supports 12-hour and 24-hour formats consistently.
 *
 * @example
 * // Parse various formats to decimal hours
 * parseTimeToHour('2:30 PM') // 14.5
 * parseTimeToHour('14:30')   // 14.5
 *
 * // Format back to string
 * toTimeString(14.5) // '2:30 PM'
 */

/**
 * Parse time string to decimal hours (0-24)
 *
 * @param timeStr - Time string in various formats
 * @returns Decimal hours (e.g., 14.5 for 2:30 PM) or null if invalid
 *
 * Supported formats:
 * - "14:30" (24-hour)
 * - "2:30 PM" (12-hour)
 * - "2:30PM" (12-hour, no space)
 * - "2 PM" (hour only)
 */
export function parseTimeToHour(timeStr: unknown): number | null {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  const cleaned = timeStr.trim().toUpperCase();

  // Try 24-hour format: "14:30" or "08:00"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours + minutes / 60;
  }

  // Try 12-hour format: "2:30 PM", "2:30PM", "2 PM"
  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const isPM = match12[3] === 'PM';

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    // Convert to 24-hour
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }

    return hours + minutes / 60;
  }

  return null;
}

/**
 * Format options for toTimeString
 */
export interface TimeStringOptions {
  /** Use 24-hour format instead of 12-hour */
  format24?: boolean;
  /** Include seconds */
  includeSeconds?: boolean;
}

/**
 * Convert decimal hours to time string
 *
 * @param hours - Decimal hours (e.g., 14.5 for 2:30 PM)
 * @param options - Formatting options
 * @returns Formatted time string
 */
export function toTimeString(
  hours: number,
  options: TimeStringOptions = {}
): string {
  const { format24 = false, includeSeconds = false } = options;

  // Normalize to 0-24 range
  const normalizedHours = ((hours % 24) + 24) % 24;

  const h = Math.floor(normalizedHours);
  const m = Math.round((normalizedHours - h) * 60);

  if (format24) {
    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    return includeSeconds ? `${hStr}:${mStr}:00` : `${hStr}:${mStr}`;
  }

  // 12-hour format
  const isPM = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  const mStr = m.toString().padStart(2, '0');
  const period = isPM ? 'PM' : 'AM';

  return `${h12}:${mStr} ${period}`;
}

/**
 * Format a time range as a human-readable string
 *
 * @param startHour - Start time in decimal hours
 * @param endHour - End time in decimal hours
 * @param options - Formatting options
 * @returns Formatted range string (e.g., "6:00 AM - 9:00 AM")
 */
export function formatTimeRange(
  startHour: number,
  endHour: number,
  options: TimeStringOptions = {}
): string {
  const startStr = toTimeString(startHour, options);
  const endStr = toTimeString(endHour, options);
  return `${startStr} - ${endStr}`;
}

/**
 * Check if a time is within a range (handles midnight crossing)
 *
 * @param hour - Hour to check (decimal)
 * @param rangeStart - Range start (decimal hours)
 * @param rangeEnd - Range end (decimal hours)
 * @returns True if hour is within range
 */
export function isWithinTimeRange(
  hour: number,
  rangeStart: number,
  rangeEnd: number
): boolean {
  // Normalize all to 0-24
  const h = ((hour % 24) + 24) % 24;
  const start = ((rangeStart % 24) + 24) % 24;
  const end = ((rangeEnd % 24) + 24) % 24;

  if (start <= end) {
    // Normal range (e.g., 6-18)
    return h >= start && h < end;
  } else {
    // Range crosses midnight (e.g., 22-2)
    return h >= start || h < end;
  }
}

/**
 * Get the hour component from a Date or ISO string
 *
 * @param date - Date object or ISO string
 * @returns Hour in local time (0-23) or null if invalid
 */
export function getHourFromDate(date: Date | string | null | undefined): number | null {
  if (!date) return null;

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    return d.getHours();
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/utils/time-parsing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/utils/time-parsing.ts __tests__/lib/utils/time-parsing.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): add time parsing and formatting utilities

- Add parseTimeToHour for 12/24-hour format parsing
- Add toTimeString for formatting decimal hours
- Add formatTimeRange for human-readable ranges
- Add isWithinTimeRange with midnight-crossing support
- Add getHourFromDate helper

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Document Service Patterns in Architecture

**Files:**
- Modify: `lib/services/ARCHITECTURE.md`

**Step 1: Read current architecture doc**

Read: `lib/services/ARCHITECTURE.md` (first 100 lines to understand current format)

**Step 2: Add service pattern documentation**

Append the following section to the architecture doc:

```markdown
## Service Implementation Patterns

### When to Use Classes vs Functions

**Use Classes for:**
- External API clients with connection pooling (e.g., `CDIPService`, `NOAACOOPSService`)
- Services requiring shared state or configuration
- Services with lifecycle methods (initialize, cleanup)
- Services that benefit from dependency injection

**Use Functions for:**
- Stateless business logic and orchestration
- Pure data transformations
- Services that don't need shared resources
- Simple operations without complex state

### Pattern Examples

**Class-based Service (External API Client):**
```typescript
// lib/services/external/weather-api-service.ts
export class WeatherAPIService {
  private readonly httpClient: HttpClient;
  private readonly cache: Cache;

  constructor(config: WeatherAPIConfig) {
    this.httpClient = new HttpClient(config.baseUrl);
    this.cache = new Cache(config.cacheTTL);
  }

  async getConditions(lat: number, lon: number): Promise<Conditions> {
    const cacheKey = `conditions:${lat}:${lon}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.httpClient.get('/conditions', { lat, lon });
    this.cache.set(cacheKey, data);
    return data;
  }
}
```

**Function-based Service (Business Logic):**
```typescript
// lib/services/scoring/beach-scorer.ts
export function scoreBeach(
  beach: Beach,
  forecast: Forecast,
  preferences: UserPreferences
): BeachScore {
  const waveScore = calculateWaveScore(forecast, preferences);
  const windScore = calculateWindScore(forecast, beach);
  const tideScore = calculateTideScore(forecast, beach);

  return {
    total: waveScore * 0.4 + windScore * 0.3 + tideScore * 0.3,
    components: { waveScore, windScore, tideScore },
  };
}
```

### Directory Organization

```
lib/services/
├── external/           # Third-party API clients (class-based)
│   ├── cdip-service.ts
│   └── noaa-service.ts
├── domain/             # Business logic (function-based)
│   ├── scoring/
│   └── discovery/
├── orchestration/      # Coordinate multiple services
│   └── surf-discovery-orchestrator.ts
└── ARCHITECTURE.md
```
```

**Step 3: Commit**

```bash
git add lib/services/ARCHITECTURE.md
git commit -m "$(cat <<'EOF'
docs(services): document class vs function service patterns

- Add guidelines for when to use classes vs functions
- Include code examples for each pattern
- Document recommended directory organization

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.6: Create Config Index File

**Files:**
- Create: `lib/config/index.ts`

**Step 1: Create barrel export**

```typescript
// lib/config/index.ts
/**
 * Configuration Constants Index
 *
 * Central export for all configuration modules.
 * Import from here instead of individual files.
 *
 * @example
 * import { DISCOVERY_LIMITS, UI_LIMITS } from '@/lib/config';
 */

export * from './discovery-config';
export * from './ui-config';
export * from './forecast-staleness';
```

**Step 2: Commit**

```bash
git add lib/config/index.ts
git commit -m "$(cat <<'EOF'
feat(config): add barrel export for configuration modules

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Middleware Consolidation

**Duration:** 2-3 weeks
**Impact:** Eliminate ~5,000 lines of boilerplate, consistent error handling

### Task 2.1: Create Server Action Middleware

**Files:**
- Modify: `lib/server-action-utils.ts`
- Test: `__tests__/lib/server-action-utils.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/server-action-utils.test.ts
import {
  withValidation,
  withRateLimitedAction,
  createServerAction,
} from '@/lib/server-action-utils';
import { z } from 'zod';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
    },
  }),
}));

describe('server-action-utils', () => {
  describe('withValidation', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it('should validate input and call action with parsed data', async () => {
      const action = jest.fn().mockResolvedValue({ id: 1 });
      const validated = withValidation(schema, action);

      const result = await validated({ name: 'John', age: 25 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1 });
      expect(action).toHaveBeenCalledWith({ name: 'John', age: 25 });
    });

    it('should return validation error for invalid input', async () => {
      const action = jest.fn();
      const validated = withValidation(schema, action);

      const result = await validated({ name: '', age: -5 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('createServerAction', () => {
    it('should create authenticated action with validation', async () => {
      const schema = z.object({ message: z.string() });
      const handler = jest.fn().mockResolvedValue({ sent: true });

      const action = createServerAction({
        schema,
        auth: true,
        handler: async ({ input, user }) => handler(input, user),
      });

      const result = await action({ message: 'Hello' });

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/server-action-utils.test.ts`
Expected: FAIL (new functions don't exist)

**Step 3: Add new functions to server-action-utils.ts**

Add the following to `lib/server-action-utils.ts`:

```typescript
import { z } from 'zod';

// ... existing code ...

/**
 * Validation wrapper for server actions
 *
 * Validates input against a Zod schema before calling the action.
 *
 * @param schema - Zod schema for input validation
 * @param action - Action to call with validated input
 * @returns Wrapped action with validation
 *
 * @example
 * const schema = z.object({ name: z.string() });
 * const createItem = withValidation(schema, async (data) => {
 *   return db.items.create(data);
 * });
 */
export function withValidation<TInput, TOutput>(
  schema: z.ZodType<TInput>,
  action: (input: TInput) => Promise<TOutput>
): (input: unknown) => Promise<ServerActionResponse<TOutput>> {
  return async (input: unknown) => {
    const parsed = schema.safeParse(input);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(', ');
      return {
        success: false,
        error: `Validation failed: ${errors}`,
      };
    }

    return withServerAction(() => action(parsed.data));
  };
}

/**
 * Options for createServerAction
 */
export interface CreateServerActionOptions<TInput, TOutput> {
  /** Zod schema for input validation */
  schema?: z.ZodType<TInput>;
  /** Require authentication */
  auth?: boolean;
  /** Action handler */
  handler: (context: {
    input: TInput;
    user: User | null;
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  }) => Promise<TOutput>;
}

/**
 * Create a server action with configurable auth and validation
 *
 * Combines validation, authentication, and error handling in one wrapper.
 *
 * @param options - Action configuration
 * @returns Configured server action
 *
 * @example
 * const createPost = createServerAction({
 *   schema: z.object({ title: z.string(), content: z.string() }),
 *   auth: true,
 *   handler: async ({ input, user, supabase }) => {
 *     const { data } = await supabase
 *       .from('posts')
 *       .insert({ ...input, user_id: user.id })
 *       .select()
 *       .single();
 *     return data;
 *   },
 * });
 */
export function createServerAction<TInput, TOutput>(
  options: CreateServerActionOptions<TInput, TOutput>
): (input: TInput) => Promise<ServerActionResponse<TOutput>> {
  const { schema, auth = false, handler } = options;

  return async (input: TInput) => {
    // Validate input if schema provided
    if (schema) {
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        const errors = parsed.error.errors.map((e) => e.message).join(', ');
        return {
          success: false,
          error: `Validation failed: ${errors}`,
        };
      }
      input = parsed.data;
    }

    return withServerAction(async () => {
      const supabase = await createSupabaseServerClient();

      let user: User | null = null;

      if (auth) {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (error || !authUser) {
          throw new Error('Authentication required');
        }

        user = authUser;
      }

      return handler({ input, user, supabase });
    });
  };
}

/**
 * Rate-limited server action wrapper
 *
 * Applies rate limiting before executing the action.
 * Uses the same rate limiting infrastructure as API routes.
 *
 * @param key - Rate limit key from rate-limit-config
 * @param action - Action to rate limit
 * @returns Rate-limited action
 */
export function withRateLimitedAction<TInput, TOutput>(
  key: string,
  action: (input: TInput) => Promise<ServerActionResponse<TOutput>>
): (input: TInput) => Promise<ServerActionResponse<TOutput>> {
  // Note: Server actions run server-side, so we need to get identifier differently
  // This is a simplified version - full implementation would use headers
  return async (input: TInput) => {
    // For now, delegate to the action
    // Full rate limiting would check cache/Redis here
    return action(input);
  };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/server-action-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/server-action-utils.ts __tests__/lib/server-action-utils.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): add validation and factory for server actions

- Add withValidation for Zod schema validation
- Add createServerAction factory for auth + validation
- Add withRateLimitedAction placeholder for rate limiting
- Include comprehensive tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Migrate High-Traffic API Routes to Middleware

**Files:**
- Modify: `app/api/discovery/route.ts`
- Modify: `app/api/beaches/[id]/route.ts`
- Modify: `app/api/forecast/[beachId]/route.ts`

**Step 1: Identify current pattern in discovery route**

Read: `app/api/discovery/route.ts` (first 50 lines)

**Step 2: Refactor to use withProtection**

Replace manual try-catch and auth handling with:

```typescript
// app/api/discovery/route.ts
import {
  withProtection,
  createSuccessResponse,
  validateRequiredParams,
} from '@/lib/middleware/api-wrappers';

export const GET = withProtection(
  async (request, { user, supabase }) => {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    const error = validateRequiredParams({ lat, lon }, ['lat', 'lon']);
    if (error) return error;

    // ... existing business logic ...

    return createSuccessResponse(results);
  },
  {
    auth: { required: false }, // Optional auth for personalization
    rateLimit: { key: 'public-default' },
    botBlocking: { enabled: true },
  }
);
```

**Step 3: Test the refactored route**

Run: `yarn test:e2e --grep "discovery"`

**Step 4: Commit**

```bash
git add app/api/discovery/route.ts
git commit -m "$(cat <<'EOF'
refactor(api): migrate discovery route to middleware pattern

- Replace manual try-catch with withProtection
- Add rate limiting and bot blocking
- Reduce boilerplate by ~25 lines

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Step 5: Repeat for beaches and forecast routes**

Apply the same pattern to:
- `app/api/beaches/[id]/route.ts`
- `app/api/forecast/[beachId]/route.ts`

Commit each separately with descriptive messages.

---

### Task 2.3: Create Migration Tracking Script

**Files:**
- Create: `scripts/middleware-migration-tracker.ts`

**Step 1: Create tracking script**

```typescript
// scripts/middleware-migration-tracker.ts
/**
 * Middleware Migration Tracker
 *
 * Scans API routes and server actions to track migration progress
 * from manual error handling to middleware patterns.
 *
 * Usage: npx ts-node scripts/middleware-migration-tracker.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface MigrationStatus {
  file: string;
  status: 'migrated' | 'partial' | 'legacy';
  patterns: string[];
}

async function analyzeFile(filePath: string): Promise<MigrationStatus> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const patterns: string[] = [];

  // Check for new patterns
  if (content.includes('withProtection(') || content.includes('withAuth(')) {
    patterns.push('middleware');
  }
  if (content.includes('createApiHandler(')) {
    patterns.push('apiHandler');
  }

  // Check for legacy patterns
  if (content.includes('try {') && content.includes('catch (')) {
    patterns.push('try-catch');
  }
  if (content.includes('createSupabaseServerClient()') &&
      !content.includes('withAuth') &&
      !content.includes('withProtection')) {
    patterns.push('manual-supabase');
  }

  // Determine status
  let status: 'migrated' | 'partial' | 'legacy';
  if (patterns.includes('middleware') || patterns.includes('apiHandler')) {
    status = patterns.includes('try-catch') ? 'partial' : 'migrated';
  } else {
    status = 'legacy';
  }

  return {
    file: filePath,
    status,
    patterns,
  };
}

async function main() {
  const apiRoutes = await glob('app/api/**/route.ts');
  const serverActions = await glob('actions/**/*.ts');

  console.log('=== API Route Migration Status ===\n');

  const apiResults = await Promise.all(apiRoutes.map(analyzeFile));
  const apiMigrated = apiResults.filter(r => r.status === 'migrated').length;
  const apiPartial = apiResults.filter(r => r.status === 'partial').length;
  const apiLegacy = apiResults.filter(r => r.status === 'legacy').length;

  console.log(`Migrated: ${apiMigrated}/${apiResults.length}`);
  console.log(`Partial:  ${apiPartial}/${apiResults.length}`);
  console.log(`Legacy:   ${apiLegacy}/${apiResults.length}`);
  console.log(`\nProgress: ${Math.round((apiMigrated / apiResults.length) * 100)}%\n`);

  console.log('Legacy routes to migrate:');
  apiResults
    .filter(r => r.status === 'legacy')
    .slice(0, 10)
    .forEach(r => console.log(`  - ${r.file}`));

  console.log('\n=== Server Action Migration Status ===\n');

  const actionResults = await Promise.all(serverActions.map(analyzeFile));
  const actionMigrated = actionResults.filter(r => r.status === 'migrated').length;
  const actionLegacy = actionResults.filter(r => r.status === 'legacy').length;

  console.log(`Migrated: ${actionMigrated}/${actionResults.length}`);
  console.log(`Legacy:   ${actionLegacy}/${actionResults.length}`);
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add scripts/middleware-migration-tracker.ts
git commit -m "$(cat <<'EOF'
feat(scripts): add middleware migration tracking script

- Scans API routes and server actions
- Reports migration progress percentage
- Lists legacy files needing migration

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.4-2.10: Continue API Route Migration

Follow the same pattern from Task 2.2 to migrate remaining high-traffic routes:

1. Read current implementation
2. Refactor to use `withProtection` or `withAuth`
3. Test the route
4. Commit with descriptive message

**Priority order for migration:**
1. `app/api/intel/route.ts` (high traffic)
2. `app/api/sessions/route.ts` (authenticated)
3. `app/api/profile/route.ts` (authenticated)
4. `app/api/boards/route.ts` (authenticated)
5. `app/api/check-in/route.ts` (authenticated)
6. `app/api/search/route.ts` (public)
7. `app/api/beaches/route.ts` (public)

---

## Phase 3: Service Extraction

**Duration:** 3-4 weeks
**Impact:** Better testability, clearer separation of concerns

### Task 3.1: Extract Discovery Candidate Pool Builder

**Files:**
- Create: `lib/services/discovery/candidate-pool-builder.ts`
- Create: `__tests__/lib/services/discovery/candidate-pool-builder.test.ts`
- Modify: `lib/services/surf-discovery-service.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/services/discovery/candidate-pool-builder.test.ts
import { buildCandidatePool, CandidatePoolOptions } from '@/lib/services/discovery/candidate-pool-builder';

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({
    data: [
      { id: 'beach-1', name: 'Venice Beach', center_lat: 33.98, center_lng: -118.47 },
      { id: 'beach-2', name: 'Santa Monica', center_lat: 34.01, center_lng: -118.49 },
    ],
    error: null,
  }),
};

describe('candidate-pool-builder', () => {
  describe('buildCandidatePool', () => {
    it('should return beaches within specified limit', async () => {
      const options: CandidatePoolOptions = {
        supabase: mockSupabase as any,
        userLat: 34.0,
        userLon: -118.5,
        limit: 20,
      };

      const candidates = await buildCandidatePool(options);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].name).toBe('Venice Beach');
    });

    it('should filter by region if specified', async () => {
      const options: CandidatePoolOptions = {
        supabase: mockSupabase as any,
        userLat: 34.0,
        userLon: -118.5,
        limit: 20,
        regionSlug: 'los-angeles',
      };

      await buildCandidatePool(options);

      expect(mockSupabase.eq).toHaveBeenCalledWith('region_slug', 'los-angeles');
    });

    it('should include photo data when requested', async () => {
      const options: CandidatePoolOptions = {
        supabase: mockSupabase as any,
        userLat: 34.0,
        userLon: -118.5,
        limit: 20,
        includePhotos: true,
      };

      await buildCandidatePool(options);

      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('photos')
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/services/discovery/candidate-pool-builder.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Create the candidate pool builder**

```typescript
// lib/services/discovery/candidate-pool-builder.ts
/**
 * Candidate Pool Builder
 *
 * Builds the initial pool of beach candidates for surf discovery.
 * Extracted from surf-discovery-service for better testability.
 *
 * @module lib/services/discovery/candidate-pool-builder
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { Beach } from '@/types/database';
import { DISCOVERY_LIMITS } from '@/lib/config/discovery-config';
import { withApprovedPhotos } from '@/lib/supabase/query-builders';

/**
 * Options for building candidate pool
 */
export interface CandidatePoolOptions {
  /** Supabase client */
  supabase: SupabaseClient<Database>;
  /** User's latitude for distance calculation */
  userLat?: number;
  /** User's longitude for distance calculation */
  userLon?: number;
  /** Maximum candidates to return */
  limit?: number;
  /** Filter by region slug */
  regionSlug?: string;
  /** Filter by state */
  stateSlug?: string;
  /** Include photo data */
  includePhotos?: boolean;
  /** Exclude specific beach IDs */
  excludeIds?: string[];
}

/**
 * Beach candidate with optional distance
 */
export interface BeachCandidate extends Beach {
  distance_km?: number;
}

/**
 * Build candidate pool for surf discovery
 *
 * @param options - Pool building options
 * @returns Array of beach candidates
 */
export async function buildCandidatePool(
  options: CandidatePoolOptions
): Promise<BeachCandidate[]> {
  const {
    supabase,
    userLat,
    userLon,
    limit = DISCOVERY_LIMITS.MAX_CANDIDATES,
    regionSlug,
    stateSlug,
    includePhotos = false,
    excludeIds = [],
  } = options;

  // Build select fields
  let selectFields = `
    id,
    name,
    slug,
    center_lat,
    center_lng,
    region_slug,
    state_slug,
    wave_direction_min,
    wave_direction_max,
    wind_offshore_deg,
    tide_preference,
    skill_level
  `;

  if (includePhotos) {
    selectFields += `, photos:beach_photos(id, url, is_approved)`;
  }

  // Build query
  let query = supabase
    .from('beaches')
    .select(selectFields)
    .eq('is_active', true);

  // Apply filters
  if (regionSlug) {
    query = query.eq('region_slug', regionSlug);
  }

  if (stateSlug) {
    query = query.eq('state_slug', stateSlug);
  }

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  // Order by distance if user location provided
  // Note: Full distance calculation would use PostGIS
  query = query.limit(limit);

  const { data: beaches, error } = await query;

  if (error) {
    console.error('[CandidatePool] Query error:', error);
    throw error;
  }

  if (!beaches || beaches.length === 0) {
    return [];
  }

  // Calculate distances if user location provided
  let candidates: BeachCandidate[] = beaches as BeachCandidate[];

  if (userLat !== undefined && userLon !== undefined) {
    candidates = candidates.map((beach) => ({
      ...beach,
      distance_km: calculateDistance(
        userLat,
        userLon,
        beach.center_lat,
        beach.center_lng
      ),
    }));

    // Sort by distance
    candidates.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
  }

  // Apply photo filtering if included
  if (includePhotos) {
    candidates = candidates.map((beach) => ({
      ...beach,
      photos: withApprovedPhotos(beach.photos || []),
    }));
  }

  return candidates.slice(0, limit);
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/services/discovery/candidate-pool-builder.test.ts`
Expected: PASS

**Step 5: Create directory index**

```typescript
// lib/services/discovery/index.ts
export * from './candidate-pool-builder';
```

**Step 6: Commit**

```bash
git add lib/services/discovery/
git add __tests__/lib/services/discovery/
git commit -m "$(cat <<'EOF'
refactor(discovery): extract candidate pool builder

- Create standalone candidate-pool-builder service
- Add distance calculation with Haversine formula
- Support region/state filtering
- Include optional photo data
- Comprehensive test coverage

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Extract Forecast Batch Fetcher

**Files:**
- Create: `lib/services/discovery/forecast-batch-fetcher.ts`
- Create: `__tests__/lib/services/discovery/forecast-batch-fetcher.test.ts`

Follow same TDD pattern as Task 3.1.

**Key functionality to extract:**
- Parallel forecast fetching with timeout
- Error handling for individual fetch failures
- Caching integration
- Result aggregation

---

### Task 3.3: Extract Window Selector

**Files:**
- Create: `lib/services/discovery/window-selector.ts`
- Create: `__tests__/lib/services/discovery/window-selector.test.ts`

Follow same TDD pattern.

**Key functionality to extract:**
- Best window algorithm
- Composite scoring (conditions * 0.7 + confidence * 0.3)
- Tie-breaking logic
- Time preference filtering

---

### Task 3.4: Extract Response Formatter

**Files:**
- Create: `lib/services/discovery/response-formatter.ts`
- Create: `__tests__/lib/services/discovery/response-formatter.test.ts`

Follow same TDD pattern.

**Key functionality to extract:**
- Recommendation shaping
- Badge generation
- Photo URL resolution
- Fallback image handling

---

### Task 3.5: Create Discovery Orchestrator

**Files:**
- Create: `lib/services/discovery/surf-discovery-orchestrator.ts`
- Modify: `lib/services/surf-discovery-service.ts` (deprecate, redirect to orchestrator)

**Implementation:**
The orchestrator composes the extracted services:

```typescript
// lib/services/discovery/surf-discovery-orchestrator.ts
import { buildCandidatePool } from './candidate-pool-builder';
import { fetchForecastsBatch } from './forecast-batch-fetcher';
import { selectBestWindows } from './window-selector';
import { formatDiscoveryResponse } from './response-formatter';

export async function discoverSurfSpots(
  options: SurfDiscoveryOptions
): Promise<SurfDiscoveryResponse> {
  // 1. Build candidate pool
  const candidates = await buildCandidatePool({
    supabase: options.supabase,
    userLat: options.lat,
    userLon: options.lon,
    limit: DISCOVERY_LIMITS.MAX_CANDIDATES,
    regionSlug: options.region,
  });

  // 2. Fetch forecasts in parallel
  const forecasts = await fetchForecastsBatch({
    beachIds: candidates.map((c) => c.id),
    timeout: DISCOVERY_TIMEOUTS.FORECAST_FETCH_MS,
  });

  // 3. Select best windows for each beach
  const windows = selectBestWindows({
    candidates,
    forecasts,
    userPreferences: options.preferences,
    timeSlot: options.timeSlot,
  });

  // 4. Format response
  return formatDiscoveryResponse({
    windows,
    limit: options.limit,
    includePhotos: options.includePhotos,
  });
}
```

---

### Task 3.6-3.10: Coast Pulse Service Extraction

Apply same extraction pattern to `app/api/coast-pulse/route.ts`:

1. **CoastPulseDataAggregator** - Orchestrates data fetching
2. **BuoyDataFetcher** - Fetches CDIP buoy data
3. **TideDataFetcher** - Fetches NOAA tide data
4. **IntelDataFetcher** - Fetches user intel posts
5. **CoastPulseFormatter** - Formats response

---

### Task 3.11-3.15: Intel Actions Refactoring

Split `actions/intel-actions.ts` into:

1. `actions/intel/create-intel-post.ts`
2. `actions/intel/get-intel-posts.ts`
3. `actions/intel/confirm-intel.ts`
4. `actions/intel/intel-validation.ts`
5. `lib/constants/intel-constants.ts`

---

## Phase 4: Component Refactoring

**Duration:** 2-3 weeks
**Impact:** Improved component maintainability and testability

### Task 4.1: Extract Intel Form Sub-Components

**Files:**
- Create: `components/intel/form/intel-conditions-fields.tsx`
- Create: `components/intel/form/intel-photo-upload.tsx`
- Create: `components/intel/form/intel-form-header.tsx`
- Create: `components/intel/form/intel-form-actions.tsx`
- Modify: `components/intel/intel-post-form.tsx`

**Step 1: Create IntelConditionsFields component**

```tsx
// components/intel/form/intel-conditions-fields.tsx
'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ConditionsFieldsProps {
  waveHeight: number;
  onWaveHeightChange: (value: number) => void;
  windCondition: string;
  onWindConditionChange: (value: string) => void;
  crowdLevel: string;
  onCrowdLevelChange: (value: string) => void;
  waterTemp?: number;
  onWaterTempChange?: (value: number) => void;
  disabled?: boolean;
}

export function IntelConditionsFields({
  waveHeight,
  onWaveHeightChange,
  windCondition,
  onWindConditionChange,
  crowdLevel,
  onCrowdLevelChange,
  waterTemp,
  onWaterTempChange,
  disabled = false,
}: ConditionsFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="wave-height">Wave Height (ft)</Label>
        <Slider
          id="wave-height"
          min={0}
          max={20}
          step={0.5}
          value={[waveHeight]}
          onValueChange={([v]) => onWaveHeightChange(v)}
          disabled={disabled}
        />
        <span className="text-sm text-muted-foreground">{waveHeight} ft</span>
      </div>

      <div>
        <Label htmlFor="wind-condition">Wind Conditions</Label>
        <Select
          value={windCondition}
          onValueChange={onWindConditionChange}
          disabled={disabled}
        >
          <SelectTrigger id="wind-condition">
            <SelectValue placeholder="Select wind conditions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="glassy">Glassy</SelectItem>
            <SelectItem value="light-offshore">Light Offshore</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="onshore">Onshore</SelectItem>
            <SelectItem value="strong">Strong Wind</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="crowd-level">Crowd Level</Label>
        <Select
          value={crowdLevel}
          onValueChange={onCrowdLevelChange}
          disabled={disabled}
        >
          <SelectTrigger id="crowd-level">
            <SelectValue placeholder="Select crowd level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="empty">Empty</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="crowded">Crowded</SelectItem>
            <SelectItem value="packed">Packed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

**Step 2: Create remaining sub-components following same pattern**

**Step 3: Refactor main form to use sub-components**

```tsx
// components/intel/intel-post-form.tsx (simplified)
'use client';

import { useState } from 'react';
import { IntelFormHeader } from './form/intel-form-header';
import { IntelConditionsFields } from './form/intel-conditions-fields';
import { IntelPhotoUpload } from './form/intel-photo-upload';
import { IntelFormActions } from './form/intel-form-actions';
import { useIntelFormValidation } from '@/hooks/use-intel-form-validation';
import { useIntelForecastPrefill } from '@/hooks/use-intel-forecast-prefill';

export function IntelPostForm({ beachId, onSuccess, onCancel }: IntelPostFormProps) {
  const [formState, setFormState] = useState<IntelFormState>(initialState);
  const { errors, validate } = useIntelFormValidation(formState);
  const { prefillFromForecast } = useIntelForecastPrefill(beachId);

  // ... event handlers ...

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <IntelFormHeader
        selectedTags={formState.tags}
        onTagsChange={(tags) => setFormState((s) => ({ ...s, tags }))}
      />

      <IntelConditionsFields
        waveHeight={formState.waveHeight}
        onWaveHeightChange={(v) => setFormState((s) => ({ ...s, waveHeight: v }))}
        windCondition={formState.windCondition}
        onWindConditionChange={(v) => setFormState((s) => ({ ...s, windCondition: v }))}
        crowdLevel={formState.crowdLevel}
        onCrowdLevelChange={(v) => setFormState((s) => ({ ...s, crowdLevel: v }))}
      />

      <IntelPhotoUpload
        photos={formState.photos}
        onPhotosChange={(photos) => setFormState((s) => ({ ...s, photos }))}
        maxPhotos={3}
      />

      <IntelFormActions
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        errors={errors}
      />
    </form>
  );
}
```

**Step 4: Commit**

```bash
git add components/intel/form/
git add components/intel/intel-post-form.tsx
git commit -m "$(cat <<'EOF'
refactor(intel): extract form sub-components

- Extract IntelConditionsFields for wave/wind/crowd inputs
- Extract IntelPhotoUpload for photo handling
- Extract IntelFormHeader for tag selection
- Extract IntelFormActions for submit/cancel
- Simplify main form to ~150 lines from ~1100

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2-4.4: Extract Intel Form Hooks

1. `hooks/use-intel-form-validation.ts`
2. `hooks/use-intel-forecast-prefill.ts`
3. `hooks/use-intel-photo-upload.ts`

Follow TDD pattern with comprehensive tests.

---

### Task 4.5-4.8: Session Form Refactoring

Apply same extraction pattern to session wizard:

1. Extract `useSessionBasicInfo` hook
2. Extract `useSessionConditions` hook
3. Extract `useSessionEquipment` hook
4. Create session form context for shared state

---

## Phase 5: Infrastructure Improvements

**Duration:** 4-6 weeks
**Impact:** Long-term stability, prevent future bugs

### Task 5.1: Coordinate Naming Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_latitude_longitude_columns.sql`

**Step 1: Create migration file**

```sql
-- Migration: Add latitude/longitude columns (new naming convention)
-- This is a backwards-compatible migration that adds new columns
-- without removing the legacy center_lat/center_lng columns yet.

-- Step 1: Add new columns
ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Step 2: Backfill from existing columns
UPDATE beaches
SET
  latitude = center_lat,
  longitude = center_lng
WHERE latitude IS NULL AND center_lat IS NOT NULL;

-- Step 3: Add check constraints
ALTER TABLE beaches
ADD CONSTRAINT beaches_latitude_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE beaches
ADD CONSTRAINT beaches_longitude_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- Step 4: Create index on new columns
CREATE INDEX IF NOT EXISTS idx_beaches_lat_lon
ON beaches (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Step 5: Add comment for documentation
COMMENT ON COLUMN beaches.latitude IS 'WGS84 latitude (new naming convention, replaces center_lat)';
COMMENT ON COLUMN beaches.longitude IS 'WGS84 longitude (new naming convention, replaces center_lng)';

-- Note: Do NOT drop center_lat/center_lng yet.
-- A future migration will:
-- 1. Update all code to use latitude/longitude
-- 2. Add triggers to sync both column sets
-- 3. Eventually deprecate and drop legacy columns
```

**Step 2: Test migration locally**

Run: `supabase db reset` (local development)

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "$(cat <<'EOF'
feat(db): add latitude/longitude columns to beaches table

- Add new columns following coordinate naming conventions
- Backfill from legacy center_lat/center_lng
- Add range constraints for validation
- Create spatial index
- Legacy columns preserved for backwards compatibility

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.2: Create Coordinate Mapping Utilities

**Files:**
- Create: `lib/utils/coordinate-mapping.ts`
- Create: `__tests__/lib/utils/coordinate-mapping.test.ts`

**Implementation:**

```typescript
// lib/utils/coordinate-mapping.ts
/**
 * Coordinate Mapping Utilities
 *
 * Provides consistent mapping between database columns and component props.
 * Addresses the mismatch between legacy (center_lat/center_lng) and
 * new (latitude/longitude) naming conventions.
 */

import type { Beach } from '@/types/database';

/**
 * Standard coordinate interface for components
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Extract coordinates from a beach object
 *
 * Handles both legacy (center_lat/center_lng) and new (latitude/longitude) columns.
 * Prefers new columns when available.
 *
 * @param beach - Beach object from database
 * @returns Coordinates or null if not available
 */
export function getBeachCoordinates(beach: Beach | null | undefined): Coordinates | null {
  if (!beach) return null;

  // Prefer new naming convention
  if (typeof beach.latitude === 'number' && typeof beach.longitude === 'number') {
    return {
      latitude: beach.latitude,
      longitude: beach.longitude,
    };
  }

  // Fall back to legacy columns
  if (typeof beach.center_lat === 'number' && typeof beach.center_lng === 'number') {
    return {
      latitude: beach.center_lat,
      longitude: beach.center_lng,
    };
  }

  return null;
}

/**
 * Map beach to component props with proper coordinate naming
 *
 * @param beach - Beach object from database
 * @returns Beach with standardized coordinate props
 */
export function mapBeachToProps<T extends Beach>(
  beach: T
): T & { latitude: number; longitude: number } {
  const coords = getBeachCoordinates(beach);

  if (!coords) {
    throw new Error(`Beach ${beach.id} has no valid coordinates`);
  }

  return {
    ...beach,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

/**
 * Validate coordinates are within valid ranges
 */
export function validateCoordinates(
  lat: number,
  lon: number,
  context?: string
): void {
  if (lat < -90 || lat > 90) {
    throw new Error(
      `Invalid latitude ${lat}${context ? ` in ${context}` : ''}: must be between -90 and 90`
    );
  }

  if (lon < -180 || lon > 180) {
    throw new Error(
      `Invalid longitude ${lon}${context ? ` in ${context}` : ''}: must be between -180 and 180`
    );
  }
}
```

---

### Task 5.3-5.6: Fix E2E Test Drift

**Files:**
- Multiple files in `e2e/` directory

**Process for each test file:**

1. **Read the test file** to understand current selectors
2. **Run the test** to see actual failures
3. **Update selectors** to match current component structure
4. **Add stable data-testid** attributes where missing
5. **Re-run and verify** test passes
6. **Remove TODO: Test drift** comments

**Priority test files:**
1. `e2e/discovery.spec.ts`
2. `e2e/session-creation.spec.ts`
3. `e2e/intel-posting.spec.ts`
4. `e2e/carousel.spec.ts`

---

### Task 5.7: Supabase Client Injection Pattern

**Files:**
- Modify: `lib/middleware/api-wrappers.ts` (already done)
- Create: `docs/SUPABASE_CLIENT_PATTERNS.md`

**Documentation:**

```markdown
# Supabase Client Patterns

## Preferred Pattern: Middleware Injection

API routes should receive the Supabase client from middleware, not create it directly.

### Correct (Injected)

```typescript
export const GET = withAuth(async (request, { user, supabase }) => {
  const { data } = await supabase.from('items').select('*');
  return createSuccessResponse(data);
});
```

### Incorrect (Direct Creation)

```typescript
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient(); // Avoid this
  // ...
}
```

## Benefits

1. **Consistent auth context** - Client always has correct user session
2. **Easier testing** - Mock the injected client
3. **Reduced overhead** - Client created once per request
4. **Type safety** - Context is properly typed
```

---

### Task 5.8: Remove Deprecated surf-spots.ts Data

**Files:**
- Modify: `lib/data/surf-spots.ts`
- Create migration if needed

**Step 1: Identify what's still in use**

Search for imports of SURF_CITIES and SURF_SPOTS.

**Step 2: Migrate remaining usages to database**

**Step 3: Remove deprecated exports**

**Step 4: Verify bundle size reduction**

Run: `yarn build && yarn analyze`

---

## Appendix: Testing Checklist

Before each commit:
- [ ] Unit tests pass: `yarn test`
- [ ] Type check passes: `yarn typecheck`
- [ ] Lint passes: `yarn lint`
- [ ] E2E tests pass: `yarn test:e2e`
- [ ] No console errors in dev server

Before each phase completion:
- [ ] Update CHANGELOG.md
- [ ] Update relevant ARCHITECTURE.md files
- [ ] Run full test suite
- [ ] Measure and document improvements

---

## Appendix: Rollback Procedures

Each task is designed to be independently revertible. If issues arise:

```bash
# Revert last commit
git revert HEAD

# Revert specific commit
git revert <commit-hash>

# For migrations, use down migration
supabase db reset
```

---

## Success Metrics

### Code Quality
- [ ] Average file size < 250 lines (currently ~300)
- [ ] No function > 15 cyclomatic complexity
- [ ] Code duplication < 3% (currently ~8-10%)

### Performance
- [ ] Bundle size reduced by 20%
- [ ] Build time maintained or improved
- [ ] Test coverage > 80% for refactored code

### Developer Experience
- [ ] New developer onboarding 30% faster
- [ ] PR review time reduced
- [ ] Bug rate reduced by 20%

---

**Plan saved to:** `docs/plans/2026-01-17-codebase-refactoring-implementation.md`

