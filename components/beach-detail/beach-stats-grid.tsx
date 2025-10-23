"use client";

import { useCallback } from "react";
import { Waves, Wind, Anchor, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";

interface BeachStatsGridProps {
  beach: Beach;
  currentForecast?: EnhancedForecastEntity | null;
  className?: string;
}

export function BeachStatsGrid({
  beach,
  currentForecast,
  className,
}: BeachStatsGridProps) {
  // Fetch latest calibration for best swell/wind data
  const fetchCalibration = useCallback(async () => {
    const { getLatestBeachCalibrationAction } = await import(
      "@/actions/beach-calibration-actions"
    );
    const result = await getLatestBeachCalibrationAction(beach.id);
    if (!result.success) return null;
    return result.data as {
      best_swell_dir_deg_min: number | null;
      best_swell_dir_deg_max: number | null;
      best_wind_offshore_deg: number | null;
      best_wind_tol_deg: number | null;
    } | null;
  }, [beach.id]);

  const { data: calibration } = useDataFetcher(fetchCalibration, {
    immediate: true,
    initialData: null,
  });

  // Calculate best swell direction
  const calibratedSwellCardinal = calibration
    ? degreeWindowToCardinal(
        calibration.best_swell_dir_deg_min,
        calibration.best_swell_dir_deg_max
      )
    : null;

  const bestSwell =
    calibratedSwellCardinal ||
    degreeWindowToCardinal(
      beach.swell_window_min_deg ?? null,
      beach.swell_window_max_deg ?? null
    ) ||
    "—";

  // Calculate best wind direction
  const calibratedWindCardinal = calibration
    ? degreeWindowToCardinal(
        calibration.best_wind_offshore_deg != null &&
          calibration.best_wind_tol_deg != null
          ? calibration.best_wind_offshore_deg -
              calibration.best_wind_tol_deg
          : null,
        calibration.best_wind_offshore_deg != null &&
          calibration.best_wind_tol_deg != null
          ? calibration.best_wind_offshore_deg +
              calibration.best_wind_tol_deg
          : null
      )
    : null;

  const beachWindCardinal = degreeWindowToCardinal(
    beach.wind_offshore_deg != null && beach.wind_offshore_tol_deg != null
      ? beach.wind_offshore_deg - beach.wind_offshore_tol_deg
      : null,
    beach.wind_offshore_deg != null && beach.wind_offshore_tol_deg != null
      ? beach.wind_offshore_deg + beach.wind_offshore_tol_deg
      : null
  );

  const bestWind =
    calibratedWindCardinal ||
    beachWindCardinal ||
    "—";

  // Calculate tide preference
  const tidePref = (() => {
    const min = beach.preferred_tide_ft_min;
    const max = beach.preferred_tide_ft_max;
    if (min == null && max == null) return "—";
    if (min != null && max != null) return `${min}–${max} ft`;
    if (min != null) return `${min}+ ft`;
    return `${max} ft or lower`;
  })();

  const stats = [
    {
      icon: Waves,
      label: "Break Type",
      value: beach.break_type || "Beach Break",
      iconColor: "text-ocean-blue",
    },
    {
      icon: TrendingUp,
      label: "Best Swell",
      value: bestSwell,
      iconColor: "text-blue-600",
    },
    {
      icon: Wind,
      label: "Best Wind",
      value: bestWind,
      iconColor: "text-blue-500",
    },
    {
      icon: Anchor,
      label: "Preferred Tide",
      value: tidePref,
      iconColor: "text-blue-700",
    },
  ];

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 ${className || ""}`}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border-muted-foreground/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
