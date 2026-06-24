import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import {
  selectBestWindow,
  type WindowSelectorOptions,
} from "@/lib/services/discovery/window-selector";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { PersonalizedForecastWindow } from "@/types/personalization";

export type ForecastDisplayContext = "today_headline" | "selected_hour";

export interface ForecastDisplay {
  label: string;
  minFt: number;
  maxFt: number;
  forecastAt: string;
  context: ForecastDisplayContext;
}

export interface TodayHeadlineResult {
  window: PersonalizedForecastWindow;
  display: ForecastDisplay;
}

interface ParsedWaveHeightLabel {
  label: string;
  minFt: number;
  maxFt: number;
}

export function parseForecastHeightLabel(
  value: string | number | null | undefined
): ParsedWaveHeightLabel | null {
  if (value == null) return null;

  if (typeof value === "number") {
    return displayFromNumericHeight(value);
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === "flat") {
    return { label: "Flat", minFt: 0, maxFt: 0 };
  }

  const rangeMatch = normalized.match(
    /(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    const min = Number.parseFloat(rangeMatch[1]);
    const max = Number.parseFloat(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      const minFt = Math.max(0, Math.floor(Math.min(min, max)));
      const maxFt = Math.max(minFt, Math.ceil(Math.max(min, max)));
      const label = minFt === maxFt ? `${minFt}ft` : `${minFt}-${maxFt}ft`;
      return { label, minFt, maxFt };
    }
  }

  const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) return null;

  const numeric = Number.parseFloat(numericMatch[0]);
  if (!Number.isFinite(numeric)) return null;
  return displayFromNumericHeight(numeric);
}

export function displayForForecast(
  forecast: EnhancedForecastEntity,
  context: ForecastDisplayContext
): ForecastDisplay | null {
  const parsed = parseForecastHeightLabel(forecast.wave_height);
  if (!parsed || !forecast.forecast_at) return null;

  return {
    ...parsed,
    forecastAt: forecast.forecast_at,
    context,
  };
}

export function resolveSelectedHourDisplay(
  forecast: EnhancedForecastEntity | null | undefined
): ForecastDisplay | null {
  return forecast ? displayForForecast(forecast, "selected_hour") : null;
}

export function resolveTodayHeadline(
  options: WindowSelectorOptions
): TodayHeadlineResult | null {
  const window = selectBestWindow({
    ...options,
    maxWindows: 1,
  });
  if (!window) return null;

  const sourceForecast =
    window.sourceForecast ??
    options.forecasts.find(
      (forecast) => forecast.forecast_at === window.start.toISOString()
    ) ??
    null;

  const display = sourceForecast
    ? displayForForecast(sourceForecast, "today_headline")
    : displayForWindowFallback(window);
  if (!display) return null;

  return { window, display };
}

function displayFromNumericHeight(value: number): ParsedWaveHeightLabel | null {
  if (!Number.isFinite(value)) return null;
  const label = formatWaveHeightRange(value);
  if (label === "Flat") return { label, minFt: 0, maxFt: 0 };

  const rangeMatch = label.match(/^(\d+)(?:-(\d+))?ft$/);
  if (!rangeMatch) return null;

  const minFt = Number.parseInt(rangeMatch[1], 10);
  const maxFt = rangeMatch[2]
    ? Number.parseInt(rangeMatch[2], 10)
    : minFt;
  return { label, minFt, maxFt };
}

function displayForWindowFallback(
  window: PersonalizedForecastWindow
): ForecastDisplay | null {
  const parsed = parseForecastHeightLabel(window.waveHeight);
  if (!parsed) return null;

  return {
    ...parsed,
    forecastAt: window.start.toISOString(),
    context: "today_headline",
  };
}
