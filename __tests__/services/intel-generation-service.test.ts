/**
 * @jest-environment node
 */

import type { AuthoritativeWindow } from "@/lib/services/discovery";

const mockFrom = jest.fn();
const mockGetBatchSunTimes = jest.fn();
const mockSelectBeachDayWindows = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@/lib/services/discovery", () => ({
  getBatchSunTimes: (...args: unknown[]) => mockGetBatchSunTimes(...args),
  selectBeachDayWindows: (...args: unknown[]) =>
    mockSelectBeachDayWindows(...args),
}));

jest.mock("@/lib/analyzers/wind-analyzer", () => ({
  calculateOnOffshore: jest.fn(() => false),
  analyzeWindConditions: jest.fn(() => ({
    status: "optimal",
    emoji: "✅",
    message: "light winds",
  })),
  windAt: jest.fn(() => ({
    speed: 3,
    direction: 270,
    cardinal: "W",
    offshore: false,
    description: "light winds",
  })),
}));

import { IntelGenerationService } from "@/lib/services/intel-generation-service";

interface MockQueryBuilder {
  select: jest.Mock<MockQueryBuilder, [string]>;
  eq: jest.Mock<MockQueryBuilder, [string, unknown]>;
  gte: jest.Mock<MockQueryBuilder, [string, string]>;
  lt: jest.Mock<MockQueryBuilder, [string, string]>;
  order: jest.Mock<Promise<unknown>, [string, { ascending: boolean }]>;
  single: jest.Mock<Promise<unknown>, []>;
  maybeSingle: jest.Mock<Promise<unknown>, []>;
  upsert: jest.Mock<Promise<unknown>, [unknown, unknown]>;
}

