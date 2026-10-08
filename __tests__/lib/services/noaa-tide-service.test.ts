/** @jest-environment node */

const mockFetchWithTimeout = jest.fn();

import {
  fetchCachedHourlyTidePredictions,
  fetchHighLowTidePredictions,
  fetchHourlyTidePredictions,
  hasSufficientCachedTideCoverage,
  type TidePrediction,
} from "@/lib/services/noaa-tide-service";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTideForecastClient(rows: unknown[], error: unknown = null): any {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.order = jest.fn(async () => ({ data: rows, error }));
  return {
    from: jest.fn(() => chain),
    chain,
  };
}

describe("noaa-tide-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetchWithTimeout;
  });

  it("fetches and normalizes exact high/low tide predictions from NOAA", async () => {
    mockFetchWithTimeout.mockResolvedValue(
      jsonResponse({
        predictions: [
          { t: "2026-06-30 01:12", v: "1.234", type: "H" },
          { t: "2026-06-30 07:44", v: "0.102", type: "L" },
          { t: "2026-06-30 08:00", v: "bad", type: "L" },
          { t: "2026-06-30 09:00", v: "1.1", type: "X" },
        ],
      })
    );

    const result = await fetchHighLowTidePredictions(
      "9410230",
      "2026-06-30T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    );

    const requestUrl = new URL(String(mockFetchWithTimeout.mock.calls[0][0]));
    expect(requestUrl.searchParams.get("station")).toBe("9410230");
    expect(requestUrl.searchParams.get("product")).toBe("predictions");
    expect(requestUrl.searchParams.get("interval")).toBe("hilo");
    expect(requestUrl.searchParams.get("time_zone")).toBe("gmt");
    expect(requestUrl.searchParams.get("units")).toBe("metric");
    expect(result).toEqual([
      {
        ts: "2026-06-30T01:12:00.000Z",
        tide_height_m: 1.234,
        type: "high",
      },
      {
        ts: "2026-06-30T07:44:00.000Z",
        tide_height_m: 0.102,
        type: "low",
      },
    ]);
  });

  it("caches hourly NOAA predictions by date and filters narrower same-day windows", async () => {
    mockFetchWithTimeout.mockResolvedValue(
      jsonResponse({
        predictions: Array.from({ length: 24 }, (_, index) => ({
          t: `2026-07-02 ${String(index).padStart(2, "0")}:00`,
          v: String(index / 10),
        })),
      })
    );

    const fullWindow = await fetchHourlyTidePredictions(
      "hourly-cache-test",
      "2026-07-02T00:00:00.000Z",
      "2026-07-02T23:59:00.000Z"
    );
    const narrowWindow = await fetchHourlyTidePredictions(
      "hourly-cache-test",
      "2026-07-02T05:00:00.000Z",
      "2026-07-02T07:00:00.000Z"
    );

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(fullWindow).toHaveLength(24);
    expect(narrowWindow).toEqual([
      {
        ts: "2026-07-02T05:00:00.000Z",
        tide_height_m: 0.5,
        tide_phase: null,
      },
      {
        ts: "2026-07-02T06:00:00.000Z",
        tide_height_m: 0.6,
        tide_phase: null,
      },
      {
        ts: "2026-07-02T07:00:00.000Z",
        tide_height_m: 0.7,
        tide_phase: null,
      },
    ]);
  });

  describe("empty NOAA answers", () => {
    const NO_PREDICTIONS = {
      error: { message: "No Predictions data was found. Please make sure the Datum input is valid." },
    };
    const range = ["2026-09-30T00:00:00.000Z", "2026-10-30T00:00:00.000Z"] as const;
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    it("does not cache an empty hourly answer, so a retry reaches NOAA again", async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(jsonResponse(NO_PREDICTIONS))
        .mockResolvedValueOnce(jsonResponse({ predictions: [{ t: "2026-09-30 01:00", v: "0.4" }] }));

      const first = await fetchHourlyTidePredictions("hourly-empty-retry", ...range);
      const retry = await fetchHourlyTidePredictions("hourly-empty-retry", ...range);

      expect(first).toEqual([]);
      expect(retry).toEqual([{ ts: "2026-09-30T01:00:00.000Z", tide_height_m: 0.4, tide_phase: null }]);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it("still caches a non-empty hourly answer after an empty one", async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(jsonResponse({}))
        .mockResolvedValueOnce(jsonResponse({ predictions: [{ t: "2026-09-30 01:00", v: "0.4" }] }));

      await fetchHourlyTidePredictions("hourly-empty-then-cached", ...range);
      await fetchHourlyTidePredictions("hourly-empty-then-cached", ...range);
      const cached = await fetchHourlyTidePredictions("hourly-empty-then-cached", ...range);

      expect(cached).toHaveLength(1);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it("does not cache an empty high/low answer, so a retry reaches NOAA again", async () => {
      mockFetchWithTimeout
        .mockResolvedValueOnce(jsonResponse(NO_PREDICTIONS))
        .mockResolvedValueOnce(jsonResponse({ predictions: [{ t: "2026-09-30 01:12", v: "1.2", type: "H" }] }))
        .mockImplementation(async () => jsonResponse({ predictions: [] }));

      const first = await fetchHighLowTidePredictions("hilo-empty-retry", ...range);
      const retry = await fetchHighLowTidePredictions("hilo-empty-retry", ...range);
      const cached = await fetchHighLowTidePredictions("hilo-empty-retry", ...range);

      expect(first).toEqual([]);
      expect(retry).toEqual([{ ts: "2026-09-30T01:12:00.000Z", tide_height_m: 1.2, type: "high" }]);
      expect(cached).toEqual(retry);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it("logs the NOAA error message when it returns no predictions", async () => {
      mockFetchWithTimeout.mockImplementation(async () => jsonResponse(NO_PREDICTIONS));

      await fetchHourlyTidePredictions("hourly-empty-log", ...range);
      await fetchHighLowTidePredictions("hilo-empty-log", ...range);

      expect(warn).toHaveBeenCalledWith("NOAA tide request returned no predictions", {
        stationId: "hourly-empty-log",
        begin_date: "20260930",
        end_date: "20261030",
        noaaError: NO_PREDICTIONS.error.message,
      });
      expect(warn).toHaveBeenCalledWith("NOAA high/low tide request returned no predictions", {
        stationId: "hilo-empty-log",
        begin_date: "20260930",
        end_date: "20261030",
        noaaError: NO_PREDICTIONS.error.message,
      });
    });

    it("logs a null NOAA error when the body carries no error message", async () => {
      mockFetchWithTimeout.mockResolvedValue(jsonResponse({ predictions: [] }));

      await fetchHourlyTidePredictions("hourly-empty-no-message", ...range);

      expect(warn).toHaveBeenCalledWith(
        "NOAA tide request returned no predictions",
        expect.objectContaining({ stationId: "hourly-empty-no-message", noaaError: null }),
      );
    });
  });

  it("prefers direct NOAA rows before same-source freshness", async () => {
    const client = createTideForecastClient([
      {
        ts: "2026-06-30T16:00:00.000Z",
        tide_height_m: 1,
        tide_phase: null,
        created_at: "2026-06-30T01:00:00.000Z",
        source: "noaa",
      },
      {
        ts: "2026-06-30T16:00:00.000Z",
        tide_height_m: 1.2,
        tide_phase: "H",
        created_at: "2026-06-30T02:00:00.000Z",
        source: "noaa_hilo_interpolated",
      },
      {
        ts: "2026-06-30T17:00:00.000Z",
        tide_height_m: null,
        tide_phase: null,
        created_at: "2026-06-30T03:00:00.000Z",
        source: "noaa",
      },
      {
        ts: "2026-06-30T18:00:00.000Z",
        tide_height_m: 0.8,
        tide_phase: null,
        created_at: "2026-06-30T02:00:00.000Z",
        source: "noaa",
      },
      {
        ts: "2026-06-30T18:00:00.000Z",
        tide_height_m: 0.9,
        tide_phase: null,
        created_at: "2026-06-30T02:30:00.000Z",
        source: "noaa",
      },
    ]);

    const result = await fetchCachedHourlyTidePredictions(
      client,
      "beach-1",
      "2026-06-30T15:30:00.000Z",
      "2026-06-30T19:00:00.000Z"
    );

    expect(client.from).toHaveBeenCalledWith("tide_forecasts");
    expect(client.chain.eq).toHaveBeenCalledWith("beach_id", "beach-1");
    expect(result).toEqual({
      predictions: [
        {
          ts: "2026-06-30T16:00:00.000Z",
          tide_height_m: 1,
          tide_phase: null,
        },
        {
          ts: "2026-06-30T18:00:00.000Z",
          tide_height_m: 0.9,
          tide_phase: null,
        },
      ],
      latestCreatedAt: "2026-06-30T02:30:00.000Z",
    });
  });

  it("uses a deterministic tie-break when cached rows otherwise tie", async () => {
    const rows = [
      {
        ts: "2026-06-30T16:00:00.000Z",
        tide_height_m: 1,
        tide_phase: "L",
        created_at: "2026-06-30T02:00:00.000Z",
        source: "noaa",
      },
      {
        ts: "2026-06-30T16:00:00.000Z",
        tide_height_m: 1.2,
        tide_phase: "H",
        created_at: "2026-06-30T02:00:00.000Z",
        source: "noaa",
      },
    ];

    const first = await fetchCachedHourlyTidePredictions(
      createTideForecastClient(rows),
      "beach-1",
      "2026-06-30T15:30:00.000Z",
      "2026-06-30T19:00:00.000Z"
    );
    const reversed = await fetchCachedHourlyTidePredictions(
      createTideForecastClient([...rows].reverse()),
      "beach-1",
      "2026-06-30T15:30:00.000Z",
      "2026-06-30T19:00:00.000Z"
    );

    expect(first).toEqual(reversed);
    expect(first.predictions).toEqual([
      {
        ts: "2026-06-30T16:00:00.000Z",
        tide_height_m: 1.2,
        tide_phase: "H",
      },
    ]);
  });

  it("reads one station when the beach's station changed between refreshes", async () => {
    // Older Point Loma hilo rows and newer San Diego direct rows at the same
    // hours: the reader must not alternate between them.
    const client = createTideForecastClient([
      { ts: "2026-09-28T16:00:00.000Z", tide_height_m: 0.9, tide_phase: null, created_at: "2026-09-02T04:00:02.682Z", source: "noaa_hilo_interpolated", station_id: "TWC0405" },
      { ts: "2026-09-28T16:00:00.000Z", tide_height_m: 1.2, tide_phase: null, created_at: "2026-09-16T04:00:02.481Z", source: "noaa", station_id: "9410170" },
      { ts: "2026-09-28T17:00:00.000Z", tide_height_m: 1.0, tide_phase: null, created_at: "2026-09-02T04:00:02.682Z", source: "noaa_hilo_interpolated", station_id: "TWC0405" },
      { ts: "2026-09-28T17:00:00.000Z", tide_height_m: 1.3, tide_phase: null, created_at: "2026-09-16T04:00:02.481Z", source: "noaa", station_id: "9410170" },
    ]);

    const result = await fetchCachedHourlyTidePredictions(
      client,
      "shipwrecks",
      "2026-09-28T15:30:00.000Z",
      "2026-09-28T18:00:00.000Z"
    );

    expect(client.chain.select).toHaveBeenCalledWith(expect.stringContaining("station_id"));
    expect(result.predictions.map((prediction) => prediction.tide_height_m)).toEqual([1.2, 1.3]);
    expect(result.latestCreatedAt).toBe("2026-09-16T04:00:02.481Z");
  });

  it("detects sufficient hourly cache coverage for a requested window", () => {
    const startIso = "2026-06-30T10:30:00.000Z";
    const endIso = "2026-07-01T11:30:00.000Z";
    const coveredPredictions: TidePrediction[] = Array.from({ length: 25 }, (_, index) => ({
      ts: new Date(Date.parse("2026-06-30T11:00:00.000Z") + index * 60 * 60 * 1000).toISOString(),
      tide_height_m: 1,
      tide_phase: null,
    }));

    expect(hasSufficientCachedTideCoverage(coveredPredictions, startIso, endIso)).toBe(true);
    expect(
      hasSufficientCachedTideCoverage(coveredPredictions.slice(0, 5), startIso, endIso)
    ).toBe(false);
  });
});
