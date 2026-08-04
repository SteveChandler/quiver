import type { OpenMeteoMarineResponse } from "@/lib/services/noaa-wavewatch/types";

export const POINT_MARINE_FORECAST_SCHEMA_VERSION = 1 as const;
export const POINT_MARINE_FORECAST_SOURCE = "open_meteo" as const;
export const POINT_MARINE_FORECAST_MODEL = "ncep_gfswave016" as const;

export interface MarineComponent {
  heightM: number;
  periodS: number;
  directionDeg: number;
}

export interface PointMarineForecastRow {
  forecastAt: string;
  total: MarineComponent | null;
  swell1: MarineComponent | null;
  swell2: MarineComponent | null;
  swell3: MarineComponent | null;
  windWave: MarineComponent | null;
}

export interface PointMarineForecastResponseV1 {
  schemaVersion: typeof POINT_MARINE_FORECAST_SCHEMA_VERSION;
  source: typeof POINT_MARINE_FORECAST_SOURCE;
  sourceModel: typeof POINT_MARINE_FORECAST_MODEL;
  requestedPoint: { lat: number; lon: number };
  sampledPoint: { lat: number; lon: number };
  sampleResolution: "exact" | "offshore_shifted";
  modelRunAt: string | null;
  fetchedAt: string;
  stale: boolean;
  rows: PointMarineForecastRow[];
}

export type PointMarineForecastPayload = OpenMeteoMarineResponse;

export class PointMarineForecastUnavailableError extends Error {
  constructor(message = "Point marine forecast unavailable") {
    super(message);
    this.name = "PointMarineForecastUnavailableError";
  }
}
