"use client";

import { useEffect, useState, useId } from "react";
import {
  Activity,
  Star,
  Users,
  Car,
  Waves,
  Wind,
  Thermometer,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useSessionForecast } from "@/hooks/use-session-forecast";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WaveTypeSelector } from "@/components/ui/wave-type-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRatingDescription,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";

interface ConditionsSectionProps {
  mode: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

const windDirections = [
  { value: "N", label: "North" },
  { value: "NE", label: "Northeast" },
  { value: "E", label: "East" },
  { value: "SE", label: "Southeast" },
  { value: "S", label: "South" },
  { value: "SW", label: "Southwest" },
  { value: "W", label: "West" },
  { value: "NW", label: "Northwest" },
  { value: "OFFSHORE", label: "Offshore" },
  { value: "ONSHORE", label: "Onshore" },
  { value: "CROSS", label: "Cross-shore" },
];

const accuracyOptions = [
  {
    value: "accurate",
    label: "Yes",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100",
    description: "Forecast was spot on",
  },
  {
    value: "somewhat",
    label: "Kinda",
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 hover:bg-yellow-100",
    description: "Close but not perfect",
  },
  {
    value: "inaccurate",
    label: "No",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 hover:bg-red-100",
    description: "Way off the mark",
  },
];

interface RatingInputProps {
  label: string;
  icon: React.ComponentType<any>;
  value: string;
  onChange: (value: string) => void;
  colorClass: string;
  ratingType: "waveQuality" | "crowdLevel" | "parkingEase";
  emptyText: string;
}

function RatingInput({
  label,
  icon: Icon,
  value,
  onChange,
  colorClass,
  ratingType,
  emptyText,
}: RatingInputProps) {
  return (
    <div className="text-center">
      <label className="block text-sm font-medium mb-3">{label}</label>
      <div className="space-y-3">
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating.toString())}
              className={`p-2 rounded-lg transition-all duration-200 ${
                parseInt(value) >= rating
                  ? `${colorClass} bg-opacity-10`
                  : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"
              }`}
              title={getRatingDescription(ratingType, rating)}
            >
              <Icon
                className="w-5 h-5"
                fill={parseInt(value) >= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">
            {value
              ? `${value}/5 - ${getRatingDescription(
                  ratingType,
                  parseInt(value)
                )}`
              : emptyText}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ConditionsSection({
  mode,
  formState,
  updateField,
}: ConditionsSectionProps) {
  const [waveHeight, setWaveHeight] = useState<string>("");
  const [windSpeed, setWindSpeed] = useState<string>("");
  const [windDirection, setWindDirection] = useState<string>("");
  const [waterTemp, setWaterTemp] = useState<string>("");
  const [vibeNotes, setVibeNotes] = useState<string>("");
  const [forecastAccuracy, setForecastAccuracy] = useState<string>("accurate");
  const waveHeightInputId = useId();
  const waterTempInputId = useId();
  const windSpeedInputId = useId();
  const windDirectionLabelId = useId();
  const vibeNotesId = useId();

  // Fetch forecast data for the session date/time/beach
  const {
    forecastData,
    loading: forecastLoading,
    error: forecastError,
  } = useSessionForecast(
    formState.selectedBeachId,
    formState.selectedDate,
    formState.selectedTime
  );

  // Breadcrumb for diagnostics (log once on mount)
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
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
              Forecast for Your Session
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {forecastData.wave_height && (
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-blue-600" />
                  <span>{forecastData.wave_height} waves</span>
                </div>
              )}
              {forecastData.wind_speed && (
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-blue-600" />
                  <span>
                    {forecastData.wind_speed}{" "}
                    {forecastData.wind_direction || ""}
                  </span>
                </div>
              )}
              {forecastData.water_temp && (
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-blue-600" />
                  <span>{forecastData.water_temp} water</span>
                </div>
              )}
            </div>
          </div>
        ) : formState.selectedDate && formState.selectedBeachId ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">
              Forecast for Your Session
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
              Forecast for Your Session
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
                placeholder="3.5"
                value={waveHeight}
                onChange={(e) => setWaveHeight(e.target.value)}
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
                placeholder="68"
                value={waterTemp}
                onChange={(e) => setWaterTemp(e.target.value)}
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
                placeholder="10"
                value={windSpeed}
                onChange={(e) => setWindSpeed(e.target.value)}
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
              <Select value={windDirection} onValueChange={setWindDirection}>
                <SelectTrigger aria-labelledby={windDirectionLabelId}>
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {windDirections.map((direction) => (
                    <SelectItem key={direction.value} value={direction.value}>
                      {direction.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Experience Ratings */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Session Experience
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Wave Quality */}
            <RatingInput
              label="Wave Quality"
              icon={Star}
              value={formState.waveQuality}
              onChange={(value) => updateField("waveQuality", value)}
              colorClass="text-yellow-500"
              ratingType="waveQuality"
              emptyText="Rate the waves"
            />

            {/* Parking Ease */}
            <RatingInput
              label="Parking Ease"
              icon={Car}
              value={formState.parkingEase}
              onChange={(value) => updateField("parkingEase", value)}
              colorClass="text-green-500"
              ratingType="parkingEase"
              emptyText="How easy to park?"
            />

            {/* Crowd Level */}
            <RatingInput
              label="Crowd Level"
              icon={Users}
              value={formState.crowdLevel}
              onChange={(value) => updateField("crowdLevel", value)}
              colorClass="text-orange-500"
              ratingType="crowdLevel"
              emptyText="How crowded?"
            />
          </div>
        </div>

        {/* Wave Types */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Wave Type
          </h3>
          <WaveTypeSelector
            selectedTypes={formState.waveTypes}
            onChange={(types) => updateField("waveTypes", types)}
          />
        </div>

        {/* Vibe / Notes */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor={vibeNotesId}
          >
            Session Vibe / Notes
          </label>
          <Textarea
            id={vibeNotesId}
            placeholder="super fun, nice and glassy..."
            className="min-h-[80px]"
            value={vibeNotes}
            onChange={(e) => setVibeNotes(e.target.value)}
          />
        </div>

        {/* Forecast Accuracy */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Was the forecast accurate?
          </h3>

          <div className="grid grid-cols-3 gap-3">
            {accuracyOptions.map((option) => {
              const IconComponent = option.icon;
              const isSelected = forecastAccuracy === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForecastAccuracy(option.value)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : `border-gray-200 ${option.bgColor}`
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <IconComponent
                      className={`h-6 w-6 ${
                        isSelected ? "text-blue-600" : option.color
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        isSelected ? "text-blue-700" : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="text-xs text-gray-500 text-center">
                      {option.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            💡 Your condition reports help improve forecasts and assist other
            surfers in the community
          </p>
        </div>
      </div>
    </SimpleCardLayout>
  );
}
