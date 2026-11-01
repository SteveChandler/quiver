jest.mock("../week-scout-story-candidates", () => {
  const actual = jest.requireActual("../week-scout-story-candidates");
  return { ...actual, buildStoryCandidates: jest.fn(actual.buildStoryCandidates) };
});
const mockActiveRegions = jest.fn();
const mockLatestInput = jest.fn();
const mockSaveInput = jest.fn();
const mockBeachSelect = jest.fn();
jest.mock("@/lib/alerts/swell-events/regional", () => ({ loadRegionForecastEvents: jest.fn() }));
jest.mock("../week-scout-story-store", () => ({
  activeStoryRegions: (...args: unknown[]) => mockActiveRegions(...args),
  loadLatestStoryInput: (...args: unknown[]) => mockLatestInput(...args),
  saveStoryInput: (...args: unknown[]) => mockSaveInput(...args),
}));

import { buildStoryInput, storyEventsFromRegion } from "../week-scout-story-source";
import { buildStoryCandidates, storyEventKey } from "../week-scout-story-candidates";
import { addDays } from "../swell-briefing-input";
import { loadRegionForecastEvents, type InternalRegionEvent, type RatingRow, type RegionBuild } from "@/lib/alerts/swell-events/regional";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const now = new Date("2026-10-27T12:00:00Z");
const TIMEZONE = "America/Los_Angeles";
const beaches = [
  { id: "a", name: "Ocean Beach", lat: 32.5, lon: -117.5, aspect_deg: 202, swell_window_center_deg: 202, swell_window_halfwidth_deg: 25, wind_offshore_deg: 90 },
  { id: "b", name: "Blacks", lat: 32.7, lon: -117.3, aspect_deg: 202, swell_window_center_deg: 202, swell_window_halfwidth_deg: 25, wind_offshore_deg: 90 },
  { id: "c", name: "La Jolla Shores", lat: 32.9, lon: -117.1, aspect_deg: 270, swell_window_center_deg: 270, swell_window_halfwidth_deg: 20, wind_offshore_deg: 90 },
];
const forecasts = (beachRows: Array<{ id: string }> = beaches): Array<Record<string, unknown>> => Array.from({ length: 7 }, (_, day) =>
  beachRows.flatMap((beach) => [12, 15].map((hour) => ({
    id: `${beach.id}-${day}-${hour}`,
    beach_id: beach.id, forecast_at: new Date(Date.UTC(2026, 9, 27 + day, hour)).toISOString(),
    wave_height: "3 ft", swell_direction_om: 202, swell_period_om: 15, confidence_score: 70,
    om_fetched_at: now.toISOString(), updated_at: now.toISOString(),
  })))).flat();

function client(rows: Array<Record<string, unknown>>, beachRows: Array<Record<string, unknown>> = beaches): SupabaseClient<Database> {
  return { rpc: () => { throw new Error("unexpected RPC"); }, from: (table: string) => {
    const query = {
      select: (columns: string) => { if (table === "beaches") mockBeachSelect(columns); return query; }, eq: () => query, is: () => query, order: () => query,
      in: () => query, gte: () => query, lt: () => query,
      range: async (start: number, end: number) => ({
        data: (table === "beaches" ? beachRows : rows).slice(start, end + 1), error: null,
      }),
    };
    return query;
  } } as unknown as SupabaseClient<Database>;
}

/** A forecast region event, in the water from arrival to fade around its peak. */
function regionEvent(key: string, directionDeg: number, periodS: number, arrivalAt: string, peakAt: string, fadeAt: string | null,
  overrides: Partial<InternalRegionEvent> = {}): InternalRegionEvent {
  return {
    key, kind: "swell", source: "forecast", directionDeg, directionLabel: "X", periodS, arrivalAt, peakAt, fadeAt,
    peakLocalDate: new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(peakAt)),
    offshoreFt: "4 ft", history: null, memberCount: 4, ...overrides,
  };
}

function regionBuild(events: InternalRegionEvent[], overrides: Partial<RegionBuild> = {}): RegionBuild {
  return { region: "San Diego", timezone: TIMEZONE, buoy: null, wamDays: null, beaches: [], rowsByBeach: {}, events, ...overrides };
}

