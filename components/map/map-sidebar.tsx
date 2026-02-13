"use client";

import { SidebarBeachCard } from "@/components/map/sidebar-beach-card";
import { useBeachListState } from "@/hooks/use-beach-list-state";
import type { Beach } from "@/types/database";

export interface MapSidebarProps {
  beaches: Beach[];
  waveHeightMap: Map<string, number | undefined>;
  selectedBeach: Beach | null;
  userLocation: { lat: number; lon: number } | null;
  onBeachSelect: (beach: Beach) => void;
}

/**
 * Desktop sidebar showing a scrollable list of beaches visible in the map viewport.
 * Auto-scrolls to the selected beach when it changes (e.g. from a map marker click).
 */
export function MapSidebar({
  beaches,
  waveHeightMap,
  selectedBeach,
  userLocation,
  onBeachSelect,
}: MapSidebarProps) {
  const { setCardRef, distanceMap } = useBeachListState(
    beaches,
    selectedBeach,
    userLocation
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <h2 className="font-semibold text-base">Surf Spots</h2>
        <p className="text-xs text-muted-foreground">
          {beaches.length} {beaches.length === 1 ? "spot" : "spots"} in view
        </p>
      </div>

      {/* Scrollable list or empty state */}
      {beaches.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <p className="text-sm text-muted-foreground text-center">
            No beaches in this area. Zoom out or pan to find surf spots.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {beaches.map((beach) => (
            <div
              key={beach.id}
              ref={(el) => setCardRef(beach.id, el)}
            >
              <SidebarBeachCard
                beach={beach}
                waveHeight={waveHeightMap.get(beach.id) ?? undefined}
                isSelected={selectedBeach?.id === beach.id}
                distance={distanceMap?.get(beach.id)}
                onSelect={onBeachSelect}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
