"use client";

import { useMemo } from "react";
import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SET_WAVE_VARIANCE } from "@/lib/utils/wave-height-transformer";
import {
  formatWaveHeightRangeString,
  extractNumericWaveHeight,
} from "@/lib/utils/wave-height-formatter";

interface WaveHeightDisplayProps {
  height: string | null | undefined;
  showTooltip?: boolean;
  className?: string;
  dataSource?: string | null;
  confidenceScore?: number | null;
  /** Whether this forecast has ML bias correction applied */
  isMlCalibrated?: boolean;
}

export function WaveHeightDisplay({
  height,
  showTooltip = true,
  className = "",
  dataSource = null,
  confidenceScore = null,
  isMlCalibrated = false,
}: WaveHeightDisplayProps) {
  // Compute wave height range (average to set waves)
  const displayHeight = useMemo(() => {
    if (!height) return null;

    // Extract numeric value using shared utility
    const low = extractNumericWaveHeight(height);
    if (low === null) return height;

    // Calculate high (set waves)
    const high = low * SET_WAVE_VARIANCE;
    const result = formatWaveHeightRangeString(low, high);

    // Debug logging to trace "X-Xft" bug where low and high show identical values
    // This helps identify data issues upstream
    if (process.env.NODE_ENV === 'development') {
      const lowRounded = Math.round(low);
      const highRounded = Math.round(high);
      if (lowRounded === highRounded && low !== high) {
        console.debug('[WaveHeightDisplay] Same rounded values:', {
          input: height,
          low,
          high,
          lowRounded,
          highRounded,
          result,
        });
      }
    }

    return result;
  }, [height]);

  if (!displayHeight) {
    return <span className={className}>--</span>;
  }

  // ML badge component for consistent styling
  const mlBadge = isMlCalibrated ? (
    <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium ml-1">
      ML
    </span>
  ) : null;

  const content = (
    <span className={`${className} flex items-center`}>
      {displayHeight}
      {mlBadge}
    </span>
  );

  if (!showTooltip) {
    return content;
  }

  // Determine data source display info
  const getDataSourceInfo = () => {
    if (!dataSource) {
      return {
        label: "Mixed Sources",
        description: "Combining multiple forecast models",
        quality: "standard",
      };
    }

    const source = dataSource.toUpperCase();

    if (source.includes("CDIP")) {
      return {
        label: "CDIP Buoy",
        description: "Real-time buoy measurements (most accurate)",
        quality: "excellent",
      };
    } else if (source.includes("NOAA")) {
      return {
        label: "NOAA Model",
        description: "WaveWatch III forecast model",
        quality: "good",
      };
    } else if (source.includes("FALLBACK")) {
      return {
        label: "Regional Data",
        description: "Using nearby location data",
        quality: "approximate",
      };
    }

    return {
      label: dataSource,
      description: "Forecast data",
      quality: "standard",
    };
  };

  const sourceInfo = getDataSourceInfo();
  const qualityColor = {
    excellent: "text-green-600",
    good: "text-blue-600",
    standard: "text-gray-600",
    approximate: "text-yellow-600",
  }[sourceInfo.quality];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`${className} cursor-help flex items-center gap-1`}>
            {displayHeight}
            {mlBadge}
            <InfoIcon className="w-3 h-3 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="font-medium">
              Wave Height Range {isMlCalibrated ? "(ML-Calibrated)" : "(Calibrated)"}
            </div>
            <div>
              {isMlCalibrated ? (
                <>
                  The lower number is the average wave face height, refined by
                  our ML model. The higher number represents set waves (larger
                  waves that come in groups).
                </>
              ) : (
                <>
                  The lower number is the average wave face height. The higher
                  number represents set waves - the bigger waves that come
                  through periodically (typically 50% larger than average).
                </>
              )}
            </div>

            {isMlCalibrated && (
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium">
                    ML
                  </span>
                  <span className="font-medium">ML Bias Correction</span>
                </div>
                <div className="text-muted-foreground mt-1">
                  Adjusts raw forecast based on historical accuracy at this beach
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-gray-200">
              <div className="font-medium mb-1">Data Source</div>
              <div className={`flex items-center gap-1 ${qualityColor}`}>
                <span className="font-semibold">{sourceInfo.label}</span>
              </div>
              <div className="text-muted-foreground mt-1">
                {sourceInfo.description}
              </div>
            </div>

            {confidenceScore !== null && (
              <div className="pt-2 border-t border-gray-200">
                <div className="font-medium mb-1">Confidence Score</div>
                <div className="text-muted-foreground">
                  {Math.round(confidenceScore)}% - Based on data quality and
                  model reliability
                </div>
              </div>
            )}

            <div className="text-muted-foreground pt-2 border-t border-gray-200">
              <div className="font-medium mb-1">Data Priority</div>
              <div className="space-y-0.5">
                <div>1. CDIP buoy data (real-time)</div>
                <div>2. NOAA WaveWatch III (forecast)</div>
                <div>3. Regional fallback data</div>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Utility hook for consistent wave height formatting
export function useWaveHeightDisplay() {
  const formatWaveHeight = (height: string | null | undefined) => {
    if (!height) return "--";

    // Ensure the height includes "ft" suffix if not already present
    if (typeof height === "string" && !height.includes("ft")) {
      const num = parseFloat(height);
      if (!isNaN(num)) {
        return `${num} ft`;
      }
    }

    return height;
  };

  return { formatWaveHeight };
}
