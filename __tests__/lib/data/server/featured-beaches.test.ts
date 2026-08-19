/**
 * @jest-environment node
 */

import {
  getFeaturedBeaches,
  sortLandingFeaturedBeaches,
} from "@/lib/data/server/featured-beaches";
import type { EnrichedBeach } from "@/lib/data/server/featured-beaches";
import { FEATURED_BEACHES_LIMIT } from "@/lib/constants/featured-beaches-config";

// Mock Supabase server client
const mockFrom = jest.fn();
const mockSupabase = {
  from: mockFrom,
};
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) => beaches);
const mockBeachCandidateLimit = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));

// Mock next/cache to bypass caching in tests
jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: any) => fn),
}));

// Mock the query builder helper
jest.mock("@/lib/supabase/query-builders", () => ({
  withApprovedPhotos: jest.fn((query: any) => query),
}));

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

/**
 * Helper to set up mock Supabase responses for beach_photos and beaches tables.
 */
function setupMockQueries(
  photos: Array<{ beach_id: string; thumb_url: string; image_url: string }>,
  beaches: Array<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    slug: string | null;
    average_rating: number | null;
    review_count: number | null;
    skill_level: string | null;
    lat: number | null;
    lon: number | null;
  }>
) {
  // Create chainable query objects for both tables
  const photosChain = createChain({ data: photos, error: null });
  const beachesChain = createChain({ data: beaches, error: null });
  beachesChain.limit.mockImplementation((value: number) => {
    mockBeachCandidateLimit(value);
    return beachesChain;
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "beach_photos") return photosChain;
    if (table === "beaches") return beachesChain;
    return createChain({ data: [], error: null });
  });
}

function createChain(result: { data: any; error: any }) {
  const chain: any = {};
  const methods = [
    "select", "eq", "neq", "not", "order", "limit", "in",
    "gt", "gte", "lt", "lte", "is", "or", "filter",
  ];
  for (const method of methods) {
    chain[method] = jest.fn(() => chain);
  }
  // Make it thenable (Promise-like) for Promise.all
  chain.then = (resolve: any) => resolve(result);
  return chain;
}

// Sample beaches near NJ (lat ~40.56, lon ~-74.28)
const NJ_BEACHES = [
  { id: "nj-1", name: "Asbury Park", city: "Asbury Park", state: "NJ", slug: "asbury-park", average_rating: 4.0, review_count: 10, skill_level: "beginner", lat: 40.22, lon: -74.0 },
  { id: "nj-2", name: "Long Branch", city: "Long Branch", state: "NJ", slug: "long-branch", average_rating: 3.5, review_count: 5, skill_level: "intermediate", lat: 40.30, lon: -73.99 },
  { id: "nj-3", name: "Manasquan", city: "Manasquan", state: "NJ", slug: "manasquan", average_rating: 4.2, review_count: 15, skill_level: "advanced", lat: 40.11, lon: -74.04 },
  { id: "nj-4", name: "Belmar", city: "Belmar", state: "NJ", slug: "belmar", average_rating: 3.8, review_count: 8, skill_level: "beginner", lat: 40.17, lon: -74.02 },
];

// Sample beaches far from NJ (San Diego area)
const SD_BEACHES = [
  { id: "sd-1", name: "Blacks Beach", city: "La Jolla", state: "CA", slug: "blacks-beach", average_rating: 4.5, review_count: 50, skill_level: "advanced", lat: 32.88, lon: -117.25 },
  { id: "sd-2", name: "Pacific Beach", city: "San Diego", state: "CA", slug: "pacific-beach", average_rating: 4.0, review_count: 30, skill_level: "beginner", lat: 32.80, lon: -117.24 },
];

const ALL_BEACHES = [...NJ_BEACHES, ...SD_BEACHES];

// Photos for some beaches
const PHOTOS = [
  { beach_id: "nj-1", thumb_url: "https://example.com/nj1-thumb.jpg", image_url: "https://example.com/nj1.jpg" },
  { beach_id: "nj-2", thumb_url: "https://example.com/nj2-thumb.jpg", image_url: "https://example.com/nj2.jpg" },
  { beach_id: "nj-3", thumb_url: "https://example.com/nj3-thumb.jpg", image_url: "https://example.com/nj3.jpg" },
  { beach_id: "nj-4", thumb_url: "https://example.com/nj4-thumb.jpg", image_url: "https://example.com/nj4.jpg" },
  { beach_id: "sd-1", thumb_url: "https://example.com/sd1-thumb.jpg", image_url: "https://example.com/sd1.jpg" },
  { beach_id: "sd-2", thumb_url: "https://example.com/sd2-thumb.jpg", image_url: "https://example.com/sd2.jpg" },
];

