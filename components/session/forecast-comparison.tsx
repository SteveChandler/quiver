"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, Wind, Thermometer, TrendingUp, Info, Database, ArrowRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ParsedForecastSnapshot,
  ForecastFieldDiff,
  hasDifferences,
} from "@/types/forecast-snapshot";

interface ForecastComparisonProps {
  snapshot: ParsedForecastSnapshot;
  className?: string;
}

interface ComparisonRowProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  forecastValue: string | number | undefined | null;
  actualValue: string | number | undefined | null;
  diff?: ForecastFieldDiff;
  unit?: string;
}

/**
 * Renders the diff indicator arrow and value
 */
function DiffIndicator({ diff }: { diff?: ForecastFieldDiff }) {
  if (!diff || diff.diff === undefined) return null;

  const numDiff = diff.diff;
  const isPositive = numDiff > 0;
  const isNegative = numDiff < 0;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isPositive && "text-green-600",
        isNegative && "text-red-600",
        !isPositive && !isNegative && "text-gray-500"
      )}
    >
      {isPositive && <ArrowUp className="h-3 w-3" />}
      {isNegative && <ArrowDown className="h-3 w-3" />}
      {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
      <span>{isPositive ? "+" : ""}{numDiff.toFixed(1)}</span>
    </div>
  );
}

/**
 * Single comparison row showing forecast vs actual
 */
function ComparisonRow({
  label,
  icon: Icon,
  forecastValue,
  actualValue,
  diff,
  unit = "",
}: ComparisonRowProps) {
  // Don't render if neither value exists
  if (forecastValue === undefined && actualValue === undefined) return null;
  if (forecastValue === null && actualValue === null) return null;

  const formatValue = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null) return "--";
    if (typeof value === "number") return value.toFixed(1);
    return value;
  };

  const hasDiff = diff !== undefined;

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 flex-shrink-0">
        <Icon className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <span className="font-medium">{label}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Forecast Value */}
        <div className="text-right min-w-[60px]">
          <div className="text-xs text-gray-500 mb-0.5">Forecast</div>
          <div className={cn("text-sm font-medium", hasDiff && "text-gray-500")}>
            {formatValue(forecastValue)}{unit && forecastValue !== undefined && forecastValue !== null ? unit : ""}
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />

        {/* Actual Value */}
        <div className="text-right min-w-[60px]">
          <div className="text-xs text-gray-500 mb-0.5">Actual</div>
          <div className={cn("text-sm font-semibold", hasDiff ? "text-blue-700" : "text-gray-700")}>
            {formatValue(actualValue)}{unit && actualValue !== undefined && actualValue !== null ? unit : ""}
          </div>
        </div>

        {/* Diff Indicator */}
        {hasDiff && (
          <div className="min-w-[50px]">
            <DiffIndicator diff={diff} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confidence score badge
 */
function ConfidenceBadge({ score }: { score: number }) {
  const getColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-700";
    if (score >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getColor(score))}>
      {score}% confidence
    </span>
  );
}

/**
 * Data source badge
 */
function DataSourceBadge({ source }: { source: string }) {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <Database className="h-3 w-3" />
      {source}
    </span>
  );
}

/**
 * ForecastComparison Component
 *
 * Displays the forecast conditions at the time of the session alongside
 * the actual conditions reported by the user. Shows diffs where applicable.
 *
 * Uses neutral copy (no "recommended" language) suitable for any session type.
 */
export function ForecastComparison({ snapshot, className }: ForecastComparisonProps) {
  const { forecast_snapshot, actual_conditions, forecast_vs_actual, forecast_confidence_score, data_source } = snapshot;

  // Parse forecast values - handle both string and number formats
  const parseNumeric = (value: unknown): number | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  };

  // Get forecast values
  const forecastWaveHeight = parseNumeric(forecast_snapshot.wave_height);
  const forecastWindSpeed = parseNumeric(forecast_snapshot.wind_speed_mph);
  const forecastWindDirection = forecast_snapshot.wind_direction;
  const forecastTideHeight = parseNumeric(forecast_snapshot.tide_height);
  const forecastTideStatus = forecast_snapshot.tide_status;
  const forecastWaterTemp = parseNumeric(forecast_snapshot.water_temp);

  // Get actual values
  const actualWaveHeight = actual_conditions.wave_height_ft;
  const actualWindSpeed = actual_conditions.wind_speed_mph;
  const actualWindDirection = actual_conditions.wind_direction;
  const actualTideHeight = actual_conditions.tide_height_ft;
  const actualTideStatus = actual_conditions.tide_status;
  const actualWaterTemp = actual_conditions.water_temp;

  // Check if we have any data to show
  const hasAnyData =
    forecastWaveHeight !== undefined ||
    forecastWindSpeed !== undefined ||
    forecastTideHeight !== undefined ||
    forecastWaterTemp !== undefined ||
    actualWaveHeight !== undefined ||
    actualWindSpeed !== undefined ||
    actualTideHeight !== undefined ||
    actualWaterTemp !== undefined;

  if (!hasAnyData) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Conditions at Time of Session
          </CardTitle>
          <div className="flex items-center gap-2">
            {forecast_confidence_score !== null && (
              <ConfidenceBadge score={forecast_confidence_score} />
            )}
            {data_source && <DataSourceBadge source={data_source} />}
          </div>
        </div>
        {forecast_vs_actual && Object.keys(forecast_vs_actual).length > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            Showing differences between forecast and your reported conditions
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-gray-100">
          {/* Wave Height */}
          <ComparisonRow
            label="Wave Height"
            icon={Waves}
            forecastValue={forecastWaveHeight}
            actualValue={actualWaveHeight}
            diff={forecast_vs_actual?.wave_height_ft}
            unit=" ft"
          />

          {/* Wind Speed */}
          <ComparisonRow
            label="Wind Speed"
            icon={Wind}
            forecastValue={forecastWindSpeed}
            actualValue={actualWindSpeed}
            diff={forecast_vs_actual?.wind_speed_mph}
            unit=" mph"
          />

          {/* Wind Direction */}
          {(forecastWindDirection || actualWindDirection) && (
            <ComparisonRow
              label="Wind Direction"
              icon={Wind}
              forecastValue={forecastWindDirection}
              actualValue={actualWindDirection}
              diff={forecast_vs_actual?.wind_direction}
            />
          )}

          {/* Tide Height */}
          <ComparisonRow
            label="Tide Height"
            icon={TrendingUp}
            forecastValue={forecastTideHeight}
            actualValue={actualTideHeight}
            diff={forecast_vs_actual?.tide_height_ft}
            unit=" ft"
          />

          {/* Tide Status */}
          {(forecastTideStatus || actualTideStatus) && (
            <ComparisonRow
              label="Tide Status"
              icon={TrendingUp}
              forecastValue={forecastTideStatus}
              actualValue={actualTideStatus}
              diff={forecast_vs_actual?.tide_status}
            />
          )}

          {/* Water Temperature */}
          <ComparisonRow
            label="Water Temp"
            icon={Thermometer}
            forecastValue={forecastWaterTemp}
            actualValue={actualWaterTemp}
            diff={forecast_vs_actual?.water_temp}
            unit="°F"
          />
        </div>

        {/* Footer note */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Your condition reports help improve forecast accuracy for this spot
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
