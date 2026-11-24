import {
  buildEcmwfOutlookSeries,
  fetchEcmwfWamSeries,
  parseWamSeries,
  type WamPoint,
} from "@/lib/services/noaa-wavewatch/ecmwf-outlook";
import type { WaveWatchData } from "@/lib/services/noaa-wavewatch/types";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-11-06T00:00:00Z");

function modelPoint(ms: number, hs: number, source: WaveWatchData["data_source"] = "OPEN_METEO"): WaveWatchData {
  return {
    timestamp: new Date(ms).toISOString(),
    significant_wave_height: hs,
    peak_wave_period: 12,
    peak_wave_direction: 270,
    swell_1_height: hs,
    swell_1_period: 12,
    swell_1_direction: 270,
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: 0,
    wind_wave_period: 0,
    wind_wave_direction: 0,
    data_source: source,
  } as WaveWatchData;
}

/** Model every 3 h to day 9, WAM hourly to day 14.5 at `ratio` times the model. */
function fixture(ratio: number): { merged: WaveWatchData[]; wam: WamPoint[] } {
  const merged: WaveWatchData[] = [];
  for (let h = 0; h <= 9 * 24; h += 3) merged.push(modelPoint(NOW + h * HOUR, 1.2));
  const wam: WamPoint[] = [];
  for (let h = 0; h <= 14.5 * 24; h += 1) wam.push({ ms: NOW + h * HOUR, hsM: 1.2 * ratio });
  return { merged, wam };
}

describe("parseWamSeries", () => {
  it("returns null for an all-null (land-masked) cell", () => {
    expect(parseWamSeries({ time: [1, 2, 3], wave_height: [null, null, null] })).toBeNull();
  });

  it("keeps finite hours as epoch ms", () => {
    expect(parseWamSeries({ time: [100, 200], wave_height: [1.5, null] })).toEqual([{ ms: 100_000, hsM: 1.5 }]);
  });
});

describe("buildEcmwfOutlookSeries", () => {
  it("returns the seam ratio and starts strictly after the last model slot", () => {
    const { merged, wam } = fixture(1.3);
    const series = buildEcmwfOutlookSeries(merged, wam, NOW);
    expect(series).not.toBeNull();
    expect(series!.model).toBe("ecmwf_wam025");
    expect(series!.model_ratio).toBeCloseTo(1.3, 3);
    expect(series!.model_ratio_pairs).toBeGreaterThanOrEqual(8);
    expect(series!.starts_after_ms).toBe(NOW + 9 * 24 * HOUR);
  });

  it("caps the series at 15 days", () => {
    const { merged } = fixture(1);
    const wam: WamPoint[] = [];
    for (let h = 0; h <= 17 * 24; h += 1) wam.push({ ms: NOW + h * HOUR, hsM: 1.2 });
    const series = buildEcmwfOutlookSeries(merged, wam, NOW)!;
    expect(Math.max(...series.points.map((point) => point.ms))).toBeLessThanOrEqual(NOW + 15 * 24 * HOUR);
  });

  it.each([0.14, 2.9])("gives no outlook when WAM/model is %s (outside the trusted band)", (ratio) => {
    const { merged, wam } = fixture(ratio);
    expect(buildEcmwfOutlookSeries(merged, wam, NOW)).toBeNull();
  });

  it("gives no outlook with no WAM or too few seam pairs", () => {
    const { merged, wam } = fixture(1);
    expect(buildEcmwfOutlookSeries(merged, null, NOW)).toBeNull();
    const sparse = wam.filter((point) => point.ms > NOW + 9 * 24 * HOUR - 6 * HOUR);
    expect(buildEcmwfOutlookSeries(merged, sparse, NOW)).toBeNull();
  });

  it("ignores FALLBACK points when finding the seam", () => {
    const { merged, wam } = fixture(1);
    merged.push(modelPoint(NOW + 10 * 24 * HOUR, 1.2, "FALLBACK"));
    expect(buildEcmwfOutlookSeries(merged, wam, NOW)!.starts_after_ms).toBe(NOW + 9 * 24 * HOUR);
  });
});

describe("fetchEcmwfWamSeries", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("requests only ecmwf_wam025 total height, separately from the default model", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ hourly: { time: [1_700_000_000], wave_height: [2] } }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const series = await fetchEcmwfWamSeries(32.75, -117.25);
    const params = new URL((fetchMock.mock.calls[0] as unknown[])[0] as string).searchParams;
    expect(params.get("models")).toBe("ecmwf_wam025");
    expect(params.get("hourly")).toBe("wave_height");
    expect(params.get("timeformat")).toBe("unixtime");
    expect(series).toEqual([{ ms: 1_700_000_000_000, hsM: 2 }]);
  });

  it("retries one cell offshore when the beach cell is land-masked", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hourly: { time: [1], wave_height: [null] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hourly: { time: [1], wave_height: [1.4] } }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const series = await fetchEcmwfWamSeries(37.7367, -122.5079);
    const second = new URL(fetchMock.mock.calls[1][0] as string).searchParams;
    expect(Number(second.get("latitude"))).toBeCloseTo(37.7367, 4);
    expect(Number(second.get("longitude"))).toBeCloseTo(-122.7579, 4);
    expect(series).toEqual([{ ms: 1000, hsM: 1.4 }]);
  });
});
