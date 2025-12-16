/**
 * Location Mock Data Generators
 *
 * Mock data generators for Jest unit tests of location-related components,
 * server actions, and utilities. Provides realistic test data for location
 * pages, ranked beaches, and statistics.
 */

import type {
  LocationIdentifier,
  LocationStats,
  BeachWithMetrics,
  LocationPageData,
} from "@/types/location";
import type { Beach } from "@/types/database";

/**
 * Create a mock Beach object
 */
export function createMockBeach(overrides: Partial<Beach> = {}): Beach {
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
    is_private: false,
    created_at: new Date().toISOString(),
    best_conditions_prose: null,
    region_id: null,
    ...overrides,
  } as unknown as Beach;
}

/**
 * Create a mock BeachWithMetrics object
 */
export function createMockBeachWithMetrics(
  overrides: Partial<BeachWithMetrics> = {}
): BeachWithMetrics {
  return {
    ...createMockBeach(),
    compositeScore: 0.75,
    recentIntelCount: 3,
    avgConfirmations: 2.5,
    rank: 1,
    ...overrides,
  };
}

/**
 * Create an array of mock beaches with metrics
 */
export function createMockRankedBeaches(
  count: number,
  baseOverrides: Partial<BeachWithMetrics> = {}
): BeachWithMetrics[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBeachWithMetrics({
      id: `beach-${i + 1}`,
      name: `Beach ${i + 1}`,
      slug: `beach-${i + 1}`,
      compositeScore: Math.max(0.9 - i * 0.1, 0.1),
      rank: i + 1,
      review_count: Math.max(20 - i * 2, 1),
      recentIntelCount: Math.max(5 - i, 0),
      ...baseOverrides,
    })
  );
}

/**
 * Create mock location identifier
 */
export function createMockLocationIdentifier(
  overrides: Partial<LocationIdentifier> = {}
): LocationIdentifier {
  return {
    country: "USA",
    state: "CA",
    city: "La Jolla",
    ...overrides,
  };
}

/**
 * Create mock location stats
 */
export function createMockLocationStats(
  overrides: Partial<LocationStats> = {}
): LocationStats {
  return {
    locationName: "La Jolla",
    stateName: "California",
    countryName: "United States",
    totalBeaches: 5,
    averageRating: 4.2,
    totalReviews: 50,
    topBeaches: 2,
    ...overrides,
  };
}

/**
 * Create complete mock location page data
 */
export function createMockLocationPageData(
  overrides: Partial<LocationPageData> = {}
): LocationPageData {
  const beaches = createMockRankedBeaches(5);
  const stats = createMockLocationStats({
    totalBeaches: beaches.length,
    averageRating:
      beaches.reduce((sum, b) => sum + (b.average_rating || 0), 0) /
      beaches.length,
    totalReviews: beaches.reduce((sum, b) => sum + (b.review_count || 0), 0),
  });

  return {
    location: createMockLocationIdentifier(),
    stats,
    beaches,
    ...overrides,
  };
}

/**
 * Mock Supabase response for location page data query
 */
export function mockSupabaseLocationResponse(
  data: LocationPageData | null = null,
  error: any = null
) {
  return {
    data: data || createMockLocationPageData(),
    error,
  };
}

/**
 * Mock server action response for getLocationPageData
 */
export function mockGetLocationPageData(
  city: string,
  state: string,
  country: string = "USA"
): Promise<{ data: LocationPageData | null; error: any }> {
  return Promise.resolve({
    data: createMockLocationPageData({
      location: { city, state, country },
      stats: createMockLocationStats({
        locationName: city,
        stateName: state,
        countryName: country,
      }),
    }),
    error: null,
  });
}

/**
 * Mock server action response with error
 */
export function mockGetLocationPageDataError(
  errorMessage: string = "Failed to fetch location data"
): Promise<{ data: null; error: Error }> {
  return Promise.resolve({
    data: null,
    error: new Error(errorMessage),
  });
}

/**
 * Mock location stats calculation
 */
export function calculateMockLocationStats(
  beaches: BeachWithMetrics[]
): LocationStats {
  const totalReviews = beaches.reduce((sum, b) => sum + (b.review_count || 0), 0);
  const averageRating =
    beaches.length > 0
      ? beaches.reduce((sum, b) => sum + (b.average_rating || 0), 0) /
        beaches.length
      : 0;
  const topBeaches = beaches.filter((b) => b.compositeScore >= 0.8).length;

  return {
    locationName: beaches[0]?.city || "Test Location",
    stateName: beaches[0]?.state || "Test State",
    countryName: beaches[0]?.country || "Test Country",
    totalBeaches: beaches.length,
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    topBeaches,
  };
}

/**
 * Create mock beaches for a specific location
 */
export function createMockBeachesForLocation(
  city: string,
  state: string,
  country: string,
  count: number = 5
): BeachWithMetrics[] {
  return createMockRankedBeaches(count, {
    city,
    state,
    country,
  });
}

