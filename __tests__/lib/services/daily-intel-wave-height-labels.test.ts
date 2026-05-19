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
    expect(windowQuery.eq).toHaveBeenCalledWith("forecast_date", "2026-05-18");
    expect(windowQuery.gte).toHaveBeenCalledWith(
      "forecast_time",
      "06:00:00"
    );
    expect(windowQuery.lte).toHaveBeenCalledWith(
      "forecast_time",
      "09:00:00"
    );
  });
});
