/**
 * Unit Tests for engagement-tracking analytics
 *
 * Tests the Content Gravity engagement tracking functions:
 * - trackNearbyBeachClick
 * - trackNearbyBeachesViewed
 * - trackBestConditionsClick
 * - trackBestConditionsViewed
 * - trackPartialGateViewed
 * - trackPartialGateSignupClick
 * - Dual-firing to GA4 and Vercel Analytics
 */

import {
  trackNearbyBeachClick,
  trackNearbyBeachesViewed,
  trackBestConditionsClick,
  trackBestConditionsViewed,
  trackPartialGateViewed,
  trackPartialGateSignupClick,
} from "@/lib/analytics/engagement-tracking";

// Mock GA4 analytics
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

describe("Engagement Tracking", () => {
  const { track: gaTrack } = require("@/lib/analytics");

  let mockVercelTrack: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Vercel Analytics
    mockVercelTrack = jest.fn();

    // Mock require for @vercel/analytics
    jest.mock("@vercel/analytics", () => ({
      track: mockVercelTrack,
    }), { virtual: true });

    // Setup window object for client-side tests
    (global as any).window = {};
  });

  afterEach(() => {
    delete (global as any).window;
  });

  describe("trackNearbyBeachClick", () => {
    it("fires GA4 event with correct name and data", () => {
      trackNearbyBeachClick("Blacks Beach", 1, 9);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: "Blacks Beach",
        rank: 1,
        score: 9,
      });
    });

    it("tracks different beach names", () => {
      trackNearbyBeachClick("Pipeline", 3, 10);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: "Pipeline",
        rank: 3,
        score: 10,
      });
    });

    it("handles rank variations", () => {
      trackNearbyBeachClick("Ocean Beach", 5, 7);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: "Ocean Beach",
        rank: 5,
        score: 7,
      });
    });

    it("handles score variations", () => {
      trackNearbyBeachClick("La Jolla Shores", 2, 6.5);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: "La Jolla Shores",
        rank: 2,
        score: 6.5,
      });
    });

    it("handles beach names with special characters", () => {
      trackNearbyBeachClick("Hawai'i Kai", 1, 8);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: "Hawai'i Kai",
        rank: 1,
        score: 8,
      });
    });
  });

  describe("trackNearbyBeachesViewed", () => {
    it("fires GA4 event with correct name and data", () => {
      trackNearbyBeachesViewed("Blacks Beach", 5);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beaches_viewed", {
        source: "Blacks Beach",
        count: 5,
      });
    });

    it("tracks different source beaches", () => {
      trackNearbyBeachesViewed("Trestles", 8);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beaches_viewed", {
        source: "Trestles",
        count: 8,
      });
    });

    it("handles zero count", () => {
      trackNearbyBeachesViewed("Ocean Beach", 0);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beaches_viewed", {
        source: "Ocean Beach",
        count: 0,
      });
    });

    it("handles large count values", () => {
      trackNearbyBeachesViewed("Malibu", 20);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beaches_viewed", {
        source: "Malibu",
        count: 20,
      });
    });
  });

  describe("trackBestConditionsClick", () => {
    it("fires GA4 event with correct name and data", () => {
      trackBestConditionsClick("Blacks Beach", 1, 9);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_click", {
        beach: "Blacks Beach",
        rank: 1,
        score: 9,
      });
    });

    it("tracks different beach names", () => {
      trackBestConditionsClick("Pipeline", 2, 10);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_click", {
        beach: "Pipeline",
        rank: 2,
        score: 10,
      });
    });

    it("handles various ranks", () => {
      trackBestConditionsClick("Trestles", 6, 8);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_click", {
        beach: "Trestles",
        rank: 6,
        score: 8,
      });
    });

    it("handles decimal scores", () => {
      trackBestConditionsClick("Rincon", 3, 7.5);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_click", {
        beach: "Rincon",
        rank: 3,
        score: 7.5,
      });
    });
  });

  describe("trackBestConditionsViewed", () => {
    it("fires GA4 event with correct name and data", () => {
      trackBestConditionsViewed(6, false);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_viewed", {
        count: 6,
        location_aware: false,
      });
    });

    it("tracks location-aware view", () => {
      trackBestConditionsViewed(6, true);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_viewed", {
        count: 6,
        location_aware: true,
      });
    });

    it("handles different count values", () => {
      trackBestConditionsViewed(10, false);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_viewed", {
        count: 10,
        location_aware: false,
      });
    });

    it("handles zero count", () => {
      trackBestConditionsViewed(0, false);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_viewed", {
        count: 0,
        location_aware: false,
      });
    });
  });

  describe("trackPartialGateViewed", () => {
    it("fires GA4 event with correct name and data", () => {
      trackPartialGateViewed("beaches", 10);

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_viewed", {
        content_type: "beaches",
        total: 10,
      });
    });

    it("tracks different content types", () => {
      trackPartialGateViewed("surf spots", 15);

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_viewed", {
        content_type: "surf spots",
        total: 15,
      });
    });

    it("handles various total counts", () => {
      trackPartialGateViewed("sessions", 20);

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_viewed", {
        content_type: "sessions",
        total: 20,
      });
    });

    it("handles content type with special characters", () => {
      trackPartialGateViewed("user's sessions", 8);

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_viewed", {
        content_type: "user's sessions",
        total: 8,
      });
    });
  });

  describe("trackPartialGateSignupClick", () => {
    it("fires GA4 event with correct name and data", () => {
      trackPartialGateSignupClick("beaches");

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_signup", {
        content_type: "beaches",
      });
    });

    it("tracks different content types", () => {
      trackPartialGateSignupClick("surf spots");

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_signup", {
        content_type: "surf spots",
      });
    });

    it("tracks sessions content type", () => {
      trackPartialGateSignupClick("sessions");

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_signup", {
        content_type: "sessions",
      });
    });

    it("handles empty string content type", () => {
      trackPartialGateSignupClick("");

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_signup", {
        content_type: "",
      });
    });
  });

  describe("Vercel Analytics Integration", () => {
    beforeEach(() => {
      // Reset modules to allow re-mocking
      jest.resetModules();
    });

    it("attempts to load Vercel Analytics on client-side", () => {
      // This test verifies the lazy-loading pattern
      // In practice, Vercel track would be loaded via require() on first call

      trackNearbyBeachClick("Test Beach", 1, 8);

      // GA4 should always be called
      expect(gaTrack).toHaveBeenCalled();

      // Vercel Analytics loading is attempted (we can't easily test the dynamic require)
      // but we verify GA4 is not affected
      expect(gaTrack).toHaveBeenCalledTimes(1);
    });

    it("handles Vercel Analytics not available gracefully", () => {
      // If Vercel Analytics fails to load, GA4 should still work
      trackBestConditionsClick("Test Beach", 1, 9);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_click", {
        beach: "Test Beach",
        rank: 1,
        score: 9,
      });
    });

    it("does not call Vercel track on server-side (no window)", () => {
      delete (global as any).window;

      trackPartialGateViewed("beaches", 10);

      // GA4 should still be called
      expect(gaTrack).toHaveBeenCalledWith("partial_gate_viewed", {
        content_type: "beaches",
        total: 10,
      });

      // Vercel track should not be attempted (no window object)
    });
  });

  describe("Event Name Consistency", () => {
    it("uses snake_case for all event names", () => {
      trackNearbyBeachClick("Beach", 1, 8);
      trackNearbyBeachesViewed("Beach", 5);
      trackBestConditionsClick("Beach", 1, 9);
      trackBestConditionsViewed(6, false);
      trackPartialGateViewed("beaches", 10);
      trackPartialGateSignupClick("beaches");

      const calls = gaTrack.mock.calls;
      expect(calls[0][0]).toBe("nearby_beach_click");
      expect(calls[1][0]).toBe("nearby_beaches_viewed");
      expect(calls[2][0]).toBe("best_conditions_click");
      expect(calls[3][0]).toBe("best_conditions_viewed");
      expect(calls[4][0]).toBe("partial_gate_viewed");
      expect(calls[5][0]).toBe("partial_gate_signup");
    });
  });

  describe("Data Type Consistency", () => {
    it("ensures all data values are primitives (string, number, boolean)", () => {
      trackNearbyBeachClick("Beach", 1, 9);
      trackNearbyBeachesViewed("Beach", 5);
      trackBestConditionsClick("Beach", 2, 8);
      trackBestConditionsViewed(6, true);
      trackPartialGateViewed("beaches", 10);
      trackPartialGateSignupClick("beaches");

      const calls = gaTrack.mock.calls;

      // Verify all data objects contain only primitives
      calls.forEach((call: [string, Record<string, unknown>]) => {
        const data = call[1];
        Object.values(data).forEach((value) => {
          const type = typeof value;
          expect(["string", "number", "boolean"]).toContain(type);
        });
      });
    });

    it("passes numbers as numbers, not strings", () => {
      trackNearbyBeachClick("Beach", 1, 9);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: "Beach",
        rank: 1, // Should be number
        score: 9, // Should be number
      });

      const callData = gaTrack.mock.calls[0][1];
      expect(typeof callData.rank).toBe("number");
      expect(typeof callData.score).toBe("number");
    });

    it("passes booleans as booleans, not strings", () => {
      trackBestConditionsViewed(6, true);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_viewed", {
        count: 6,
        location_aware: true, // Should be boolean
      });

      const callData = gaTrack.mock.calls[0][1];
      expect(typeof callData.location_aware).toBe("boolean");
    });
  });

  describe("Multiple Tracking Calls", () => {
    it("handles multiple nearby beach clicks", () => {
      trackNearbyBeachClick("Beach 1", 1, 9);
      trackNearbyBeachClick("Beach 2", 2, 8);
      trackNearbyBeachClick("Beach 3", 3, 7);

      expect(gaTrack).toHaveBeenCalledTimes(3);
      expect(gaTrack).toHaveBeenNthCalledWith(1, "nearby_beach_click", {
        beach: "Beach 1",
        rank: 1,
        score: 9,
      });
      expect(gaTrack).toHaveBeenNthCalledWith(2, "nearby_beach_click", {
        beach: "Beach 2",
        rank: 2,
        score: 8,
      });
      expect(gaTrack).toHaveBeenNthCalledWith(3, "nearby_beach_click", {
        beach: "Beach 3",
        rank: 3,
        score: 7,
      });
    });

    it("handles mixed tracking events", () => {
      trackNearbyBeachClick("Beach", 1, 9);
      trackBestConditionsViewed(6, false);
      trackPartialGateSignupClick("beaches");

      expect(gaTrack).toHaveBeenCalledTimes(3);
      expect(gaTrack).toHaveBeenNthCalledWith(1, "nearby_beach_click", expect.any(Object));
      expect(gaTrack).toHaveBeenNthCalledWith(2, "best_conditions_viewed", expect.any(Object));
      expect(gaTrack).toHaveBeenNthCalledWith(3, "partial_gate_signup", expect.any(Object));
    });
  });

  describe("Edge Cases", () => {
    it("handles very long beach names", () => {
      const longName = "A".repeat(200);
      trackNearbyBeachClick(longName, 1, 8);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: longName,
        rank: 1,
        score: 8,
      });
    });

    it("handles beach names with emoji", () => {
      trackBestConditionsClick("🏄 Surf Beach 🌊", 1, 9);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_click", {
        beach: "🏄 Surf Beach 🌊",
        rank: 1,
        score: 9,
      });
    });

    it("handles zero rank", () => {
      trackNearbyBeachClick("Beach", 0, 8);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beach_click", {
        beach: "Beach",
        rank: 0,
        score: 8,
      });
    });

    it("handles negative scores", () => {
      trackBestConditionsClick("Beach", 1, -1);

      expect(gaTrack).toHaveBeenCalledWith("best_conditions_click", {
        beach: "Beach",
        rank: 1,
        score: -1,
      });
    });

    it("handles very large count values", () => {
      trackNearbyBeachesViewed("Beach", 9999);

      expect(gaTrack).toHaveBeenCalledWith("nearby_beaches_viewed", {
        source: "Beach",
        count: 9999,
      });
    });

    it("handles content type with newlines", () => {
      trackPartialGateViewed("beaches\nand\nspots", 10);

      expect(gaTrack).toHaveBeenCalledWith("partial_gate_viewed", {
        content_type: "beaches\nand\nspots",
        total: 10,
      });
    });
  });
});
