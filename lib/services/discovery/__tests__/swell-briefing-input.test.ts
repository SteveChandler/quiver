import { describe, expect, it } from "@jest/globals";

import {
  bodyScalePhrase,
  compassLabel,
  exposureFor,
  localDate,
  windKindFor,
} from "../swell-briefing-input";

const SOUTH_FACING = { id: "a", name: "A", aspect_deg: 225, wind_offshore_deg: null, wind_offshore_tol_deg: null };

describe("exposureFor", () => {
  it("separates San Diego's southwest-facing breaks from its west-facing ones", () => {
    // The real range of aspect_deg across San Diego beaches is 220-298.
    expect(exposureFor(220)).toBe("south_facing");
    expect(exposureFor(246)).toBe("south_facing");
    expect(exposureFor(250)).toBe("west_facing");
    expect(exposureFor(284)).toBe("west_facing");
    expect(exposureFor(298)).toBe("northwest_facing");
  });

  it("leaves a beach out rather than guessing when the aspect is unknown", () => {
    expect(exposureFor(null)).toBeNull();
    expect(exposureFor(Number.NaN)).toBeNull();
  });

  it("has no exposure for a coast facing away from the ocean here", () => {
    expect(exposureFor(90)).toBeNull();
  });
});

describe("windKindFor", () => {
  it("calls wind off the land offshore", () => {
    // A beach facing 225 is offshore from 45.
    expect(windKindFor(SOUTH_FACING, 45, 10)).toBe("offshore");
  });

  it("calls wind off the water onshore", () => {
    expect(windKindFor(SOUTH_FACING, 225, 15)).toBe("onshore");
  });

  it("calls the sideways case cross-shore", () => {
    expect(windKindFor(SOUTH_FACING, 135, 12)).toBe("cross");
  });

  it("treats a barely-moving wind as light and variable whatever its bearing", () => {
    expect(windKindFor(SOUTH_FACING, 225, 2)).toBe("light_variable");
  });

  it("says unknown rather than inventing a direction", () => {
    expect(windKindFor(SOUTH_FACING, null, 10)).toBe("unknown");
    const noAspect = { ...SOUTH_FACING, aspect_deg: null };
    expect(windKindFor(noAspect, 45, 10)).toBe("unknown");
  });
});

describe("bodyScalePhrase", () => {
  it("names one height when the range sits in a single band", () => {
    expect(bodyScalePhrase({ min: 2.1, max: 2.6 })).toBe("waist high");
  });

  it("spans two bands with an en dash, as the native copy does", () => {
    expect(bodyScalePhrase({ min: 2.5, max: 3.5 })).toBe("waist – chest");
  });

  it("does not append 'high' to a phrase that already reads as one", () => {
    expect(bodyScalePhrase({ min: 5.5, max: 6.5 })).toBe("head high");
  });

  it("is null when nothing was measured", () => {
    expect(bodyScalePhrase(null)).toBeNull();
  });
});

describe("compassLabel", () => {
  it("names the cardinal and intercardinal points", () => {
    expect(compassLabel(0)).toBe("N");
    expect(compassLabel(202)).toBe("SSW");
    expect(compassLabel(215)).toBe("SW");
    expect(compassLabel(270)).toBe("W");
  });

  it("wraps past a full turn rather than running off the end", () => {
    expect(compassLabel(360)).toBe("N");
    expect(compassLabel(-45)).toBe("NW");
  });
});

describe("localDate", () => {
  it("resolves the Pacific calendar day, not the UTC one", () => {
    // 06:00 UTC on the 26th is still 23:00 on the 25th in California (PDT).
    expect(localDate(new Date("2026-10-26T06:00:00Z"), "America/Los_Angeles")).toBe("2026-10-25");
    expect(localDate(new Date("2026-10-26T18:00:00Z"), "America/Los_Angeles")).toBe("2026-10-26");
  });
});
