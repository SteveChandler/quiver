/**
 * Spot Profile Domain Types
 *
 * Encapsulates beach characteristics that affect scoring.
 * These are immutable value objects constructed from Beach database rows.
 */

import type { SkillLevel } from '../user-preferences/skill-level';

// Re-export SkillLevel for backwards compatibility with existing imports
export type { SkillLevel };

/**
 * Swell window configuration for a beach.
 * Swells within this directional range reach the beach cleanly.
 */
export interface SwellWindow {
  /** Start of ideal swell window (degrees, 0-360) */
  readonly minDeg: number;
  /** End of ideal swell window (degrees, 0-360) */
  readonly maxDeg: number;
  /** Computed center of swell window */
  readonly centerDeg: number;
  /** Computed half-width for scoring falloff */
  readonly halfWidthDeg: number;
}

/**
 * Wind threshold configuration.
 * Defines when wind becomes problematic for this spot.
 */
export interface WindThresholds {
  /** Ideal offshore wind direction (degrees) */
  readonly offshoreDeg: number;
  /** Tolerance around offshore direction (degrees) */
  readonly offshoreToleranceDeg: number;
  /** Max acceptable onshore wind (mph) before degradation */
  readonly maxOnshoreMph: number;
  /** Max acceptable wind regardless of direction (mph) */
  readonly maxAnyMph: number;
  /** Cross-shore wind threshold (knots) - acceptable up to this */
  readonly crossShoreOkKts: number;
}

/**
 * Tide preferences for optimal conditions.
 */
export interface TidePreferences {
  /** Minimum preferred tide height (feet) */
  readonly minHeightFt: number;
  /** Maximum preferred tide height (feet) */
  readonly maxHeightFt: number;
  /** Preferred tide movement direction */
  readonly preferredDirection: 'rising' | 'falling' | 'either' | 'slack';
  /** How sensitive this spot is to wrong tide direction */
  readonly directionSensitivity: 'low' | 'medium' | 'high';
}

/**
 * Complete spot profile for scoring.
 * Immutable value object constructed from Beach database row.
 */
export interface SpotProfile {
  /** Beach ID */
  readonly id: string;
  /** Beach name */
  readonly name: string;
  /** IANA timezone (e.g., 'America/Los_Angeles') */
  readonly timezone: string;
  /** Coordinates */
  readonly coordinates: {
    readonly lat: number;
    readonly lon: number;
  };
  /** Swell direction window configuration */
  readonly swellWindow: SwellWindow;
  /** Wind threshold configuration */
  readonly windThresholds: WindThresholds;
  /** Tide preferences */
  readonly tidePreferences: TidePreferences;
  /** Required skill level */
  readonly skillLevel: SkillLevel | null;
  /** Break type (beach, point, reef, etc.) */
  readonly breakType: string | null;
  /** Optional five-degree directional access factors (0 = blocked, 1 = open). */
  readonly swellAccessFactors?: readonly number[] | null;
  /** Optional five-degree directional wind exposure factors. */
  readonly windExposureFactors?: readonly number[] | null;
}

/**
 * Default values for optional beach configuration.
 * Used when database values are null.
 */
export const SPOT_PROFILE_DEFAULTS = {
  /** Default swell window: all directions */
  swellWindow: {
    minDeg: 0,
    maxDeg: 360,
    centerDeg: 180,
    halfWidthDeg: 180,
  },
  /** Default wind thresholds */
  windThresholds: {
    offshoreDeg: 90, // East (typical for west-facing beaches)
    offshoreToleranceDeg: 45,
    maxOnshoreMph: 10,
    maxAnyMph: 18,
    crossShoreOkKts: 15,
  },
  /** Default tide preferences: any tide */
  tidePreferences: {
    minHeightFt: -2,
    maxHeightFt: 8,
    preferredDirection: 'either' as const,
    directionSensitivity: 'medium' as const,
  },
} as const;
