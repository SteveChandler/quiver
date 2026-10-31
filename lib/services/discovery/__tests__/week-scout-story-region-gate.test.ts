jest.mock("@/lib/alerts/swell-events/regional", () => ({ loadRegionForecastEvents: jest.fn() }));

import type { InternalRegionEvent, RatingRow, RegionBeach, RegionBuild } from "@/lib/alerts/swell-events/regional";
import { addDays } from "../swell-briefing-input";
import { beachLine, buildStoryCandidates, storyEventKey, type RegionalDaySignal } from "../week-scout-story-candidates";
import {
  BREEZY_WIND_MPH, DEAD_ON_MAX_DEG, DEAD_ON_WINDOW_SHARE, LIGHT_WIND_MPH, buildRegionGateContext, regionGateHolds,
} from "../week-scout-story-region-gate";
import { storyEventsFromRegion } from "../week-scout-story-source";
import type { StoryCandidate, StoryGate } from "../week-scout-story-types";

const TIMEZONE = "America/Los_Angeles";
const EDITION = "2026-10-27";
// SSW (202°): Ocean Beach and Sunset Cliffs open, Blacks and La Jolla Shores shadowed.
// W (270°): Blacks open, La Jolla Shores partial, Ocean Beach and Sunset Cliffs shadowed.
const BEACHES: RegionBeach[] = [
  { id: "a", name: "Ocean Beach", lat: 32.5, lon: -117.5, aspect_deg: null, wind_offshore_deg: null, wind_offshore_tol_deg: null, punchiness: null, swell_window_center_deg: 202, swell_window_halfwidth_deg: 25 },
  { id: "b", name: "Blacks", lat: 32.7, lon: -117.3, aspect_deg: null, wind_offshore_deg: null, wind_offshore_tol_deg: null, punchiness: null, swell_window_center_deg: 270, swell_window_halfwidth_deg: 20 },
  { id: "c", name: "La Jolla Shores", lat: 32.9, lon: -117.1, aspect_deg: null, wind_offshore_deg: null, wind_offshore_tol_deg: null, punchiness: null, swell_window_center_deg: 240, swell_window_halfwidth_deg: 20 },
  { id: "d", name: "Sunset Cliffs", lat: 32.6, lon: -117.4, aspect_deg: null, wind_offshore_deg: null, wind_offshore_tol_deg: null, punchiness: null, swell_window_center_deg: 210, swell_window_halfwidth_deg: 20 },
];

function regionEvent(key: string, directionDeg: number, periodS: number, arrivalAt: string, peakAt: string, fadeAt: string | null,
  overrides: Partial<InternalRegionEvent> = {}): InternalRegionEvent {
  return {
    key, kind: "swell", source: "forecast", directionDeg, directionLabel: "X", periodS, arrivalAt, peakAt, fadeAt,
    peakLocalDate: new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(peakAt)),
    offshoreFt: "5 ft", history: null, memberCount: 4, ...overrides,
  };
}

function row(forecastAt: string, windSpeed: string | null): RatingRow {
  return { forecast_at: forecastAt, wave_height: "3-4 ft", wave_period: "13", wind_speed: windSpeed, wind_direction: null,
    tide_height: null, tide_status: null, swell_1_period: null };
}

// Wednesday-to-Friday SSW groundswell peaking Thursday, and a Sunday W storm the chart's default detector never runs for.
const ssw = regionEvent("San Diego:SSW:2026-10-29", 202, 13.4, "2026-10-28T15:00:00Z", "2026-10-29T20:00:00Z", "2026-10-30T20:00:00Z");
const storm = regionEvent("San Diego:W:2026-11-01:s", 270, 7, "2026-10-31T15:00:00Z", "2026-11-01T19:00:00Z", "2026-11-02T19:00:00Z",
  { kind: "storm", directionLabel: "W", memberCount: 5 });
// Ocean Beach: light wind in the SSW window, a windy afternoon in the storm's window.
const ROWS: Record<string, RatingRow[]> = {
  a: [row("2026-10-28T18:00:00Z", "4 mph"), row("2026-10-29T18:00:00Z", "6 mph"), row("2026-11-01T20:00:00Z", "25 mph")],
};

function regionBuild(events: InternalRegionEvent[], overrides: Partial<RegionBuild> = {}): RegionBuild {
  return { region: "San Diego", timezone: TIMEZONE, buoy: null, wamDays: null, beaches: BEACHES, rowsByBeach: ROWS, events, ...overrides };
}

