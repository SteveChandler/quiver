import {
  buildForecastRecommendationContext,
  type ForecastRecommendationContext,
} from "@/lib/services/forecast-recommendation-context";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PersonalizedForecastWindow } from "@/types/personalization";

function beach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "obp",
    name: "Ocean Beach Pier",
    timezone: "America/Los_Angeles",
    ...overrides,
  } as Beach;
}

function row(overrides: Partial<EnhancedForecastEntity> & { forecast_at: string }): EnhancedForecastEntity {
  const { forecast_at, ...rest } = overrides;
  return {
    id: rest.id ?? forecast_at,
    beach_id: "obp",
    forecast_at,
    forecast_date: forecast_at.slice(0, 10),
    forecast_time: "00:00:00",
    wave_height: overrides.wave_height ?? "2.1 ft",
    wave_period: overrides.wave_period ?? "7s",
    wave_direction: overrides.wave_direction ?? "S",
    swell_1_period: overrides.swell_1_period ?? overrides.wave_period ?? "7s",
    swell_1_direction: overrides.swell_1_direction ?? overrides.wave_direction ?? "S",
    water_temp: null,
    wind_speed: overrides.wind_speed ?? "4 mph",
    wind_direction: overrides.wind_direction ?? "S",
    tide_status: null,
    tide_height: null,
    confidence_score: overrides.confidence_score ?? 75,
    data_source: "CDIP",
    created_at: "2026-05-08T00:00:00.000Z",
    updated_at: "2026-05-08T00:00:00.000Z",
    ...rest,
  };
}

function expectContext(
  context: ForecastRecommendationContext | null,
  recommendationType: ForecastRecommendationContext["recommendationType"],
) {
  expect(context).not.toBeNull();
  expect(context?.beachId).toBe("obp");
  expect(context?.localDate).toBe("2026-05-08");
  expect(context?.recommendationType).toBe(recommendationType);
  expect(context?.contextType).toBe(recommendationType);
  expect(context?.resolverUsed).toBe("surf-call");
  expect(context?.timezone).toBe("America/Los_Angeles");
}

