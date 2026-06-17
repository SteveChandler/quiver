import {
  SWELL_MAP_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_STICKER_RADIUS,
  SWELL_LAYER_COLOR,
  SWELL_FIELD_PARTICLE_COLOR,
  SWELL_MAP_CTA_CLASS,
  buildLegendRampCss,
  degreesToCompass,
  compassToDegrees,
  type SwellLayerId,
} from "../swell-map-theme";

describe("swell-map-theme tokens", () => {
  it("uses Deep Twilight navy surfaces, never gray or pure black", () => {
    expect(SWELL_MAP_SURFACE.base).toBe("#252D6B");
    expect(SWELL_MAP_SURFACE.panel).toBe("#1E2558");
    expect(SWELL_MAP_SURFACE.panelDeep).toBe("#161A40");
    expect(SWELL_MAP_SURFACE.border).toBe("rgba(255,255,255,0.12)");
  });

  it("uses a hard offset sticker shadow with NO blur and asymmetric radius", () => {
    expect(SWELL_MAP_STICKER_SHADOW).toBe("2px 3px 0 0 rgba(0,0,0,0.35)");
    expect(SWELL_MAP_STICKER_RADIUS).toBe("12px 4px 14px 6px");
  });

  it("maps each layer to a sanctioned accent (no cyan/purple)", () => {
    expect(SWELL_LAYER_COLOR.s1).toBe("#F78E42");
    expect(SWELL_LAYER_COLOR.s2).toBe("#FDB84B");
    expect(SWELL_LAYER_COLOR.wind).toBe("#00D4AA");
    expect(SWELL_LAYER_COLOR.combined).toBe("#F78E42");
    const banned = ["#38bdf8", "#47e0d1", "#67e8f9", "#7dd3fc", "#7c3aed", "#9333ea", "#818cf8"];
    const values = Object.values(SWELL_LAYER_COLOR).map((c) => c.toLowerCase());
    for (const bad of banned) expect(values).not.toContain(bad);
  });

  it("maps each layer to a DARK particle color for the light-basemap flow field", () => {
    expect(SWELL_FIELD_PARTICLE_COLOR.s1).toBe("#B5450F");
    expect(SWELL_FIELD_PARTICLE_COLOR.s2).toBe("#A35E00");
    expect(SWELL_FIELD_PARTICLE_COLOR.wind).toBe("#0B6E63");
    expect(SWELL_FIELD_PARTICLE_COLOR.combined).toBe("#B5450F");
    // Particle colors must be darker than the bright UI-chip colors so normal-blended
    // dashes read on light-blue water (a higher hex sum means a lighter color).
    const hexSum = (hex: string): number =>
      parseInt(hex.slice(1, 3), 16) +
      parseInt(hex.slice(3, 5), 16) +
      parseInt(hex.slice(5, 7), 16);
    for (const id of ["s1", "s2", "wind", "combined"] as SwellLayerId[]) {
      expect(hexSum(SWELL_FIELD_PARTICLE_COLOR[id])).toBeLessThan(
        hexSum(SWELL_LAYER_COLOR[id])
      );
    }
    // Still no banned cyan/purple hues.
    const banned = ["#38bdf8", "#47e0d1", "#67e8f9", "#7dd3fc", "#7c3aed", "#9333ea", "#818cf8"];
    const values = Object.values(SWELL_FIELD_PARTICLE_COLOR).map((c) => c.toLowerCase());
    for (const bad of banned) expect(values).not.toContain(bad);
  });

  it("ships an AA-safe interactive CTA class (ocean-blue, not raw orange)", () => {
    expect(SWELL_MAP_CTA_CLASS).toBe("bg-ocean-blue text-white hover:bg-ocean-blue/90");
    expect(SWELL_MAP_CTA_CLASS).not.toContain("#f78e42");
    expect(SWELL_MAP_CTA_CLASS).not.toContain("bg-[#");
  });
});

describe("buildLegendRampCss", () => {
  it("builds a navy -> gold -> orange linear-gradient with no banned hues", () => {
    const css = buildLegendRampCss();
    expect(css.startsWith("linear-gradient(90deg,")).toBe(true);
    expect(css).toContain("#1E2558");
    expect(css).toContain("#FDB84B");
    expect(css).toContain("#F78E42");
    for (const bad of ["#38bdf8", "#67e8f9", "#818cf8", "#9333ea", "#e11d48", "#f43f5e"]) {
      expect(css.toLowerCase()).not.toContain(bad);
    }
  });
});

describe("degreesToCompass", () => {
  it("converts cardinal and intercardinal degrees to 16-point labels", () => {
    expect(degreesToCompass(0)).toBe("N");
    expect(degreesToCompass(90)).toBe("E");
    expect(degreesToCompass(180)).toBe("S");
    expect(degreesToCompass(270)).toBe("W");
    expect(degreesToCompass(315)).toBe("NW");
    expect(degreesToCompass(292.5)).toBe("WNW");
  });

  it("wraps past 360 and handles negatives", () => {
    expect(degreesToCompass(360)).toBe("N");
    expect(degreesToCompass(720)).toBe("N");
    expect(degreesToCompass(-90)).toBe("W");
  });

  it("returns an em dash for non-finite input", () => {
    expect(degreesToCompass(Number.NaN)).toBe("—");
    expect(degreesToCompass(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("compassToDegrees", () => {
  it("converts 16-point labels back to degrees (inverse of degreesToCompass)", () => {
    expect(compassToDegrees("N")).toBe(0);
    expect(compassToDegrees("E")).toBe(90);
    expect(compassToDegrees("S")).toBe(180);
    expect(compassToDegrees("W")).toBe(270);
    expect(compassToDegrees("SSW")).toBe(202.5);
    expect(compassToDegrees("WNW")).toBe(292.5);
    expect(compassToDegrees("ESE")).toBe(112.5);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(compassToDegrees("wnw")).toBe(292.5);
    expect(compassToDegrees("  ssw  ")).toBe(202.5);
    expect(compassToDegrees("n")).toBe(0);
  });

  it("returns null for unrecognized labels", () => {
    expect(compassToDegrees("zzz")).toBeNull();
    expect(compassToDegrees("")).toBeNull();
    expect(compassToDegrees("123")).toBeNull();
  });
});

// Type-level sanity: the union is exactly these four ids.
it("exposes the SwellLayerId union", () => {
  const ids: SwellLayerId[] = ["s1", "s2", "wind", "combined"];
  expect(ids).toHaveLength(4);
});
