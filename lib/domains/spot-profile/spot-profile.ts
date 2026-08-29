/**
 * Spot Profile Factory
 *
 * Creates SpotProfile value objects from Beach database rows.
 * Centralizes all beach-to-profile mapping logic.
 */

import type { Beach } from '@/types/database';
import type {
  SpotProfile,
  SwellWindow,
  WindThresholds,
  TidePreferences,
} from './types';
import { SPOT_PROFILE_DEFAULTS } from './types';
import {
  normalizeAngle,
  angleDifference as sharedAngleDifference,
} from '../shared';
import { parseSkillLevel } from '../user-preferences/skill-level';
import { useTerrainFactors as shouldUseTerrainFactors } from '@/types/terrain';

/**
 * Creates a SpotProfile from a Beach database row.
 * Handles null values with sensible defaults.
 */
export function createSpotProfile(beach: Beach): SpotProfile {
  const terrainEnabled = shouldUseTerrainFactors({
    terrain_enabled: beach.terrain_enabled,
    swell_access_factors: beach.swell_access_factors,
    wind_exposure_factors: beach.wind_exposure_factors,
  });
  return {
    id: beach.id,
    name: beach.name,
    timezone: getTimezone(beach),
    coordinates: {
      lat: beach.lat ?? 0,
      lon: beach.lon ?? 0,
    },
    swellWindow: createSwellWindow(beach),
    windThresholds: createWindThresholds(beach),
    tidePreferences: createTidePreferences(beach),
    skillLevel: parseSkillLevel(beach.skill_level),
    breakType: beach.break_type ?? null,
    swellAccessFactors: terrainEnabled ? beach.swell_access_factors : null,
    windExposureFactors: terrainEnabled ? beach.wind_exposure_factors : null,
  };
}

/** Gets the stored beach timezone, with coordinate inference for legacy rows. */
function getTimezone(beach: Beach): string {
  const storedTimezone = beach.timezone?.trim();
  if (storedTimezone) return storedTimezone;

  const lat = beach.lat ?? 0;
  const lon = beach.lon ?? 0;

  // Check Hawaii first (before generic longitude checks)
  if (lat > 19 && lat < 23 && lon > -161 && lon < -154) {
    return 'Pacific/Honolulu'; // Hawaii
  }

  // Simple heuristic based on longitude for US beaches
  if (lon < -115) {
    return 'America/Los_Angeles'; // West Coast
  } else if (lon < -100) {
    return 'America/Denver'; // Mountain
  } else if (lon < -85) {
    return 'America/Chicago'; // Central
  } else if (lon < -70) {
    return 'America/New_York'; // East Coast
  }

  return 'America/Los_Angeles'; // Default
}

/**
 * Creates SwellWindow from beach swell direction data.
 */
function createSwellWindow(beach: Beach): SwellWindow {
  const minDeg = beach.swell_window_min_deg;
  const maxDeg = beach.swell_window_max_deg;

  // If no swell window defined, use defaults (all directions)
  if (minDeg == null || maxDeg == null) {
    return SPOT_PROFILE_DEFAULTS.swellWindow;
  }

  // Calculate center and half-width, handling wrap-around
  // e.g., min=300, max=60 covers NW to ENE (300° through 0° to 60°)
  // Special case: if min=0 and max=360, span is full circle (360°)
  let span = normalizeAngle(maxDeg - minDeg);
  if (span === 0 && maxDeg !== minDeg) {
    span = 360; // Full circle
  }
  const centerDeg = normalizeAngle(minDeg + span / 2);
  const halfWidthDeg = span / 2;

  return {
    minDeg,
    maxDeg,
    centerDeg,
    halfWidthDeg,
  };
}

/**
 * Creates WindThresholds from beach wind configuration.
 */
