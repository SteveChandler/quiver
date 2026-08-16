jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (forecasts) => forecasts),
}));

import { getDailyIntelWaveHeightLabels } from "@/lib/services/intel/wave-height-labels";

function queryResult(data: unknown[]) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    then: (resolve: any) => resolve({ data, error: null }),
  };
  return chain;
}

describe("getDailyIntelWaveHeightLabels", () => {
  it("returns current and best-window labels from enhanced forecasts", async () => {
    const currentQuery = queryResult([
      {
        id: "current",
        beach_id: "beach-1",
        forecast_at: "2026-05-18T18:00:00.000Z",
        forecast_date: "2026-05-18",
        forecast_time: "11:00:00",
        wave_height: "2.6 ft",
      },
    ]);
    const windowQuery = queryResult([
      {
        id: "window-1",
        beach_id: "beach-1",
        forecast_at: "2026-05-18T13:00:00.000Z",
        forecast_date: "2026-05-18",
        forecast_time: "06:00:00",
        wave_height: "3.2 ft",
      },
      {
        id: "window-2",
        beach_id: "beach-1",
        forecast_at: "2026-05-18T16:00:00.000Z",
        forecast_date: "2026-05-18",
        forecast_time: "09:00:00",
        wave_height: "4.1 ft",
      },
    ]);
    const mockSupabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(currentQuery)
        .mockReturnValueOnce(windowQuery),
    };

    // No beach timezone supplied: falls back to UTC, so a 06:00-09:00
    // "local" window is treated as UTC (matches beaches with unknown tz).
    const labels = await getDailyIntelWaveHeightLabels(
      mockSupabase as any,
      "beach-1",
      "2026-05-18",
      {
        bestWindowStart: "06:00:00",
        bestWindowEnd: "09:00:00",
      }
    );

    expect(labels).toEqual({
      current_wave_height_label: "2-3ft",
      best_window_wave_height_label: "3-5ft",
    });
    expect(currentQuery.gte).toHaveBeenCalledWith(
      "forecast_at",
      expect.any(String)
    );
    expect(windowQuery.eq).toHaveBeenCalledWith("beach_id", "beach-1");
    expect(windowQuery.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-05-18T06:00:00.000Z"
    );
    expect(windowQuery.lte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-05-18T09:00:00.000Z"
    );
  });

  it("converts a beach-local best window to UTC bounds using the beach timezone (regression: best-window query must not treat local wall-clock as UTC)", async () => {
    const currentQuery = queryResult([]);
    const windowQuery = queryResult([]);
    const mockSupabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(currentQuery)
        .mockReturnValueOnce(windowQuery),
    };

    // 2026-07-15 is in July: America/Los_Angeles observes PDT (UTC-7),
    // not PST (UTC-8), because DST runs mid-March through early November.
    // A 07:00:00-10:00:00 PDT local window is therefore 14:00:00Z-17:00:00Z,
    // NOT 15:00:00Z-18:00:00Z (which would be the PST/UTC-8 offset).
    await getDailyIntelWaveHeightLabels(
      mockSupabase as any,
      "beach-1",
      "2026-07-15",
      {
        bestWindowStart: "07:00:00",
        bestWindowEnd: "10:00:00",
      },
      "America/Los_Angeles"
    );

    expect(windowQuery.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-15T14:00:00.000Z"
    );
    expect(windowQuery.lte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-15T17:00:00.000Z"
    );

    // Without the fix, toForecastAt naively appended "Z" and would have
    // queried 2026-07-15T07:00:00.000Z-2026-07-15T10:00:00.000Z instead —
    // 7 hours off, which for this PDT beach is the middle of the night.
    expect(windowQuery.gte).not.toHaveBeenCalledWith(
      "forecast_at",
      "2026-07-15T07:00:00.000Z"
    );
  });

  it("converts a beach-local best window to UTC bounds during standard time (PST, UTC-8)", async () => {
    const currentQuery = queryResult([]);
    const windowQuery = queryResult([]);
    const mockSupabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(currentQuery)
        .mockReturnValueOnce(windowQuery),
    };

    // 2026-01-15 is in January: America/Los_Angeles observes PST (UTC-8).
    // A 07:00:00-10:00:00 PST local window is therefore 15:00:00Z-18:00:00Z.
    await getDailyIntelWaveHeightLabels(
      mockSupabase as any,
      "beach-1",
      "2026-01-15",
      {
        bestWindowStart: "07:00:00",
        bestWindowEnd: "10:00:00",
      },
      "America/Los_Angeles"
    );

    expect(windowQuery.gte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-01-15T15:00:00.000Z"
    );
    expect(windowQuery.lte).toHaveBeenCalledWith(
      "forecast_at",
      "2026-01-15T18:00:00.000Z"
    );
  });
});
