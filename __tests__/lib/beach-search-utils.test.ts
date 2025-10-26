import { searchBeachesMultiple, searchBeachesByName } from "@/lib/utils/beach-search-utils";
import { getBeaches } from "@/actions/beach-actions";

// Mock the getBeaches action
jest.mock("@/actions/beach-actions", () => ({
  getBeaches: jest.fn(),
}));

const mockBeaches = [
  {
    id: "1",
    name: "La Jolla Shores",
    location: "La Jolla",
    lat: 32.8571,
    lon: -117.2576,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "2",
    name: "Scripps Pier",
    location: "La Jolla",
    lat: 32.8669,
    lon: -117.2578,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "3",
    name: "Blacks Beach",
    location: "La Jolla",
    lat: 32.8893,
    lon: -117.2515,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "4",
    name: "Windansea Beach",
    location: "La Jolla",
    lat: 32.8317,
    lon: -117.2795,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "5",
    name: "Horseshoe",
    location: "La Jolla",
    lat: 32.8485,
    lon: -117.2695,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "6",
    name: "Pacific Beach",
    location: "Pacific Beach",
    lat: 32.7942,
    lon: -117.2526,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

describe("beach-search-utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBeaches as jest.Mock).mockResolvedValue({
      success: true,
      data: mockBeaches,
    });
  });

  describe("searchBeachesMultiple", () => {
    it("should return all La Jolla beaches when searching for 'la jo'", async () => {
      const results = await searchBeachesMultiple("la jo");

      expect(results.length).toBeGreaterThanOrEqual(5);
      expect(results.map((b) => b.name)).toEqual(
        expect.arrayContaining([
          "La Jolla Shores",
          "Scripps Pier",
          "Blacks Beach",
          "Windansea Beach",
          "Horseshoe",
        ])
      );
    });

    it("should return beaches sorted by relevance", async () => {
      const results = await searchBeachesMultiple("la jo");

      // First result should be exact match or shortest name
      expect(results[0].name).toContain("La Jolla");
    });

    it("should return empty array when no matches found", async () => {
      const results = await searchBeachesMultiple("xyz123nonexistent");

      expect(results).toEqual([]);
    });

    it("should handle partial matches", async () => {
      const results = await searchBeachesMultiple("scripps");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe("Scripps Pier");
    });

    it("should be case insensitive", async () => {
      const results = await searchBeachesMultiple("LA JOLLA");

      expect(results.length).toBeGreaterThanOrEqual(5);
    });

    it("should handle multi-word searches", async () => {
      const results = await searchBeachesMultiple("blacks beach");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe("Blacks Beach");
    });

    it("should handle abbreviations", async () => {
      const results = await searchBeachesMultiple("pb");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((b) => b.name === "Pacific Beach")).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database error",
      });

      const results = await searchBeachesMultiple("la jolla");

      expect(results).toEqual([]);
    });

    it("should handle exceptions gracefully", async () => {
      (getBeaches as jest.Mock).mockRejectedValue(new Error("Network error"));

      const results = await searchBeachesMultiple("la jolla");

      expect(results).toEqual([]);
    });
  });

  describe("searchBeachesByName", () => {
    it("should return the best match", async () => {
      const result = await searchBeachesByName("la jo");

      expect(result).not.toBeNull();
      expect(result?.name).toContain("La Jolla");
    });

    it("should return null when no matches found", async () => {
      const result = await searchBeachesByName("xyz123nonexistent");

      expect(result).toBeNull();
    });

    it("should return exact matches first", async () => {
      const result = await searchBeachesByName("Scripps Pier");

      expect(result?.name).toBe("Scripps Pier");
    });
  });
});