function queryBuilder(result: unknown): MockQueryBuilder {
  const builder = {} as MockQueryBuilder;
  builder.select = jest.fn<MockQueryBuilder, [string]>(() => builder);
  builder.eq = jest.fn<MockQueryBuilder, [string, unknown]>(() => builder);
  builder.gte = jest.fn<MockQueryBuilder, [string, string]>(() => builder);
  builder.lt = jest.fn<MockQueryBuilder, [string, string]>(() => builder);
  builder.order = jest.fn<
    Promise<unknown>,
    [string, { ascending: boolean }]
  >(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.upsert = jest.fn<Promise<unknown>, [unknown, unknown]>(() =>
    Promise.resolve(result)
  );
  return builder;
}

const beachRow = {
  id: "beach-1",
  name: "Pacific Test Beach",
  timezone: "America/Los_Angeles",
  swell_window_min_deg: null,
  swell_window_max_deg: null,
  wind_offshore_deg: null,
  wind_offshore_tol_deg: null,
  preferred_tide_ft_min: null,
  preferred_tide_ft_max: null,
  hazards: null,
  skill_level: null,
  break_type: "beach",
  aspect_deg: 270,
};

function forecastRow(
  id: string,
  forecastAt: string,
  waveHeight: string
): Record<string, unknown> {
  return {
    id,
    beach_id: "beach-1",
    forecast_at: forecastAt,
    forecast_date: "2026-06-20",
    forecast_time: forecastAt.slice(11, 19),
    wave_height: waveHeight,
    wave_period: "14s",
    wave_direction: "W",
    wind_speed: "3 mph",
    wind_direction: "W",
    tide_height: "3 ft",
    tide_status: "rising",
    swell_1_height: waveHeight,
    swell_1_period: "14s",
    swell_1_direction: "W",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    confidence_score: 85,
  };
}

function authorityResult(bestDayWindow: AuthoritativeWindow | null) {
  return {
    localDate: "2026-06-20",
    timezone: "America/Los_Angeles",
    bestDayWindow,
    dayparts: { morning: null, midday: null, evening: bestDayWindow },
    rankedWindows: bestDayWindow ? [bestDayWindow] : [],
  };
}

describe("IntelGenerationService", () => {
  let forecastQuery: MockQueryBuilder;
  let intelQuery: MockQueryBuilder;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-20T13:00:00.000Z"));
    jest.clearAllMocks();

    forecastQuery = queryBuilder({
      data: [
        forecastRow("morning", "2026-06-20T13:00:00.000Z", "3 ft"),
        forecastRow("afternoon", "2026-06-20T22:00:00.000Z", "9 ft"),
      ],
      error: null,
    });
    intelQuery = queryBuilder({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "beaches") {
        return queryBuilder({ data: beachRow, error: null });
      }
      if (table === "enhanced_forecasts") return forecastQuery;
      if (table === "beach_water_quality") {
        return queryBuilder({ data: null, error: null });
      }
      if (table === "beach_daily_intel") return intelQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    mockGetBatchSunTimes.mockResolvedValue(new Map());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("names the selector's afternoon display window and saves its bounds", async () => {
    const bestDayWindow = {
      start: new Date("2026-06-20T21:00:00.000Z"),
      end: new Date("2026-06-21T01:00:00.000Z"),
      peakTime: new Date("2026-06-20T23:00:00.000Z"),
      displayWindowStart: new Date("2026-06-20T21:30:00.000Z"),
      displayWindowEnd: new Date("2026-06-21T00:00:00.000Z"),
      timezone: "America/Los_Angeles",
    } as AuthoritativeWindow;
    mockSelectBeachDayWindows.mockReturnValue(authorityResult(bestDayWindow));

    const service = new IntelGenerationService(
      "https://example.supabase.co",
      "test-key"
    );
    const intel = await service.generateIntel(
      "beach-1",
      "06:00",
      "America/Los_Angeles"
    );

    expect(forecastQuery.select).toHaveBeenCalledWith("*");
    expect(forecastQuery.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-06-20T07:00:00.000Z"
    );
    expect(forecastQuery.lt).toHaveBeenCalledWith(
      "forecast_at",
      "2026-06-21T07:00:00.000Z"
    );
    expect(mockGetBatchSunTimes).toHaveBeenCalledWith(
      ["beach-1"],
      ["2026-06-20"]
    );
    expect(mockSelectBeachDayWindows).toHaveBeenCalledWith(
      expect.objectContaining({
        forecasts: expect.arrayContaining([
          expect.objectContaining({ id: "morning" }),
          expect.objectContaining({ id: "afternoon" }),
        ]),
        localDate: "2026-06-20",
        now: new Date("2026-06-20T13:00:00.000Z"),
        userPrefs: null,
      })
    );
    expect(intel.surf.max).toBe(3);
    expect(intel.bestWindow).toBe("14:30–17:00");
    expect(intel.payload).toMatchObject({
      bestWindow: "14:30–17:00",
      bestWindowStart: "2026-06-20T21:30:00.000Z",
      bestWindowEnd: "2026-06-21T00:00:00.000Z",
    });

    await service.saveIntel(
      "beach-1",
      intel,
      "06:00",
      "America/Los_Angeles"
    );

    expect(intelQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        best_window_start: "14:30",
        best_window_end: "17:00",
        best_window_description: null,
        raw_intel_data: intel,
      }),
      {
        onConflict: "beach_id,forecast_date,generation_time",
        ignoreDuplicates: false,
      }
    );
  });

  it("uses the existing fallback when the selector finds no window", async () => {
    mockSelectBeachDayWindows.mockReturnValue(authorityResult(null));
    const service = new IntelGenerationService(
      "https://example.supabase.co",
      "test-key"
    );

    const intel = await service.generateIntel(
      "beach-1",
      "06:00",
      "America/Los_Angeles"
    );

    expect(intel.bestWindow).toBe(
      "Variable conditions; check throughout the morning"
    );
    expect(intel.payload.bestWindowStart).toBeUndefined();
    expect(intel.payload.bestWindowEnd).toBeUndefined();
  });
});
