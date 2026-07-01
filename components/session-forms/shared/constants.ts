import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

/**
 * Wind direction options for session form selects
 * Used by both SessionDetailsSection and ConditionsSection
 */
export const WIND_DIRECTIONS = [
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
] as const;

/**
 * Forecast accuracy options for session form
 * Used by both SessionDetailsSection and ConditionsSection
 */
export const FORECAST_ACCURACY_OPTIONS = [
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
] as const;

export const WAVE_CHARACTERISTICS = [
  { value: "clean", label: "Clean" },
  { value: "glassy", label: "Glassy" },
  { value: "choppy", label: "Choppy" },
  { value: "blown_out", label: "Blown out" },
  { value: "fat", label: "Fat" },
  { value: "mushy", label: "Mushy" },
  { value: "peaky", label: "Peaky" },
  { value: "powerful", label: "Powerful" },
  { value: "closeouts", label: "Closeouts" },
  { value: "barreling", label: "Barreling" },
  { value: "reform", label: "Reform" },
  { value: "walled", label: "Walled" },
  { value: "rights", label: "Rights" },
  { value: "lefts", label: "Lefts" },
  { value: "steep", label: "Steep" },
] as const;

export const RIP_CURRENT_OBSERVED_OPTIONS = [
  { value: "none", label: "None" },
  { value: "light", label: "Light" },
  { value: "strong", label: "Strong" },
] as const;
