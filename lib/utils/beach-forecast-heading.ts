export function formatForecastHeadingDate(
  localDate: string | null | undefined,
  timezone: string,
): string | null {
  if (!localDate) return null;
  const date = new Date(`${localDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

/** The H1 after the beach name. A selected window or date drops the date, as today. */
export function beachForecastHeadingSuffix(forecastDate: string | null, hasSelection: boolean): string {
  return !hasSelection && forecastDate ? `Surf Forecast for ${forecastDate}` : "Surf Forecast";
}
