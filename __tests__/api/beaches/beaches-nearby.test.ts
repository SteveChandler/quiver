/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";

/**
 * Tests for GET /api/beaches/nearby
 *
 * This endpoint returns beaches within a specified radius of given coordinates.
 * Uses normalizeCoordinates to accept various coordinate formats (lat/lon, latitude/longitude, lng).
 *
 * COORDINATE NAMING: Uses 'lat' and 'lon' (NOT 'lng') per CLAUDE.md conventions.
 * The route accepts legacy 'lng' for backward compatibility but new code should use 'lon'.
 */

// Mock Supabase client before imports
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
  createPublicReadClient: jest.fn(() => mockSupabaseClient),
}));

// Mock the rate limiter to avoid rate limiting during tests
jest.mock("@/lib/utils/enhanced-rate-limiter", () => ({
  getCachedRateLimiter: () => ({
    canMakeRequest: () => true,
    recordRequest: jest.fn(),
    getRetryAfter: () => 0,
    getStatus: () => ({ requestsRemaining: 100, timeUntilReset: 60000 }),
  }),
}));

// Mock rate limit config
jest.mock("@/lib/api/rate-limit-config", () => ({
  RATE_LIMITS: {
    "public-default": { requestsPerMinute: 60, burstLimit: 10 },
  },
  getRateLimitMessage: () => "Rate limit exceeded",
}));

// Mock rate limit telemetry
jest.mock("@/lib/monitoring/rate-limit-telemetry", () => ({
  logRateLimitViolation: jest.fn(),
}));

const mockRankBeaches = jest.fn(async <T extends { id: string }>(beaches: T[]) =>
  beaches,
);

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

// Sample beach data for tests
const mockBeaches = [
  {
    id: "beach-1",
    name: "Ocean Beach",
    lat: 32.75,
    lon: -117.25,
    slug: "ocean-beach",
    city: "San Diego",
    state: "CA",
    country: "USA",
  },
  {
    id: "beach-2",
    name: "Pacific Beach",
    lat: 32.80,
    lon: -117.24,
    slug: "pacific-beach",
    city: "San Diego",
    state: "CA",
    country: "USA",
  },
  {
    id: "beach-3",
    name: "La Jolla Shores",
    lat: 32.85,
    lon: -117.26,
    slug: "la-jolla-shores",
    city: "La Jolla",
    state: "CA",
    country: "USA",
  },
  {
    id: "beach-4",
    name: "Distant Beach",
    lat: 34.00,
    lon: -118.50,
    slug: "distant-beach",
    city: "Los Angeles",
    state: "CA",
    country: "USA",
  },
];

