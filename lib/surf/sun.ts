// lib/surf/sun.ts
import SunCalc from 'suncalc';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

export function sunForLatLon(dateLocal: Date, lat: number, lon: number, tz: string) {
  // use local noon to avoid DST/day-boundary weirdness
  const localNoon = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 12, 0, 0);
  const noonUtc = zonedTimeToUtc(localNoon, tz);
  const t = SunCalc.getTimes(noonUtc, lat, lon);
  const sunriseLocal = utcToZonedTime(t.sunrise, tz);
  const sunsetLocal  = utcToZonedTime(t.sunset, tz);
  return { sunriseLocal, sunsetLocal };
}

export function isDark(nowLocal: Date, sunriseLocal: Date, sunsetLocal: Date) {
  return nowLocal < sunriseLocal || nowLocal >= sunsetLocal;
}


