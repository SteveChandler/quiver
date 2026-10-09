jest.mock("@/lib/services/discovery/swell-tracking", () => {
  const actual = jest.requireActual("@/lib/services/discovery/swell-tracking");
  return { ...actual, groupEvents: jest.fn(actual.groupEvents) };
});
import * as tracking from "@/lib/services/discovery/swell-tracking";
// __tests__/lib/services/discovery/swell-outlook.test.ts
import {
  buildSwellOutlook,
  resolveOutlookRunDate,
  type BuildSwellOutlookInput,
} from "@/lib/services/discovery/swell-outlook";
import { matchStormOnBearing } from "@/lib/services/discovery/swell-outlook-source";
import type { OutlookSwell } from "@/lib/services/discovery/swell-outlook-types";
import type { SwellEventSnapshot } from "@/lib/alerts/swell-events";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { NOW, TIMEZONE, dayRows, localIso } from "@/__tests__/helpers/swell-events";
import type { Beach } from "@/types/database";

const HOME = "cccccccc-0000-4000-8000-000000000001";
const SECOND = "cccccccc-0000-4000-8000-000000000002";
const THIRD = "cccccccc-0000-4000-8000-000000000003";
const NO_WINDOW = "cccccccc-0000-4000-8000-000000000004";

function beach(id: string, name: string, center: number | null = 270): Beach {
  return createMockBeach({
    id, name, slug: name.toLowerCase(), timezone: TIMEZONE,
    swell_window_center_deg: center, swell_window_halfwidth_deg: center === null ? null : 30,
  });
}

function pulse(beachId: string, overrides: Partial<SwellEventSnapshot> = {}): SwellEventSnapshot {
  return {
    beachId, eventKey: `${beachId}:W:2026-09-28:p`, detectorVersion: "swell-outlook-pulse.v1", runDate: "2026-09-25",
    detectedAt: "2026-09-25T14:30:00.000Z", directionDeg: 270, directionBand: "W", periodS: 14, peakOffshoreHeightFt: 3,
    peakFaceHeightFt: 4, exposure: 1, energyRatio: 5, arrivalAt: "2026-09-28T07:00:00.000Z", peakAt: "2026-09-28T19:00:00.000Z",
    fadeAt: "2026-09-29T07:00:00.000Z", crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
    ...overrides,
  };
}

function input(overrides: Partial<BuildSwellOutlookInput> = {}): BuildSwellOutlookInput {
  return {
    pool: [
      { beach: beach(HOME, "Home Beach"), relation: "home" },
      { beach: beach(SECOND, "Second"), relation: "nearby" },
      { beach: beach(THIRD, "Third"), relation: "nearby" },
    ],
    homeBeachId: HOME,
    pulseSnapshots: [pulse(HOME), pulse(SECOND, { peakFaceHeightFt: 3 }), pulse(THIRD, { peakFaceHeightFt: 5 })],
    notableSnapshots: [],
    forecastsByBeach: new Map(),
    previous: null,
    skillLevel: "advanced",
    boardClasses: ["shortboard"],
    storms: [],
    now: NOW,
    ...overrides,
  };
}

