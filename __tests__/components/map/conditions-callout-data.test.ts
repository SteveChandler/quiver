import {
  resolveCalloutComponents,
  formatTempLabel,
  type CalloutComponent,
} from "@/components/map/conditions-callout-data";
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";

const EMPTY: SwellPartition = {
  s1Dir: null, swellDirOm: null, s1PeriodS: null, s1HeightFt: null,
  s2Dir: null, s2PeriodS: null, s2HeightFt: null, windDir: null, windMph: null,
};

describe("resolveCalloutComponents", () => {
  it("returns s1, s2, wind in order when all are real", () => {
    const parts: SwellPartition = {
      ...EMPTY,
      s1Dir: 290, s1PeriodS: 8, s1HeightFt: 2.6,
      s2Dir: 200, s2PeriodS: 13, s2HeightFt: 1.6,
      windDir: 230, windMph: 8,
    };
    const out = resolveCalloutComponents(parts);
    expect(out.map((c) => c.kind)).toEqual(["s1", "s2", "wind"]);
    expect(out[0]).toMatchObject({ name: "SWELL", bearingDeg: 290, label: "2.6ft, 8s", color: "#F78E42" });
    expect(out[1]).toMatchObject({ name: "SWELL 2", bearingDeg: 200, label: "1.6ft, 13s", color: "#7AC74F" });
    expect(out[2]).toMatchObject({ name: "WIND", bearingDeg: 230, label: "8 mph", color: "#00D4AA" });
  });

  it("prefers s1Dir over swellDirOm for the primary swell bearing", () => {
    const out = resolveCalloutComponents({ ...EMPTY, swellDirOm: 305, s1Dir: 290, s1PeriodS: 9, s1HeightFt: 3 });
    expect(out[0].bearingDeg).toBe(290);
  });

  it("omits a component with null direction", () => {
    const out = resolveCalloutComponents({ ...EMPTY, s1Dir: null, s1HeightFt: 3, s1PeriodS: 9, windDir: 230, windMph: 8 });
    expect(out.map((c) => c.kind)).toEqual(["wind"]);
  });

  it("omits a component with zero or null magnitude", () => {
    const out = resolveCalloutComponents({ ...EMPTY, s1Dir: 290, s1HeightFt: 0, s1PeriodS: 9, windDir: 230, windMph: 0 });
    expect(out).toEqual([]);
  });

  it("drops the period from the label when period is null", () => {
    const out = resolveCalloutComponents({ ...EMPTY, s1Dir: 290, s1HeightFt: 2.6, s1PeriodS: null });
    expect(out[0].label).toBe("2.6ft");
  });

  it("returns [] for an empty partition", () => {
    expect(resolveCalloutComponents(EMPTY)).toEqual([]);
  });
});

import { nearestBeachInBounds } from "@/components/map/conditions-callout-data";
import type { Beach } from "@/types/database";

const BOUNDS = { west: -118, south: 32, east: -117, north: 33 };
const mk = (id: string, lon: number, lat: number): Beach => ({ id, lon, lat } as Beach);

describe("nearestBeachInBounds", () => {
  const beaches = [mk("a", -117.3, 32.9), mk("b", -117.26, 32.99), mk("c", -117.9, 32.1)];

  it("returns the closest beach to the tap", () => {
    expect(nearestBeachInBounds(-117.27, 32.98, beaches, BOUNDS)?.id).toBe("b");
  });

  it("skips beaches without finite coordinates", () => {
    const withBad = [...beaches, mk("d", NaN, 32.98)];
    expect(nearestBeachInBounds(-117.27, 32.98, withBad, BOUNDS)?.id).toBe("b");
  });

  it("returns the nearest in-bounds beach when the global nearest is outside the viewport", () => {
    const edgeBeaches = [
      mk("offscreen", -118.01, 32.5),
      mk("visible", -117.9, 32.5),
    ];

    expect(nearestBeachInBounds(-117.99, 32.5, edgeBeaches, BOUNDS)?.id).toBe("visible");
  });

  it("returns null when no beach is inside the current viewport", () => {
    const offscreen = [mk("z", -119.5, 34.5)];
    expect(nearestBeachInBounds(-119.5, 34.5, offscreen, BOUNDS)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(nearestBeachInBounds(-117.27, 32.98, [], BOUNDS)).toBeNull();
  });
});

import { decideCalloutAction } from "@/components/map/conditions-callout-data";

describe("decideCalloutAction", () => {
  it("toggles off when tapping the already-open beach", () => {
    expect(decideCalloutAction("b", "b")).toBe("toggle-off");
  });
  it("shows when no callout is open", () => {
    expect(decideCalloutAction(null, "b")).toBe("show");
  });
  it("shows when tapping a different beach", () => {
    expect(decideCalloutAction("a", "b")).toBe("show");
  });
});

describe("formatTempLabel", () => {
  it("rounds and appends a degree sign", () => {
    expect(formatTempLabel("68")).toBe("68°");
    expect(formatTempLabel("68.4")).toBe("68°");
    expect(formatTempLabel("68.6")).toBe("69°");
  });
  it("returns null for absent or non-numeric input", () => {
    expect(formatTempLabel(null)).toBeNull();
    expect(formatTempLabel(undefined)).toBeNull();
    expect(formatTempLabel("")).toBeNull();
    expect(formatTempLabel("n/a")).toBeNull();
  });
});
