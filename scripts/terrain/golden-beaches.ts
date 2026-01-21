/**
 * Golden Beach Validation Dataset
 *
 * A curated set of beaches with known terrain characteristics for validating
 * terrain-aware geometry scoring algorithms. These beaches represent diverse
 * coastal geometries and serve as test cases for parameter tuning.
 *
 * Purpose:
 * - Validate wind exposure factors against surfer intuition
 * - Verify swell access patterns for different coastal geometries
 * - Catch bugs in terrain analysis (projection, landmask, DEM artifacts)
 * - Tune algorithm parameters until golden beaches behave correctly
 *
 * Usage:
 * 1. Run analysis with --dry-run on golden beaches
 * 2. Inspect polar plots or summary statistics
 * 3. Compare to expected behavior
 * 4. Adjust parameters if needed
 */

/**
 * Beach type classification for validation
 */
export type BeachType =
  | 'open' // Open beach break, fully exposed
  | 'sheltered' // Protected by hills/headlands
  | 'deep_bay' // Deep bay with protected wind and narrow swell window
  | 'headland' // Headland point with asymmetric wrap
  | 'false_shelter' // Low dunes that appear protective but aren't
  | 'harbor' // Harbor/marina with complex coastline
  | 'peninsula' // Long peninsula with wrap asymmetry

/**
 * Wind exposure pattern types
 */
export type WindExposurePattern =
  | 'uniform' // All directions equally exposed (~1.0)
  | 'directional_shelter' // Strong shelter from specific directions
  | 'asymmetric' // Different exposure on different sides

/**
 * Swell access pattern types
 */
export type SwellAccessPattern =
  | 'full' // Open to all swell directions
  | 'narrow_window' // Limited swell window (bay, cove)
  | 'wrap_dependent' // Relies on refraction around headlands

/**
 * Expected behavior for a golden beach
 */
export interface ExpectedBehavior {
  /** Wind exposure pattern type */
  wind_exposure_pattern: WindExposurePattern

  /** Swell access pattern type */
  swell_access_pattern: SwellAccessPattern

  /** Detailed notes about expected behavior */
  notes: string

  /** Optional: specific directions that should be sheltered from wind */
  wind_sheltered_directions?: number[]

  /** Optional: specific directions with good swell access */
  swell_open_directions?: number[]

  /** Optional: specific directions blocked for swell */
  swell_blocked_directions?: number[]
}

/**
 * Golden beach test case
 */
export interface GoldenBeach {
  /** Beach ID if exists in database (optional) */
  id?: string

  /** Beach name */
  name: string

  /** Latitude (WGS84) */
  latitude: number

  /** Longitude (WGS84) */
  longitude: number

  /** Beach type classification */
  type: BeachType

  /** Expected terrain analysis behavior */
  expected_behavior: ExpectedBehavior

  /** Location description (e.g., "Huntington Beach, CA") */
  location: string

  /** Region identifier (e.g., "california", "hawaii") */
  region: string
}

/**
 * Golden beaches dataset
 *
 * Covers diverse California surf spots with well-known terrain characteristics.
 * Each beach represents a different validation scenario for terrain analysis.
 */
