"use client";

import { BuoyConditionsSkeleton } from "@/components/skeletons/buoy-conditions-skeleton";
import { BuoyCard } from "@/components/buoy";

interface TideData {
  time: number;
  height: number;
  name: string;
}

interface BuoyConditionsProps {
  conditions?: {
    water_temperature?: number;
    air_temperature?: number;
    wind_speed?: number;
    wind_direction?: number;
    wind_direction_name?: string;
    wind_gust?: number;
    wave_height?: number;
    wave_period?: number;
    pressure?: number;
    tides?: TideData[];
    updated_at?: number;
  };
  loading?: boolean;
  className?: string;
}

export function BuoyConditions({
  conditions,
  loading = false,
  className = "",
}: BuoyConditionsProps) {
  if (loading) {
    return <BuoyConditionsSkeleton />;
  }

  if (!conditions) {
    return null;
  }

  return (
    <BuoyCard
      buoyName="Buoy Conditions"
      conditions={conditions}
      variant="detailed"
      showLocation={false}
      className={className}
    />
  );
}
