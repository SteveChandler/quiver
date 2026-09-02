/**
 * Cam Region Definitions
 *
 * Maps US states to surfing regions for the /cams directory pages.
 * Each region groups beaches by geographic proximity and surfing culture.
 */

export interface CamRegion {
  slug: string;
  name: string;
  /** US state codes included in this region */
  states: string[];
  /** Short description for SEO and display */
  description: string;
  /**
   * Set when a curated /surf-cams page already owns this region's search
   * demand. The /cams/<slug> URL then permanently redirects there, stays out
   * of the sitemap and IndexNow, and every hub link points at the owner.
   */
  canonicalPath?: string;
}

export const CAM_REGIONS: CamRegion[] = [
  {
    slug: "southern-california",
    name: "Southern California",
    states: [], // Uses city-based filtering (see below)
    description:
      "Live surf cams from San Diego to Huntington Beach — the heart of California surfing.",
  },
  {
    slug: "central-california",
    name: "Central California",
    states: [], // Uses city-based filtering
    description:
      "Live surf cams from Malibu to Santa Barbara — iconic point breaks and beach breaks.",
  },
  {
    slug: "northern-california",
    name: "Northern California",
    states: [], // Uses city-based filtering
    description:
      "Live surf cams from San Francisco to Santa Cruz — NorCal's best waves.",
  },
  {
    slug: "hawaii",
    name: "Hawaii",
    states: ["HI"],
    description:
      "Live surf cams across Oahu, Kauai, Maui, and the Big Island — watch Pipeline, Waikiki, and more.",
  },
  {
    slug: "florida",
    name: "Florida",
    states: ["FL"],
    canonicalPath: "/surf-cams/florida",
    description:
      "Live surf cams from Jacksonville to South Florida — East Coast swells and Gulf breaks.",
  },
  {
    slug: "pacific-northwest",
    name: "Pacific Northwest",
    states: ["OR", "WA"],
    description:
      "Live surf cams across Oregon and Washington — rugged coastline and powerful swells.",
  },
  {
    slug: "east-coast",
    name: "East Coast",
    states: ["NC", "NJ", "SC", "ME"],
    description:
      "Live surf cams from the Outer Banks to Maine — hurricane swells and nor'easters.",
  },
  {
    slug: "texas",
    name: "Texas",
    states: ["TX"],
    description:
      "Live surf cams on the Texas Gulf Coast — Port Aransas and South Padre Island.",
  },
];

/**
 * Southern California cities (San Diego metro through Orange County / south LA)
 */
const SOCAL_CITIES = new Set([
  "San Diego",
  "Imperial Beach",
  "La Jolla",
  "Del Mar",
  "Encinitas",
  "Carlsbad",
  "Oceanside",
  "Dana Point",
  "San Clemente",
  "Newport Beach",
  "Huntington Beach",
  "Coronado",
]);

/**
 * Central California cities (LA coast through Santa Barbara / Ventura)
 */
const CENTRAL_CA_CITIES = new Set([
  "Malibu",
  "Venice",
  "Manhattan Beach",
  "Hermosa Beach",
  "Santa Barbara",
  "Ventura",
  "Los Angeles",
]);

/**
 * Determine which cam region a beach belongs to based on state + city.
 * California beaches are split into 3 sub-regions by city.
 */
export function getRegionForBeach(state: string, city: string): string {
  if (state === "CA") {
    if (SOCAL_CITIES.has(city)) return "southern-california";
    if (CENTRAL_CA_CITIES.has(city)) return "central-california";
    return "northern-california";
  }

  const region = CAM_REGIONS.find((r) => r.states.includes(state));
  return region?.slug ?? "east-coast";
}

/**
 * Get a region definition by slug.
 */
export function getCamRegionBySlug(slug: string): CamRegion | undefined {
  return CAM_REGIONS.find((r) => r.slug === slug);
}

/**
 * Get all valid cam region slugs (for generateStaticParams / validation).
 */
export function getAllCamRegionSlugs(): string[] {
  return CAM_REGIONS.map((r) => r.slug);
}

/**
 * Cam region slugs whose /cams/<slug> page is the canonical, indexable URL.
 * Use this for the sitemap and IndexNow so redirecting URLs are never
 * advertised to crawlers.
 */
export function getIndexableCamRegionSlugs(): string[] {
  return CAM_REGIONS.filter((r) => !r.canonicalPath).map((r) => r.slug);
}

/**
 * Public path for a cam region: the curated owner page when one exists,
 * otherwise the /cams/<slug> directory page.
 */
export function getCamRegionPath(
  region: Pick<CamRegion, "slug" | "canonicalPath">,
): string {
  return region.canonicalPath ?? `/cams/${region.slug}`;
}
