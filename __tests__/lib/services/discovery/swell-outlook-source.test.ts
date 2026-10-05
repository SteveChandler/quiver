// __tests__/lib/services/discovery/swell-outlook-source.test.ts
import {
  faceHeightRange,
  faceHeightSpan,
  isEastPacificHurricaneSeason,
  matchStormOnBearing,
  sizeByOrientation,
  swellSourceFor,
} from "@/lib/services/discovery/swell-outlook-source";
import type { ActiveStorm } from "@/lib/services/discovery/nhc-storms";
import type { SwellSource } from "@/lib/services/discovery/swell-outlook-types";

const RACHEL: ActiveStorm = { id: "ep182026", name: "Rachel", basin: "ep", lat: 20.1, lon: -114.3 };
const NIGEL: ActiveStorm = { id: "al092026", name: "Nigel", basin: "other", lat: 25.2, lon: -60.1 };
const OCT = "2026-10-08T19:00:00.000Z";

describe("swellSourceFor", () => {
  it("labels long-period south as southern hemisphere", () => {
    expect(swellSourceFor({ directionDeg: 205, periodS: 15, peakAt: OCT, activeStorms: [] })).toBe("southern_hemisphere");
  });

  it("labels 150-190 deg in season with an active East Pacific system as tropical, first", () => {
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: OCT, activeStorms: [RACHEL] })).toBe("tropical");
    expect(swellSourceFor({ directionDeg: 185, periodS: 15, peakAt: OCT, activeStorms: [RACHEL] })).toBe("tropical");
  });

  it("stays non-tropical without a system, off season or with only an Atlantic storm", () => {
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: OCT, activeStorms: [] })).toBe("unknown");
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: "2026-02-08T19:00:00.000Z", activeStorms: [RACHEL] })).toBe("unknown");
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: OCT, activeStorms: [NIGEL] })).toBe("unknown");
  });

  it("labels long-period northwest as north pacific, short period as local, the rest unknown", () => {
    expect(swellSourceFor({ directionDeg: 300, periodS: 14, peakAt: OCT, activeStorms: [] })).toBe("north_pacific");
    expect(swellSourceFor({ directionDeg: 300, periodS: 9, peakAt: OCT, activeStorms: [] })).toBe("local");
    expect(swellSourceFor({ directionDeg: 60, periodS: 12, peakAt: OCT, activeStorms: [] })).toBe("unknown");
    expect(swellSourceFor({ directionDeg: 205, periodS: null, peakAt: OCT, activeStorms: [] })).toBe("unknown");
  });

  it.each<[number, number, SwellSource]>([
    [180, 14, "southern_hemisphere"], [230, 14, "southern_hemisphere"],
    [179, 14, "unknown"], [231, 14, "unknown"], [205, 13.9, "unknown"],
    [280, 13, "north_pacific"], [320, 13, "north_pacific"],
    [279, 13, "unknown"], [321, 13, "unknown"], [300, 12.9, "unknown"],
    [60, 10.9, "local"], [60, 11, "unknown"],
  ])("labels %s deg at %s s as %s at the rule boundaries", (directionDeg, periodS, source) => {
    expect(swellSourceFor({ directionDeg, periodS, peakAt: OCT, activeStorms: [] })).toBe(source);
  });

  it.each<[number, SwellSource]>([
    [149, "unknown"], [150, "tropical"], [190, "tropical"], [191, "southern_hemisphere"],
  ])("labels %s deg as %s with an active Pacific storm", (directionDeg, source) => {
    expect(swellSourceFor({ directionDeg, periodS: 15, peakAt: OCT, activeStorms: [RACHEL] })).toBe(source);
  });

  it("supports Central Pacific systems and still requires a period", () => {
    const centralPacific: ActiveStorm = { ...RACHEL, basin: "cp" };
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: OCT, activeStorms: [centralPacific] })).toBe("tropical");
    expect(swellSourceFor({ directionDeg: 170, periodS: null, peakAt: OCT, activeStorms: [RACHEL] })).toBe("unknown");
  });

  it("falls back to southern hemisphere without tropical evidence in the overlapping sector", () => {
    expect(swellSourceFor({ directionDeg: 185, periodS: 15, peakAt: OCT, activeStorms: [] })).toBe("southern_hemisphere");
    expect(swellSourceFor({ directionDeg: 185, periodS: 15, peakAt: "2026-02-08T19:00:00Z", activeStorms: [RACHEL] })).toBe("southern_hemisphere");
  });

  it("does not label an invalid peak date as tropical", () => {
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: "invalid", activeStorms: [RACHEL] })).toBe("unknown");
  });
});

describe("isEastPacificHurricaneSeason", () => {
  it("runs May 15 through Nov 30", () => {
    expect(isEastPacificHurricaneSeason(new Date("2026-05-14T12:00:00Z"))).toBe(false);
    expect(isEastPacificHurricaneSeason(new Date("2026-05-15T12:00:00Z"))).toBe(true);
    expect(isEastPacificHurricaneSeason(new Date("2026-11-30T12:00:00Z"))).toBe(true);
    expect(isEastPacificHurricaneSeason(new Date("2026-12-01T12:00:00Z"))).toBe(false);
  });

  it.each<[string, boolean]>([
    ["2026-05-14T23:59:59.999Z", false], ["2026-05-15T00:00:00Z", true],
    ["2026-11-30T23:59:59.999Z", true], ["2026-12-01T00:00:00Z", false],
    ["2026-05-14T20:00:00-07:00", true], ["invalid", false],
  ])("uses the UTC season boundary for %s: %s", (timestamp, expected) => {
    expect(isEastPacificHurricaneSeason(new Date(timestamp))).toBe(expected);
  });
});

