import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay, addHours, setHours, setMinutes, min } from 'date-fns';
import * as SunCalc from 'suncalc';

/**
 * Get UTC start and end times for a local date in the specified timezone
 * @param dateLocal - The local date (Date object or string)
 * @param tz - The timezone string (e.g., 'America/New_York', 'UTC')
 * @returns [startUtc, endUtc] - Array containing start and end of day in UTC
 */
export function startEndUtcForLocalDate(dateLocal: Date | string, tz: string): [Date, Date] {
  const date = typeof dateLocal === 'string' ? new Date(dateLocal) : dateLocal;
  
  // Get start and end of day in the local timezone
  const startOfDayLocal = startOfDay(date);
  const endOfDayLocal = endOfDay(date);
  
  // Convert to UTC
  const startUtc = fromZonedTime(startOfDayLocal, tz);
  const endUtc = fromZonedTime(endOfDayLocal, tz);
  
  return [startUtc, endUtc];
}

/**
 * Get morning window: sunrise → sunrise + horizon_hours (or 11:00 local, whichever comes first)
 * @param dateLocal - The local date (Date object or string)
 * @param tz - The timezone string (e.g., 'America/New_York', 'UTC')
 * @param lat - Latitude for sunrise calculation
 * @param lng - Longitude for sunrise calculation
 * @param horizonHours - Hours after sunrise for window end (default 5)
 * @returns [startUtc, endUtc] - Array containing morning window start and end in UTC
 */
export function getMorningWindow(
  dateLocal: Date | string, 
  tz: string, 
  lat: number, 
  lng: number,
  horizonHours: number = 5
): [Date, Date] {
  const date = typeof dateLocal === 'string' ? new Date(dateLocal) : dateLocal;
  
  // Calculate sunrise for the given date and location
  const sunTimes = SunCalc.getTimes(date, lat, lng);
  const sunrise = sunTimes.sunrise;
  
  // Convert sunrise to local timezone
  const sunriseLocal = toZonedTime(sunrise, tz);
  
  // Calculate sunrise + horizon hours
  const sunrisePlusHorizon = addHours(sunriseLocal, horizonHours);
  
  // Calculate 11:00 AM local time
  const elevenAM = setHours(setMinutes(startOfDay(date), 0), 11);
  
  // End time is whichever comes first: sunrise + horizon hours or 11:00 AM
  const endLocal = min([sunrisePlusHorizon, elevenAM]);
  
  // Convert to UTC
  const startUtc = fromZonedTime(sunriseLocal, tz);
  const endUtc = fromZonedTime(endLocal, tz);
  
  return [startUtc, endUtc];
}