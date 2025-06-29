/**
 * Geographic coverage areas and related messaging for search functionality
 */

// San Diego County coverage area bounds
export const SAN_DIEGO_COVERAGE = {
  name: "San Diego County",
  bounds: {
    north: 33.5, // Oceanside/Carlsbad area
    south: 32.58, // Just north of Tijuana border, includes Imperial Beach
    east: -116.5, // East County mountains
    west: -117.7, // Pacific Ocean
  },
  center: {
    lat: 32.7503,
    lng: -117.2534, // Ocean Beach
  },
  radius_miles: 50,
} as const;

// Popular out-of-area searches and their distances from San Diego
export const OUT_OF_AREA_EXAMPLES = {
  tampico: {
    location: "Tampico, Mexico",
    distance_miles: 1200,
    country: "Mexico",
  },
  malibu: {
    location: "Malibu, California",
    distance_miles: 220,
    country: "USA",
  },
  "huntington beach": {
    location: "Huntington Beach, California",
    distance_miles: 90,
    country: "USA",
  },
  "santa monica": {
    location: "Santa Monica, California",
    distance_miles: 210,
    country: "USA",
  },
  "manhattan beach": {
    location: "Manhattan Beach, California",
    distance_miles: 200,
    country: "USA",
  },
  "venice beach": {
    location: "Venice Beach, California",
    distance_miles: 210,
    country: "USA",
  },
  "hermosa beach": {
    location: "Hermosa Beach, California",
    distance_miles: 195,
    country: "USA",
  },
  hawaii: {
    location: "Hawaii",
    distance_miles: 2400,
    country: "USA",
  },
  pipeline: {
    location: "Pipeline, Hawaii",
    distance_miles: 2400,
    country: "USA",
  },
  waikiki: {
    location: "Waikiki, Hawaii",
    distance_miles: 2400,
    country: "USA",
  },
} as const;

// Messaging templates for different scenarios
export const COVERAGE_MESSAGES = {
  OUT_OF_AREA_TITLE: "Beach not in our coverage area",
  OUT_OF_AREA_EXPLANATION:
    "Quiver currently covers San Diego County beaches. We're showing you a nearby San Diego beach instead.",
  COVERAGE_AREA_INFO:
    "📍 Current coverage: San Diego County beaches from Oceanside to Imperial Beach",

  // Dynamic messages based on search
  getOutOfAreaMessage: (searchTerm: string, detectedLocation?: string) => {
    const example =
      OUT_OF_AREA_EXAMPLES[
        searchTerm.toLowerCase() as keyof typeof OUT_OF_AREA_EXAMPLES
      ];

    if (example) {
      return `"${example.location}" is about ${example.distance_miles} miles from San Diego. Quiver currently covers San Diego County beaches.`;
    }

    if (detectedLocation) {
      return `"${detectedLocation}" appears to be outside our San Diego coverage area.`;
    }

    return `"${searchTerm}" doesn't match any beaches in our San Diego coverage area.`;
  },

  getSuggestionMessage: (fallbackBeachName: string) => {
    return `We're showing you ${fallbackBeachName} instead. Try searching for one of these San Diego beaches:`;
  },

  getCoverageExpansionMessage: () => {
    return "Want us to add beaches in your area? Let us know which regions you'd like to see added!";
  },
} as const;

// Utility function to check if coordinates are within San Diego coverage
export function isWithinSanDiegoCoverage(lat: number, lng: number): boolean {
  const { bounds } = SAN_DIEGO_COVERAGE;
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west && // west is more negative
    lng <= bounds.east // east is less negative
  );
}

// Utility to calculate distance from San Diego center
export function getDistanceFromSanDiego(lat: number, lng: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat - SAN_DIEGO_COVERAGE.center.lat) * Math.PI) / 180;
  const dLng = ((lng - SAN_DIEGO_COVERAGE.center.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((SAN_DIEGO_COVERAGE.center.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Utility to detect if a search term is likely out of area
export function isLikelyOutOfAreaSearch(searchTerm: string): boolean {
  const normalized = searchTerm.toLowerCase().trim();

  // First check if it's a known San Diego beach - these should never be flagged as out-of-area
  const sanDiegoBeachPatterns = [
    /ocean beach|ob/i,
    /pacific beach|pb/i,
    /mission beach/i,
    /la jolla/i,
    /del mar/i,
    /solana beach/i,
    /carlsbad|tamarack/i,
    /encinitas/i,
    /leucadia/i,
    /moonlight beach/i,
    /swami/i,
    /cardiff/i,
    /imperial beach/i,
    /sunset cliffs/i,
    /windansea/i,
    /blacks beach/i,
    /torrey pines/i,
  ];

  // If it matches a San Diego beach, it's not out-of-area
  if (sanDiegoBeachPatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  // Check against known out-of-area examples
  if (OUT_OF_AREA_EXAMPLES[normalized as keyof typeof OUT_OF_AREA_EXAMPLES]) {
    return true;
  }

  // Check for common patterns that indicate out-of-area searches
  const outOfAreaPatterns = [
    /hawaii|oahu|maui/i,
    /mexico|tampico|ensenada/i,
    /orange county|oc|newport/i,
    /\blos angeles\b|\bmalibu\b|\bsanta monica\b|\bvenice beach\b|\bmanhattan beach\b|\bhermosa beach\b/i,
    /san francisco|sf|pacifica|santa cruz/i,
    /florida|miami|cocoa beach/i,
    /australia|gold coast|bondi/i,
  ];

  return outOfAreaPatterns.some((pattern) => pattern.test(normalized));
}
