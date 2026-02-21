"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import { formatWaveHeight } from "@/lib/formatters/surf-data";
import type { Beach } from "@/types/database";

export interface SidebarBeachCardProps {
  beach: Beach;
  waveHeight?: number;
  isSelected: boolean;
  distance?: string;
  onSelect: (beach: Beach) => void;
}

/**
 * Returns a Tailwind background class for the condition color bar
 * based on wave height in feet.
 */
function getConditionBarColor(waveHeight?: number): string {
  if (waveHeight == null || waveHeight === 0) return "bg-muted-foreground/40";
  if (waveHeight <= 2) return "bg-green-500";
  if (waveHeight <= 4) return "bg-amber-500";
  if (waveHeight <= 7) return "bg-orange-500";
  return "bg-red-500";
}

/**
 * Formats wave height for compact display.
 * Returns null when no data is available.
 */
function formatCompactWaveHeight(waveHeight?: number): string | null {
  if (waveHeight == null) return null;
  return formatWaveHeight(waveHeight);
}

const SidebarBeachCardComponent = function SidebarBeachCard({
  beach,
  waveHeight,
  isSelected,
  distance,
  onSelect,
}: SidebarBeachCardProps) {
  const locationText = getBeachLocation(beach);
  const waveText = formatCompactWaveHeight(waveHeight);
  const barColor = getConditionBarColor(waveHeight);

  return (
    <button
      type="button"
      onClick={() => onSelect(beach)}
      className={cn(
        "flex w-full items-stretch text-left transition-colors",
        "rounded-md border border-transparent",
        "hover:bg-accent/50 cursor-pointer",
        isSelected && "border-primary/30 bg-primary/5"
      )}
    >
      {/* Condition color bar */}
      <div
        className={cn(
          "w-1 shrink-0 rounded-l-md",
          barColor,
          isSelected && "w-1.5"
        )}
      />

      {/* Content area */}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5">
        {/* Beach info (left) */}
        <div className="min-w-0 flex-1">
          <p
            title={beach.name}
            className={cn(
              "truncate text-sm font-semibold leading-tight",
              isSelected && "text-primary"
            )}
          >
            {beach.name}
          </p>
          <p title={locationText} className="truncate text-xs text-muted-foreground mt-0.5">
            {locationText}
          </p>
        </div>

        {/* Wave height + distance (right) */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {waveText && (
            <span className="text-sm font-semibold tabular-nums leading-tight">
              {waveText}
            </span>
          )}
          {distance && (
            <span className="text-xs text-muted-foreground leading-tight">
              {distance}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

/**
 * Custom comparison function for SidebarBeachCard memoization.
 *
 * Compares by beach ID first, then display-affecting props.
 * The onSelect callback is NOT compared (expected to be stable
 * via parent's useCallback).
 */
const areSidebarBeachCardPropsEqual = (
  prev: SidebarBeachCardProps,
  next: SidebarBeachCardProps
): boolean => {
  // Beach identity
  if (prev.beach.id !== next.beach.id) return false;

  // Display-affecting beach properties
  if (prev.beach.name !== next.beach.name) return false;
  if (prev.beach.city !== next.beach.city) return false;
  if (prev.beach.state !== next.beach.state) return false;
  if (prev.beach.region !== next.beach.region) return false;

  // Display props
  if (prev.waveHeight !== next.waveHeight) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.distance !== next.distance) return false;

  return true;
};

export const SidebarBeachCard = memo(
  SidebarBeachCardComponent,
  areSidebarBeachCardPropsEqual
);
SidebarBeachCard.displayName = "SidebarBeachCard";
