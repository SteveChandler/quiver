/**
 * Tests for City Metadata Actions
 *
 * Tests the server actions for fetching city metadata from Supabase beaches table.
 * Used for intent page data (beach counts, skill level distribution, center coordinates).
 */

import {
  getCityMetadata,
  findCityBySlug,
} from "@/actions/city/city-metadata-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Mock the Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createSupabaseServerClient: jest.fn(),
}));

// Chain builder for Supabase query mocking
const makeChain = () => {
  const obj: Record<string, jest.Mock> = {};
  obj.select = jest.fn(() => obj);
  obj.ilike = jest.fn(() => obj);
  obj.eq = jest.fn(() => obj);
  obj.or = jest.fn(() => obj);
  obj.order = jest.fn(() => Promise.resolve({ data: [], error: null }));
  return obj;
};

// Mock beach data for Santa Cruz (3 beaches to pass minimum threshold)
const mockSantaCruzBeaches = [
  {
    id: "beach-1",
    name: "Steamer Lane",
    slug: "steamer-lane",
    skill_level: "Advanced",
    center_lat: 36.9516,
    center_lng: -122.0235,
  },
  {
    id: "beach-2",
    name: "Cowell Beach",
    slug: "cowell-beach",
    skill_level: "Beginner-friendly",
    center_lat: 36.9628,
    center_lng: -122.0234,
  },
  {
    id: "beach-3",
    name: "Pleasure Point",
    slug: "pleasure-point",
    skill_level: "Intermediate",
    center_lat: 36.9631,
    center_lng: -121.9763,
  },
];

// Mock beach data for San Diego (more beaches with varied skill levels)
const mockSanDiegoBeaches = [
  {
    id: "beach-sd-1",
    name: "La Jolla Shores",
    slug: "la-jolla-shores",
    skill_level: "Beginner-friendly",
    center_lat: 32.8569,
    center_lng: -117.2571,
  },
  {
    id: "beach-sd-2",
    name: "Black's Beach",
    slug: "blacks-beach",
    skill_level: "Advanced",
    center_lat: 32.8885,
    center_lng: -117.2525,
  },
  {
    id: "beach-sd-3",
    name: "Pacific Beach",
    slug: "pacific-beach",
    skill_level: "Intermediate",
    center_lat: 32.7972,
    center_lng: -117.2561,
  },
  {
    id: "beach-sd-4",
    name: "Ocean Beach",
    slug: "ocean-beach",
    skill_level: null,
    center_lat: 32.7470,
    center_lng: -117.2513,
  },
  {
    id: "beach-sd-5",
    name: "Tourmaline",
    slug: "tourmaline",
    skill_level: "Longboard-friendly",
    center_lat: 32.8059,
    center_lng: -117.2683,
  },
];

