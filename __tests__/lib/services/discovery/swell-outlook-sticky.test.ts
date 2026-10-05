// __tests__/lib/services/discovery/swell-outlook-sticky.test.ts
import { carryOverSwells, STICKY_MIN_FACE_FT, type CarryOverInput } from "@/lib/services/discovery/swell-outlook-sticky";
import type { OutlookSwell } from "@/lib/services/discovery/swell-outlook-types";
import { BEACH_ID, NOW, dayRows, localIso, row, swellBeach, type PartitionSpec } from "@/__tests__/helpers/swell-events";

const PEAK_AT = localIso(3, 12);

function entry(overrides: Partial<OutlookSwell> = {}): OutlookSwell {
  return {
    id: `${BEACH_ID}:W:2026-09-28:p`, eventKey: `${BEACH_ID}:W:2026-09-28:p`, tier: "likely", status: "forecast", change: "steady",
    arrivalAt: localIso(2, 12), peakAt: PEAK_AT, peakWindow: null, faceHeightFt: { min: 4, max: 6 }, periodS: 14,
    directionDeg: 270, directionLabel: "W", beach: { id: BEACH_ID, name: "Test Beach" }, beachCount: 3, notable: false,
    fit: { status: "in_range", boards: [] }, source: "unknown", stormName: null,
    sizeByOrientation: { southFacing: null, westFacing: { min: 4, max: 6 } }, history: [],
    ...overrides,
  };
}

function rowsAround(spec: PartitionSpec): ReturnType<typeof dayRows> {
  return [2, 3, 4].flatMap((day) => dayRows(day, spec));
}

function carry(args: { previous: OutlookSwell[] | null; current?: CarryOverInput["current"]; rows?: ReturnType<typeof rowsAround>; now?: Date; skill?: "advanced" | null }): OutlookSwell[] {
  return carryOverSwells({
    previous: args.previous ? { runDate: "2026-09-24", swells: args.previous } : null,
    current: args.current ?? [],
    forecastsByBeach: new Map([[BEACH_ID, args.rows ?? []]]),
    beachesById: new Map([[BEACH_ID, swellBeach()]]),
    skillLevel: args.skill === undefined ? "advanced" : args.skill,
    boardClasses: ["shortboard"],
    now: args.now ?? NOW,
  });
}

