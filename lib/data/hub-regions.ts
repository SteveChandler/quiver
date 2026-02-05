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
  "los-angeles": {
    slug: "los-angeles",
    name: "Los Angeles",
    title: "Complete Guide to Surfing Los Angeles",
    description:
      "From Malibu's perfect points to Venice's beach breaks. LA offers diverse surf across 75 miles of coastline.",
    states: ["ca"],
    centerLat: 33.95,
    centerLon: -118.45,
    zoom: 10,
  },
  "santa-cruz": {
    slug: "santa-cruz",
    name: "Santa Cruz",
    title: "Complete Guide to Surfing Santa Cruz",
    description:
      "The birthplace of mainland surfing. World-class point breaks, consistent beach breaks, and a deep surf culture.",
    states: ["ca"],
    centerLat: 36.97,
    centerLon: -122.03,
    zoom: 11,
  },
  ventura: {
    slug: "ventura",
    name: "Ventura County",
    title: "Complete Guide to Surfing Ventura County",
    description:
      "From Rincon to County Line. Ventura County delivers some of California's most consistent waves.",
    states: ["ca"],
    centerLat: 34.28,
    centerLon: -119.25,
    zoom: 10,
  },
  florida: {
    slug: "florida",
    name: "Florida",
    title: "Complete Guide to Surfing Florida",
    description:
      "Year-round warm water surfing on both coasts. From Jacksonville to Miami, find your Florida wave.",
    states: ["fl"],
    centerLat: 28.5,
    centerLon: -80.6,
    zoom: 6,
  },
  "new-jersey": {
    slug: "new-jersey",
    name: "New Jersey",
    title: "Complete Guide to Surfing New Jersey",
    description:
      "The heart of East Coast surfing. 127 miles of coastline with beach breaks that light up on fall swells.",
    states: ["nj"],
    centerLat: 39.8,
    centerLon: -74.1,
    zoom: 8,
  },
  "outer-banks": {
    slug: "outer-banks",
    name: "Outer Banks",
    title: "Complete Guide to Surfing the Outer Banks",
    description:
      "North Carolina's barrier islands catch swell from every direction. Uncrowded peaks and warm water.",
    states: ["nc"],
    centerLat: 35.75,
    centerLon: -75.55,
    zoom: 9,
  },
  "puerto-rico": {
    slug: "puerto-rico",
    name: "Puerto Rico",
    title: "Complete Guide to Surfing Puerto Rico",
    description:
      "World-class Caribbean surf with warm water year-round. From Rincon's legendary points to Isabela's beach breaks.",
    states: ["pr"],
    centerLat: 18.22,
    centerLon: -67.15,
    zoom: 9,
  },
};

export const HUB_REGION_SLUGS = Object.keys(HUB_REGIONS);

export function getHubRegion(slug: string): HubRegion | null {
  return HUB_REGIONS[slug] || null;
}