export const GOLDEN_BEACHES: GoldenBeach[] = [
  // ===================================================
  // OPEN BEACH BREAKS (Baseline)
  // ===================================================

  {
    name: 'Huntington Beach',
    latitude: 33.6595,
    longitude: -118.0026,
    type: 'open',
    location: 'Huntington Beach, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'uniform',
      swell_access_pattern: 'full',
      notes:
        'Classic open beach break. Long, straight coastline with minimal terrain features. ' +
        'Should show uniform wind exposure (~0.93) and full swell access (~1.0) across all directions. ' +
        'Serves as baseline for comparison. If this beach shows strong directional bias, ' +
        'likely indicates projection bug or DEM artifacts.',
      wind_sheltered_directions: [], // None - fully exposed
      swell_open_directions: [180, 185, 190, 195, 200, 205, 210, 215, 220, 225], // SW swell window
    },
  },

  {
    name: 'Ocean Beach SF',
    latitude: 37.7699,
    longitude: -122.51,
    type: 'open',
    location: 'San Francisco, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'uniform',
      swell_access_pattern: 'full',
      notes:
        'Open, exposed beach break on the Pacific side of SF peninsula. ' +
        'Known for being extremely windy and powerful. Should show high wind exposure ' +
        'across all directions (minimal terrain shelter). Open to large NW and SW swells.',
      wind_sheltered_directions: [],
      swell_open_directions: [225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280], // W-NW swell
    },
  },

  // ===================================================
  // SHELTERED BEACHES (Hills block specific winds)
  // ===================================================

  {
    name: 'Rincon',
    latitude: 34.3732,
    longitude: -119.4764,
    type: 'sheltered',
    location: 'Carpinteria, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'directional_shelter',
      swell_access_pattern: 'narrow_window',
      notes:
        'Protected cove with hills to the north and east. Famous for clean conditions ' +
        'when other spots are blown out. Hills should provide strong wind shelter from ' +
        'N and NE directions. Open to W-NW swell, partially blocked from S swell by Point Conception.',
      wind_sheltered_directions: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90], // N-E quadrant
      swell_open_directions: [250, 255, 260, 265, 270, 275, 280, 285, 290, 295, 300], // W-NW swell
      swell_blocked_directions: [180, 185, 190, 195, 200], // S swell partially blocked
    },
  },

  {
    name: 'Malibu First Point',
    latitude: 34.036,
    longitude: -118.6777,
    type: 'headland',
    location: 'Malibu, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'directional_shelter',
      swell_access_pattern: 'wrap_dependent',
      notes:
        'Classic point break with headland wrapping. Protected from W-NW wind by Malibu headland. ' +
        'Best on S-SW swell that wraps around the point. Should show strong directional shelter ' +
        'from W winds, and good wrap contribution for swell from S-SW directions. ' +
        'Asymmetric exposure - open from E-S, sheltered from W-N.',
      wind_sheltered_directions: [270, 275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330], // W-NW quadrant
      swell_open_directions: [180, 185, 190, 195, 200, 205, 210], // S-SW swell
      swell_blocked_directions: [270, 275, 280, 285, 290, 295, 300], // W-NW blocked by point
    },
  },

  // ===================================================
  // SEMI-PROTECTED (Hills nearby but not complete shelter)
  // ===================================================

  {
    name: 'Trestles',
    latitude: 33.3828,
    longitude: -117.5916,
    type: 'sheltered',
    location: 'San Clemente, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'directional_shelter',
      swell_access_pattern: 'full',
      notes:
        'Semi-protected by coastal bluffs and Camp Pendleton hills to the NE. ' +
        'Gets some wind shelter from E and NE directions, but still relatively exposed. ' +
        'Open to most swell directions. Should show moderate shelter from E-NE (not extreme), ' +
        'and uniform swell access. Good test case for "partial shelter" scenarios.',
      wind_sheltered_directions: [45, 50, 55, 60, 65, 70, 75, 80], // E-NE partial shelter
      swell_open_directions: [180, 185, 190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260, 265, 270], // S-W swell
    },
  },

  // ===================================================
  // DEEP BAY (Protected wind, narrow swell window)
  // ===================================================

  {
    name: 'Santa Cruz - Cowell Beach',
    latitude: 36.9519,
    longitude: -122.0237,
    type: 'deep_bay',
    location: 'Santa Cruz, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'directional_shelter',
      swell_access_pattern: 'narrow_window',
      notes:
        'Protected inside Monterey Bay with significant wind shelter from W-NW winds. ' +
        'Narrow swell window facing S-SW. Should show strong shelter from W-NW (blocked by ' +
        'Santa Cruz Mountains and Monterey Peninsula), and limited swell access mainly from S-SW. ' +
        'Good test for bay protection effects.',
      wind_sheltered_directions: [270, 275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340], // W-NW quadrant
      swell_open_directions: [180, 185, 190, 195, 200, 205, 210, 215], // S-SW swell window
      swell_blocked_directions: [240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290, 295, 300], // W-NW blocked by peninsula
    },
  },

  // ===================================================
  // FALSE SHELTER (Low dunes - catches over-shelter bugs)
  // ===================================================

  {
    name: 'Stinson Beach',
    latitude: 37.9009,
    longitude: -122.6433,
    type: 'false_shelter',
    location: 'Stinson Beach, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'uniform',
      swell_access_pattern: 'full',
      notes:
        'Open beach with low dunes and minimal terrain features. Located inside Point Reyes ' +
        'but still relatively exposed. Should NOT show strong shelter (catches bugs where ' +
        'algorithm over-estimates shelter from low features). Mostly uniform exposure with ' +
        'perhaps slight shelter from N (coastal hills), but should not be extreme.',
      wind_sheltered_directions: [], // Minimal shelter despite nearby hills
      swell_open_directions: [225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280], // W-NW swell
    },
  },

  // ===================================================
  // HARBOR/COMPLEX COASTLINE
  // ===================================================

  {
    name: 'San Diego - Tourmaline',
    latitude: 32.7964,
    longitude: -117.2564,
    type: 'harbor',
    location: 'San Diego, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'asymmetric',
      swell_access_pattern: 'narrow_window',
      notes:
        'Located near Mission Bay with complex coastline features. Some shelter from ' +
        'E-SE winds due to urban development and coastal features. Faces mostly W-NW, ' +
        'with limited swell window. Tests algorithm handling of complex coastline geometry.',
      wind_sheltered_directions: [90, 95, 100, 105, 110, 115, 120, 125, 130, 135], // E-SE partial shelter
      swell_open_directions: [250, 255, 260, 265, 270, 275, 280, 285, 290], // W-NW swell
      swell_blocked_directions: [180, 185, 190, 195, 200, 205, 210], // S swell blocked by Point Loma
    },
  },

  // ===================================================
  // LONG PENINSULA (Wrap asymmetry)
  // ===================================================

  {
    name: 'Steamer Lane',
    latitude: 36.9519,
    longitude: -122.0264,
    type: 'peninsula',
    location: 'Santa Cruz, CA',
    region: 'california',
    expected_behavior: {
      wind_exposure_pattern: 'directional_shelter',
      swell_access_pattern: 'wrap_dependent',
      notes:
        'Point break at the tip of Santa Cruz peninsula. Protected from S-SE winds by ' +
        'coastal bluffs, open to W-NW. Excellent swell refraction around the point for ' +
        'NW swells. Should show strong wrap effects for NW swell, directional wind shelter ' +
        'from S-SE, and asymmetric exposure pattern.',
      wind_sheltered_directions: [135, 140, 145, 150, 155, 160, 165, 170, 175, 180], // SE-S shelter from bluffs
      swell_open_directions: [270, 275, 280, 285, 290, 295, 300, 305, 310], // W-NW swell with wrap
      swell_blocked_directions: [90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150], // E-SE blocked
    },
  },
]

