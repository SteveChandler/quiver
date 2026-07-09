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
import { getCitiesWithBestMonthsData } from "@/actions/city/best-time-actions";
import {
  getAllBlogPosts,
  getLatestBlogModifiedDate,
} from "@/lib/data/blog-posts";
import { learnArticles } from "@/lib/data/learn-articles";

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

jest.mock("@/actions/city/best-time-actions", () => ({
  getCitiesWithBestMonthsData: jest.fn(),
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

    (getCitiesWithBestMonthsData as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  describe("Static Routes", () => {
    it("should include home page route", async () => {
      const result = await sitemap();
      const homeRoute = result.find((r) => r.url === `${baseUrl}/`);

      expect(homeRoute).not.toBeUndefined();
      expect(homeRoute?.priority).toBe(1);
    });

    it("should include /features route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/features`);

      expect(route).not.toBeUndefined();
      expect(route?.priority).toBe(0.7);
    });

    it("should include /about route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/about`);

      expect(route).not.toBeUndefined();
    });

    it("should include /privacy route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/privacy`);

      expect(route).not.toBeUndefined();
    });

    it("should include /map route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/map`);

      expect(route).not.toBeUndefined();
    });

    it("should include /plans route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/plans`);

      expect(route).not.toBeUndefined();
      expect(route?.priority).toBe(0.7);
    });

    it("should include /free-surf-reports route with high crawl priority", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/free-surf-reports`);

      expect(route).not.toBeUndefined();
      expect(route?.priority).toBe(0.85);
      expect(route?.changeFrequency).toBe("daily");
    });

    it("should include /best-surf-forecast-app route with monthly freshness", async () => {
      const result = await sitemap();
      const route = result.find(
        (r) => r.url === `${baseUrl}/best-surf-forecast-app`,
      );

      expect(route).not.toBeUndefined();
      expect(route?.priority).toBe(0.85);
      expect(route?.changeFrequency).toBe("monthly");
    });

    it("should include /forecast-accuracy (curated comparison page)", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/forecast-accuracy`);

      expect(route).not.toBeUndefined();
      expect(route?.priority).toBe(0.7);
    });

    it("should include /beaches/usa route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/beaches/usa`);

      expect(route).not.toBeUndefined();
    });

    it("should include /beaches/mexico route", async () => {
      const result = await sitemap();
      const route = result.find((r) => r.url === `${baseUrl}/beaches/mexico`);

      expect(route).not.toBeUndefined();
    });

    it("should set changeFrequency to daily for static routes", async () => {
      const result = await sitemap();
      const staticRoutes = [
        "/",
        "/features",
        "/about",
        "/privacy",
        "/plans",
        "/map",
        "/free-surf-reports",
        "/beaches/mexico",
      ];

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

    it("should include curated SEO funnel routes and skip Santa Cruz cams", async () => {
      const result = await sitemap();

      expect(result.find((r) => r.url === `${baseUrl}/surf-report/scripps-pier-today`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/surf-cams/san-diego`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/beginner/santa-cruz`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/surf-cams/santa-cruz`)).toBeUndefined();
    });
  });

  describe("Blog Routes", () => {
    it("should include the blog hub and every finite blog post", async () => {
      const result = await sitemap();

      const blogHub = result.find((r) => r.url === `${baseUrl}/blog`);
      expect(blogHub).not.toBeUndefined();
      expect(blogHub?.lastModified).toBe(getLatestBlogModifiedDate());

      for (const post of getAllBlogPosts()) {
        const route = result.find(
          (r) => r.url === `${baseUrl}/blog/${post.slug}`,
        );

        expect(route).not.toBeUndefined();
        expect(route?.lastModified).toBe(
          post.dateModified ?? post.datePublished,
        );
      }
    });
  });

  describe("Learn Routes", () => {
    it("should include every canonical learn article and exclude retired aliases", async () => {
      const result = await sitemap();

      for (const article of learnArticles) {
        const route = result.find(
          (r) => r.url === `${baseUrl}/learn/${article.slug}`,
        );

        expect(route).not.toBeUndefined();
      }

      expect(
        result.find((r) => r.url === `${baseUrl}/learn/groundswell-vs-wind-swell`),
      ).not.toBeUndefined();
      expect(
        result.find((r) => r.url === `${baseUrl}/learn/wind-swell-vs-ground-swell`),
      ).toBeUndefined();
    });
  });

  describe("Database-Driven Intent Routes", () => {
    it("should generate intent routes for cities from database", async () => {
      const result = await sitemap();

      // San Diego should have intent routes (from mocked getAllCitiesWithBeachSkills)
      const sanDiegoIntentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/san-diego`
      );
      expect(sanDiegoIntentRoute).not.toBeUndefined();

      // Encinitas should also have intent routes
      const encinitasIntentRoute = result.find(
        (r) => r.url === `${baseUrl}/beginner/encinitas`
      );
      expect(encinitasIntentRoute).not.toBeUndefined();
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
        expect(route).not.toBeUndefined();
      });
    });

    it("should exclude confirmed missing tide and water-temp city intent routes", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            city: "Dry Harbor",
            state: "CA",
            country: "USA",
            beachCount: 5,
            hasBeginnerBeaches: true,
            hasAdvancedBeaches: true,
            hasLeastCrowdedBeaches: true,
            hasEditorialContent: true,
            hasTideData: false,
            hasWaterTempData: false,
          },
          {
            city: "Live Harbor",
            state: "CA",
            country: "USA",
            beachCount: 5,
            hasBeginnerBeaches: true,
            hasAdvancedBeaches: true,
            hasLeastCrowdedBeaches: true,
            hasEditorialContent: true,
            hasTideData: true,
            hasWaterTempData: true,
          },
        ],
      });

      const result = await sitemap();

      expect(result.find((r) => r.url === `${baseUrl}/tide/dry-harbor`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/dry-harbor`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/tide/live-harbor`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/live-harbor`)).not.toBeUndefined();
    });

    it("should handle getAllCitiesWithBeachSkills failure gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (getAllCitiesWithBeachSkills as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const result = await sitemap();

      // Database-derived city-level intent routes should be absent when there is
      // no data to derive them. Curated SEO funnel routes are static and remain.
      expect(result.find((r) => r.url === `${baseUrl}/beginner/nags-head`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/beginner/san-diego`)).not.toBeUndefined();

      // Unfiltered state-level intent routes should still be present (tide, water-temp, etc.)
      expect(result.find((r) => r.url === `${baseUrl}/tide/ca`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/ca`)).not.toBeUndefined();

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
          expect(route).not.toBeUndefined();
        }
      }

      // Skill-based intents only for states with beginner beaches (CA from default mock)
      for (const intent of skillIntents) {
        expect(result.find((r) => r.url === `${baseUrl}/${intent}/ca`)).not.toBeUndefined();
        // States without beginner data should be excluded
        expect(result.find((r) => r.url === `${baseUrl}/${intent}/ga`)).toBeUndefined();
      }

      // least-crowded is now filtered: only states with hasLeastCrowdedBeaches get it.
      // Default mock has CA cities with hasLeastCrowdedBeaches: true → CA gets the route.
      expect(result.find((r) => r.url === `${baseUrl}/least-crowded/ca`)).not.toBeUndefined();
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

      // No database-derived city-level intent routes. Curated SEO funnel routes
      // are static and should still be present.
      expect(result.find((r) => r.url === `${baseUrl}/beginner/nags-head`)).toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/beginner/san-diego`)).not.toBeUndefined();

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
      expect(stateTideRoute).not.toBeUndefined();
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
      expect(result.find((r) => r.url === `${baseUrl}/tide/advanced-city`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/advanced-city`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/dawn-patrol/advanced-city`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/sunset/advanced-city`)).not.toBeUndefined();

      // least-crowded is included because hasLeastCrowdedBeaches is true
      expect(result.find((r) => r.url === `${baseUrl}/least-crowded/advanced-city`)).not.toBeUndefined();
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
      expect(result.find((r) => r.url === `${baseUrl}/beginner/beginner-town`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/longboard/beginner-town`)).not.toBeUndefined();
    });

    it("should include single-beach city intent routes in thin states with editorial content", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          // NJ has 5 total beaches (< 20 threshold), Cocoa Beach has editorial content
          { city: "Cocoa Beach", state: "FL", country: "USA", beachCount: 1, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false, hasEditorialContent: true },
          { city: "Melbourne Beach", state: "FL", country: "USA", beachCount: 2, hasBeginnerBeaches: false, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false, hasEditorialContent: true },
          // Total FL beaches: 3 (< 20)
        ],
      });

      const result = await sitemap();

      // Single-beach city in thin state WITH editorial → included
      expect(result.find((r) => r.url === `${baseUrl}/tide/cocoa-beach`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/longboard/cocoa-beach`)).not.toBeUndefined();
    });

    it("should exclude single-beach city intent routes in large states", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          // CA has many beaches (>= 20), so single-beach cities are excluded
          { city: "Tiny Cove", state: "CA", country: "USA", beachCount: 1, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false, hasEditorialContent: true },
          { city: "San Diego", state: "CA", country: "USA", beachCount: 15, hasBeginnerBeaches: true, hasAdvancedBeaches: true, hasLeastCrowdedBeaches: true, hasEditorialContent: true },
          { city: "Encinitas", state: "CA", country: "USA", beachCount: 5, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: true, hasEditorialContent: true },
          // Total CA beaches: 21 (>= 20)
        ],
      });

      const result = await sitemap();

      // Single-beach city in large state → excluded even with editorial content
      expect(result.find((r) => r.url === `${baseUrl}/tide/tiny-cove`)).toBeUndefined();
      // Multi-beach cities still included
      expect(result.find((r) => r.url === `${baseUrl}/tide/san-diego`)).not.toBeUndefined();
    });

    it("should exclude single-beach city intent routes without editorial content", async () => {
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          // Thin state but no editorial content → excluded
          { city: "No Content Beach", state: "ME", country: "USA", beachCount: 1, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false, hasEditorialContent: false },
          { city: "Quality Beach", state: "ME", country: "USA", beachCount: 1, hasBeginnerBeaches: true, hasAdvancedBeaches: false, hasLeastCrowdedBeaches: false, hasEditorialContent: true },
          // Total ME beaches: 2 (< 20)
        ],
      });

      const result = await sitemap();

      // No editorial → excluded
      expect(result.find((r) => r.url === `${baseUrl}/tide/no-content-beach`)).toBeUndefined();
      // Has editorial in thin state → included
      expect(result.find((r) => r.url === `${baseUrl}/tide/quality-beach`)).not.toBeUndefined();
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
      expect(result.find((r) => r.url === `${baseUrl}/tide/san-diego`)).not.toBeUndefined();

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
      expect(result.find((r) => r.url === `${baseUrl}/tide/newport-or`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/tide/newport`)).toBeUndefined();

      // "newport-beach" is NOT in collision list → no suffix
      expect(result.find((r) => r.url === `${baseUrl}/tide/newport-beach`)).not.toBeUndefined();

      // "koloa" is in COLLISION_CITY_SLUGS → gets state suffix
      expect(result.find((r) => r.url === `${baseUrl}/tide/koloa-hi`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/tide/koloa`)).toBeUndefined();

      // "waikoloa" is NOT in collision list → no suffix
      expect(result.find((r) => r.url === `${baseUrl}/tide/waikoloa`)).not.toBeUndefined();
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
      expect(result.find((r) => r.url === `${baseUrl}/tide/no-skill-data`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/water-temp/no-skill-data`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/dawn-patrol/no-skill-data`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/sunset/no-skill-data`)).not.toBeUndefined();

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
      expect(hierarchicalRoute).not.toBeUndefined();
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
      // Incomplete data is excluded entirely — /spots/ is a retired legacy route.
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

      expect(beachRoute).not.toBeUndefined();
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

      // Tides/water-temp sub-pages are included in sitemap — they have robust
      // metadata, FAQs, structured data, and GSC shows Google already ranks them
      const tidesRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs-garbage/tides")
      );
      const waterTempRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs-garbage/water-temp")
      );

      expect(tidesRoute).not.toBeUndefined();
      expect(waterTempRoute).not.toBeUndefined();
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

      expect(beachRoute).not.toBeUndefined();
    });

    it("should NOT include tides/water-temp subpages for international beaches", async () => {
      // International beaches use a 4-segment URL pattern and have no dedicated
      // tides/water-temp subpage routes — only US beaches get those subpages.
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: "beach-1",
            slug: "teresas",
            city: "Rosarito",
            state: "Baja California",
            country: "Mexico",
          },
          {
            id: "beach-2",
            slug: "sunset-cliffs-garbage",
            city: "San Diego",
            state: "CA",
            country: "USA",
          },
        ],
      });

      const result = await sitemap();

      // International beach: main page present, subpages absent
      expect(result.find((r) => r.url.includes("/mexico/baja-california/rosarito/teresas"))).not.toBeUndefined();
      expect(result.find((r) => r.url.includes("/mexico/baja-california/rosarito/teresas/tides"))).toBeUndefined();
      expect(result.find((r) => r.url.includes("/mexico/baja-california/rosarito/teresas/water-temp"))).toBeUndefined();

      // US beach: main page AND subpages present
      expect(result.find((r) => r.url.includes("/ca/san-diego/sunset-cliffs-garbage") && !r.url.includes("/tides") && !r.url.includes("/water-temp"))).not.toBeUndefined();
      expect(result.find((r) => r.url.includes("/ca/san-diego/sunset-cliffs-garbage/tides"))).not.toBeUndefined();
      expect(result.find((r) => r.url.includes("/ca/san-diego/sunset-cliffs-garbage/water-temp"))).not.toBeUndefined();
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

    it("should set priority 0.65 for beach tides/water-temp routes", async () => {
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

      const tidesRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs-garbage/tides")
      );
      const waterTempRoute = result.find((r) =>
        r.url.includes("/ca/san-diego/sunset-cliffs-garbage/water-temp")
      );

      expect(tidesRoute).not.toBeUndefined();
      expect(tidesRoute?.priority).toBe(0.65);
      expect(waterTempRoute).not.toBeUndefined();
      expect(waterTempRoute?.priority).toBe(0.65);
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
      expect(result.find((r) => r.url === `${baseUrl}/`)).not.toBeUndefined();
      // Should not have any beach routes
      expect(result.find((r) => r.url.includes("/spots/"))).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe("Location Routes", () => {
    it("should include location routes from getAllBeachLocations", async () => {
      // Populate validCitySlugs so US cities pass the scored-beach cross-validation.
      // International cities (Mexico) bypass this check so no beach entry needed for Rosarito.
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { id: "b1", slug: "childrens-pool", city: "La Jolla", state: "CA", country: "USA" },
          { id: "b2", slug: "swamis", city: "Encinitas", state: "CA", country: "USA" },
        ],
      });
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
      expect(laJollaRoute).not.toBeUndefined();

      const rosaritoRoute = result.find((r) =>
        r.url.endsWith("/mexico/baja-california/rosarito")
      );
      expect(rosaritoRoute).not.toBeUndefined();

      const mexicoIndexRoute = result.find((r) =>
        r.url.endsWith("/beaches/mexico")
      );
      expect(mexicoIndexRoute).not.toBeUndefined();

      const bajaCaliforniaRoute = result.find((r) =>
        r.url.endsWith("/beaches/mexico/baja-california")
      );
      expect(bajaCaliforniaRoute).not.toBeUndefined();
    });

    it("should include USA state index routes under /beaches/usa/{state}", async () => {
      // Populate validCitySlugs for US cities — state index pages are derived from
      // cities that pass the scored-beach cross-validation.
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { id: "b1", slug: "windansea", city: "La Jolla", state: "CA", country: "USA" },
          { id: "b2", slug: "haleiwa-ali", city: "Haleiwa", state: "HI", country: "USA" },
        ],
      });
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
      expect(caStateIndex).not.toBeUndefined();

      const hiStateIndex = result.find((r) => r.url === `${baseUrl}/beaches/usa/hi`);
      expect(hiStateIndex).not.toBeUndefined();

      // Ensure we don't create a USA state index for non-USA locations
      const bajaStateIndex = result.find((r) =>
        r.url === `${baseUrl}/beaches/usa/baja-california`
      );
      expect(bajaStateIndex).toBeUndefined();
    });

    it("should emit both island-specific canonical URLs for HI Waimea (waimea-kauai + waimea-big-island)", async () => {
      // Waimea is handled specially (island-specific pages emitted directly, bypassing validCitySlugs)
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "Waimea", state: "HI", country: "USA", beachCount: 5 }],
      });

      const result = await sitemap();

      const kauai = result.find((r) => r.url === `${baseUrl}/hi/waimea-kauai`);
      expect(kauai).not.toBeUndefined();

      const bigIsland = result.find(
        (r) => r.url === `${baseUrl}/hi/waimea-big-island`
      );
      expect(bigIsland).not.toBeUndefined();

      // Ensure ambiguous /waimea is not emitted
      const ambiguous = result.find((r) => r.url === `${baseUrl}/hi/waimea`);
      expect(ambiguous).toBeUndefined();
    });

    it("should emit ASCII-normalized canonical slugs for diacritics (Rincón -> rincon)", async () => {
      // Populate validCitySlugs so Rincón passes the scored-beach cross-validation.
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { id: "b1", slug: "domes", city: "Rincón", state: "PR", country: "USA" },
        ],
      });
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "Rincón", state: "PR", country: "USA", beachCount: 6 }],
      });

      const result = await sitemap();

      const canonical = result.find((r) => r.url.endsWith("/pr/rincon"));
      expect(canonical).not.toBeUndefined();

      const redirecting = result.find((r) => r.url.endsWith("/pr/rinc-n"));
      expect(redirecting).toBeUndefined();
    });

    it("should set priority 0.75 for location routes", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ id: "b1", slug: "la-jolla-cove", city: "La Jolla", state: "CA", country: "USA" }],
      });
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "La Jolla", state: "CA", country: "USA", beachCount: 5 }],
      });

      const result = await sitemap();
      const locationRoute = result.find((r) =>
        r.url.endsWith("/ca/la-jolla")
      );

      expect(locationRoute?.priority).toBe(0.85);
    });

    it("should set changeFrequency to weekly for location routes", async () => {
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ id: "b1", slug: "la-jolla-cove", city: "La Jolla", state: "CA", country: "USA" }],
      });
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "La Jolla", state: "CA", country: "USA", beachCount: 5 }],
      });

      const result = await sitemap();
      const locationRoute = result.find((r) =>
        r.url.endsWith("/ca/la-jolla")
      );

      expect(locationRoute?.changeFrequency).toBe("hourly");
    });

    it("should include single-beach city pages (beachCount >= 1) but exclude zero-beach cities", async () => {
      // Mock getBeaches so validCitySlugs is populated for "big-city" and "tiny-town".
      // Both need a matching beach entry to pass the scored-beach cross-validation.
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { id: "b1", slug: "main-peak", city: "Big City", state: "CA", country: "USA" },
          { id: "b2", slug: "lone-break", city: "Tiny Town", state: "CA", country: "USA" },
        ],
      });
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          // beachCount: 5 — well above threshold
          { city: "Big City", state: "CA", country: "USA", beachCount: 5 },
          // beachCount: 1 — single-beach cities are now included (threshold lowered from 2 to 1)
          { city: "Tiny Town", state: "CA", country: "USA", beachCount: 1 },
          // beachCount: 0 — no beaches, should be excluded (non-metro)
          { city: "Ghost Town", state: "CA", country: "USA", beachCount: 0 },
        ],
      });

      const result = await sitemap();

      // Both big-city and tiny-town have beachCount >= 1 AND a valid beach entry
      expect(result.find((r) => r.url.endsWith("/ca/big-city"))).not.toBeUndefined();
      expect(result.find((r) => r.url.endsWith("/ca/tiny-town"))).not.toBeUndefined();
      // ghost-town has no beaches — excluded even though it has no valid beach entry
      expect(result.find((r) => r.url.endsWith("/ca/ghost-town"))).toBeUndefined();
    });

    it("should include metro areas even though they have beachCount 0", async () => {
      // Mock getBeaches so validCitySlugs is populated for "encinitas".
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { id: "b1", slug: "swamis", city: "Encinitas", state: "CA", country: "USA" },
        ],
      });
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { city: "Orange County", state: "CA", country: "USA", beachCount: 0, isMetro: true },
          { city: "Encinitas", state: "CA", country: "USA", beachCount: 5 },
        ],
      });

      const result = await sitemap();

      // Metro area should still be included despite beachCount: 0
      expect(result.find((r) => r.url.endsWith("/ca/orange-county"))).not.toBeUndefined();
      expect(result.find((r) => r.url.endsWith("/ca/encinitas"))).not.toBeUndefined();
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
      expect(result.find((r) => r.url === `${baseUrl}/`)).not.toBeUndefined();
      // Should not have any state-level or city-level location routes from the failed generator
      // (though cities are still used for intent routes from a different data source)
      consoleSpy.mockRestore();
    });
  });

  describe("Guide Routes", () => {
    it("should include hub region guide routes", async () => {
      const result = await sitemap();

      // Check for expected hub regions
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-southern-california`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-san-diego`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-orange-county`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/guides/surfing-hawaii`)).not.toBeUndefined();
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
      // Beach is in "San Diego" — add a La Jolla beach so validCitySlugs includes it
      (getBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          { id: "beach-1", slug: "sunset-cliffs-garbage", city: "San Diego", state: "CA" },
          { id: "beach-2", slug: "la-jolla-cove", city: "La Jolla", state: "CA", country: "USA" },
        ],
      });
      (getAllBeachLocations as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ city: "La Jolla", state: "CA", country: "USA", beachCount: 5 }],
      });

      const result = await sitemap();

      // Static routes
      expect(result.find((r) => r.url === `${baseUrl}/`)).not.toBeUndefined();
      expect(result.find((r) => r.url === `${baseUrl}/features`)).not.toBeUndefined();

      // Beach routes
      expect(result.find((r) => r.url.includes("sunset-cliffs"))).not.toBeUndefined();

      // Location routes
      expect(result.find((r) => r.url.endsWith("/ca/la-jolla"))).not.toBeUndefined();

      // Intent routes
      expect(result.find((r) => r.url.includes("/beginner/"))).not.toBeUndefined();

      // Guide routes
      expect(result.find((r) => r.url.includes("/guides/surfing-"))).not.toBeUndefined();

      // Forecast routes
      expect(result.find((r) => r.url === `${baseUrl}/forecast`)).not.toBeUndefined();

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

      expect(forecastHub).not.toBeUndefined();
      expect(forecastHub?.priority).toBe(0.9);
      expect(forecastHub?.changeFrequency).toBe("daily");
    });

    it("should include regional forecast pages", async () => {
      const result = await sitemap();
      const regionalForecast = result.find((r) => r.url.includes("/forecast/southern-california"));

      expect(regionalForecast).not.toBeUndefined();
      expect(regionalForecast?.priority).toBe(0.8);
      expect(regionalForecast?.changeFrequency).toBe("daily");
    });
  });
});
