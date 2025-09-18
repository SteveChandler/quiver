"use client";

import { useMemo } from "react";
import { Sun, Wind, Waves, Droplet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  data: {
    marine: Array<{
      ts: string;
      wave_height_m: number | null;
      wave_period_s: number | null;
      wave_direction_deg: number | null;
      wind_speed_ms: number | null;
      wind_direction_deg: number | null;
      source: string;
      is_observed: boolean;
    }>;
    tides: Array<{
      ts: string;
      tide_height_m: number | null;
      tide_phase: string | null;
      source: string;
    }>;
    sun: Array<{
      date: string;
      sunrise_utc: string | null;
      sunset_utc: string | null;
      source: string;
    }>;
  } | null;
  className?: string;
};

function mToFt(m?: number | null) {
  if (m == null) return null;
  return Math.round(m * 3.281 * 10) / 10;
}

export function SpotConditionsSummary({ data, className }: Props) {
  const latest = useMemo(() => {
    if (!data?.marine?.length) return null;
    return data.marine[0];
  }, [data]);

  const nextTide = useMemo(() => {
    if (!data?.tides?.length) return null;
    return data.tides[0];
  }, [data]);

  const todaySun = useMemo(() => {
    if (!data?.sun?.length) return null;
    return data.sun[0];
  }, [data]);

  const sourceLabel = useMemo(() => {
    // Prefer marine source if present
    if (latest) {
      if (latest.is_observed) return "Buoy"; // NDBC/CDIP observed
      if (latest.source === "noaa") return "NOAA";
      if (latest.source === "open-meteo") return "Open‑Meteo";
      if (latest.source) return latest.source.toUpperCase();
    }
    // Fall back to tides/sun if marine missing
    if (data.tides?.length) return "NOAA";
    return "–";
  }, [latest, data]);

  if (!data) return null;

  return (
    <Card className={cn("p-3 sm:p-4", className)}>
      <div className="flex flex-wrap gap-4 items-center text-sm">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4" />
          <span>
            {mToFt(latest?.wave_height_m) != null
              ? `${mToFt(latest?.wave_height_m)} ft` +
                (latest?.wave_period_s != null
                  ? ` @ ${Math.round(latest.wave_period_s)}s`
                  : "")
              : "–"}
            {latest?.wave_direction_deg != null
              ? ` • ${Math.round(latest.wave_direction_deg)}°`
              : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4" />
          <span>
            {latest?.wind_speed_ms != null
              ? `${Math.round((latest.wind_speed_ms || 0) * 2.237)} mph`
              : "–"}
            {latest?.wind_direction_deg != null
              ? ` • ${Math.round(latest.wind_direction_deg)}°`
              : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4" />
          <span>
            {nextTide?.tide_height_m != null
              ? `${mToFt(nextTide.tide_height_m)} ft`
              : "–"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4" />
          <span>
            {todaySun?.sunrise_local ??
              (todaySun?.sunrise_utc
                ? new Date(todaySun.sunrise_utc).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "–")}
            {" / "}
            {todaySun?.sunset_local ??
              (todaySun?.sunset_utc
                ? new Date(todaySun.sunset_utc).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "–")}
          </span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          Source: {sourceLabel}
        </div>
      </div>
    </Card>
  );
}
