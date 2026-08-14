import {
  getCityTideDataExpanded,
  CityTideDataExpanded,
} from "@/actions/forecast/intent-forecast-actions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: jest.fn(async (beaches: Array<{ id: string }>) => beaches),
  selectBeach: jest.fn(async <T extends { id: string }>(beach: T | null) => beach),
}));

/**
 * Generate sinusoidal tide samples (hourly) between two dates.
 * Produces ~2 highs and ~2 lows per day (semidiurnal tide).
 */
function generateTideSamples(
  startDate: Date,
  endDate: Date
): Array<{ ts: string; tide_height_m: number; tide_ft: number }> {
  const samples: Array<{ ts: string; tide_height_m: number; tide_ft: number }> = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const hours = (current.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    // Semidiurnal: period ~12.42h, amplitude 1m, offset 1.5m
    const heightM = 1.5 + Math.sin((2 * Math.PI * hours) / 12.42);
    const heightFt = heightM * 3.28084;
    samples.push({
      ts: current.toISOString(),
      tide_height_m: Math.round(heightM * 100) / 100,
      tide_ft: Math.round(heightFt * 100) / 100,
    });
    current.setTime(current.getTime() + 60 * 60 * 1000); // +1 hour
  }
  return samples;
}

/**
 * Build a chainable mock that records .from() table name and routes queries.
 */
function createMockSupabase(options: {
  baseTideData: Record<string, unknown>;
  repBeach: { id: string; name: string; timezone: string | null };
  tideSamples: Array<{ ts: string; tide_height_m: number; tide_ft: number }>;
  cityBeaches: Array<Record<string, unknown>>;
}) {
  const { baseTideData, repBeach, tideSamples, cityBeaches } = options;

  // Track call count per table to distinguish first vs second call
  const fromCallCount: Record<string, number> = {};

  const mockFrom = jest.fn().mockImplementation((table: string) => {
    fromCallCount[table] = (fromCallCount[table] || 0) + 1;

    if (table === "enhanced_forecasts") {
      // getCityTideData query - returns base tide data with beach join
      return makeChainable({ data: baseTideData, error: null });
    }

    if (table === "beaches") {
      const callNum = fromCallCount[table];
      if (callNum === 1) {
        // findRepresentativeBeach - first call with state
        return makeChainable({ data: repBeach, error: null });
      }
      // fetchExpandedTideData - city beaches for preferences
      return makeChainable({ data: cityBeaches, error: null });
    }

    if (table === "tide_forecasts") {
      // fetchExpandedTideData - hourly tide data filtered by .gte/.lte
      let filteredSamples = [...tideSamples];
      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.gte = jest.fn().mockImplementation((_col: string, val: string) => {
        filteredSamples = filteredSamples.filter((s) => s.ts >= val);
        return chain;
      });
      chain.lte = jest.fn().mockImplementation((_col: string, val: string) => {
        filteredSamples = filteredSamples.filter((s) => s.ts <= val);
        return chain;
      });
      chain.order = jest.fn().mockImplementation(() => {
        filteredSamples.sort((a, b) => a.ts.localeCompare(b.ts));
        return { data: filteredSamples, error: null };
      });
      return chain;
    }

    return makeChainable({ data: null, error: null });
  });

  return { from: mockFrom };
}

/** Create a simple chainable mock that resolves any chain to a final value. */
function makeChainable(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ["select", "eq", "ilike", "gte", "lt", "lte", "not", "order", "limit", "single"];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  // Terminal methods that return the result
  chain.single = jest.fn().mockResolvedValue(result);
  // order() in some paths is terminal (returns data directly)
  // But for beaches query in fetchExpandedTideData, order is terminal
  // We handle this by making the mock both chainable and awaitable
  const orderOriginal = chain.order;
  chain.order = jest.fn().mockImplementation(() => {
    const proxy: Record<string, unknown> = { ...chain, then: (resolve: (v: unknown) => void) => resolve(result) };
    proxy.order = orderOriginal;
    return proxy;
  });
  return chain;
}

