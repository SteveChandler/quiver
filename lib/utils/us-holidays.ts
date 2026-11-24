/** A US holiday people plan a surf around: `name` fits a title ("Thanksgiving groundswell"), `day` a sentence ("peaks Thanksgiving Day"). */
interface SurfHoliday {
  name: string;
  day: string;
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Day of the month of the nth `weekday` (0 = Sunday); n = -1 is the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) return 1 + ((weekday - weekdayOf(year, month, 1) + 7) % 7) + (n - 1) * 7;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return last - ((weekdayOf(year, month, last) - weekday + 7) % 7);
}

/** The holiday on a local date key ("2026-11-26"), or null. */
export function surfHoliday(dateKey: string): SurfHoliday | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month === 1 && day === 1) return { name: "New Year's Day", day: "New Year's Day" };
  if (month === 5 && day === nthWeekday(year, 5, 1, -1)) return { name: "Memorial Day", day: "Memorial Day" };
  if (month === 7 && day === 4) return { name: "July 4th", day: "July 4th" };
  if (month === 9 && day === nthWeekday(year, 9, 1, 1)) return { name: "Labor Day", day: "Labor Day" };
  if (month === 11 && day === nthWeekday(year, 11, 4, 4)) return { name: "Thanksgiving", day: "Thanksgiving Day" };
  if (month === 12 && day === 25) return { name: "Christmas", day: "Christmas Day" };
  return null;
}
