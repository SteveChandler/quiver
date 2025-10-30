/**
 * Location Test Data Fixtures
 *
 * Test data for location pages E2E tests including locations,
 * stats, and ranked beaches for comprehensive testing.
 */

import type {
  LocationIdentifier,
  LocationStats,
  BeachWithMetrics,
} from "@/types/location";

/**
 * Pre-defined test locations matching real data in the database
 * These are known to have good data quality from the audit
 */
export const TEST_LOCATIONS: Record<string, LocationIdentifier> = {
  laJolla: {
    city: "La Jolla",
    state: "CA",
    country: "USA",
  },
  pacificBeach: {
    city: "Pacific Beach",
    state: "CA",
    country: "USA",
  },
  newportBeach: {
    city: "Newport Beach",
    state: "CA",
    country: "USA",
  },
  sanOnofre: {
    city: "San Onofre",
    state: "CA",
    country: "USA",
  },
  huntingtonBeach: {
    city: "Huntington Beach",
    state: "CA",
    country: "USA",
  },
  ensenada: {
    city: "Ensenada",
    state: "Baja California",
    country: "Mexico",
  },
};

/**
 * Location URLs for navigation tests
 */
export const LOCATION_URLS = {
  laJolla: "/beaches/usa/ca/la-jolla",
  pacificBeach: "/beaches/usa/ca/pacific-beach",
  newportBeach: "/beaches/usa/ca/newport-beach",
  sanOnofre: "/beaches/usa/ca/san-onofre",
  huntingtonBeach: "/beaches/usa/ca/huntington-beach",
  ensenada: "/beaches/mexico/baja-california/ensenada",
};

/**
 * Mock location statistics for testing
 * Based on real data from the data quality audit
 */
export const MOCK_LOCATION_STATS: Record<string, LocationStats> = {
  laJolla: {
    locationName: "La Jolla",
    stateName: "California",
    countryName: "United States",
    totalBeaches: 6,
    averageRating: 3.84,
    totalReviews: 25,
    topBeaches: 2,
  },
  newportBeach: {
    locationName: "Newport Beach",
    stateName: "California",
    countryName: "United States",
    totalBeaches: 6,
    averageRating: 3.41,
    totalReviews: 28,
    topBeaches: 1,
  },
  sanOnofre: {
    locationName: "San Onofre",
    stateName: "California",
    countryName: "United States",
    totalBeaches: 7,
    averageRating: 3.19,
    totalReviews: 30,
    topBeaches: 1,
  },
};

/**
 * Mock ranked beaches for location pages
 * These represent beaches with composite scores and ranking data
 */
export const MOCK_RANKED_BEACHES: BeachWithMetrics[] = [
  {
    id: "beach-1",
    name: "Blacks Beach",
    slug: "blacks-beach",
    city: "La Jolla",
    state: "CA",
    country: "USA",
    lat: 32.8857,
    lon: -117.2511,
    average_rating: 4.5,
    review_count: 12,
    skill_level: "Advanced",
    break_type: "Beach Break",
    crowd_level: "Moderate",
    description: "Premier surf spot known for powerful waves",
    compositeScore: 0.85,
    recentIntelCount: 5,
    avgConfirmations: 3.2,
    rank: 1,
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    swell_rating: null,
    wind_rating: null,
    best_conditions_prose: null,
    region_id: null,
  },
  {
    id: "beach-2",
    name: "La Jolla Shores",
    slug: "la-jolla-shores",
    city: "La Jolla",
    state: "CA",
    country: "USA",
    lat: 32.8572,
    lon: -117.2540,
    average_rating: 4.2,
    review_count: 8,
    skill_level: "Beginner",
    break_type: "Beach Break",
    crowd_level: "Crowded",
    description: "Beginner-friendly beach with gentle waves",
    compositeScore: 0.75,
    recentIntelCount: 3,
    avgConfirmations: 2.5,
    rank: 2,
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    swell_rating: null,
    wind_rating: null,
    best_conditions_prose: null,
    region_id: null,
  },
  {
    id: "beach-3",
    name: "Windansea Beach",
    slug: "windansea-beach",
    city: "La Jolla",
    state: "CA",
    country: "USA",
    lat: 32.8314,
    lon: -117.2800,
    average_rating: 3.8,
    review_count: 5,
    skill_level: "Intermediate",
    break_type: "Reef Break",
    crowd_level: "Very Crowded",
    description: "Famous reef break with consistent waves",
    compositeScore: 0.68,
    recentIntelCount: 2,
    avgConfirmations: 1.8,
    rank: 3,
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    swell_rating: null,
    wind_rating: null,
    best_conditions_prose: null,
    region_id: null,
  },
];

