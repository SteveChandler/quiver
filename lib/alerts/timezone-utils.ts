/**
 * Get UTC timestamps for the start and end of a local date in a given timezone.
 * E.g., "2026-04-01" in "America/Los_Angeles" -> 2026-04-01T07:00:00Z to 2026-04-02T06:59:59Z (PDT)
 */
export function getUtcDayBounds(
  localDate: string,
  timezone: string
): { start: string; end: string } {
  // Use noon UTC as a stable reference point to derive the timezone offset.
  // At noon UTC, we check what the local hour is in the target timezone.
  const noonUtc = new Date(`${localDate}T12:00:00Z`);

  const localNoonStr = noonUtc.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const localNoonHour = parseInt(localNoonStr, 10);

  // offset = localHour - utcHour (e.g., PDT: 12 local when 19 UTC -> offset = -7)
  const offsetHours = localNoonHour - 12;

  // Midnight local = 00:00 local = (00:00 - offset) in UTC
  const startUtc = new Date(`${localDate}T00:00:00Z`);
  startUtc.setUTCHours(-offsetHours, 0, 0, 0);

  // End of day = start + 24h - 1s
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1000);

  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString(),
  };
}