function signals(): RegionalDaySignal[] {
  return Array.from({ length: 7 }, (_, index) => ({
    localDate: addDays(EDITION, index), complete: true, sampleBeaches: 4, meanHeightFt: 3,
    directionDeg: 202, periodS: 13, sourceSeries: "enhanced_forecasts:San Diego", forecastRevision: "2026-10-27T12:00:00Z",
    ...(index === 2 ? { exposedBeaches: { "4-4-2026-10-29": [
      { beachId: "a", beachName: "Ocean Beach", exposure: "open" as const, qualityScore: 70 },
      { beachId: "d", beachName: "Sunset Cliffs", exposure: "open" as const, qualityScore: 60 },
      { beachId: "b", beachName: "Blacks", exposure: "shadowed" as const, qualityScore: 50 },
    ] } } : {}),
  }));
}

/** The candidates the story builds from this region build, so every gate under test is one the story really writes. */
function storyFacts(build: RegionBuild): StoryCandidate[] {
  return buildStoryCandidates(signals(), "San Diego", storyEventsFromRegion(build, EDITION).week);
}

function gateOf(facts: StoryCandidate[], id: string): StoryGate {
  const fact = facts.find((item) => item.id === id);
  if (!fact) throw new Error(`no candidate ${id}`);
  return fact.gate;
}

