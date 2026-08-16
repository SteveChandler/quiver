import { fromZonedTime } from "date-fns-tz";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import { formatWaveHeightRangeString } from "@/lib/utils/wave-formatters";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SupabaseServerClient } from "@/types/supabase";

export type DailyIntelWaveHeightLabels = {
  current_wave_height_label: string | null;
  best_window_wave_height_label: string | null;
};

type WindowInput = {
  bestWindowStart?: string | null;
  bestWindowEnd?: string | null;
};

function parseWaveHeights(value: string | null | undefined): number[] {
  if (!value) return [];
  return (value.match(/[\d.]+/g) ?? [])
    .map((part) => Number.parseFloat(part))
    .filter((height) => Number.isFinite(height) && height >= 0);
}

function labelFromForecasts(forecasts: EnhancedForecastEntity[]): string | null {
  const heights = forecasts.flatMap((forecast) =>
    parseWaveHeights(forecast.wave_height)
  );

  if (heights.length === 0) return null;
  return formatWaveHeightRangeString(Math.min(...heights), Math.max(...heights));
}

async function applyDisplayOverride(
  forecasts: EnhancedForecastEntity[]
): Promise<EnhancedForecastEntity[]> {
  try {
    return await applyV51DisplayOverrideToForecasts(forecasts, {
      enabled: true,
    });
  } catch {
    return forecasts;
  }
}

function emptyLabels(): DailyIntelWaveHeightLabels {
  return {
    current_wave_height_label: null,
    best_window_wave_height_label: null,
  };
}

/**
 * Convert a beach-local wall-clock date+time (as written by
 * intel-generation-service.ts) into a UTC instant for querying
 * enhanced_forecasts.forecast_at, which is stored in UTC.
 */
function toUtcInstant(
  forecastDate: string,
  localTime: string,
  beachTimezone: string
): string {
  return fromZonedTime(`${forecastDate}T${localTime}`, beachTimezone).toISOString();
}

export async function getDailyIntelWaveHeightLabels(
  supabase: SupabaseServerClient,
  beachId: string,
  forecastDate: string,
  windowInput: WindowInput = {},
  beachTimezone?: string | null
): Promise<DailyIntelWaveHeightLabels> {
  const tz = beachTimezone || "UTC";
  const labels = emptyLabels();

  try {
    const now = new Date();
    const earliest = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const { data: currentRows, error: currentError } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .lte("forecast_at", now.toISOString())
      .gte("forecast_at", earliest.toISOString())
      .order("forecast_at", { ascending: false })
      .limit(8);

    if (!currentError && currentRows?.length) {
      const [currentForecast] = await applyDisplayOverride(
        currentRows as EnhancedForecastEntity[]
      );
      labels.current_wave_height_label = currentForecast
        ? labelFromForecasts([currentForecast])
        : null;
    }

    if (windowInput.bestWindowStart && windowInput.bestWindowEnd) {
      const { data: windowRows, error: windowError } = await supabase
        .from("enhanced_forecasts")
        .select("*")
        .eq("beach_id", beachId)
        .gte("forecast_at", toUtcInstant(forecastDate, windowInput.bestWindowStart, tz))
        .lte("forecast_at", toUtcInstant(forecastDate, windowInput.bestWindowEnd, tz))
        .order("forecast_at", { ascending: true })
        .limit(24);

      if (!windowError && windowRows?.length) {
        const displayRows = await applyDisplayOverride(
          windowRows as EnhancedForecastEntity[]
        );
        labels.best_window_wave_height_label = labelFromForecasts(displayRows);
      }
    }

    return labels;
  } catch {
    return labels;
  }
}
