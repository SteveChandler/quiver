import { NOAAWeatherDataSource } from "@/lib/services/forecast/data-source-manager";
import { parseNwsWindDirectionDeg } from "@/lib/services/nws-wind-service";
import { createLatitude, createLongitude } from "@/types/forecast";

export interface CustomSpotAtmosphericForecast {
  forecastAt: string | null;
  windSpeed: string | null;
  windDirection: string | null;
  windDirectionDeg: number | null;
  temperatureF: number | null;
  summary: string | null;
  fetchedAt: string;
}

export async function fetchCustomSpotAtmosphericForecast(args: {
  lat: number;
  lon: number;
}): Promise<CustomSpotAtmosphericForecast> {
  const source = new NOAAWeatherDataSource();
  const weather = await source.fetchWeatherData({
    latitude: createLatitude(args.lat),
    longitude: createLongitude(args.lon),
  }, 1);
  const period = weather.periods[0];

  return {
    forecastAt: period?.startTime ?? null,
    windSpeed: period?.windSpeed ?? null,
    windDirection: period?.windDirection ?? null,
    windDirectionDeg: parseNwsWindDirectionDeg(period?.windDirection),
    temperatureF: typeof period?.temperature === "number"
      && Number.isFinite(period.temperature)
      ? period.temperature
      : null,
    summary: period?.shortForecast ?? null,
    fetchedAt: new Date().toISOString(),
  };
}
