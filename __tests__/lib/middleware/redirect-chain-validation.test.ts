/**
 * Redirect Chain Validation Tests
 *
 * Comprehensive tests to prevent redirect loops and chains.
 * These tests ensure that:
 * 1. No redirect chain exceeds 2 hops
 * 2. No URL appears twice in any chain (loop detection)
 * 3. Canonical URLs never redirect
 * 4. Related URLs don't create bidirectional redirects
 *
 * Created in response to Ahrefs crawl finding 826 redirect loops
 * caused by conflicting redirect rules between handleLegacyIntentRedirect
 * and handleIntentCityLegacyRedirect. Fix applied in commit b9ac3fd8.
 */

import {
  handleSeoRedirect,
  classifyUrlPattern,
  SeoRedirectResult,
} from "@/lib/middleware/seo-redirect-handler";

/**
 * Maximum allowed redirect hops before considering it excessive
 */
const MAX_REDIRECT_HOPS = 2;

/**
 * Follow a redirect chain and return the complete chain of URLs
 */
async function followRedirectChain(
  startUrl: string,
  maxHops: number = 10
): Promise<{
  chain: string[];
  finalUrl: string;
  hasLoop: boolean;
  loopAt?: number;
}> {
  const chain: string[] = [startUrl];
  let currentUrl = startUrl;
  let hasLoop = false;
  let loopAt: number | undefined;

  for (let i = 0; i < maxHops; i++) {
    const result = await handleSeoRedirect(currentUrl);

    if (!result.redirect || !result.url) {
      // No redirect, we've reached the final URL
      return { chain, finalUrl: currentUrl, hasLoop, loopAt };
    }

    const nextUrl = result.url;

    // Check for loop (URL already in chain)
    const existingIndex = chain.indexOf(nextUrl);
    if (existingIndex !== -1) {
      hasLoop = true;
      loopAt = existingIndex;
      chain.push(nextUrl); // Add it to show the loop
      return { chain, finalUrl: currentUrl, hasLoop, loopAt };
    }

    chain.push(nextUrl);
    currentUrl = nextUrl;
  }

  // Exceeded max hops
  return { chain, finalUrl: currentUrl, hasLoop: false };
}