/**
 * Mock data for La Jolla location (based on real audit data)
 */
export const MOCK_LA_JOLLA_DATA: LocationPageData = {
  location: {
    city: "La Jolla",
    state: "CA",
    country: "USA",
  },
  stats: {
    locationName: "La Jolla",
    stateName: "California",
    countryName: "United States",
    totalBeaches: 6,
    averageRating: 3.84,
    totalReviews: 25,
    topBeaches: 2,
  },
  beaches: [
    createMockBeachWithMetrics({
      id: "beach-1",
      name: "Blacks Beach",
      slug: "blacks-beach",
      city: "La Jolla",
      state: "CA",
      country: "USA",
      average_rating: 4.5,
      review_count: 12,
      skill_level: "Advanced",
      compositeScore: 0.85,
      rank: 1,
    }),
    createMockBeachWithMetrics({
      id: "beach-2",
      name: "La Jolla Shores",
      slug: "la-jolla-shores",
      city: "La Jolla",
      state: "CA",
      country: "USA",
      average_rating: 4.2,
      review_count: 8,
      skill_level: "Beginner",
      compositeScore: 0.75,
      rank: 2,
    }),
    createMockBeachWithMetrics({
      id: "beach-3",
      name: "Windansea Beach",
      slug: "windansea-beach",
      city: "La Jolla",
      state: "CA",
      country: "USA",
      average_rating: 3.8,
      review_count: 5,
      skill_level: "Intermediate",
      compositeScore: 0.68,
      rank: 3,
    }),
  ],
};

/**
 * Mock data for Newport Beach location
 */
export const MOCK_NEWPORT_BEACH_DATA: LocationPageData = {
  location: {
    city: "Newport Beach",
    state: "CA",
    country: "USA",
  },
  stats: {
    locationName: "Newport Beach",
    stateName: "California",
    countryName: "United States",
    totalBeaches: 6,
    averageRating: 3.41,
    totalReviews: 28,
    topBeaches: 1,
  },
  beaches: createMockBeachesForLocation("Newport Beach", "CA", "USA", 6),
};

/**
 * Mock data for empty location (no beaches)
 */
export const MOCK_EMPTY_LOCATION_DATA: LocationPageData = {
  location: {
    city: "Empty City",
    state: "CA",
    country: "USA",
  },
  stats: {
    locationName: "Empty City",
    stateName: "California",
    countryName: "United States",
    totalBeaches: 0,
    averageRating: 0,
    totalReviews: 0,
    topBeaches: 0,
  },
  beaches: [],
};

/**
 * Helper to mock Supabase client for location queries
 */
export function createMockSupabaseClient(
  locationData: LocationPageData | null = null
) {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: locationData?.beaches || null,
              error: null,
            }),
          }),
        }),
      }),
    }),
    rpc: jest.fn().mockResolvedValue({
      data: locationData?.beaches || null,
      error: null,
    }),
  };
}

/**
 * Helper to assert beach metrics are valid
 */
export function assertValidBeachMetrics(beach: BeachWithMetrics): void {
  expect(beach.compositeScore).toBeGreaterThanOrEqual(0);
  expect(beach.compositeScore).toBeLessThanOrEqual(1);
  expect(beach.recentIntelCount).toBeGreaterThanOrEqual(0);
  expect(beach.avgConfirmations).toBeGreaterThanOrEqual(0);
  if (beach.rank) {
    expect(beach.rank).toBeGreaterThan(0);
  }
}

/**
 * Helper to assert location stats are valid
 */
export function assertValidLocationStats(stats: LocationStats): void {
  expect(stats.totalBeaches).toBeGreaterThanOrEqual(0);
  expect(stats.averageRating).toBeGreaterThanOrEqual(0);
  expect(stats.averageRating).toBeLessThanOrEqual(5);
  expect(stats.totalReviews).toBeGreaterThanOrEqual(0);
  expect(stats.topBeaches).toBeGreaterThanOrEqual(0);
  expect(stats.topBeaches).toBeLessThanOrEqual(stats.totalBeaches);
}

/**
 * Helper to assert location page data is valid
 */
export function assertValidLocationPageData(data: LocationPageData): void {
  expect(data.location).toBeDefined();
  expect(data.location.city).toBeTruthy();
  expect(data.location.state).toBeTruthy();
  expect(data.location.country).toBeTruthy();

  assertValidLocationStats(data.stats);

  expect(Array.isArray(data.beaches)).toBe(true);
  expect(data.beaches.length).toBe(data.stats.totalBeaches);

  data.beaches.forEach((beach, index) => {
    assertValidBeachMetrics(beach);
    if (beach.rank) {
      expect(beach.rank).toBe(index + 1);
    }
  });

  // Verify beaches are sorted by composite score
  for (let i = 0; i < data.beaches.length - 1; i++) {
    expect(data.beaches[i].compositeScore).toBeGreaterThanOrEqual(
      data.beaches[i + 1].compositeScore
    );
  }
}
