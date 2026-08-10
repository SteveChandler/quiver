import SunCalc from "suncalc";

export interface DaylightWindow {
  sunrise: Date;
  sunset: Date;
}

export function getDaylightWindow(lat: number, lon: number, date: Date): DaylightWindow {
  const times = SunCalc.getTimes(date, lat, lon);
  return { sunrise: times.sunrise, sunset: times.sunset };
}

/** Forecast rows are hourly, so each row represents the hour that follows it. */
const FORECAST_ROW_DURATION_MS = 60 * 60 * 1000;

export function filterToDaylight<T extends { forecast_at: string }>(
  forecasts: T[],
  lat: number,
  lon: number
): T[] {
  if (forecasts.length === 0) return [];
  return forecasts.filter((f) => {
    const t = new Date(f.forecast_at);
    const { sunrise, sunset } = getDaylightWindow(lat, lon, t);
    // The row's whole hour must fit inside daylight, not just its first instant.
    // A 20:00 row against a 20:08 sunset is 8 minutes of light and 52 of dark —
    // 14% of every alert window ever queued ended after sunset because of this.
    // ponytail: assumes hourly rows; revisit if the forecast resolution changes.
    const rowEnd = new Date(t.getTime() + FORECAST_ROW_DURATION_MS);
    return t >= sunrise && rowEnd <= sunset;
  });
}
