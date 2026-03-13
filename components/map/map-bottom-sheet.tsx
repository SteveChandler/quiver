"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SidebarBeachCard } from "@/components/map/sidebar-beach-card";
import { SelectedBeachCard } from "@/components/map/selected-beach-card";
import { MapSignupPrompt } from "@/components/map/map-signup-prompt";
import { useBeachListState } from "@/hooks/use-beach-list-state";
import { useBottomSheetGesture } from "@/hooks/use-bottom-sheet-gesture";
import type { Beach } from "@/types/database";

const SNAP_POINTS: number[] = [0.1, 0.4, 0.9];
const PEEK_INDEX = 0;
const DETAIL_INDEX = 1;

export interface MapBottomSheetProps {
  beaches: Beach[];
  waveHeightMap: Map<string, number | undefined>;
  selectedBeach: Beach | null;
  userLocation: { lat: number; lon: number } | null;
  onBeachSelect: (beach: Beach) => void;
  getDistanceFromUser: (beachLat: number, beachLng: number) => string;
  onDeselectBeach: () => void;
  onDismissAttempt?: () => void;
}

/**
 * Mobile bottom sheet showing the beach list.
 *
 * Custom touch-based implementation with three snap points (peek 10%, detail 40%, full 90%).
 * Uses direct touch events instead of Vaul for Android WebView compatibility.
 * Always visible and non-modal so the map behind it remains interactive.
 */
export function MapBottomSheet({
  beaches,
  waveHeightMap,
  selectedBeach,
  userLocation,
  onBeachSelect,
  getDistanceFromUser,
  onDeselectBeach,
  onDismissAttempt,
}: MapBottomSheetProps) {
  const [activeSnapIndex, setActiveSnapIndex] = useState(PEEK_INDEX);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const onSnapChange = useCallback(
    (index: number) => {
      if (index < PEEK_INDEX) {
        // Tried to drag below peek — snap back and notify
        setActiveSnapIndex(PEEK_INDEX);
        onDismissAttempt?.();
      } else {
        setActiveSnapIndex(index);
      }
    },
    [onDismissAttempt]
  );

  const { sheetRef } = useBottomSheetGesture({
    snapPoints: SNAP_POINTS,
    activeSnapIndex,
    onSnapChange,
    handleRef,
  });

  const { setCardRef, distanceMap } = useBeachListState(
    beaches,
    selectedBeach,
    userLocation
  );

  // Snap to detail (40%) when a beach is selected, peek (10%) when deselected
  useEffect(() => {
    if (selectedBeach) {
      setActiveSnapIndex(DETAIL_INDEX);
    } else {
      setActiveSnapIndex(PEEK_INDEX);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBeach?.id]);

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      onBeachSelect(beach);
    },
    [onBeachSelect]
  );

  // Allow scrolling at detail (40%) and full (90%) snap points
  const isScrollable = activeSnapIndex >= DETAIL_INDEX;

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[90vh] flex-col rounded-t-xl border-t bg-background shadow-lg"
      style={{
        willChange: "transform",
        contain: "layout style paint",
      }}
      data-testid="bottom-sheet"
    >
      {/* Drag handle area — entire header is the drag target for easier touch */}
      <div
        ref={handleRef}
        data-testid="drawer-handle-area"
        className="flex flex-col items-center py-4 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
      >
        {/* Handle bar */}
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Header */}
      <div className="px-4 pb-2 pt-1">
        <h2 className="text-base font-semibold leading-tight">
          {selectedBeach ? selectedBeach.name : "Surf Spots"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {selectedBeach
            ? "Tap card to view details"
            : `${beaches.length} ${beaches.length === 1 ? "spot" : "spots"} in view`}
        </p>
      </div>

      {/* Selected beach detail card */}
      {selectedBeach && (
        <div className="border-b overflow-hidden px-4 py-3">
          <SelectedBeachCard
            selectedBeach={selectedBeach}
            getDistanceFromUser={getDistanceFromUser}
            userLocation={userLocation}
            onClose={onDeselectBeach}
          />
        </div>
      )}

      {/* Scrollable list */}
      <div
        className="flex-1 overflow-y-auto px-2 pb-safe"
        data-testid="drawer-scroll-container"
        style={{
          overflowY: isScrollable ? "auto" : "hidden",
          overscrollBehavior: "none",
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
            {/* Signup prompt for anonymous users — appears after first 2 beaches on mobile */}
            {beaches.slice(0, 2).map((beach) => (
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

            <MapSignupPrompt
              beachName={selectedBeach?.name}
              source="map-bottom-sheet"
            />

            {beaches.slice(2).map((beach) => (
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
    </div>
  );
}
