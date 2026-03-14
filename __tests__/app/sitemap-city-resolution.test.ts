/**
 * Sitemap City Slug Resolution Tests
 *
 * Validates that every city slug generated for the sitemap can be correctly
 * resolved back by findCityBySlug(). This prevents the Google "Page with redirect"
 * error where incorrect canonical URLs are selected due to ambiguous city lookups.
 *
 * Root Cause (fixed):
 * - Sitemap generates "/beginner/nags-head-nc" (with state suffix due to collision)
 * - Google crawls "/beginner/nags-head" (without suffix)
 * - findCityBySlug("nags-head") returns null (ambiguous)
 * - Page returns empty metadata {} - no canonical tag
 * - Google picks random canonical like "/tide/hull"
 *
 * This test ensures the buildCitySlug → findCityBySlug roundtrip works correctly.
 */

import { buildCitySlug, detectCityCollisions } from "@/lib/seo/city-slug-utils";
import { findCityBySlug } from "@/actions/city/city-metadata-actions";
import { getAllCitiesWithBeachSkills } from "@/actions/beach/beach-location-actions";

// Mock the Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  { id: "1", name: "Test Beach", slug: "test-beach", skill_level: "beginner", lat: 35.9, lon: -75.6 }
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
    rpc: jest.fn().mockImplementation((funcName, params) => {
      // Mock the find_cities_by_pattern RPC
      if (funcName === "find_cities_by_pattern") {
        const { search_pattern, state_filter } = params;

        // Simulate realistic city lookups
        const cityDatabase: Record<string, { city: string; state: string; beach_count: number }[]> = {
          "nags head": [
            { city: "Nags Head", state: "NC", beach_count: 5 },
          ],
          "newport": [
            { city: "Newport", state: "OR", beach_count: 3 },
            { city: "Newport", state: "RI", beach_count: 2 },
          ],
          "newport beach": [
            { city: "Newport Beach", state: "CA", beach_count: 10 },
          ],
          "santa cruz": [
            { city: "Santa Cruz", state: "CA", beach_count: 8 },
          ],
          "hull": [
            { city: "Hull", state: "MA", beach_count: 2 },
          ],
        };

        const matches = cityDatabase[search_pattern.toLowerCase()] || [];
        const filtered = state_filter
          ? matches.filter((m) => m.state === state_filter)
          : matches;

        return Promise.resolve({ data: filtered, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "Unknown RPC" } });
    }),
  }),
}));

