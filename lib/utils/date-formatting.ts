/**
 * Date Formatting Utilities
 *
 * Shared date and time formatting functions used across the application.
 * @module lib/utils/date-formatting
 */

/**
 * Format a date string in YYYY-MM-DD format for a specific timezone.
 *
 * @param date - Date object to format
 * @param timezone - IANA timezone identifier
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  const dateInTz = date.toLocaleString('en-US', { timeZone: timezone });
  const localDate = new Date(dateInTz);

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Get "today" in a specific timezone as a Date object.
 *
 * @param timezone - IANA timezone identifier
 * @returns Date object representing today in the specified timezone
 */
function getTodayInTimezone(timezone: string): Date {
  const nowInTz = new Date().toLocaleString('en-US', { timeZone: timezone });
  return new Date(nowInTz);
}
