import type { AlertConditions, BeachAlertMeta, ForecastHour } from "./types";
import { evaluateConditions } from "./condition-evaluator";
import { scoreForecastHour } from "./best-hour";

export interface FoundWindow {
  window_start: string;
  window_end: string;
  best_hour: string;
  forecast_id?: string;
  best_score: number;
  conditions_snapshot: Record<string, unknown>;
}

const FORECAST_HOUR_DURATION_MS = 60 * 60 * 1000;
const MAX_CONTIGUOUS_GAP_MS = 90 * 60 * 1000;

export function findMatchingWindows(
  conditions: AlertConditions,
  forecasts: ForecastHour[],
  beach: BeachAlertMeta,
): FoundWindow[] {
  const windows: FoundWindow[] = [];
  let currentWindow: ForecastHour[] = [];

  for (const forecast of forecasts) {
    if (evaluateConditions(conditions, forecast, beach)) {
      const previous = currentWindow[currentWindow.length - 1];
      if (previous && isSparseGap(previous.forecast_at, forecast.forecast_at)) {
        windows.push(buildWindow(conditions, currentWindow));
        currentWindow = [];
      }
      currentWindow.push(forecast);
    } else {
      if (currentWindow.length > 0) {
        windows.push(buildWindow(conditions, currentWindow));
        currentWindow = [];
      }
    }
  }

  if (currentWindow.length > 0) {
    windows.push(buildWindow(conditions, currentWindow));
  }

  return windows;
}

function isSparseGap(
  previousForecastAt: string,
  nextForecastAt: string,
): boolean {
  const previousMs = new Date(previousForecastAt).getTime();
  const nextMs = new Date(nextForecastAt).getTime();
  if (!Number.isFinite(previousMs) || !Number.isFinite(nextMs)) return false;
  return nextMs - previousMs > MAX_CONTIGUOUS_GAP_MS;
}

function buildWindow(
  conditions: AlertConditions,
  hours: ForecastHour[],
): FoundWindow {
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < hours.length; i++) {
    const score = scoreForecastHour(conditions, hours[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const best = hours[bestIdx];

  // Each forecast hour represents a 60-minute interval, so window_end is the
  // last hour's timestamp + 1h. Without this, a single-hour match has
  // window_start === window_end (zero-duration), which the surfability gate
  // suppresses as too short, and the email renders as "8:00 AM – 8:00 AM".
  const lastHourEndMs =
    new Date(hours[hours.length - 1].forecast_at).getTime() +
    FORECAST_HOUR_DURATION_MS;

  return {
    window_start: hours[0].forecast_at,
    window_end: new Date(lastHourEndMs).toISOString(),
    best_hour: best.forecast_at,
    forecast_id: best.forecast_id,
    best_score: bestScore,
    conditions_snapshot: {
      wave_height: best.wave_height,
      wave_period: best.wave_period,
      wave_direction: best.wave_direction,
      swell_1_period: best.swell_1_period,
      swell_1_direction: best.swell_1_direction,
      wind_speed: best.wind_speed,
      wind_direction_deg: best.wind_direction_deg,
      tide_height: best.tide_height,
      tide_status: best.tide_status,
      ...(best.forecast_id ? { forecast_id: best.forecast_id } : {}),
      ...(conditions.beginner_sandy_window
        ? {
            beginner_window_reason: buildBeginnerWindowReason(conditions, best),
          }
        : {}),
    },
  };
}

function buildBeginnerWindowReason(
  conditions: AlertConditions,
  forecast: ForecastHour,
): string {
  const reasons = ["small waves"];
  if (forecast.wind_speed != null && conditions.wind_speed_max_kt != null) {
    reasons.push("light wind");
  }
  if (conditions.local_time_start && conditions.local_time_end) {
    reasons.push("morning window");
  }
  if (forecast.tide_status) {
    reasons.push(`${forecast.tide_status.toLowerCase()} tide`);
  } else {
    reasons.push("low-to-mid tide fit");
  }
  return `${reasons.join(", ")}.`;
}
