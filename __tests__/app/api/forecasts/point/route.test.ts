import { GET, pointMarineForecastHandler } from "@/app/api/forecasts/point/route";
import { fetchPointMarineForecast } from "@/lib/services/point-marine-forecast";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json(body: unknown, init?: { status?: number }) {
      const headers = new Map<string, string>();
      return {
        status: init?.status ?? 200,
        headers: {
          get: (name: string) => headers.get(name.toLowerCase()) ?? null,
          set: (name: string, value: string) => headers.set(name.toLowerCase(), value),
        },
        json: async () => body,
      };
    },
  },
}));

jest.mock("@/lib/services/point-marine-forecast", () => ({
  fetchPointMarineForecast: jest.fn(),
  PointMarineForecastUnavailableError: class PointMarineForecastUnavailableError extends Error {},
}));

const mockFetchPointMarineForecast = fetchPointMarineForecast as jest.MockedFunction<typeof fetchPointMarineForecast>;

function request(url: string, clientId = "203.0.113.10") {
  return {
    nextUrl: new URL(url),
    signal: new AbortController().signal,
    headers: {
      get: (name: string) => name === "x-real-ip" ? clientId : null,
    },
  } as never;
}

describe("GET /api/forecasts/point", () => {
  it("validates coordinates and days before fetching", async () => {
    const response = await pointMarineForecastHandler(
      request("http://localhost/api/forecasts/point?lat=91&lon=-118&days=2"),
      {} as never,
    );

    expect(response.status).toBe(400);
    expect(mockFetchPointMarineForecast).not.toHaveBeenCalled();
  });

  it("returns 401 through the exported authenticated route", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("missing session"),
    });

    const response = await GET(
      request("http://localhost/api/forecasts/point?lat=33.5&lon=-118.5", "203.0.113.11"),
      undefined,
    );

    expect(response.status).toBe(401);
  });

  it("returns 429 after the exported route burst limit is exceeded", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("missing session"),
    });
    const clientId = "203.0.113.200";
    const url = "http://localhost/api/forecasts/point?lat=33.5&lon=-118.5";

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => GET(request(url, clientId), undefined)),
    );

    expect(responses.at(-1)?.status).toBe(429);
    expectConsoleWarnings([/Burst limit exceeded/, /RATE_LIMIT_VIOLATION/]);
  });

  it("serializes a valid point response with no-store cache semantics", async () => {
    mockFetchPointMarineForecast.mockResolvedValueOnce({
      schemaVersion: 1,
      source: "open_meteo",
      sourceModel: "ncep_gfswave016",
      requestedPoint: { lat: 33.5, lon: -118.5 },
      sampledPoint: { lat: 33.535, lon: -118.5 },
      sampleResolution: "offshore_shifted",
      modelRunAt: null,
      fetchedAt: "2026-07-31T12:00:00Z",
      stale: false,
      rows: [],
    });

    const response = await pointMarineForecastHandler(
      request("http://localhost/api/forecasts/point?lat=33.5&lon=-118.5&days=2"),
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        schemaVersion: 1,
        sampledPoint: { lat: 33.535, lon: -118.5 },
      },
    });
    expect(mockFetchPointMarineForecast).toHaveBeenCalledWith(expect.objectContaining({
      lat: 33.5,
      lon: -118.5,
      days: 2,
    }));
  });
});