describe("buildSwellOutlook", () => {
  it("leaves the faded Thursday pulse unpinned when Oct 6 no longer emits its old notable key", () => {
    const thursday = pulse(HOME, {
      runDate: "2026-10-06", detectedAt: "2026-10-06T14:30:00.000Z",
      eventKey: `${HOME}:SW:2026-10-08:p`, directionDeg: 202.5, periodS: 15,
      peakFaceHeightFt: 2.7, arrivalAt: "2026-10-08T07:00:00.000Z", peakAt: "2026-10-09T00:00:00.000Z",
      fadeAt: "2026-10-09T12:00:00.000Z",
    });
    const stale = { ...thursday, eventKey: `${HOME}:SW:2026-10-07`, detectorVersion: "swell-events.v1",
      runDate: "2026-10-05", detectedAt: "2026-10-05T14:30:00.000Z", peakFaceHeightFt: 3.6, periodS: 11 };
    const saturday = { ...stale, eventKey: `${HOME}:SW:2026-10-11`, runDate: "2026-10-06",
      detectedAt: "2026-10-06T14:30:00.000Z", peakAt: "2026-10-10T15:00:00.000Z", peakFaceHeightFt: 3.3, periodS: 14 };
    const [swell] = buildSwellOutlook(input({
      now: new Date("2026-10-06T15:24:00.000Z"), pulseSnapshots: [thursday], notableSnapshots: [stale, saturday],
    })).response.swells;
    expect(swell).toMatchObject({ notable: false, eventKey: thursday.eventKey, peakAt: thursday.peakAt, periodS: 15 });
  });

  it("uses the current notable event's facts for a linked first sighting, rather than the pulse's facts", () => {
    const notable = pulse(HOME, {
      eventKey: `${HOME}:W:2026-09-28`, detectorVersion: "swell-events.v1",
      peakAt: "2026-09-29T07:00:00.000Z", arrivalAt: "2026-09-28T13:00:00.000Z",
      fadeAt: "2026-09-30T07:00:00.000Z", periodS: 16, directionDeg: 280, peakFaceHeightFt: 5,
    });
    const [swell] = buildSwellOutlook(input({ notableSnapshots: [notable] })).response.swells;
    expect(swell).toMatchObject({
      notable: true, eventKey: notable.eventKey, peakAt: notable.peakAt, arrivalAt: notable.arrivalAt,
      fadeAt: notable.fadeAt, periodS: 16, directionDeg: 280, faceHeightFt: { min: 4.5, max: 6 },
    });
  });

  it.each([{ periodS: 18 }, { peakFaceHeightFt: 7 }])("does not borrow a live notable key from a different component: %s", (facts) => {
    const [swell] = buildSwellOutlook(input({ notableSnapshots: [pulse(HOME, { eventKey: "other-key", ...facts })] })).response.swells;
    expect(swell).toMatchObject({ notable: false, eventKey: pulse(HOME).eventKey });
  });

  it("builds an empty outlook for an empty pool", () => {
    const { response, list } = buildSwellOutlook(input({ pool: [], homeBeachId: null, pulseSnapshots: [] }));
    expect(response).toMatchObject({ runDate: "2026-09-25", horizonDays: 9, homeBeach: null, swells: [] });
    expect(response.generatedAt).toBe(NOW.toISOString());
    expect(list).toEqual({ runDate: "2026-09-25", swells: [] });
  });

  it("returns an empty list when no pulse was recorded for the pool", () => {
    expect(buildSwellOutlook(input({ pulseSnapshots: [] })).response.swells).toEqual([]);
  });

  it("merges one swell seen at three beaches into one entry sized at the home beach", () => {
    const [swell, ...rest] = buildSwellOutlook(input()).response.swells;
    expect(rest).toEqual([]);
    expect(swell).toMatchObject({
      eventKey: `${HOME}:W:2026-09-28:p`, beach: { id: HOME, name: "Home Beach" }, beachCount: 3, status: "forecast",
      tier: "on_the_radar", change: "new", periodS: 14, directionDeg: 270, directionLabel: "W", notable: false,
      peakWindow: null, faceHeightFt: { min: 3.5, max: 4.5 }, source: "unknown", stormName: null,
      fit: { status: "in_range", boards: ["shortboard"] },
    });
    expect(swell.id).toBe(`${HOME}:W:2026-09-28:p`);
  });

  it("sizes at the largest beach without a home beach, and reports no home beach", () => {
    const { response } = buildSwellOutlook(input({
      pool: input().pool.map(({ beach: item }) => ({ beach: item, relation: "nearby" as const })),
      homeBeachId: null,
    }));
    expect(response.homeBeach).toBeNull();
    expect(response.swells[0].beach.id).toBe(THIRD);
  });

  it("keeps two overlapping trains as two entries sorted by peak", () => {
    const later = pulse(HOME, { eventKey: `${HOME}:WNW:2026-09-30:p`, directionDeg: 285, periodS: 16, peakAt: "2026-09-30T19:00:00.000Z", arrivalAt: "2026-09-30T07:00:00.000Z" });
    const { response } = buildSwellOutlook(input({
      pool: [{ beach: beach(HOME, "Home Beach"), relation: "home" }],
      pulseSnapshots: [later, pulse(HOME, { periodS: 12 })],
    }));
    expect(response.swells.map((swell) => swell.periodS)).toEqual([12, 16]);
  });

  it("shows a peak more than five days out as a window", () => {
    const far = pulse(HOME, { peakAt: "2026-10-02T19:00:00.000Z", arrivalAt: "2026-10-02T07:00:00.000Z", eventKey: `${HOME}:W:2026-10-02:p` });
    const [swell] = buildSwellOutlook(input({ pulseSnapshots: [far] })).response.swells;
    expect(swell.peakWindow).toEqual({ from: "2026-10-02T07:00:00.000Z", to: "2026-10-03T07:00:00.000Z" });
    expect(swell.tier).toBe("on_the_radar");
  });

  it("links a notable event within 45 deg and 36 h, and only then", () => {
    const notable = pulse(HOME, { eventKey: `${HOME}:W:2026-09-28`, detectorVersion: "swell-events.v1", peakAt: "2026-09-28T23:00:00.000Z" });
    const [linked] = buildSwellOutlook(input({ notableSnapshots: [notable] })).response.swells;
    expect(linked).toMatchObject({ notable: true, eventKey: `${HOME}:W:2026-09-28` });
    const [apart] = buildSwellOutlook(input({ notableSnapshots: [{ ...notable, directionDeg: 180, peakAt: "2026-09-28T19:00:00.000Z" }] })).response.swells;
    expect(apart).toMatchObject({ notable: false, eventKey: `${HOME}:W:2026-09-28:p` });
    const [late] = buildSwellOutlook(input({ notableSnapshots: [{ ...notable, peakAt: "2026-09-30T19:00:00.000Z" }] })).response.swells;
    expect(late.notable).toBe(false);
  });

  it("lists swells without a skill level as unknown fit, and with no boards uses the skill default", () => {
    expect(buildSwellOutlook(input({ skillLevel: null })).response.swells[0].fit).toEqual({ status: "unknown", boards: [] });
    // beginner default band: ideal 1-3, acceptable 0.5-4; a 4 ft face is rideable
    expect(buildSwellOutlook(input({ skillLevel: "beginner", boardClasses: [] })).response.swells[0].fit).toEqual({ status: "rideable", boards: [] });
  });

  it("names the storm only for a tropical swell and only when one lies on the bearing", () => {
    const tropical = pulse(HOME, { directionDeg: 170, directionBand: "S", periodS: 12, eventKey: `${HOME}:S:2026-10-08:p`, peakAt: "2026-10-08T19:00:00.000Z", arrivalAt: "2026-10-08T07:00:00.000Z" });
    const storm = { id: "ep182026", name: "Rachel", basin: "ep" as const, lat: 20.1, lon: -114.3 };
    const named = buildSwellOutlook(input({ pulseSnapshots: [tropical], storms: [storm] })).response.swells[0];
    expect(named).toMatchObject({ source: "tropical", stormName: "Rachel" });
    const unnamed = buildSwellOutlook(input({ pulseSnapshots: [tropical], storms: [] })).response.swells[0];
    expect(unnamed).toMatchObject({ source: "unknown", stormName: null });
  });

  it("splits sizes by orientation and ignores beaches without a swell window", () => {
    const pool = [
      { beach: beach(HOME, "Home Beach", 270), relation: "home" as const },
      { beach: beach(SECOND, "South Beach", 190), relation: "nearby" as const },
      { beach: beach(NO_WINDOW, "Unmeasured", null), relation: "nearby" as const },
    ];
    const [swell] = buildSwellOutlook(input({
      pool, pulseSnapshots: [pulse(HOME, { peakFaceHeightFt: 3 }), pulse(SECOND, { peakFaceHeightFt: 4 }), pulse(NO_WINDOW, { peakFaceHeightFt: 2 })],
    })).response.swells;
    expect(swell.sizeByOrientation).toEqual({ westFacing: { min: 2.5, max: 3.5 }, southFacing: { min: 3.5, max: 4.5 } });
    expect(swell.beachCount).toBe(3);
  });

  it("builds history from every run of the representative key", () => {
    const [swell] = buildSwellOutlook(input({
      pulseSnapshots: [
        pulse(HOME), pulse(HOME, { runDate: "2026-09-23", detectedAt: "2026-09-23T14:30:00.000Z", peakOffshoreHeightFt: 2.4, peakFaceHeightFt: 3.04, periodS: 13.6 }),
        pulse(SECOND), pulse(THIRD),
      ],
    })).response.swells;
    expect(swell.history).toEqual([
      { runDate: "2026-09-23", peakAt: "2026-09-28T19:00:00.000Z", faceHeightFt: 3, periodS: 14 },
      { runDate: "2026-09-25", peakAt: "2026-09-28T19:00:00.000Z", faceHeightFt: 4, periodS: 14 },
    ]);
    expect(swell.change).toBe("upgraded");
  });

  it("carries the previous id when the same swell is matched", () => {
    const previous = buildSwellOutlook(input()).list;
    previous.runDate = "2026-09-24";
    previous.swells[0] = { ...previous.swells[0], id: "older-id", directionDeg: 268, peakAt: "2026-09-28T07:00:00.000Z" };
    expect(buildSwellOutlook(input({ previous })).response.swells[0].id).toBe("older-id");
  });

  it("drops a pulse whose swell is already over", () => {
    const over = pulse(HOME, { peakAt: "2026-09-23T19:00:00.000Z", arrivalAt: "2026-09-23T07:00:00.000Z", fadeAt: "2026-09-24T07:00:00.000Z" });
    expect(buildSwellOutlook(input({ pulseSnapshots: [over] })).response.swells).toEqual([]);
  });

  it("keeps a swell that dropped under the bar as shrinking, in time order", () => {
    const previous: OutlookSwell = {
      id: "old", eventKey: `${HOME}:W:2026-09-27:p`, tier: "likely", status: "forecast", change: "steady", arrivalAt: null,
      peakAt: localIso(2, 12), peakWindow: null, faceHeightFt: { min: 4, max: 6 }, periodS: 14, directionDeg: 270, directionLabel: "W",
      beach: { id: HOME, name: "Home Beach" }, beachCount: 3, notable: false, fit: { status: "in_range", boards: [] }, source: "unknown",
      stormName: null, sizeByOrientation: { southFacing: null, westFacing: null }, history: [],
    };
    const rows = [1, 2, 3].flatMap((day) => dayRows(day, { heightFt: 2.5, periodS: 14, direction: 270 }));
    const { response, list } = buildSwellOutlook(input({
      previous: { runDate: "2026-09-24", swells: [previous] },
      pulseSnapshots: [pulse(HOME, { peakAt: "2026-09-30T19:00:00.000Z", arrivalAt: "2026-09-30T07:00:00.000Z", eventKey: `${HOME}:W:2026-09-30:p` })],
      forecastsByBeach: new Map([[HOME, rows]]),
    }));
    expect(response.swells.map((swell) => [swell.id, swell.status])).toEqual([["old", "shrinking"], [`${HOME}:W:2026-09-30:p`, "forecast"]]);
    expect(list.swells).toEqual(response.swells);
  });
  it("does not name a southern hemisphere swell even with an active storm on its bearing", () => {
    const southern = pulse(HOME, { directionDeg: 200, directionBand: "S", periodS: 16 });
    const storm = { id: "ep182026", name: "Rachel", basin: "ep" as const, lat: 20, lon: -122 };
    const home = beach(HOME, "Home Beach");
    expect(matchStormOnBearing({ storms: [storm], beach: home, directionDeg: 200 })).toBe("Rachel");
    const [swell] = buildSwellOutlook(input({ pulseSnapshots: [southern], storms: [storm] })).response.swells;
    expect(swell).toMatchObject({ source: "southern_hemisphere", stormName: null });
  });

  it("resolves the latest run only from pool beaches", () => {
    const { response } = buildSwellOutlook(input({
      pulseSnapshots: [pulse(HOME), pulse(NO_WINDOW, { runDate: "2026-09-26" })],
    }));
    expect(response.runDate).toBe("2026-09-25");
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0].beach.id).toBe(HOME);
  });

  it("uses the newest snapshot per key in the latest run and ignores older-only swells", () => {
    const { response } = buildSwellOutlook(input({ pulseSnapshots: [
      pulse(HOME, { detectedAt: "2026-09-25T14:00:00.000Z", peakFaceHeightFt: 8 }),
      pulse(SECOND, { runDate: "2026-09-24", eventKey: "older-only" }),
      pulse(HOME),
    ] }));
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0]).toMatchObject({ beachCount: 1, faceHeightFt: { min: 3.5, max: 4.5 } });
    expect(response.swells[0].history).toEqual([
      { runDate: "2026-09-25", peakAt: "2026-09-28T19:00:00.000Z", faceHeightFt: 4, periodS: 14 },
    ]);
  });

  it("does not compare a stale latest run with itself", () => {
    const { response } = buildSwellOutlook(input({ now: new Date("2026-09-26T15:00:00.000Z") }));
    expect(response.swells[0]).toMatchObject({ tier: "on_the_radar", change: "new" });
  });

  it("groups overlapping trains across all beaches without live rows or a flat interval", () => {
    const pulses = [HOME, SECOND, THIRD].flatMap((beachId) => [
      pulse(beachId, { periodS: 16, directionDeg: 285, eventKey: `${beachId}:WNW:later:p`, peakAt: localIso(4, 12), fadeAt: localIso(5, 12) }),
      pulse(beachId, { periodS: 12, fadeAt: localIso(5, 12) }),
    ]);
    const { response } = buildSwellOutlook(input({ pulseSnapshots: pulses }));
    expect(response.swells.map((swell) => [swell.periodS, swell.beachCount, swell.peakAt])).toEqual([
      [12, 3, localIso(3, 12)], [16, 3, localIso(4, 12)],
    ]);
    expect(new Set(response.swells.map((swell) => swell.id)).size).toBe(2);
  });

  it("lists all swells without a cap", () => {
    const pulses = [8, 6, 4, 2, 0].map((day) => pulse(HOME, {
      eventKey: `${HOME}:W:${day}:p`, arrivalAt: localIso(day, 9), peakAt: localIso(day, 12), fadeAt: localIso(day + 1, 12),
    }));
    const { response } = buildSwellOutlook(input({ pulseSnapshots: pulses }));
    expect(response.swells.map((swell) => swell.peakAt)).toEqual([0, 2, 4, 6, 8].map((day) => localIso(day, 12)));
    expect(response.swells[0].status).toBe("forecast");
  });

  it("uses the earliest member key as id even when another beach represents the swell", () => {
    const { response } = buildSwellOutlook(input({ pulseSnapshots: [
      pulse(HOME), pulse(SECOND, { peakAt: localIso(3, 9) }), pulse(THIRD),
    ] }));
    expect(response.swells[0]).toMatchObject({ id: `${SECOND}:W:2026-09-28:p`, beach: { id: HOME } });
  });

  it("preserves distinct previous ids for overlapping trains", () => {
    const first = pulse(HOME, { periodS: 12 });
    const second = pulse(HOME, { periodS: 16, directionDeg: 285, eventKey: "second-train", peakAt: localIso(4, 12) });
    const previous = buildSwellOutlook(input({ pulseSnapshots: [first, second] })).list;
    previous.swells[0].id = "previous-first";
    previous.swells[1].id = "previous-second";
    const { response } = buildSwellOutlook(input({ previous, pulseSnapshots: [second, first] }));
    expect(response.swells.map((swell) => [swell.id, swell.periodS])).toEqual([
      ["previous-first", 12], ["previous-second", 16],
    ]);
  });

  it("never assigns the same previous id to two current trains", () => {
    const previous = buildSwellOutlook(input()).list;
    previous.swells[0].periodS = null;
    const second = pulse(HOME, { eventKey: "second-train", peakAt: localIso(4, 12) });
    const { response } = buildSwellOutlook(input({ previous, pulseSnapshots: [pulse(HOME), second] }));
    expect(response.swells.map((swell) => swell.id)).toEqual([`${HOME}:W:2026-09-28:p`, "second-train"]);
  });

  it("sizes at the largest member when the home beach does not see the swell", () => {
    const { response } = buildSwellOutlook(input({ pulseSnapshots: [
      pulse(SECOND, { peakFaceHeightFt: 3 }), pulse(THIRD, { peakFaceHeightFt: 5 }),
    ] }));
    expect(response.homeBeach).toEqual({ id: HOME, name: "Home Beach" });
    expect(response.swells[0]).toMatchObject({ beach: { id: THIRD }, faceHeightFt: { min: 4.5, max: 6 }, beachCount: 2 });
  });

  it("keeps the previous id when the earliest member and representative leave the swell", () => {
    const previous = buildSwellOutlook(input()).list;
    const { response } = buildSwellOutlook(input({ previous, pulseSnapshots: [pulse(SECOND), pulse(THIRD)] }));
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0]).toMatchObject({ id: `${HOME}:W:2026-09-28:p`, beach: { id: SECOND }, beachCount: 2 });
  });

  it.each<[number, number, boolean]>([
    [315, 36 * 3_600_000, true], [225, -36 * 3_600_000, true],
    [315.01, 0, false], [270, 36 * 3_600_000 + 1, false],
  ])("links notable direction %s at peak offset %s only inside inclusive tolerances", (directionDeg, offsetMs, notable) => {
    const candidate = pulse(HOME, {
      eventKey: "notable-key", directionDeg, peakAt: new Date(Date.parse(pulse(HOME).peakAt) + offsetMs).toISOString(),
    });
    const [swell] = buildSwellOutlook(input({ notableSnapshots: [candidate] })).response.swells;
    expect(swell.notable).toBe(notable);
    expect(swell.eventKey).toBe(notable ? "notable-key" : pulse(HOME).eventKey);
  });

  it("links the closest latest notable snapshot at the representative beach", () => {
    const candidate = pulse(HOME, { eventKey: "notable-key", detectorVersion: "swell-events.v1" });
    const [swell] = buildSwellOutlook(input({ notableSnapshots: [
      pulse(SECOND, { eventKey: "other-beach" }),
      pulse(HOME, { eventKey: "further-key", peakAt: localIso(4, 12) }),
      { ...candidate, runDate: "2026-09-23", detectedAt: "2026-09-23T14:00:00.000Z", peakFaceHeightFt: 3.04, periodS: 13.6 },
      candidate,
      { ...candidate, detectedAt: "2026-09-25T14:00:00.000Z", peakFaceHeightFt: 9 },
    ] })).response.swells;
    expect(swell).toMatchObject({ eventKey: "notable-key", notable: true, faceHeightFt: { min: 3.5, max: 4.5 } });
    expect(swell.history).toEqual([
      { runDate: "2026-09-23", peakAt: localIso(3, 12), faceHeightFt: 3, periodS: 14 },
      { runDate: "2026-09-25", peakAt: localIso(3, 12), faceHeightFt: 4, periodS: 14 },
    ]);
  });

  it("does not link a notable event seen only at another member beach", () => {
    const [swell] = buildSwellOutlook(input({ notableSnapshots: [pulse(SECOND, { eventKey: "notable-key" })] })).response.swells;
    expect(swell).toMatchObject({ notable: false, eventKey: pulse(HOME).eventKey });
  });

  it.each<[number, OutlookSwell["tier"]]>([[24, "locked"], [76, "likely"], [121, "on_the_radar"]])(
    "reuses stable-run confidence at %s hours as %s", (leadHours, tier) => {
      const peakAt = new Date(NOW.getTime() + leadHours * 3_600_000).toISOString();
      const [swell] = buildSwellOutlook(input({ pulseSnapshots: [
        pulse(HOME, { peakAt }),
        pulse(HOME, { peakAt, runDate: "2026-09-24", detectedAt: "2026-09-24T14:30:00.000Z" }),
      ] })).response.swells;
      expect(swell).toMatchObject({ tier, change: "steady" });
    },
  );

  it("excludes a prior run issued less than 18 hours ago from confidence", () => {
    const [swell] = buildSwellOutlook(input({ pulseSnapshots: [
      pulse(HOME), pulse(HOME, { runDate: "2026-09-24", detectedAt: "2026-09-24T22:00:00.000Z" }),
    ] })).response.swells;
    expect(swell).toMatchObject({ tier: "on_the_radar", change: "new" });
  });

  it("shows a precise peak at exactly 120 hours and a window one millisecond later", () => {
    const peak = NOW.getTime() + 120 * 3_600_000;
    const exact = buildSwellOutlook(input({ pulseSnapshots: [pulse(HOME, { peakAt: new Date(peak).toISOString() })] }));
    const beyond = buildSwellOutlook(input({ pulseSnapshots: [pulse(HOME, { peakAt: new Date(peak + 1).toISOString() })] }));
    expect(exact.response.swells[0].peakWindow).toBeNull();
    expect(beyond.response.swells[0].peakWindow).toEqual({
      from: new Date(peak + 1 - 12 * 3_600_000).toISOString(), to: new Date(peak + 1 + 12 * 3_600_000).toISOString(),
    });
  });

  it("marks a current pulse arrived at its arrival instant", () => {
    const [swell] = buildSwellOutlook(input({ now: new Date(pulse(HOME).arrivalAt) })).response.swells;
    expect(swell.status).toBe("arrived");
  });

  it("preserves orientation uncertainty for equal heights and ignores non-finite member sizes", () => {
    const [equal] = buildSwellOutlook(input({ pulseSnapshots: [pulse(HOME), pulse(SECOND), pulse(THIRD)] })).response.swells;
    expect(equal.sizeByOrientation.westFacing).toEqual({ min: 3.5, max: 4.5 });
    const [mixed] = buildSwellOutlook(input({ pulseSnapshots: [
      pulse(HOME), pulse(SECOND, { peakFaceHeightFt: Number.NaN }), pulse(THIRD, { peakFaceHeightFt: Number.POSITIVE_INFINITY }),
    ] })).response.swells;
    expect(mixed.sizeByOrientation.westFacing).toEqual({ min: 3.5, max: 4.5 });
    expect(mixed.beachCount).toBe(3);
  });

  it("passes sticky faded and arrived lifecycles through and does not mutate input", () => {
    const previous = buildSwellOutlook(input()).list;
    const before = JSON.stringify(previous);
    const faded = buildSwellOutlook(input({ previous, pulseSnapshots: [] })).list;
    expect(faded.swells).toEqual([{ ...previous.swells[0], status: "faded", change: "downgraded" }]);
    expect(buildSwellOutlook(input({ previous: faded, pulseSnapshots: [] })).response.swells).toEqual([]);
    const arrived = buildSwellOutlook(input({ previous, pulseSnapshots: [], now: new Date(Date.parse(previous.swells[0].peakAt) + 6 * 3_600_000) }));
    expect(arrived.response.swells).toEqual([{ ...previous.swells[0], status: "arrived", change: "steady" }]);
    expect(JSON.stringify(previous)).toBe(before);
  });

  it.each<[boolean, string]>([[true, "available-member-key"], [false, "reserved-key:2"]])(
    "reserves a unique fallback when a carried id collides and another member is available: %s", (hasOtherMember, expectedId) => {
      const carriedPulse = pulse(HOME, { eventKey: "carried-pulse", periodS: 16, peakOffshoreHeightFt: 8 });
      const collidingPulse = pulse(HOME, { eventKey: "reserved-key", periodS: 12, peakAt: localIso(4, 12) });
      const otherMember = pulse(SECOND, { eventKey: "available-member-key", periodS: 12, peakAt: localIso(4, 15) });
      const previous = buildSwellOutlook(input({ pulseSnapshots: [carriedPulse] })).list;
      previous.swells[0].id = "reserved-key";
      const args = input({ previous, pulseSnapshots: [collidingPulse, carriedPulse, ...(hasOtherMember ? [otherMember] : [])] });
      const { response, list } = buildSwellOutlook(args);
      expect(response.swells.map((swell) => [swell.id, swell.periodS])).toEqual([
        ["reserved-key", 16], [expectedId, 12],
      ]);
      expect(new Set(response.swells.map((swell) => swell.id)).size).toBe(response.swells.length);
      expect(list.swells).toEqual(response.swells);
      expect(buildSwellOutlook(args).response.swells.map((swell) => swell.id)).toEqual(response.swells.map((swell) => swell.id));
    },
  );

  it("skips reserved suffixes when every fallback member key is already used", () => {
    const first = pulse(HOME, { eventKey: "first-pulse", periodS: 16, peakOffshoreHeightFt: 8 });
    const second = pulse(THIRD, { eventKey: "second-pulse", periodS: 20, directionDeg: 180, peakOffshoreHeightFt: 7, peakAt: localIso(5, 12) });
    const fallback = pulse(HOME, { eventKey: "reserved-key", periodS: 12, peakAt: localIso(4, 12) });
    const previous = buildSwellOutlook(input({ pulseSnapshots: [first, second] })).list;
    previous.swells[0].id = "reserved-key";
    previous.swells[1].id = "reserved-key:2";
    const args = input({ previous, pulseSnapshots: [fallback, second, first] });
    const { response } = buildSwellOutlook(args);
    expect(response.swells.map((swell) => swell.id)).toEqual(["reserved-key", "reserved-key:3", "reserved-key:2"]);
    expect(buildSwellOutlook(args).response.swells.map((swell) => swell.id)).toEqual(response.swells.map((swell) => swell.id));
  });

  it("keeps pulse history when only a stale notable snapshot matches", () => {
    const current = pulse(HOME, { peakFaceHeightFt: 4.04, periodS: 13.6 });
    const older = pulse(HOME, { runDate: "2026-09-24", detectedAt: "2026-09-24T14:30:00.000Z", peakFaceHeightFt: 3.04, peakOffshoreHeightFt: 2.4, periodS: 12.4 });
    const notable = pulse(HOME, { eventKey: "notable-link", detectorVersion: "swell-events.v1", peakFaceHeightFt: 9, periodS: 18 });
    const [swell] = buildSwellOutlook(input({
      pulseSnapshots: [current, pulse(SECOND, { peakFaceHeightFt: 7 }), older, { ...current, detectedAt: "2026-09-25T14:00:00.000Z", peakFaceHeightFt: 6 }],
      notableSnapshots: [{ ...notable, runDate: "2026-09-23", detectedAt: "2026-09-23T14:30:00.000Z" }],
    })).response.swells;
    expect(swell).toMatchObject({ notable: false, eventKey: current.eventKey, faceHeightFt: { min: 3.5, max: 4.5 }, periodS: 14, change: "upgraded" });
    expect(swell.history).toEqual([
      { runDate: "2026-09-24", peakAt: older.peakAt, faceHeightFt: 3, periodS: 12 },
      { runDate: "2026-09-25", peakAt: current.peakAt, faceHeightFt: 4, periodS: 14 },
    ]);
    expect(swell.history[swell.history.length - 1]).toEqual({
      runDate: "2026-09-25", peakAt: swell.peakAt, faceHeightFt: 4, periodS: swell.periodS,
    });
  });

  it("uses the relation home beach consistently when homeBeachId is null", () => {
    const { response } = buildSwellOutlook(input({ homeBeachId: null }));
    expect(response.homeBeach).toEqual({ id: HOME, name: "Home Beach" });
    expect(response.swells[0]).toMatchObject({ beach: response.homeBeach, faceHeightFt: { min: 3.5, max: 4.5 } });
  });

  it("prefers an explicit home beach id over another row's home relation consistently", () => {
    const { response } = buildSwellOutlook(input({ homeBeachId: THIRD }));
    expect(response.homeBeach).toEqual({ id: THIRD, name: "Third" });
    expect(response.swells[0]).toMatchObject({ beach: response.homeBeach, faceHeightFt: { min: 4.5, max: 6 } });
  });

});