/**
 * Get golden beach by name
 *
 * @param name Beach name (case-insensitive)
 * @returns Golden beach or undefined if not found
 */
export function getGoldenBeachByName(name: string): GoldenBeach | undefined {
  const normalized = name.toLowerCase().trim()
  return GOLDEN_BEACHES.find(beach => beach.name.toLowerCase() === normalized)
}

/**
 * Get golden beaches by type
 *
 * @param type Beach type
 * @returns Array of matching golden beaches
 */
export function getGoldenBeachesByType(type: BeachType): GoldenBeach[] {
  return GOLDEN_BEACHES.filter(beach => beach.type === type)
}

/**
 * Get golden beaches by region
 *
 * @param region Region identifier
 * @returns Array of matching golden beaches
 */
export function getGoldenBeachesByRegion(region: string): GoldenBeach[] {
  const normalized = region.toLowerCase().trim()
  return GOLDEN_BEACHES.filter(beach => beach.region.toLowerCase() === normalized)
}

/**
 * Validate that a beach has expected symmetric behavior (for open beaches)
 *
 * Checks that factor arrays have low variance, indicating uniform exposure/access.
 * This catches projection bugs, landmask errors, or DEM artifacts.
 *
 * @param factors Array of 72 factors (wind exposure or swell access)
 * @param maxStdDev Maximum allowed standard deviation (default: 0.1)
 * @returns true if factors are sufficiently uniform
 */
export function checkSymmetrySanity(factors: number[], maxStdDev = 0.1): boolean {
  if (!factors || factors.length !== 72) {
    return false
  }

  const mean = factors.reduce((sum, f) => sum + f, 0) / factors.length
  const variance = factors.reduce((sum, f) => sum + (f - mean) ** 2, 0) / factors.length
  const stdDev = Math.sqrt(variance)

  return stdDev < maxStdDev
}

/**
 * Calculate summary statistics for a factor array
 *
 * @param factors Array of 72 factors
 * @returns Summary statistics
 */
export interface FactorStats {
  mean: number
  stdDev: number
  min: number
  max: number
  range: number
}

export function calculateFactorStats(factors: number[]): FactorStats {
  if (!factors || factors.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, range: 0 }
  }

  const mean = factors.reduce((sum, f) => sum + f, 0) / factors.length
  const variance = factors.reduce((sum, f) => sum + (f - mean) ** 2, 0) / factors.length
  const stdDev = Math.sqrt(variance)
  const min = Math.min(...factors)
  const max = Math.max(...factors)
  const range = max - min

  return { mean, stdDev, min, max, range }
}
