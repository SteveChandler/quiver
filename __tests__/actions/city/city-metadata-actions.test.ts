/**
 * Tests for City Metadata Actions
 *
 * Tests the server actions for fetching city metadata from Supabase beaches table.
 * Used for intent page data (beach counts, skill level distribution, center coordinates).
 */

import {
  getCityExcludeIntents,
  getCityMetadata,
  findCityBySlug,
  getCityBeachEditorialData,
} from "@/actions/city/city-metadata-actions";
import { createPublicReadClient } from "@/lib/supabase/server";
const mockRankBeaches = jest.fn(async (beaches: Array<{ id: string }>) => beaches);

// Mock the Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  __esModule: true,
  createPublicReadClient: jest.fn(),
}));
jest.mock("@/lib/recommendations/major-event-hold/water-quality-visibility", () => ({
  filterBeachesByWaterQualityVisibility: jest.fn(async (beaches: Array<{ id: string }>) => beaches),
}));
jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

// Chain builder for Supabase query mocking
const makeChain = () => {
  const obj: Record<string, jest.Mock> = {};
  obj.select = jest.fn(() => obj);
  obj.ilike = jest.fn(() => obj);
  obj.eq = jest.fn(() => obj);
  obj.or = jest.fn(() => obj);
  obj.limit = jest.fn(() => Promise.resolve({ data: [], error: null }));
  obj.order = jest.fn(() => Promise.resolve({ data: [], error: null }));
  return obj;
};

// Default RPC mock response
const defaultRpcResponse = { data: [], error: null };

// Mock beach data for Santa Cruz (3 beaches to pass minimum threshold)
const mockSantaCruzBeaches = [
  {
    id: "beach-1",
    name: "Steamer Lane",
    slug: "steamer-lane",
    skill_level: "Advanced",
    lat: 36.9516,
    lon: -122.0235,
  },
  {
    id: "beach-2",
    name: "Cowell Beach",
    slug: "cowell-beach",
    skill_level: "Beginner-friendly",
    lat: 36.9628,
    lon: -122.0234,
  },
  {
    id: "beach-3",
    name: "Pleasure Point",
    slug: "pleasure-point",
    skill_level: "Intermediate",
    lat: 36.9631,
    lon: -121.9763,
  },
];

// Mock beach data for San Diego (more beaches with varied skill levels)
const mockSanDiegoBeaches = [
  {
    id: "beach-sd-1",
    name: "La Jolla Shores",
    slug: "la-jolla-shores",
    skill_level: "Beginner-friendly",
    lat: 32.8569,
    lon: -117.2571,
  },
  {
    id: "beach-sd-2",
    name: "Black's Beach",
    slug: "blacks",
    skill_level: "Advanced",
    lat: 32.8885,
    lon: -117.2525,
  },
  {
    id: "beach-sd-3",
    name: "Pacific Beach",
    slug: "pacific-beach",
    skill_level: "Intermediate",
    lat: 32.7972,
    lon: -117.2561,
  },
  {
    id: "beach-sd-4",
    name: "Ocean Beach",
    slug: "ocean-beach",
    skill_level: null,
    lat: 32.7470,
    lon: -117.2513,
  },
  {
    id: "beach-sd-5",
    name: "Tourmaline",
    slug: "tourmaline",
    skill_level: "Longboard-friendly",
    lat: 32.8059,
    lon: -117.2683,
  },
];

