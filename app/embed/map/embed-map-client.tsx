"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import type { Beach } from "@/types/database";
import type { SwellLayerId } from "@/components/map/swell-map-theme";
import {
  parseEmbedMapCommand,
  serializeEmbedMapEvent,
  type EmbedMapCommand,
  type EmbedMapCoordinate,
  type EmbedMapEvent,
  type EmbedMapSwellLayerId,
  type EmbedMapViewport,
} from "@/components/map/embed-map-bridge";

const InteractiveMap = dynamic(
  () =>
    import("@/components/map/interactive-map").then((mod) => ({
      default: mod.InteractiveMap,
    })),
  {
    ssr: false,
    loading: () => <EmbedMapLoading />,
  },
);

const DEFAULT_CENTER: EmbedMapCoordinate = { lat: 32.8667, lon: -117.2544 };
const DEFAULT_ZOOM = 11.5;
const DEFAULT_TIMELINE_STEPS = ["Now", "+3h", "+6h", "+9h", "+12h", "+15h", "+18h", "+21h"];
const FATAL_MAP_FAILURE_REASONS = new Set(["token_invalid", "webgl_unsupported"]);
const RENDER_HEALTH_SAMPLE_MS = 3_000;
const DEGRADED_FPS_THRESHOLD = 28;

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

function finiteParam(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function layerParam(value: string | null): EmbedMapSwellLayerId {
  if (value === "combined" || value === "s1" || value === "s2" || value === "wind") {
    return value;
  }
  return "s1";
}

function viewportFromBounds(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}): EmbedMapViewport {
  return {
    center: {
      lat: Number(((bounds.south + bounds.north) / 2).toFixed(6)),
      lon: Number(((bounds.west + bounds.east) / 2).toFixed(6)),
    },
    bounds,
  };
}

function regionViewportFromCommand(
  command: Extract<EmbedMapCommand, { type: "setViewport" }>,
  keySeed: number,
) {
  const { center, bounds, zoom } = command.payload;
  return {
    key: `native-${keySeed}`,
    region: "native",
    center: [center.lat, center.lon] as [number, number],
    ...(zoom !== undefined ? { zoom } : {}),
    ...(bounds
      ? {
          bounds: [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ] as [[number, number], [number, number]],
        }
      : {}),
  };
}

function EmbedMapLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#111833] text-xs font-semibold tracking-normal text-white/70">
      Loading map
    </div>
  );
}

function renderHealthStatus(fps: number): "ok" | "degraded" {
  return fps >= DEGRADED_FPS_THRESHOLD ? "ok" : "degraded";
}