// Day 0 (Tuesday) SSW groundswell and a day 2 (Thursday) W storm.
const ssw = regionEvent("San Diego:SSW:2026-10-27", 202, 13, "2026-10-27T08:00:00Z", "2026-10-27T20:00:00Z", "2026-10-28T20:00:00Z");
const storm = regionEvent("San Diego:W:2026-10-29:s", 270, 7, "2026-10-28T18:00:00Z", "2026-10-29T20:00:00Z", "2026-10-30T20:00:00Z",
  { kind: "storm", directionLabel: "W", memberCount: 5 });

describe("regional story source snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBeachSelect.mockReset();
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([ssw, storm]));
    mockActiveRegions.mockResolvedValue([{ region: "San Diego", timezone: TIMEZONE }]);
    mockLatestInput.mockResolvedValue(null);
  });

  it("lists each day's top four beaches with their facts", async () => {
    const spy = jest.mocked(buildStoryCandidates);
    const six = ["5", "2", "4", "1", "3", "0"].map((id) => ({ ...beaches[0], id, name: `Beach ${id}`,
      wave_punchiness_ai: 0.3, wave_punchiness_ai_confidence: 0.7, persona: "exposed_beach_break" }));
    const regionalBeaches = six.map((beach) => ({ id: beach.id, name: beach.name, lat: beach.lat, lon: beach.lon,
      aspect_deg: beach.aspect_deg, wind_offshore_deg: beach.wind_offshore_deg, wind_offshore_tol_deg: 30,
      punchiness: 0.3, swell_window_center_deg: beach.swell_window_center_deg, swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg }));
    const regionalRow = (forecast_at: string, wave_height: string): RatingRow => ({ forecast_at, wave_height, wave_period: null,
      wind_speed: "5 mph", wind_direction: "E", tide_height: null, tide_status: null, swell_1_period: "13s" });
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([ssw, storm], { beaches: regionalBeaches,
      rowsByBeach: Object.fromEntries(six.map((beach) => [beach.id, [
        regionalRow("2026-10-27T18:00:00Z", "3-4 ft"), regionalRow("2026-10-29T20:00:00Z", "7-8 ft"),
      ]])) }));
    const winds: Record<string, [number, number]> = { "0": [20, 0], "1": [3, 3], "2": [8, 8], "3": [1, 20], "4": [14, 14], "5": [18, 18] };
    const rows = forecasts(six).flatMap((row) => {
      const id = String(row.beach_id);
      const base = { ...row, wave_height: "3-4", wave_period: "13 s", wind_direction: "E" };
      // The worst daylight beach wins at night; it must still stay out of the top four.
      if (String(row.id).endsWith("-12")) return [{ ...base, wave_height: id === "5" ? "3-4" : "20-25", wind_speed: id === "5" ? "0 mph" : "30 mph" }];
      return winds[id].map((mph, hour) => ({ ...base, id: `${row.id}-${hour}`,
        forecast_at: new Date(Date.parse(String(row.forecast_at)) + hour * 60 * 60_000).toISOString(), wind_speed: `${mph} mph` }));
    });
    await buildStoryInput({ client: client(rows, six), region: "San Diego", now, persist: false });
    expect(mockBeachSelect).toHaveBeenCalledWith(expect.not.stringContaining("wave_punchiness,"));
    expect(mockBeachSelect).toHaveBeenCalledWith(expect.stringContaining("wave_punchiness_ai, wave_punchiness_ai_confidence, persona, break_type"));
    const signals = spy.mock.calls[0][0];
    expect(signals).toHaveLength(7);
    for (const day of signals) {
      // Neither source order, first-hour score nor average score produces this order.
      expect(day.surfBeaches?.map((beach) => beach.beachId)).toEqual(["0", "3", "1", "2"]);
      const firstHour = day.localDate < "2026-11-01" ? 8 : 7;
      expect(day.surfBeaches?.[0]).toMatchObject({ beachName: "Beach 0", facts: { faceFt: { min: 3, max: 4 },
        windHours: [{ hour: firstHour, relation: "offshore", mph: 20 }, { hour: firstHour + 1, relation: "offshore", mph: 0 }] } });
    }
    expect(signals[0].surfBeaches?.[0].facts.breaker).toEqual({ character: "pitching", feel: "punchy", closingOut: false });
    expect(signals[2].surfBeaches?.[0].facts.breaker?.character).toBe("crumbly");

  });

  it("uses the largest covering beach-day event for each surf-beach breaker character", async () => {
    const groundswell = regionEvent("San Diego:SSW:2026-10-27", 202, 13,
      "2026-10-27T16:00:00Z", "2026-10-27T17:00:00Z", "2026-10-27T19:00:00Z");
    const stormSwell = regionEvent("San Diego:W:2026-10-27:s", 270, 8,
      "2026-10-27T20:00:00Z", "2026-10-27T21:00:00Z", "2026-10-27T22:00:00Z",
      { kind: "storm", directionLabel: "W" });
    const beach = { ...beaches[0], wind_offshore_tol_deg: 30, punchiness: 0.3 };
    const row = (forecast_at: string, wave_height: string): RatingRow => ({ forecast_at, wave_height, wave_period: null,
      wind_speed: "5 mph", wind_direction: "E", tide_height: null, tide_status: null, swell_1_period: "13s" });
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([groundswell, stormSwell], {
      beaches: [beach], rowsByBeach: { a: [row("2026-10-27T18:00:00Z", "2-3 ft"), row("2026-10-27T21:00:00Z", "7-8 ft")] },
    }));

    const spy = jest.mocked(buildStoryCandidates);
    await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    const signals = spy.mock.calls[0][0];

    expect(signals[0].surfBeaches?.find((item) => item.beachId === "a")?.facts.breaker?.character).toBe("crumbly");
  });

  it("builds story events from the region build, storms included", async () => {
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    const ids = input.copyFacts.map((fact) => fact.id);
    expect(ids).toEqual(expect.arrayContaining(["cover-pulse-4-4-2026-10-27", "cover-pulse-6-2-2026-10-29-s"]));
    const stormLine = input.copyFacts.find((fact) => fact.id === "swell-6-2-2026-10-29-s");
    expect(stormLine?.text).toContain("storm swell");
    expect(stormLine?.text).not.toMatch(/\d/);
    expect(stormLine?.gate).toMatchObject({ kind: "swell", confidence: "locked", minimumBeaches: 3 });
    expect(loadRegionForecastEvents).toHaveBeenCalledWith({ client: expect.anything(), region: "San Diego", now, timezone: TIMEZONE });
  });

  it("carries every region beach's name and a card story line for every forecast event", async () => {
    // A swell that peaked yesterday and is still fading: out of the week, still on the card.
    const passed = regionEvent("San Diego:W:2026-10-26", 270, 18, "2026-10-25T18:00:00Z", "2026-10-26T20:00:00Z", "2026-10-27T20:00:00Z");
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([passed, ssw, storm]));
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    expect(input.beachNames).toEqual({ a: "Ocean Beach", b: "Blacks", c: "La Jolla Shores" });
    expect(input.copyFacts.filter((fact) => fact.slot.startsWith("event:")).map((fact) => [fact.slot, fact.text])).toEqual([
      ["event:6-6-2026-10-26:story", "A west long-period groundswell is already in the water, peaked Monday and fades Tuesday."],
      ["event:4-4-2026-10-27:story", "A south-southwest long-period groundswell arrives and peaks Tuesday, then fades Wednesday."],
      ["event:6-2-2026-10-29-s:story", "A west short-period storm swell arrives Wednesday, peaks Thursday and fades Friday."],
    ]);
    // Card lines follow the story's own candidates.
    const firstEvent = input.copyFacts.findIndex((fact) => fact.slot.startsWith("event:"));
    expect(input.copyFacts.slice(firstEvent).every((fact) => fact.slot.startsWith("event:"))).toBe(true);
  });

  it("never offers more than 200 candidates, cutting card lines rather than story candidates", async () => {
    // Two hundred forecast events, each its own direction, period band or day.
    const many = Array.from({ length: 200 }, (_, index) => {
      const peak = new Date(Date.UTC(2026, 9, 28 + (index % 5), 20)).toISOString();
      return regionEvent(`San Diego:${index}`, (Math.floor(index / 5) % 8) * 45, 7 + 3 * Math.floor(index / 40), peak, peak, null);
    });
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([ssw, storm, ...many]));
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    expect(input.copyFacts).toHaveLength(200);
    // The story's candidates come first and the cap only cuts the card lines after them.
    const firstCardLine = input.copyFacts.findIndex((fact) => fact.slot.startsWith("event:"));
    expect(input.copyFacts.slice(0, firstCardLine).some((fact) => fact.slot === "cover")).toBe(true);
    expect(input.copyFacts.slice(firstCardLine).every((fact) => fact.slot.startsWith("event:"))).toBe(true);
  });

  it("gives a storm and a swell peaking the same day each its own exposure sentence", async () => {
    // Ocean Beach and Blacks face the SSW; La Jolla Shores and Sunset Cliffs face the W.
    const four = [...beaches.slice(0, 2), { ...beaches[2] },
      { id: "d", name: "Sunset Cliffs", lat: 33.1, lon: -117.0, aspect_deg: 270, swell_window_center_deg: 270, swell_window_halfwidth_deg: 20, wind_offshore_deg: 90 }];
    const swell = regionEvent("San Diego:SSW:2026-10-29", 202, 13.4, "2026-10-28T18:00:00Z", "2026-10-29T18:00:00Z", "2026-10-30T18:00:00Z");
    const westStorm = regionEvent("San Diego:W:2026-10-29:s", 270, 7, "2026-10-28T20:00:00Z", "2026-10-29T21:00:00Z", "2026-10-30T20:00:00Z",
      { kind: "storm", directionLabel: "W" });
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([swell, westStorm]));
    const input = await buildStoryInput({ client: client(forecasts(four), four), region: "San Diego", now, persist: false });
    const exposure = (key: string) => input.copyFacts.find((fact) => fact.id === `exposure-${key}`);
    expect(exposure("4-4-2026-10-29")?.text).toBe("Blacks and Ocean Beach face this swell better than La Jolla Shores, which sits in the shadow.");
    expect(exposure("6-2-2026-10-29-s")?.text).toBe("La Jolla Shores and Sunset Cliffs face this swell better than Blacks, which sits in the shadow.");
    expect(exposure("6-2-2026-10-29-s")?.gate).toMatchObject({ kind: "exposure", regionalEventKey: "6-2-2026-10-29-s",
      beaches: [{ beachId: "c", exposure: "open" }, { beachId: "d", exposure: "open" }, { beachId: "b", exposure: "shadowed" }] });
  });

  it("rebuilds cached inputs when the region build's facts change", async () => {
    const regionBeaches = beaches.map((beach) => ({ ...beach, swell_window_center_deg: 202, wind_offshore_tol_deg: 30, punchiness: 0.3 }));
    const rowsByBeach = Object.fromEntries(regionBeaches.map((beach) => [beach.id, [{ forecast_at: "2026-10-27T20:00:00Z",
      wave_height: "3-4", wave_period: "13 s", wind_speed: "4 mph", wind_direction: "E", tide_height: null,
      tide_status: null, swell_1_period: null }]]));
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([ssw], { beaches: regionBeaches, rowsByBeach }));
    const first = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    mockLatestInput.mockResolvedValue(first);
    rowsByBeach.a[0].wave_height = "6-8";
    const changed = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    expect(changed.inputHash).not.toBe(first.inputHash);
    expect(changed.copyFacts.find((fact) => fact.slot === "cover")?.facts?.standoutFt).toEqual({ min: 3, max: 8 });
  });

  it("hashes the mapped events, not the raw build: a WAM early look never changes inputHash", async () => {
    const plain = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    const wam = regionEvent("San Diego:W:2026-11-08:s", 270, 9, "2026-11-08T20:00:00Z", "2026-11-08T20:00:00Z", null,
      { kind: "storm", source: "wam", arrivalAt: null, memberCount: 0 });
    jest.mocked(loadRegionForecastEvents).mockResolvedValueOnce(regionBuild(
      [{ ...ssw, offshoreFt: "6 ft", history: "Biggest at the buoy since March." }, storm, wam],
      { wamDays: [{ localDate: "2026-11-08", maxHsM: 2.6, peakAt: "2026-11-08T20:00:00Z", periodS: 9, directionDeg: 270 }] }));
    const withWam = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    expect(plain.inputHash).not.toBe("");
    expect(withWam.inputHash).toBe(plain.inputHash);
    jest.mocked(loadRegionForecastEvents).mockResolvedValueOnce(regionBuild([ssw, { ...storm, memberCount: 2 }]));
    const fewerBeaches = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    expect(fewerBeaches.inputHash).not.toBe(plain.inputHash);
  });

  it("maps forecast events only, chronologically, with the region's confidence and member counts", () => {
    const passed = regionEvent("San Diego:W:2026-10-26", 270, 18, "2026-10-25T18:00:00Z", "2026-10-26T20:00:00Z", "2026-10-27T20:00:00Z", { memberCount: 2 });
    const sunday = regionEvent("San Diego:NW:2026-11-01", 300, 15, "2026-10-31T18:00:00Z", "2026-11-01T20:00:00Z", null);
    const nextWeek = regionEvent("San Diego:W:2026-11-07", 270, 16, "2026-11-06T18:00:00Z", "2026-11-07T20:00:00Z", null);
    const wam = regionEvent("San Diego:W:2026-11-09:s", 270, 9, "2026-11-09T20:00:00Z", "2026-11-09T20:00:00Z", null, { source: "wam", arrivalAt: null });
    const { week, all } = storyEventsFromRegion(regionBuild([nextWeek, storm, wam, passed, sunday, ssw]), "2026-10-27");

    expect(all.map((event) => event.regionalKey)).toEqual([passed.key, ssw.key, storm.key, sunday.key, nextWeek.key]);
    expect(all.map((event) => event.confidence)).toEqual(["locked", "locked", "locked", "likely", "on_the_radar"]);
    expect(all[0]).toEqual({ directionDeg: 270, periodS: 18, arrivalAt: passed.arrivalAt, peakAt: passed.peakAt,
      fadeAt: passed.fadeAt, timezone: TIMEZONE, confidence: "locked", minimumBeaches: 2, kind: "swell", regionalKey: passed.key });
    expect(all.find((event) => event.kind === "storm")?.minimumBeaches).toBe(3);
    // In the week and at most three: the passed spike and next week's swell stay out.
    expect(week.map((event) => event.regionalKey)).toEqual([ssw.key, storm.key, sunday.key]);
  });

  it("keeps a storm and a swell in the same sector, band and peak day as two story events", () => {
    // Both from the west in the 12-14.9 s band, both peaking Thursday.
    const swell = regionEvent("San Diego:W:2026-10-29", 270, 13.4, "2026-10-28T18:00:00Z", "2026-10-29T18:00:00Z", "2026-10-30T18:00:00Z");
    const westStorm = regionEvent("San Diego:W:2026-10-29:s", 268, 12, "2026-10-28T20:00:00Z", "2026-10-29T21:00:00Z", "2026-10-30T12:00:00Z",
      { kind: "storm" });
    const { week } = storyEventsFromRegion(regionBuild([swell, westStorm]), "2026-10-27");
    const keys = week.map(storyEventKey);
    expect(keys).toEqual(["6-4-2026-10-29", "6-4-2026-10-29-s"]);
    const signals = Array.from({ length: 7 }, (_, index) => ({
      localDate: addDays("2026-10-27", index), complete: true, sampleBeaches: 3, meanHeightFt: 4,
      directionDeg: 270, periodS: 13, sourceSeries: "enhanced_forecasts:San Diego", forecastRevision: "2026-10-27T12:00:00Z",
    }));
    const facts = buildStoryCandidates(signals, "San Diego", week);
    const covers = facts.filter((fact) => fact.slot === "cover");
    expect(covers.map((fact) => fact.id)).toEqual([
      "cover-pulse-6-4-2026-10-29", "cover-pulse-alt-6-4-2026-10-29",
      "cover-pulse-6-4-2026-10-29-s", "cover-pulse-alt-6-4-2026-10-29-s",
    ]);
    expect(covers.map((fact) => fact.gate.kind === "swell" && fact.gate.regionalEventKey)).toEqual([keys[0], keys[0], keys[1], keys[1]]);
    expect(covers[2].text).toContain("mid-period storm swell");
    expect(facts.filter((fact) => fact.slot.startsWith("swell:") && !fact.slot.endsWith(":exposure")).map((fact) => fact.slot))
      .toEqual(["swell:6-4-2026-10-29", "swell:6-4-2026-10-29", "swell:6-4-2026-10-29-s", "swell:6-4-2026-10-29-s"]);
  });

  it("uses the region build's Saturday arrival despite a Wednesday height threshold", async () => {
    const rows = forecasts().map((row) => ({ ...row,
      wave_height: String(row.forecast_at).startsWith("2026-10-28") ? "2 ft" : "1 ft" }));
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([
      regionEvent("San Diego:SSW:2026-11-01", 202, 13.4, "2026-10-31T18:00:00Z", "2026-11-01T18:00:00Z", "2026-11-02T18:00:00Z"),
    ]));
    const input = await buildStoryInput({ client: client(rows), region: "San Diego", now, persist: false });
    expect(input.copyFacts.find((fact) => fact.id === "cover-pulse-4-4-2026-11-01")?.text)
      .toContain("reaches San Diego Saturday and peaks Sunday");
  });

  it("keeps a passed spike from using an in-week event's slot", async () => {
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([
      // Peaked yesterday and is still fading: current, but outside the week.
      regionEvent("San Diego:W:2026-10-26", 270, 18, "2026-10-25T18:00:00Z", "2026-10-26T20:00:00Z", "2026-10-27T20:00:00Z"),
      regionEvent("San Diego:SSW:2026-10-29", 202, 13.4, "2026-10-28T18:00:00Z", "2026-10-29T18:00:00Z", "2026-10-30T18:00:00Z"),
      regionEvent("San Diego:SE:2026-10-30", 135, 10, "2026-10-29T18:00:00Z", "2026-10-30T18:00:00Z", "2026-10-31T18:00:00Z"),
      regionEvent("San Diego:WNW:2026-11-02", 300, 15, "2026-11-01T18:00:00Z", "2026-11-02T18:00:00Z", "2026-11-03T18:00:00Z"),
    ]));
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    const covers = input.copyFacts.filter((fact) => fact.id.startsWith("cover-pulse-") && !fact.id.includes("-alt-"));
    expect(covers.map((fact) => fact.gate.kind === "swell" && fact.gate.regionalEventKey))
      .toEqual(["4-4-2026-10-29", "3-3-2026-10-30", "7-5-2026-11-02"]);
  });

  it("builds a region input from representative beaches without a pilot profile", async () => {
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now });
    expect(input).toMatchObject({ schemaVersion: 3, region: "San Diego", editionDate: "2026-10-27" });
    expect(input.provenance.representativeBeachIds).toEqual(["a", "b", "c"]);
    expect(input.provenance.generationInputVersion).toBe("regional-swell-events-8");
    expect(input.copyFacts.some((fact) => fact.slot === "cover")).toBe(true);
    expect(mockSaveInput).toHaveBeenCalledWith(expect.anything(), input);
  });

  it("uses named exposure, a verified wind turn, and tide phase without writing the fallback", async () => {
    const rows = forecasts().map((row) => ({ ...row,
      forecast_at: new Date(Date.parse(String(row.forecast_at)) + (String(row.id).endsWith("-12") ? 4 : 6) * 60 * 60_000).toISOString(),
      wind_direction: String(row.id).endsWith("-12") ? "90" : "270",
      tide_status: "Rising",
    }));
    const input = await buildStoryInput({ client: client(rows), region: "San Diego", now, persist: false });
    expect(input.copyFacts.find((fact) => fact.gate.kind === "exposure")?.text)
      .toContain("Blacks and Ocean Beach");
    expect(input.copyFacts.find((fact) => fact.gate.kind === "wind_pattern")?.text)
      .toContain("onshore fills in");
    expect(input.copyFacts.some((fact) => fact.gate.kind === "wind")).toBe(false);
    expect(input.copyFacts.find((fact) => fact.gate.kind === "tide")?.text)
      .toContain("rising tide");
    expect(mockSaveInput).not.toHaveBeenCalled();
  });

  it("rejects a missing day and stale forecast rows", async () => {
    const sparse = forecasts().filter((row) => !String(row.forecast_at).startsWith("2026-10-30"));
    await expect(buildStoryInput({ client: client(sparse), region: "San Diego", now }))
      .rejects.toThrow("story_coverage_sparse");
    const stale = forecasts().map((row) => ({ ...row, om_fetched_at: "2026-10-24T00:00:00Z" }));
    await expect(buildStoryInput({ client: client(stale), region: "San Diego", now }))
      .rejects.toThrow("story_source_stale");
    expect(mockSaveInput).not.toHaveBeenCalled();
  });

  it("returns a 503 story error when the region build fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.mocked(loadRegionForecastEvents).mockRejectedValue(new Error("Failed to load region beaches: timeout"));
    await expect(buildStoryInput({ client: client(forecasts()), region: "San Diego", now }))
      .rejects.toMatchObject({ message: "story_region_read_failed", status: 503 });
    expect(warn).toHaveBeenCalledWith("[week-scout-story] region build failed",
      { region: "San Diego", error: "Error: Failed to load region beaches: timeout" });
    warn.mockRestore();
  });
});
