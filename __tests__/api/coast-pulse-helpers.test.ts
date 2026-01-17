/**
 * Tests for coast-pulse helper functions
 * @jest-environment node
 */

// Import will fail until formatIntelMessage is exported
// Using a placeholder for now - will be replaced once implementation is done
let formatIntelMessage: (post: {
  emoji_rating?: string | null;
  surf_conditions?: {
    wave_height?: number;
    wind_speed?: number;
    wind_direction?: string;
    crowd_level?: number;
  } | null;
  description?: string;
}) => string;

beforeAll(async () => {
  // Will be imported from route.ts after implementation
  const mod = await import("@/app/api/coast-pulse/route");
  formatIntelMessage = (mod as any).formatIntelMessage;
});

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