describe("buildForecastRecommendationContext", () => {
  it("uses the selected best window over earlier matching rows", () => {
    const sourceForecast = row({
      forecast_at: "2026-05-08T23:00:00.000Z",
      wave_height: "2.7 ft",
      wave_period: "13s",
      wave_direction: "SW",
      swell_1_period: "13s",
      swell_1_direction: "SW",
      wind_speed: "5 mph",
      wind_direction: "W",
    });
    const window: PersonalizedForecastWindow = {
      start: new Date("2026-05-08T22:30:00.000Z"),
      end: new Date("2026-05-09T01:30:00.000Z"),
      tide: "Rising",
      wind: "5 mph W",
      waveHeight: "2.7 ft",
      wavePeriod: "13s",
      dataSource: "CDIP",
      confidence: 80,
      timezone: "America/Los_Angeles",
      score: 72,
      peakTime: new Date("2026-05-08T23:00:00.000Z"),
      sourceForecast,
    };

    const context = buildForecastRecommendationContext({
      beach: beach(),
      forecasts: [
        row({ forecast_at: "2026-05-08T21:00:00.000Z", wave_height: "1.1 ft", wave_period: "8s", wind_speed: "10 mph" }),
        sourceForecast,
      ],
      window,
      now: new Date("2026-05-08T13:00:00.000Z"),
    });

    expectContext(context, "best_window");
    expect(context?.startTime).toBe("2026-05-08T22:30:00.000Z");
    expect(context?.endTime).toBe("2026-05-09T01:30:00.000Z");
    expect(context?.selectedRowTime).toBe("2026-05-08T23:00:00.000Z");
    expect(context?.waveHeight).toBe("2.7 ft");
    expect(context?.waveHeightFt).toBe(2.7);
    expect(context?.waveHeightRangeLabel).toBe("2-3 ft");
    expect(context?.swellPeriod).toBe("13s");
    expect(context?.periodSec).toBe(13);
    expect(context?.swellDirection).toBe("SW");
    expect(context?.windSpeed).toBe("5 mph");
    expect(context?.windDirection).toBe("W");
    expect(context?.selectedWindowStart).toBe("2026-05-08T22:30:00.000Z");
    expect(context?.selectedWindowEnd).toBe("2026-05-09T01:30:00.000Z");
    expect(context?.displayWindowStart).toBe("2026-05-08T22:30:00.000Z");
    expect(context?.displayWindowEnd).toBe("2026-05-09T01:00:00.000Z");
    expect(context?.displayTimeLabel).toBe("Best window: 3:30-6:00 PM");
    expect(context?.conditionDrivers).toEqual({
      wave: "2-3 ft",
      energy: "13s SW energy",
      wind: "5 mph W clean",
      tide: null,
    });
    expect(context?.source).toBe("looking_ahead");
  });

  it("uses OM south swell context when a named north component is outside the beach swell window", () => {
    const context = buildForecastRecommendationContext({
      beach: beach({
        id: "canoes",
        name: "Waikiki - Canoes",
        timezone: "Pacific/Honolulu",
        swell_window_center_deg: 200,
        swell_window_halfwidth_deg: 65,
      } as Partial<Beach>),
      forecasts: [
        row({
          beach_id: "canoes",
          forecast_at: "2026-05-27T16:00:00.000Z",
          wave_height: "2-3ft",
          wave_period: "11s",
          wave_direction: "N",
          swell_1_period: "11s",
          swell_1_direction: "N",
          swell_period_om: 12,
          swell_direction_om: 188,
          wind_speed: "12 mph",
          wind_direction: "ENE",
        }),
      ],
      window: null,
      now: new Date("2026-05-27T16:38:00.000Z"),
      timezone: "Pacific/Honolulu",
    });

    expect(context?.recommendationType).toBe("now");
    expect(context?.swellPeriod).toBe("12s");
    expect(context?.periodSec).toBe(12);
    expect(context?.swellDirection).toBe("S");
  });

  it("uses the nearest peak forecast for selected sample and condition drivers", () => {
    const startForecast = row({
      forecast_at: "2026-05-08T22:30:00.000Z",
      wave_height: "1.8 ft",
      wave_period: "9s",
      wave_direction: "SSW",
      swell_1_period: "9s",
      swell_1_direction: "SSW",
      wind_speed: "10 mph",
      wind_direction: "SW",
      tide_height: "1.2 ft",
      tide_status: "Low",
    });
    const peakForecast = row({
      forecast_at: "2026-05-09T00:00:00.000Z",
      wave_height: "3.2 ft",
      wave_period: "15s",
      wave_direction: "W",
      swell_1_period: "15s",
      swell_1_direction: "W",
      wind_speed: "3 mph",
      wind_direction: "WNW",
      tide_height: "3.1 ft",
      tide_status: "Falling",
    });
    const window: PersonalizedForecastWindow = {
      start: new Date("2026-05-08T22:30:00.000Z"),
      end: new Date("2026-05-09T01:30:00.000Z"),
      tide: "Falling",
      wind: "10 mph SW",
      waveHeight: "1.8 ft",
      wavePeriod: "9s",
      dataSource: "CDIP",
      confidence: 88,
      timezone: "America/Los_Angeles",
      score: 84,
      peakTime: new Date("2026-05-09T00:00:00.000Z"),
      sourceForecast: startForecast,
    };

    const context = buildForecastRecommendationContext({
      beach: beach(),
      forecasts: [startForecast, peakForecast],
      window,
      now: new Date("2026-05-08T13:00:00.000Z"),
    });

    expectContext(context, "best_window");
    expect(context?.selectedRowTime).toBe("2026-05-09T00:00:00.000Z");
    expect(context?.displayWindowStart).toBe("2026-05-08T22:45:00.000Z");
    expect(context?.displayWindowEnd).toBe("2026-05-09T01:15:00.000Z");
    expect(context?.waveHeight).toBe("3.2 ft");
    expect(context?.waveHeightRangeLabel).toBe("3-4 ft");
    expect(context?.swellPeriod).toBe("15s");
    expect(context?.swellDirection).toBe("W");
    expect(context?.windSpeed).toBe("3 mph");
    expect(context?.windDirection).toBe("WNW");
    expect(context?.conditionDrivers).toEqual({
      wave: "3-4 ft",
      energy: "15s W energy",
      wind: "3 mph WNW clean",
      tide: "3.1 ft falling",
    });
  });

  it("parses display ranges as positive wave heights", () => {
    const sourceForecast = row({
      forecast_at: "2026-05-08T23:00:00.000Z",
      wave_height: "4-5ft",
      wave_period: "12s",
      wave_direction: "WNW",
      swell_1_period: "12s",
      swell_1_direction: "WNW",
    });
    const window: PersonalizedForecastWindow = {
      start: new Date("2026-05-08T22:30:00.000Z"),
      end: new Date("2026-05-09T01:30:00.000Z"),
      tide: "Rising",
      wind: "5 mph W",
      waveHeight: "4-5ft",
      wavePeriod: "12s",
      dataSource: "OPEN_METEO",
      confidence: 80,
      timezone: "America/Los_Angeles",
      score: 82,
      peakTime: new Date("2026-05-08T23:00:00.000Z"),
      sourceForecast,
    };

    const context = buildForecastRecommendationContext({
      beach: beach(),
      forecasts: [sourceForecast],
      window,
      now: new Date("2026-05-08T13:00:00.000Z"),
    });

    expect(context?.waveHeight).toBe("4-5ft");
    expect(context?.waveHeightFt).toBe(4.5);
    expect(context?.waveHeightRangeLabel).toBe("4-5 ft");
  });

  it("derives a tight display window around the peak when the raw range misses it", () => {
    const sourceForecast = row({
      forecast_at: "2026-05-08T15:00:00.000Z",
      wave_height: "2.9 ft",
      wave_period: "14s",
      wave_direction: "W",
      swell_1_period: "14s",
      swell_1_direction: "W",
      wind_speed: "4 mph",
      wind_direction: "SSW",
      tide_height: "0.1 ft",
      tide_status: "Rising",
    });
    const window: PersonalizedForecastWindow = {
      start: new Date("2026-05-08T17:24:00.000Z"),
      end: new Date("2026-05-09T02:45:00.000Z"),
      tide: "Rising",
      wind: "4 mph SSW",
      waveHeight: "2.9 ft",
      wavePeriod: "14s",
      dataSource: "CDIP",
      confidence: 92,
      timezone: "America/Los_Angeles",
      score: 88,
      peakTime: new Date("2026-05-08T15:00:00.000Z"),
      sourceForecast,
    };

    const context = buildForecastRecommendationContext({
      beach: beach(),
      forecasts: [sourceForecast],
      window,
      now: new Date("2026-05-08T13:00:00.000Z"),
    });

    expectContext(context, "best_window");
    expect(context?.startTime).toBe("2026-05-08T17:24:00.000Z");
    expect(context?.endTime).toBe("2026-05-09T02:45:00.000Z");
    expect(context?.selectedRowTime).toBe("2026-05-08T15:00:00.000Z");
    expect(context?.displayWindowStart).toBe("2026-05-08T13:45:00.000Z");
    expect(context?.displayWindowEnd).toBe("2026-05-08T16:15:00.000Z");
    expect(context?.displayTimeLabel).toBe("Best window: 6:45-9:15 AM");
    expect(context?.conditionDrivers).toEqual({
      wave: "2-3 ft",
      energy: "14s W energy",
      wind: "4 mph SSW clean",
      tide: "0.1 ft rising",
    });
  });

  it("falls back to now when the current row is rideable and no best window exists", () => {
    const context = buildForecastRecommendationContext({
      beach: beach(),
      forecasts: [row({ forecast_at: "2026-05-08T13:00:00.000Z", wave_height: "2 ft", wind_speed: "4 mph" })],
      window: null,
      now: new Date("2026-05-08T13:30:00.000Z"),
    });

    expectContext(context, "now");
    expect(context?.displayTimeLabel).toBe("Now");
    expect(context?.selectedWindowStart).toBeNull();
    expect(context?.selectedWindowEnd).toBeNull();
    expect(context?.waveHeightFt).toBe(2);
    expect(context?.waveHeightRangeLabel).toBe("1-2 ft");
    expect(context?.source).toBe("current_conditions");
  });

  it("falls back to the next rideable same-day row when current conditions are not rideable", () => {
    const context = buildForecastRecommendationContext({
      beach: beach(),
      forecasts: [
        row({ forecast_at: "2026-05-08T13:00:00.000Z", wave_height: "0.5 ft", wind_speed: "4 mph" }),
        row({ forecast_at: "2026-05-08T21:00:00.000Z", wave_height: "2 ft", wind_speed: "5 mph" }),
      ],
      window: null,
      now: new Date("2026-05-08T13:30:00.000Z"),
    });

    expectContext(context, "next_rideable");
    expect(context?.selectedRowTime).toBe("2026-05-08T21:00:00.000Z");
    expect(context?.displayTimeLabel).toContain("Later:");
    expect(context?.source).toBe("hourly_forecast");
  });

  it("shows marginal current conditions when no rideable context exists", () => {
    const context = buildForecastRecommendationContext({
      beach: beach(),
      forecasts: [row({ forecast_at: "2026-05-08T13:00:00.000Z", wave_height: "0.5 ft", wind_speed: "24 mph" })],
      window: null,
      now: new Date("2026-05-08T13:30:00.000Z"),
    });

    expectContext(context, "marginal");
    expect(context?.displayTimeLabel).toBe("Now: marginal");
    expect(context?.source).toBe("current_conditions");
  });
});
