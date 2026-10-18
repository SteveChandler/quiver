/** @jest-environment node */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCachedHourlyTidePredictions } from "@/lib/services/noaa-tide-service";
import { tideFtAtWaves } from "@/lib/sessions/waves/wave-tides";
import type { StoredWave } from "@/lib/sessions/waves/waves-summary";

jest.mock("@/lib/services/noaa-tide-service", () => ({
  fetchCachedHourlyTidePredictions: jest.fn(),
}));

const fetchPredictions = jest.mocked(fetchCachedHourlyTidePredictions);
const supabase = {} as SupabaseClient;

function wave(id: string, startedAt: string, endedAt: string): StoredWave {
  return {
    id, index: Number(id), startedAt, endedAt, durationS: (Date.parse(endedAt) - Date.parse(startedAt)) / 1000,
    distanceM: 40, maxSpeedMps: 5, avgSpeedMps: 3,
    start: { lat: 33, lon: -117 }, end: { lat: 33.001, lon: -117 },
    headingDeg: 0, confidence: 0.8,
  };
}

beforeEach(() => fetchPredictions.mockReset());

it("fetches the padded wave span and interpolates meters into rounded feet", async () => {
  fetchPredictions.mockResolvedValue({
    predictions: [
      { ts: "2026-10-17T12:00:00Z", tide_height_m: 1, tide_phase: null },
      { ts: "2026-10-17T13:00:00Z", tide_height_m: 2, tide_phase: null },
    ], latestCreatedAt: null,
  });
  const later = wave("2", "2026-10-17T12:30:00Z", "2026-10-17T12:31:00Z");
  const earlier = wave("1", "2026-10-17T12:00:00Z", "2026-10-17T12:01:00Z");
  const result = await tideFtAtWaves(supabase, "beach-1", [later, earlier]);

  expect(fetchPredictions).toHaveBeenCalledWith(
    supabase, "beach-1", "2026-10-17T11:00:00.000Z", "2026-10-17T13:31:00.000Z",
  );
  expect([...result]).toEqual([["2", 4.9], ["1", 3.3]]);
});

it("returns null outside the prediction range and for empty predictions", async () => {
  const waves = [
    wave("1", "2026-10-17T11:59:00Z", "2026-10-17T12:00:00Z"),
    wave("2", "2026-10-17T12:30:00Z", "2026-10-17T12:31:00Z"),
    wave("3", "2026-10-17T13:01:00Z", "2026-10-17T13:02:00Z"),
  ];
  fetchPredictions.mockResolvedValueOnce({
    predictions: [
      { ts: "2026-10-17T12:00:00Z", tide_height_m: 1, tide_phase: null },
      { ts: "2026-10-17T13:00:00Z", tide_height_m: 2, tide_phase: null },
    ], latestCreatedAt: null,
  }).mockResolvedValueOnce({ predictions: [], latestCreatedAt: null });

  expect([...await tideFtAtWaves(supabase, "beach-1", waves)]).toEqual([
    ["1", null], ["2", 4.9], ["3", null],
  ]);
  expect([...await tideFtAtWaves(supabase, "beach-1", waves)]).toEqual([
    ["1", null], ["2", null], ["3", null],
  ]);
});

it("propagates fetch errors and skips fetching for no waves", async () => {
  expect(await tideFtAtWaves(supabase, "beach-1", [])).toEqual(new Map());
  expect(fetchPredictions).not.toHaveBeenCalled();
  fetchPredictions.mockRejectedValue(new Error("tide unavailable"));
  await expect(tideFtAtWaves(supabase, "beach-1", [
    wave("1", "2026-10-17T12:00:00Z", "2026-10-17T12:01:00Z"),
  ])).rejects.toThrow("tide unavailable");
});
