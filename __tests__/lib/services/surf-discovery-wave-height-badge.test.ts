/**
 * Wave Height Badge Formatting Tests
 *
 * Tests the formatWaveHeightRange function which converts average wave heights
 * to range strings showing average to set waves (1.5x multiplier).
 */

// Import the function once it exists
import { formatWaveHeightRange } from "@/lib/services/discovery/surf-discovery-orchestrator";

describe("formatWaveHeightRange", () => {
  it("returns null for flat conditions (< 0.5ft)", () => {
    expect(formatWaveHeightRange(0)).toBeNull();
    expect(formatWaveHeightRange(0.3)).toBeNull();
    expect(formatWaveHeightRange(0.49)).toBeNull();
  });

  it("formats very small waves with half-foot precision", () => {
    // 0.5ft avg × 1.5 = 0.75ft sets
    expect(formatWaveHeightRange(0.5)).toBe("0.5-1ft sets");
    // 0.7ft avg × 1.5 = 1.05ft sets
    expect(formatWaveHeightRange(0.7)).toBe("0.5-1ft sets");
  });

  it("formats typical wave heights as ranges", () => {
    // 1.5ft avg × 1.5 = 2.25ft sets, rounds to 2.5
    expect(formatWaveHeightRange(1.5)).toBe("1.5-2.5ft sets");
    // 2ft avg × 1.5 = 3ft sets
    expect(formatWaveHeightRange(2)).toBe("2-3ft sets");
    // 2.3ft avg × 1.5 = 3.45ft sets
    expect(formatWaveHeightRange(2.3)).toBe("2-3ft sets");
    // 3ft avg × 1.5 = 4.5ft sets
    expect(formatWaveHeightRange(3)).toBe("3-5ft sets");
  });

  it("formats larger waves correctly", () => {
    // 5ft avg × 1.5 = 7.5ft sets
    expect(formatWaveHeightRange(5)).toBe("5-8ft sets");
    // 8ft avg × 1.5 = 12ft sets
    expect(formatWaveHeightRange(8)).toBe("8-12ft sets");
  });
});
