/**
 * Forecast Region Configuration
 *
 * Defines regional forecast pages like /forecast/southern-california
 * These provide 7-day surf forecasts for specific geographic areas
 */

export interface ForecastRegion {
  slug: string;
  name: string;
  title: string; // SEO page title
  metaDescription: string; // SEO meta description
  states: string[]; // State codes to filter beaches
  cities?: string[]; // Optional city filter for sub-regions
  latBounds?: { min?: number; max?: number }; // Optional latitude boundaries
  centerLat: number;
  centerLon: number; // NOTE: Use 'lon' not 'lng' per CLAUDE.md coordinate conventions
  zoom: number;
}

/** Boundary between NorCal and SoCal regions. SoCal uses max (exclusive), NorCal uses min (inclusive). */
const NORCAL_SOCAL_LATITUDE_BOUNDARY = 35.0;

export const FORECAST_REGIONS: Record<string, ForecastRegion> = {
  "southern-california": {
    slug: "southern-california",
    name: "Southern California",
    title: "Southern California Surf Forecast - 7 Day Outlook",
    metaDescription:
      "Get the complete Southern California surf forecast. Daily conditions, swell analysis, and the best days to surf SoCal this week.",
    states: ["ca"],
    latBounds: { max: NORCAL_SOCAL_LATITUDE_BOUNDARY },
    centerLat: 33.5,
    centerLon: -117.8,
    zoom: 8,
  },
  "san-diego": {
    slug: "san-diego",
    name: "San Diego",
    title: "San Diego Surf Forecast - 7 Day Outlook",
    metaDescription:
      "San Diego surf forecast with beach-by-beach conditions. Find the best waves from Imperial Beach to Oceanside.",
    states: ["ca"],
    cities: [
      "San Diego",
      "Imperial Beach",
      "Oceanside",
      "Carlsbad",
      "Encinitas",
      "Del Mar",
      "La Jolla",
    ],
    centerLat: 32.85,
    centerLon: -117.25,
    zoom: 10,
  },
  "orange-county": {
    slug: "orange-county",
    name: "Orange County",
    title: "Orange County Surf Forecast - 7 Day Outlook",
    metaDescription:
      "OC surf forecast covering Huntington, Newport, Trestles and more. Daily conditions and best days this week.",
    states: ["ca"],
    cities: [
      "Huntington Beach",
      "Newport Beach",
      "Laguna Beach",
      "Dana Point",
      "San Clemente",
    ],
    centerLat: 33.55,
    centerLon: -117.8,
    zoom: 10,
  },
  "los-angeles": {
    slug: "los-angeles",
    name: "Los Angeles",
    title: "Los Angeles Surf Forecast - 7 Day Outlook",
    metaDescription:
      "LA surf forecast from Malibu to Manhattan Beach. Get daily conditions and find the best waves this week.",
    states: ["ca"],
    // Note: Seal Beach is geographically in Orange County but included here for UX convenience.
    // This creates intentional overlap with the orange-county region, allowing users
    // to find Seal Beach from either the LA or OC forecast pages.
    cities: [
      "Malibu",
      "Santa Monica",
      "Venice",
      "Manhattan Beach",
      "Hermosa Beach",
      "Redondo Beach",
      "El Segundo",
      "Playa del Rey",
      "Torrance",
      "Palos Verdes",
      "Long Beach",
      "Seal Beach",
    ],
    centerLat: 33.95,
    centerLon: -118.45,
    zoom: 10,
  },
  "northern-california": {
    slug: "northern-california",
    name: "Northern California",
    title: "Northern California Surf Forecast - 7 Day Outlook",
    metaDescription:
      "NorCal surf forecast with conditions from Santa Cruz to San Francisco. Plan your session with our 7-day outlook.",
    states: ["ca"],
    latBounds: { min: NORCAL_SOCAL_LATITUDE_BOUNDARY },
    centerLat: 37.5,
    centerLon: -122.3,
    zoom: 8,
  },
  "puerto-rico": {
    slug: "puerto-rico",
    name: "Puerto Rico",
    title: "Puerto Rico Surf Forecast - 7 Day Outlook",
    metaDescription:
      "Puerto Rico surf forecast covering Rincon, Isabela, and the north shore. Warm water waves year-round.",
    states: ["pr"],
    centerLat: 18.22,
    centerLon: -67.15,
    zoom: 9,
  },
};

/**
 * Get all forecast region slugs
 */
export function getAllForecastRegionSlugs(): string[] {
  return Object.keys(FORECAST_REGIONS);
}

/**
 * Get a specific forecast region by slug
 * Returns undefined if not found
 */
export function getForecastRegion(slug: string): ForecastRegion | undefined {
  return FORECAST_REGIONS[slug];
}

/** Forecast regions that don't have their own guide and map to a parent */
const GUIDE_SLUG_OVERRIDES: Record<string, string> = {
  "los-angeles": "southern-california",
};

/**
 * Get the appropriate surf guide slug for a forecast region
 *
 * Most regions map directly to their own guide (e.g. san-diego -> surfing-san-diego).
 * Regions without a dedicated guide fall back to a parent guide via GUIDE_SLUG_OVERRIDES.
 *
 * @param regionSlug - The forecast region slug
 * @returns The corresponding surf guide slug
 *
 * @example
 * ```typescript
 * getGuideSlugForRegion("san-diego")     // "san-diego"
 * getGuideSlugForRegion("los-angeles")   // "southern-california"
 * getGuideSlugForRegion("puerto-rico")   // "puerto-rico"
 * ```
 */
export function getGuideSlugForRegion(regionSlug: string): string {
  return GUIDE_SLUG_OVERRIDES[regionSlug] ?? regionSlug;
}

/**
 * Get the forecast region slug for a given city name.
 * Returns null if the city doesn't belong to any region with a cities list.
 */
let cityToRegionMap: Map<string, string> | null = null;

export function getForecastRegionForCity(city: string): string | null {
  if (!cityToRegionMap) {
    cityToRegionMap = new Map();
    for (const region of Object.values(FORECAST_REGIONS)) {
      if (region.cities) {
        for (const c of region.cities) {
          cityToRegionMap.set(c.toLowerCase(), region.slug);
        }
      }
    }
  }
  return cityToRegionMap.get(city.toLowerCase()) ?? null;
}
