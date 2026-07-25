export const FORECAST_ALIGNMENT_TOLERANCE_MINUTES = 90;

export interface SurfCallForecastAlignment {
  requestedForecastAt: string;
  matchedForecastAt: string | null;
  matchType: 'exact' | 'nearest' | 'none';
  deltaMinutes: number | null;
}

interface ForecastTimestamp {
  forecast_at: string;
}

export function resolveForecastAlignment<T extends ForecastTimestamp>(
  forecasts: readonly T[],
  requestedForecastAt: string,
): {
  forecast: T | null;
  alignment: SurfCallForecastAlignment;
} {
  const requestedMs = Date.parse(requestedForecastAt);
  let nearest: T | null = null;
  let nearestMs = Number.POSITIVE_INFINITY;
  let nearestDeltaMs = Number.POSITIVE_INFINITY;

  if (Number.isFinite(requestedMs)) {
    for (const forecast of forecasts) {
      const forecastMs = Date.parse(forecast.forecast_at);
      if (!Number.isFinite(forecastMs)) continue;

      const deltaMs = Math.abs(forecastMs - requestedMs);
      if (
        deltaMs < nearestDeltaMs ||
        (deltaMs === nearestDeltaMs && forecastMs < nearestMs)
      ) {
        nearest = forecast;
        nearestMs = forecastMs;
        nearestDeltaMs = deltaMs;
      }
    }
  }

  const toleranceMs = FORECAST_ALIGNMENT_TOLERANCE_MINUTES * 60 * 1000;
  if (!nearest || nearestDeltaMs > toleranceMs) {
    return {
      forecast: null,
      alignment: {
        requestedForecastAt,
        matchedForecastAt: null,
        matchType: 'none',
        deltaMinutes: null,
      },
    };
  }

  return {
    forecast: nearest,
    alignment: {
      requestedForecastAt,
      matchedForecastAt: new Date(nearestMs).toISOString(),
      matchType: nearestDeltaMs === 0 ? 'exact' : 'nearest',
      deltaMinutes: nearestDeltaMs / (60 * 1000),
    },
  };
}
