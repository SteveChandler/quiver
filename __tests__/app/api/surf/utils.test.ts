/**
 * @jest-environment node
 */

jest.mock("@/lib/constants/beach-coordinates", () => ({
  beachCoordinates: {
    "ocean beach": { lat: 32.75, lon: -117.25 },
    "blacks beach": { lat: 32.885, lon: -117.252 },
  },
  beachNames: ["ocean beach", "blacks beach"],
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/actions/beach-actions", () => ({
  getBeaches: jest.fn(),
}));

jest.mock("@/actions/forecast-actions", () => ({
  getBeachForecasts: jest.fn(),
  getLatestBeachForecast: jest.fn(),
}));

const mockRankBeaches = jest.fn(async <T extends { id: string }>(beaches: T[]) =>
  beaches,
);

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (beaches: Array<{ id: string }>) => mockRankBeaches(beaches),
}));

// Make this file a module to avoid global type conflicts
export {};

type LocalQueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

function createThenableQuery<T>(result: LocalQueryResult<T>) {
  const self: Record<string, unknown> = {};

  self.select = jest.fn((_sel?: unknown, _opts?: unknown) => self);
  self.eq = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.gte = jest.fn((_field?: unknown, _value?: unknown) => self);
  self.order = jest.fn((_field?: unknown, _opts?: unknown) => self);
  self.limit = jest.fn((_n?: unknown) => self);

  self.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(result).then(
      onFulfilled as (value: LocalQueryResult<T>) => unknown,
      onRejected as (reason: unknown) => unknown
    );

  return self;
}

describe("app/api/surf/utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("resolveBeach: direct match by name", async () => {
    const { resolveBeach } = await import("@/app/api/surf/utils");
    const res = resolveBeach("Ocean Beach");
    expect(res).toEqual({ name: "ocean beach", lat: 32.75, lon: -117.25 });
  });

  test("resolveBeach: fuzzy match finds contained beach name", async () => {
    const { resolveBeach } = await import("@/app/api/surf/utils");
    const res = resolveBeach("Ocean Beach, San Diego");
    expect(res.name).toBe("ocean beach");
  });

  test("resolveBeach: coordinates input returns nearest beach", async () => {
    const { resolveBeach } = await import("@/app/api/surf/utils");
    const res = resolveBeach({ lat: 32.8849, lon: -117.2521 });
    expect(res.name).toBe("blacks beach");
  });

  test("fetchForecast: returns first enhanced forecast entry when available", async () => {
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { getBeachForecasts } = await import("@/actions/forecast-actions");

    const beachesResult = [
      { id: "b1", name: "Ocean Beach", lat: 32.75, lon: -117.25 },
      { id: "b2", name: "Blacks Beach", lat: 32.885, lon: -117.252 },
    ];

    const forecastRow = {
      beach_id: "b1",
      wave_height: "3-4 ft",
      water_temp: "60",
      wind_speed: "5",
      forecast_at: "2026-01-01T06:00:00Z",
      forecast_date: "2026-01-01",
      forecast_time: "06:00:00",
    };

    const beachesQuery = createThenableQuery<any[]>({ data: beachesResult, error: null });

    (getBeachForecasts as unknown as jest.Mock).mockResolvedValue({
      success: true,
      data: [forecastRow],
    });

    (createSupabaseServiceRoleClient as unknown as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "beaches") return beachesQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const { fetchForecast } = await import("@/app/api/surf/utils");
    const res = await fetchForecast(32.75, -117.25);

    expect(res).toEqual(forecastRow);
    expect(mockRankBeaches).toHaveBeenCalled();
  });

  test("getSurfForecast: beach name path uses getBeaches + getBeachForecasts", async () => {
    const { getBeaches } = await import("@/actions/beach-actions");
    const { getBeachForecasts, getLatestBeachForecast } = await import(
      "@/actions/forecast-actions"
    );

    (getBeaches as unknown as jest.Mock).mockResolvedValue({
      success: true,
      data: [{ id: "b1", name: "Ocean Beach", lat: 32.75, lon: -117.25 }],
    });

    (getBeachForecasts as unknown as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          wave_height: "3-4 ft",
          water_temp: "60",
          wind_speed: "5",
          forecast_at: "2026-01-01T06:00:00Z",
          forecast_date: "2026-01-01",
          forecast_time: "06:00:00",
        },
      ],
    });

    (getLatestBeachForecast as unknown as jest.Mock).mockResolvedValue({
      success: false,
      data: [],
      error: "not used",
    });

    const { getSurfForecast } = await import("@/app/api/surf/utils");
    const res = await getSurfForecast({ beach: "ocean" });

    expect(res.beach).toBe("Ocean Beach");
    expect(res.coords).toEqual({ lat: 32.75, lon: -117.25 });
    expect(res.forecast.forecast_date).toBe("2026-01-01");
  });

  test("getSurfForecast: throws when neither beach nor coords provided", async () => {
    const { getSurfForecast } = await import("@/app/api/surf/utils");
    await expect(getSurfForecast({})).rejects.toThrow(
      "Either beach name or coordinates must be provided"
    );
  });
});




