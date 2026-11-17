/** @jest-environment node */
jest.mock("@/lib/alerts/swell-events/regional", () => ({ buildRegionEvents: jest.fn() }));

import type { SupabaseClient } from "@supabase/supabase-js";

import { bigSwellForecastStory } from "@/lib/alerts/swell-events/big-swell-story";
import { buildRegionEvents, type InternalRegionEvent, type RegionBuild } from "@/lib/alerts/swell-events/regional";
import type { Database } from "@/types/database";

const TIMEZONE = "America/Los_Angeles";
// Monday Nov 16, 20:05 PT.
const NOW = new Date("2026-11-17T04:05:00Z");
const client = {} as SupabaseClient<Database>;

function event(key: string, overrides: Partial<InternalRegionEvent>): InternalRegionEvent {
  return {
    key, kind: "storm", source: "forecast", directionDeg: 270, directionLabel: "W", periodS: 7,
    arrivalAt: "2026-11-17T15:00:00Z", peakAt: "2026-11-17T20:00:00Z", fadeAt: "2026-11-17T23:00:00Z",
    peakLocalDate: "2026-11-17", offshoreFt: "6 ft", history: null, memberCount: 4, ...overrides,
  };
}

const STORM = event("San Diego:W:2026-11-17:s", { history: "Biggest since Apr 2025 at the Del Mar Nearshore buoy" });
// The same day's smaller swell carries no history line.
const SMALL = event("San Diego:SSW:2026-11-17", { kind: "swell", directionDeg: 200, directionLabel: "SSW", periodS: 15,
  offshoreFt: "2 ft" });
const build = (events: InternalRegionEvent[], buoyId = "46266"): RegionBuild => ({
  region: "San Diego", timezone: TIMEZONE, buoy: { id: buoyId, name: "Del Mar Nearshore" }, wamDays: null,
  beaches: [], events, rowsByBeach: {},
});
const story = (peakAt = "2026-11-17T21:00:00Z", buoyId = "46266") =>
  bigSwellForecastStory({ client, region: "San Diego", timezone: TIMEZONE, buoyId, peakAt, now: NOW });

describe("bigSwellForecastStory", () => {
  it("names the region event that carries the history line for the card's peak day, in the card's words", async () => {
    jest.mocked(buildRegionEvents).mockResolvedValue(build([SMALL, STORM]));
    expect(await story()).toEqual({
      story: "A west short-period storm swell comes and goes Tuesday.", storySource: "code" });
    expect(buildRegionEvents).toHaveBeenCalledWith({ client, region: "San Diego", now: NOW, timezone: TIMEZONE });
  });

  it("gives no sentence for another buoy, another peak day, or a day with no history line", async () => {
    jest.mocked(buildRegionEvents).mockResolvedValue(build([SMALL, STORM]));
    expect(await story("2026-11-17T21:00:00Z", "46225")).toEqual({ story: null, storySource: null });
    expect(await story("2026-11-18T21:00:00Z")).toEqual({ story: null, storySource: null });
    jest.mocked(buildRegionEvents).mockResolvedValue(build([SMALL, { ...STORM, history: null }]));
    expect(await story()).toEqual({ story: null, storySource: null });
    jest.mocked(buildRegionEvents).mockResolvedValue({ ...build([STORM]), buoy: null });
    expect(await story()).toEqual({ story: null, storySource: null });
  });

  it("reads the peak day in the region's time zone", async () => {
    jest.mocked(buildRegionEvents).mockResolvedValue(build([STORM]));
    // 05:00 UTC Wednesday is still Tuesday evening in San Diego.
    expect((await story("2026-11-18T05:00:00Z")).storySource).toBe("code");
  });
});
