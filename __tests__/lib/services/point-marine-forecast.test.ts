import {
  buildPointForecastCandidates,
  distanceBetweenPointsMiles,
  hasCompleteSwellComponent,
  isAllZeroWaveHeightSeries,
  normalizeLongitude,
  normalizePointMarineForecastRows,
} from "@/lib/services/point-marine-forecast";
import {
  clearPointMarineForecastCache,
  fetchPointMarineForecast,
  POINT_MARINE_FORECAST_DEADLINE_MS,
} from "@/lib/services/point-marine-forecast/service";
import { fetchPointMarineForecastPayload } from "@/lib/services/point-marine-forecast/client";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

jest.mock("@/lib/services/point-marine-forecast/client", () => ({
  fetchPointMarineForecastPayload: jest.fn(),
}));

const mockFetchPointMarineForecastPayload =
  fetchPointMarineForecastPayload as jest.MockedFunction<typeof fetchPointMarineForecastPayload>;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    hourly: {
      time: ["2026-07-31T12:00:00Z", "2026-07-31T15:00:00Z"],
      wave_height: [1.2, 1.1],
      wave_period: [13, 12],
      wave_direction: [270, 265],
      swell_wave_height: [0.9, 0.8],
      swell_wave_period: [15, 14],
      swell_wave_direction: [260, 255],
      secondary_swell_wave_height: [0.4, 0.3],
      secondary_swell_wave_period: [10, 9],
      secondary_swell_wave_direction: [190, 185],
      tertiary_swell_wave_height: [0.2, 0.1],
      tertiary_swell_wave_period: [8, 7],
      tertiary_swell_wave_direction: [140, 135],
      wind_wave_height: [0.3, 0.3],
      wind_wave_period: [6, 6],
      wind_wave_direction: [280, 275],
      ...overrides,
    },
  };
}

function payloadWithFutureRow() {
  return payload({
    time: [
      "2026-07-31T12:00:00Z",
      "2026-07-31T15:00:00Z",
      "2026-07-31T18:00:00Z",
      "2026-07-31T21:00:00Z",
      "2026-08-01T00:00:00Z",
      "2026-08-01T03:00:00Z",
      "2026-08-01T06:00:00Z",
      "2026-08-01T09:00:00Z",
      "2026-08-01T12:00:00Z",
    ],
  });
}

describe("point marine forecast normalization", () => {
  it("preserves complete SI components and parses ISO times", () => {
    const rows = normalizePointMarineForecastRows(payload(), 1);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      forecastAt: "2026-07-31T12:00:00.000Z",
      total: { heightM: 1.2, periodS: 13, directionDeg: 270 },
      swell1: { heightM: 0.9, periodS: 15, directionDeg: 260 },
      swell2: { heightM: 0.4, periodS: 10, directionDeg: 190 },
      swell3: { heightM: 0.2, periodS: 8, directionDeg: 140 },
      windWave: { heightM: 0.3, periodS: 6, directionDeg: 280 },
    });
    expect(hasCompleteSwellComponent(rows[0])).toBe(true);
  });

  it("nulls a component when any member is missing instead of synthesizing it", () => {
    const rows = normalizePointMarineForecastRows(
      payload({ swell_wave_period: [null, 14], wind_wave_direction: [null, 275] }),
      1,
    );

    expect(rows[0]?.swell1).toBeNull();
    expect(rows[0]?.windWave).toBeNull();
  });

  it("rejects an all-zero wave-height series", () => {
    expect(isAllZeroWaveHeightSeries(payload({ wave_height: [0, 0] }))).toBe(true);
    expect(isAllZeroWaveHeightSeries(payload({ wave_height: [0, 0.1] }))).toBe(false);
  });

  it("builds a bounded deterministic candidate ring", () => {
    const candidates = buildPointForecastCandidates({ lat: 33.5, lon: -118.5 });

    expect(candidates).toHaveLength(9);
    expect(candidates[0]).toEqual({ lat: 33.5, lon: -118.5 });
    expect(candidates).toEqual(
      [...candidates].sort((first, second) => (
        distanceBetweenPointsMiles({ lat: 33.5, lon: -118.5 }, first)
        - distanceBetweenPointsMiles({ lat: 33.5, lon: -118.5 }, second)
      )),
    );
  });

  it("wraps longitude candidates across the dateline", () => {
    const requestedPoint = { lat: 0, lon: 179.99 };
    const candidates = buildPointForecastCandidates(requestedPoint);

    expect(normalizeLongitude(180.025)).toBeCloseTo(-179.975, 10);
    expect(candidates.some((candidate) => (
      candidate.lat === 0 && Math.abs(candidate.lon - (-179.975)) < 1e-9
    ))).toBe(true);
    expect(distanceBetweenPointsMiles(requestedPoint, { lat: 0, lon: -179.975 }))
      .toBeLessThan(distanceBetweenPointsMiles(requestedPoint, { lat: 0, lon: 179.5 }));
  });
});