describe("carryOverSwells", () => {
  it("keeps a swell that dropped under the bar as shrinking, at its current size, tier unchanged", () => {
    const [kept] = carry({ previous: [entry()], rows: rowsAround({ heightFt: 2.5, periodS: 14, direction: 270 }) });
    expect(kept).toMatchObject({ status: "shrinking", change: "downgraded", tier: "likely", id: entry().id, peakAt: PEAK_AT });
    expect(kept.faceHeightFt.max).toBeLessThan(5);
    expect(kept.faceHeightFt).toEqual({ min: 3, max: 4 });
    // 2.5 ft at 14 s reads about 3.4 ft: under an advanced shortboard's ideal 3.5, still acceptable.
    expect(kept.fit.status).toBe("rideable");
    expect(kept.fit.boards).toEqual([]);
  });

  it("lists a swell with no partition in the rows once as faded", () => {
    const [kept] = carry({ previous: [entry()], rows: rowsAround({ heightFt: 3, periodS: 14, direction: 90 }) });
    expect(kept).toMatchObject({ status: "faded", change: "downgraded" });
  });

  it("fades a swell whose remaining partition is under 2 ft", () => {
    expect(carry({ previous: [entry()], rows: rowsAround({ heightFt: 0.8, periodS: 14, direction: 270 }) })[0].status).toBe("faded");
  });

  it("removes a faded entry the next day", () => {
    expect(carry({ previous: [entry({ status: "faded" })], rows: rowsAround({ heightFt: 0.8, periodS: 14, direction: 270 }) })).toEqual([]);
  });

  it("does not carry an entry that today's list still has", () => {
    expect(carry({ previous: [entry()], current: [entry({ id: "other-id", peakAt: localIso(3, 15) })] })).toEqual([]);
    expect(carry({ previous: [entry()], current: [entry()] })).toEqual([]);
  });

  it("treats a missing beach or no rows as faded without throwing", () => {
    const result = carryOverSwells({
      previous: { runDate: "2026-09-24", swells: [entry()] }, current: [], forecastsByBeach: new Map(), beachesById: new Map(),
      skillLevel: null, boardClasses: [], now: NOW,
    });
    expect(result[0].status).toBe("faded");
  });

  it("shows an arrived swell for 12 h after its peak and then drops it", () => {
    const peak = new Date(PEAK_AT).getTime();
    expect(carry({ previous: [entry()], now: new Date(peak + 6 * 3_600_000) })[0].status).toBe("arrived");
    expect(carry({ previous: [entry()], now: new Date(peak + 13 * 3_600_000) })).toEqual([]);
  });

  it("returns nothing without a previous list", () => {
    expect(carry({ previous: null })).toEqual([]);
  });

  it("leaves the previous entry untouched (no mutation)", () => {
    const previous = entry();
    const snapshot = JSON.stringify(previous);
    carry({ previous: [previous], rows: rowsAround({ heightFt: 2.5, periodS: 14, direction: 270 }) });
    expect(JSON.stringify(previous)).toBe(snapshot);
  });

  it.each<[number, number, OutlookSwell["status"][]]>([
    [315, 36 * 3_600_000, []],
    [225, -36 * 3_600_000, []],
    [315.01, 0, ["faded"]],
    [270, 36 * 3_600_000 + 1, ["faded"]],
    [270, -36 * 3_600_000 - 1, ["faded"]],
  ])("matches current direction %s and peak offset %s only inside inclusive tolerances", (directionDeg, offsetMs, statuses) => {
    const current = entry({
      id: "other-id",
      directionDeg,
      peakAt: new Date(Date.parse(PEAK_AT) + offsetMs).toISOString(),
    });
    expect(carry({ previous: [entry()], current: [current] }).map((swell) => swell.status)).toEqual(statuses);
  });

  it("matches the same id regardless of direction and peak drift", () => {
    expect(carry({ previous: [entry()], current: [entry({ directionDeg: 90, peakAt: localIso(8, 12) })] })).toEqual([]);
  });

  it("matches current directions across north", () => {
    expect(carry({ previous: [entry({ directionDeg: 350 })], current: [entry({ id: "other-id", directionDeg: 10 })] })).toEqual([]);
  });

  it.each<[number, OutlookSwell["status"]]>([
    [-36 * 3_600_000, "shrinking"],
    [36 * 3_600_000, "shrinking"],
    [-36 * 3_600_000 - 1, "faded"],
    [36 * 3_600_000 + 1, "faded"],
  ])("uses forecast peak offset %s only inside the inclusive 36 h window", (offsetMs, status) => {
    const at = new Date(Date.parse(PEAK_AT) + offsetMs).toISOString();
    expect(carry({ previous: [entry()], rows: [row(at, { heightFt: 2.5, periodS: 14, direction: 270 })] })[0].status).toBe(status);
  });

  it.each<[number, OutlookSwell["status"]]>([
    [225, "shrinking"], [315, "shrinking"], [224.99, "faded"], [315.01, "faded"],
  ])("uses forecast partitions within 45 degrees of previous direction %s", (directionDeg, status) => {
    expect(carry({ previous: [entry({ directionDeg })], rows: [row(PEAK_AT, { heightFt: 2.5, periodS: 14, direction: 270 })] })[0].status).toBe(status);
  });

  it("finds matching forecast partitions across north", () => {
    expect(carry({ previous: [entry({ directionDeg: 350 })], rows: [row(PEAK_AT, { heightFt: 4, periodS: 14, direction: 10 })] })[0].status).toBe("shrinking");
  });

  it("chooses the largest matching face height and ignores stronger unrelated partitions and rows", () => {
    const kept = carry({ previous: [entry()], rows: [
      row(PEAK_AT, { heightFt: 20, periodS: 14, direction: 90 }, { heightFt: 2.5, periodS: 14, direction: 270 }),
      row(localIso(3, 15), { heightFt: 1.5, periodS: 14, direction: 270 }),
      row(localIso(6, 12), { heightFt: 20, periodS: 14, direction: 270 }),
    ] });
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ status: "shrinking", faceHeightFt: { min: 3, max: 4 }, fit: { status: "rideable", boards: [] } });
  });

  it("includes a projected face of exactly 2 ft and fades a projected face below it", () => {
    expect(STICKY_MIN_FACE_FT).toBe(2);
    const [kept] = carry({ previous: [entry()], rows: rowsAround({ heightFt: 1.5, periodS: 14, direction: 270 }) });
    expect(kept).toMatchObject({ status: "shrinking", faceHeightFt: { min: 1.5, max: 2.5 }, fit: { status: "below_range", boards: [] } });
    expect(carry({ previous: [entry()], rows: rowsAround({ heightFt: 1.4, periodS: 14, direction: 270 }) })[0].status).toBe("faded");
  });

  it("recomputes fit as unknown without a skill level", () => {
    expect(carry({ previous: [entry()], rows: rowsAround({ heightFt: 2.5, periodS: 14, direction: 270 }), skill: null })[0].fit).toEqual({ status: "unknown", boards: [] });
  });

  it("fades when the beach exists but has no rows", () => {
    expect(carry({ previous: [entry()] })[0]).toMatchObject({ status: "faded", change: "downgraded" });
  });

  it("fades when matching rows exist but the beach is missing", () => {
    expect(carryOverSwells({
      previous: { runDate: "2026-09-24", swells: [entry()] }, current: [],
      forecastsByBeach: new Map([[BEACH_ID, rowsAround({ heightFt: 4, periodS: 14, direction: 270 })]]), beachesById: new Map(),
      skillLevel: "advanced", boardClasses: ["shortboard"], now: NOW,
    })[0]).toMatchObject({ status: "faded", change: "downgraded" });
  });

  it.each<OutlookSwell["tier"]>(["early_signal", "on_the_radar", "likely", "locked"])("preserves tier %s even when the remaining size grows", (tier) => {
    expect(carry({ previous: [entry({ tier })], rows: rowsAround({ heightFt: 8, periodS: 14, direction: 270 }) })[0]).toMatchObject({ tier, status: "shrinking", change: "downgraded" });
  });

  it.each<[number, OutlookSwell["status"][]]>([
    [0, ["arrived"]], [12 * 3_600_000, ["arrived"]], [12 * 3_600_000 + 1, []],
  ])("keeps arrived entries at peak offset %s through the inclusive 12 h limit", (offsetMs, statuses) => {
    expect(carry({ previous: [entry({ status: "shrinking", change: "downgraded" })], now: new Date(Date.parse(PEAK_AT) + offsetMs) }).map((swell) => swell.status)).toEqual(statuses);
  });

  it("preserves arrived size, fit and tier while resetting change to steady", () => {
    const previous = entry({ tier: "early_signal", change: "downgraded" });
    expect(carry({ previous: [previous], now: new Date(PEAK_AT) })).toEqual([{ ...previous, status: "arrived", change: "steady" }]);
  });
});
