import type { RatingRow, RegionBuild } from "@/lib/alerts/swell-events/regional";
import type { RegionalSwellEvent } from "../week-scout-story-candidates";
import { beachDayFactsFromBuild, beachFeel, breakerCharacter, eventFactsFromBuild, faceRangeFt, median, sizeWordsFor, windHoursFor } from "../week-scout-story-facts";

const event: RegionalSwellEvent = { regionalKey: "west", kind: "swell", directionDeg: 270, periodS: 13,
  arrivalAt: "2026-10-29T16:00:00Z", peakAt: "2026-10-29T20:00:00Z", fadeAt: "2026-10-30T18:00:00Z",
  timezone: "America/Los_Angeles", confidence: "locked", minimumBeaches: 3 };
function row(wave_height: string, forecast_at = "2026-10-29T20:00:00Z", wind_direction: string | null = "E"): RatingRow {
  return { wave_height, forecast_at, wind_direction, wind_speed: "4 mph", wave_period: "13 s", tide_height: null, tide_status: null, swell_1_period: null };
}
function build(): RegionBuild {
  const heights = ["2-3", "3-4", "3-4", "4-5", "5-6", "6-8"];
  return { region: "coast", timezone: event.timezone, buoy: null, wamDays: null, events: [],
    beaches: heights.map((_, index) => ({ id: String(index), name: `Beach ${index}`, lat: 33, lon: -117,
      swell_window_center_deg: index === 5 ? 90 : 270, swell_window_halfwidth_deg: 20,
      aspect_deg: 270, wind_offshore_deg: 90, wind_offshore_tol_deg: 30, punchiness: 0.3 })),
    rowsByBeach: Object.fromEntries(heights.map((height, index) => [String(index), [row(height), row("1-2"),
      row("20-25", "2026-10-29T15:00:00Z"), row("10-12", "2026-10-30T17:00:00Z")]])) };
}

describe("candidate surf facts", () => {
  it("calculates the median", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("rounds the face range to whole feet", () => {
    expect(faceRangeFt(["2.6-3.8 ft", "3-4 ft"])).toEqual({ min: 3, max: 4 });
    expect(faceRangeFt([null])).toBeNull();
  });
  it("licenses every size bucket the range overlaps, and only those", () => {
    expect([[2, 4], [3, 4], [4, 5], [4, 6], [3, 3], [12, 15]].map(([min, max]) => sizeWordsFor({ min, max })))
      .toEqual([["waist", "chest"], ["chest"], ["chest", "shoulder"], ["chest", "shoulder", "head"], ["chest"], ["double overhead"]]);
    expect(sizeWordsFor(null)).toEqual([]);
  });
  it("calls 13 s swells pitching, storms and sub-10 s crumbly, and mid-period neither", () => {
    expect([breakerCharacter("swell", 15), breakerCharacter("swell", 13), breakerCharacter("swell", 11),
      breakerCharacter("storm", 14), breakerCharacter("swell", 8), breakerCharacter("swell", null)])
      .toEqual(["pitching", "pitching", null, "crumbly", "crumbly", null]);
  });
  it("reads punchy only for a pitching swell at a punchy beach", () => {
    expect([beachFeel("pitching", 0.3), beachFeel("pitching", -0.3), beachFeel("crumbly", 0.3),
      beachFeel("pitching", 0), beachFeel(null, 0.5), beachFeel("pitching", null)])
      .toEqual(["punchy", "soft", "soft", null, null, null]);
  });
  it("classifies each hour's wind against the beach's offshore bearing", () => {
    const rows = ["E", "W", "S", null].map((direction, i) => row("3-4", `2026-10-29T${15 + i}:00:00Z`, direction));
    expect(windHoursFor(rows, { wind_offshore_deg: 90 }, event.timezone)).toEqual([
      { hour: 8, relation: "offshore", mph: 4 }, { hour: 9, relation: "onshore", mph: 4 },
      { hour: 10, relation: "cross", mph: 4 }, { hour: 11, relation: null, mph: 4 },
    ]);
    expect(windHoursFor(rows.slice(0, 1), {}, event.timezone)[0].relation).toBeNull();
    expect(windHoursFor([row("3-4", event.peakAt, "120")], { aspect_deg: 270, wind_offshore_tol_deg: 30 }, event.timezone)[0].relation).toBe("offshore");
  });
  it("sizes an event from its reached beaches on the peak day, standouts only when bigger", () => {
    const built = build();
    expect(eventFactsFromBuild(built, event)).toEqual({ faceFt: { min: 3, max: 4 }, sizes: ["chest"],
      standoutFt: { min: 4, max: 6 }, standoutSizes: ["chest", "shoulder", "head"],
      breaker: { character: "pitching", feel: null, closingOut: false } });
    built.rowsByBeach = Object.fromEntries(built.beaches.map((beach) => [beach.id, [row("3-4")]]));
    expect(eventFactsFromBuild(built, event)).not.toHaveProperty("standoutFt");
    built.beaches = built.beaches.slice(0, 2);
    expect(eventFactsFromBuild(built, event)).toBeNull();
  });
  it("gives a beach-day its own face, hourly wind and feel", () => {
    const built = build();
    expect(beachDayFactsFromBuild(built, event, "4", "2026-10-29")).toEqual({ faceFt: { min: 1, max: 6 },
      sizes: ["knee", "waist", "chest", "shoulder", "head"], windHours: [
        { hour: 13, relation: "offshore", mph: 4 }, { hour: 13, relation: "offshore", mph: 4 }],
      breaker: { character: "pitching", feel: "punchy", closingOut: false } });
    expect(beachDayFactsFromBuild(built, event, "4", "2026-10-30")?.breaker?.closingOut).toBe(true);
    expect(beachDayFactsFromBuild(built, event, "5", "2026-10-30")?.breaker?.closingOut).toBe(false);
    expect(beachDayFactsFromBuild(built, event, "4", "2026-10-31")).toBeNull();
  });
});
