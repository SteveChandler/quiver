import {
  formatClusterWaveRange,
  getClusterColor,
} from "@/lib/utils/cluster-formatter";

describe("formatClusterWaveRange", () => {
  it("should return range for different wave heights", () => {
    const waveHeights = [1.5, 2.5, 3.2];
    expect(formatClusterWaveRange(waveHeights)).toBe("1-4ft");
  });

  it("should return single value when all same height", () => {
    const waveHeights = [2.5, 2.8, 2.2];
    expect(formatClusterWaveRange(waveHeights)).toBe("2-3ft");
  });

  it("should handle empty array", () => {
    expect(formatClusterWaveRange([])).toBe("—");
  });

  it("should handle undefined values in array", () => {
    const waveHeights = [1.5, undefined, 3.2, null] as (number | undefined | null)[];
    expect(formatClusterWaveRange(waveHeights)).toBe("1-4ft");
  });

  it("should return 0-1ft for very small waves", () => {
    const waveHeights = [0.3, 0.5, 0.8];
    expect(formatClusterWaveRange(waveHeights)).toBe("0-1ft");
  });

  it("should handle large wave range", () => {
    const waveHeights = [1.0, 5.5, 8.0];
    expect(formatClusterWaveRange(waveHeights)).toBe("1-8ft");
  });
});

describe("getClusterColor", () => {
  it("should return orange gradient for normal clusters", () => {
    expect(getClusterColor(false)).toBe("linear-gradient(to right, #fbbf24, #f59e0b)");
  });

  it("should return blue gradient for favorite clusters", () => {
    expect(getClusterColor(true)).toBe("linear-gradient(to right, #3b82f6, #2563eb)");
  });
});
