/**
 * Wave Height Badge Formatting Tests
 */

// Import the function once it exists
import { formatWaveHeightRange } from "@/lib/services/discovery/surf-discovery-orchestrator";

describe("formatWaveHeightRange", () => {
  it("returns null for flat conditions (< 0.5ft)", () => {
    expect(formatWaveHeightRange(0)).toBeNull();
    expect(formatWaveHeightRange(0.3)).toBeNull();
    expect(formatWaveHeightRange(0.49)).toBeNull();
  });

  it("formats very small waves correctly", () => {
    expect(formatWaveHeightRange(0.5)).toBe("0.5-1.5ft");
    expect(formatWaveHeightRange(0.7)).toBe("0.5-1.5ft");
  });

  it("formats typical wave heights as ranges", () => {
    expect(formatWaveHeightRange(1.5)).toBe("1.5-2.5ft");
    expect(formatWaveHeightRange(2)).toBe("2-3ft");
    expect(formatWaveHeightRange(2.3)).toBe("2-3ft");
    expect(formatWaveHeightRange(3)).toBe("3-4ft");
  });

  it("formats larger waves correctly", () => {
    expect(formatWaveHeightRange(5)).toBe("5-6ft");
    expect(formatWaveHeightRange(8)).toBe("8-9ft");
  });
});