describe("resolveOutlookRunDate", () => {
  it("is the newest snapshot run, else today's UTC date", () => {
    expect(resolveOutlookRunDate([pulse(HOME, { runDate: "2026-09-23" }), pulse(HOME, { runDate: "2026-09-24" })], NOW)).toBe("2026-09-24");
    expect(resolveOutlookRunDate([], NOW)).toBe("2026-09-25");
  });
});

describe("two-pass swell ids", () => {
  const originalGroupEvents: typeof tracking.groupEvents = jest.requireActual("@/lib/services/discovery/swell-tracking").groupEvents;
  beforeEach(() => jest.mocked(tracking.groupEvents).mockImplementation(originalGroupEvents));
  afterEach(() => jest.mocked(tracking.groupEvents).mockImplementation(originalGroupEvents));

  it.each([false, true])("reserves a carried id before fallbacks regardless of group order reversed = %s", (reverseGroups) => {
    const carried = pulse(HOME, { eventKey: "carry-source", periodS: 16, peakOffshoreHeightFt: 3 });
    const fallback = pulse(HOME, { eventKey: "reserved-key", periodS: 12, peakOffshoreHeightFt: 8, peakAt: localIso(4, 12) });
    const previous = buildSwellOutlook(input({ pulseSnapshots: [carried] })).list;
    previous.swells[0].id = "reserved-key";
    jest.mocked(tracking.groupEvents).mockImplementation((events) => {
      const groups = originalGroupEvents(events);
      return reverseGroups ? groups.reverse() : groups;
    });
    const swells = buildSwellOutlook(input({ previous, pulseSnapshots: [fallback, carried] })).response.swells;
    expect(swells.map(({ id, periodS }) => [id, periodS])).toEqual([
      ["reserved-key", 16], ["reserved-key:2", 12],
    ]);
  });

  it("does not reuse an unmatched previous id for a new swell", () => {
    const previous = buildSwellOutlook(input({ pulseSnapshots: [pulse(HOME)] })).list;
    previous.swells[0].id = "reserved-key";
    const newcomer = pulse(HOME, { eventKey: "reserved-key", directionDeg: 180, periodS: 20, peakAt: localIso(7, 12) });
    const swells = buildSwellOutlook(input({ previous, pulseSnapshots: [newcomer] })).response.swells;
    expect(swells.map(({ id, periodS }) => [id, periodS])).toEqual([
      ["reserved-key", 14], ["reserved-key:2", 20],
    ]);
  });

  it("gives the closest group the previous id, independent of energy, snapshot and group order", () => {
    const close = pulse(HOME, { eventKey: "close", peakAt: localIso(3, 12), peakOffshoreHeightFt: 3 });
    const further = pulse(HOME, { eventKey: "further", peakAt: localIso(4, 12), peakOffshoreHeightFt: 8 });
    const previous = buildSwellOutlook(input({ pulseSnapshots: [close] })).list;
    previous.swells[0].id = "previous-id";
    const forward = buildSwellOutlook(input({ previous, pulseSnapshots: [further, close] })).response.swells;
    const backward = buildSwellOutlook(input({ previous, pulseSnapshots: [close, further] })).response.swells;
    expect(forward.map(({ eventKey, id }) => [eventKey, id])).toEqual([["close", "previous-id"], ["further", "further"]]);
    expect(backward.map(({ eventKey, id }) => [eventKey, id])).toEqual(forward.map(({ eventKey, id }) => [eventKey, id]));
  });

  it("breaks equal-distance carry ties deterministically across both input orders", () => {
    const early = pulse(HOME, { eventKey: "a-early", peakAt: localIso(3, 12) });
    const late = pulse(HOME, { eventKey: "b-late", peakAt: localIso(4, 12) });
    const previous = buildSwellOutlook(input({ pulseSnapshots: [pulse(HOME, { peakAt: localIso(4, 0) })] })).list;
    previous.swells[0].id = "previous-id";
    const forward = buildSwellOutlook(input({ previous, pulseSnapshots: [early, late] })).response.swells;
    const backward = buildSwellOutlook(input({ previous, pulseSnapshots: [late, early] })).response.swells;
    expect(forward.map(({ eventKey, id }) => [eventKey, id])).toEqual([["a-early", "previous-id"], ["b-late", "b-late"]]);
    expect(backward.map(({ eventKey, id }) => [eventKey, id])).toEqual(forward.map(({ eventKey, id }) => [eventKey, id]));
  });
});