describe("getCityTideDataExpanded", () => {
  const realDate = Date;

  afterEach(() => {
    jest.restoreAllMocks();
    global.Date = realDate;
  });

  function mockDateNow(fakeNow: Date) {
    const OrigDate = realDate;
    global.Date = class extends OrigDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fakeNow.getTime());
        } else {
          // @ts-expect-error - spread into Date constructor
          super(...args);
        }
      }

      static now() {
        return fakeNow.getTime();
      }
    } as DateConstructor;
  }

  it("includes past hours in hourlyPoints but excludes past days from sevenDayExtrema", async () => {
    // Fix "now" to a known date
    const fakeNow = new Date("2026-02-12T12:00:00-08:00"); // noon PST
    mockDateNow(fakeNow);

    // Generate tide data spanning 2 days ago through 7 days ahead
    const start = new Date("2026-02-10T12:00:00-08:00");
    const end = new Date("2026-02-19T12:00:00-08:00");
    const tideSamples = generateTideSamples(start, end);

    const baseTideData = {
      beach_id: "beach-1",
      tide_status: "Rising",
      tide_height: "3.0 ft",
      next_tide_time: "3:00 PM",
      next_tide_type: "High",
      next_tide_height: "5.0 ft",
      raw_forecast: {
        tide_schedule: [
          { time: Math.floor(fakeNow.getTime() / 1000), height: 5.0, type: "high" },
        ],
        tide_station: { id: "9410230", name: "La Jolla, CA" },
      },
      beaches: { id: "beach-1", name: "Test Beach", city: "San Diego", state: "CA" },
    };

    const mockSupa = createMockSupabase({
      baseTideData,
      repBeach: { id: "beach-1", name: "Test Beach", timezone: "America/Los_Angeles" },
      tideSamples,
      cityBeaches: [
        { name: "Test Beach", slug: "test-beach", preferred_tide_ft_min: 1, preferred_tide_ft_max: 4, preferred_tide_direction: "incoming", skill_level: "beginner" },
      ],
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(mockSupa);

    const result = await getCityTideDataExpanded("San Diego", "CA");

    expect(result).not.toBeNull();
    const data = result as CityTideDataExpanded;

    // hourlyPoints should include past data (for chart rendering)
    const pastPoints = data.hourlyPoints.filter(
      (p) => new Date(p.time) < fakeNow
    );
    expect(pastPoints.length).toBeGreaterThan(0);

    // sevenDayExtrema should only contain today and future days
    // date format is MM/DD/YYYY from en-US locale
    for (const day of data.sevenDayExtrema) {
      // Parse MM/DD/YYYY
      const [m, d, y] = day.date.split("/").map(Number);
      const dayDate = new Date(y, m - 1, d);
      const todayMidnight = new Date(2026, 1, 12); // Feb 12, 2026
      expect(dayDate.getTime()).toBeGreaterThanOrEqual(todayMidnight.getTime());
    }

    // Should have at most 7 days
    expect(data.sevenDayExtrema.length).toBeLessThanOrEqual(7);

    // First day should be today
    if (data.sevenDayExtrema.length > 0) {
      expect(data.sevenDayExtrema[0].isToday).toBe(true);
    }
  });

  it("sorts days correctly across year boundary (Dec 31 → Jan 1)", async () => {
    // Fix "now" to Jan 1, 2027 at noon PST
    const fakeNow = new Date("2027-01-01T12:00:00-08:00");
    mockDateNow(fakeNow);

    // Generate data spanning Dec 30, 2026 through Jan 8, 2027
    const start = new Date("2026-12-30T00:00:00-08:00");
    const end = new Date("2027-01-08T23:00:00-08:00");
    const tideSamples = generateTideSamples(start, end);

    const baseTideData = {
      beach_id: "beach-1",
      tide_status: "Falling",
      tide_height: "2.0 ft",
      next_tide_time: "5:00 PM",
      next_tide_type: "Low",
      next_tide_height: "0.5 ft",
      raw_forecast: {
        tide_schedule: [
          { time: Math.floor(fakeNow.getTime() / 1000), height: 2.0, type: "low" },
        ],
        tide_station: { id: "9410230", name: "La Jolla, CA" },
      },
      beaches: { id: "beach-1", name: "Test Beach", city: "San Diego", state: "CA" },
    };

    const mockSupa = createMockSupabase({
      baseTideData,
      repBeach: { id: "beach-1", name: "Test Beach", timezone: "America/Los_Angeles" },
      tideSamples,
      cityBeaches: [],
    });

    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(mockSupa);

    const result = await getCityTideDataExpanded("San Diego", "CA");
    expect(result).not.toBeNull();
    const data = result as CityTideDataExpanded;

    // No December days should appear — only Jan 1+
    for (const day of data.sevenDayExtrema) {
      const [m, , y] = day.date.split("/").map(Number);
      if (y === 2026) {
        fail(`Past year day found in sevenDayExtrema: ${day.date}`);
      }
      // All should be January 2027
      expect(y).toBe(2027);
      expect(m).toBe(1);
    }

    // Days should be in chronological order
    for (let i = 1; i < data.sevenDayExtrema.length; i++) {
      const [pm, pd] = data.sevenDayExtrema[i - 1].date.split("/").map(Number);
      const [cm, cd] = data.sevenDayExtrema[i].date.split("/").map(Number);
      const prevDay = new Date(2027, pm - 1, pd);
      const currDay = new Date(2027, cm - 1, cd);
      expect(currDay.getTime()).toBeGreaterThan(prevDay.getTime());
    }
  });
});
