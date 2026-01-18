/**
 * Time Parsing and Formatting Utilities
 *
 * Consolidates time parsing logic scattered across the codebase.
 * Supports 12-hour and 24-hour formats consistently.
 */

export function parseTimeToHour(timeStr: unknown): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;

  const cleaned = timeStr.trim().toUpperCase();

  // 24-hour format: "14:30" or "08:00"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours + minutes / 60;
  }

  // 12-hour format: "2:30 PM", "2:30PM", "2 PM"
  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const isPM = match12[3] === 'PM';
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (isPM && hours !== 12) hours += 12;
    else if (!isPM && hours === 12) hours = 0;
    return hours + minutes / 60;
  }

  return null;
}

export interface TimeStringOptions {
  /** Use 24-hour format instead of 12-hour */
  format24?: boolean;
}

export function toTimeString(hours: number, options: TimeStringOptions = {}): string {
  const { format24 = false } = options;
  const normalizedHours = ((hours % 24) + 24) % 24;
  const h = Math.floor(normalizedHours);
  const m = Math.round((normalizedHours - h) * 60);

  if (format24) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const isPM = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

export function formatTimeRange(startHour: number, endHour: number, options: TimeStringOptions = {}): string {
  return `${toTimeString(startHour, options)} - ${toTimeString(endHour, options)}`;
}

export function isWithinTimeRange(hour: number, rangeStart: number, rangeEnd: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  const start = ((rangeStart % 24) + 24) % 24;
  const end = ((rangeEnd % 24) + 24) % 24;

  if (start <= end) {
    return h >= start && h < end;
  } else {
    // Range crosses midnight
    return h >= start || h < end;
  }
}

export function getHourFromDate(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    return d.getHours();
  } catch {
    return null;
  }
}
