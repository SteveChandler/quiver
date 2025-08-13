"use client";

import { cn } from "@/lib/utils";
import { Waves, Timer, Navigation, Activity } from "lucide-react";

interface WavePeriodDisplayProps {
  waveHeight: string | null;
  wavePeriod: string | null;
  waveDirection: string | null;
  className?: string;
  variant?: "compact" | "detailed";
  showDirection?: boolean;
}

interface SwellComponentProps {
  swellHeight: string | null;
  swellPeriod: string | null;
  swellDirection: string | null;
  swellType: "primary" | "secondary" | "wind";
  className?: string;
}

export function WavePeriodDisplay({
  waveHeight,
  wavePeriod,
  waveDirection,
  className,
  variant = "compact",
  showDirection = true,
}: WavePeriodDisplayProps) {
  const formatPeriod = (period: string | null) => {
    if (!period) return "N/A";

    // If it already has 's', return as-is
    if (period.includes("s")) return period;

    // Try to parse as number and add seconds
    const num = parseFloat(period);
    if (!isNaN(num)) {
      return `${num}s`;
    }

    return period;
  };

  const roundToOneDecimal = (value: string | null): string | null => {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `${Math.round(num * 10) / 10}`;
  };

  const getPeriodQuality = (period: string | null) => {
    if (!period) return { quality: "unknown", color: "text-gray-500" };

    const num = parseFloat(roundToOneDecimal(period) || "");
    if (isNaN(num)) return { quality: "unknown", color: "text-gray-500" };

    if (num >= 12) return { quality: "excellent", color: "text-green-600" };
    if (num >= 10) return { quality: "good", color: "text-blue-600" };
    if (num >= 8) return { quality: "fair", color: "text-yellow-600" };
    if (num >= 6) return { quality: "choppy", color: "text-orange-600" };
    return { quality: "poor", color: "text-red-600" };
  };

  const periodQuality = getPeriodQuality(wavePeriod);

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-1">
          <Waves className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">{waveHeight || "N/A"}</span>
        </div>

        <div className="flex items-center gap-1">
          <Timer className={cn("h-4 w-4", periodQuality.color)} />
          <span className={cn("text-sm font-medium", periodQuality.color)}>
            {formatPeriod(roundToOneDecimal(wavePeriod))}
          </span>
        </div>

        {showDirection && waveDirection && (
          <div className="flex items-center gap-1">
            <Navigation className="h-4 w-4 text-gray-600" />
            <span className="text-sm">{waveDirection}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Waves className="h-5 w-5 text-blue-600" />
        <span className="font-medium">Wave Conditions</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-lg font-bold text-blue-600">
            {waveHeight || "N/A"}
          </div>
          <div className="text-sm text-muted-foreground">Height</div>
        </div>

        <div
          className={cn(
            "flex flex-col items-center p-3 rounded-lg border",
            periodQuality.color === "text-green-600"
              ? "bg-green-50 border-green-200"
              : periodQuality.color.includes("text-blue-600")
              ? "bg-blue-50 border-blue-200"
              : periodQuality.color === "text-yellow-600"
              ? "bg-yellow-50 border-yellow-200"
              : periodQuality.color === "text-orange-600"
              ? "bg-orange-50 border-orange-200"
              : periodQuality.color === "text-red-600"
              ? "bg-red-50 border-red-200"
              : "bg-gray-50 border-gray-200"
          )}
        >
          <div className={cn("text-lg font-bold", periodQuality.color)}>
            {formatPeriod(roundToOneDecimal(wavePeriod))}
          </div>
          <div className="text-sm text-muted-foreground">Period</div>
        </div>
      </div>

      {showDirection && waveDirection && (
        <div className="flex items-center justify-center gap-2 p-2 bg-gray-50 rounded-lg">
          <Navigation className="h-4 w-4 text-gray-600" />
          <span className="text-sm">Direction: {waveDirection}</span>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {periodQuality.quality !== "unknown" && (
          <>
            Wave quality:{" "}
            <span className={cn("font-medium", periodQuality.color)}>
              {periodQuality.quality}
            </span>
            {periodQuality.quality === "excellent" &&
              " (long period, clean waves)"}
            {periodQuality.quality === "good" && " (well-formed waves)"}
            {periodQuality.quality === "fair" && " (moderate conditions)"}
            {periodQuality.quality === "choppy" && " (short period, bumpy)"}
            {periodQuality.quality === "poor" && " (very choppy conditions)"}
          </>
        )}
      </div>
    </div>
  );
}

export function SwellComponent({
  swellHeight,
  swellPeriod,
  swellDirection,
  swellType,
  className,
}: SwellComponentProps) {
  const getSwellTypeInfo = (type: typeof swellType) => {
    switch (type) {
      case "primary":
        return {
          label: "Primary Swell",
          icon: Activity,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        };
      case "secondary":
        return {
          label: "Secondary Swell",
          icon: Waves,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      case "wind":
        return {
          label: "Wind Waves",
          icon: Timer,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
        };
    }
  };

  const swellInfo = getSwellTypeInfo(swellType);
  const Icon = swellInfo.icon;

  if (!swellHeight && !swellPeriod) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        swellInfo.bgColor,
        swellInfo.borderColor,
        className
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border">
        <Icon className={cn("h-4 w-4", swellInfo.color)} />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">
            {swellInfo.label}
          </span>
          {swellHeight && (
            <span className={cn("text-sm font-bold", swellInfo.color)}>
              {swellHeight}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {swellPeriod && <span>Period: {swellPeriod}</span>}
          {swellDirection && <span>Direction: {swellDirection}</span>}
        </div>
      </div>
    </div>
  );
}

export function WaveBreakdown({
  waveHeight,
  wavePeriod,
  waveDirection,
  swell1Height,
  swell1Period,
  swell1Direction,
  swell2Height,
  swell2Period,
  swell2Direction,
  windWaveHeight,
  windWavePeriod,
  windWaveDirection,
  className,
}: {
  waveHeight: string | null;
  wavePeriod: string | null;
  waveDirection: string | null;
  swell1Height: string | null;
  swell1Period: string | null;
  swell1Direction: string | null;
  swell2Height: string | null;
  swell2Period: string | null;
  swell2Direction: string | null;
  windWaveHeight: string | null;
  windWavePeriod: string | null;
  windWaveDirection: string | null;
  className?: string;
}) {
  const hasSwellData = swell1Height || swell2Height || windWaveHeight;

  return (
    <div className={cn("space-y-3", className)}>
      <WavePeriodDisplay
        waveHeight={waveHeight}
        wavePeriod={wavePeriod}
        waveDirection={waveDirection}
        variant="detailed"
      />

      {hasSwellData && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Swell Components
          </div>

          <SwellComponent
            swellHeight={swell1Height}
            swellPeriod={swell1Period}
            swellDirection={swell1Direction}
            swellType="primary"
          />

          <SwellComponent
            swellHeight={swell2Height}
            swellPeriod={swell2Period}
            swellDirection={swell2Direction}
            swellType="secondary"
          />

          <SwellComponent
            swellHeight={windWaveHeight}
            swellPeriod={windWavePeriod}
            swellDirection={windWaveDirection}
            swellType="wind"
          />
        </div>
      )}
    </div>
  );
}
