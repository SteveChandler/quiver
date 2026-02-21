// __tests__/lib/constants/intel-vote-confidence.test.ts
//
// Tests for getVoteConfidenceBadge() from lib/constants/intel.ts
// Covers all branching conditions in the 3-way voting confidence logic.

import { getVoteConfidenceBadge } from "@/lib/constants/intel";

describe("getVoteConfidenceBadge", () => {
  // ---------------------------------------------------------------------------
  // Confirmed by surfers
  // ---------------------------------------------------------------------------

  describe("Confirmed by surfers", () => {
    test("returns 'Confirmed by surfers' when confirmed_count is exactly 3", () => {
      const result = getVoteConfidenceBadge({ confirmed_count: 3 });
      expect(result).toEqual({
        label: "Confirmed by surfers",
        color: "text-green-600",
      });
    });

    test("returns 'Confirmed by surfers' when confirmed_count exceeds 3", () => {
      const result = getVoteConfidenceBadge({ confirmed_count: 10 });
      expect(result).toEqual({
        label: "Confirmed by surfers",
        color: "text-green-600",
      });
    });

    test("confirmed >= 3 takes priority over off >= 3", () => {
      // confirmed=3 triggers first branch before off branch is evaluated
      const result = getVoteConfidenceBadge({
        confirmed_count: 3,
        off_count: 5,
        helpful_count: 0,
      });
      expect(result.label).toBe("Confirmed by surfers");
    });
  });

  // ---------------------------------------------------------------------------
  // Community disagrees
  // ---------------------------------------------------------------------------

  describe("Community disagrees", () => {
    test("returns 'Community disagrees' when off=3 and off > helpful + confirmed", () => {
      const result = getVoteConfidenceBadge({
        off_count: 3,
        helpful_count: 1,
        confirmed_count: 1,
      });
      expect(result).toEqual({
        label: "Community disagrees",
        color: "text-red-500",
      });
    });

    test("returns 'Community disagrees' when off is large majority", () => {
      const result = getVoteConfidenceBadge({
        off_count: 8,
        helpful_count: 2,
        confirmed_count: 1,
      });
      expect(result).toEqual({
        label: "Community disagrees",
        color: "text-red-500",
      });
    });

    test("does NOT return 'Community disagrees' when off=3 but off equals helpful+confirmed", () => {
      // off=3, helpful+confirmed=3 — off is not strictly greater
      const result = getVoteConfidenceBadge({
        off_count: 3,
        helpful_count: 2,
        confirmed_count: 1,
      });
      expect(result.label).not.toBe("Community disagrees");
    });

    test("does NOT return 'Community disagrees' when off=3 but off < helpful+confirmed", () => {
      const result = getVoteConfidenceBadge({
        off_count: 3,
        helpful_count: 3,
        confirmed_count: 1,
      });
      expect(result.label).not.toBe("Community disagrees");
    });

    test("does NOT return 'Community disagrees' when off < 3 even if majority", () => {
      const result = getVoteConfidenceBadge({
        off_count: 2,
        helpful_count: 0,
        confirmed_count: 0,
      });
      expect(result.label).not.toBe("Community disagrees");
    });
  });

  // ---------------------------------------------------------------------------
  // Trending
  // ---------------------------------------------------------------------------

  describe("Trending", () => {
    test("returns 'Trending' when helpful_count is exactly 2", () => {
      const result = getVoteConfidenceBadge({ helpful_count: 2 });
      expect(result).toEqual({ label: "Trending", color: "text-blue-500" });
    });

    test("returns 'Trending' when helpful_count exceeds 2", () => {
      const result = getVoteConfidenceBadge({ helpful_count: 5 });
      expect(result).toEqual({ label: "Trending", color: "text-blue-500" });
    });

    test("returns 'Trending' when confirmed_count is exactly 1", () => {
      const result = getVoteConfidenceBadge({ confirmed_count: 1 });
      expect(result).toEqual({ label: "Trending", color: "text-blue-500" });
    });

    test("returns 'Trending' when confirmed_count is 2 (below confirmed-by-surfers threshold)", () => {
      const result = getVoteConfidenceBadge({ confirmed_count: 2 });
      expect(result).toEqual({ label: "Trending", color: "text-blue-500" });
    });

    test("returns 'Trending' when both helpful >= 2 and confirmed >= 1", () => {
      const result = getVoteConfidenceBadge({
        helpful_count: 3,
        confirmed_count: 2,
      });
      expect(result).toEqual({ label: "Trending", color: "text-blue-500" });
    });
  });

  // ---------------------------------------------------------------------------
  // Needs votes
  // ---------------------------------------------------------------------------

  describe("Needs votes", () => {
    test("returns 'Needs votes' when all counts are zero", () => {
      const result = getVoteConfidenceBadge({
        helpful_count: 0,
        off_count: 0,
        confirmed_count: 0,
      });
      expect(result).toEqual({ label: "Needs votes", color: "text-gray-400" });
    });

    test("returns 'Needs votes' when no counts are provided (empty object)", () => {
      const result = getVoteConfidenceBadge({});
      expect(result).toEqual({ label: "Needs votes", color: "text-gray-400" });
    });

    test("returns 'Needs votes' for low activity: helpful=1, off=0, confirmed=0", () => {
      // helpful=1 is below the >= 2 threshold for Trending
      const result = getVoteConfidenceBadge({
        helpful_count: 1,
        off_count: 0,
        confirmed_count: 0,
      });
      expect(result).toEqual({ label: "Needs votes", color: "text-gray-400" });
    });

    test("returns 'Needs votes' for low activity: helpful=0, off=1, confirmed=0", () => {
      const result = getVoteConfidenceBadge({
        helpful_count: 0,
        off_count: 1,
        confirmed_count: 0,
      });
      expect(result).toEqual({ label: "Needs votes", color: "text-gray-400" });
    });
  });

  // ---------------------------------------------------------------------------
  // Undefined / missing fields (default to 0)
  // ---------------------------------------------------------------------------

  describe("Handles undefined counts", () => {
    test("treats undefined helpful_count as 0", () => {
      const result = getVoteConfidenceBadge({
        off_count: 0,
        confirmed_count: 0,
      });
      expect(result).toEqual({ label: "Needs votes", color: "text-gray-400" });
    });

    test("treats undefined off_count as 0", () => {
      const result = getVoteConfidenceBadge({
        helpful_count: 0,
        confirmed_count: 0,
      });
      expect(result).toEqual({ label: "Needs votes", color: "text-gray-400" });
    });

    test("treats undefined confirmed_count as 0", () => {
      const result = getVoteConfidenceBadge({
        helpful_count: 0,
        off_count: 0,
      });
      expect(result).toEqual({ label: "Needs votes", color: "text-gray-400" });
    });

    test("helpful_count=2 with all others undefined returns Trending", () => {
      const result = getVoteConfidenceBadge({ helpful_count: 2 });
      expect(result).toEqual({ label: "Trending", color: "text-blue-500" });
    });

    test("confirmed_count=3 with all others undefined returns Confirmed by surfers", () => {
      const result = getVoteConfidenceBadge({ confirmed_count: 3 });
      expect(result).toEqual({
        label: "Confirmed by surfers",
        color: "text-green-600",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Return shape
  // ---------------------------------------------------------------------------

  describe("Return shape", () => {
    test("always returns an object with label and color strings", () => {
      const inputs = [
        {},
        { helpful_count: 1 },
        { helpful_count: 2 },
        { confirmed_count: 1 },
        { confirmed_count: 3 },
        { off_count: 3, helpful_count: 0, confirmed_count: 0 },
        { off_count: 4, helpful_count: 1, confirmed_count: 0 },
      ];

      for (const input of inputs) {
        const result = getVoteConfidenceBadge(input);
        expect(typeof result.label).toBe("string");
        expect(typeof result.color).toBe("string");
        expect(result.label.length).toBeGreaterThan(0);
        expect(result.color.length).toBeGreaterThan(0);
      }
    });
  });
});
