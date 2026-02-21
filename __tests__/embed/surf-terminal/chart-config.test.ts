import {
  PANE_RATIOS,
  DARK_THEME,
  LIGHT_THEME,
  TIME_RANGES,
  CONDITION_TIER_COLORS,
  MIN_CHART_HEIGHT,
  CHART_PADDING,
  type ChartTheme,
  type TimeRange,
} from "@/app/embed/surf-terminal/[slug]/chart-config";

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
const RGBA_REGEX = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/;

function isValidColor(value: string): boolean {
  return HEX_REGEX.test(value) || RGBA_REGEX.test(value);
}

describe("PANE_RATIOS", () => {
  it("wave + wind + swell === 1.0", () => {
    const total = PANE_RATIOS.wave + PANE_RATIOS.wind + PANE_RATIOS.swell;
    expect(total).toBeCloseTo(1.0, 10);
  });

  it("all ratios are positive", () => {
    expect(PANE_RATIOS.wave).toBeGreaterThan(0);
    expect(PANE_RATIOS.wind).toBeGreaterThan(0);
    expect(PANE_RATIOS.swell).toBeGreaterThan(0);
  });
});

describe("DARK_THEME", () => {
  const requiredKeys: (keyof ChartTheme)[] = [
    "background",
    "textColor",
    "gridColor",
    "crosshairColor",
    "waveColor",
    "waveGradientTop",
    "waveGradientBottom",
    "tideColor",
    "swellColor",
    "windOffshoreColor",
    "windOnshoreColor",
    "windCrossColor",
    "tooltipBg",
    "tooltipText",
    "watermarkColor",
  ];

  it("has all required keys", () => {
    for (const key of requiredKeys) {
      expect(DARK_THEME).toHaveProperty(key);
    }
  });

  it("all color values are valid hex or rgba strings", () => {
    for (const [key, value] of Object.entries(DARK_THEME)) {
      expect(isValidColor(value)).toBe(true);
    }
  });
});

describe("LIGHT_THEME", () => {
  it("has the same keys as DARK_THEME", () => {
    const darkKeys = Object.keys(DARK_THEME).sort();
    const lightKeys = Object.keys(LIGHT_THEME).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it("all color values are valid hex or rgba strings", () => {
    for (const [key, value] of Object.entries(LIGHT_THEME)) {
      expect(isValidColor(value)).toBe(true);
    }
  });
});

describe("TIME_RANGES", () => {
  it("has entries for 24H, 3D, 7D, 12D", () => {
    const labels = TIME_RANGES.map((r) => r.label);
    expect(labels).toContain("24H");
    expect(labels).toContain("3D");
    expect(labels).toContain("7D");
    expect(labels).toContain("12D");
  });

  it("has correct hours for each range", () => {
    const byLabel = Object.fromEntries(TIME_RANGES.map((r) => [r.label, r]));
    expect(byLabel["24H"].hours).toBe(24);
    expect(byLabel["3D"].hours).toBe(72);
    expect(byLabel["7D"].hours).toBe(168);
    expect(byLabel["12D"].hours).toBe(288);
  });

  it("default is 3D", () => {
    const defaultRange = TIME_RANGES.find((r) => r.isDefault);
    expect(defaultRange).toBeDefined();
    expect(defaultRange!.label).toBe("3D");
  });

  it("only one range is marked as default", () => {
    const defaults = TIME_RANGES.filter((r) => r.isDefault);
    expect(defaults).toHaveLength(1);
  });
});

describe("CONDITION_TIER_COLORS", () => {
  it("has entries for great, good, fair, marginal", () => {
    expect(CONDITION_TIER_COLORS).toHaveProperty("great");
    expect(CONDITION_TIER_COLORS).toHaveProperty("good");
    expect(CONDITION_TIER_COLORS).toHaveProperty("fair");
    expect(CONDITION_TIER_COLORS).toHaveProperty("marginal");
  });

  it("each tier has dark and light color values", () => {
    for (const [tier, colors] of Object.entries(CONDITION_TIER_COLORS)) {
      expect(colors).toHaveProperty("dark");
      expect(colors).toHaveProperty("light");
      expect(isValidColor(colors.dark)).toBe(true);
      expect(isValidColor(colors.light)).toBe(true);
    }
  });
});

describe("Chart dimension constants", () => {
  it("MIN_CHART_HEIGHT is a positive number", () => {
    expect(MIN_CHART_HEIGHT).toBeGreaterThan(0);
    expect(MIN_CHART_HEIGHT).toBe(400);
  });

  it("CHART_PADDING has top, right, bottom, left", () => {
    expect(CHART_PADDING).toHaveProperty("top");
    expect(CHART_PADDING).toHaveProperty("right");
    expect(CHART_PADDING).toHaveProperty("bottom");
    expect(CHART_PADDING).toHaveProperty("left");
  });
});
