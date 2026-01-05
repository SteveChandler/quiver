/**
 * Tests for Sitemap Generation
 *
 * Tests the sitemap.ts file that generates the XML sitemap for the application.
 * Priority 2 test coverage for San Diego page redesign.
 */

import sitemap from "@/app/sitemap";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import {
  SURF_CITY_SLUGS,
  getCityBySlug,
} from "@/lib/data/surf-spots";

// Mock the action modules
jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getAllBeachLocations: jest.fn(),
}));

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeaches: jest.fn(),
}));

// Mock the surf-spots module to control test data
jest.mock("@/lib/data/surf-spots", () => ({
  SURF_CITY_SLUGS: ["san-diego", "orange-county"],
  getCityBySlug: jest.fn(),
}));

describe("Sitemap Generation", () => {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (getAllBeachLocations as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    (getBeaches as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    (getCityBySlug as jest.Mock).mockImplementation((slug: string) => ({
      slug,
      name: slug === "san-diego" ? "San Diego" : "Orange County",
      featuredIntents: ["beginner", "tide"],
    }));
  });

  describe("Static Routes", () => {
    it("should include home page route", async () => {
      const result = await sitemap();
      const homeRoute = result.find((r) => r.url === `${baseUrl}/`);

      expect(homeRoute).toBeDefined();
      expect(homeRoute?.priority).toBe(1);
    });

    it("should include /features route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/features`);

      expect(route).toBeDefined();
      expect(route?.priority).toBe(0.7);
    });

    it("should include /about route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/about`);

      expect(route).toBeDefined();
    });

    it("should include /privacy route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/privacy`);

      expect(route).toBeDefined();
    });

    it("should include /map route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/map`);

      expect(route).toBeDefined();
    });

    it("should set changeFrequency to daily for static routes", async () => {
      const result = await sitemap();
      const staticRoutes = ["/", "/features", "/about", "/privacy", "/map"];

      staticRoutes.forEach((path) => {
        const route = result.find((r) => r.url === `${baseUrl}${path}`);
        expect(route?.changeFrequency).toBe("daily");
      });
    });

    it("should set lastModified to current date", async () => {
      const beforeTest = new Date().toISOString().split("T")[0];
      const result = await sitemap();
      const homeRoute = result.find((r) => r.url === `${baseUrl}/`);

      expect(homeRoute?.lastModified).toBeDefined();
      expect(
        (homeRoute?.lastModified as string).startsWith(beforeTest)
      ).toBe(true);
    });
  });

  describe("City Routes", () => {
    it("should include routes for all SURF_CITY_SLUGS", async () => {
      const result = await sitemap();

      SURF_CITY_SLUGS.forEach((slug) => {
        const route = result.find(
          (r) => r.url === `${baseUrl}/beaches/usa/ca/${slug}`
        );
        expect(route).toBeDefined();
      });
    });

    it("should set high priority (0.9) for city routes", async () => {
      const result = await sitemap();
      const cityRoute = result.find(
        (r) => r.url === `${baseUrl}/beaches/usa/ca/san-diego`
      );

      expect(cityRoute?.priority).toBe(0.9);
    });

    it("should use correct URL format /ca/{city}", async () => {
      const result = await sitemap();
      const cityRoutes = result.filter((r) =>
        r.url.includes("/beaches/usa/ca/")
      );

      cityRoutes.forEach((route) => {
        expect(route.url).toMatch(/\/beaches\/usa\/ca\/[a-z-]+$/);
      });
    });

    it("should call getCityBySlug for each city", async () => {
      await sitemap();

      expect(getCityBySlug).toHaveBeenCalledWith("san-diego");
      expect(getCityBySlug).toHaveBeenCalledWith("orange-county");
    });
  });

  describe("Intent Routes", () => {
    it("should generate intent routes for each city", async () => {
      const result = await sitemap();
      const intentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/san-diego`
      );

      expect(intentRoute).toBeDefined();
    });

    it("should prioritize beginner intent (0.85) over others (0.8)", async () => {
      const result = await sitemap();

      const beginnerRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/san-diego`
      );
      const tideRoute = result.find(
        (r) => r.url === `${baseUrl}/tide/san-diego`
      );

      expect(beginnerRoute?.priority).toBe(0.85);
      expect(tideRoute?.priority).toBe(0.8);
    });

    it("should use correct URL format /{intent}/{city}", async () => {
      const result = await sitemap();
      const intentRoutes = result.filter(
        (r) => r.url.includes("/beginner/") || r.url.includes("/tide/")
      );

      intentRoutes.forEach((route) => {
        expect(route.url).toMatch(/\/(beginner|tide)\/[a-z-]+$/);
      });
    });

    it("should skip intent routes for city with empty featuredIntents", async () => {
      // Note: cityRoutes uses getCityBySlug(slug)! which assumes non-null
      // (SURF_CITY_SLUGS is expected to be curated with valid entries)
      // But intentRoutes properly filters cities without featuredIntents
      (getCityBySlug as jest.Mock).mockImplementation((slug: string) => {
        if (slug === "orange-county") {
          return {
            slug,
            name: "Orange County",
            featuredIntents: [], // Empty intents array
          };
        }
        return {
          slug,
          name: "San Diego",
          featuredIntents: ["beginner"],
        };
      });

      const result = await sitemap();
      // Intent routes for orange-county should not exist (empty featuredIntents)
      const ocIntentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/orange-county`
      );

      expect(ocIntentRoute).toBeUndefined();

      // But SD intent routes should still exist
      const sdIntentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/san-diego`
      );
      expect(sdIntentRoute).toBeDefined();
    });
  });

  describe("Curated Spot Routes", () => {
    it("should not include deprecated /spots routes", async () => {
      const result = await sitemap();
      const hasDeprecatedSpotsRoutes = result.some((r) =>
        r.url.includes("/spots/")
      );
      expect(hasDeprecatedSpotsRoutes).toBe(false);
    });
  });

  describe("Location Routes", () => {
    it("should include location routes from getAllBeachLocations", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "La Jolla", state: "CA", country: "USA" },
          { city: "Encinitas", state: "CA", country: "USA" },
          { city: "Rosarito", state: "Baja California", country: "Mexico" },
        ],
      });

      const result = await sitemap();

      const laJollaRoute = result.find((r) =>
        r.url.endsWith("/ca/la-jolla")
      );
      expect(laJollaRoute).toBeDefined();

      const rosaritoRoute = result.find((r) =>
        r.url.endsWith("/mexico/baja-california/rosarito")
      );
      expect(rosaritoRoute).toBeDefined();
    });

    it("should include USA state index routes under /beaches/usa/{state}", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "La Jolla", state: "CA", country: "USA" },
          { city: "Haleiwa", state: "HI", country: "USA" },
          { city: "Rosarito", state: "Baja California", country: "Mexico" },
        ],
      });

      const result = await sitemap();

      const caStateIndex = result.find((r) => r.url === `${baseUrl}/beaches/usa/ca`);
      expect(caStateIndex).toBeDefined();

      const hiStateIndex = result.find((r) => r.url === `${baseUrl}/beaches/usa/hi`);
      expect(hiStateIndex).toBeDefined();

      // Ensure we don't create a USA state index for non-USA locations
      const bajaStateIndex = result.find((r) =>
        r.url === `${baseUrl}/beaches/usa/baja-california`
      );
      expect(bajaStateIndex).toBeUndefined();
    });

    it("should emit both island-specific canonical URLs for HI Waimea (waimea-kauai + waimea-big-island)", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "Waimea", state: "HI", country: "USA" }],
      });

      const result = await sitemap();

      const kauai = result.find((r) => r.url === `${baseUrl}/beaches/usa/hi/waimea-kauai`);
      expect(kauai).toBeDefined();

      const bigIsland = result.find(
        (r) => r.url === `${baseUrl}/beaches/usa/hi/waimea-big-island`
      );
      expect(bigIsland).toBeDefined();

      // Ensure ambiguous /waimea is not emitted
      const ambiguous = result.find((r) => r.url === `${baseUrl}/beaches/usa/hi/waimea`);
      expect(ambiguous).toBeUndefined();
    });

    it("should emit ASCII-normalized canonical slugs for diacritics (Rincón -> rincon)", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "Rincón", state: "PR", country: "USA" }],
      });

      const result = await sitemap();

      const canonical = result.find((r) => r.url.endsWith("/pr/rincon"));
      expect(canonical).toBeDefined();

      const redirecting = result.find((r) => r.url.endsWith("/pr/rinc-n"));
      expect(redirecting).toBeUndefined();
    });

    it("should set priority 0.75 for location routes", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "La Jolla", state: "CA", country: "USA" }],
      });

      const result = await sitemap();
      const locationRoute = result.find((r) =>
        r.url.endsWith("/ca/la-jolla")
      );

      expect(locationRoute?.priority).toBe(0.75);
    });

    it("should set changeFrequency to weekly for location routes", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "La Jolla", state: "CA", country: "USA" }],
      });

      const result = await sitemap();
      const locationRoute = result.find((r) =>
        r.url.endsWith("/ca/la-jolla")
      );

      expect(locationRoute?.changeFrequency).toBe("weekly");
    });

    it("should handle getAllBeachLocations failure gracefully", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: false,
        data: null,
      });

      const result = await sitemap();

      // Should still return other routes
      expect(result.length).toBeGreaterThan(0);
      expect(result.find((r) => r.url === `${baseUrl}/`)).toBeDefined();
    });

    it("should handle getAllBeachLocations exception gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (getAllBeachLocations as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const result = await sitemap();

      // Should still return other routes
      expect(result.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Beach Routes", () => {
    it("should include beach routes from getBeaches", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs",
            city: "San Diego",
            state: "CA",
            country: "USA",
            updated_at: "2024-12-01T00:00:00Z",
          },
        ],
      });

      const result = await sitemap();
      // buildBeachUrl returns /{state}/{city}/{beach} format
      const beachRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs")
      );

      expect(beachRoute).toBeDefined();
    });

    it("should include international beach routes when country is non-USA", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "teresas",
            city: "Rosarito",
            state: "Baja California",
            country: "Mexico",
            updated_at: "2024-12-01T00:00:00Z",
          },
        ],
      });

      const result = await sitemap();
      const beachRoute = result.find((r) =>
        r.url.includes("/mexico/baja-california/rosarito/teresas")
      );

      expect(beachRoute).toBeDefined();
    });

    it("should filter out beaches without slug from beach entries", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: null, // Missing slug
            city: "San Diego",
            state: "CA",
          },
        ],
      });

      const result = await sitemap();
      // Beach with null slug should not be in beach entries (hierarchical URLs)
      const beachHierarchicalRoute = result.find(
        (r) => r.url.includes("/ca/san-diego/")
      );

      expect(beachHierarchicalRoute).toBeUndefined();
    });

    it("should filter out beaches without city", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs",
            city: null, // Missing city
            state: "CA",
          },
        ],
      });

      const result = await sitemap();
      const sunsetRoute = result.find((r) =>
        r.url.includes("sunset-cliffs")
      );

      expect(sunsetRoute).toBeUndefined();
    });

    it("should filter out beaches without state", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs",
            city: "San Diego",
            state: null, // Missing state
          },
        ],
      });

      const result = await sitemap();
      const sunsetRoute = result.find((r) =>
        r.url.includes("sunset-cliffs")
      );

      expect(sunsetRoute).toBeUndefined();
    });

    it("should set priority 0.6 for beach routes", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs",
            city: "San Diego",
            state: "CA",
            country: "USA",
          },
        ],
      });

      const result = await sitemap();
      const beachRoute = result.find((r) =>
        r.url.includes("sunset-cliffs")
      );

      expect(beachRoute?.priority).toBe(0.6);
    });

    it("should use beach updated_at for lastModified", async () => {
      const updatedAt = "2024-11-15T12:00:00Z";
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs",
            city: "San Diego",
            state: "CA",
            country: "USA",
            updated_at: updatedAt,
          },
        ],
      });

      const result = await sitemap();
      const beachRoute = result.find((r) =>
        r.url.includes("sunset-cliffs")
      );

      expect(beachRoute?.lastModified).toBe(updatedAt);
    });
  });

  describe("Forecast Routes", () => {
    it("should not include forecast routes (noindex + excluded from sitemap)", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-123",
            slug: "sunset-cliffs",
            city: "San Diego",
            state: "CA",
          },
        ],
      });

      const result = await sitemap();
      const hasForecastRoutes = result.some((r) => r.url.includes("/forecast/"));

      expect(hasForecastRoutes).toBe(false);
    });
  });

  describe("Sitemap Structure", () => {
    it("should return array of sitemap entries", async () => {
      const result = await sitemap();

      expect(Array.isArray(result)).toBe(true);
      result.forEach((entry) => {
        expect(entry).toHaveProperty("url");
        expect(entry).toHaveProperty("lastModified");
        expect(entry).toHaveProperty("changeFrequency");
        expect(entry).toHaveProperty("priority");
      });
    });

    it("should have all URLs starting with base URL", async () => {
      const result = await sitemap();

      result.forEach((entry) => {
        expect(entry.url.startsWith(baseUrl)).toBe(true);
      });
    });

    it("should have valid priority values (0-1)", async () => {
      const result = await sitemap();

      result.forEach((entry) => {
        expect(entry.priority).toBeGreaterThanOrEqual(0);
        expect(entry.priority).toBeLessThanOrEqual(1);
      });
    });

    it("should have valid changeFrequency values", async () => {
      const validFrequencies = [
        "always",
        "hourly",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "never",
      ];

      const result = await sitemap();

      result.forEach((entry) => {
        expect(validFrequencies).toContain(entry.changeFrequency);
      });
    });
  });

  describe("Error Handling", () => {
    it("should continue if beach query fails", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: false,
        data: null,
      });

      const result = await sitemap();

      // Should still include static routes
      expect(result.find((r) => r.url === `${baseUrl}/`)).toBeDefined();
    });

    it("should return valid sitemap even with all queries failing", async () => {
      (getAllBeachLocations as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );
      (getBeaches as jest.Mock).mockResolvedValue({
        success: false,
        data: null,
      });

      jest.spyOn(console, "error").mockImplementation();

      const result = await sitemap();

      // Should still include static and city routes
      expect(result.length).toBeGreaterThan(0);
      expect(result.find((r) => r.url === `${baseUrl}/`)).toBeDefined();
    });
  });
});
