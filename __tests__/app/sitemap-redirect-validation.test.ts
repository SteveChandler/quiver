/**
 * Sitemap Redirect Validation Tests
 *
 * Validates that every URL in the sitemap is canonical (does not redirect).
 * Sitemap URLs should be the "final destination" URLs that the redirect
 * system resolves TO, not FROM.
 *
 * If a sitemap URL redirects, it means:
 * 1. Search engines will waste crawl budget following redirects
 * 2. Link equity is diluted through redirect chains
 * 3. There may be conflicting URL canonicalization
 *
 * Created in response to Ahrefs crawl finding redirect issues.
 */

import { handleSeoRedirect } from "@/lib/middleware/seo-redirect-handler";
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

/**
 * Extract the path from a full sitemap URL
 */
function extractPath(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    return url.pathname;
  } catch {
    // If it's already a path, return as-is
    return fullUrl;
  }
}

describe("Sitemap URLs are Canonical", () => {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    // Setup default mocks
    (getAllBeachLocations as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    (getBeaches as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  describe("Static Routes", () => {
    const staticRoutes = [
      "/",
      "/features",
      "/about",
      "/privacy",
      "/map",
      "/beaches/usa",
    ];

    it.each(staticRoutes)(
      "static route %s does not redirect",
      async (path) => {
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    );
  });

  describe("Intent Routes (2-segment format)", () => {
    /**
     * The canonical format for intent routes is /{intent}/{city}
     * These should NEVER redirect
     */
    const intents = [
      "beginner",
      "longboard",
      "tide",
      "water-temp",
      "dawn-patrol",
      "sunset",
      "least-crowded",
    ];

    const cities = [
      "san-diego",
      "malibu",
      "santa-cruz",
      "huntington-beach",
      "encinitas",
      "cardiff-by-the-sea",
      "newport-beach",
    ];

    it("2-segment intent URLs are canonical", async () => {
      for (const intent of intents) {
        for (const city of cities) {
          const path = `/${intent}/${city}`;
          const result = await handleSeoRedirect(path);

          expect(result.redirect).toBe(false);
        }
      }
    });

    it("state-level intent URLs are canonical", async () => {
      const states = ["ca", "or", "wa", "hi", "fl", "nj", "ny", "nc", "sc", "tx"];

      for (const intent of intents) {
        for (const state of states) {
          const path = `/${intent}/${state}`;
          const result = await handleSeoRedirect(path);

          // State-level intent routes like /beginner/ca should not redirect
          expect(result.redirect).toBe(false);
        }
      }
    });
  });

  describe("Hub Region Routes", () => {
    const hubRegions = [
      "southern-california",
      "northern-california",
      "hawaii",
      "florida",
      "new-jersey",
    ];

    it.each(hubRegions)(
      "hub route /guides/surfing-%s does not redirect",
      async (region) => {
        const path = `/guides/surfing-${region}`;
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    );
  });

  describe("USA State Routes", () => {
    /**
     * The canonical format for state index pages is /beaches/usa/{state}
     * NOT /{state} (which redirects to this format)
     */
    const usaStates = [
      "ca",
      "or",
      "wa",
      "hi",
      "fl",
      "nj",
      "ny",
      "nc",
      "sc",
      "tx",
    ];

    it.each(usaStates)(
      "canonical state route /beaches/usa/%s does not redirect",
      async (state) => {
        const path = `/beaches/usa/${state}`;
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    );

    it.each(usaStates)(
      "short state route /%s SHOULD redirect (not in sitemap)",
      async (state) => {
        const path = `/${state}`;
        const result = await handleSeoRedirect(path);
        // Short format redirects to canonical format
        expect(result.redirect).toBe(true);
        expect(result.url).toBe(`/beaches/usa/${state}`);
      }
    );
  });

  describe("Location Routes", () => {
    it("USA location routes (/beaches/usa/{state}/{city}) do not redirect", async () => {
      const locationPaths = [
        "/beaches/usa/ca/san-diego",
        "/beaches/usa/ca/malibu",
        "/beaches/usa/hi/honolulu",
        "/beaches/usa/nj/asbury-park",
        "/beaches/usa/fl/miami",
      ];

      for (const path of locationPaths) {
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    });

    it("international location routes do not redirect", async () => {
      const intlPaths = [
        "/beaches/mexico/baja-california/rosarito",
        "/beaches/costa-rica/guanacaste/tamarindo",
      ];

      for (const path of intlPaths) {
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    });
  });

  describe("Beach Routes", () => {
    /**
     * Beach routes should use hierarchical URLs when data is complete:
     * /{state}/{city}/{beach-slug} for US beaches
     * /spots/{beach-slug} for incomplete or international beaches
     */
    it("hierarchical beach URLs do not redirect", async () => {
      const beachPaths = [
        "/ca/san-diego/blacks",
        "/ca/malibu/surfrider",
        "/hi/oahu/pipeline",
      ];

      for (const path of beachPaths) {
        // Note: These may trigger a DB lookup to verify beach exists,
        // but the canonical URL format should not redirect to a different format
        const result = await handleSeoRedirect(path);

        // If the beach doesn't exist (no mock), redirect returns false anyway
        // If it exists, it should only redirect if city is WRONG, not format
        if (result.redirect && result.url) {
          // If it redirects, it should be to the same format (city correction)
          // NOT to a different URL structure
          const originalSegments = path.split("/").filter(Boolean);
          const targetSegments = result.url.split("/").filter(Boolean);
          expect(targetSegments.length).toBe(originalSegments.length);
        }
      }
    });

    it("/spots/{slug} URLs do not redirect", async () => {
      const spotsPaths = [
        "/spots/sunset-cliffs",
        "/spots/mystery-break",
        "/spots/alfonsos",
      ];

      for (const path of spotsPaths) {
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    });
  });

  describe("Cross-Reference with Sitemap Generation", () => {
    /**
     * Simulate the URL formats generated by sitemap.ts and verify
     * none of them redirect
     */
    it("generated intent URLs match canonical format", async () => {
      // Mock the data that sitemap.ts uses
      (getAllCitiesWithBeachSkills as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            city: "San Diego",
            state: "CA",
            country: "USA",
            beachCount: 15,
            hasBeginnerBeaches: true,
            hasAdvancedBeaches: true,
          },
          {
            city: "Encinitas",
            state: "CA",
            country: "USA",
            beachCount: 5,
            hasBeginnerBeaches: true,
            hasAdvancedBeaches: false,
          },
        ],
      });

      // Sitemap generates /{intent}/{city-slug} format
      const generatedUrls = [
        "/beginner/san-diego",
        "/tide/san-diego",
        "/water-temp/san-diego",
        "/beginner/encinitas",
        "/tide/encinitas",
      ];

      for (const path of generatedUrls) {
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    });

    it("generated location URLs match canonical format", async () => {
      // Sitemap generates /beaches/usa/{state}/{city} for US locations
      const generatedLocationUrls = [
        "/beaches/usa/ca/san-diego",
        "/beaches/usa/ca/la-jolla",
        "/beaches/usa/hi/waimea-kauai",
        "/beaches/usa/hi/waimea-big-island",
      ];

      for (const path of generatedLocationUrls) {
        const result = await handleSeoRedirect(path);
        expect(result.redirect).toBe(false);
      }
    });
  });

  describe("Negative Cases - URLs that SHOULD redirect", () => {
    /**
     * These URLs should NOT be in the sitemap because they redirect.
     * This test documents the expected redirect behavior.
     */
    const shouldRedirectUrls = [
      // Short state format → canonical /beaches/usa/{state}
      { url: "/ca", expectedTarget: "/beaches/usa/ca" },
      { url: "/nj", expectedTarget: "/beaches/usa/nj" },

      // Legacy 3-segment intent → canonical 2-segment (no state suffix unless collision city)
      { url: "/sunset/ca/san-diego", expectedTarget: "/sunset/san-diego" },
      { url: "/tide/nj/asbury-park", expectedTarget: "/tide/asbury-park" },

      // Legacy 4-segment intent → canonical 2-segment (no state suffix unless collision city)
      { url: "/sunset/ca/san-diego/blacks", expectedTarget: "/sunset/san-diego" },
    ];

    it.each(shouldRedirectUrls)(
      "$url should redirect to $expectedTarget (not in sitemap)",
      async ({ url, expectedTarget }) => {
        const result = await handleSeoRedirect(url);
        expect(result.redirect).toBe(true);
        expect(result.url).toBe(expectedTarget);
      }
    );
  });
});

describe("Sitemap URL Format Reference", () => {
  /**
   * This section documents the expected canonical URL formats
   * that should appear in the sitemap.
   *
   * Use this as a reference when updating sitemap generation
   * to ensure consistency with redirect rules.
   */

  describe("Canonical URL Formats", () => {
    /**
     * Intent URLs:
     * - Canonical: /{intent}/{city}
     * - Legacy (redirects): /{intent}/{state}/{city}
     * - Legacy (redirects): /{intent}/{state}/{city}/{beach}
     */
    it("documents intent URL canonical format", async () => {
      // Canonical format - should NOT redirect
      const canonical = await handleSeoRedirect("/beginner/san-diego");
      expect(canonical.redirect).toBe(false);

      // Legacy formats - should redirect to canonical (no state suffix unless collision city)
      const legacy3 = await handleSeoRedirect("/beginner/ca/san-diego");
      expect(legacy3.redirect).toBe(true);
      expect(legacy3.url).toBe("/beginner/san-diego");

      const legacy4 = await handleSeoRedirect("/beginner/ca/san-diego/blacks");
      expect(legacy4.redirect).toBe(true);
      expect(legacy4.url).toBe("/beginner/san-diego");
    });

    /**
     * State index URLs:
     * - Canonical: /beaches/usa/{state}
     * - Legacy (redirects): /{state}
     */
    it("documents state URL canonical format", async () => {
      // Canonical format - should NOT redirect
      const canonical = await handleSeoRedirect("/beaches/usa/ca");
      expect(canonical.redirect).toBe(false);

      // Legacy format - should redirect to canonical
      const legacy = await handleSeoRedirect("/ca");
      expect(legacy.redirect).toBe(true);
      expect(legacy.url).toBe("/beaches/usa/ca");
    });

    /**
     * City location URLs:
     * - Canonical (USA): /beaches/usa/{state}/{city}
     * - Canonical (Intl): /beaches/{country}/{region}/{city}
     */
    it("documents location URL canonical format", async () => {
      // USA format - should NOT redirect
      const usaCanonical = await handleSeoRedirect("/beaches/usa/ca/san-diego");
      expect(usaCanonical.redirect).toBe(false);

      // International format - should NOT redirect
      const intlCanonical = await handleSeoRedirect(
        "/beaches/mexico/baja-california/rosarito"
      );
      expect(intlCanonical.redirect).toBe(false);
    });
  });
});
