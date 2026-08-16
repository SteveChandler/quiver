"use client";

import { useEffect, useId } from "react";
import {
  Waves,
  Wind,
  Thermometer,
  Moon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useSessionForecast } from "@/hooks/use-session-forecast";
import { useSessionTideSnapshot } from "@/hooks/use-session-tide-snapshot";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SessionFormMode } from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";
import { RIP_CURRENT_OBSERVED_OPTIONS, WIND_DIRECTIONS } from "./shared";
import { formatWaterTemp } from "@/lib/formatters/surf-data";
import { formatSessionTideSnapshot } from "@/lib/services/session-tide-snapshot";

// Tide status options for the dropdown
const tideStatusOptions = [
  { value: "rising", label: "Rising" },
  { value: "falling", label: "Falling" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

interface ConditionsSectionProps {
  /** Reserved for future per-mode UI variants (currently unused — prefill lives in useSessionConditionsPrefill). */
  mode?: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function ConditionsSection({
  formState,
  updateField,
}: ConditionsSectionProps) {
  const waveHeightInputId = useId();
  const waterTempInputId = useId();
  const windSpeedInputId = useId();
  const windDirectionLabelId = useId();
  const tideHeightInputId = useId();
  const tideStatusLabelId = useId();
  const isRecommendationLog = Boolean(formState.recommendationId);

  // Helper to convert number|undefined to string for input display
  const numberToString = (value: number | undefined): string =>
    value !== undefined && value !== null ? String(value) : "";

  // Helper to convert string input to number|undefined for formState
  const stringToNumber = (value: string): number | undefined => {
    if (value === "") return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  // Forecast data for the comparison panel. Auto-prefill itself happens at the
  // form level via useSessionConditionsPrefill, so it runs even when this
  // section is collapsed in QuickLog.
  const {
    forecastData,
    loading: forecastLoading,
    error: forecastError,
  } = useSessionForecast(
    formState.selectedBeachId ?? null,
    formState.selectedDate ?? null,
    formState.selectedTime ?? null
  );
  const { tideSnapshot } = useSessionTideSnapshot(
    formState.selectedBeachId ?? null,
    formState.selectedDate ?? null,
    formState.selectedTime ?? null
  );
  const tidePreviewText = tideSnapshot
    ? formatSessionTideSnapshot(tideSnapshot)
    : forecastData?.tide_height !== null && forecastData?.tide_height !== undefined
      ? `${forecastData.tide_height} ft · ${forecastData.tide_status || "tide"}`
      : null;
  const tidePreviewStatus =
    tideSnapshot?.tideStatus ?? forecastData?.tide_status?.toLowerCase();

  // Breadcrumb for diagnostics (log once on mount)
  useEffect(() => {
    try {

      console.debug(
        "[ConditionsStep] isReady:",
        Boolean(formState.selectedBeachId && formState.selectedDate),
        "providedQuestions:",
        0
      );
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SimpleCardLayout
      title={
        <span className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">
          Actual Conditions
        </span>
      }
      description={
        formState.selectedBeachId && formState.selectedDate
          ? "Help the community with real surf reports"
          : "Select a beach and date above, then fill in what you observed"
      }
    >
      <div className="space-y-8">
        {/* Forecast vs Actual Comparison */}
        {forecastLoading ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-3 bg-gray-300 rounded"></div>
                <div className="h-3 bg-gray-300 rounded"></div>
                <div className="h-3 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        ) : forecastData &&
          formState.selectedBeachId &&
          formState.selectedDate ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              Forecast from Your Session
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {Number.isFinite(forecastData.wave_height) && (
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-blue-600" />
                  <span>{forecastData.wave_height} ft waves</span>
                </div>
              )}
              {Number.isFinite(forecastData.wind_speed) && (
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-blue-600" />
                  <span>
                    {forecastData.wind_speed} mph{" "}
                    {forecastData.wind_direction || ""}
                  </span>
                </div>
              )}
              {Number.isFinite(forecastData.water_temp) && (
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-blue-600" />
                  <span>{formatWaterTemp(forecastData.water_temp as number)} water</span>
                </div>
              )}
              {tidePreviewText && (
                <div className="flex items-center gap-2">
                  {tidePreviewStatus === "rising" ? (
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  ) : tidePreviewStatus === "falling" ? (
                    <TrendingDown className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Waves className="h-4 w-4 text-blue-600" />
                  )}
                  <span>{tidePreviewText}</span>
                </div>
              )}
            </div>
            {/* Night Session Indicator */}
            {forecastData.isNightSession && (
              <div className="mt-3 pt-3 border-t border-blue-200 flex items-center gap-2 text-sm text-blue-700">
                <Moon className="h-4 w-4" />
                <span>Session logged during evening/night hours</span>
              </div>
            )}
          </div>
        ) : formState.selectedDate && formState.selectedBeachId ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">
              Forecast from Your Session
            </h4>
            <p className="text-sm text-amber-700">
              {forecastError?.includes("historical")
                ? "Historical forecast data not available - but your report will help the community!"
                : "No forecast data available for this date/time. You can still report conditions to help the community!"}
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">
              Forecast from Your Session
            </h4>
            <p className="text-sm text-gray-600">
              Select a beach and date to see forecast data. You can still fill
              in the fields below.
            </p>
          </div>
        )}

        {/* Actual Conditions */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">
            Your Observations
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wave Height */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 text-sm font-medium"
                htmlFor={waveHeightInputId}
              >
                <Waves className="h-4 w-4" />
                Wave Height (ft)
              </label>
              <Input
                id={waveHeightInputId}
                type="number"
                step="0.1"
                min="0"
                max="50"
                placeholder={
                  !forecastData && formState.selectedBeachId
                    ? "e.g., 3-4"
                    : "3.5"
                }
                value={numberToString(formState.waveHeight)}
                onChange={(e) => {
                  updateField("waveHeight", stringToNumber(e.target.value));
                  if (isRecommendationLog) {
                    updateField("waveHeightEdited", true);
                  }
                }}
              />
            </div>

            {/* Water Temperature */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 text-sm font-medium"
                htmlFor={waterTempInputId}
              >
                <Thermometer className="h-4 w-4" />
                Water Temp (°F)
              </label>
              <Input
                id={waterTempInputId}
                type="number"
                min="32"
                max="100"
                placeholder={
                  !forecastData && formState.selectedBeachId ? "e.g., 62" : "68"
                }
                value={formState.waterTemp}
                onChange={(e) =>
                  updateField("waterTemp", e.target.value)
                }
              />
            </div>

            {/* Wind Speed */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 text-sm font-medium"
                htmlFor={windSpeedInputId}
              >
                <Wind className="h-4 w-4" />
                Wind Speed (mph)
              </label>
              <Input
                id={windSpeedInputId}
                type="number"
                step="0.1"
                min="0"
                max="150"
                placeholder={
                  !forecastData && formState.selectedBeachId
                    ? "e.g., 5-10"
                    : "10"
                }
                value={numberToString(formState.windSpeed)}
                onChange={(e) =>
                  updateField("windSpeed", stringToNumber(e.target.value))
                }
              />
            </div>

            {/* Wind Direction */}
            <div>
              <span
                id={windDirectionLabelId}
                className="mb-2 block text-sm font-medium"
              >
                Wind Direction
              </span>
              <Select
                value={formState.windDirection ?? ""}
                onValueChange={(value) =>
                  updateField("windDirection", value)
                }
              >
                <SelectTrigger aria-labelledby={windDirectionLabelId}>
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {WIND_DIRECTIONS.map((direction) => (
                    <SelectItem key={direction.value} value={direction.value}>
                      {direction.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isRecommendationLog && (
              <div>
                <label
                  className="mb-2 flex items-center gap-2 text-sm font-medium"
                  htmlFor={tideHeightInputId}
                >
                  <TrendingUp className="h-4 w-4" />
                  Tide Height (ft)
                </label>
                <Input
                  id={tideHeightInputId}
                  type="number"
                  step="0.1"
                  min="-5"
                  max="15"
                  placeholder={
                    !forecastData && formState.selectedBeachId
                      ? "e.g., 2.1"
                      : "2.5"
                  }
                  value={numberToString(formState.tideHeight)}
                  onChange={(e) =>
                    updateField("tideHeight", stringToNumber(e.target.value))
                  }
                />
                {tidePreviewText && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Forecast: {tidePreviewText}
                  </p>
                )}
              </div>
            )}

            {/* Tide Status */}
            <div>
              <span
                id={tideStatusLabelId}
                className="mb-2 block text-sm font-medium"
              >
                Tide Status
              </span>
              <Select
                value={formState.tideStatus ?? ""}
                onValueChange={(value) => {
                  updateField("tideStatus", value);
                  if (isRecommendationLog) {
                    updateField("tideStatusEdited", true);
                  }
                }}
              >
                <SelectTrigger aria-labelledby={tideStatusLabelId}>
                  <SelectValue placeholder="Select tide status" />
                </SelectTrigger>
                <SelectContent>
                  {tideStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rip Current */}
            <div className="md:col-span-2">
              <span className="mb-2 block text-sm font-medium">
                Rip current?
              </span>
              <div className="grid grid-cols-3 gap-2">
                {RIP_CURRENT_OBSERVED_OPTIONS.map((option) => {
                  const selected = formState.ripCurrentObserved === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        updateField(
                          "ripCurrentObserved",
                          selected ? undefined : option.value
                        )
                      }
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? option.value === "none"
                            ? "border-slate-300 bg-slate-100 text-slate-900"
                            : "border-amber-400 bg-amber-100 text-amber-900"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }` + " focus-ring"}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </SimpleCardLayout>
  );
}
