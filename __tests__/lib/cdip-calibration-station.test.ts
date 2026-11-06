import {
  calibrationReferenceStation,
  normalizeCdipStationId,
  shoalingFactorsForStation,
} from "@/lib/services/cdip/calibration-station";

const factors = (reference?: string) => ({
  version: 1 as const,
  type: "period_lookup" as const,
  buckets: [{ tp_min_s: 0, tp_max_s: 999, factor: 1.3 }],
  ...(reference !== undefined && { calibration: { reference_buoy: reference } }),
});

describe("normalizeCdipStationId", () => {
  it.each([
    ["CDIP 103", "103"],
    ["cdip 045", "45"],
    ["071", "71"],
    ["71", "71"],
    [" 215 ", "215"],
    ["0", "0"],
    ["", null],
    [null, null],
  ])("%p -> %p", (input, expected) => {
    expect(normalizeCdipStationId(input)).toBe(expected);
  });
});

describe("shoalingFactorsForStation", () => {
  it("keeps buckets for the buoy they were fitted on, whatever the id spelling", () => {
    const f = factors("CDIP 45");
    expect(shoalingFactorsForStation(f, "45")).toBe(f);
    expect(shoalingFactorsForStation(f, "045")).toBe(f);
  });

  it("drops buckets for any other buoy", () => {
    expect(shoalingFactorsForStation(factors("CDIP 155"), "191")).toBeNull();
  });

  it("keeps buckets with no recorded reference buoy", () => {
    const f = factors();
    expect(calibrationReferenceStation(f)).toBeNull();
    expect(shoalingFactorsForStation(f, "191")).toBe(f);
  });

  it("passes null factors and a missing station through", () => {
    expect(shoalingFactorsForStation(null, "191")).toBeNull();
    const f = factors("CDIP 155");
    expect(shoalingFactorsForStation(f, null)).toBe(f);
  });
});
