"use client";

import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WaveHeightDisplayProps {
  height: string | null | undefined;
  showTooltip?: boolean;
  className?: string;
  dataSource?: string | null;
  confidenceScore?: number | null;
}

export function WaveHeightDisplay({
  height,
  showTooltip = true,
  className = "",
  dataSource = null,
  confidenceScore = null,
}: WaveHeightDisplayProps) {
  if (!height) {
    return <span className={className}>--</span>;
  }

  const content = <span className={className}>{height}</span>;

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
            {height}
            <InfoIcon className="w-3 h-3 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="font-medium">Face Height (Calibrated)</div>
            <div>
              This wave height represents the &quot;face height&quot; that
              surfers typically experience, calibrated from scientific
              measurements to match real-world surf conditions.
            </div>

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
