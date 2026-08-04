import { getWaveDirectionText } from "@/lib/services/noaa-wavewatch/wave-analysis";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PointMarineForecastResponseV1, PointMarineForecastRow, MarineComponent } from "./types";

const METERS_TO_FEET = 3.28084;

function feet(component: MarineComponent | null): string | null {
  return component ? `${(component.heightM * METERS_TO_FEET).toFixed(1)} ft` : null;
}

function seconds(component: MarineComponent | null): string | null {
  return component ? `${component.periodS.toFixed(0)}s` : null;
}

function direction(component: MarineComponent | null): string | null {
  return component ? getWaveDirectionText(component.directionDeg) : null;
}

function rowToEnhanced(
  row: PointMarineForecastRow,
  index: number,
  beachId: string,
): EnhancedForecastEntity {
  const date = new Date(row.forecastAt);
  const total = row.total;
  return {
    id: `point-${beachId}-${index}`,
    created_at: row.forecastAt,
    beach_id: beachId,
    forecast_at: row.forecastAt,
    forecast_date: row.forecastAt.slice(0, 10),
    forecast_time: row.forecastAt.slice(11, 19),
    wave_height: feet(total),
    wave_period: seconds(total),
    wave_direction: direction(total),
    swell_1_height: feet(row.swell1),
    swell_1_period: seconds(row.swell1),
    swell_1_direction: direction(row.swell1),
    swell_2_height: feet(row.swell2),
    swell_2_period: seconds(row.swell2),
    swell_2_direction: direction(row.swell2),
    wind_wave_height: feet(row.windWave),
    wind_wave_period: seconds(row.windWave),
    wind_wave_direction: direction(row.windWave),
    water_temp: null,
    air_temperature: null,
    wind_speed: null,
    wind_direction: null,
    wind_direction_deg: null,
    tide_status: null,
    tide_height: null,
    next_tide_time: null,
    next_tide_type: null,
    next_tide_height: null,
    next_tide_at: null,
    coops_station_id: null,
    weather_condition: null,
    confidence_score: null,
    data_source: "OPEN_METEO",
    updated_at: date.toISOString(),
  };
}

export function pointMarineForecastToEnhancedRows(
  response: PointMarineForecastResponseV1,
  beachId = "point-marine",
): EnhancedForecastEntity[] {
  return response.rows.map((row, index) => rowToEnhanced(row, index, beachId));
}
