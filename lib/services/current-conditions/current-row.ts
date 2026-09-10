export interface CurrentRowOptions {
  toleranceMs?: number;
}

export function designateCurrentRow<Row extends { forecast_at?: string | null }>(
  rows: readonly Row[],
  now: Date,
  options?: CurrentRowOptions,
): { row: Row; ageMs: number } | null {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return null;

  let latest: { row: Row; forecastAtMs: number } | null = null;
  for (const row of rows) {
    const forecastAtMs = Date.parse(row.forecast_at ?? "");
    if (!Number.isFinite(forecastAtMs) || forecastAtMs > nowMs) continue;
    if (!latest || forecastAtMs >= latest.forecastAtMs) {
      latest = { row, forecastAtMs };
    }
  }

  if (!latest) return null;
  const ageMs = nowMs - latest.forecastAtMs;
  if (options?.toleranceMs !== undefined && ageMs > options.toleranceMs) {
    return null;
  }
  return { row: latest.row, ageMs };
}