export function EmbedMapClient() {
  const searchParams = useSearchParams();
  const initialCenter = useMemo<EmbedMapCoordinate>(() => {
    const lat = finiteParam(searchParams.get("lat"));
    const lon = finiteParam(searchParams.get("lon"));
    if (lat === null || lon === null) return DEFAULT_CENTER;
    return { lat, lon };
  }, [searchParams]);
  const initialZoom = finiteParam(searchParams.get("zoom")) ?? DEFAULT_ZOOM;
  const [layerId, setLayerId] = useState<EmbedMapSwellLayerId>(
    layerParam(searchParams.get("layer")),
  );
  const [timelineIndex, setTimelineIndex] = useState(
    Math.max(0, Math.round(finiteParam(searchParams.get("timeIndex")) ?? 0)),
  );
  const [regionViewport, setRegionViewport] = useState<ReturnType<
    typeof regionViewportFromCommand
  > | null>(null);
  const [placementPoint, setPlacementPoint] = useState<EmbedMapCoordinate | null>(null);
  const [isPlacementActive, setIsPlacementActive] = useState(false);
  const nativeCommandKeyRef = useRef(0);
  const currentViewportRef = useRef<EmbedMapViewport>({
    center: initialCenter,
    zoom: initialZoom,
  });
  const sentReadyRef = useRef(false);
  const pendingReadyViewportRef = useRef<EmbedMapViewport | null>(null);

  const postEvent = useCallback((event: EmbedMapEvent): boolean => {
    if (!window.ReactNativeWebView) return false;
    window.ReactNativeWebView.postMessage(serializeEmbedMapEvent(event));
    return true;
  }, []);

  const postReady = useCallback(
    (viewport: EmbedMapViewport): boolean => {
      if (sentReadyRef.current) return true;
      const didPost = postEvent({ type: "ready", payload: { viewport } });
      if (!didPost) {
        pendingReadyViewportRef.current = viewport;
        return false;
      }

      sentReadyRef.current = true;
      pendingReadyViewportRef.current = null;
      postEvent({ type: "renderHealth", payload: { status: "ok" } });
      return true;
    },
    [postEvent],
  );

  const handleBoundsChange = useCallback(
    (bounds: { west: number; south: number; east: number; north: number }): void => {
      const viewport = viewportFromBounds(bounds);
      currentViewportRef.current = {
        ...viewport,
        zoom: currentViewportRef.current.zoom,
      };

      if (!sentReadyRef.current) {
        postReady(currentViewportRef.current);
        return;
      }

      postEvent({ type: "viewportChanged", payload: currentViewportRef.current });
    },
    [postEvent, postReady],
  );

  const handleMapReady = useCallback((): void => {
    postReady(currentViewportRef.current);
  }, [postReady]);

  useEffect(() => {
    if (sentReadyRef.current) return;

    const intervalId = window.setInterval(() => {
      const pendingViewport = pendingReadyViewportRef.current;
      if (!pendingViewport) return;
      postReady(pendingViewport);
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [postReady]);

  const updatePlacement = useCallback(
    (coordinate: EmbedMapCoordinate): void => {
      setPlacementPoint(coordinate);
      postEvent({ type: "placementChanged", payload: coordinate });
    },
    [postEvent],
  );

  const handleCommand = useCallback(
    (command: EmbedMapCommand): void => {
      switch (command.type) {
        case "setViewport": {
          nativeCommandKeyRef.current += 1;
          currentViewportRef.current = command.payload;
          setRegionViewport(regionViewportFromCommand(command, nativeCommandKeyRef.current));
          return;
        }
        case "setLayer":
          setLayerId(command.payload.layerId);
          return;
        case "setForecastTime":
          setTimelineIndex(command.payload.index);
          return;
        case "setSelectedSpot": {
          const { lat, lon } = command.payload;
          if (lat === undefined || lon === undefined) return;
          nativeCommandKeyRef.current += 1;
          const viewport: EmbedMapViewport = {
            center: { lat, lon },
            zoom: Math.max(currentViewportRef.current.zoom ?? DEFAULT_ZOOM, 13),
          };
          currentViewportRef.current = viewport;
          setRegionViewport(
            regionViewportFromCommand(
              { type: "setViewport", payload: viewport },
              nativeCommandKeyRef.current,
            ),
          );
          return;
        }
        case "startPlacement": {
          const point = command.payload?.lat !== undefined && command.payload?.lon !== undefined
            ? command.payload
            : currentViewportRef.current.center;
          setIsPlacementActive(true);
          setPlacementPoint(point);
          postEvent({ type: "placementStarted", payload: point });
          return;
        }
        case "cancelPlacement":
          setIsPlacementActive(false);
          setPlacementPoint(null);
          postEvent({ type: "placementCancelled", payload: {} });
          return;
        case "confirmPlacement": {
          const point = placementPoint ?? currentViewportRef.current.center;
          setIsPlacementActive(false);
          postEvent({ type: "placementConfirmed", payload: point });
          return;
        }
        case "setTheme":
        case "setReducedMotion":
          return;
        default:
          return;
      }
    },
    [placementPoint, postEvent],
  );

  useEffect(() => {
    const receiveMessage = (event: Event): void => {
      const command = parseEmbedMapCommand((event as MessageEvent).data);
      if (!command) return;
      handleCommand(command);
    };

    window.addEventListener("message", receiveMessage);
    document.addEventListener("message", receiveMessage);

    return () => {
      window.removeEventListener("message", receiveMessage);
      document.removeEventListener("message", receiveMessage);
    };
  }, [handleCommand]);

  useEffect(() => {
    if (!window.ReactNativeWebView || typeof window.requestAnimationFrame !== "function") return;

    let rafId = 0;
    let frameCount = 0;
    let sampleStart = window.performance.now();

    const tick = (): void => {
      frameCount += 1;
      rafId = window.requestAnimationFrame(tick);
    };

    const intervalId = window.setInterval(() => {
      const now = window.performance.now();
      const elapsedMs = Math.max(now - sampleStart, 1);
      const fps = Math.round((frameCount * 1000) / elapsedMs);

      postEvent({
        type: "renderHealth",
        payload: { fps, status: renderHealthStatus(fps) },
      });

      frameCount = 0;
      sampleStart = now;
    }, RENDER_HEALTH_SAMPLE_MS);

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
    };
  }, [postEvent]);

  const handleBeachSelect = useCallback(
    (beach: Beach): void => {
      postEvent({
        type: "spotSelected",
        payload: {
          beachId: beach.id,
          name: beach.name,
          lat: beach.lat ?? initialCenter.lat,
          lon: beach.lon ?? initialCenter.lon,
          slug: beach.slug,
        },
      });
    },
    [initialCenter.lat, initialCenter.lon, postEvent],
  );

  const handleMapClick = useCallback(
    (latlng: mapboxgl.LngLat): void => {
      const coordinate = {
        lat: Number(latlng.lat.toFixed(6)),
        lon: Number(latlng.lng.toFixed(6)),
      };

      if (isPlacementActive) {
        updatePlacement(coordinate);
        return;
      }

      postEvent({ type: "mapTapped", payload: coordinate });
    },
    [isPlacementActive, postEvent, updatePlacement],
  );

  const handlePlacementPinChange = useCallback(
    (latlng: mapboxgl.LngLat): void => {
      updatePlacement({
        lat: Number(latlng.lat.toFixed(6)),
        lon: Number(latlng.lng.toFixed(6)),
      });
    },
    [updatePlacement],
  );

  const handleMapLoadFailure = useCallback(
    (reason: string): void => {
      if (!FATAL_MAP_FAILURE_REASONS.has(reason)) return;
      postEvent({ type: "loadFailed", payload: { reason } });
    },
    [postEvent],
  );

  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-[#111833]">
      <InteractiveMap
        initialCenter={[initialCenter.lat, initialCenter.lon]}
        initialZoom={initialZoom}
        autoNavigateOnMarkerClick={false}
        className="absolute inset-0 h-full w-full"
        clusterClickBehavior="expand"
        disableBeachClustering
        markerDisplay="points"
        onBoundsChange={handleBoundsChange}
        onLocationClick={handleBeachSelect}
        onMapLoadFailure={handleMapLoadFailure}
        onMapReady={handleMapReady}
        onMapClick={handleMapClick}
        onPlacementPinChange={handlePlacementPinChange}
        placementPin={isPlacementActive ? placementPoint : null}
        placementPinDraggable
        regionViewport={regionViewport}
        showConditionsOnTap={!isPlacementActive}
        showMapChrome={false}
        showSwellField
        swellLayerId={layerId as SwellLayerId}
        swellTimelineIndex={timelineIndex}
        swellTimelineSteps={DEFAULT_TIMELINE_STEPS}
      />
    </main>
  );
}
