/**
 * Time Slot Utilities
 *
 * Functions for calculating time slot ranges and handling timezone conversions.
 *
 * @module lib/services/discovery/window-selector/time-slot-utils
 */

import type { TimeSlot } from '@/types/personalization';
import { TIME_SLOT_RANGES } from '@/types/personalization';

/**
 * Get local date string for a timestamp in a given timezone.
 * Returns format: YYYY-MM-DD
 *
 * @param time - The timestamp to convert
 * @param beachTz - IANA timezone string for the beach location
 * @returns Local date string in YYYY-MM-DD format
 */
export function getLocalDateStr(time: Date, beachTz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(time);
  } catch {
    return time.toISOString().slice(0, 10); // Fallback to UTC
  }
}

/**
 * Get the hour range for a time slot.
 * Dawn patrol uses dynamic start based on sunrise; others use static ranges.
 *
 * @param timeSlot - The time slot filter
 * @param sunrises - Array of sunrise times (needed for dawn-patrol)
 * @param forecastDate - The forecast date
 * @param beachTz - IANA timezone string
 * @returns Time range with startHour and endHour
 */
export function getTimeSlotRange(
  timeSlot: TimeSlot,
  sunrises: Date[],
  forecastDate: Date,
  beachTz: string
): { startHour: number; endHour: number } {
  if (timeSlot === 'dawn-patrol') {
    return getDawnPatrolRange(sunrises, forecastDate, beachTz);
  }
  return TIME_SLOT_RANGES[timeSlot];
}

/**
 * Get dawn patrol time range based on sunrise.
 * Start is civil twilight (~30 min before sunrise), end is 11am.
 *
 * @param sunrises - Array of sunrise times for the area
 * @param forecastDate - The forecast date to find sunrise for
 * @param beachTz - IANA timezone string for the beach
 * @returns Time range with startHour and endHour in local time
 */
export function getDawnPatrolRange(
  sunrises: Date[],
  forecastDate: Date,
  beachTz: string
): { startHour: number; endHour: number } {
  // Find sunrise for the same local date
  const forecastDateStr = getLocalDateStr(forecastDate, beachTz);
  const sameDaySunrise = sunrises.find(s => getLocalDateStr(s, beachTz) === forecastDateStr);

  if (!sameDaySunrise) {
    // Fallback to conservative 6am if no sunrise data
    return { startHour: 6, endHour: 11 };
  }

  // Civil twilight ~30 minutes before sunrise
  const civilTwilight = new Date(sameDaySunrise.getTime() - 30 * 60 * 1000);

  // Get local hour of civil twilight
  try {
    const twilightHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(civilTwilight),
      10
    );
    return { startHour: twilightHour, endHour: 11 };
  } catch {
    return { startHour: 6, endHour: 11 };
  }
}

/**
 * Cap end time to time slot boundary.
 *
 * Ensures window doesn't extend past the selected time slot.
 * For example, dawn-patrol ends at 11am, lunch session ends at 2pm.
 *
 * @param effectiveStartTime - The window start time
 * @param endTime - The uncapped window end time
 * @param timeSlot - The time slot to cap to (dawn-patrol, morning, afternoon, any)
 * @param beachTz - IANA timezone string for the beach location
 * @returns The capped end time, or original end time if no capping needed
 */
export function capEndTimeToTimeSlot(
  effectiveStartTime: Date,
  endTime: Date,
  timeSlot: TimeSlot | undefined,
  beachTz: string
): Date {
  if (!timeSlot || timeSlot === 'any') {
    return endTime;
  }

  const { endHour } = TIME_SLOT_RANGES[timeSlot];
  try {
    // Get the local hour of the start time in beach timezone
    const startLocalHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(effectiveStartTime),
      10
    );

    // Calculate hours until time slot ends
    const hoursUntilSlotEnd = endHour - startLocalHour;

    if (hoursUntilSlotEnd > 0) {
      const timeSlotEnd = new Date(
        effectiveStartTime.getTime() + hoursUntilSlotEnd * 60 * 60 * 1000
      );

      if (timeSlotEnd < endTime) {
        return timeSlotEnd;
      }
    }
  } catch {
    // If timezone conversion fails, don't cap
  }

  return endTime;
}

/**
 * Get local hour from a Date in a specific timezone.
 *
 * @param time - The timestamp to convert
 * @param beachTz - IANA timezone string
 * @returns The local hour (0-23) or null if conversion fails
 */
export function getLocalHour(time: Date, beachTz: string): number | null {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(time),
      10
    );
  } catch {
    return null;
  }
}

/**
 * Check if a time falls within a time slot's hour range.
 *
 * @param time - The time to check
 * @param timeSlot - The time slot to check against
 * @param sunrises - Sunrise times for dynamic time slots
 * @param beachTz - IANA timezone string
 * @returns True if the time is within the slot's range
 */
export function isWithinTimeSlot(
  time: Date,
  timeSlot: TimeSlot | undefined,
  sunrises: Date[],
  beachTz: string
): boolean {
  if (!timeSlot || timeSlot === 'any') {
    return true;
  }

  const localHour = getLocalHour(time, beachTz);
  if (localHour === null) {
    return false;
  }

  const slotRange = getTimeSlotRange(timeSlot, sunrises, time, beachTz);
  return localHour >= slotRange.startHour && localHour < slotRange.endHour;
}
