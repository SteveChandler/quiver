/**
 * Metro Area Definitions
 *
 * Defines metro areas that aggregate multiple cities/neighborhoods
 * for location browsing. Each metro has a display name and constituent cities.
 *
 * This enables aggregate location pages like "/beaches/usa/ca/san-diego"
 * that show beaches from multiple neighborhoods (La Jolla, Pacific Beach, etc.)
 *
 * Following the AllTrails-style pattern: specific neighborhoods remain primary,
 * but metros provide useful overview pages for broader geographic areas.
 */

export interface MetroAreaConfig {
  /** Metro identifier (used in URLs, must match location slug format) */
  slug: string;

  /** Display name for the metro (shown in UI) */
  displayName: string;

  /** State abbreviation (must match database state values exactly) */
  state: string;

  /** Country (must match database country values exactly) */
  country: string;

  /**
   * Array of city names that belong to this metro
   * IMPORTANT: Must match database city values EXACTLY (case-sensitive)
   * Check beaches table for exact city names before adding
   */
  cities: string[];

  /** Center coordinates of the metro area for distance calculations */
  centerCoordinates: {
    lat: number;
    lon: number;
  };

  /** Optional: SEO description for meta tags */
  description?: string;

  /** Optional: Override for page title (defaults to "Best Surf Beaches in {displayName}") */
  pageTitle?: string;
}

/**
 * Metro area definitions
 * Add new metros here to make them available throughout the app
 *
 * Each metro automatically gets:
 * - Static page generation at build time
 * - Sitemap inclusion
 * - Aggregate stats (total beaches, avg rating, etc.)
 * - Global beach ranking across all neighborhoods
 */
const METRO_AREAS: Record<string, MetroAreaConfig> = {
  'san-diego': {
    slug: 'san-diego',
    displayName: 'San Diego',
    state: 'CA',
    country: 'USA',
    cities: ['La Jolla', 'Pacific Beach', 'San Diego'],
    centerCoordinates: { lat: 32.7157, lon: -117.1611 },
    description:
      'Explore the best surf beaches across the San Diego metro area, from the world-class breaks of La Jolla to the vibrant beach scene of Pacific Beach and the iconic waves of Ocean Beach.',
    pageTitle: 'San Diego Area Surf Spots',
  },
  // Future metros can be added here following the same pattern:
  //
  // 'los-angeles': {
  //   slug: 'los-angeles',
  //   displayName: 'Los Angeles',
  //   state: 'CA',
  //   country: 'USA',
  //   cities: ['Malibu', 'Santa Monica', 'Manhattan Beach', 'Hermosa Beach', 'Venice'],
  //   description: 'Discover top surf beaches in the Greater Los Angeles area, from Malibu\'s legendary point breaks to the South Bay beach towns.',
  //   pageTitle: 'Los Angeles Area Surf Spots',
  // },
  //
  // 'san-francisco': {
  //   slug: 'san-francisco',
  //   displayName: 'San Francisco',
  //   state: 'CA',
  //   country: 'USA',
  //   cities: ['San Francisco', 'Pacifica', 'Half Moon Bay'],
  //   description: 'Experience Northern California\'s cold-water surf breaks in the San Francisco Bay Area.',
  //   pageTitle: 'San Francisco Bay Area Surf Spots',
  // },
  //
  'orange-county': {
    slug: 'orange-county',
    displayName: 'Orange County',
    state: 'CA',
    country: 'USA',
    cities: ['Huntington Beach', 'Newport Beach', 'Newport Coast', 'San Clemente', 'Laguna Beach', 'Dana Point'],
    centerCoordinates: { lat: 33.7175, lon: -117.8311 },
    description: 'Surf the famous beaches of Orange County, California\'s premier surf destination.',
    pageTitle: 'Orange County Surf Spots',
  },
};

/**
 * Export metro areas for use in location matching
 */
export { METRO_AREAS };

/**
 * Get all metro areas as an array
 */
export function getAllMetroAreas(): MetroAreaConfig[] {
  return Object.values(METRO_AREAS);
}

/**
 * Check if a city slug corresponds to a metro area
 *
 * @param citySlug - The city slug from URL params (e.g., "san-diego", "la-jolla")
 * @returns true if the slug matches a defined metro area
 *
 * @example
 * isMetroArea("san-diego") // true
 * isMetroArea("la-jolla")  // false (individual city)
 */
export function isMetroArea(citySlug: string): boolean {
  return citySlug in METRO_AREAS;
}

/**
 * Get metro configuration by slug
 *
 * @param citySlug - The city slug from URL params
 * @returns Metro configuration object or null if not a metro
 *
 * @example
 * const config = getMetroConfig("san-diego");
 * console.log(config.cities); // ['La Jolla', 'Pacific Beach', 'San Diego']
 */
export function getMetroConfig(citySlug: string): MetroAreaConfig | null {
  return METRO_AREAS[citySlug] || null;
}

/**
 * Get all metro area slugs for static generation
 *
 * Used by generateStaticParams to create pages for all metros at build time
 *
 * @returns Array of metro slugs
 *
 * @example
 * const slugs = getAllMetroSlugs(); // ['san-diego']
 */
export function getAllMetroSlugs(): string[] {
  return Object.keys(METRO_AREAS);
}
