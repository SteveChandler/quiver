"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { MapFirstPaintShell } from "./map-first-paint-shell";
import { LayerLegend, usePersistedLayerState } from "@/components/map/layer-legend";
import { SurfDropsLayer } from "@/components/map/surf-drops-layer";
import { AmenitiesLayer } from "@/components/map/amenities-layer";
import {
  CreateDropSheet,
  type CreateDropSheetSuccess,
} from "@/components/surf-drops/create-drop-sheet";
import { useOptionalAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => <MapFirstPaintShell />,
  },
);

interface DropPlacementPin {
  lat: number;
  lon: number;
}

/**
 * MapPageClient is the /map route entry. It owns the surf-drops overlay
 * state (layer toggles, CreateDropSheet, freshly-created share_slug) and
 * mounts overlay components alongside the map. The map's mapbox instance is
 * picked up by the layer components via the `quiver:map-ready` /
 * `quiver:map-bounds-change` events dispatched by InteractiveMap.
 */
export function MapPageClient() {
  const auth = useOptionalAuth?.() ?? null;
  const user = auth?.user ?? null;
  const { layers, setLayers } = usePersistedLayerState();
  const [createOpen, setCreateOpen] = useState(false);
  const [isPlacingDrop, setIsPlacingDrop] = useState(false);
  const [dropPin, setDropPin] = useState<DropPlacementPin | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);
  const [lastCreatedDrop, setLastCreatedDrop] =
    useState<CreateDropSheetSuccess | null>(null);
  // businessesCount stays at 0 until a /api/qr-venues/map response with any
  // activated venues lands. V1 shipped without a public directory, so the
  // legend row is dormant by default.
  const [businessesCount, setBusinessesCount] = useState<number>(0);

  // Listen for bounds changes to ping the QR-venues endpoint and know whether
  // the businesses toggle should be enabled. Uses the same window bridge as
  // the surf-drops / amenities layers.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const onBounds = async (event: Event) => {
      const bounds = (event as CustomEvent).detail as
        | { west: number; south: number; east: number; north: number }
        | undefined;
      if (!bounds) return;
      try {
        const bbox = [bounds.west, bounds.south, bounds.east, bounds.north].join(
          ",",
        );
        const res = await fetch(`/api/qr-venues/map?bbox=${bbox}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const list: unknown[] = json?.data?.venues ?? [];
        if (!cancelled) setBusinessesCount(list.length);
      } catch {
        // ignore — dormant toggle is the safe fallback.
      }
    };
    window.addEventListener("quiver:map-bounds-change", onBounds);
    return () => {
      cancelled = true;
      window.removeEventListener("quiver:map-bounds-change", onBounds);
    };
  }, []);

  const handleCreated = useCallback((result: CreateDropSheetSuccess) => {
    setLastCreatedDrop(result);
    setRefetchToken((n) => n + 1);
    setCreateOpen(false);
    setIsPlacingDrop(false);
    setDropPin(null);
  }, []);

  const handleStartDropPlacement = useCallback(() => {
    setLastCreatedDrop(null);
    setCreateOpen(false);
    setIsPlacingDrop(true);
  }, []);

  const handleCancelDropPlacement = useCallback(() => {
    setIsPlacingDrop(false);
    setDropPin(null);
  }, []);

  const handleConfirmDropPlacement = useCallback(() => {
    if (!dropPin) {
      return;
    }
    setIsPlacingDrop(false);
    setCreateOpen(true);
  }, [dropPin]);

  const handleCloseCreateSheet = useCallback(() => {
    setCreateOpen(false);
    setDropPin(null);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col">
      <MapView
        layerControls={
          <LayerLegend
            value={layers}
            onChange={setLayers}
            businessesCount={businessesCount}
            className="pointer-events-auto flex min-w-[11rem] flex-col gap-1 rounded-sm border border-white/15 bg-transparent p-0 text-[#F4EBD8] shadow-none"
            embedded
          />
        }
        placementActive={isPlacingDrop}
        placementPin={dropPin}
        onPlacementPinChange={setDropPin}
      />

      {/* Surf Drop markers on the map. */}
      {layers.drops && (
        <SurfDropsLayer enabled={layers.drops} refetchToken={refetchToken} />
      )}
      {layers.amenities && <AmenitiesLayer enabled={layers.amenities} />}

      {/* FAB — signed-in only. Bottom-right on all breakpoints; sits above the
          Mapbox controls. */}
      {user && (
        <Button
          type="button"
          data-testid="drop-a-spot-fab"
          onClick={handleStartDropPlacement}
          className="pointer-events-auto absolute bottom-4 right-4 z-30 rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
          style={{
            background: "#F78E42",
            color: "#F4EBD8",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          + Drop a spot
        </Button>
      )}

      {user && isPlacingDrop && (
        <div
          data-testid="drop-placement-panel"
          className="pointer-events-auto absolute bottom-20 right-4 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-md border p-3 shadow-xl"
          style={{
            background: "rgba(37, 45, 107, 0.94)",
            borderColor: "rgba(255, 255, 255, 0.18)",
            color: "#F4EBD8",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          <div className="text-sm font-semibold">Place your drop</div>
          <div className="mt-1 text-xs text-[#C8D0FF]">
            Move the pin to the shore, then add details.
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelDropPlacement}
              className="text-[#F4EBD8] hover:bg-white/10 hover:text-[#F4EBD8]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="drop-placement-confirm"
              disabled={!dropPin}
              onClick={handleConfirmDropPlacement}
              className="font-semibold"
              style={{ background: "#F78E42", color: "#11100D" }}
            >
              Add details
            </Button>
          </div>
        </div>
      )}

      <CreateDropSheet
        open={createOpen}
        onClose={handleCloseCreateSheet}
        onCreated={handleCreated}
        defaultMode="custom_pin"
        customPin={
          dropPin
            ? { ...dropPin, label: "Custom beach pin" }
            : null
        }
      />

      {/* One-shot confirmation for the freshly-created drop. */}
      {lastCreatedDrop && (
        <div
          data-testid="drop-created-toast"
          className="pointer-events-auto absolute bottom-20 right-4 z-30 rounded px-3 py-2 text-sm shadow-lg"
          style={{ background: "#00D4AA", color: "#11100D" }}
        >
          Dropped!{" "}
          <a
            className="underline"
            href={`/drops/${lastCreatedDrop.id}`}
            onClick={() => setLastCreatedDrop(null)}
          >
            View
          </a>
        </div>
      )}
    </div>
  );
}