function createWindThresholds(beach: Beach): WindThresholds {
  // Use explicit beach thresholds or fall back to defaults
  // Note: Database has wind_onshore_bad_kt (knots) but we need mph
  // Also has max_wind_onshore_mph and max_wind_any_mph (added in migration)
  const maxOnshoreMph =
    (beach as Beach & { max_wind_onshore_mph?: number | null })
      .max_wind_onshore_mph ??
    (beach.wind_onshore_bad_kt != null
      ? knotsToMph(beach.wind_onshore_bad_kt)
      : SPOT_PROFILE_DEFAULTS.windThresholds.maxOnshoreMph);

  const maxAnyMph =
    (beach as Beach & { max_wind_any_mph?: number | null }).max_wind_any_mph ??
    SPOT_PROFILE_DEFAULTS.windThresholds.maxAnyMph;

  return {
    offshoreDeg:
      beach.wind_offshore_deg ??
      SPOT_PROFILE_DEFAULTS.windThresholds.offshoreDeg,
    offshoreToleranceDeg:
      beach.wind_offshore_tol_deg ??
      SPOT_PROFILE_DEFAULTS.windThresholds.offshoreToleranceDeg,
    maxOnshoreMph,
    maxAnyMph,
    crossShoreOkKts:
      beach.wind_cross_shore_ok_kt ??
      SPOT_PROFILE_DEFAULTS.windThresholds.crossShoreOkKts,
  };
}

/**
 * Creates TidePreferences from beach tide configuration.
 */
function createTidePreferences(beach: Beach): TidePreferences {
  return {
    minHeightFt:
      beach.preferred_tide_ft_min ??
      SPOT_PROFILE_DEFAULTS.tidePreferences.minHeightFt,
    maxHeightFt:
      beach.preferred_tide_ft_max ??
      SPOT_PROFILE_DEFAULTS.tidePreferences.maxHeightFt,
    preferredDirection: parseTideDirection(beach.preferred_tide_direction),
    directionSensitivity: parseTideDirectionSensitivity(
      (beach as Beach & { tide_direction_sensitivity?: string | null }).tide_direction_sensitivity ?? null,
      beach.break_type
    ),
  };
}

/**
 * Parses tide direction string to typed enum.
 */
function parseTideDirection(
  direction: string | null
): TidePreferences['preferredDirection'] {
  if (!direction) return 'either';

  const normalized = direction.toLowerCase().trim();
  if (
    normalized === 'rising' ||
    normalized === 'falling' ||
    normalized === 'either' ||
    normalized === 'slack'
  ) {
    return normalized;
  }

  // Handle 'any' as 'either'
  if (normalized === 'any') {
    return 'either';
  }

  return 'either';
}

/**
 * Derives tide direction sensitivity from break type.
 * Reef breaks are most sensitive, point breaks least.
 */
function deriveSensitivityFromBreakType(
  breakType: string | null
): TidePreferences['directionSensitivity'] {
  if (!breakType) return 'medium';

  const normalized = breakType.toLowerCase().trim();

  // Reef breaks are highly sensitive to tide direction
  if (normalized.includes('reef')) {
    return 'high';
  }

  // Point breaks are generally more forgiving
  if (normalized.includes('point')) {
    return 'low';
  }

  // Beach breaks, river mouths, etc. - medium sensitivity
  return 'medium';
}

/**
 * Parses tide direction sensitivity from database or derives from break type.
 */
function parseTideDirectionSensitivity(
  explicit: string | null,
  breakType: string | null
): TidePreferences['directionSensitivity'] {
  // If explicitly set, use that value
  if (explicit) {
    const normalized = explicit.toLowerCase().trim();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
      return normalized;
    }
  }

  // Otherwise derive from break type
  return deriveSensitivityFromBreakType(breakType);
}

/**
 * Converts knots to mph.
 */
function knotsToMph(knots: number): number {
  return knots * 1.15078;
}

/**
 * Checks if a direction is within a swell window.
 */
export function isDirectionInWindow(
  directionDeg: number,
  window: SwellWindow
): boolean {
  const diff = sharedAngleDifference(directionDeg, window.centerDeg);
  return diff <= window.halfWidthDeg;
}

/**
 * Calculates how well a direction aligns with a swell window.
 * Returns 0-100 score where 100 is perfect alignment.
 */
export function calculateWindowAlignment(
  directionDeg: number,
  window: SwellWindow
): number {
  const diff = sharedAngleDifference(directionDeg, window.centerDeg);

  if (diff <= window.halfWidthDeg) {
    // Within window: score based on how centered
    const centeredness = 1 - diff / window.halfWidthDeg;
    return 70 + centeredness * 30; // 70-100 range
  }

  // Outside window: steep falloff
  const outsideBy = diff - window.halfWidthDeg;
  const falloff = Math.max(0, 70 - outsideBy * 2); // 2 points per degree
  return falloff;
}
