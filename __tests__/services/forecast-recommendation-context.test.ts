import {
  buildForecastRecommendationContext,
  type ForecastRecommendationContext,
} from "@/lib/services/forecast-recommendation-context";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PersonalizedForecastWindow } from "@/types/personalization";

function beach(): Beach {
  return {
    id: "obp",
    name: "Ocean Beach Pier",
    timezone: "America/Los_Angeles",
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
    expect(context?.source).toBe("looking_ahead");
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
