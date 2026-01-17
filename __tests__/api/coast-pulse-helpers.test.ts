/**
 * Tests for coast-pulse helper functions
 * @jest-environment node
 */

import { formatIntelMessage, formatIntelSourceName, findNearestBeachName } from "@/app/api/coast-pulse/route";

describe("formatIntelMessage", () => {
  it("formats full structured data with emoji", () => {
    const result = formatIntelMessage({
      emoji_rating: "fire",
      surf_conditions: {
        wave_height: 4,
        wind_speed: 8,
        wind_direction: "NW",
        crowd_level: 2,
      },
      description: "Great session",
    });
    expect(result).toBe("🔥 · 4ft · 8kt NW · light");
  });

  it("formats partial data (no wind/crowd)", () => {
    const result = formatIntelMessage({
      emoji_rating: "shaka",
      surf_conditions: { wave_height: 3 },
      description: "Fun waves",
    });
    expect(result).toBe("🤙 · 3ft");
  });

  it("falls back to description when no structured data", () => {
    const result = formatIntelMessage({
      emoji_rating: "fire",
      surf_conditions: null,
      description: "Glassy and firing!",
    });
    expect(result).toBe("🔥 Glassy and firing!");
  });

  it("returns just description when no emoji", () => {
    const result = formatIntelMessage({
      emoji_rating: null,
      surf_conditions: null,
      description: "Choppy but fun",
    });
    expect(result).toBe("Choppy but fun");
  });

  it("handles all emoji types", () => {
    expect(
      formatIntelMessage({ emoji_rating: "fire", description: "x" })
    ).toContain("🔥");
    expect(
      formatIntelMessage({ emoji_rating: "shaka", description: "x" })
    ).toContain("🤙");
    expect(
      formatIntelMessage({ emoji_rating: "meh", description: "x" })
    ).toContain("😐");
    expect(
      formatIntelMessage({ emoji_rating: "thumbsdown", description: "x" })
    ).toContain("👎");
  });

  it("handles all crowd levels", () => {
    const levels = [
      { level: 1, text: "empty" },
      { level: 2, text: "light" },
      { level: 3, text: "moderate" },
      { level: 4, text: "busy" },
      { level: 5, text: "packed" },
    ];
    for (const { level, text } of levels) {
      const result = formatIntelMessage({
        surf_conditions: { crowd_level: level },
        description: "x",
      });
      expect(result).toContain(text);
    }
  });

  it("truncates long descriptions", () => {
    const longDesc = "A".repeat(100);
    const result = formatIntelMessage({
      emoji_rating: null,
      surf_conditions: null,
      description: longDesc,
    });
    expect(result.length).toBeLessThanOrEqual(80);
  });
});

describe("formatIntelSourceName", () => {
  it("formats username with beach name", () => {
    const result = formatIntelSourceName("Steve", "La Jolla Shores");
    expect(result).toBe("Steve @ La Jolla Shores");
  });

  it("returns just username when no beach", () => {
    const result = formatIntelSourceName("Local Surfer", null);
    expect(result).toBe("Local Surfer");
  });

  it("truncates long beach names", () => {
    const result = formatIntelSourceName("Steve", "San Diego - Mission Beach Pier North");
    expect(result.length).toBeLessThanOrEqual(35);
    expect(result).toContain("Steve @");
    expect(result).toContain("...");
  });

  it("truncates username when no beach and too long", () => {
    const result = formatIntelSourceName("VeryLongUsernameHere123456", null, 20);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("handles edge case of very short max length", () => {
    const result = formatIntelSourceName("Steve", "Beach", 10);
    // Should handle gracefully without crashing
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

describe("findNearestBeachName", () => {
  const beaches = [
    { name: "La Jolla Shores", lat: 32.8567, lon: -117.2575 },
    { name: "Pacific Beach", lat: 32.7946, lon: -117.2557 },
    { name: "Ocean Beach", lat: 32.7497, lon: -117.2507 },
  ];

  it("finds nearest beach within distance", () => {
    // Point very close to La Jolla Shores
    const result = findNearestBeachName(32.857, -117.258, beaches);
    expect(result).toBe("La Jolla Shores");
  });

  it("returns null when no beaches within max distance", () => {
    // Point far from all beaches (Los Angeles)
    const result = findNearestBeachName(34.0522, -118.2437, beaches);
    expect(result).toBeNull();
  });

  it("returns null for empty beaches array", () => {
    const result = findNearestBeachName(32.857, -117.258, []);
    expect(result).toBeNull();
  });

  it("respects custom max distance", () => {
    // Point ~7km from La Jolla Shores, use 5km max
    const result = findNearestBeachName(32.79, -117.26, beaches, 5);
    // Should find Pacific Beach (closer) but not La Jolla
    expect(result).toBe("Pacific Beach");
  });

  it("returns closest beach when multiple within range", () => {
    // Point between Pacific Beach and Ocean Beach
    const result = findNearestBeachName(32.77, -117.253, beaches);
    expect(result).toBe("Ocean Beach"); // Closest
  });
});
