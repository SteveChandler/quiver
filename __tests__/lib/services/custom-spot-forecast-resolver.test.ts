import { resolveCustomSpotForecastSource } from "@/lib/services/custom-spot-forecast-resolver";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PointMarineForecastResponseV1 } from "@/lib/services/point-marine-forecast";

const curatedRow = {
  id: "curated-1",
  beach_id: "beach-1",
  forecast_at: "2026-07-31T12:00:00Z",
  forecast_date: "2026-07-31",
  forecast_time: "12:00:00",
  wave_height: "4 ft",
  wave_period: "14s",
  wave_direction: "WSW",
  swell_1_height: "4 ft",
  swell_1_period: "14s",
  swell_1_direction: "WSW",
  water_temp: null,
  updated_at: "2026-07-31T11:00:00Z",
} as EnhancedForecastEntity;

const pointForecast: PointMarineForecastResponseV1 = {
  schemaVersion: 1,
  source: "open_meteo",
  sourceModel: "ncep_gfswave016",
  requestedPoint: { lat: 33.5, lon: -118.5 },
  sampledPoint: { lat: 33.535, lon: -118.5 },
  sampleResolution: "offshore_shifted",
  modelRunAt: null,
  fetchedAt: "2026-07-31T11:00:00Z",
  stale: false,
  rows: [
    {
      forecastAt: "2026-07-31T12:00:00Z",
      total: { heightM: 1.2, periodS: 13, directionDeg: 270 },
      swell1: { heightM: 0.9, periodS: 15, directionDeg: 260 },
      swell2: null,
      swell3: null,
      windWave: null,
    },
  ],
};

describe("custom spot forecast source resolver", () => {
  it("keeps usable curated forecasts within the threshold", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachName: "Beach",
      nearestBeachDistanceMi: 4,
      curatedRows: [curatedRow],
      pointForecast,
    });

    expect(resolved.kind).toBe("curated");
    expect(resolved.source.label).toBe("Nearest curated forecast");
  });

  it("uses point marine data beyond the threshold", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      curatedRows: [curatedRow],
      pointForecast,
      atmosphericForecast: {
        forecastAt: "2026-07-31T12:00:00Z",
        windSpeed: "8 mph",
        windDirection: "NW",
        windDirectionDeg: 315,
        temperatureF: 70,
        summary: "Clear",
        fetchedAt: "2026-07-31T12:00:00Z",
      },
    });

    expect(resolved.kind).toBe("gfs_wave_point");
    expect(resolved.current?.swell_1_height).toBe("3.0 ft");
    expect(resolved.current?.wind_speed).toBe("8 mph");
    expect(resolved.source.sampleResolution).toBe("offshore_shifted");
  });

  it("selects the forecast frame at or immediately before now and merges atmospheric data there", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      pointForecast: {
        ...pointForecast,
        rows: [
          ...pointForecast.rows,
          {
            ...pointForecast.rows[0],
            forecastAt: "2026-07-31T15:00:00Z",
            swell1: { heightM: 1.1, periodS: 16, directionDeg: 250 },
          },
        ],
      },
      atmosphericForecast: {
        forecastAt: "2026-07-31T15:00:00Z",
        windSpeed: "8 mph",
        windDirection: "NW",
        windDirectionDeg: 315,
        temperatureF: 70,
        summary: "Clear",
        fetchedAt: "2026-07-31T12:00:00Z",
      },
      now: new Date("2026-07-31T15:30:00Z"),
    });

    expect(resolved.kind).toBe("gfs_wave_point");
    expect(resolved.current?.forecast_at).toBe("2026-07-31T15:00:00Z");
    expect(resolved.current?.swell_1_period).toBe("16s");
    expect(resolved.current?.wind_speed).toBe("8 mph");
  });

  it("uses the first future frame before the forecast window begins", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      pointForecast: {
        ...pointForecast,
        rows: [
          ...pointForecast.rows,
          { ...pointForecast.rows[0], forecastAt: "2026-07-31T15:00:00Z" },
        ],
      },
      now: new Date("2026-07-31T10:00:00Z"),
    });

    expect(resolved.current?.forecast_at).toBe("2026-07-31T12:00:00Z");
  });

  it("uses the last past frame after the forecast window ends", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      pointForecast: {
        ...pointForecast,
        rows: [
          ...pointForecast.rows,
          { ...pointForecast.rows[0], forecastAt: "2026-07-31T15:00:00Z" },
        ],
      },
      now: new Date("2026-07-31T18:00:00Z"),
    });

    expect(resolved.current?.forecast_at).toBe("2026-07-31T15:00:00Z");
  });

  it("does not treat zero-string swell values as usable", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 4,
      curatedRows: [{
        ...curatedRow,
        swell_1_height: "0 ft",
        swell_1_period: "0s",
      }],
      pointForecast,
    });

    expect(resolved.kind).toBe("gfs_wave_point");
  });

  it("does not use an incomplete curated swell tuple", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 4,
      curatedRows: [{ ...curatedRow, swell_1_period: null }],
      pointForecast,
    });

    expect(resolved.kind).toBe("gfs_wave_point");
  });

  it("returns an honest unavailable state without fabricating a row", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      curatedRows: [curatedRow],
      pointForecast: null,
    });

    expect(resolved.kind).toBe("unavailable");
    expect(resolved.rows).toEqual([]);
    expect(resolved.current).toBeNull();
  });

  it("keeps NOAA weather and wind as an explicit atmospheric-only state", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      atmosphericForecast: {
        forecastAt: "2026-07-31T12:00:00Z",
        windSpeed: "8 mph",
        windDirection: "NW",
        windDirectionDeg: 315,
        temperatureF: 70,
        summary: "Clear",
        fetchedAt: "2026-07-31T11:00:00Z",
      },
    });

    expect(resolved.kind).toBe("atmospheric_only");
    expect(resolved.current?.wind_speed).toBe("8 mph");
    expect(resolved.current?.swell_1_height).toBeNull();
  });

  it("does not expose an empty atmospheric object as available forecast data", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      atmosphericForecast: {
        forecastAt: null,
        windSpeed: null,
        windDirection: null,
        windDirectionDeg: null,
        temperatureF: null,
        summary: null,
        fetchedAt: "2026-07-31T12:00:00Z",
      },
    });

    expect(resolved.kind).toBe("unavailable");
  });

  it("does not promote a direction-only atmospheric payload", () => {
    const resolved = resolveCustomSpotForecastSource({
      spotName: "Peak",
      lat: 33.5,
      lon: -118.5,
      nearestBeachDistanceMi: 40,
      atmosphericForecast: {
        forecastAt: null,
        windSpeed: null,
        windDirection: "NW",
        windDirectionDeg: 315,
        temperatureF: null,
        summary: null,
        fetchedAt: "2026-07-31T12:00:00Z",
      },
    });

    expect(resolved.kind).toBe("unavailable");
  });
});