describe("regional story gate", () => {
  const facts = storyFacts(regionBuild([ssw, storm]));

  it("recomputes event and beach-day facts from the build", () => {
    const built = regionBuild([ssw], { beaches: BEACHES.map((beach) => ({ ...beach, swell_window_center_deg: 202 })),
      rowsByBeach: Object.fromEntries(BEACHES.map((beach) => [beach.id, [row("2026-10-29T18:00:00Z", "4 mph"), row("2026-10-28T18:00:00Z", "30 mph")]])) });
    const key = "4-4-2026-10-29";
    const context = buildRegionGateContext(built, EDITION);
    expect(context.eventFacts(key)?.faceFt).toEqual({ min: 3, max: 4 });
    expect(context.beachDayFacts(key, "a", "2026-10-29")?.windHours).toEqual([{ hour: 11, mph: 4, relation: null }]);
    expect(context.eventFacts(key)).toBe(context.eventFacts(key));
    expect(context.beachDayFacts(key, "a", "2026-10-29")).toBe(context.beachDayFacts(key, "a", "2026-10-29"));
    expect(context.wind(key, "a", "2026-10-29")).toBe("light");
    expect(context.wind(key, "a", "2026-10-28")).toBe("windy");
    expect(context.eventFacts("missing")).toBeNull();
    expect(context.beachDayFacts(key, "a", "2026-10-31")).toBeNull();
    built.rowsByBeach.a.push(row("not a timestamp", "30 mph"));
    expect(context.wind(key, "a", "2026-10-29")).toBe("light");
    built.rowsByBeach.a = [{ ...row("2026-10-29T18:00:00Z", "4 mph"), wave_height: "6-8" }];
    expect(buildRegionGateContext(built, EDITION).beachDayFacts(key, "a", "2026-10-29")?.faceFt).toEqual({ min: 6, max: 8 });
  });

  it("holds a swell gate while the region build still has the event on the same days", () => {
    const context = buildRegionGateContext(regionBuild([ssw, storm]), EDITION);
    const swellGates = facts.filter((fact) => fact.gate.kind === "swell").map((fact) => fact.gate);
    expect(swellGates.length).toBeGreaterThanOrEqual(8);
    expect(swellGates.map((gate) => regionGateHolds(gate, context))).toEqual(swellGates.map(() => true));

    // A later cached build of the same swell: a different response key, the same story key and days.
    const rebuilt = buildRegionGateContext(regionBuild([{ ...ssw, key: "San Diego:SSW:2026-10-29.2" }, storm]), EDITION);
    const chapter = gateOf(facts, "swell-4-4-2026-10-29");
    expect(chapter).toMatchObject({ arrivalLocalDate: "2026-10-28", peakLocalDate: "2026-10-29", fadeLocalDate: "2026-10-30",
      confidence: "locked", minimumBeaches: 3 });
    expect(regionGateHolds(chapter, rebuilt)).toBe(true);

    // Fewer beaches behind it, a lower confidence tier, or a compass point the words no longer name: the claim fails.
    expect(regionGateHolds(chapter, buildRegionGateContext(regionBuild([{ ...ssw, memberCount: 2 }, storm]), EDITION))).toBe(false);
    expect(regionGateHolds(chapter, buildRegionGateContext(regionBuild([ssw, storm]), "2026-10-23"))).toBe(false);
    // 190° stays in the SSW-sector key but reads "south", not "south-southwest".
    expect(regionGateHolds(chapter, buildRegionGateContext(regionBuild([{ ...ssw, directionDeg: 190 }, storm]), EDITION))).toBe(false);
  });

  it("fails a swell gate when the peak moved a day", () => {
    const cover = gateOf(facts, "cover-pulse-4-4-2026-10-29");
    const chapter = gateOf(facts, "swell-4-4-2026-10-29");
    const moved = buildRegionGateContext(regionBuild([
      { ...ssw, peakAt: "2026-10-30T16:00:00Z", peakLocalDate: "2026-10-30", fadeAt: "2026-10-31T16:00:00Z" }, storm]), EDITION);
    expect(regionGateHolds(cover, moved)).toBe(false);
    expect(regionGateHolds(chapter, moved)).toBe(false);
    // Same peak, but it now arrives a day earlier.
    const early = buildRegionGateContext(regionBuild([{ ...ssw, arrivalAt: "2026-10-27T15:00:00Z" }, storm]), EDITION);
    expect(regionGateHolds(cover, early)).toBe(false);
    // A later fade breaks only the sentence that names the fade; the cover names none.
    const lateFade = buildRegionGateContext(regionBuild([{ ...ssw, fadeAt: "2026-10-31T20:00:00Z" }, storm]), EDITION);
    expect(regionGateHolds(cover, lateFade)).toBe(true);
    expect(regionGateHolds(chapter, lateFade)).toBe(false);
  });

  it("holds a storm gate the chart's default detector never sees", () => {
    const [, stormEvent] = storyEventsFromRegion(regionBuild([ssw, storm]), EDITION).week;
    expect(stormEvent.kind).toBe("storm");
    const key = storyEventKey(stormEvent);
    expect(key).toBe("6-2-2026-11-01-s");
    const context = buildRegionGateContext(regionBuild([ssw, storm]), EDITION);
    const cover = gateOf(facts, `cover-pulse-${key}`);
    expect(cover).toMatchObject({ kind: "swell", regionalEventKey: key, confidence: "likely", minimumBeaches: 3 });
    expect(regionGateHolds(cover, context)).toBe(true);
    expect(regionGateHolds(gateOf(facts, `swell-${key}`), context)).toBe(true);
    // A swell's key for the same sector, band and day never proves the storm.
    expect(regionGateHolds({ ...cover, regionalEventKey: "6-2-2026-11-01" } as StoryGate, context)).toBe(false);
  });

  it("holds an exposure gate only while every named beach's exposure is unchanged", () => {
    const context = buildRegionGateContext(regionBuild([ssw, storm]), EDITION);
    const exposure = gateOf(facts, "exposure-4-4-2026-10-29");
    expect(exposure).toMatchObject({ kind: "exposure", exposure: "open", minimumBeaches: 2,
      beaches: [{ beachId: "a", exposure: "open" }, { beachId: "d", exposure: "open" }, { beachId: "b", exposure: "shadowed" }] });
    expect(regionGateHolds(exposure, context)).toBe(true);
    const turned = BEACHES.map((beach) => (beach.id === "d" ? { ...beach, swell_window_center_deg: 260 } : beach));
    expect(regionGateHolds(exposure, buildRegionGateContext(regionBuild([ssw, storm], { beaches: turned }), EDITION))).toBe(false);
    // A gate that names no beaches proves nothing about the beaches its sentence names.
    expect(regionGateHolds({ ...exposure, beaches: undefined } as StoryGate, context)).toBe(false);
    // Its swell gone from the build, the exposure claim goes with it.
    expect(regionGateHolds(exposure, buildRegionGateContext(regionBuild([storm]), EDITION))).toBe(false);
  });

  it("fails a beach gate when that beach's exposure or wind bucket changed", () => {
    const context = buildRegionGateContext(regionBuild([ssw, storm]), EDITION);
    const key = "4-4-2026-10-29";
    // The 25 mph storm-window row is Ocean Beach's too, but outside this swell's window.
    expect(context.exposure(key, "a")).toBe("open");
    expect(context.wind(key, "a", "2026-10-29")).toBe("light");
    expect(context.exposure("6-2-2026-11-01-s", "c")).toBe("partial");
    expect(context.wind("6-2-2026-11-01-s", "a", "2026-11-01")).toBe("windy");
    expect(context.wind(key, "b", "2026-10-29")).toBeNull();
    expect(context.exposure("1-1-2026-10-29", "a")).toBeNull();
    expect(context.facing(key, "a")).toBe("direct");
    expect(context.facing("6-2-2026-11-01-s", "c")).toBeNull();
    const gate: StoryGate = { kind: "beach", localDate: "2026-10-29", regionalEventKey: key, beachId: "a", directionIndex: 9, periodClass: "long",
      exposure: "open", facing: "direct", wind: "light" };
    expect(regionGateHolds(gate, context)).toBe(true);

    const turned = BEACHES.map((beach) => (beach.id === "a" ? { ...beach, swell_window_center_deg: 270 } : beach));
    const shadowed = buildRegionGateContext(regionBuild([ssw, storm], { beaches: turned }), EDITION);
    expect(shadowed.exposure(key, "a")).toBe("shadowed");
    expect(regionGateHolds(gate, shadowed)).toBe(false);

    const withWind = (speeds: Array<string | null>) => buildRegionGateContext(regionBuild([ssw, storm], { rowsByBeach: {
      a: speeds.map((speed, index) => row(`2026-10-29T${String(15 + index).padStart(2, "0")}:00:00Z`, speed)) } }), EDITION);
    // Under 8 mph light, under 15 breezy, otherwise windy; rows without a wind speed don't count.
    expect([LIGHT_WIND_MPH, BREEZY_WIND_MPH]).toEqual([8, 15]);
    expect(withWind(["6 mph", "9 mph"]).wind(key, "a", "2026-10-29")).toBe("light");
    expect(withWind(["7 mph", "9 mph"]).wind(key, "a", "2026-10-29")).toBe("breezy");
    expect(withWind(["14 mph", null]).wind(key, "a", "2026-10-29")).toBe("breezy");
    expect(withWind(["15 mph"]).wind(key, "a", "2026-10-29")).toBe("windy");
    expect(withWind([null]).wind(key, "a", "2026-10-29")).toBeNull();
    expect(regionGateHolds(gate, withWind(["10 mph", "14 mph"]))).toBe(false);
    expect(regionGateHolds(gate, withWind([]))).toBe(false);

    // Still open, but the swell now meets it at an angle.
    const angled = BEACHES.map((beach) => (beach.id === "a" ? { ...beach, swell_window_center_deg: 232 } : beach));
    const turnedAway = buildRegionGateContext(regionBuild([ssw, storm], { beaches: angled }), EDITION);
    expect(turnedAway.exposure(key, "a")).toBe("open");
    expect(turnedAway.facing(key, "a")).toBe("angled");
    expect(regionGateHolds(gate, turnedAway)).toBe(false);
    // A malformed stored gate without a direction fails closed.
    expect(regionGateHolds({ ...gate, directionIndex: undefined } as unknown as StoryGate, context)).toBe(false);
  });

  it("calls an open beach dead on within the narrower of 22.5 degrees and half its window", () => {
    expect([DEAD_ON_MAX_DEG, DEAD_ON_WINDOW_SHARE]).toEqual([22.5, 0.5]);
    const facingAt = (directionDeg: number, halfWidthDeg: number) => {
      const beaches = [{ ...BEACHES[0], swell_window_center_deg: 200, swell_window_halfwidth_deg: halfWidthDeg }];
      const event = regionEvent("San Diego:X", directionDeg, 14, "2026-10-28T15:00:00Z", "2026-10-29T20:00:00Z", null);
      const build = regionBuild([event], { beaches });
      return buildRegionGateContext(build, EDITION).facing(storyEventKey(storyEventsFromRegion(build, EDITION).all[0]), "a");
    };
    expect([facingAt(212, 25), facingAt(213, 25)]).toEqual(["direct", "angled"]);
    // San Diego's windows run a median 105 degrees either side of centre: 22.5 caps "dead on".
    expect([facingAt(222, 105), facingAt(223, 105), facingAt(300, 105)]).toEqual(["direct", "angled", "angled"]);
  });

  it("fails a beach gate when its event's 16-point direction or period class moved inside the same key", () => {
    // 259 and 257 degrees are both sector 6 (one key) but west and west-southwest; 13.1 s and 12.9 s are band 4, long and mid.
    const beaches = [{ ...BEACHES[1], swell_window_halfwidth_deg: 60 }];
    const west = (directionDeg: number, periodS: number) => regionBuild([regionEvent("San Diego:W:2026-10-29", directionDeg, periodS,
      "2026-10-28T15:00:00Z", "2026-10-29T20:00:00Z", "2026-10-30T20:00:00Z")], { beaches, rowsByBeach: { b: [row("2026-10-29T18:00:00Z", "4 mph")] } });
    const built = west(259, 13.1);
    const [event] = storyEventsFromRegion(built, EDITION).all;
    const line = beachLine(event, "b", buildRegionGateContext(built, EDITION))!;
    expect(line.text).toBe("Faces the west groundswell dead on: chest-high, with light wind in its window.");
    expect(line.gate).toEqual({ kind: "beach", localDate: "2026-10-29", regionalEventKey: storyEventKey(event), beachId: "b", directionIndex: 12,
      periodClass: "long", exposure: "open", facing: "direct", wind: "light" });
    expect(regionGateHolds(line.gate, buildRegionGateContext(built, EDITION))).toBe(true);
    for (const moved of [west(257, 13.1), west(259, 12.9)]) {
      expect(storyEventKey(storyEventsFromRegion(moved, EDITION).all[0])).toBe(line.gate.regionalEventKey);
      expect(regionGateHolds(line.gate, buildRegionGateContext(moved, EDITION))).toBe(false);
    }
  });

  it("fails a quiet week the region build has an event in, and leaves the rest to the live check", () => {
    const week = Array.from({ length: 7 }, (_, index) => addDays(EDITION, index));
    const quiet: StoryGate = { kind: "quiet", fromDate: week[0], toDate: week[6], completeDates: week };
    // The Sunday storm alone, which the chart's detector never sees, is enough to refuse a quiet week.
    expect(regionGateHolds(quiet, buildRegionGateContext(regionBuild([storm]), EDITION))).toBe(false);
    expect(regionGateHolds(quiet, buildRegionGateContext(regionBuild([ssw, storm]), EDITION))).toBe(false);
    // Arriving on the week's last day counts; an event wholly after the week does not.
    const lateArrival = regionEvent("San Diego:W:2026-11-03", 270, 15, "2026-11-02T18:00:00Z", "2026-11-03T20:00:00Z", null);
    expect(regionGateHolds(quiet, buildRegionGateContext(regionBuild([lateArrival]), EDITION))).toBe(false);
    const nextWeek = regionEvent("San Diego:W:2026-11-05", 270, 15, "2026-11-04T18:00:00Z", "2026-11-05T20:00:00Z", null);
    expect(regionGateHolds(quiet, buildRegionGateContext(regionBuild([nextWeek]), EDITION))).toBeNull();
    expect(regionGateHolds(quiet, buildRegionGateContext(regionBuild([]), EDITION))).toBeNull();
  });

  it("returns null for wind, tide, change, quiet and day gates", () => {
    const context = buildRegionGateContext(regionBuild([ssw, storm]), EDITION);
    const wind = { kind: "wind" as const, localDate: "2026-10-28", bucket: "midday" as const, fromWindClass: "offshore" as const,
      windClass: "onshore" as const, forecastRevision: "rev" };
    const unowned: StoryGate[] = [
      wind,
      { kind: "wind_pattern", days: [wind, wind, wind] },
      { kind: "tide", localDate: "2026-10-28", bucket: "morning", tidePhase: "rising", windowOrder: "opens", forecastRevision: "rev" },
      { kind: "change", fromDate: "2026-10-28", toDate: "2026-10-29", direction: "better", minimumScoreChange: 15, sourceSeries: "s" },
      { kind: "quiet", fromDate: "2026-10-27", toDate: "2026-11-02", completeDates: ["2026-10-27"] },
      { kind: "day", localDate: "2026-10-28", bucket: "morning", reason: "light_wind" },
      { kind: "origin", regionalEventKey: "4-4-2026-10-29", sourceAreaId: "x", sourceLat: 0, sourceLon: 0, trackRevision: "x",
        arrivalOrder: 0, confidence: "likely" },
    ];
    expect(unowned.map((gate) => regionGateHolds(gate, context))).toEqual(unowned.map(() => null));
    // The kinds it owns always get an answer, even from an empty build.
    const empty = buildRegionGateContext(regionBuild([]), EDITION);
    const owned = [gateOf(facts, "cover-pulse-4-4-2026-10-29"), gateOf(facts, "exposure-4-4-2026-10-29"),
      { kind: "beach", localDate: "2026-10-29", regionalEventKey: "4-4-2026-10-29", beachId: "a", directionIndex: 9, periodClass: "long", exposure: "open",
        facing: "direct", wind: "light" } as StoryGate];
    expect(owned.map((gate) => regionGateHolds(gate, empty))).toEqual([false, false, false]);
  });
});
