const mockActiveRegions = jest.fn();
const mockLatestInput = jest.fn();
const mockSaveInput = jest.fn();
jest.mock("../week-scout-story-store", () => ({
  activeStoryRegions: (...args: unknown[]) => mockActiveRegions(...args),
  loadLatestStoryInput: (...args: unknown[]) => mockLatestInput(...args),
  saveStoryInput: (...args: unknown[]) => mockSaveInput(...args),
}));

import { buildStoryInput } from "../week-scout-story-source";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const now = new Date("2026-10-27T12:00:00Z");
const beaches = [
  { id: "a", lat: 32.5, lon: -117.5, aspect_deg: 270 },
  { id: "b", lat: 32.7, lon: -117.3, aspect_deg: 270 },
  { id: "c", lat: 32.9, lon: -117.1, aspect_deg: 270 },
];
const forecasts = (): Array<Record<string, unknown>> => Array.from({ length: 7 }, (_, day) =>
  beaches.flatMap((beach) => [12, 15].map((hour) => ({
    id: `${beach.id}-${day}-${hour}`,
    beach_id: beach.id, forecast_at: new Date(Date.UTC(2026, 9, 27 + day, hour)).toISOString(),
    wave_height: "3 ft", swell_direction_om: 270, swell_period_om: 15,
    om_fetched_at: now.toISOString(), updated_at: now.toISOString(),
  })))).flat();

function client(rows: Array<Record<string, unknown>>): SupabaseClient<Database> {
  return { from: (table: string) => {
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
    mockActiveRegions.mockResolvedValue([{ region: "San Diego", timezone: "America/Los_Angeles" }]);
    mockLatestInput.mockResolvedValue(null);
  });

  it("builds a region input from representative beaches without a pilot profile", async () => {
    const input = await buildStoryInput({ client: client(forecasts()), region: "San Diego", now });
    expect(input).toMatchObject({ schemaVersion: 3, region: "San Diego", editionDate: "2026-10-27" });
    expect(input.provenance.representativeBeachIds).toEqual(["a", "b", "c"]);
    expect(input.copyFacts.some((fact) => fact.slot === "cover")).toBe(true);
    expect(mockSaveInput).toHaveBeenCalledWith(expect.anything(), input);
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
