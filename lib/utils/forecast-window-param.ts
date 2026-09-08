const ABSOLUTE_INSTANT_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export function normalizeForecastWindowParam(
  value: string | string[] | null | undefined,
): string | null {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!text) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(text) ||
    !ABSOLUTE_INSTANT_SUFFIX_PATTERN.test(text)
  ) {
    return null;
  }
  return Number.isNaN(Date.parse(text)) ? null : text;
}


export function normalizeForecastDateParam(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}