describe("getFeaturedBeaches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns { beaches, isNearby: true } when enough nearby beaches found", async () => {
    setupMockQueries(PHOTOS, ALL_BEACHES);

    // NJ coordinates - should find NJ beaches nearby
    const result = await getFeaturedBeaches({
      coordinates: { lat: 40.56, lon: -74.28 },
      radiusMiles: 150,
    });

    expect(result.isNearby).toBe(true);
    expect(result.beaches.length).toBeGreaterThanOrEqual(4);
    // All nearby beaches should be NJ beaches
    const beachNames = result.beaches.map((b) => b.name);
    expect(beachNames).toContain("Asbury Park");
  });

  it("falls back to global list when fewer than 4 nearby beaches have photos", async () => {
    // Only 1 NJ beach with photo — below MIN_NEARBY_RESULTS (4), so falls back to global
    const singleNJBeach = [NJ_BEACHES[0]];
    const singleNJPhoto = [PHOTOS[0]];
    setupMockQueries(
      [...singleNJPhoto, ...PHOTOS.filter((p) => p.beach_id.startsWith("sd"))],
      [...singleNJBeach, ...SD_BEACHES]
    );

    const result = await getFeaturedBeaches({
      coordinates: { lat: 40.56, lon: -74.28 },
      radiusMiles: 150,
    });

    expect(result.isNearby).toBe(false);
    // Should return global list (includes all beaches with photos)
    expect(result.beaches.length).toBeGreaterThanOrEqual(1);
  });

  it("returns { beaches, isNearby: false } when no beaches are within radius", async () => {
    // Only SD beaches - none near NJ
    setupMockQueries(
      PHOTOS.filter((p) => p.beach_id.startsWith("sd")),
      SD_BEACHES
    );

    const result = await getFeaturedBeaches({
      coordinates: { lat: 40.56, lon: -74.28 },
      radiusMiles: 150,
    });

    expect(result.isNearby).toBe(false);
  });

  it("returns { beaches, isNearby: false } when no coordinates provided", async () => {
    setupMockQueries(PHOTOS, ALL_BEACHES);

    const result = await getFeaturedBeaches();

    expect(result.isNearby).toBe(false);
    expect(Array.isArray(result.beaches)).toBe(true);
  });

  it("over-fetches featured candidates before filtering held beaches", async () => {
    setupMockQueries(PHOTOS, ALL_BEACHES);

    await getFeaturedBeaches();

    expect(mockBeachCandidateLimit).toHaveBeenCalledWith(
      FEATURED_BEACHES_LIMIT * 3 + 5,
    );
  });

  it("does not return a held beach from featured ranking", async () => {
    mockRankBeaches.mockImplementation(async (beaches: Array<{ id: string }>) =>
      beaches.filter((beach) => beach.id !== "held-beach"),
    );
    setupMockQueries(PHOTOS, [
      { ...NJ_BEACHES[0], id: "held-beach", name: "Held Beach" },
      NJ_BEACHES[1],
    ]);

    const result = await getFeaturedBeaches();

    expect(result.beaches.map(({ id }) => id)).not.toContain("held-beach");
    expect(mockRankBeaches).toHaveBeenCalled();
  });
});

describe("sortLandingFeaturedBeaches", () => {
  function beach(
    id: string,
    name: string,
    skill_level: string | null,
    score: number,
    average_rating = 4
  ): EnrichedBeach {
    return {
      id,
      name,
      city: "San Diego",
      state: "CA",
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      average_rating,
      review_count: 10,
      skill_level,
      photo_url: `https://example.com/${id}.jpg`,
      has_real_photo: true,
      score,
    };
  }

  it("prioritizes beginner and intermediate beaches over advanced score-only winners", () => {
    const result = sortLandingFeaturedBeaches([
      beach("expert", "Expert Reef", "expert", 92),
      beach("advanced", "Advanced Slab", "advanced", 88),
      beach("intermediate", "Intermediate Beach", "intermediate", 55),
      beach("beginner", "Beginner Cove", "beginner", 48),
    ]);

    expect(result.map((item) => item.name)).toEqual([
      "Beginner Cove",
      "Intermediate Beach",
      "Advanced Slab",
      "Expert Reef",
    ]);
  });

  it("uses score and rating only within the same landing skill tier", () => {
    const result = sortLandingFeaturedBeaches([
      beach("lower", "Lower Score Beginner", "beginner", 48, 4.8),
      beach("higher", "Higher Score Beginner", "beginner", 65, 3.8),
      beach("intermediate", "Intermediate Beach", "intermediate", 80, 4.9),
    ]);

    expect(result.map((item) => item.name)).toEqual([
      "Higher Score Beginner",
      "Lower Score Beginner",
      "Intermediate Beach",
    ]);
  });
});
