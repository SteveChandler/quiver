/** @jest-environment node */

const mockFetchWithTimeout = jest.fn();

jest.mock("@/lib/utils/fetch-utils", () => ({
  fetchWithTimeout: (...args: any[]) => mockFetchWithTimeout(...args),
}));

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
