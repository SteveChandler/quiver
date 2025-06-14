// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      order: jest.fn(() => ({
        // This will be mocked in individual tests
      })),
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          // This will be mocked in individual tests
        })),
      })),
    })),
  })),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
}));

// Import after mocking
import { getBeaches, getBeachById } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";

const mockBeaches: Beach[] = [
  {
    id: "beach-1",
    name: "Pacific Beach",
    latitude: 32.7841,
    longitude: -117.2527,
    description: "Popular beach for surfing and beach volleyball",
    wave_quality_rating: 4.2,
    crowd_density_rating: 3.8,
    parking_rating: 3.5,
    accessibility_rating: 4.0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "beach-2",
    name: "Ocean Beach",
    latitude: 32.7503,
    longitude: -117.2534,
    description: "Dog-friendly beach with a historic pier",
    wave_quality_rating: 3.9,
    crowd_density_rating: 4.1,
    parking_rating: 2.8,
    accessibility_rating: 3.7,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "beach-3",
    name: "Mission Beach",
    latitude: 32.7738,
    longitude: -117.2528,
    description: "Boardwalk beach with amusement park nearby",
    wave_quality_rating: 3.6,
    crowd_density_rating: 4.5,
    parking_rating: 3.2,
    accessibility_rating: 4.3,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

describe("Beach Query Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBeaches", () => {
    it("should return all beaches in alphabetical order", async () => {
      // Mock successful response
      const mockOrder = jest.fn().mockResolvedValue({
        data: mockBeaches.sort((a, b) => a.name.localeCompare(b.name)),
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeaches();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        mockBeaches.sort((a, b) => a.name.localeCompare(b.name))
      );

      // Verify correct Supabase calls
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beaches");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockOrder).toHaveBeenCalledWith("name");
    });

    it("should handle empty result", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeaches();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeaches();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
      expect(result.data).toBeUndefined();
    });

    it("should handle unexpected errors", async () => {
      const mockOrder = jest
        .fn()
        .mockRejectedValue(new TypeError("Network error"));

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeaches();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should handle non-Error exceptions", async () => {
      const mockOrder = jest.fn().mockRejectedValue("String error");

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeaches();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("getBeachById", () => {
    it("should return specific beach by ID", async () => {
      const targetBeach = mockBeaches[0];

      const mockSingle = jest.fn().mockResolvedValue({
        data: targetBeach,
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachById("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(targetBeach);

      // Verify correct Supabase calls
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beaches");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("id", "beach-1");
      expect(mockSingle).toHaveBeenCalled();
    });

    it("should handle beach not found", async () => {
      const mockError = new Error("No rows found");
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachById("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No rows found");
    });

    it("should handle invalid UUID format", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Invalid UUID format"),
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachById("invalid-uuid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid UUID format");
    });

    it("should handle empty string ID", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Invalid UUID format"),
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachById("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid UUID format");
    });

    it("should return beach with all optional fields", async () => {
      const beachWithAllFields: Beach = {
        ...mockBeaches[0],
        description: "A beautiful beach with great waves",
        wave_quality_rating: 4.8,
        crowd_density_rating: 2.1,
        parking_rating: 4.2,
        accessibility_rating: 3.9,
        location_text: "San Diego, CA",
      };

      const mockSingle = jest.fn().mockResolvedValue({
        data: beachWithAllFields,
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachById("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(beachWithAllFields);
      expect(result.data?.description).toBeDefined();
      expect(result.data?.wave_quality_rating).toBeDefined();
      expect(result.data?.location_text).toBeDefined();
    });

    it("should handle beach with minimal fields", async () => {
      const minimalBeach: Beach = {
        id: "minimal-beach",
        name: "Minimal Beach",
        latitude: 32.7841,
        longitude: -117.2527,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const mockSingle = jest.fn().mockResolvedValue({
        data: minimalBeach,
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachById("minimal-beach");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(minimalBeach);
      expect(result.data?.description).toBeUndefined();
      expect(result.data?.wave_quality_rating).toBeUndefined();
    });

    it("should handle network timeout", async () => {
      const mockSingle = jest
        .fn()
        .mockRejectedValue(new Error("Request timeout"));

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachById("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });
  });

  describe("Type safety and data integrity", () => {
    it("should properly type-cast returned beach data", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: mockBeaches,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeaches();

      expect(result.success).toBe(true);

      // Type checking - these should not cause TypeScript errors
      if (result.data) {
        result.data.forEach((beach) => {
          expect(typeof beach.id).toBe("string");
          expect(typeof beach.name).toBe("string");
          expect(typeof beach.latitude).toBe("number");
          expect(typeof beach.longitude).toBe("number");
          expect(typeof beach.created_at).toBe("string");
          expect(typeof beach.updated_at).toBe("string");

          // Optional fields
          if (beach.description) {
            expect(typeof beach.description).toBe("string");
          }
          if (beach.wave_quality_rating) {
            expect(typeof beach.wave_quality_rating).toBe("number");
            expect(beach.wave_quality_rating).toBeGreaterThanOrEqual(0);
            expect(beach.wave_quality_rating).toBeLessThanOrEqual(5);
          }
        });
      }
    });

    it("should handle malformed data gracefully", async () => {
      const malformedData = [
        {
          id: "beach-1",
          name: "Pacific Beach",
          // Missing required latitude/longitude
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({
        data: malformedData,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeaches();

      // Should still succeed, but the application should handle validation elsewhere
      expect(result.success).toBe(true);
      expect(result.data).toEqual(malformedData);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle large numbers of beaches efficiently", async () => {
      const largeBeachList = Array.from({ length: 1000 }, (_, i) => ({
        id: `beach-${i}`,
        name: `Beach ${i.toString().padStart(4, "0")}`, // Ensures proper alphabetical sorting
        latitude: 32.7841 + i * 0.001,
        longitude: -117.2527 + i * 0.001,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }));

      const mockOrder = jest.fn().mockResolvedValue({
        data: largeBeachList,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const startTime = Date.now();
      const result = await getBeaches();
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast (mocked)
    });

    it("should maintain consistent API contract", async () => {
      // Test that the function always returns the expected shape
      const scenarios = [
        { data: mockBeaches, error: null },
        { data: [], error: null },
        { data: null, error: new Error("Test error") },
      ];

      for (const scenario of scenarios) {
        const mockOrder = jest.fn().mockResolvedValue(scenario);
        const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await getBeaches();

        // Should always have these properties
        expect(result).toHaveProperty("success");
        expect(typeof result.success).toBe("boolean");

        if (result.success) {
          expect(result).toHaveProperty("data");
          expect(Array.isArray(result.data)).toBe(true);
        } else {
          expect(result).toHaveProperty("error");
          expect(typeof result.error).toBe("string");
        }
      }
    });
  });
});
