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
import { HeroMatchCardSkeleton } from "@/components/skeletons/hero-match-card-skeleton";

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

  return chips.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
      className={`inline-flex items-center gap-1 bg-[#171E45]/60 text-white/80 text-xs px-2 py-1 rounded-full border ${borderClass}`}
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

  const fetchDemoData = useCallback(async (): Promise<DemoData | null> => {
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
      return null;
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
    return <HeroMatchCardSkeleton />;
  }

  const demo = data ?? null;

  const locationLine = demo
    ? [demo.city, demo.state].filter(Boolean).join(", ")
    : "";

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
      <div className="relative bg-[#1E2558]/80 backdrop-blur-md border-hud rounded-xl p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          {/* Beach info */}
          <div className="flex-1 min-w-0">
            <p className="font-mono uppercase tracking-[0.08em] text-white/60 text-xs mb-1">
              {demo ? "Best match now" : "Live surf conditions"}
            </p>
            <h3 className="font-mono uppercase tracking-[0.08em] text-white text-sm font-semibold leading-tight truncate">
              {demo?.beachName ?? "Check the latest forecast"}
            </h3>
            {demo && locationLine ? (
              <p className="text-white/60 text-xs mt-0.5">{locationLine}</p>
            ) : !demo ? (
              <p className="text-white/60 text-xs mt-1">
                Wave, wind, and tide can change quickly.
              </p>
            ) : null}
          </div>

          {/* Score ring */}
          {demo ? (
            <div className="shrink-0">
              <MatchScoreRing score={demo.score} size={96} animated />
            </div>
          ) : null}
        </div>

        {/* Condition chips */}
        {demo && demo.conditions.length > 0 && (
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
