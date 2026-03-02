"use client";

import { useEffect, useId, useRef, useCallback } from "react";
import {
  Activity,
  Waves,
  Wind,
  Thermometer,
  Moon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useSessionForecast } from "@/hooks/use-session-forecast";
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
import { WIND_DIRECTIONS } from "./shared";
import { formatWaterTemp } from "@/lib/formatters/surf-data";

// Tide status options for the dropdown
const tideStatusOptions = [
  { value: "rising", label: "Rising" },
  { value: "falling", label: "Falling" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

// Field state tracking for auto-prefill
type FieldState = "empty" | "prefilled" | "user-edited";
type FieldStateTracking = {
  waveHeight: FieldState;
  windSpeed: FieldState;
  windDirection: FieldState;
  waterTemp: FieldState;
  tideHeight: FieldState;
  tideStatus: FieldState;
};

interface ConditionsSectionProps {
  mode: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function ConditionsSection({
  mode,
  formState,
  updateField,
}: ConditionsSectionProps) {
  const waveHeightInputId = useId();
  const waterTempInputId = useId();
  const windSpeedInputId = useId();
  const windDirectionLabelId = useId();
  const tideHeightInputId = useId();
  const tideStatusLabelId = useId();

  // Track field states for auto-prefill logic
  // States: empty -> prefilled -> user-edited
  const fieldStatesRef = useRef<FieldStateTracking>({
    waveHeight: "empty",
    windSpeed: "empty",
    windDirection: "empty",
    waterTemp: "empty",
    tideHeight: "empty",
    tideStatus: "empty",
  });

  // Track the last beach/date/time combination to detect changes
  const lastPrefillKeyRef = useRef<string>("");

  // Helper to convert number|undefined to string for input display
  const numberToString = (value: number | undefined): string =>
    value !== undefined && value !== null ? String(value) : "";

  // Helper to convert string input to number|undefined for formState
  const stringToNumber = (value: string): number | undefined => {
    if (value === "") return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  // Helper to check if a field is empty (for prefill logic)
  const isFieldEmpty = useCallback(
    (field: keyof FieldStateTracking): boolean => {
      switch (field) {
        case "waveHeight":
          return (
            formState.waveHeight === undefined || formState.waveHeight === null
          );
        case "windSpeed":
          return (
            formState.windSpeed === undefined || formState.windSpeed === null
          );
        case "windDirection":
          return !formState.windDirection;
        case "waterTemp":
          return !formState.waterTemp;
        case "tideHeight":
          return (
            formState.tideHeight === undefined || formState.tideHeight === null
          );
        case "tideStatus":
          return !formState.tideStatus;
        default:
          return true;
      }
    },
    [formState]
  );

  // Wrapper for updateField that tracks user edits
  const handleFieldUpdate = useCallback(
    <K extends keyof SessionFormState>(field: K, value: SessionFormState[K]) => {
      // Mark field as user-edited if it's a tracked condition field
      const trackedField = field as keyof FieldStateTracking;
      if (trackedField in fieldStatesRef.current) {
        fieldStatesRef.current[trackedField] = "user-edited";
      }
      updateField(field, value);
    },
    [updateField]
  );

  // Fetch forecast data for the session date/time/beach
  const {
    forecastData,
    loading: forecastLoading,
    error: forecastError,
  } = useSessionForecast(
    formState.selectedBeachId ?? null,
    formState.selectedDate ?? null,
    formState.selectedTime ?? null
  );

  // Auto-prefill effect: Only for "log" mode, only when fields are empty
  useEffect(() => {
    // Only auto-prefill in "log" mode (logging a completed session)
    if (mode !== "log") return;

    // Only prefill when we have forecast data
    if (!forecastData || forecastLoading) return;

    // Create a key for this beach/date/time combination
    const currentPrefillKey = `${formState.selectedBeachId}-${formState.selectedDate}-${formState.selectedTime}`;

    // If beach/date/time changed, reset tracking to allow new prefill
    if (currentPrefillKey !== lastPrefillKeyRef.current) {
      lastPrefillKeyRef.current = currentPrefillKey;
      // Reset tracked fields that are empty to allow prefill
      Object.keys(fieldStatesRef.current).forEach((key) => {
        const field = key as keyof FieldStateTracking;
        if (isFieldEmpty(field)) {
          fieldStatesRef.current[field] = "empty";
        }
      });
    }

    // Prefill each field only if: (1) field is empty, (2) forecast has data
    // Wave Height
    if (
      fieldStatesRef.current.waveHeight === "empty" &&
      forecastData.wave_height !== undefined
    ) {
      updateField("waveHeight", forecastData.wave_height);
      fieldStatesRef.current.waveHeight = "prefilled";
    }

    // Wind Speed
    if (
      fieldStatesRef.current.windSpeed === "empty" &&
      forecastData.wind_speed !== undefined
    ) {
      updateField("windSpeed", forecastData.wind_speed);
      fieldStatesRef.current.windSpeed = "prefilled";
    }

    // Wind Direction
    if (
      fieldStatesRef.current.windDirection === "empty" &&
      forecastData.wind_direction
    ) {
      updateField("windDirection", forecastData.wind_direction);
      fieldStatesRef.current.windDirection = "prefilled";
    }

    // Water Temp
    if (
      fieldStatesRef.current.waterTemp === "empty" &&
      forecastData.water_temp !== undefined
    ) {
      updateField("waterTemp", String(forecastData.water_temp));
      fieldStatesRef.current.waterTemp = "prefilled";
    }

    // Tide Height
    if (
      fieldStatesRef.current.tideHeight === "empty" &&
      forecastData.tide_height !== null
    ) {
      updateField("tideHeight", forecastData.tide_height);
      fieldStatesRef.current.tideHeight = "prefilled";
    }

    // Tide Status
    if (
      fieldStatesRef.current.tideStatus === "empty" &&
      forecastData.tide_status
    ) {
      updateField("tideStatus", forecastData.tide_status.toLowerCase());
      fieldStatesRef.current.tideStatus = "prefilled";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastData, forecastLoading, mode, formState.selectedBeachId, formState.selectedDate, formState.selectedTime]);

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
        <div className="flex items-center">
          <Activity className="w-5 h-5 mr-2 text-primary" />
          Session Conditions
        </div>
      }
      description={
        formState.selectedBeachId && formState.selectedDate
          ? "Rate the conditions during your session and help the community with real-time data"
          : "Showing fallback until beach and date are selected. You can still enter your observations."
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
              {forecastData.tide_height !== null && (
                <div className="flex items-center gap-2">
                  {forecastData.tide_status?.toLowerCase() === "rising" ? (
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  ) : forecastData.tide_status?.toLowerCase() === "falling" ? (
                    <TrendingDown className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Waves className="h-4 w-4 text-blue-600" />
                  )}
                  <span>
                    {forecastData.tide_height} ft{" "}
                    {forecastData.tide_status || "tide"}
                  </span>
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
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Actual Surf Conditions
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
                onChange={(e) =>
                  handleFieldUpdate("waveHeight", stringToNumber(e.target.value))
                }
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
                  handleFieldUpdate("waterTemp", e.target.value)
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
                  handleFieldUpdate("windSpeed", stringToNumber(e.target.value))
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
                  handleFieldUpdate("windDirection", value)
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

            {/* Tide Height */}
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
                  handleFieldUpdate("tideHeight", stringToNumber(e.target.value))
                }
              />
            </div>

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
                onValueChange={(value) =>
                  handleFieldUpdate("tideStatus", value)
                }
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
          </div>
        </div>

      </div>
    </SimpleCardLayout>
  );
}
