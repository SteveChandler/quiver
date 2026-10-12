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
 *
 * These use the canonical short URL form that the middleware serves via
 * internal rewrite (no visible redirect). Legacy `/beaches/...` paths
 * 301-redirect to these canonical URLs.
 */
export const LOCATION_URLS = {
  laJolla: "/ca/la-jolla",
  pacificBeach: "/ca/pacific-beach",
  newportBeach: "/ca/newport-beach",
  sanOnofre: "/ca/san-onofre",
  huntingtonBeach: "/ca/huntington-beach",
  ensenada: "/mexico/baja-california/ensenada",
};

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
  breadcrumb: 'nav[aria-label="breadcrumb"]',
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
    best_conditions_prose: null,
    ...overrides,
  } as unknown as BeachWithMetrics;
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
