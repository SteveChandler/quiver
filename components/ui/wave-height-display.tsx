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
} from "@/lib/utils/wave-formatters";

/**
 * Tooltip microcopy for the uncalibrated (honesty layer) state.
 * Marketer's final pick — do not paraphrase. See
 * `docs/marketing/calibration-launch-copy.md`.
 */
export const UNCALIBRATED_TOOLTIP_COPY =
  "Buoy forecast. Haven't surfed this one enough to call face height.";

interface WaveHeightDisplayProps {
  height: string | null | undefined;
  showTooltip?: boolean;
  className?: string;
  dataSource?: string | null;
  confidenceScore?: number | null;
  /** Whether this forecast has ML bias correction applied */
  isMlCalibrated?: boolean;
  /**
   * **Beach-level** calibration flag. `true` means this beach has an
   * empirical shoaling calibration as a population (`beaches.shoaling_factors
   * IS NOT NULL`) — the honesty layer renders the calibrated state with a
   * "Face height" label. `false` means the beach is ML-only / forecast-only
   * — the honesty layer applies `~` prefix, dotted underline, the
   * "Forecast height" label, and a single-line tooltip. `undefined` =
   * backward-compat: render as today, do not apply the honesty layer and
   * do not render any label.
   *
   * This is a population-level signal, not a per-reading claim. A
   * calibrated beach can still ship a specific reading whose number came
   * from the generic pipeline (period outside the bucket table, CDIP
   * fallback). That's an acceptable trade-off — see
   * `types/forecast.ts::EnhancedForecastEntity.isCalibrated` and
   * `lib/utils/wave-height-transformer.ts::transformToFaceHeightWithMetadata`
   * for the full semantic.
   */
  isCalibrated?: boolean;
}

export function WaveHeightDisplay({
  height,
  showTooltip = true,
  className = "",
  dataSource = null,
  confidenceScore = null,
  isMlCalibrated = false,
  isCalibrated,
}: WaveHeightDisplayProps) {
  // Compute wave height range (average to set waves)
  const displayHeight = useMemo(() => {
    if (!height) return null;

    // If height is already a range string (e.g., "1-2ft", "3-4 ft"), pass through unchanged
    if (/\d+(?:\.\d+)?-\d+(?:\.\d+)?\s*ft/i.test(height)) return height;

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

  // Auto-rendered micro-label below the number. Only appears when the caller
  // has opted into the honesty layer by passing `isCalibrated` explicitly —
  // when undefined, we preserve the pre-honesty-layer render exactly.
  //
  // Screen readers pick up this label as the primary semantic signal for the
  // calibrated/uncalibrated distinction (the `~` prefix is aria-hidden and
  // the dotted underline is a CSS border that ATs ignore). See
  // docs/design/calibration-honesty-spec.md §9.
  const honestyLabel =
    isCalibrated === undefined
      ? null
      : (
          <span
            className="text-[11px] leading-tight text-muted-foreground/80"
            data-testid="wave-height-label"
          >
            {isCalibrated ? "Face height" : "Forecast height"}
          </span>
        );

  // Wraps a number-row node with a column-stacked label when the honesty
  // layer is active. When `honestyLabel` is null (isCalibrated === undefined)
  // the number row is returned untouched — backward-compat lock-in.
  const withLabel = (numberRow: React.ReactNode) => {
    if (!honestyLabel) return numberRow;
    return (
      <span className="inline-flex flex-col items-start">
        {numberRow}
        {honestyLabel}
      </span>
    );
  };

  // -----------------------------------------------------------------
  // Honesty layer (State B): uncalibrated beaches get a ~ prefix,
  // dotted underline on the digits, and a single-line tooltip.
  // Spec: docs/design/calibration-honesty-spec.md §4.
  // -----------------------------------------------------------------
  if (isCalibrated === false) {
    const uncalibratedContent = (
      <span
        className={`${className} inline-flex items-baseline gap-[0.5em]`}
        data-testid="primary-wave-height"
      >
        <span aria-hidden="true" className="text-current">
          ~
        </span>
        <span className="border-b border-dotted border-muted-foreground/60">
          {displayHeight}
        </span>
        {mlBadge}
      </span>
    );

    if (!showTooltip) {
      return withLabel(uncalibratedContent);
    }

    return withLabel(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{uncalibratedContent}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{UNCALIBRATED_TOOLTIP_COPY}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const content = (
    <span
      className={`${className} flex items-center`}
      data-testid="primary-wave-height"
    >
      {displayHeight}
      {mlBadge}
    </span>
  );

  if (!showTooltip) {
    return withLabel(content);
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

  return withLabel(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`${className} cursor-help flex items-center gap-1`}
            data-testid="primary-wave-height"
          >
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
