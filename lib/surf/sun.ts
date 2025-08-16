// lib/surf/sun.ts
import SunCalc from 'suncalc';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export function sunForLatLon(dateLocal: Date, lat: number, lon: number, tz: string) {
  // use local noon to avoid DST/day-boundary weirdness
  const localNoon = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 12, 0, 0);
  const noonUtc = fromZonedTime(localNoon, tz);
  const t = SunCalc.getTimes(noonUtc, lat, lon);
  const sunriseLocal = toZonedTime(t.sunrise, tz);
  const sunsetLocal  = toZonedTime(t.sunset, tz);
  return { sunriseLocal, sunsetLocal };
}

export function isDark(nowLocal: Date, sunriseLocal: Date, sunsetLocal: Date) {
  return nowLocal < sunriseLocal || nowLocal >= sunsetLocal;
}


