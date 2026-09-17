const SUPPORTED_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

export function normalizeIanaTimezone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const timezone = value.trim();
  return timezone.length >= 1 && timezone.length <= 100 &&
    (timezone === "UTC" || SUPPORTED_TIMEZONES.has(timezone))
    ? timezone
    : null;
}
