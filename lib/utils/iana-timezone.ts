const REGION_TIMEZONE_PATTERN = /^(?:[A-Za-z][A-Za-z0-9_+-]*)(?:\/[A-Za-z0-9_+-]+){1,2}$/;

export function normalizeIanaTimezone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const timezone = value.trim();
  if (
    timezone.length < 1 ||
    timezone.length > 100 ||
    (timezone !== "UTC" && !REGION_TIMEZONE_PATTERN.test(timezone))
  ) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}
