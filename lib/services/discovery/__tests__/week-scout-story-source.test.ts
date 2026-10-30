const mockActiveRegions = jest.fn();
const mockLatestInput = jest.fn();
const mockSaveInput = jest.fn();
jest.mock("@/lib/alerts/swell-events/regional", () => ({ loadRegionForecastEvents: jest.fn() }));
jest.mock("../week-scout-story-store", () => ({
  activeStoryRegions: (...args: unknown[]) => mockActiveRegions(...args),
  loadLatestStoryInput: (...args: unknown[]) => mockLatestInput(...args),
  saveStoryInput: (...args: unknown[]) => mockSaveInput(...args),
}));

import { buildStoryInput, storyEventsFromRegion } from "../week-scout-story-source";
import { buildStoryCandidates, storyEventKey } from "../week-scout-story-candidates";
import { addDays } from "../swell-briefing-input";
import { loadRegionForecastEvents, type InternalRegionEvent, type RegionBuild } from "@/lib/alerts/swell-events/regional";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const now = new Date("2026-10-27T12:00:00Z");
const TIMEZONE = "America/Los_Angeles";
const beaches = [
  { id: "a", name: "Ocean Beach", lat: 32.5, lon: -117.5, aspect_deg: 202, swell_window_center_deg: 202, swell_window_halfwidth_deg: 25, wind_offshore_deg: 90 },
  { id: "b", name: "Blacks", lat: 32.7, lon: -117.3, aspect_deg: 202, swell_window_center_deg: 202, swell_window_halfwidth_deg: 25, wind_offshore_deg: 90 },
  { id: "c", name: "La Jolla Shores", lat: 32.9, lon: -117.1, aspect_deg: 270, swell_window_center_deg: 270, swell_window_halfwidth_deg: 20, wind_offshore_deg: 90 },
];
const forecasts = (): Array<Record<string, unknown>> => Array.from({ length: 7 }, (_, day) =>
  beaches.flatMap((beach) => [12, 15].map((hour) => ({
    id: `${beach.id}-${day}-${hour}`,
    beach_id: beach.id, forecast_at: new Date(Date.UTC(2026, 9, 27 + day, hour)).toISOString(),
    wave_height: "3 ft", swell_direction_om: 202, swell_period_om: 15, confidence_score: 70,
    om_fetched_at: now.toISOString(), updated_at: now.toISOString(),
  })))).flat();

function client(rows: Array<Record<string, unknown>>): SupabaseClient<Database> {
  return { rpc: () => { throw new Error("unexpected RPC"); }, from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, is: () => query, order: () => query,
      in: () => query, gte: () => query, lt: () => query,
      range: async (start: number, end: number) => ({
        data: (table === "beaches" ? beaches : rows).slice(start, end + 1), error: null,
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
    jest.mocked(loadRegionForecastEvents).mockResolvedValue(regionBuild([ssw, storm]));
    mockActiveRegions.mockResolvedValue([{ region: "San Diego", timezone: TIMEZONE }]);
    mockLatestInput.mockResolvedValue(null);
  });

  it("builds story events from the region build, storms included", async () => {
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    const ids = input.copyFacts.map((fact) => fact.id);
    expect(ids).toEqual(expect.arrayContaining(["cover-pulse-4-4-2026-10-27", "cover-pulse-6-2-2026-10-29-s"]));
    const stormLine = input.copyFacts.find((fact) => fact.id === "swell-6-2-2026-10-29-s");
    expect(stormLine?.text).toContain("stormy");
    expect(stormLine?.text).not.toMatch(/\d/);
    expect(stormLine?.gate).toMatchObject({ kind: "swell", confidence: "locked", minimumBeaches: 3 });
    expect(loadRegionForecastEvents).toHaveBeenCalledWith({ client: expect.anything(), region: "San Diego", now, timezone: TIMEZONE });
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
    expect(covers[2].text).toContain("stormy mid-period swell");
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
    expect(input.provenance.generationInputVersion).toBe("regional-swell-events-6");
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
