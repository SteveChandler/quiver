/**
 * Wave Height Badge Formatting Tests
 *
 * Tests the formatWaveHeightRange function which converts a face Hs (and an
 * optional set of forecasts to derive an actual min/max from) into a
 * Surfline-style range string. Format: floor(low)-ceil(high) ft, no "sets"
 * suffix and no × 1.5 expansion.
 */

import {
  applyWindowWaveHeightBadgesForRecommendations,
  formatWaveHeightRange,
} from "@/lib/services/discovery/surf-discovery-orchestrator";

describe("formatWaveHeightRange", () => {
  it("returns null for flat conditions (< 0.5ft)", () => {
    expect(formatWaveHeightRange(0)).toBeNull();
    expect(formatWaveHeightRange(0.3)).toBeNull();
    expect(formatWaveHeightRange(0.49)).toBeNull();
  });

  it("formats very small waves as a floor/ceil bracket", () => {
    // floor(0.5)=0, ceil(0.5)=1 → "0-1ft"
    expect(formatWaveHeightRange(0.5)).toBe("0-1ft");
    expect(formatWaveHeightRange(0.7)).toBe("0-1ft");
  });

  it("formats typical wave heights as Surfline-style face brackets", () => {
    // floor(1.5)=1, ceil(1.5)=2 → "1-2ft"
    expect(formatWaveHeightRange(1.5)).toBe("1-2ft");
    // floor(2)=2, ceil(2)=2 → collapsed "2ft"
    expect(formatWaveHeightRange(2)).toBe("2ft");
    // floor(2.3)=2, ceil(2.3)=3 → "2-3ft"
    expect(formatWaveHeightRange(2.3)).toBe("2-3ft");
    // Whole-number 3 collapses to "3ft" (no × 1.5 expansion)
    expect(formatWaveHeightRange(3)).toBe("3ft");
  });

  it("formats larger waves as floor/ceil bracket", () => {
    // Whole-number collapses to single value
    expect(formatWaveHeightRange(5)).toBe("5ft");
    expect(formatWaveHeightRange(8)).toBe("8ft");
    // Fractional values keep the bracket
    expect(formatWaveHeightRange(5.4)).toBe("5-6ft");
  });

  it("updates non-top recommendations from their selected window forecasts", () => {
    const recs = [
      {
        beach: { id: "beach-1" },
        window: {
          start: new Date("2026-05-18T15:00:00.000Z"),
          end: new Date("2026-05-18T18:00:00.000Z"),
        },
        waveHeightBadge: "1-2ft",
      },
      {
        beach: { id: "beach-2" },
        window: {
          start: new Date("2026-05-18T15:00:00.000Z"),
          end: new Date("2026-05-18T18:00:00.000Z"),
        },
        waveHeightBadge: "1-2ft",
      },
    ] as any;

    const forecastsByBeachId = new Map<string, any[]>([
      [
        "beach-2",
        [
          {
            beach_id: "beach-2",
            forecast_at: "2026-05-18T15:00:00.000Z",
            wave_height: "2.4 ft",
          },
          {
            beach_id: "beach-2",
            forecast_at: "2026-05-18T18:00:00.000Z",
            wave_height: "4.1 ft",
          },
        ],
      ],
    ]);

    const updated = applyWindowWaveHeightBadgesForRecommendations(
      recs,
      forecastsByBeachId
    );

    expect(updated[0].waveHeightBadge).toBe("1-2ft");
    expect(updated[1].waveHeightBadge).toBe("2-5ft");
  });
});
