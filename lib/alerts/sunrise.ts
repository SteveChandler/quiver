import SunCalc from "suncalc";

export interface DaylightWindow {
  sunrise: Date;
  sunset: Date;
}

export function getDaylightWindow(lat: number, lon: number, date: Date): DaylightWindow {
  const times = SunCalc.getTimes(date, lat, lon);
  return { sunrise: times.sunrise, sunset: times.sunset };
}

export function filterToDaylight<T extends { forecast_at: string }>(
  forecasts: T[],
  lat: number,
  lon: number
): T[] {
  if (forecasts.length === 0) return [];
  const date = new Date(forecasts[0].forecast_at);
  const { sunrise, sunset } = getDaylightWindow(lat, lon, date);
  return forecasts.filter((f) => {
    const t = new Date(f.forecast_at);
    return t >= sunrise && t <= sunset;
  });
}
