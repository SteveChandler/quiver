/**
 * Hub Region Configuration
 *
 * Defines regional hub pages like /guides/surfing-southern-california
 * These aggregate multiple cities/states into surf-focused regional guides
 */

export interface HubRegion {
  slug: string;
  name: string;
  title: string;
  description: string;
  states: string[]; // State slugs to include (e.g., ["ca"])
  centerLat: number;
  centerLon: number; // NOTE: Use 'lon' not 'lng' per CLAUDE.md coordinate conventions
  zoom: number;
}

export const HUB_REGIONS: Record<string, HubRegion> = {
  "southern-california": {
    slug: "southern-california",
    name: "Southern California",
    title: "Complete Guide to Surfing Southern California",
    description:
      "From Malibu to the Mexican border, Southern California offers world-class waves for every skill level. Explore 200+ surf spots across LA, Orange County, and San Diego.",
    states: ["ca"],
    centerLat: 33.5,
    centerLon: -117.8,
    zoom: 8,
  },
  "san-diego": {
    slug: "san-diego",
    name: "San Diego",
    title: "Complete Guide to Surfing San Diego",
    description:
      "San Diego delivers year-round surf with 70+ miles of coastline. From La Jolla reefs to Imperial Beach sandbars, find your perfect wave.",
    states: ["ca"],
    centerLat: 32.85,
    centerLon: -117.25,
    zoom: 10,
  },
  "orange-county": {
    slug: "orange-county",
    name: "Orange County",
    title: "Complete Guide to Surfing Orange County",
    description:
      "Home to Trestles, Huntington Beach, and The Wedge. Orange County is the heart of California surf culture.",
    states: ["ca"],
    centerLat: 33.6,
    centerLon: -117.9,
    zoom: 10,
  },
  hawaii: {
    slug: "hawaii",
    name: "Hawaii",
    title: "Complete Guide to Surfing Hawaii",
    description:
      "The birthplace of surfing. From North Shore's legendary winter swells to Waikiki's perfect learning waves.",
    states: ["hi"],
    centerLat: 21.3,
    centerLon: -157.8,
    zoom: 7,
  },
};

export const HUB_REGION_SLUGS = Object.keys(HUB_REGIONS);

export function getHubRegion(slug: string): HubRegion | null {
  return HUB_REGIONS[slug] || null;
}
