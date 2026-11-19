// A forecast row may stand in for "current conditions" only within one
// 3-hourly slot of now. Beyond that we are showing a stale or next-day row
// as current, which is worse than an honest gap.
export const CURRENT_CONDITIONS_TOLERANCE_MS = 3 * 60 * 60 * 1000;

interface CurrentRowOptions {
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

const HOUR_MS = 60 * 60 * 1000;

/**
 * The stored row nearest the start of the current UTC hour: the row the
 * personal surf call scopes "now" to (native's current hour takes the nearer
 * bracketing slot, the later one on a tie). Null when no row lies within
 * CURRENT_CONDITIONS_TOLERANCE_MS of that hour in either direction. It does not
 * skip FALLBACK rows; wrap it in modelForecastRow where the row is scored.
 */
export function currentHourForecastRow<Row extends { forecast_at?: string | null }>(
  rows: readonly Row[],
  now: Date,
): Row | null {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return null;
  const hourStartMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS;

  let best: { row: Row; delta: number; rowMs: number } | null = null;
  for (const row of rows) {
    const rowMs = Date.parse(row.forecast_at ?? "");
    if (!Number.isFinite(rowMs)) continue;
    const delta = Math.abs(rowMs - hourStartMs);
    if (delta > CURRENT_CONDITIONS_TOLERANCE_MS) continue;
    if (!best || delta < best.delta || (delta === best.delta && rowMs > best.rowMs)) {
      best = { row, delta, rowMs };
    }
  }
  return best?.row ?? null;
}
