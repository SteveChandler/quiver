'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { WaveTypeSelector } from "@/components/ui/wave-type-selector";
import {
  Waves,
  Wind,
  Thermometer,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

export type WindDirection =
  | "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
  | "OFFSHORE" | "ONSHORE" | "CROSS";

export type ForecastAccuracy = "accurate" | "somewhat" | "inaccurate";

export interface IntelConditionsFieldsProps {
  waveHeight: number | null;
  onWaveHeightChange: (value: number | null) => void;
  waterTemp: number | null;
  onWaterTempChange: (value: number | null) => void;
  windSpeed: number | null;
  onWindSpeedChange: (value: number | null) => void;
  windDirection: WindDirection | null;
  onWindDirectionChange: (value: WindDirection | null) => void;
  crowdLevel: number | null;
  onCrowdLevelChange: (value: number | null) => void;
  waveTypes: string[];
  onWaveTypesChange: (value: string[]) => void;
  forecastAccuracy: ForecastAccuracy | null;
  onForecastAccuracyChange: (value: ForecastAccuracy | null) => void;
  onFieldEdited?: (field: 'wave_height' | 'wind_speed' | 'wind_direction' | 'water_temp') => void;
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
    value: "accurate" as const,
    label: "Yes",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100",
    description: "Forecast was spot on",
  },
  {
    value: "somewhat" as const,
    label: "Kinda",
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 hover:bg-yellow-100",
    description: "Close but not perfect",
  },
  {
    value: "inaccurate" as const,
    label: "No",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 hover:bg-red-100",
    description: "Way off the mark",
  },
];

const crowdLabels = ["", "Empty", "Light", "Moderate", "Busy", "Packed"];

export function IntelConditionsFields({
  waveHeight,
  onWaveHeightChange,
  waterTemp,
  onWaterTempChange,
  windSpeed,
  onWindSpeedChange,
  windDirection,
  onWindDirectionChange,
  crowdLevel,
  onCrowdLevelChange,
  waveTypes,
  onWaveTypesChange,
  forecastAccuracy,
  onForecastAccuracyChange,
  onFieldEdited,
}: IntelConditionsFieldsProps) {
  return (
    <div className="space-y-6 border-t pt-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Current Surf Conditions
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wave Height */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Waves className="h-4 w-4" />
            Wave Height (ft)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="50"
            placeholder="3.5"
            value={waveHeight ?? ""}
            onChange={(e) => {
              onFieldEdited?.('wave_height');
              onWaveHeightChange(
                e.target.value ? parseFloat(e.target.value) : null
              );
            }}
          />
        </div>

        {/* Water Temperature */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            Water Temp (F)
          </Label>
          <Input
            type="number"
            min="32"
            max="100"
            placeholder="68"
            value={waterTemp ?? ""}
            onChange={(e) => {
              onFieldEdited?.('water_temp');
              onWaterTempChange(
                e.target.value ? parseFloat(e.target.value) : null
              );
            }}
          />
        </div>

        {/* Wind Speed */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Wind className="h-4 w-4" />
            Wind Speed (mph)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="150"
            placeholder="10"
            value={windSpeed ?? ""}
            onChange={(e) => {
              onFieldEdited?.('wind_speed');
              onWindSpeedChange(
                e.target.value ? parseFloat(e.target.value) : null
              );
            }}
          />
        </div>

        {/* Wind Direction */}
        <div className="space-y-2">
          <Label>Wind Direction</Label>
          <Select
            value={windDirection || ""}
            onValueChange={(value) => {
              onFieldEdited?.('wind_direction');
              onWindDirectionChange(value as WindDirection);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select direction" />
            </SelectTrigger>
            <SelectContent>
              {windDirections.map((direction) => (
                <SelectItem
                  key={direction.value}
                  value={direction.value}
                >
                  {direction.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Crowd Level */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Crowd Level
        </Label>
        <div className="space-y-3">
          <Slider
            min={1}
            max={5}
            step={1}
            value={[crowdLevel || 3]}
            onValueChange={(value) => onCrowdLevelChange(value[0])}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Empty</span>
            <Badge variant="outline" className="text-xs">
              {crowdLabels[crowdLevel || 3] || "Moderate"}
            </Badge>
            <span>Packed</span>
          </div>
        </div>
      </div>

      {/* Wave Types */}
      <div className="space-y-3">
        <WaveTypeSelector
          selectedTypes={waveTypes}
          onChange={onWaveTypesChange}
        />
      </div>

      {/* Forecast Accuracy */}
      <div className="space-y-3">
        <Label>Was today&apos;s forecast accurate?</Label>
        <div className="grid grid-cols-3 gap-3">
          {accuracyOptions.map((option) => {
            const IconComponent = option.icon;
            const isSelected = forecastAccuracy === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onForecastAccuracyChange(option.value)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : `border-gray-200 ${option.bgColor}`
                }` + " focus-ring"}
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
    </div>
  );
}