describe("City Metadata Actions", () => {
  let mockSupabaseClient: {
    from: jest.Mock;
  };
  let tableChain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    jest.clearAllMocks();
    tableChain = makeChain();

    mockSupabaseClient = {
      from: jest.fn(() => tableChain),
    };

    (createSupabaseServerClient as jest.Mock).mockResolvedValue(
      mockSupabaseClient
    );
  });

  describe("getCityMetadata", () => {
    it("returns metadata for Santa Cruz", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await getCityMetadata("Santa Cruz", "CA");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.cityName).toBe("Santa Cruz");
      expect(result.data?.state).toBe("CA");
      expect(result.data?.totalBeaches).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(result.data?.beaches)).toBe(true);
    });

    it("returns null for nonexistent city", async () => {
      tableChain.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getCityMetadata("Nonexistent City", "ZZ");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns null for city with fewer than 3 beaches", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches.slice(0, 2), // Only 2 beaches
        error: null,
      });

      const result = await getCityMetadata("Small Town", "CA");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("includes skill level counts", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSanDiegoBeaches,
        error: null,
      });

      const result = await getCityMetadata("San Diego", "CA");

      expect(result.success).toBe(true);
      expect(result.data?.beginnerCount).toBeGreaterThanOrEqual(0);
      expect(result.data?.intermediateCount).toBeGreaterThanOrEqual(0);
      expect(result.data?.advancedCount).toBeGreaterThanOrEqual(0);
    });

    it("categorizes skill levels correctly", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSanDiegoBeaches,
        error: null,
      });

      const result = await getCityMetadata("San Diego", "CA");

      expect(result.success).toBe(true);
      // La Jolla Shores (Beginner-friendly) + Tourmaline (Longboard-friendly) = 2 beginner
      expect(result.data?.beginnerCount).toBe(2);
      // Pacific Beach (Intermediate) + Ocean Beach (null -> intermediate) = 2 intermediate
      expect(result.data?.intermediateCount).toBe(2);
      // Black's Beach (Advanced) = 1 advanced
      expect(result.data?.advancedCount).toBe(1);
    });

    it("includes state name lookup", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await getCityMetadata("Santa Cruz", "CA");

      expect(result.success).toBe(true);
      expect(result.data?.stateName).toBe("California");
    });

    it("handles unknown state codes", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await getCityMetadata("Santa Cruz", "XX");

      expect(result.success).toBe(true);
      expect(result.data?.stateName).toBe("XX"); // Falls back to state code
    });

    it("calculates center coordinates", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await getCityMetadata("Santa Cruz", "CA");

      expect(result.success).toBe(true);
      expect(result.data?.centerLat).toBeCloseTo(36.9592, 2); // Average of 3 beaches
      expect(result.data?.centerLon).toBeCloseTo(-122.0077, 2);
    });

    it("returns beach names and slugs", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await getCityMetadata("Santa Cruz", "CA");

      expect(result.success).toBe(true);
      expect(result.data?.beaches).toHaveLength(3);
      expect(result.data?.beaches[0]).toHaveProperty("name");
      expect(result.data?.beaches[0]).toHaveProperty("slug");
      expect(result.data?.beaches[0]).toHaveProperty("skillLevel");
    });

    it("normalizes state to uppercase", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await getCityMetadata("Santa Cruz", "ca");

      expect(result.success).toBe(true);
      expect(result.data?.state).toBe("CA");
    });

    it("calls Supabase with correct query parameters", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      await getCityMetadata("Santa Cruz", "CA");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beaches");
      expect(tableChain.select).toHaveBeenCalledWith(
        "id, name, slug, skill_level, center_lat, center_lng"
      );
      expect(tableChain.ilike).toHaveBeenCalledWith("city", "Santa Cruz");
      expect(tableChain.eq).toHaveBeenCalledWith("state", "CA");
      expect(tableChain.or).toHaveBeenCalledWith(
        "is_private.is.null,is_private.eq.false"
      );
      expect(tableChain.order).toHaveBeenCalledWith("name");
    });

    describe("Error Handling", () => {
      it("returns error on database failure", async () => {
        tableChain.order.mockResolvedValue({
          data: null,
          error: { message: "Database connection failed" },
        });

        const result = await getCityMetadata("Santa Cruz", "CA");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("handles null coordinates gracefully", async () => {
        const beachesWithNullCoords = [
          { ...mockSantaCruzBeaches[0], center_lat: null, center_lng: null },
          { ...mockSantaCruzBeaches[1], center_lat: null, center_lng: null },
          mockSantaCruzBeaches[2],
        ];

        tableChain.order.mockResolvedValue({
          data: beachesWithNullCoords,
          error: null,
        });

        const result = await getCityMetadata("Santa Cruz", "CA");

        expect(result.success).toBe(true);
        // Should use only the one valid coordinate
        expect(result.data?.centerLat).toBeCloseTo(36.9631, 2);
        expect(result.data?.centerLon).toBeCloseTo(-121.9763, 2);
      });

      it("returns zero coordinates when all beaches have null coordinates", async () => {
        const beachesAllNullCoords = mockSantaCruzBeaches.map((b) => ({
          ...b,
          center_lat: null,
          center_lng: null,
        }));

        tableChain.order.mockResolvedValue({
          data: beachesAllNullCoords,
          error: null,
        });

        const result = await getCityMetadata("Santa Cruz", "CA");

        expect(result.success).toBe(true);
        expect(result.data?.centerLat).toBe(0);
        expect(result.data?.centerLon).toBe(0);
      });
    });
  });

  describe("Supabase Client Creation", () => {
    it("should create Supabase client for getCityMetadata", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      await getCityMetadata("Santa Cruz", "CA");

      expect(createSupabaseServerClient).toHaveBeenCalled();
    });
  });

  describe("findCityBySlug", () => {
    it("finds Santa Cruz by simple slug", async () => {
      // First call: find matching cities (no order, returns from or())
      // Second call: getCityMetadata query (has order)
      const findChain = makeChain();
      const metadataChain = makeChain();

      // findCityBySlug query returns matching beaches grouped by city
      findChain.or.mockResolvedValue({
        data: [
          { city: "Santa Cruz", state: "CA" },
          { city: "Santa Cruz", state: "CA" },
          { city: "Santa Cruz", state: "CA" },
        ],
        error: null,
      });

      // getCityMetadata query returns full beach data
      metadataChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? findChain : metadataChain;
      });

      const result = await findCityBySlug("santa-cruz");

      expect(result.success).toBe(true);
      expect(result.data?.cityName).toBe("Santa Cruz");
      expect(result.data?.state).toBe("CA");
    });

    it("finds city by slug with state suffix", async () => {
      const findChain = makeChain();
      const metadataChain = makeChain();

      // When state filter is applied, .eq() is called after .or()
      // So we need .eq() to return the resolved value (not .or())
      findChain.eq.mockResolvedValue({
        data: [
          { city: "San Diego", state: "CA" },
          { city: "San Diego", state: "CA" },
          { city: "San Diego", state: "CA" },
          { city: "San Diego", state: "CA" },
          { city: "San Diego", state: "CA" },
        ],
        error: null,
      });

      metadataChain.order.mockResolvedValue({
        data: mockSanDiegoBeaches,
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? findChain : metadataChain;
      });

      const result = await findCityBySlug("san-diego-ca");

      expect(result.success).toBe(true);
      expect(result.data?.cityName).toBe("San Diego");
      expect(result.data?.state).toBe("CA");
      // Verify state filter was applied
      expect(findChain.eq).toHaveBeenCalledWith("state", "CA");
    });

    it("returns null for nonexistent city", async () => {
      tableChain.or.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await findCityBySlug("nonexistent-city-xyz");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns null for city with fewer than 3 beaches", async () => {
      // City exists but only has 2 beaches (below threshold)
      tableChain.or.mockResolvedValue({
        data: [
          { city: "Tiny Town", state: "CA" },
          { city: "Tiny Town", state: "CA" },
        ],
        error: null,
      });

      const result = await findCityBySlug("tiny-town");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns null for ambiguous slug without state suffix", async () => {
      // Newport exists in both CA and OR - should return null without state suffix
      tableChain.or.mockResolvedValue({
        data: [
          { city: "Newport", state: "CA" },
          { city: "Newport", state: "CA" },
          { city: "Newport", state: "CA" },
          { city: "Newport", state: "OR" },
          { city: "Newport", state: "OR" },
          { city: "Newport", state: "OR" },
        ],
        error: null,
      });

      const result = await findCityBySlug("newport");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("resolves ambiguous city when state suffix provided", async () => {
      const findChain = makeChain();
      const metadataChain = makeChain();

      // With state filter, .eq() is called after .or()
      // So .eq() returns the resolved value
      findChain.eq.mockResolvedValue({
        data: [
          { city: "Newport", state: "OR" },
          { city: "Newport", state: "OR" },
          { city: "Newport", state: "OR" },
        ],
        error: null,
      });

      metadataChain.order.mockResolvedValue({
        data: [
          {
            id: "beach-np-1",
            name: "Newport Beach 1",
            slug: "newport-beach-1",
            skill_level: "Intermediate",
            center_lat: 44.6368,
            center_lng: -124.0534,
          },
          {
            id: "beach-np-2",
            name: "Newport Beach 2",
            slug: "newport-beach-2",
            skill_level: "Beginner-friendly",
            center_lat: 44.6370,
            center_lng: -124.0540,
          },
          {
            id: "beach-np-3",
            name: "Newport Beach 3",
            slug: "newport-beach-3",
            skill_level: "Advanced",
            center_lat: 44.6372,
            center_lng: -124.0545,
          },
        ],
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? findChain : metadataChain;
      });

      const result = await findCityBySlug("newport-or");

      expect(result.success).toBe(true);
      expect(result.data?.cityName).toBe("Newport");
      expect(result.data?.state).toBe("OR");
    });

    it("handles database error gracefully", async () => {
      tableChain.or.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      const result = await findCityBySlug("santa-cruz");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("uses ILIKE for case-insensitive city pattern matching", async () => {
      tableChain.or.mockResolvedValue({
        data: [],
        error: null,
      });

      await findCityBySlug("santa-cruz");

      expect(tableChain.ilike).toHaveBeenCalledWith("city", "%santa cruz%");
    });

    it("excludes private beaches from results", async () => {
      tableChain.or.mockResolvedValue({
        data: [],
        error: null,
      });

      await findCityBySlug("santa-cruz");

      expect(tableChain.or).toHaveBeenCalledWith(
        "is_private.is.null,is_private.eq.false"
      );
    });
  });
});