describe("Redirect Chain Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  describe("Loop Detection - Intent URLs", () => {
    /**
     * Critical test case: This exact pattern caused 826 redirect loops
     * in the Ahrefs crawl. Previously:
     * - /water-temp/santa-cruz → /water-temp/ca/santa-cruz (2→3 segments)
     * - /water-temp/ca/santa-cruz → /water-temp/santa-cruz (3→2 segments)
     *
     * After fix (b9ac3fd8): 2-segment is canonical, 3-segment redirects to 2-segment only
     */
    it("does not create redirect loop for intent city URLs", async () => {
      const twoSegment = "/water-temp/santa-cruz";
      const threeSegment = "/water-temp/ca/santa-cruz";

      // 2-segment should NOT redirect (it's canonical)
      const twoSegmentResult = await handleSeoRedirect(twoSegment);
      expect(twoSegmentResult.redirect).toBe(false);

      // 3-segment SHOULD redirect to 2-segment
      const threeSegmentResult = await handleSeoRedirect(threeSegment);
      expect(threeSegmentResult.redirect).toBe(true);
      expect(threeSegmentResult.url).toBe(twoSegment);

      // Follow chain from 3-segment to ensure no loop
      const chain = await followRedirectChain(threeSegment);
      expect(chain.hasLoop).toBe(false);
      expect(chain.chain.length).toBeLessThanOrEqual(MAX_REDIRECT_HOPS + 1);
    });

    it("does not create redirect loop for intent beach URLs (4-segment)", async () => {
      const twoSegment = "/sunset/san-diego";
      const fourSegment = "/sunset/ca/san-diego/blacks";

      // 2-segment should NOT redirect
      const twoSegmentResult = await handleSeoRedirect(twoSegment);
      expect(twoSegmentResult.redirect).toBe(false);

      // 4-segment SHOULD redirect to 2-segment
      const fourSegmentResult = await handleSeoRedirect(fourSegment);
      expect(fourSegmentResult.redirect).toBe(true);
      expect(fourSegmentResult.url).toBe(twoSegment);

      // Follow chain to ensure no loop
      const chain = await followRedirectChain(fourSegment);
      expect(chain.hasLoop).toBe(false);
    });

    it("validates all intent slugs do not create loops", async () => {
      const intents = [
        "beginner",
        "longboard",
        "tide",
        "water-temp",
        "dawn-patrol",
        "sunset",
        "least-crowded",
      ];

      for (const intent of intents) {
        const twoSegment = `/${intent}/san-diego`;
        const threeSegment = `/${intent}/ca/san-diego`;
        const fourSegment = `/${intent}/ca/san-diego/blacks`;

        // 2-segment (canonical) should not redirect
        const result2 = await handleSeoRedirect(twoSegment);
        expect(result2.redirect).toBe(false);

        // 3-segment should redirect to 2-segment only
        const result3 = await handleSeoRedirect(threeSegment);
        expect(result3.redirect).toBe(true);
        expect(result3.url).toBe(twoSegment);

        // 4-segment should redirect to 2-segment only
        const result4 = await handleSeoRedirect(fourSegment);
        expect(result4.redirect).toBe(true);
        expect(result4.url).toBe(twoSegment);

        // Follow chains to verify no loops
        const chain3 = await followRedirectChain(threeSegment);
        expect(chain3.hasLoop).toBe(false);
        expect(chain3.chain.length).toBeLessThanOrEqual(MAX_REDIRECT_HOPS + 1);

        const chain4 = await followRedirectChain(fourSegment);
        expect(chain4.hasLoop).toBe(false);
        expect(chain4.chain.length).toBeLessThanOrEqual(MAX_REDIRECT_HOPS + 1);
      }
    });
  });

  describe("Loop Detection - State URLs", () => {
    it("state-only URLs redirect without loops", async () => {
      const states = ["ca", "nj", "hi", "fl", "or", "wa", "nc", "sc", "tx", "ny"];

      for (const state of states) {
        const stateUrl = `/${state}`;
        const chain = await followRedirectChain(stateUrl);

        expect(chain.hasLoop).toBe(false);
        expect(chain.chain.length).toBeLessThanOrEqual(MAX_REDIRECT_HOPS + 1);
        expect(chain.finalUrl).toBe(`/beaches/usa/${state}`);
      }
    });

    it("/beaches/usa/{state} does not redirect (canonical)", async () => {
      const canonicalUrl = "/beaches/usa/ca";
      const result = await handleSeoRedirect(canonicalUrl);
      expect(result.redirect).toBe(false);
    });
  });

  describe("Bidirectional Redirect Prevention", () => {
    /**
     * Test that both directions of related URLs don't both redirect
     * This is the root cause of redirect loops
     */
    const bidirectionalCases = [
      // Intent URLs
      ["/beginner/san-diego", "/beginner/ca/san-diego"],
      ["/tide/malibu", "/tide/ca/malibu"],
      ["/sunset/santa-cruz", "/sunset/ca/santa-cruz"],
      ["/water-temp/newport-beach", "/water-temp/ca/newport-beach"],
      // State URLs
      ["/beaches/usa/ca", "/ca"],
      ["/beaches/usa/nj", "/nj"],
    ];

    it.each(bidirectionalCases)(
      "at most one of %s and %s redirects",
      async (urlA, urlB) => {
        const resultA = await handleSeoRedirect(urlA);
        const resultB = await handleSeoRedirect(urlB);

        // At least one must NOT redirect (be canonical)
        const bothRedirect = resultA.redirect && resultB.redirect;
        if (bothRedirect) {
          // If both redirect, they must not redirect to each other
          expect(resultA.url).not.toBe(urlB);
          expect(resultB.url).not.toBe(urlA);
        }

        // More importantly, following the chain should not create a loop
        if (resultA.redirect) {
          const chainA = await followRedirectChain(urlA);
          expect(chainA.hasLoop).toBe(false);
        }
        if (resultB.redirect) {
          const chainB = await followRedirectChain(urlB);
          expect(chainB.hasLoop).toBe(false);
        }
      }
    );
  });

  describe("Canonical URL Stability", () => {
    /**
     * Canonical URLs should NEVER redirect
     * These are the "final destination" URLs that the redirect system
     * should resolve to, not from.
     */
    const canonicalUrls = [
      // 2-segment intent URLs (canonical format)
      "/beginner/san-diego",
      "/tide/malibu",
      "/sunset/santa-cruz",
      "/water-temp/huntington-beach",
      "/dawn-patrol/encinitas",
      "/least-crowded/cardiff-by-the-sea",
      "/longboard/ocean-beach",

      // State intent URLs
      "/beginner/ca",
      "/tide/hi",
      "/sunset/fl",

      // /beaches/usa/{state} format
      "/beaches/usa/ca",
      "/beaches/usa/nj",
      "/beaches/usa/hi",

      // Reserved paths should never redirect
      "/api/test",
      "/auth/sign-in",
      "/admin/dashboard",
      "/app/home",
      "/beaches/usa",
    ];

    it.each(canonicalUrls)(
      "canonical URL %s does not redirect",
      async (url) => {
        const result = await handleSeoRedirect(url);
        expect(result.redirect).toBe(false);
      }
    );
  });

  describe("Maximum Hop Count", () => {
    /**
     * Even if there's no loop, redirect chains should not exceed MAX_REDIRECT_HOPS
     * This prevents excessive redirect chains that hurt SEO
     */
    const redirectingUrls = [
      "/ca",
      "/sunset/ca/san-diego",
      "/beginner/nj/asbury-park",
      "/water-temp/hi/honolulu",
      "/tide/fl/miami/south-beach",
    ];

    it.each(redirectingUrls)(
      "redirect chain from %s has at most %d hops",
      async (url) => {
        const chain = await followRedirectChain(url);

        // Chain includes the starting URL, so chain.length - 1 = number of hops
        const hopCount = chain.chain.length - 1;
        expect(hopCount).toBeLessThanOrEqual(MAX_REDIRECT_HOPS);
      }
    );
  });

  describe("URL Pattern Classification Consistency", () => {
    /**
     * Verify that URL pattern classification is consistent and deterministic
     */
    it("classifies intent URLs consistently", () => {
      // 2-segment intent URLs should be "none" (canonical, handled by app routes)
      expect(classifyUrlPattern("/beginner/san-diego")).toBe("none");
      expect(classifyUrlPattern("/tide/malibu")).toBe("none");

      // 3-segment intent URLs should be "intent-city-legacy"
      expect(classifyUrlPattern("/beginner/ca/san-diego")).toBe(
        "intent-city-legacy"
      );
      expect(classifyUrlPattern("/tide/ca/malibu")).toBe("intent-city-legacy");

      // 4-segment intent URLs should be "intent-beach-legacy"
      expect(classifyUrlPattern("/beginner/ca/san-diego/blacks")).toBe(
        "intent-beach-legacy"
      );
    });

    it("classifies state URLs consistently", () => {
      // 1-segment state URLs should be "state-only"
      expect(classifyUrlPattern("/ca")).toBe("state-only");
      expect(classifyUrlPattern("/nj")).toBe("state-only");

      // Invalid states should be "none"
      expect(classifyUrlPattern("/xyz")).toBe("none");
      expect(classifyUrlPattern("/california")).toBe("none");
    });
  });

  describe("Real-world URL Scenarios", () => {
    /**
     * Test URLs that were actually causing problems in production
     * from the Ahrefs crawl report
     */
    const problematicUrls = [
      "/water-temp/ca/santa-cruz",
      "/water-temp/ca/san-diego",
      "/beginner/ca/malibu",
      "/tide/ca/huntington-beach",
      "/sunset/ca/encinitas",
      "/least-crowded/ca/cardiff-by-the-sea",
      "/dawn-patrol/ca/newport-beach",
      "/longboard/ca/ocean-beach",
    ];

    it.each(problematicUrls)(
      "previously problematic URL %s now resolves without loop",
      async (url) => {
        const chain = await followRedirectChain(url);

        expect(chain.hasLoop).toBe(false);
        expect(chain.chain.length).toBeLessThanOrEqual(MAX_REDIRECT_HOPS + 1);

        // Should redirect to 2-segment format
        const segments = url.split("/").filter(Boolean);
        const intent = segments[0];
        const city = segments[2];
        expect(chain.finalUrl).toBe(`/${intent}/${city}`);
      }
    );

    it("handles different state codes without loops", async () => {
      const stateCases = [
        ["/tide/nj/asbury-park", "/tide/asbury-park"],
        ["/beginner/hi/honolulu", "/beginner/honolulu"],
        ["/sunset/fl/miami", "/sunset/miami"],
        ["/water-temp/nc/outer-banks", "/water-temp/outer-banks"],
        ["/dawn-patrol/or/portland", "/dawn-patrol/portland"],
      ];

      for (const [legacyUrl, expectedCanonical] of stateCases) {
        const chain = await followRedirectChain(legacyUrl);

        expect(chain.hasLoop).toBe(false);
        expect(chain.finalUrl).toBe(expectedCanonical);
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles trailing slashes without creating loops", async () => {
      const urlsWithTrailing = [
        "/sunset/ca/san-diego/",
        "/ca/",
        "/beginner/ca/malibu/blacks/",
      ];

      for (const url of urlsWithTrailing) {
        const chain = await followRedirectChain(url);
        expect(chain.hasLoop).toBe(false);
      }
    });

    it("handles mixed case URLs without creating loops", async () => {
      const mixedCaseUrls = [
        "/SUNSET/CA/SAN-DIEGO",
        "/Sunset/Ca/San-Diego",
        "/CA",
        "/BEGINNER/CA/MALIBU",
      ];

      for (const url of mixedCaseUrls) {
        const chain = await followRedirectChain(url);
        expect(chain.hasLoop).toBe(false);
        expect(chain.chain.length).toBeLessThanOrEqual(MAX_REDIRECT_HOPS + 1);
      }
    });

    it("handles empty and root paths correctly", async () => {
      const result1 = await handleSeoRedirect("");
      expect(result1.redirect).toBe(false);

      const result2 = await handleSeoRedirect("/");
      expect(result2.redirect).toBe(false);
    });
  });
});

