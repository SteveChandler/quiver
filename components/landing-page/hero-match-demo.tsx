"use client";

import { useCallback, useEffect, useRef } from "react";
import { Wind, Waves, Droplets } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getTopBeachesNow } from "@/actions/forecast/get-top-beaches-now";
import { useLocationSafe } from "@/context/location-context";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import { forecastToConditionsData } from "@/lib/mappers/conditions-mappers";
import { MatchScoreRing } from "./match-score-ring";

// ---------------------------------------------------------------------------
// Static fallback (used when live fetches fail)
// ---------------------------------------------------------------------------

const FALLBACK = {
  beachName: "Blacks Beach",
  city: "San Diego",
  state: "CA",
  score: 87,
  conditions: ["Offshore Wind", "Chest-high", "Rising Tide"],
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoData {
  beachName: string;
  city: string | null;
  state: string | null;
  score: number;
  conditions: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConditionChips(
  waveHeight: number | null | undefined,
  windDirection: string | null | undefined,
  tideStatus: string | null | undefined
): string[] {
  const chips: string[] = [];

  if (windDirection) {
    const lower = windDirection.toLowerCase();
    if (lower.includes("offshore") || lower.includes("off")) {
      chips.push("Offshore Wind");
    } else if (lower.includes("onshore") || lower.includes("on")) {
      chips.push("Onshore Wind");
    } else {
      chips.push(`${windDirection} Wind`);
    }
  }

  if (typeof waveHeight === "number" && waveHeight > 0) {
    if (waveHeight <= 2) chips.push("Knee-high");
    else if (waveHeight <= 3) chips.push("Waist-high");
    else if (waveHeight <= 4) chips.push("Chest-high");
    else if (waveHeight <= 5) chips.push("Head-high");
    else chips.push("Overhead+");
  }

  if (tideStatus) {
    const lower = tideStatus.toLowerCase();
    if (lower.includes("rising")) chips.push("Rising Tide");
    else if (lower.includes("falling") || lower.includes("dropping")) chips.push("Falling Tide");
    else if (lower.includes("high")) chips.push("High Tide");
    else if (lower.includes("low")) chips.push("Low Tide");
    else chips.push(tideStatus);
  }

  return chips.length > 0 ? chips.slice(0, 3) : FALLBACK.conditions.slice();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="relative w-full max-w-sm bg-bg-surface/80 backdrop-blur-md border-hud rounded-xl p-5 overflow-hidden">
      <div className="animate-pulse space-y-3">
        <div className="h-3 bg-white/10 rounded w-24" />
        <div className="h-4 bg-white/15 rounded w-40" />
        <div className="flex items-center justify-between mt-4">
          <div className="space-y-2 flex-1 mr-4">
            <div className="h-3 bg-white/10 rounded w-32" />
            <div className="h-3 bg-white/10 rounded w-28" />
          </div>
          <div className="h-24 w-24 rounded-full bg-white/10" />
        </div>
        <div className="flex gap-2 mt-3">
          <div className="h-6 w-20 rounded-full bg-white/10" />
          <div className="h-6 w-16 rounded-full bg-white/10" />
          <div className="h-6 w-18 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}

interface ConditionChipProps {
  label: string;
  index: number;
}

const CHIP_BORDER_CLASSES = [
  "border-neon-cyan/30",
  "border-neon-orange/30",
  "border-neon-magenta/30",
] as const;

const CHIP_ICONS = [Wind, Waves, Droplets] as const;

function ConditionChip({ label, index }: ConditionChipProps) {
  const borderClass = CHIP_BORDER_CLASSES[index % CHIP_BORDER_CLASSES.length];
  const Icon = CHIP_ICONS[index % CHIP_ICONS.length];

  return (
    <span
      className={`inline-flex items-center gap-1 bg-bg-deep/60 text-white/80 text-xs px-2 py-1 rounded-full border ${borderClass}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HeroMatchDemo() {
  const locationCtx = useLocationSafe();
  const coordinates = locationCtx?.location?.coordinates ?? null;

  // Serialize to stable string for dependency tracking
  const coordsKey = coordinates
    ? `${coordinates.lat.toFixed(2)},${coordinates.lon.toFixed(2)}`
    : "";

  const fetchDemoData = useCallback(async (): Promise<DemoData> => {
    // Parse coords from stable key
    let lat: number | undefined;
    let lon: number | undefined;
    if (coordsKey) {
      const [latStr, lonStr] = coordsKey.split(",");
      lat = parseFloat(latStr);
      lon = parseFloat(lonStr);
    }

    // Step 1: get the top beach right now (filtered to user's region if coords available)
    const topBeaches = await getTopBeachesNow(1, lat, lon);
    const topBeach = topBeaches[0];

    if (!topBeach) {
      return {
        beachName: FALLBACK.beachName,
        city: FALLBACK.city,
        state: FALLBACK.state,
        score: FALLBACK.score,
        conditions: FALLBACK.conditions.slice(),
      };
    }

    // Step 2: get forecast details for condition chips
    try {
      const forecastResult = await getEnhancedBeachForecasts(topBeach.beachId, 2);
      if (forecastResult.success && forecastResult.data && forecastResult.data.length > 0) {
        const current = getCurrentForecast(forecastResult.data);
        if (current) {
          const conditionsData = forecastToConditionsData(current);
          const conditions = buildConditionChips(
            topBeach.waveHeight,
            conditionsData.windDirection,
            conditionsData.tideStatus
          );
          return {
            beachName: topBeach.beachName,
            city: topBeach.city,
            state: topBeach.state,
            score: topBeach.score,
            conditions,
          };
        }
      }
    } catch {
      // Fall through to wave-height-only chips
    }

    // Partial success: top beach found but forecast failed
    return {
      beachName: topBeach.beachName,
      city: topBeach.city,
      state: topBeach.state,
      score: topBeach.score,
      conditions: buildConditionChips(topBeach.waveHeight, null, null),
    };
  }, [coordsKey]);

  const { data, loading, refetch } = useDataFetcher(fetchDemoData);

  // Re-fetch when coordinates resolve (useDataFetcher only fires on mount)
  const initialCoordsRef = useRef(coordsKey);
  useEffect(() => {
    if (coordsKey && coordsKey !== initialCoordsRef.current) {
      initialCoordsRef.current = coordsKey;
      refetch();
    }
  }, [coordsKey, refetch]);

  if (loading) {
    return <CardSkeleton />;
  }

  const demo: DemoData = data ?? {
    beachName: FALLBACK.beachName,
    city: FALLBACK.city,
    state: FALLBACK.state,
    score: FALLBACK.score,
    conditions: FALLBACK.conditions.slice(),
  };

  const locationLine = [demo.city, demo.state].filter(Boolean).join(", ");

  return (
    <div className="relative w-full max-w-sm">
      {/* Ambient orb behind card */}
      <div
        className="ambient-orb-cyan"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 300,
          height: 300,
        }}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative bg-bg-surface/80 backdrop-blur-md border-hud rounded-xl p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          {/* Beach info */}
          <div className="flex-1 min-w-0">
            <p className="font-mono uppercase tracking-[0.08em] text-white/60 text-xs mb-1">
              Best match now
            </p>
            <h3 className="font-mono uppercase tracking-[0.08em] text-white text-sm font-semibold leading-tight truncate">
              {demo.beachName}
            </h3>
            {locationLine && (
              <p className="text-white/60 text-xs mt-0.5">{locationLine}</p>
            )}
          </div>

          {/* Score ring */}
          <div className="shrink-0">
            <MatchScoreRing score={demo.score} size={96} animated />
          </div>
        </div>

        {/* Condition chips */}
        {demo.conditions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {demo.conditions.map((label, i) => (
              <ConditionChip key={label} label={label} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
