/**
 * Tests for Flat Sitemap Generation
 *
 * Tests the sitemap.ts file that generates a single flat XML sitemap.
 * Reverted from segmented pattern due to Next.js 16 bug where generateSitemaps()
 * does NOT auto-generate a sitemap index at /sitemap.xml.
 *
 * Routes included:
 * - static: Home, features, about, etc.
 * - beaches: Beach detail pages + beach-level intent pages (tides, water-temp)
 * - locations: City/state listing pages
 * - intents: City and state intent pages (beginner, tide, etc.)
 * - guides: Hub region guide pages
 * - forecasts: Forecast hub and regional forecast pages
 */

import sitemap from "@/app/sitemap";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getAllCitiesWithBeachSkills } from "@/actions/beach/beach-location-actions";

// Mock the action modules
jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getAllBeachLocations: jest.fn(),
}));

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeaches: jest.fn(),
}));

jest.mock("@/actions/beach/beach-location-actions", () => ({
  getAllCitiesWithBeachSkills: jest.fn(),
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

    // Mock database-driven city resolution with skill-level flags
    (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        { city: "San Diego", state: "CA", country: "USA", beachCount: 15, hasBeginnerBeaches: true, hasAdvancedBeaches: true, hasLeastCrowdedBeaches: true, hasEditorialContent: true },
        { city: "Encinitas", state: "CA", country: "USA", beachCount: 5, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: true, hasEditorialContent: true },
      ],
    });
  });

  describe("Static Routes", () => {
    it("should include home page route", async () => {
      const result = await sitemap();
      const homeRoute = result.find((r) => r.url === `${baseUrl}/`);

      expect(homeRoute).toBeTruthy();
      expect(homeRoute?.priority).toBe(1);
    });

    it("should include /features route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/features`);

      expect(route).toBeTruthy();
      expect(route?.priority).toBe(0.7);
    });

    it("should include /about route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/about`);

      expect(route).toBeTruthy();
    });

    it("should include /privacy route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/privacy`);

      expect(route).toBeTruthy();
    });

    it("should include /map route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/map`);

      expect(route).toBeTruthy();
    });

    it("should include /beaches/usa route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/beaches/usa`);

      expect(route).toBeTruthy();
    });

    it("should set changeFrequency to daily for static routes", async () => {
      const result = await sitemap();
      const staticRoutes = ["/", "/features", "/about", "/privacy", "/map"];

      staticRoutes.forEach((path) => {
        const route = result.find((r) => r.url === `${baseUrl}${path}`);
        expect(route?.changeFrequency).toBe("daily");
      });
    });

    it("should set lastModified to fixed date for static routes", async () => {
      const result = await sitemap();
      const homeRoute = result.find((r) => r.url === `${baseUrl}/`);

      expect(homeRoute?.lastModified).toBe("2026-02-10");
    });
  });

  describe("Database-Driven Intent Routes", () => {
    it("should generate intent routes for cities from database", async () => {
      const result = await sitemap();

      // San Diego should have intent routes (from mocked getAllCitiesWithBeachSkills)
      const sanDiegoIntentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/san-diego`
      );
      expect(sanDiegoIntentRoute).toBeTruthy();

      // Encinitas should also have intent routes
      const encinitasIntentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/encinitas`
      );
      expect(encinitasIntentRoute).toBeTruthy();
    });

    it("should call getAllCitiesWithBeachSkills with minimum beach count", async () => {
      await sitemap();

      expect(getAllCitiesWithBeachSkills).toHaveBeenCalledWith(1);
    });

    it("should generate all intent types for each city", async () => {
      const result = await sitemap();
      const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];

      intents.forEach((intent) => {
        const route = result.find(
          (r) => r.url === `${baseUrl}/${intent}/san-diego`
        );
        expect(route).toBeTruthy();
      });
    });

    it("should handle getAllCitiesWithBeachSkills failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (getAllCitiesWithBeachSkills as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const result = await sitemap();

      // City-level intent routes should be absent (no data to derive them)
      expect(result.find((r) => r.url === `${baseUrl}/beginner/san-diego`)).toBeUndefined();

      // Unfiltered state-level intent routes should still be present (tide, water-temp, etc.)
      expect(result.find((r) => r.url === `${baseUrl}/tide/ca`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/ca`)).toBeTruthy();

      // Filtered state-level intents (beginner, longboard, least-crowded) are now excluded
      // when city data is unavailable — fail-closed to avoid indexing empty pages.
      expect(result.find((r) => r.url === `${baseUrl}/beginner/ca`)).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it("should include state-level intent routes", async () => {
      const result = await sitemap();
      const usStates = ["ca", "or", "wa", "hi", "fl", "nj", "ny", "nc", "sc", "tx"];
      const unFilteredIntents = ["tide", "water-temp", "dawn-patrol", "sunset"];
      const skillIntents = ["beginner", "longboard"];

      // Unfiltered intents should exist for all states
      for (const state of usStates) {
        for (const intent of unFilteredIntents) {
          const route = result.find((r) => r.url === `${baseUrl}/${intent}/${state}`);
          expect(route).toBeTruthy();
        }
      }

      // Skill-based intents only for states with beginner beaches (CA from default mock)
      for (const intent of skillIntents) {
        expect(result.find((r) => r.url === `${baseUrl}/${intent}/ca`)).toBeTruthy();
        // States without beginner data should be excluded
        expect(result.find((r) => r.url === `${baseUrl}/${intent}/ga`)).toBeUndefined();
      }

      // least-crowded is now filtered: only states with hasLeastCrowdedBeaches get it.
      // Default mock has CA cities with hasLeastCrowdedBeaches: true → CA gets the route.
      expect(result.find((r) => r.url === `${baseUrl}/least-crowded/ca`)).toBeTruthy();
      // GA has no cities in the mock → least-crowded/ga should be excluded.
      expect(result.find((r) => r.url === `${baseUrl}/least-crowded/ga`)).toBeUndefined();
    });
  });

  describe("Intent Route Priorities", () => {
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

    it("should not generate city or filtered-state intent routes when getAllCitiesWithBeachSkills returns empty", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await sitemap();

      // No city-level intent routes
      const cityIntentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/san-diego`
      );
      expect(cityIntentRoute).toBeUndefined();

      // Filtered state-level intent routes (beginner, longboard, least-crowded) are
      // excluded when city data returns empty — fail-closed prevents indexing empty pages.
      const stateBeginnerRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/ca`
      );
      expect(stateBeginnerRoute).toBeUndefined();

      // Unfiltered state-level intent routes (tide, water-temp, etc.) still exist
      const stateTideRoute = result.find(
        (r) => r.url === `${baseUrl}/tide/ca`
      );
      expect(stateTideRoute).toBeTruthy();
    });

    it("should exclude beginner/longboard intents for cities without beginner beaches", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "Advanced City", state: "CA", country: "USA", beachCount: 5, hasBeginnerBeaches: false, hasAdvancedBeaches: true, hasLeastCrowdedBeaches: true },
        ],
      });

      const result = await sitemap();

      // Should NOT have beginner or longboard for this city
      expect(result.find((r) => r.url === `${baseUrl}/beginner/advanced-city`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/longboard/advanced-city`)).toBeUndefined();

      // Should still include non-filtered intents
      expect(result.find((r) => r.url === `${baseUrl}/tide/advanced-city`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/advanced-city`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/dawn-patrol/advanced-city`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/sunset/advanced-city`)).toBeTruthy();

      // least-crowded is included because hasLeastCrowdedBeaches is true
      expect(result.find((r) => r.url === `${baseUrl}/least-crowded/advanced-city`)).toBeTruthy();
    });

    it("should include beginner/longboard intents for cities WITH beginner beaches", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "Beginner Town", state: "CA", country: "USA", beachCount: 3, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false },
        ],
      });

      const result = await sitemap();

      // Should include beginner and longboard
      expect(result.find((r) => r.url === `${baseUrl}/beginner/beginner-town`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/longboard/beginner-town`)).toBeTruthy();
    });

    it("should exclude non-US cities from intent routes", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "San Diego", state: "CA", country: "USA", beachCount: 15, hasBeginnerBeaches: true, hasAdvancedBeaches: true, hasLeastCrowdedBeaches: true },
          { city: "Rosarito", state: "Baja California", country: "Mexico", beachCount: 3, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false },
          { city: "Puerto Nuevo", state: "Baja California", country: "Mexico", beachCount: 2, hasBeginnerBeaches: false, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false },
        ],
      });

      const result = await sitemap();

      // US city should be present
      expect(result.find((r) => r.url === `${baseUrl}/tide/san-diego`)).toBeTruthy();

      // Non-US cities should NOT have intent routes
      expect(result.find((r) => r.url === `${baseUrl}/tide/rosarito`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/tide/puerto-nuevo`)).toBeUndefined();
    });

    it("should add state suffix for cities whose slug is a substring of another city slug", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "Newport", state: "OR", country: "USA", beachCount: 5, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false },
          { city: "Newport Beach", state: "CA", country: "USA", beachCount: 10, hasBeginnerBeaches: true, hasAdvancedBeaches: true, hasLeastCrowdedBeaches: false },
          { city: "Koloa", state: "HI", country: "USA", beachCount: 3, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false },
          { city: "Waikoloa", state: "HI", country: "USA", beachCount: 5, hasBeginnerBeaches: false, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false },
        ],
      });

      const result = await sitemap();

      // "newport" is in COLLISION_CITY_SLUGS → gets state suffix
      expect(result.find((r) => r.url === `${baseUrl}/tide/newport-or`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/tide/newport`)).toBeUndefined();

      // "newport-beach" is NOT in collision list → no suffix
      expect(result.find((r) => r.url === `${baseUrl}/tide/newport-beach`)).toBeTruthy();

      // "koloa" is in COLLISION_CITY_SLUGS → gets state suffix
      expect(result.find((r) => r.url === `${baseUrl}/tide/koloa-hi`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/tide/koloa`)).toBeUndefined();

      // "waikoloa" is NOT in collision list → no suffix
      expect(result.find((r) => r.url === `${baseUrl}/tide/waikoloa`)).toBeTruthy();
    });

    it("should still include non-filtered intents for all cities regardless of skill/crowd flags", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "No Skill Data", state: "FL", country: "USA", beachCount: 5, hasBeginnerBeaches: false, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false },
        ],
      });

      const result = await sitemap();

      // Unfiltered intents always included (no state suffix since not in collision list)
      expect(result.find((r) => r.url === `${baseUrl}/tide/no-skill-data`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/no-skill-data`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/dawn-patrol/no-skill-data`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/sunset/no-skill-data`)).toBeTruthy();

      // Filtered intents excluded (no beginner beaches, no least-crowded beaches)
      expect(result.find((r) => r.url === `${baseUrl}/beginner/no-skill-data`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/longboard/no-skill-data`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/least-crowded/no-skill-data`)).toBeUndefined();
    });
  });

  describe("Beach Routes", () => {
    it("should use hierarchical URL for beaches with complete location data", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: "CA",
            country: "USA",
          },
        ],
      });

      const result = await sitemap();
      // Complete data uses hierarchical URL (canonical, no redirect)
      const hierarchicalRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs")
      );
      expect(hierarchicalRoute).toBeTruthy();
    });

    it("should exclude beaches missing location data (no /spots/ fallback)", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "mystery-break",
            city: null,
            state: null,
            country: null,
          },
        ],
      });

      const result = await sitemap();
      // Incomplete data is excluded entirely — /spots/ URLs are blocked by robots.txt
      const spotsRoute = result.find((r) =>
        r.url.includes("/spots/mystery-break")
      );
      expect(spotsRoute).toBeUndefined();
      // No entry at all for this beach
      const anyBreakRoute = result.find((r) => r.url.includes("mystery-break"));
      expect(anyBreakRoute).toBeUndefined();
    });

    it("should include beach routes using hierarchical URL for complete data", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: "CA",
            country: "USA",
            updated_at: "2024-12-01T00:00:00Z",
          },
        ],
      });

      const result = await sitemap();
      // Uses hierarchical URL when city and state are present (matches redirect in /spots/[slug])
      const beachRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs")
      );

      expect(beachRoute).toBeTruthy();
    });

    it("should include tides and water-temp pages for beaches with hierarchical URLs", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: "CA",
            country: "USA",
          },
        ],
      });

      const result = await sitemap();

      // NOTE: Tides/water-temp sub-pages are excluded from sitemap to reduce thin content signals
      // They are discoverable via internal links on beach detail pages
      const tidesRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs/tides")
      );
      const waterTempRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs/water-temp")
      );

      expect(tidesRoute).toBeUndefined();
      expect(waterTempRoute).toBeUndefined();
    });

    it("should exclude beaches without hierarchical URLs entirely", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "mystery-break",
            city: null,
            state: null,
          },
        ],
      });

      const result = await sitemap();

      // Beaches without city+state are excluded entirely (no /spots/ fallback)
      expect(result.find((r) => r.url.includes("/spots/mystery-break"))).toBeUndefined();
      expect(result.find((r) => r.url.includes("mystery-break"))).toBeUndefined();
    });

    it("should use hierarchical URL for international beaches with complete data", async () => {
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
      // Uses hierarchical URL for international beaches with complete data
      const beachRoute = result.find((r) =>
        r.url.includes("/mexico/baja-california/rosarito/teresas")
      );

      expect(beachRoute).toBeTruthy();
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
      // Beach with null slug should not be in beach entries
      const beachRoute = result.find(
        (r) => r.url.includes("/spots/") && r.url.includes("beach-1")
      );

      expect(beachRoute).toBeUndefined();
    });

    it("should exclude beaches without city (no /spots/ fallback)", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: null, // Missing city — excluded from sitemap
            state: "CA",
          },
        ],
      });

      const result = await sitemap();
      // Neither hierarchical nor /spots/ URL should appear
      expect(result.find((r) => r.url.includes("/spots/sunset-cliffs"))).toBeUndefined();
      expect(result.find((r) => r.url.includes("sunset-cliffs"))).toBeUndefined();
    });

    it("should exclude beaches without state (no /spots/ fallback)", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: null, // Missing state — excluded from sitemap
          },
        ],
      });

      const result = await sitemap();
      // Neither hierarchical nor /spots/ URL should appear
      expect(result.find((r) => r.url.includes("/spots/sunset-cliffs"))).toBeUndefined();
      expect(result.find((r) => r.url.includes("sunset-cliffs"))).toBeUndefined();
    });

    it("should set priority 0.7 for beach routes", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: "CA",
            country: "USA",
          },
        ],
      });

      const result = await sitemap();
      const beachRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs") && !r.url.includes("/tides") && !r.url.includes("/water-temp")
      );

      expect(beachRoute?.priority).toBe(0.7);
    });

    it("should set priority 0.55 for beach tides/water-temp routes", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: "CA",
            country: "USA",
          },
        ],
      });

      const result = await sitemap();

      // NOTE: Tides/water-temp sub-pages are excluded from sitemap to reduce thin content signals
      const tidesRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs/tides")
      );
      const waterTempRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs/water-temp")
      );

      expect(tidesRoute).toBeUndefined();
      expect(waterTempRoute).toBeUndefined();
    });

    it("should use beach updated_at for lastModified", async () => {
      const updatedAt = "2024-11-15T12:00:00Z";
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: "CA",
            country: "USA",
            updated_at: updatedAt,
          },
        ],
      });

      const result = await sitemap();
      const beachRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs") && !r.url.includes("/tides") && !r.url.includes("/water-temp")
      );

      expect(beachRoute?.lastModified).toBe(updatedAt);
    });

    it("should handle getBeaches failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (getBeaches as jest.Mock).mockResolvedValue({
        success: false,
        data: null,
      });

      const result = await sitemap();

      // Should still return other routes (static, locations, intents, guides, forecasts)
      expect(result.length).toBeGreaterThan(0);
      expect(result.find((r) => r.url === `${baseUrl}/`)).toBeTruthy();
      // Should not have any beach routes
      expect(result.find((r) => r.url.includes("/spots/"))).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe("Location Routes", () => {
    it("should include location routes from getAllBeachLocations", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "La Jolla", state: "CA", country: "USA", beachCount: 5 },
          { city: "Encinitas", state: "CA", country: "USA", beachCount: 3 },
          { city: "Rosarito", state: "Baja California", country: "Mexico", beachCount: 4 },
        ],
      });

      const result = await sitemap();

      const laJollaRoute = result.find((r) =>
        r.url.endsWith("/ca/la-jolla")
      );
      expect(laJollaRoute).toBeTruthy();

      const rosaritoRoute = result.find((r) =>
        r.url.endsWith("/mexico/baja-california/rosarito")
      );
      expect(rosaritoRoute).toBeTruthy();
    });

    it("should include USA state index routes under /beaches/usa/{state}", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "La Jolla", state: "CA", country: "USA", beachCount: 5 },
          { city: "Haleiwa", state: "HI", country: "USA", beachCount: 3 },
          { city: "Rosarito", state: "Baja California", country: "Mexico", beachCount: 4 },
        ],
      });

      const result = await sitemap();

      const caStateIndex = result.find((r) => r.url === `${baseUrl}/beaches/usa/ca`);
      expect(caStateIndex).toBeTruthy();

      const hiStateIndex = result.find((r) => r.url === `${baseUrl}/beaches/usa/hi`);
      expect(hiStateIndex).toBeTruthy();

      // Ensure we don't create a USA state index for non-USA locations
      const bajaStateIndex = result.find((r) =>
        r.url === `${baseUrl}/beaches/usa/baja-california`
      );
      expect(bajaStateIndex).toBeUndefined();
    });

    it("should emit both island-specific canonical URLs for HI Waimea (waimea-kauai + waimea-big-island)", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "Waimea", state: "HI", country: "USA", beachCount: 5 }],
      });

      const result = await sitemap();

      const kauai = result.find((r) => r.url === `${baseUrl}/hi/waimea-kauai`);
      expect(kauai).toBeTruthy();

      const bigIsland = result.find(
        (r) => r.url === `${baseUrl}/hi/waimea-big-island`
      );
      expect(bigIsland).toBeTruthy();

      // Ensure ambiguous /waimea is not emitted
      const ambiguous = result.find((r) => r.url === `${baseUrl}/hi/waimea`);
      expect(ambiguous).toBeUndefined();
    });

    it("should emit ASCII-normalized canonical slugs for diacritics (Rincón -> rincon)", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "Rincón", state: "PR", country: "USA", beachCount: 6 }],
      });

      const result = await sitemap();

      const canonical = result.find((r) => r.url.endsWith("/pr/rincon"));
      expect(canonical).toBeTruthy();

      const redirecting = result.find((r) => r.url.endsWith("/pr/rinc-n"));
      expect(redirecting).toBeUndefined();
    });

    it("should set priority 0.75 for location routes", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "La Jolla", state: "CA", country: "USA", beachCount: 5 }],
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
        data: [{ city: "La Jolla", state: "CA", country: "USA", beachCount: 5 }],
      });

      const result = await sitemap();
      const locationRoute = result.find((r) =>
        r.url.endsWith("/ca/la-jolla")
      );

      expect(locationRoute?.changeFrequency).toBe("weekly");
    });

    it("should exclude thin-content locations with fewer than 2 beaches", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "Big City", state: "CA", country: "USA", beachCount: 5 },
          { city: "Tiny Town", state: "CA", country: "USA", beachCount: 1 },
        ],
      });

      const result = await sitemap();

      expect(result.find((r) => r.url.endsWith("/ca/big-city"))).toBeTruthy();
      expect(result.find((r) => r.url.endsWith("/ca/tiny-town"))).toBeUndefined();
    });

    it("should include metro areas even though they have beachCount 0", async () => {
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "Orange County", state: "CA", country: "USA", beachCount: 0, isMetro: true },
          { city: "Encinitas", state: "CA", country: "USA", beachCount: 5 },
        ],
      });

      const result = await sitemap();

      // Metro area should still be included despite beachCount: 0
      expect(result.find((r) => r.url.endsWith("/ca/orange-county"))).toBeTruthy();
      expect(result.find((r) => r.url.endsWith("/ca/encinitas"))).toBeTruthy();
    });

    it("should handle getAllBeachLocations failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: false,
        data: null,
      });

      const result = await sitemap();

      // Should still return other routes (static, beaches, intents, guides, forecasts)
      expect(result.length).toBeGreaterThan(0);
      expect(result.find((r) => r.url === `${baseUrl}/`)).toBeTruthy();
      // Should not have any state-level or city-level location routes from the failed generator
      // (though cities are still used for intent routes from a different data source)
      consoleSpy.mockRestore();
    });
  });

  describe("Guide Routes", () => {
    it("should include hub region guide routes", async () => {
      const result = await sitemap();

      // Check for expected hub regions
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-southern-california`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-san-diego`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-orange-county`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-hawaii`)).toBeTruthy();
    });

    it("should set priority 0.9 for guide routes", async () => {
      const result = await sitemap();
      const guideRoute = result.find((r) => r.url.includes("/guides/surfing-"));

      expect(guideRoute?.priority).toBe(0.9);
    });

    it("should set changeFrequency to weekly for guide routes", async () => {
      const result = await sitemap();
      const guideRoute = result.find((r) => r.url.includes("/guides/surfing-"));

      expect(guideRoute?.changeFrequency).toBe("weekly");
    });
  });

  describe("Combined Sitemap", () => {
    it("should include all route types in single sitemap", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { id: "beach-1", slug: "sunset-cliffs-garbage", city: "San Diego", state: "CA" },
        ],
      });
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "La Jolla", state: "CA", country: "USA", beachCount: 5 }],
      });

      const result = await sitemap();

      // Static routes
      expect(result.find((r) => r.url === `${baseUrl}/`)).toBeTruthy();
      expect(result.find((r) => r.url === `${baseUrl}/features`)).toBeTruthy();

      // Beach routes
      expect(result.find((r) => r.url.includes("sunset-cliffs"))).toBeTruthy();

      // Location routes
      expect(result.find((r) => r.url.endsWith("/ca/la-jolla"))).toBeTruthy();

      // Intent routes
      expect(result.find((r) => r.url.includes("/beginner/"))).toBeTruthy();

      // Guide routes
      expect(result.find((r) => r.url.includes("/guides/surfing-"))).toBeTruthy();

      // Forecast routes
      expect(result.find((r) => r.url === `${baseUrl}/forecast`)).toBeTruthy();

      // Sanity check: flat sitemap should contain a meaningful number of URLs
      expect(result.length).toBeGreaterThan(10);
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

  describe("Forecast Routes", () => {
    it("should include forecast hub landing page", async () => {
      const result = await sitemap();
      const forecastHub = result.find((r) => r.url === `${baseUrl}/forecast`);

      expect(forecastHub).toBeTruthy();
      expect(forecastHub?.priority).toBe(0.9);
      expect(forecastHub?.changeFrequency).toBe("daily");
    });

    it("should include regional forecast pages", async () => {
      const result = await sitemap();
      const regionalForecast = result.find((r) => r.url.includes("/forecast/southern-california"));

      expect(regionalForecast).toBeTruthy();
      expect(regionalForecast?.priority).toBe(0.8);
      expect(regionalForecast?.changeFrequency).toBe("daily");
    });
  });
});
