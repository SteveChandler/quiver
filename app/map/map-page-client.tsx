"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapFirstPaintShell } from "./map-first-paint-shell";
import { LayerLegend, usePersistedLayerState } from "@/components/map/layer-legend";
import { SurfDropsLayer } from "@/components/map/surf-drops-layer";
import { AmenitiesLayer } from "@/components/map/amenities-layer";
import type { SurfDropInView } from "@/hooks/use-surf-drops-in-view";
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
  const showPlacementPin = isPlacingDrop || (createOpen && Boolean(dropPin));
  const optimisticDrop = useMemo<SurfDropInView | null>(() => {
    if (
      !lastCreatedDrop ||
      !user ||
      !Number.isFinite(lastCreatedDrop.lat) ||
      !Number.isFinite(lastCreatedDrop.lon)
    ) {
      return null;
    }
    return {
      id: lastCreatedDrop.id,
      share_slug: lastCreatedDrop.share_slug,
      location_type: lastCreatedDrop.location_type,
      lat: lastCreatedDrop.lat as number,
      lon: lastCreatedDrop.lon as number,
      beach_id: lastCreatedDrop.beach_id,
      spot_name: lastCreatedDrop.spot_name,
      general_area: lastCreatedDrop.general_area,
      exact_label: lastCreatedDrop.exact_label,
      starts_at: lastCreatedDrop.starts_at,
      ends_at: lastCreatedDrop.ends_at,
      audience: lastCreatedDrop.audience,
      creator: {
        id: user.id,
        display_name: "You",
        avatar_url: null,
      },
      participants_count: 0,
    };
  }, [lastCreatedDrop, user]);
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <MapView
        toolbarLayerControls={
          <LayerLegend
            value={layers}
            onChange={setLayers}
            businessesCount={businessesCount}
            className="pointer-events-auto flex min-w-[12rem] flex-col gap-1 rounded-sm bg-transparent p-0 text-[#F4EBD8] shadow-none"
            embedded
            showDrops={Boolean(user)}
          />
        }
        showSwellField={layers.swell}
        onShowSwellFieldChange={(next) => setLayers({ ...layers, swell: next })}
        showSurfSpots={layers.spots}
        placementActive={showPlacementPin}
        placementPin={dropPin}
        placementPinDraggable={isPlacingDrop}
        onPlacementPinChange={setDropPin}
      />

      {/* Surf Drop markers on the map. */}
      {user && layers.drops && (
        <SurfDropsLayer
          enabled={layers.drops}
          refetchToken={refetchToken}
          optimisticDrop={optimisticDrop}
        />
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
          className="pointer-events-auto absolute bottom-20 right-4 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-sm border-2 p-3 shadow-[4px_4px_0_rgba(17,16,13,0.35)]"
          style={{
            background: "#F4EBD8",
            borderColor: "#11100D",
            color: "#11100D",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          <div className="font-heading text-base font-black uppercase leading-tight">
            Place your drop
          </div>
          <div className="mt-1 text-xs font-semibold text-[#11100D]/70">
            Move the pin to the shore, then add details.
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelDropPlacement}
              className="rounded-sm border-2 border-[#11100D] bg-[#F4EBD8] font-heading font-black uppercase text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] hover:bg-[#F0E5CC] hover:text-[#11100D]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="drop-placement-confirm"
              disabled={!dropPin}
              onClick={handleConfirmDropPlacement}
              className="rounded-sm border-2 border-[#11100D] !bg-[#F78E42] !text-[#11100D] font-heading font-black uppercase shadow-[2px_2px_0_rgba(17,16,13,0.28)] hover:!bg-[#F78E42] disabled:!bg-[#F78E42] disabled:opacity-55"
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
          className="zine-tab pointer-events-auto absolute bottom-20 right-4 z-30 flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-sm border-2 border-[#11100D] bg-[#F4EBD8] px-3 py-2 text-[#11100D] shadow-[4px_5px_0_rgba(17,16,13,0.28)]"
        >
          <span className="font-heading text-sm font-black uppercase tracking-wide">
            Dropped
          </span>
          <a
            className="rounded-sm border-2 border-[#11100D] bg-[#F78E42] px-2 py-1 font-heading text-xs font-black uppercase text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.18)] transition hover:-translate-y-0.5"
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
