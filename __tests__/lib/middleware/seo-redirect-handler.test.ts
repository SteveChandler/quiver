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
} from "@/lib/middleware/seo-redirect-handler";

describe("SeoRedirectHandler", () => {
  describe("isOldBeachUrlPattern", () => {
    it("matches 3-segment state/city/beach URLs", () => {
      expect(isOldBeachUrlPattern("/ca/orange-county/huntington-pier")).toBe(
        true
      );
      expect(isOldBeachUrlPattern("/pr/rincn/indicators-rincon-pr")).toBe(true);
    });

    it("matches 4-segment mexico URLs", () => {
      expect(
        isOldBeachUrlPattern("/mexico/baja-california/rosarito/alfonsos")
      ).toBe(true);
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

    it("extracts slug from 4-segment URL", () => {
      expect(
        extractBeachSlugFromPath("/mexico/baja-california/rosarito/alfonsos")
      ).toBe("alfonsos");
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
});
