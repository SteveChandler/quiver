import {
  hashString,
  getDisplayName,
  cleanTitle,
} from "@/lib/utils/display-name-utils";

describe("hashString", () => {
  it("should return deterministic hash for same input", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("should return different hashes for different inputs", () => {
    expect(hashString("test1")).not.toBe(hashString("test2"));
  });

  it("should handle empty string", () => {
    expect(hashString("")).toBe(0);
  });

  it("should return non-negative values", () => {
    const testStrings = ["abc", "xyz", "123", "!@#", "emoji🌊"];
    testStrings.forEach((str) => {
      expect(hashString(str)).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("getDisplayName", () => {
  it("should return realistic name for 'Test User'", () => {
    const result = getDisplayName("Test User", "post-123");
    expect(result).not.toContain("Test");
    expect(result).toMatch(/\w+\s\w\./);
  });

  it("should return realistic name for 'Test User' variants", () => {
    const variants = [
      "Test User 1",
      "Board Rec Test User",
      "Local Test User",
      "test user",
      "TEST USER",
      "TestUser",
    ];

    variants.forEach((variant) => {
      const result = getDisplayName(variant, "seed-123");
      expect(result).not.toMatch(/test/i);
      expect(result).toMatch(/\w+\s\w\./);
    });
  });

  it("should be deterministic for same seed", () => {
    const name1 = getDisplayName("Test User", "seed1");
    const name2 = getDisplayName("Test User", "seed1");
    expect(name1).toBe(name2);
  });

  it("should produce different names for different seeds", () => {
    // Use seeds that are known to hash to different indices
    const results = new Set<string>();
    const seeds = [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
      "l",
      "m",
      "n",
      "o",
      "p",
    ];
    seeds.forEach((seed) => {
      results.add(getDisplayName("Test User", seed));
    });
    // With 10 names and 16 seeds, we should get multiple different names
    expect(results.size).toBeGreaterThan(1);
  });

  it("should preserve real user names", () => {
    expect(getDisplayName("John Doe", "seed")).toBe("John Doe");
    expect(getDisplayName("Sarah Smith", "seed")).toBe("Sarah Smith");
    expect(getDisplayName("Kai Wilson", "seed")).toBe("Kai Wilson");
  });

  it("should handle empty name gracefully", () => {
    expect(getDisplayName("", "seed")).toBe("Anonymous");
  });

  it("should handle empty seed gracefully", () => {
    expect(getDisplayName("John Doe", "")).toBe("John Doe");
    expect(getDisplayName("Test User", "")).toBe("Test User");
  });

  it("should not modify names that just contain 'test' or 'user' separately", () => {
    expect(getDisplayName("Contest Winner", "seed")).toBe("Contest Winner");
    expect(getDisplayName("Power User", "seed")).toBe("Power User");
  });
});

describe("cleanTitle", () => {
  it("should remove matching leading emoji", () => {
    expect(cleanTitle("🌊 Big waves", "🌊")).toBe("Big waves");
  });

  it("should preserve title when emoji doesn't match", () => {
    expect(cleanTitle("⚠️ Warning", "🌊")).toBe("⚠️ Warning");
  });

  it("should handle empty title", () => {
    expect(cleanTitle("", "🌊")).toBe("");
  });

  it("should handle empty emoji", () => {
    expect(cleanTitle("  Title with spaces", "")).toBe("Title with spaces");
  });

  it("should trim whitespace consistently", () => {
    expect(cleanTitle("  🌊  Big waves", "🌊")).toBe("Big waves");
    expect(cleanTitle("  Big waves", "🌊")).toBe("Big waves");
  });

  it("should only remove first matching emoji", () => {
    expect(cleanTitle("🌊🌊 Double emoji", "🌊")).toBe("🌊 Double emoji");
  });

  it("should handle multi-codepoint emojis", () => {
    // Surfer emoji with skin tone modifier
    expect(cleanTitle("🏄‍♂️ Surfing today", "🏄‍♂️")).toBe("Surfing today");
    // Parking emoji (multi-codepoint)
    expect(cleanTitle("🅿️ Good parking", "🅿️")).toBe("Good parking");
  });

  it("should handle titles without leading emoji", () => {
    expect(cleanTitle("No emoji here", "🌊")).toBe("No emoji here");
  });

  it("should handle emoji in middle of title", () => {
    expect(cleanTitle("Great 🌊 waves", "🌊")).toBe("Great 🌊 waves");
  });
});
