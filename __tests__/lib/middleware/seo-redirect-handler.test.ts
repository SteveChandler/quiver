/**
 * SEO Redirect Handler Unit Tests
 *
 * Tests URL pattern detection and slug extraction for old beach URLs
 * that may 404 due to:
 * - City name mismatches (e.g., "orange-county" vs actual city "dana-point")
 * - URL typos (e.g., "rincn" instead of "rincon")
 * - Mexico route structure changes
 */

import {
  isOldBeachUrlPattern,
  extractBeachSlugFromPath,
  lookupBeachBySlug,
  buildCanonicalBeachUrl,
  handleSeoRedirect,
  classifyUrlPattern,
} from "@/lib/middleware/seo-redirect-handler";

describe("SeoRedirectHandler", () => {
  describe("classifyUrlPattern", () => {
    it("classifies state-only URLs", () => {
      expect(classifyUrlPattern("/ca")).toBe("state-only");
      expect(classifyUrlPattern("/nj")).toBe("state-only");
      expect(classifyUrlPattern("/pr")).toBe("state-only");
    });

    it("classifies US beach URLs", () => {
      expect(classifyUrlPattern("/ca/san-diego/blacks")).toBe("us-beach");
      expect(classifyUrlPattern("/ca/orange-county/doheny-state-beach")).toBe("us-beach");
    });

    it("classifies Mexico beach URLs", () => {
      expect(classifyUrlPattern("/mexico/baja-california/rosarito/alfonsos")).toBe("mexico-beach");
    });

    it("returns none for reserved paths", () => {
      expect(classifyUrlPattern("/api/test")).toBe("none");
      expect(classifyUrlPattern("/auth/sign-in")).toBe("none");
      expect(classifyUrlPattern("/admin/users/settings")).toBe("none");
    });

    it("classifies legacy intent pages for redirect", () => {
      // 2-segment intent URLs (/{intent}/{city}) should be classified for redirect
      expect(classifyUrlPattern("/beginner/malibu")).toBe("legacy-intent");
      expect(classifyUrlPattern("/tide/cardiff-by-the-sea")).toBe("legacy-intent");
    });

    it("returns none for invalid patterns", () => {
      expect(classifyUrlPattern("/")).toBe("none");
      expect(classifyUrlPattern("")).toBe("none");
      expect(classifyUrlPattern("/invalid/city/beach")).toBe("none");
    });
  });

  describe("isOldBeachUrlPattern", () => {
    it("matches 3-segment state/city/beach URLs", () => {
      expect(isOldBeachUrlPattern("/ca/orange-county/huntington-pier")).toBe(
        true
      );
      expect(isOldBeachUrlPattern("/pr/rincn/indicators-rincon-pr")).toBe(true);
    });

    it("does NOT match 4-segment mexico URLs (handled by existing route)", () => {
      // Mexico URLs have a working page route, so SEO redirect handler should not match them
      expect(
        isOldBeachUrlPattern("/mexico/baja-california/rosarito/alfonsos")
      ).toBe(false);
    });

    it("rejects non-beach patterns", () => {
      expect(isOldBeachUrlPattern("/api/health")).toBe(false);
      expect(isOldBeachUrlPattern("/auth/sign-in")).toBe(false);
      expect(isOldBeachUrlPattern("/ca/san-diego")).toBe(false); // only 2 segments after state
      expect(isOldBeachUrlPattern("/")).toBe(false);
    });

    it("rejects reserved paths that look like state/city/beach", () => {
      expect(isOldBeachUrlPattern("/admin/users/settings")).toBe(false);
      expect(isOldBeachUrlPattern("/app/features/forecast")).toBe(false);
      expect(isOldBeachUrlPattern("/beach/san-diego/ocean")).toBe(false);
    });

    it("rejects paths with invalid state slugs", () => {
      expect(isOldBeachUrlPattern("/invalid/city/beach")).toBe(false);
      expect(isOldBeachUrlPattern("/xyz/somewhere/somebeach")).toBe(false);
    });

    it("handles edge cases", () => {
      expect(isOldBeachUrlPattern("")).toBe(false);
      expect(isOldBeachUrlPattern("/ca")).toBe(false);
      expect(isOldBeachUrlPattern("/ca/")).toBe(false);
      expect(isOldBeachUrlPattern("/ca/city/beach/extra/segments")).toBe(false);
    });
  });

  describe("extractBeachSlugFromPath", () => {
    it("extracts slug from 3-segment URL", () => {
      expect(extractBeachSlugFromPath("/ca/orange-county/huntington-pier")).toBe(
        "huntington-pier"
      );
    });

    it("returns null for 4-segment URL (not matched)", () => {
      // 4-segment URLs are not matched by isOldBeachUrlPattern
      expect(
        extractBeachSlugFromPath("/mexico/baja-california/rosarito/alfonsos")
      ).toBe(null);
    });

    it("returns null for invalid URLs", () => {
      expect(extractBeachSlugFromPath("/ca/san-diego")).toBe(null);
      expect(extractBeachSlugFromPath("/")).toBe(null);
      expect(extractBeachSlugFromPath("")).toBe(null);
    });

    it("handles trailing slashes", () => {
      expect(
        extractBeachSlugFromPath("/ca/orange-county/huntington-pier/")
      ).toBe("huntington-pier");
    });

    it("returns null for invalid path patterns", () => {
      expect(extractBeachSlugFromPath("/admin/users/settings")).toBe(null);
      expect(extractBeachSlugFromPath("/api/someservice/endpoint")).toBe(null);
      expect(extractBeachSlugFromPath("/auth/sign-in/confirm")).toBe(null);
      expect(extractBeachSlugFromPath("/app/features/forecast")).toBe(null);
      expect(extractBeachSlugFromPath("/beach/san-diego/ocean")).toBe(null);
      expect(
        extractBeachSlugFromPath("/invalid/city/beach")
      ).toBe(null);
      expect(
        extractBeachSlugFromPath("/xyz/somewhere/somebeach")
      ).toBe(null);
    });
  });

  describe("lookupBeachBySlug", () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      // Set up environment variables for each test
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    });

    afterEach(() => {
      if (fetchSpy) {
        fetchSpy.mockRestore();
      }
    });

    it("returns beach data when found", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              slug: "doheny-state-beach",
              state: "CA",
              city: "Dana Point",
              name: "Doheny State Beach",
            },
          ]),
      } as Response);

      const result = await lookupBeachBySlug("doheny-state-beach");

      expect(result).toEqual({
        slug: "doheny-state-beach",
        state: "CA",
        city: "Dana Point",
        name: "Doheny State Beach",
      });
    });

    it("returns null when not found", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const result = await lookupBeachBySlug("nonexistent-beach");

      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      fetchSpy = jest
        .spyOn(global, "fetch")
        .mockRejectedValue(new Error("Network error"));

      const result = await lookupBeachBySlug("any-beach");

      expect(result).toBeNull();
    });

    it("returns null when Supabase credentials are missing", async () => {
      // Remove environment variables for this test
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const result = await lookupBeachBySlug("any-beach");

      expect(result).toBeNull();
    });

    it("returns null when response is not ok", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      } as Response);

      const result = await lookupBeachBySlug("any-beach");

      expect(result).toBeNull();
    });

    it("calls Supabase REST API with correct parameters", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await lookupBeachBySlug("test-beach");

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://test.supabase.co/rest/v1/beaches?slug=eq.test-beach&select=slug,state,city,name&limit=1",
        expect.objectContaining({
          headers: {
            apikey: "test-anon-key",
            Authorization: "Bearer test-anon-key",
          },
        })
      );
    });

    it("properly encodes special characters in slug", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await lookupBeachBySlug("beach with spaces");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("slug=eq.beach%20with%20spaces"),
        expect.anything()
      );
    });
  });

  describe("buildCanonicalBeachUrl", () => {
    it("builds URL for US beach with state and city", () => {
      const result = buildCanonicalBeachUrl({
        slug: "doheny-state-beach",
        state: "CA",
        city: "Dana Point",
        name: "Doheny State Beach",
      });

      expect(result).toBe("/ca/dana-point/doheny-state-beach");
    });

    it("builds URL for beach with lowercase state", () => {
      const result = buildCanonicalBeachUrl({
        slug: "huntington-beach-pier-southside",
        state: "ca",
        city: "Huntington Beach",
        name: "Huntington Beach Pier Southside",
      });

      expect(result).toBe("/ca/huntington-beach/huntington-beach-pier-southside");
    });

    it("returns /spots/ URL for Mexico beach (non-US state)", () => {
      const result = buildCanonicalBeachUrl({
        slug: "alfonsos",
        state: "Baja California",
        city: "Rosarito",
        name: "Alfonsos",
      });

      expect(result).toBe("/spots/alfonsos");
    });

    it("returns /spots/ URL for beach with missing state", () => {
      const result = buildCanonicalBeachUrl({
        slug: "some-beach",
        state: null,
        city: "Some City",
        name: "Some Beach",
      });

      expect(result).toBe("/spots/some-beach");
    });

    it("returns /spots/ URL for beach with missing city", () => {
      const result = buildCanonicalBeachUrl({
        slug: "some-beach",
        state: "CA",
        city: null,
        name: "Some Beach",
      });

      expect(result).toBe("/spots/some-beach");
    });

    it("returns null for beach with missing slug", () => {
      const result = buildCanonicalBeachUrl({
        slug: "",
        state: "CA",
        city: "Dana Point",
        name: "Some Beach",
      });

      expect(result).toBeNull();
    });
  });

  describe("handleSeoRedirect", () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    });

    afterEach(() => {
      if (fetchSpy) {
        fetchSpy.mockRestore();
      }
    });

    it("returns redirect URL for city mismatch", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              slug: "doheny-state-beach",
              state: "CA",
              city: "Dana Point",
              name: "Doheny State Beach",
            },
          ]),
      } as Response);

      const result = await handleSeoRedirect("/ca/orange-county/doheny-state-beach");

      expect(result).toEqual({
        redirect: true,
        url: "/ca/dana-point/doheny-state-beach",
      });
    });

    it("returns no redirect when URL is already canonical", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              slug: "doheny-state-beach",
              state: "CA",
              city: "Dana Point",
              name: "Doheny State Beach",
            },
          ]),
      } as Response);

      const result = await handleSeoRedirect("/ca/dana-point/doheny-state-beach");

      expect(result).toEqual({ redirect: false });
    });

    it("returns no redirect for non-beach URLs", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const result = await handleSeoRedirect("/api/health");

      expect(result).toEqual({ redirect: false });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns no redirect when beach not found", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const result = await handleSeoRedirect("/ca/orange-county/nonexistent-beach");

      expect(result).toEqual({ redirect: false });
    });

    it("redirects Mexico URLs to /spots/{slug}", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              slug: "alfonsos",
              state: "Baja California",
              city: "Rosarito",
              name: "Alfonsos",
            },
          ]),
      } as Response);

      const result = await handleSeoRedirect(
        "/mexico/baja-california/rosarito/alfonsos"
      );

      expect(result).toEqual({
        redirect: true,
        url: "/spots/alfonsos",
      });
    });

    it("redirects state-only URLs to /beaches/usa/{state}", async () => {
      const result = await handleSeoRedirect("/ca");

      expect(result).toEqual({
        redirect: true,
        url: "/beaches/usa/ca",
      });
      // Should not make a DB lookup for state-only URLs
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("redirects state-only URLs with different states", async () => {
      expect(await handleSeoRedirect("/nj")).toEqual({
        redirect: true,
        url: "/beaches/usa/nj",
      });
      expect(await handleSeoRedirect("/pr")).toEqual({
        redirect: true,
        url: "/beaches/usa/pr",
      });
    });

    it("returns no redirect on database error (fail open)", async () => {
      fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      const result = await handleSeoRedirect("/ca/orange-county/doheny-state-beach");

      expect(result).toEqual({ redirect: false });
    });
  });
});
