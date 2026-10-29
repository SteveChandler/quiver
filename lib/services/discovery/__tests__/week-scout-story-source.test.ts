const mockActiveRegions = jest.fn();
const mockLatestInput = jest.fn();
const mockSaveInput = jest.fn();
jest.mock("@/lib/alerts/swell-events", () => ({
  ...jest.requireActual("@/lib/alerts/swell-events"),
  loadRecentSwellSnapshots: jest.fn(),
  loadSwellForecastRows: jest.fn(),
  detectBeachSwellEvents: jest.fn(),
}));
jest.mock("../week-scout-story-store", () => ({
  activeStoryRegions: (...args: unknown[]) => mockActiveRegions(...args),
  loadLatestStoryInput: (...args: unknown[]) => mockLatestInput(...args),
  saveStoryInput: (...args: unknown[]) => mockSaveInput(...args),
}));

import { buildStoryInput } from "../week-scout-story-source";
import { detectBeachSwellEvents, loadRecentSwellSnapshots, loadSwellForecastRows } from "@/lib/alerts/swell-events";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const now = new Date("2026-10-27T12:00:00Z");
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
describe("regional story source snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadRecentSwellSnapshots).mockResolvedValue([]);
    jest.mocked(loadSwellForecastRows).mockResolvedValue(new Map());
    jest.mocked(detectBeachSwellEvents).mockImplementation(({ beach }) => [{
      beachId: beach.id, eventKey: `event-${beach.id}`, directionDeg: 202, directionBand: "SSW",
      directionLabel: "SSW", periodS: 13.4, peakOffshoreHeightFt: 4, peakFaceHeightFt: 3,
      baselineFaceHeightFt: 1, peakEnergy: 200, baselineEnergy: 20, energyRatio: 10, exposure: 1,
      arrivalAt: "2026-10-31T18:00:00Z", peakAt: "2026-11-01T18:00:00Z",
      fadeAt: "2026-11-02T18:00:00Z", peakLocalDate: "2026-11-01",
    }]);
    mockActiveRegions.mockResolvedValue([{ region: "San Diego", timezone: "America/Los_Angeles" }]);
    mockLatestInput.mockResolvedValue(null);
  });

  it("uses regional event snapshots for Saturday arrival despite a Wednesday height threshold", async () => {
    const rows = forecasts().map((row) => ({ ...row,
      wave_height: String(row.forecast_at).startsWith("2026-10-28") ? "2 ft" : "1 ft" }));
    jest.mocked(loadRecentSwellSnapshots).mockResolvedValue(beaches.map((beach) => ({
      beachId: beach.id, eventKey: `event-${beach.id}`, detectorVersion: "v1", runDate: "2026-10-27",
      detectedAt: now.toISOString(), directionDeg: 202, directionBand: "SSW", periodS: 13.4,
      peakOffshoreHeightFt: 4, peakFaceHeightFt: 3, exposure: 1, energyRatio: 2,
      arrivalAt: "2026-10-31T18:00:00Z", peakAt: "2026-11-01T18:00:00Z",
      fadeAt: "2026-11-02T18:00:00Z", crossingDirectionDeg: null,
      crossingPeriodS: null, crossingOffshoreHeightFt: null,
    })));
    jest.mocked(detectBeachSwellEvents).mockImplementation(({ beach }) => [{
      beachId: beach.id, eventKey: `event-${beach.id}`, directionDeg: 202, directionBand: "SSW",
      directionLabel: "SSW", periodS: 13.4, peakOffshoreHeightFt: 4, peakFaceHeightFt: 3,
      baselineFaceHeightFt: 1, peakEnergy: 200, baselineEnergy: 20, energyRatio: 10, exposure: 1,
      arrivalAt: "2026-10-31T18:00:00Z", peakAt: "2026-11-01T18:00:00Z",
      fadeAt: "2026-11-02T18:00:00Z", peakLocalDate: "2026-11-01",
    }]);
    const input = await buildStoryInput({ client: client(rows), region: "San Diego", now, persist: false });
    expect(input.copyFacts.find((fact) => fact.id === "cover-pulse-4-4-2026-11-01")?.text)
      .toContain("reaches San Diego Saturday and peaks Sunday");
    expect(loadRecentSwellSnapshots).toHaveBeenCalledWith(expect.anything(), ["a", "b", "c"], expect.any(Date));
  });

  it("keeps a passed spike from using an in-week event's slot and bins periods like the chart", async () => {
    const event = (directionDeg: number, periodS: number, arrivalAt: string, peakAt: string, fadeAt: string) => ({
      eventKey: `event-${directionDeg}`, directionDeg, directionBand: "X", directionLabel: "X", periodS,
      peakOffshoreHeightFt: 4, peakFaceHeightFt: 3, baselineFaceHeightFt: 1, peakEnergy: 200,
      baselineEnergy: 20, energyRatio: 10, exposure: 1, arrivalAt, peakAt, fadeAt, peakLocalDate: "",
    });
    jest.mocked(detectBeachSwellEvents).mockImplementation(({ beach }) => [
      // Peaked yesterday and is still fading: current, but outside the week.
      event(270, 18, "2026-10-25T18:00:00Z", "2026-10-26T20:00:00Z", "2026-10-27T20:00:00Z"),
      event(202, 13.4, "2026-10-28T18:00:00Z", "2026-10-29T18:00:00Z", "2026-10-30T18:00:00Z"),
      event(135, 10, "2026-10-29T18:00:00Z", "2026-10-30T18:00:00Z", "2026-10-31T18:00:00Z"),
      event(300, 14.97, "2026-11-01T18:00:00Z", "2026-11-02T18:00:00Z", "2026-11-03T18:00:00Z"),
    ].map((item) => ({ ...item, beachId: beach.id })));
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now, persist: false });
    const covers = input.copyFacts.filter((fact) => fact.id.startsWith("cover-pulse-") && !fact.id.includes("-alt-"));
    expect(covers.map((fact) => fact.gate.kind === "swell" && fact.gate.regionalEventKey))
      .toEqual(["4-4-2026-10-29", "3-3-2026-10-30", "7-5-2026-11-02"]);
  });

  it("builds a region input from representative beaches without a pilot profile", async () => {
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now });
    expect(input).toMatchObject({ schemaVersion: 3, region: "San Diego", editionDate: "2026-10-27" });
    expect(input.provenance.representativeBeachIds).toEqual(["a", "b", "c"]);
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
});
