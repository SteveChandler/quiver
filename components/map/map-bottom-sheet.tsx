"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { SidebarBeachCard } from "@/components/map/sidebar-beach-card";
import { calculateDistanceFormatted } from "@/lib/utils/distance-utils";
import type { Coordinates } from "@/lib/types/coordinates";
import type { Beach } from "@/types/database";

const SNAP_POINTS = [0.1, 0.4, 0.9] as const;
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
    (typeof SNAP_POINTS)[number]
  >(PEEK_SNAP);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll to selected beach card when in expanded states
  useEffect(() => {
    if (!selectedBeach) return;
    const el = cardRefsMap.current.get(selectedBeach.id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedBeach?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCardRef = useCallback(
    (beachId: string, el: HTMLDivElement | null) => {
      if (el) {
        cardRefsMap.current.set(beachId, el);
      } else {
        cardRefsMap.current.delete(beachId);
      }
    },
    []
  );

  // Pre-compute distances (same pattern as MapSidebar)
  const distanceMap = useMemo(() => {
    if (!userLocation) return null;
    const from: Coordinates = { lat: userLocation.lat, lon: userLocation.lon };
    const map = new Map<string, string>();
    for (const beach of beaches) {
      if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) {
        const to: Coordinates = { lat: beach.lat, lon: beach.lon };
        map.set(beach.id, calculateDistanceFormatted(from, to, "miles"));
      }
    }
    return map;
  }, [userLocation, beaches]);

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
      snapPoints={SNAP_POINTS as unknown as number[]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint as (snap: string | number | null) => void}
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
