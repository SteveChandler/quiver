import {
  fetchOpenMeteoData,
  type OpenMeteoFetchOptions,
} from "@/lib/services/noaa-wavewatch/api-client";
import {
  POINT_MARINE_FORECAST_MODEL,
  type PointMarineForecastPayload,
} from "./types";

export async function fetchPointMarineForecastPayload(args: {
  lat: number;
  lon: number;
  days: number;
  signal?: AbortSignal;
}): Promise<PointMarineForecastPayload> {
  const options: OpenMeteoFetchOptions = {
    model: POINT_MARINE_FORECAST_MODEL,
    timeformat: "iso8601",
    timezone: "UTC",
    signal: args.signal,
  };
  const payload = await fetchOpenMeteoData(args.lat, args.lon, args.days, options);
  if (args.signal?.aborted) {
    const error = new Error("Point marine forecast request aborted");
    error.name = "AbortError";
    throw error;
  }
  if (!payload) throw new Error("Open-Meteo marine request failed");
  return payload;
}