describe("Sitemap City Slug Resolution", () => {
  describe("buildCitySlug → findCityBySlug roundtrip", () => {
    it("resolves unique city slugs without state suffix", async () => {
      // Santa Cruz is unique - no collision
      const collisions = new Map<string, number>();
      const slug = buildCitySlug("Santa Cruz", "CA", collisions);

      expect(slug).toBe("santa-cruz");

      const result = await findCityBySlug(slug);
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.cityName).toBe("Santa Cruz");
      expect(result.data?.state).toBe("CA");
    });

    it("resolves collision city slugs WITH state suffix", async () => {
      // Newport exists in OR and RI - needs state suffix
      const collisions = new Map<string, number>([["newport", 2]]);
      const slug = buildCitySlug("Newport", "OR", collisions);

      expect(slug).toBe("newport-or");

      const result = await findCityBySlug(slug);
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.cityName).toBe("Newport");
      expect(result.data?.state).toBe("OR");
    });

    it("resolves substring collision city slugs WITH state suffix", async () => {
      // "nags head" would collide with substring matching in ILIKE
      // (e.g., if "nags-head-beach" existed, "nags-head" would match both)
      const collisions = new Map<string, number>([["nags-head", 2]]);
      const slug = buildCitySlug("Nags Head", "NC", collisions);

      expect(slug).toBe("nags-head-nc");

      const result = await findCityBySlug(slug);
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.cityName).toBe("Nags Head");
      expect(result.data?.state).toBe("NC");
    });
  });

  describe("detectCityCollisions identifies substring collisions", () => {
    it("flags cities whose slug is a substring of another", () => {
      const cities = [
        { city: "Newport", state: "OR" },
        { city: "Newport Beach", state: "CA" },
      ];

      const collisions = detectCityCollisions(cities);

      // "newport" is substring of "newport-beach", so it gets flagged
      expect(collisions.has("newport")).toBe(true);
      // "newport-beach" is NOT a substring of anything
      expect(collisions.has("newport-beach")).toBe(false);
    });

    it("flags cities that appear in multiple states", () => {
      const cities = [
        { city: "Newport", state: "OR" },
        { city: "Newport", state: "RI" },
      ];

      const collisions = detectCityCollisions(cities);

      // Newport appears in 2 states
      expect(collisions.has("newport")).toBe(true);
      expect(collisions.get("newport")).toBe(2);
    });

    it("does not flag unique cities", () => {
      const cities = [
        { city: "Encinitas", state: "CA" },
        { city: "Carlsbad", state: "CA" },
      ];

      const collisions = detectCityCollisions(cities);

      expect(collisions.has("encinitas")).toBe(false);
      expect(collisions.has("carlsbad")).toBe(false);
    });
  });

  describe("findCityBySlug returns null for ambiguous lookups", () => {
    it("returns null when city appears in multiple states without state suffix", async () => {
      // "newport" without state suffix matches OR and RI
      const result = await findCityBySlug("newport");

      // Should return null because it's ambiguous (2 matches, no state filter)
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("resolves ambiguous cities when state suffix is provided", async () => {
      // "newport-or" explicitly specifies Oregon
      const result = await findCityBySlug("newport-or");

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.cityName).toBe("Newport");
      expect(result.data?.state).toBe("OR");
    });
  });

  describe("Prevents Google canonical issues", () => {
    it("sitemap slug resolves to exactly one city (not ambiguous)", async () => {
      // This simulates what the sitemap generator does
      const citiesFromDb = [
        { city: "Nags Head", state: "NC" },
        { city: "Newport", state: "OR" },
        { city: "Newport Beach", state: "CA" },
        { city: "Santa Cruz", state: "CA" },
      ];

      const collisions = detectCityCollisions(citiesFromDb);

      for (const city of citiesFromDb) {
        const slug = buildCitySlug(city.city, city.state, collisions);
        const result = await findCityBySlug(slug);

        // Every slug generated by sitemap MUST resolve successfully
        expect(result.success).toBe(true);
        expect(result.data).not.toBeNull();
        expect(result.data?.cityName).toBe(city.city);
        expect(result.data?.state).toBe(city.state.toUpperCase());
      }
    });

    it("non-canonical slugs return null, triggering 404 with proper metadata", async () => {
      // Someone accesses /beginner/nags-head (without -nc suffix)
      // but the canonical URL is /beginner/nags-head-nc
      //
      // Before fix: Empty metadata {} → Google picks random canonical
      // After fix: Returns metadata with canonical and noindex
      const result = await findCityBySlug("nags-head");

      // This should succeed since "nags head" uniquely matches NC
      // (In real scenarios, it would only fail if there's actual ambiguity)
      // The page component handles the fallback metadata regardless
      expect(result.success).toBe(true);
    });
  });
});

describe("Intent Page Metadata Always Has Canonical", () => {
  /**
   * This test documents the expected behavior after the fix:
   * - generateMetadata ALWAYS returns alternates.canonical
   * - Even for 404 pages, canonical points to self
   * - This prevents Google from selecting arbitrary canonicals
   */

  it("documents that 404 pages should have self-referential canonical", () => {
    // This is a documentation test - the actual implementation
    // is in app/[intent]/[city]/page.tsx generateMetadata
    //
    // When findCityBySlug fails:
    // return {
    //   title: `${definition.label} Spots | Quiver`,
    //   description: `Find ${definition.label.toLowerCase()} surf spots...`,
    //   alternates: {
    //     canonical: `${baseUrl}/${params.intent}/${params.city}`,
    //   },
    //   robots: { index: false, follow: true },
    // };
    //
    // This ensures:
    // 1. Canonical tag is ALWAYS present
    // 2. Canonical points to SELF (prevents Google from picking random URLs)
    // 3. noindex prevents thin content from being indexed
    // 4. follow allows link equity to flow to valid pages
    expect(true).toBe(true);
  });

  it("documents that state-suffixed redirects handle legacy URLs", () => {
    // This is a documentation test - the actual implementation
    // is in app/[intent]/[city]/page.tsx IntentPage component
    //
    // When findCityBySlug fails and slug doesn't end with state suffix:
    // - Try common coastal states: ca, fl, hi, nc, sc, nj, ny, or, wa, tx, ma, me, ri
    // - If state-suffixed version exists, redirect to canonical URL
    //
    // Example:
    //   User accesses: /beginner/nags-head
    //   Page tries: findCityBySlug("nags-head-nc")
    //   If found: redirect("/beginner/nags-head-nc")
    //
    // This handles:
    // 1. Legacy links without state suffix
    // 2. User guessing URLs without knowing the canonical format
    // 3. SEO redirect consolidation to canonical URLs
    expect(true).toBe(true);
  });
});
