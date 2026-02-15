"use client";

import { useState, useCallback, useEffect } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { SidebarBeachCard } from "@/components/map/sidebar-beach-card";
import { useBeachListState } from "@/hooks/use-beach-list-state";
import type { Beach } from "@/types/database";

const SNAP_POINTS: number[] = [0.1, 0.4, 0.9];
const PEEK_SNAP = SNAP_POINTS[0];

export interface MapBottomSheetProps {
  beaches: Beach[];
  waveHeightMap: Map<string, number | undefined>;
  selectedBeach: Beach | null;
  userLocation: { lat: number; lon: number } | null;
  onBeachSelect: (beach: Beach) => void;
}

/**
 * Mobile bottom sheet showing the beach list.
 *
 * Uses Vaul Drawer with three snap points (peek 10%, half 40%, full 90%).
 * Always visible and non-modal so the map behind it remains interactive.
 */
export function MapBottomSheet({
  beaches,
  waveHeightMap,
  selectedBeach,
  userLocation,
  onBeachSelect,
}: MapBottomSheetProps) {
  const [activeSnapPoint, setActiveSnapPoint] = useState<
    number | string | null
  >(PEEK_SNAP);
  const { setCardRef, distanceMap } = useBeachListState(
    beaches,
    selectedBeach,
    userLocation
  );

  // Auto-snap to peek when a beach is selected externally (e.g. marker tap)
  useEffect(() => {
    if (selectedBeach) {
      setActiveSnapPoint(PEEK_SNAP);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBeach?.id]);

  // When a beach card is tapped, select it and snap back to peek
  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      onBeachSelect(beach);
      setActiveSnapPoint(PEEK_SNAP);
    },
    [onBeachSelect]
  );

  // Only allow scrolling when the drawer is at the largest snap point
  const isExpanded = activeSnapPoint === SNAP_POINTS[2];

  return (
    <DrawerPrimitive.Root
      open={true}
      modal={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      dismissible={false}
      shouldScaleBackground={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-40 flex h-auto flex-col rounded-t-xl border-t bg-background shadow-lg"
          style={{
            // Prevent content from exceeding 90% of viewport
            maxHeight: "90dvh",
          }}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

          {/* Header */}
          <div className="px-4 pb-2 pt-1">
            <DrawerPrimitive.Title className="text-base font-semibold leading-tight">
              Surf Spots
            </DrawerPrimitive.Title>
            <p className="text-xs text-muted-foreground">
              {beaches.length} {beaches.length === 1 ? "spot" : "spots"} in view
            </p>
          </div>

          {/* Scrollable list - only scrollable when fully expanded */}
          <div
            className="flex-1 overflow-y-auto px-2 pb-safe"
            data-vaul-no-drag={isExpanded ? "" : undefined}
            style={{
              overflowY: isExpanded ? "auto" : "hidden",
            }}
          >
            {beaches.length === 0 ? (
              <div className="flex items-center justify-center px-4 py-8">
                <p className="text-sm text-muted-foreground text-center">
                  No beaches in this area. Zoom out or pan to find surf spots.
                </p>
              </div>
            ) : (
              <div className="space-y-1 pb-4">
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
                      onSelect={handleBeachSelect}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
