import {
  formatWaveHeight,
  formatWaveRange,
  getWaveSizeDescription,
  getWaveSizeLabel,
  WAVE_SIZE_LABELS,
} from "@/lib/utils/wave-formatters";

describe("wave-formatters", () => {
  describe("formatWaveHeight", () => {
    it("formats regular wave heights with one decimal place", () => {
      expect(formatWaveHeight(3.5)).toBe("3.5ft");
      expect(formatWaveHeight(5.0)).toBe("5.0ft");
      expect(formatWaveHeight(2.75)).toBe("2.8ft");
      expect(formatWaveHeight(10)).toBe("10.0ft");
    });

    it("returns 'Flat' for zero wave height", () => {
      expect(formatWaveHeight(0)).toBe("Flat");
    });

    it("handles small wave heights", () => {
      expect(formatWaveHeight(0.5)).toBe("0.5ft");
      expect(formatWaveHeight(1.2)).toBe("1.2ft");
    });

    it("handles large wave heights", () => {
      expect(formatWaveHeight(15)).toBe("15.0ft");
      expect(formatWaveHeight(25.5)).toBe("25.5ft");
    });

    it("handles negative wave heights gracefully", () => {
      // Negative values are treated as "Flat" (invalid input handling)
      expect(formatWaveHeight(-1)).toBe("Flat");
      expect(formatWaveHeight(-10)).toBe("Flat");
    });
  });

  describe("formatWaveRange", () => {
    describe("with decimal precision (default)", () => {
      it("formats ranges with one decimal place", () => {
        expect(formatWaveRange([3.2, 5.8])).toBe("3.2-5.8ft");
        expect(formatWaveRange([2.0, 4.5])).toBe("2.0-4.5ft");
      });

      it("formats single value ranges", () => {
        expect(formatWaveRange([4, 4])).toBe("4.0ft");
        expect(formatWaveRange([3.5, 3.5])).toBe("3.5ft");
      });

      it("handles zero ranges", () => {
        expect(formatWaveRange([0, 0])).toBe("0.0ft");
        expect(formatWaveRange([0, 3])).toBe("0.0-3.0ft");
      });
    });

    describe("with integer precision", () => {
      it("formats ranges as whole numbers", () => {
        expect(formatWaveRange([3.2, 5.8], "integer")).toBe("3-6ft");
        expect(formatWaveRange([2.0, 4.5], "integer")).toBe("2-5ft");
      });

      it("formats single value ranges", () => {
        expect(formatWaveRange([4, 4], "integer")).toBe("4ft");
        expect(formatWaveRange([3.5, 3.5], "integer")).toBe("4ft");
      });

      it("rounds correctly", () => {
        expect(formatWaveRange([2.4, 5.6], "integer")).toBe("2-6ft");
        expect(formatWaveRange([2.5, 5.5], "integer")).toBe("3-6ft");
      });
    });

    it("handles inverted ranges gracefully", () => {
      // Even with min > max, should format without crashing
      const result = formatWaveRange([5, 3]);
      expect(typeof result).toBe("string");
    });
  });

  describe("getWaveSizeDescription", () => {
    it("returns knee-high for heights < 2ft", () => {
      expect(getWaveSizeDescription(0)).toBe("knee-high");
      expect(getWaveSizeDescription(1)).toBe("knee-high");
      expect(getWaveSizeDescription(1.9)).toBe("knee-high");
    });

    it("returns waist-high for heights 2-3ft", () => {
      expect(getWaveSizeDescription(2)).toBe("waist-high");
      expect(getWaveSizeDescription(2.5)).toBe("waist-high");
      expect(getWaveSizeDescription(2.9)).toBe("waist-high");
    });

    it("returns chest-high for heights 3-5ft", () => {
      expect(getWaveSizeDescription(3)).toBe("chest-high");
      expect(getWaveSizeDescription(4)).toBe("chest-high");
      expect(getWaveSizeDescription(4.9)).toBe("chest-high");
    });

    it("returns head-high for heights 5-7ft", () => {
      expect(getWaveSizeDescription(5)).toBe("head-high");
      expect(getWaveSizeDescription(6)).toBe("head-high");
      expect(getWaveSizeDescription(6.9)).toBe("head-high");
    });

    it("returns overhead for heights 7-10ft", () => {
      expect(getWaveSizeDescription(7)).toBe("overhead");
      expect(getWaveSizeDescription(8)).toBe("overhead");
      expect(getWaveSizeDescription(9.9)).toBe("overhead");
    });

    it("returns double-overhead for heights >= 10ft", () => {
      expect(getWaveSizeDescription(10)).toBe("double-overhead");
      expect(getWaveSizeDescription(12)).toBe("double-overhead");
      expect(getWaveSizeDescription(20)).toBe("double-overhead");
    });

    it("handles boundary conditions correctly", () => {
      expect(getWaveSizeDescription(1.99)).toBe("knee-high");
      expect(getWaveSizeDescription(2)).toBe("waist-high");
      expect(getWaveSizeDescription(2.99)).toBe("waist-high");
      expect(getWaveSizeDescription(3)).toBe("chest-high");
      expect(getWaveSizeDescription(4.99)).toBe("chest-high");
      expect(getWaveSizeDescription(5)).toBe("head-high");
      expect(getWaveSizeDescription(6.99)).toBe("head-high");
      expect(getWaveSizeDescription(7)).toBe("overhead");
      expect(getWaveSizeDescription(9.99)).toBe("overhead");
      expect(getWaveSizeDescription(10)).toBe("double-overhead");
    });

    it("handles negative heights gracefully", () => {
      expect(getWaveSizeDescription(-1)).toBe("knee-high");
    });
  });

  describe("getWaveSizeLabel", () => {
    it("returns correct labels for each size", () => {
      expect(getWaveSizeLabel("knee-high")).toBe("Small Swell");
      expect(getWaveSizeLabel("waist-high")).toBe("Small Swell");
      expect(getWaveSizeLabel("chest-high")).toBe("Medium Swell");
      expect(getWaveSizeLabel("head-high")).toBe("Solid Swell");
      expect(getWaveSizeLabel("overhead")).toBe("Big Swell");
      expect(getWaveSizeLabel("double-overhead")).toBe("Epic Swell");
    });

    it("returns fallback for unknown sizes", () => {
      expect(getWaveSizeLabel("unknown")).toBe("Swell Incoming");
      expect(getWaveSizeLabel("")).toBe("Swell Incoming");
      expect(getWaveSizeLabel("massive")).toBe("Swell Incoming");
    });
  });

  describe("WAVE_SIZE_LABELS", () => {
    it("has correct mapping for all sizes", () => {
      expect(WAVE_SIZE_LABELS["knee-high"]).toBe("Small Swell");
      expect(WAVE_SIZE_LABELS["waist-high"]).toBe("Small Swell");
      expect(WAVE_SIZE_LABELS["chest-high"]).toBe("Medium Swell");
      expect(WAVE_SIZE_LABELS["head-high"]).toBe("Solid Swell");
      expect(WAVE_SIZE_LABELS["overhead"]).toBe("Big Swell");
      expect(WAVE_SIZE_LABELS["double-overhead"]).toBe("Epic Swell");
    });

    it("contains all wave size descriptions", () => {
      const sizes = [
        "knee-high",
        "waist-high",
        "chest-high",
        "head-high",
        "overhead",
        "double-overhead",
      ];

      for (const size of sizes) {
        expect(WAVE_SIZE_LABELS[size]).toBeDefined();
        expect(typeof WAVE_SIZE_LABELS[size]).toBe("string");
      }
    });
  });

  describe("integration: getWaveSizeDescription + getWaveSizeLabel", () => {
    it("produces valid labels for any wave height", () => {
      const heights = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20];

      for (const height of heights) {
        const sizeDescription = getWaveSizeDescription(height);
        const label = getWaveSizeLabel(sizeDescription);

        expect(label).not.toBe("Swell Incoming");
        expect(["Small Swell", "Medium Swell", "Solid Swell", "Big Swell", "Epic Swell"]).toContain(label);
      }
    });
  });
});