describe("matchStormOnBearing", () => {
  const sanDiego = { lat: 32.7, lon: -117.25 };

  it("names a Pacific system that lies on the swell's bearing", () => {
    expect(matchStormOnBearing({ storms: [RACHEL, NIGEL], beach: sanDiego, directionDeg: 168 })).toBe("Rachel");
  });

  it("returns null when no system lies within 20 deg of the bearing or the list is empty", () => {
    expect(matchStormOnBearing({ storms: [RACHEL], beach: sanDiego, directionDeg: 250 })).toBeNull();
    expect(matchStormOnBearing({ storms: [], beach: sanDiego, directionDeg: 168 })).toBeNull();
    expect(matchStormOnBearing({ storms: [NIGEL], beach: sanDiego, directionDeg: 100 })).toBeNull();
  });

  it("includes the 20-degree tolerance and excludes a storm just beyond it", () => {
    const storm: ActiveStorm = { ...RACHEL, lat: 20, lon: sanDiego.lon };
    expect(matchStormOnBearing({ storms: [storm], beach: sanDiego, directionDeg: 160 })).toBe("Rachel");
    expect(matchStormOnBearing({ storms: [storm], beach: sanDiego, directionDeg: 159.9 })).toBeNull();
  });

  it("chooses the closest Pacific bearing and ignores a closer Atlantic storm", () => {
    const dueSouth: ActiveStorm = { ...RACHEL, name: "Closer", basin: "cp", lat: 20, lon: sanDiego.lon };
    const atlantic: ActiveStorm = { ...dueSouth, basin: "other", name: "Atlantic" };
    expect(matchStormOnBearing({ storms: [RACHEL, atlantic, dueSouth], beach: sanDiego, directionDeg: 180 })).toBe("Closer");
    expect(matchStormOnBearing({ storms: [atlantic], beach: sanDiego, directionDeg: 180 })).toBeNull();
  });

  it("matches across north without mutating a readonly storm list", () => {
    const storms = Object.freeze([Object.freeze({ ...RACHEL, lat: 40, lon: sanDiego.lon })]);
    expect(matchStormOnBearing({ storms, beach: sanDiego, directionDeg: 350 })).toBe("Rachel");
    expect(storms).toEqual([{ ...RACHEL, lat: 40, lon: sanDiego.lon }]);
  });
});

describe("size ranges", () => {
  it("widens a single value to at least one foot and rounds to half feet", () => {
    expect(faceHeightRange(2.5)).toEqual({ min: 2, max: 3 });
    expect(faceHeightRange(6)).toEqual({ min: 5, max: 7 });
    expect(faceHeightRange(1.5)).toEqual({ min: 1, max: 2 });
    expect(faceHeightRange(0)).toEqual({ min: 0, max: 1 });
    expect(faceHeightRange(10)).toEqual({ min: 8.5, max: 11.5 });
    expect(faceHeightRange(4)).toEqual({ min: 3.5, max: 4.5 });
  });

  it("spans several beaches and is null for none", () => {
    expect(faceHeightSpan([])).toBeNull();
    expect(faceHeightSpan([3, 5.2])).toEqual({ min: 3, max: 5.5 });
    expect(faceHeightSpan([4])).toEqual(faceHeightRange(4));
    expect(faceHeightSpan([3, 3])).toEqual({ min: 3, max: 4 });
    expect(faceHeightSpan([5.2, 3])).toEqual({ min: 3, max: 5.5 });
  });
});

describe("sizeByOrientation", () => {
  it("splits beaches into south-facing and west-facing by their swell window", () => {
    expect(sizeByOrientation([
      { windowCenterDeg: 190, faceHeightFt: 4 },
      { windowCenterDeg: 270, faceHeightFt: 2.5 },
      { windowCenterDeg: 265, faceHeightFt: 3 },
    ])).toEqual({ southFacing: faceHeightRange(4), westFacing: { min: 2.5, max: 3.5 } });
  });

  it("is null for an orientation no beach faces, and ignores beaches without a window", () => {
    expect(sizeByOrientation([{ windowCenterDeg: null, faceHeightFt: 4 }])).toEqual({ southFacing: null, westFacing: null });
    expect(sizeByOrientation([{ windowCenterDeg: 270, faceHeightFt: 2 }]).southFacing).toBeNull();
  });

  it("assigns the shared 225-degree edge to south and excludes other orientations", () => {
    expect(sizeByOrientation([
      { windowCenterDeg: 135, faceHeightFt: 3 },
      { windowCenterDeg: 225, faceHeightFt: 5 },
      { windowCenterDeg: 315, faceHeightFt: 2 },
      { windowCenterDeg: 134.9, faceHeightFt: 20 },
      { windowCenterDeg: 315.1, faceHeightFt: 20 },
      { windowCenterDeg: 0, faceHeightFt: 20 },
    ])).toEqual({ southFacing: { min: 3, max: 5 }, westFacing: { min: 1.5, max: 2.5 } });
  });

  it("returns empty ranges for no members and accepts readonly members", () => {
    expect(sizeByOrientation([])).toEqual({ southFacing: null, westFacing: null });
    const members = Object.freeze([Object.freeze({ windowCenterDeg: 190, faceHeightFt: 4 })]);
    expect(sizeByOrientation(members)).toEqual({ southFacing: { min: 3.5, max: 4.5 }, westFacing: null });
    expect(members).toEqual([{ windowCenterDeg: 190, faceHeightFt: 4 }]);
  });
});
