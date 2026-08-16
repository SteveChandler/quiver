"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Waves, Wind, Anchor, TrendingUp, ChevronDown } from "lucide-react";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { degreeWindowToCardinal } from "@/lib/utils/direction-utils";

interface BeachStatsGridProps {
  beach: Beach;
  currentForecast?: EnhancedForecastEntity | null;
  className?: string;
}

function StatsGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-gray-50 p-4 sm:p-5 rounded-xl my-4 sm:my-6 animate-pulse ${className || ""}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-6 w-6 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
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

  const { data: calibration, loading } = useDataFetcher(fetchCalibration, {
    immediate: true,
    initialData: null,
  });

  const [expanded, setExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Show loading skeleton while fetching calibration data
  if (loading) {
    return <StatsGridSkeleton className={className} />;
  }

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
    },
    {
      icon: TrendingUp,
      label: "Best Swell",
      value: bestSwell,
    },
    {
      icon: Wind,
      label: "Best Wind",
      value: bestWind,
    },
    {
      icon: Anchor,
      label: "Preferred Tide",
      value: tidePref,
    },
  ];

  return (
    <div data-testid="beach-stats-grid" data-tier="supporting" className={`bg-gray-50 p-4 sm:p-5 rounded-xl my-4 sm:my-6 ${className || ""}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between md:hidden focus-ring"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-gray-900">Spot Details</span>
        <ChevronDown
          className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`${expanded ? "grid" : "hidden"} md:grid grid-cols-2 md:grid-cols-4 gap-4 ${expanded ? "mt-3 md:mt-0" : ""}`}>
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              className="flex flex-col gap-1"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.3 + i * 0.1 }}
            >
              <Icon className="h-6 w-6 text-ocean-blue mb-1" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {stat.label}
              </span>
              <div className="text-base font-semibold text-gray-900">
                {stat.value}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