/**
 * Expected ranking tiers based on composite scores
 */
export const RANKING_TIERS = {
  topRated: 0.8, // "Top Rated" badge
  highlyRated: 0.6, // "Highly Rated" badge
  popular: 0.4, // "Popular" badge
};

/**
 * Test data for breadcrumb navigation
 */
export const BREADCRUMB_TEST_CASES = [
  {
    location: TEST_LOCATIONS.laJolla,
    expectedSegments: [
      { label: "Map", url: "/map" },
      { label: "CA", url: "/beaches/usa/ca" },
      { label: "La Jolla", url: "/beaches/usa/ca/la-jolla" },
    ],
  },
  {
    location: TEST_LOCATIONS.ensenada,
    expectedSegments: [
      { label: "Map", url: "/map" },
      { label: "Mexico", url: "/beaches/mexico" },
      { label: "Baja California", url: "/beaches/mexico/baja-california" },
      { label: "Ensenada", url: "/beaches/mexico/baja-california/ensenada" },
    ],
  },
];

/**
 * Selector constants for E2E tests
 */
export const LOCATION_PAGE_SELECTORS = {
  pageTitle: '[data-testid="location-page-title"]',
  locationName: '[data-testid="location-name"]',
  totalBeaches: '[data-testid="total-beaches"]',
  averageRating: '[data-testid="average-rating"]',
  totalReviews: '[data-testid="total-reviews"]',
  beachCard: '[data-testid="beach-card"]',
  beachRank: '[data-testid="beach-rank"]',
  beachName: '[data-testid="beach-name"]',
  beachRating: '[data-testid="beach-rating"]',
  rankingBadge: '[data-testid="ranking-badge"]',
  locationMap: '[data-testid="location-map"]',
  mapMarker: '[data-testid="map-marker"]',
  breadcrumb: '[data-testid="breadcrumb"]',
  breadcrumbSegment: '[data-testid="breadcrumb-segment"]',
  emptyState: '[data-testid="empty-state"]',
} as const;

/**
 * Timeouts for location page tests
 */
export const LOCATION_PAGE_TIMEOUTS = {
  pageLoad: 10000,
  statsLoad: 5000,
  beachesLoad: 8000,
  mapLoad: 15000,
  navigation: 5000,
} as const;

/**
 * Helper to create a mock beach with custom properties
 */
export function createMockBeachWithMetrics(
  overrides: Partial<BeachWithMetrics> = {}
): BeachWithMetrics {
  return {
    id: `beach-${Math.random().toString(36).substr(2, 9)}`,
    name: "Test Beach",
    slug: "test-beach",
    city: "La Jolla",
    state: "CA",
    country: "USA",
    lat: 32.8572,
    lon: -117.2540,
    average_rating: 4.0,
    review_count: 10,
    skill_level: "Intermediate",
    break_type: "Beach Break",
    crowd_level: "Moderate",
    description: "Test beach description",
    compositeScore: 0.7,
    recentIntelCount: 2,
    avgConfirmations: 2.0,
    rank: 1,
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    swell_rating: null,
    wind_rating: null,
    best_conditions_prose: null,
    region_id: null,
    ...overrides,
  };
}

/**
 * Helper to create mock location stats
 */
export function createMockLocationStats(
  overrides: Partial<LocationStats> = {}
): LocationStats {
  return {
    locationName: "Test City",
    stateName: "Test State",
    countryName: "Test Country",
    totalBeaches: 5,
    averageRating: 4.0,
    totalReviews: 50,
    topBeaches: 2,
    ...overrides,
  };
}

/**
 * Helper to create an array of ranked beaches
 */
export function createMockRankedBeaches(count: number): BeachWithMetrics[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBeachWithMetrics({
      id: `beach-${i + 1}`,
      name: `Beach ${i + 1}`,
      slug: `beach-${i + 1}`,
      compositeScore: 0.9 - i * 0.1, // Descending scores
      rank: i + 1,
      review_count: 20 - i * 2, // Descending review count
      recentIntelCount: 5 - i,
    })
  );
}
