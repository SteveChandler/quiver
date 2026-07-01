import {
  displayForForecast,
  parseForecastHeightLabel,
  resolveSelectedHourDisplay,
  resolveTodayHeadline,
} from "@/lib/services/forecast/today-headline";
import { selectBestWindow } from "@/lib/services/discovery/window-selector";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

jest.mock("@/lib/services/discovery/window-selector", () => ({
  selectBestWindow: jest.fn(),
}));

const beach = {
  id: "beach-1",
  name: "Ocean Beach Pier",
  lat: 32.75,
  lon: -117.25,
  timezone: "America/Los_Angeles",
} as unknown as Beach;

function forecast(
  forecastAt: string,
  waveHeight: string | null
): EnhancedForecastEntity {
  return {
    id: forecastAt,
    beach_id: beach.id,
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: forecastAt.slice(11, 19),
    wave_height: waveHeight,
    wave_period: "12s",
    wave_direction: "W",
    wind_speed: "6 mph",
    wind_direction: "E",
    data_source: "NOAA_NWS",
  } as unknown as EnhancedForecastEntity;
}

describe("today-headline forecast display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("formats whole-number rows as a single value", () => {
    expect(parseForecastHeightLabel("2.0ft")).toEqual({
      label: "2ft",
      minFt: 2,
      maxFt: 2,
    });
  });

  it("preserves range labels through the shared floor/ceil contract", () => {
    expect(parseForecastHeightLabel("2.2-3.1 ft")).toEqual({
      label: "2-4ft",
      minFt: 2,
      maxFt: 4,
    });
  });

  it("returns selected-hour context for explicit forecast rows", () => {
    const row = forecast("2026-06-20T18:00:00Z", "2.7 ft");

    expect(resolveSelectedHourDisplay(row)).toEqual({
      label: "2-3ft",
      minFt: 2,
      maxFt: 3,
      forecastAt: "2026-06-20T18:00:00Z",
      context: "selected_hour",
    });
  });

  it("uses the surf-call selected window source row as the today headline", () => {
    const currentRow = forecast("2026-06-20T13:00:00Z", "1.9 ft");
    const headlineRow = forecast("2026-06-20T22:00:00Z", "2.7 ft");
    (selectBestWindow as jest.Mock).mockReturnValue({
      start: new Date(headlineRow.forecast_at),
      end: new Date("2026-06-21T01:00:00Z"),
      tide: "Falling",
      wind: "6 mph E",
      waveHeight: headlineRow.wave_height,
      wavePeriod: "12s",
      dataSource: "NOAA_NWS",
      confidence: 80,
      timezone: "America/Los_Angeles",
      sourceForecast: headlineRow,
    });

    const result = resolveTodayHeadline({
      forecasts: [currentRow, headlineRow],
      beach,
      userPrefs: null,
      horizonHours: 24,
    });

    expect(result?.display).toEqual({
      label: "2-3ft",
      minFt: 2,
      maxFt: 3,
      forecastAt: headlineRow.forecast_at,
      context: "today_headline",
    });
  });

  it("returns null when a row has no parseable wave height", () => {
    expect(displayForForecast(forecast("2026-06-20T18:00:00Z", "knee high"), "today_headline")).toBeNull();
  });
});
