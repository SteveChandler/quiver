import type { AlertConditions, BeachAlertMeta, ForecastHour } from "./types";
import { evaluateConditions } from "./condition-evaluator";
import { scoreForecastHour } from "./best-hour";

export interface FoundWindow {
  window_start: string;
  window_end: string;
  best_hour: string;
  best_score: number;
  conditions_snapshot: Record<string, unknown>;
}

export function findMatchingWindows(
  conditions: AlertConditions,
  forecasts: ForecastHour[],
  beach: BeachAlertMeta
): FoundWindow[] {
  const windows: FoundWindow[] = [];
  let currentWindow: ForecastHour[] = [];

  for (const forecast of forecasts) {
    if (evaluateConditions(conditions, forecast, beach)) {
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

function buildWindow(conditions: AlertConditions, hours: ForecastHour[]): FoundWindow {
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

  return {
    window_start: hours[0].forecast_at,
    window_end: hours[hours.length - 1].forecast_at,
    best_hour: best.forecast_at,
    best_score: bestScore,
    conditions_snapshot: {
      wave_height: best.wave_height,
      wave_period: best.wave_period,
      swell_1_period: best.swell_1_period,
      swell_1_direction: best.swell_1_direction,
      wind_speed: best.wind_speed,
      wind_direction_deg: best.wind_direction_deg,
      tide_height: best.tide_height,
      tide_status: best.tide_status,
    },
  };
}
