"use client";

import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WaveHeightDisplayProps {
  height: string | null | undefined;
  showTooltip?: boolean;
  className?: string;
}

export function WaveHeightDisplay({ 
  height, 
  showTooltip = true, 
  className = "" 
}: WaveHeightDisplayProps) {
  if (!height) {
    return <span className={className}>--</span>;
  }

  const content = <span className={className}>{height}</span>;

  if (!showTooltip) {
    return content;
  }

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
          <div className="space-y-1 text-xs">
            <div className="font-medium">Face Height (Calibrated)</div>
            <div>
              This wave height represents the &quot;face height&quot; that surfers typically experience, 
              calibrated from scientific measurements to match real-world surf conditions.
            </div>
            <div className="text-muted-foreground">
              • Uses CDIP buoy data when available (most accurate)
              • Falls back to NOAA WaveWatch III model data
              • Automatically converts to surfable face height
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