describe("Redirect Rule Inventory", () => {
  /**
   * This section documents and tests all active redirect rules.
   * Use this as a reference when adding new redirects to ensure
   * no conflicts are introduced.
   */

  describe("Active Redirect Rules", () => {
    /**
     * Rule 1: State-only URLs
     * Pattern: /{state}
     * Target: /beaches/usa/{state}
     * Example: /ca → /beaches/usa/ca
     */
    it("Rule 1: State-only redirects to /beaches/usa/{state}", async () => {
      const result = await handleSeoRedirect("/ca");
      expect(result).toEqual({
        redirect: true,
        url: "/beaches/usa/ca",
      });
    });

    /**
     * Rule 2: Intent city legacy (3-segment)
     * Pattern: /{intent}/{state}/{city}
     * Target: /{intent}/{city}
     * Example: /sunset/ca/san-diego → /sunset/san-diego
     */
    it("Rule 2: Intent city legacy (3-segment) redirects to 2-segment", async () => {
      const result = await handleSeoRedirect("/sunset/ca/san-diego");
      expect(result).toEqual({
        redirect: true,
        url: "/sunset/san-diego",
      });
    });

    /**
     * Rule 3: Intent beach legacy (4-segment)
     * Pattern: /{intent}/{state}/{city}/{beach}
     * Target: /{intent}/{city}
     * Example: /sunset/ca/san-diego/blacks → /sunset/san-diego
     */
    it("Rule 3: Intent beach legacy (4-segment) redirects to city intent", async () => {
      const result = await handleSeoRedirect("/sunset/ca/san-diego/blacks");
      expect(result).toEqual({
        redirect: true,
        url: "/sunset/san-diego",
      });
    });

    /**
     * Deleted Rule (REMOVED in b9ac3fd8):
     * Pattern: /{intent}/{city}
     * Target: /{intent}/{state}/{city}
     *
     * This rule was removed because it conflicted with Rule 2,
     * creating a bidirectional redirect loop.
     */
    it("Deleted rule: 2-segment intent URLs do NOT redirect to 3-segment", async () => {
      const result = await handleSeoRedirect("/sunset/san-diego");
      // This MUST return { redirect: false }
      // If it returns { redirect: true, url: "/sunset/ca/san-diego" },
      // we have reintroduced the bug
      expect(result.redirect).toBe(false);
    });
  });
});