describe("City Metadata Actions", () => {
  let mockSupabaseClient: {
    from: jest.Mock;
    rpc: jest.Mock;
  };
  let tableChain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRankBeaches.mockImplementation(async (beaches: Array<{ id: string }>) => beaches);
    tableChain = makeChain();

    mockSupabaseClient = {
      from: jest.fn(() => tableChain),
      rpc: jest.fn(() => Promise.resolve(defaultRpcResponse)),
    };

    (createPublicReadClient as jest.Mock).mockReturnValue(
      mockSupabaseClient
    );
  });

  it("removes held beaches from city editorial recommendations", async () => {
    mockRankBeaches.mockImplementation(async (beaches: Array<{ id: string }>) =>
      beaches.filter(({ id }) => id !== "beach-sd-1"),
    );
    tableChain.order.mockResolvedValue({
      data: mockSanDiegoBeaches,
      error: null,
    });

    const result = await getCityBeachEditorialData("San Diego", "CA");

    expect(result.map((beach) => beach.id)).not.toContain("beach-sd-1");
    expect(result.map((beach) => beach.id)).toContain("beach-sd-2");
    expect(mockRankBeaches).toHaveBeenCalled();
  });

  describe("getCityMetadata", () => {
    it("returns metadata for Santa Cruz", async () => {
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await getCityMetadata("Santa Cruz", "CA");

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        cityName: "Santa Cruz",
        state: "CA",
      });
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

    it("returns null for city with no beaches", async () => {
      tableChain.order.mockResolvedValue({
        data: [], // No beaches
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
        "id, name, slug, skill_level, lat, lon"
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
        expect(result.error).toContain("Database connection failed");
      });

      it("handles null coordinates gracefully", async () => {
        const beachesWithNullCoords = [
          { ...mockSantaCruzBeaches[0], lat: null, lon: null },
          { ...mockSantaCruzBeaches[1], lat: null, lon: null },
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
          lat: null,
          lon: null,
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

      expect(createPublicReadClient).toHaveBeenCalled();
    });
  });

  describe("getCityExcludeIntents", () => {
    it("excludes filtered intents when city has no matching skill or crowd data", async () => {
      tableChain.limit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await getCityExcludeIntents("San Diego", "CA");

      expect(result).toEqual(["beginner", "longboard", "least-crowded"]);
      expect(tableChain.select).toHaveBeenCalledWith("id");
      expect(tableChain.or).toHaveBeenCalledWith(
        "skill_level.ilike.%beginner%,skill_level.ilike.%longboard%"
      );
      expect(tableChain.or).toHaveBeenCalledWith(
        "crowd_level.ilike.light,crowd_level.ilike.moderate"
      );
    });

    it("keeps beginner and longboard eligible when any city beach matches either skill filter", async () => {
      tableChain.limit
        .mockResolvedValueOnce({ data: [{ id: "longboard-beach" }], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await getCityExcludeIntents("San Diego", "CA");

      expect(result).toEqual(["least-crowded"]);
    });

    it("keeps least-crowded eligible when any city beach has light or moderate crowd level", async () => {
      tableChain.limit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [{ id: "moderate-crowd-beach" }], error: null });

      const result = await getCityExcludeIntents("San Diego", "CA");

      expect(result).toEqual(["beginner", "longboard"]);
    });

    it("fails open when an eligibility query errors", async () => {
      tableChain.limit
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Database connection failed" },
        })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await getCityExcludeIntents("San Diego", "CA");

      expect(result).toEqual([]);
    });
  });

  describe("findCityBySlug", () => {
    it("finds Santa Cruz by simple slug", async () => {
      // RPC returns aggregated city data with beach_count
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ city: "Santa Cruz", state: "CA", beach_count: 3 }],
        error: null,
      });

      // getCityMetadata query returns full beach data
      tableChain.order.mockResolvedValue({
        data: mockSantaCruzBeaches,
        error: null,
      });

      const result = await findCityBySlug("santa-cruz");

      expect(result.success).toBe(true);
      expect(result.data?.cityName).toBe("Santa Cruz");
      expect(result.data?.state).toBe("CA");
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("find_cities_by_pattern", {
        search_pattern: "santa cruz",
        state_filter: undefined,
      });
    });

    it("finds city by slug with state suffix", async () => {
      // RPC returns aggregated city data with beach_count
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ city: "San Diego", state: "CA", beach_count: 5 }],
        error: null,
      });

      tableChain.order.mockResolvedValue({
        data: mockSanDiegoBeaches,
        error: null,
      });

      const result = await findCityBySlug("san-diego-ca");

      expect(result.success).toBe(true);
      expect(result.data?.cityName).toBe("San Diego");
      expect(result.data?.state).toBe("CA");
      // Verify state filter was passed to RPC
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("find_cities_by_pattern", {
        search_pattern: "san diego",
        state_filter: "CA",
      });
    });

    it("returns null for nonexistent city", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await findCityBySlug("nonexistent-city-xyz");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns null for city with no beaches", async () => {
      // RPC returns city with 0 beaches (below threshold)
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ city: "Tiny Town", state: "CA", beach_count: 0 }],
        error: null,
      });

      const result = await findCityBySlug("tiny-town");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns null for ambiguous slug without state suffix", async () => {
      // Newport exists in both CA and OR with 3+ beaches each - ambiguous without state
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          { city: "Newport", state: "CA", beach_count: 3 },
          { city: "Newport", state: "OR", beach_count: 3 },
        ],
        error: null,
      });

      const result = await findCityBySlug("newport");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("resolves ambiguous city when state suffix provided", async () => {
      // RPC returns only OR Newport when state filter is applied
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ city: "Newport", state: "OR", beach_count: 3 }],
        error: null,
      });

      tableChain.order.mockResolvedValue({
        data: [
          {
            id: "beach-np-1",
            name: "Newport Beach 1",
            slug: "newport-beach-1",
            skill_level: "Intermediate",
            lat: 44.6368,
            lon: -124.0534,
          },
          {
            id: "beach-np-2",
            name: "Newport Beach 2",
            slug: "newport-beach-2",
            skill_level: "Beginner-friendly",
            lat: 44.6370,
            lon: -124.0540,
          },
          {
            id: "beach-np-3",
            name: "Newport Beach 3",
            slug: "newport-beach-3",
            skill_level: "Advanced",
            lat: 44.6372,
            lon: -124.0545,
          },
        ],
        error: null,
      });

      const result = await findCityBySlug("newport-or");

      expect(result.success).toBe(true);
      expect(result.data?.cityName).toBe("Newport");
      expect(result.data?.state).toBe("OR");
      // Verify state filter was passed to RPC
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("find_cities_by_pattern", {
        search_pattern: "newport",
        state_filter: "OR",
      });
    });

    it("handles database error gracefully", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      const result = await findCityBySlug("santa-cruz");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database connection failed");
    });

    it("calls RPC with correct pattern for case-insensitive matching", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      await findCityBySlug("santa-cruz");

      // RPC handles case-insensitive and accent-normalized matching
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("find_cities_by_pattern", {
        search_pattern: "santa cruz",
        state_filter: undefined,
      });
    });

    it("passes null state filter for slugs without state suffix", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      await findCityBySlug("santa-cruz");

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("find_cities_by_pattern", {
        search_pattern: "santa cruz",
        state_filter: undefined,
      });
    });

    describe("Exact Match Collision Handling", () => {
      it("prefers exact match over substring match (koloa vs waikoloa)", async () => {
        // RPC returns both Koloa (exact match) and Waikoloa (substring match)
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [
            { city: "Koloa", state: "HI", beach_count: 2, is_exact_match: true },
            { city: "Waikoloa", state: "HI", beach_count: 3, is_exact_match: false },
          ],
          error: null,
        });

        // getCityMetadata query returns Koloa beaches
        tableChain.order.mockResolvedValue({
          data: [
            {
              id: "beach-koloa-1",
              name: "Poipu Beach",
              slug: "poipu-beach",
              skill_level: "Beginner-friendly",
              lat: 21.8755,
              lon: -159.4503,
            },
            {
              id: "beach-koloa-2",
              name: "Brennecke's Beach",
              slug: "brenneckes-beach",
              skill_level: "Intermediate",
              lat: 21.8750,
              lon: -159.4520,
            },
          ],
          error: null,
        });

        const result = await findCityBySlug("koloa-hi");

        expect(result.success).toBe(true);
        expect(result.data?.cityName).toBe("Koloa");
        expect(result.data?.state).toBe("HI");
        // Verify getCityMetadata was called with Koloa, not Waikoloa
        expect(tableChain.ilike).toHaveBeenCalledWith("city", "Koloa");
      });

      it("selects only exact match when single exact match exists among multiple results", async () => {
        // RPC returns one exact match and multiple substring matches
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [
            { city: "Hull", state: "MA", beach_count: 5, is_exact_match: true },
            { city: "Hull Gut Reservation", state: "MA", beach_count: 1, is_exact_match: false },
            { city: "Scituate Hull", state: "MA", beach_count: 2, is_exact_match: false },
          ],
          error: null,
        });

        tableChain.order.mockResolvedValue({
          data: [
            {
              id: "beach-hull-1",
              name: "Nantasket Beach",
              slug: "nantasket-beach",
              skill_level: "Intermediate",
              lat: 42.2648,
              lon: -70.8590,
            },
          ],
          error: null,
        });

        const result = await findCityBySlug("hull");

        expect(result.success).toBe(true);
        expect(result.data?.cityName).toBe("Hull");
        expect(tableChain.ilike).toHaveBeenCalledWith("city", "Hull");
      });

      it("returns null when multiple exact matches exist without state filter", async () => {
        // Two different cities that both exactly match "Newport"
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [
            { city: "Newport", state: "CA", beach_count: 5, is_exact_match: true },
            { city: "Newport", state: "OR", beach_count: 3, is_exact_match: true },
          ],
          error: null,
        });

        const result = await findCityBySlug("newport");

        expect(result.success).toBe(true);
        expect(result.data).toBeNull(); // Ambiguous - multiple exact matches
      });

      it("resolves multiple exact matches when state filter provided", async () => {
        // With state filter, only one city should be returned
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [{ city: "Newport", state: "OR", beach_count: 3, is_exact_match: true }],
          error: null,
        });

        tableChain.order.mockResolvedValue({
          data: [
            {
              id: "beach-np-1",
              name: "South Beach",
              slug: "south-beach",
              skill_level: "Intermediate",
              lat: 44.6200,
              lon: -124.0600,
            },
          ],
          error: null,
        });

        const result = await findCityBySlug("newport-or");

        expect(result.success).toBe(true);
        expect(result.data?.cityName).toBe("Newport");
        expect(result.data?.state).toBe("OR");
      });

      it("handles case when no exact matches exist but multiple substring matches", async () => {
        // This would happen if searching for partial city name
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [
            { city: "South Beach", state: "FL", beach_count: 2, is_exact_match: false },
            { city: "South Beach", state: "OR", beach_count: 1, is_exact_match: false },
          ],
          error: null,
        });

        const result = await findCityBySlug("south");

        expect(result.success).toBe(true);
        expect(result.data).toBeNull(); // Ambiguous - multiple matches, none exact
      });

      it("prefers exact matches even when substring match has more beaches", async () => {
        // Exact match should win regardless of beach count
        mockSupabaseClient.rpc.mockResolvedValue({
          data: [
            { city: "Koloa", state: "HI", beach_count: 2, is_exact_match: true },
            { city: "Waikoloa Resort", state: "HI", beach_count: 10, is_exact_match: false },
          ],
          error: null,
        });

        tableChain.order.mockResolvedValue({
          data: [
            {
              id: "beach-k-1",
              name: "Koloa Beach",
              slug: "koloa-beach",
              skill_level: "Beginner-friendly",
              lat: 21.8750,
              lon: -159.4500,
            },
          ],
          error: null,
        });

        const result = await findCityBySlug("koloa");

        expect(result.success).toBe(true);
        expect(result.data?.cityName).toBe("Koloa");
      });
    });
  });
});
