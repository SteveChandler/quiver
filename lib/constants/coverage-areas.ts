/**
 * Geographic coverage areas and related messaging for search functionality
 * 
 * Coverage includes: California (San Diego to Santa Barbara), Oregon, Washington,
 * Hawaii, and Northern Baja California (Mexico).
 */

// Default map center (San Diego) - used when no user location available
export const DEFAULT_MAP_CENTER = {
  name: "San Diego",
  center: {
    lat: 32.7503,
    lng: -117.2534, // Ocean Beach
  },
} as const;

// Regions with active forecast coverage
export const COVERED_REGIONS = [
  "San Diego County, CA",
  "Orange County, CA",
  "Los Angeles County, CA",
  "Ventura County, CA",
  "Santa Barbara County, CA",
  "Central Coast, CA",
  "Oregon Coast",
  "Washington Coast",
  "Hawaii",
  "Baja California, Mexico",
] as const;

// Popular out-of-area searches (locations we DON'T cover)
export const OUT_OF_AREA_EXAMPLES = {
  tampico: {
    location: "Tampico, Mexico",
    distance_miles: 1200,
    country: "Mexico",
  },
  florida: {
    location: "Florida",
    distance_miles: 2200,
    country: "USA",
  },
  "cocoa beach": {
    location: "Cocoa Beach, Florida",
    distance_miles: 2200,
    country: "USA",
  },
  miami: {
    location: "Miami, Florida",
    distance_miles: 2400,
    country: "USA",
  },
  "new jersey": {
    location: "New Jersey",
    distance_miles: 2700,
    country: "USA",
  },
  australia: {
    location: "Australia",
    distance_miles: 7500,
    country: "Australia",
  },
  bali: {
    location: "Bali, Indonesia",
    distance_miles: 8500,
    country: "Indonesia",
  },
} as const;

// Messaging templates for different scenarios
export const COVERAGE_MESSAGES = {
  OUT_OF_AREA_TITLE: "Beach not in our coverage area",
  OUT_OF_AREA_EXPLANATION:
    "Quiver covers the US West Coast, Hawaii, and Baja California. We're showing you a nearby beach instead.",
  COVERAGE_AREA_INFO:
    "📍 Coverage: California, Oregon, Washington, Hawaii & Baja",

  // Dynamic messages based on search
  getOutOfAreaMessage: (searchTerm: string, detectedLocation?: string) => {
    const example =
      OUT_OF_AREA_EXAMPLES[
        searchTerm.toLowerCase() as keyof typeof OUT_OF_AREA_EXAMPLES
      ];

    if (example) {
      return `"${example.location}" is not in our coverage area yet. Quiver currently covers the US West Coast, Hawaii, and Baja California.`;
    }

    if (detectedLocation) {
      return `"${detectedLocation}" appears to be outside our coverage area.`;
    }

    return `"${searchTerm}" doesn't match any beaches in our coverage area. Try searching for a specific beach name.`;
  },

  getSuggestionMessage: (fallbackBeachName: string) => {
    return `We're showing you ${fallbackBeachName} instead. Try searching for a specific beach:`;
  },

  getCoverageExpansionMessage: () => {
    return "Want us to add beaches in your area? Let us know which regions you'd like to see!";
  },
} as const;

// Utility to calculate distance from a reference point
export function getDistanceFromPoint(
  lat: number,
  lng: number,
  refLat: number = DEFAULT_MAP_CENTER.center.lat,
  refLng: number = DEFAULT_MAP_CENTER.center.lng
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat - refLat) * Math.PI) / 180;
  const dLng = ((lng - refLng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((refLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Detect if a search term is likely outside our coverage area.
 * 
 * Coverage includes: California, Oregon, Washington, Hawaii, and Baja California.
 * Only returns true for searches that clearly indicate uncovered regions
 * (e.g., Florida, East Coast, international locations outside Baja).
 */
export function isLikelyOutOfAreaSearch(searchTerm: string): boolean {
  const normalized = searchTerm.toLowerCase().trim();

  // Check against known out-of-area examples (Florida, Australia, etc.)
  if (OUT_OF_AREA_EXAMPLES[normalized as keyof typeof OUT_OF_AREA_EXAMPLES]) {
    return true;
  }

  // Only flag searches that are clearly outside our West Coast + Hawaii + Baja coverage
  const outOfAreaPatterns = [
    /florida|miami|cocoa beach|jacksonville|tampa/i,
    /east coast|new jersey|new york|carolina|virginia beach/i,
    /australia|gold coast|bondi|byron bay/i,
    /indonesia|bali/i,
    /portugal|nazare/i,
    /france|hossegor|biarritz/i,
    /south africa|jeffreys bay/i,
    /japan|chiba/i,
    /\btampico\b/i, // Tampico specifically (not general Mexico)
  ];

  return outOfAreaPatterns.some((pattern) => pattern.test(normalized));
}
