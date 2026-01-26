/**
 * Tests for coast-pulse helper functions
 * @jest-environment node
 */

import { formatIntelMessage, formatIntelSourceName, findNearestBeachName, formatForecastConditions } from "@/lib/utils/coast-pulse-formatter";

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

  it("passes through long descriptions (CSS handles truncation)", () => {
    const longDesc = "A".repeat(100);
    const result = formatIntelMessage({
      emoji_rating: null,
      surf_conditions: null,
      description: longDesc,
    });
    // CSS line-clamp handles overflow in UI, function passes through full text
    expect(result).toBe(longDesc);
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

describe("Coast Pulse Intel Integration", () => {
  it("formats a complete intel item correctly", () => {
    // Simulate full flow
    const mockPost = {
      emoji_rating: "fire",
      surf_conditions: {
        wave_height: 4,
        wind_speed: 8,
        wind_direction: "NW",
        crowd_level: 2,
      },
      description: "Epic morning session",
    };

    const message = formatIntelMessage(mockPost);
    expect(message).toBe("🔥 · 4ft · 8kt NW · light");

    const sourceName = formatIntelSourceName("Steve", "La Jolla Shores");
    expect(sourceName).toBe("Steve @ La Jolla Shores");
  });

  it("handles minimal intel post gracefully", () => {
    const mockPost = {
      emoji_rating: null,
      surf_conditions: null,
      description: "Just checked it out",
    };

    const message = formatIntelMessage(mockPost);
    expect(message).toBe("Just checked it out");

    const sourceName = formatIntelSourceName("Anonymous", null);
    expect(sourceName).toBe("Anonymous");
  });
});

describe("formatForecastConditions", () => {
  it("formats complete forecast with all data", () => {
    const forecast = {
      wave_height: "3.2 ft",
      wave_period: "12s",
      swell_1_direction: "SW",
      wind_speed: "8 mph",
      wind_direction: "NE", // 45° - offshore for SW-facing beach
      tide_status: "Rising",
    };
    // SW-facing beach: offshore wind comes from NE (45°)
    const result = formatForecastConditions(forecast, 45);
    expect(result).toBe("3ft, @ 12s, SW, light offshore, Rising");
  });

  it("shows onshore when wind is from ocean", () => {
    const forecast = {
      wave_height: "4 ft",
      wave_period: "10s",
      wave_direction: "W",
      wind_speed: "12 mph",
      wind_direction: "W", // 270° - coming from ocean (onshore for W-facing beach)
      tide_status: "Falling",
    };
    // W-facing beach: offshore wind comes from E (90°), W wind (270°) is onshore
    const result = formatForecastConditions(forecast, 90);
    expect(result).toBe("4ft, @ 10s, W, 12mph onshore, Falling");
  });

  it("shows calm when wind is light", () => {
    const forecast = {
      wave_height: "2.5 ft",
      wave_period: "8s",
      swell_1_direction: "NW",
      wind_speed: "3 mph",
      wind_direction: "S",
      tide_status: "High",
    };
    const result = formatForecastConditions(forecast, 270);
    expect(result).toBe("3ft, @ 8s, NW, calm, High");
  });

  it("handles string values with different formats", () => {
    const forecast = {
      wave_height: "3-4 ft",
      wave_period: "12",
      swell_1_direction: "SSW",
    };
    const result = formatForecastConditions(forecast);
    expect(result).toBe("3-4ft, @ 12s, SSW");
  });

  it("returns fallback when no wave height", () => {
    const forecast = {
      wind_speed: "10 mph",
      tide_status: "Rising",
    };
    const result = formatForecastConditions(forecast);
    expect(result).toBe("Forecast available");
  });

  it("shows wind speed and direction when no beach orientation", () => {
    const forecast = {
      wave_height: "4 ft",
      wave_period: "11s",
      wind_speed: "8 mph",
      wind_direction: "NW",
    };
    // No windOffshoreDeg provided
    const result = formatForecastConditions(forecast);
    expect(result).toBe("4ft, @ 11s, 8mph NW");
  });

  it("handles cardinal wind directions", () => {
    const forecast = {
      wave_height: "3 ft",
      wind_speed: "6 mph",
      wind_direction: "NE", // 45°
    };
    // Beach offshore direction is 45° (NE is offshore)
    const result = formatForecastConditions(forecast, 45);
    expect(result).toBe("3ft, light offshore");
  });

  it("handles cross-shore winds", () => {
    const forecast = {
      wave_height: "3 ft",
      wave_period: "10s",
      wind_speed: "12 mph",
      wind_direction: "S", // 180°
      tide_status: "Low",
    };
    // Beach offshore direction is 90° (E), so S wind is cross-shore
    const result = formatForecastConditions(forecast, 90);
    expect(result).toBe("3ft, @ 10s, 12mph cross, Low");
  });
});