describe("GET /api/beaches/nearby", () => {
  let GET: any;
  let NextRequest: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Import fresh module for each test
    const route = await import("@/app/api/beaches/nearby/route");
    GET = route.GET;

    // Import NextRequest
    const nextServer = await import("next/server");
    NextRequest = nextServer.NextRequest;

    mockSupabaseClient.rpc.mockImplementation((_, args) => {
      const radiusMiles = args.max_distance_meters / 1609.34;
      const data = mockBeaches
        .map((beach) => ({
          ...beach,
          distance: calculateDistanceInMiles(
            { lat: args.input_lat, lon: args.input_lng },
            { lat: beach.lat, lon: beach.lon },
          ),
        }))
        .filter((beach) => beach.distance <= radiusMiles)
        .sort((left, right) => left.distance - right.distance)
        .slice(0, args.limit_count);
      return Promise.resolve({ data, error: null });
    });
    mockSupabaseClient.from.mockImplementation(() => {
      const query = {
        select: jest.fn(),
        or: jest.fn(),
        is: jest.fn(),
        in: jest.fn((_, ids: string[]) =>
          Promise.resolve({
            data: ids.map((id) => {
              const beach = mockBeaches.find((candidate) => candidate.id === id);
              return { id, country: beach?.country ?? "USA" };
            }),
            error: null,
          }),
        ),
      };
      query.select.mockReturnValue(query);
      query.or.mockReturnValue(query);
      query.is.mockReturnValue(query);
      return query;
    });
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/beaches/nearby/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  it("returns country so international nearby links retain their canonical URL", async () => {
    const originalCountry = mockBeaches[0].country;
    mockBeaches[0].country = "Mexico";
    try {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25"),
      );

      const res = await GET(req);
      const json = await res.json();

      expect(json.data[0].country).toBe("Mexico");
    } finally {
      mockBeaches[0].country = originalCountry;
    }
  });

  describe("Coordinate Validation", () => {
    it("validates coordinate format (lat/lon not lng)", async () => {
      // Use the preferred lat/lon format
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("accepts verbose latitude/longitude format", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?latitude=32.75&longitude=-117.25"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("accepts legacy lng parameter for backward compatibility", async () => {
      // Legacy 'lng' is supported but not preferred
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lng=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("handles out-of-range latitude (> 90) without crashing", async () => {
      // Note: normalizeCoordinates does not validate coordinate ranges.
      // The Haversine formula handles out-of-range values gracefully.
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=91&lon=-117.25")
      );

      const res = await GET(req);
      // Route processes the request without error (validation is lenient)
      expect(res.status).toBe(200);
    });

    it("handles out-of-range latitude (< -90) without crashing", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=-91&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("handles out-of-range longitude (> 180) without crashing", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=181")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("handles out-of-range longitude (< -180) without crashing", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-181")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("returns 400 when latitude is missing", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/latitude|longitude|required/i);
    });

    it("returns 400 when longitude is missing", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75")
      );

      const res = await GET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/latitude|longitude|required/i);
    });

    it("returns 400 when no coordinates are provided", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby")
      );

      const res = await GET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/latitude|longitude|required/i);
    });

    it("rejects non-numeric latitude", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=abc&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("rejects non-numeric longitude", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=xyz")
      );

      const res = await GET(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe("Distance Filtering", () => {
    it("returns beaches within radius", async () => {
      // Search near Ocean Beach (32.75, -117.25)
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&maxDistance=30"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      // Should include nearby beaches but not the distant one (Los Angeles)
      const beachNames = json.data.map((b: any) => b.name);
      expect(beachNames).toContain("Ocean Beach");
      expect(beachNames).toContain("Pacific Beach");
      expect(beachNames).toContain("La Jolla Shores");
      expect(beachNames).not.toContain("Distant Beach");
      expect(mockRankBeaches).toHaveBeenCalled();
    });

    it("orders by distance", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&maxDistance=30"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);

      // First result should be Ocean Beach (closest to search point)
      expect(json.data[0].name).toBe("Ocean Beach");
    });

    it("respects maxDistance parameter", async () => {
      // Use a very small radius that should only include Ocean Beach
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&maxDistance=1"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      // Should only include Ocean Beach (within 1 mile of search point)
      expect(json.data.length).toBeLessThanOrEqual(1);
    });

    it("uses default maxDistance of 30 miles when not provided", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      // Should include nearby San Diego beaches but not LA
      const beachNames = json.data.map((b: any) => b.name);
      expect(beachNames).not.toContain("Distant Beach");
    });

    it("respects limit parameter", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&limit=2"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeLessThanOrEqual(2);
    });

    it("caps radius and limit before calling the spatial RPC", async () => {
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&maxDistance=500&limit=999",
        ),
      );

      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_nearby_beaches",
        {
          input_lat: 32.75,
          input_lng: -117.25,
          max_distance_meters: Math.round(50 * 1609.34),
          limit_count: 55,
        },
      );
    });

    it("uses default limit of 20 when not provided", async () => {
      // Create more than 20 mock beaches to test limit
      const manyBeaches = Array.from({ length: 25 }, (_, i) => ({
        id: `beach-${i}`,
        name: `Beach ${i}`,
        lat: 32.75 + i * 0.01,
        lon: -117.25,
        slug: `beach-${i}`,
        city: "San Diego",
        state: "CA",
        country: "USA",
      }));

      mockSupabaseClient.rpc.mockImplementation((_, args) =>
        Promise.resolve({
          data: manyBeaches.slice(0, args.limit_count),
          error: null,
        }),
      );

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&maxDistance=100"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeLessThanOrEqual(20);
    });
  });

  describe("Empty Results Handling", () => {
    it("handles empty results gracefully", async () => {
      // Mock empty beach list
      mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(0);
    });

    it("returns empty array when no beaches are within radius", async () => {
      // Search in the middle of the ocean - very far from any beach
      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=0&lon=0&maxDistance=1"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(0);
    });

    it("handles null data from database gracefully", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(0);
    });
  });

  describe("Response Structure", () => {
    it("returns beaches with correct fields", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);

      // Check that returned beach has expected fields
      const beach = json.data[0];
      expect(beach).toHaveProperty("id");
      expect(beach).toHaveProperty("lat");
      expect(beach).toHaveProperty("lon");
      expect(beach).toHaveProperty("name");
      expect(beach).toHaveProperty("slug");
      expect(beach).toHaveProperty("city");
      expect(beach).toHaveProperty("state");
    });

    it("returns standardized response with timestamp", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25")
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("timestamp");
      expect(typeof json.timestamp).toBe("string");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 when database query fails", async () => {
      const dbError = { message: "Database connection failed" };
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      mockSupabaseClient.rpc.mockRejectedValue(dbError);

      try {
        const req = new NextRequest(
          new URL("http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25")
        );

        const res = await GET(req);
        expect(res.status).toBe(500);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe("Error fetching nearby beaches");
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error getting nearby beaches:",
          dbError,
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error fetching nearby beaches:",
          expect.any(Error),
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith("API Error:", "Unknown error");
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it("handles beaches with missing coordinates gracefully", async () => {
      const beachesWithMissing = [
        ...mockBeaches,
        {
          id: "beach-missing",
          name: "Missing Coords Beach",
          lat: null,
          lon: null,
          slug: "missing-coords",
          city: "Unknown",
          state: "CA",
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: beachesWithMissing,
        error: null,
      });

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&maxDistance=30"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      // The beach with missing coords should be filtered out (distance is NaN/Infinity)
      const beachNames = json.data.map((b: any) => b.name);
      expect(beachNames).not.toContain("Missing Coords Beach");
    });
  });

  describe("Distance Calculation", () => {
    it("calculates correct distances using Haversine formula", async () => {
      // Set up a beach exactly at the search point
      const nearbyBeaches = [
        {
          id: "beach-exact",
          name: "Exact Location Beach",
          lat: 32.75,
          lon: -117.25,
          slug: "exact-location",
          city: "San Diego",
          state: "CA",
          country: "USA",
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyBeaches,
        error: null,
      });

      const req = new NextRequest(
        new URL(
          "http://localhost/api/beaches/nearby?lat=32.75&lon=-117.25&maxDistance=1"
        )
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      // Beach at exact location should be included (distance = 0)
      expect(json.data.length).toBe(1);
      expect(json.data[0].name).toBe("Exact Location Beach");
    });
  });
});
