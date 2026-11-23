/**
 * One Intl.DateTimeFormat per time zone for a fixed locale and option set.
 * Building a formatter costs ~30 µs and holds native ICU memory, so row loops
 * keep one per zone. An unknown zone throws on every call and is never cached,
 * so callers' try/catch still sees the RangeError.
 */
export function zonedFormatter(
  locale: string,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
): (timeZone: string) => Intl.DateTimeFormat {
  const byZone = new Map<string, Intl.DateTimeFormat>();
  return (timeZone) => {
    let formatter = byZone.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
      byZone.set(timeZone, formatter);
    }
    return formatter;
  };
}
