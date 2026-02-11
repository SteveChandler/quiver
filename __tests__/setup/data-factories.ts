/**
 * Shared Data Factories for Quiver Tests
 *
 * Provides reusable mock data factory functions to reduce duplication
 * across test files. Each factory returns a fully-typed object with
 * sensible defaults that can be overridden via a partial parameter.
 */

// Re-export createMockBeach from typed-mocks (canonical source)
export { createMockBeach } from "./typed-mocks";

import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type {
  EnrichedDaySummary,
  TimeSlot,
} from "@/lib/utils/enriched-day-summary";
import type { Beach } from "@/types/database";

// =============================================================================
// SURF CALL FACTORY
// =============================================================================

/**
 * Creates a mock SurfCallResult with sensible defaults.
 *
 * Based on the pattern in unified-surf-card.test.tsx.
 */
export function createMockSurfCall(
  overrides: Partial<SurfCallResult> = {}
): SurfCallResult {
  return {
    verdict: "YES",
    bestWindowStart: "2026-02-10T08:00:00",
    bestWindowEnd: "2026-02-10T11:00:00",
    peakTime: "2026-02-10T09:30:00",
    windowMinutes: 180,
    shortWindow: false,
    lowForecastConfidence: false,
    forecastConfidence: 0.85,
    score: 75,
    waveHeight: "3-4 ft",
    windDescription: "Light offshore",
    windSpeed: "5 mph",
    windCompass: "NE",
    windType: "offshore",
    tideDescription: "Rising mid tide",
    tidePhase: "rising",
    nextTideType: "high",
    nextTideAt: "2026-02-10T14:00:00",
    trendTags: [],
    whySentence: "Clean conditions with light offshore winds.",
    updatedAt: "2026-02-10T06:00:00",
    ...overrides,
  };
}

// =============================================================================
// DAY SUMMARY FACTORY
// =============================================================================

/**
 * Creates a mock DaySummary for horizon strip tests.
 *
 * Based on the pattern in horizon-strip.test.tsx.
 */
export function createMockDaySummary(
  overrides: Partial<DaySummary> = {}
): DaySummary {
  return {
    fullDate: "2026-02-10",
    dayName: "Mon",
    date: "Feb 10",
    score: 70,
    tier: "good" as const,
    minHeight: 3,
    maxHeight: 5,
    period: 12,
    bestTime: "08:00",
    isToday: false,
    ...overrides,
  };
}

// =============================================================================
// ENRICHED DAY SUMMARY FACTORY
// =============================================================================

/**
 * Creates a mock EnrichedDaySummary (DaySummary + wind/time-slot fields).
 *
 * Extends DaySummary with windConditions, bestTimeSlot, and windSpeed
 * as used by conditions-overview components.
 */
export function createMockEnrichedDay(
  overrides: Partial<EnrichedDaySummary> = {}
): EnrichedDaySummary {
  return {
    fullDate: "2026-02-10",
    dayName: "Mon",
    date: "Feb 10",
    score: 70,
    tier: "good" as const,
    minHeight: 3,
    maxHeight: 5,
    period: 12,
    bestTime: "08:00",
    isToday: false,
    windConditions: "offshore",
    bestTimeSlot: "morning",
    windSpeed: "5-10mph",
    ...overrides,
  };
}

// =============================================================================
// NEARBY BEACH FACTORY
// =============================================================================

interface NearbyBeach extends Beach {
  distance?: number;
}

/**
 * Creates a mock NearbyBeach (Beach + distance field).
 *
 * Based on the pattern in nearby-spots-server.test.tsx.
 */
export function createMockNearbyBeach(
  overrides: Partial<NearbyBeach> = {}
): NearbyBeach {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    city: "San Diego",
    state: "CA",
    distance: 2.5,
    center_lat: 32.8,
    center_lng: -117.2,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  } as NearbyBeach;
}