describe("point marine forecast service", () => {
  beforeEach(() => {
    clearPointMarineForecastCache();
    mockFetchPointMarineForecastPayload.mockReset();
  });

  it("retries a zeroed coastal cell and selects the nearest valid offshore candidate", async () => {
    const zeroed = payload({ wave_height: [0, 0] });
    mockFetchPointMarineForecastPayload.mockImplementation(async ({ lat }) => {
      const result = lat === 33.5 ? zeroed : payload();
      return result;
    });

    const response = await fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(mockFetchPointMarineForecastPayload).toHaveBeenCalledTimes(9);
    expect(response.sampleResolution).toBe("offshore_shifted");
    expect(response.sampledPoint).toEqual({ lat: 33.535, lon: -118.5 });
  });

  it("rejects when every candidate is all-zero or incomplete", async () => {
    mockFetchPointMarineForecastPayload.mockResolvedValue(payload({ wave_height: [0, 0] }));

    await expect(fetchPointMarineForecast({ lat: 33.5, lon: -118.5, days: 1 }))
      .rejects.toMatchObject({ name: "PointMarineForecastUnavailableError" });
    expect(mockFetchPointMarineForecastPayload).toHaveBeenCalledTimes(9);
    expectConsoleWarnings([/Point marine forecast unavailable/]);
  });

  it("serves fresh cache entries and marks the cached response stale after refresh failure", async () => {
    const initialNow = new Date("2026-07-31T12:00:00.000Z");
    mockFetchPointMarineForecastPayload.mockResolvedValue(payloadWithFutureRow());
    const first = await fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: initialNow,
    });
    expect(mockFetchPointMarineForecastPayload).toHaveBeenCalledTimes(1);

    const fresh = await fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: new Date(initialNow.getTime() + 5 * 60 * 1000),
    });
    expect(fresh).toBe(first);
    expect(mockFetchPointMarineForecastPayload).toHaveBeenCalledTimes(1);

    mockFetchPointMarineForecastPayload.mockRejectedValue(new Error("upstream down"));
    const stale = await fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: new Date(initialNow.getTime() + 11 * 60 * 1000),
    });
    expect(stale.stale).toBe(true);
    expect(stale.rows).toEqual(first.rows);
  });

  it("does not serve a cached response after the stale age window", async () => {
    const initialNow = new Date("2026-07-31T12:00:00.000Z");
    mockFetchPointMarineForecastPayload.mockResolvedValue(payloadWithFutureRow());
    await fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: initialNow,
    });

    mockFetchPointMarineForecastPayload.mockRejectedValue(new Error("upstream down"));
    await expect(fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: new Date("2026-07-31T19:00:00.000Z"),
    })).rejects.toMatchObject({ name: "PointMarineForecastUnavailableError" });
    expectConsoleWarnings([/Point marine forecast unavailable/]);
  });

  it("rejects a cached response whose rows are historical even within six hours", async () => {
    const initialNow = new Date("2026-07-31T12:00:00.000Z");
    mockFetchPointMarineForecastPayload.mockResolvedValue(payload());
    await fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: initialNow,
    });

    mockFetchPointMarineForecastPayload.mockRejectedValue(new Error("upstream down"));
    await expect(fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      days: 1,
      now: new Date("2026-07-31T15:01:00.000Z"),
    })).rejects.toMatchObject({ name: "PointMarineForecastUnavailableError" });
    expectConsoleWarnings([/Point marine forecast unavailable/]);
  });

  it("stops the candidate ring when the server-owned upstream deadline expires", async () => {
    jest.useFakeTimers();
    mockFetchPointMarineForecastPayload.mockImplementation(({ signal }) => new Promise((_, reject) => {
      signal?.addEventListener("abort", () => {
        const error = new Error("aborted by deadline");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }));

    const request = fetchPointMarineForecast({ lat: 33.5, lon: -118.5, days: 1 });
    const rejection = (async (): Promise<void> => {
      await expect(request).rejects.toMatchObject({ name: "PointMarineForecastUnavailableError" });
    })();
    await jest.advanceTimersByTimeAsync(POINT_MARINE_FORECAST_DEADLINE_MS);
    await rejection;
    expect(mockFetchPointMarineForecastPayload).toHaveBeenCalledTimes(1);
    expectConsoleWarnings([/Point marine forecast unavailable/]);
    jest.useRealTimers();
  });

  it("propagates aborts instead of converting them to stale or unavailable data", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    mockFetchPointMarineForecastPayload.mockRejectedValue(abortError);
    const controller = new AbortController();
    controller.abort();

    await expect(fetchPointMarineForecast({
      lat: 33.5,
      lon: -118.5,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(mockFetchPointMarineForecastPayload).toHaveBeenCalledTimes(0);
  });
});
