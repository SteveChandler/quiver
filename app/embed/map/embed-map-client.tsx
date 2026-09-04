"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import type { Beach } from "@/types/database";
import type { HourlySwellTimeline } from "@/app/api/forecasts/bulk/route";
import type { SwellLayerId } from "@/components/map/swell-map-theme";
import type { MapSpotConditions } from "@/components/map/interactive-map";
import {
  parseEmbedMapCommand,
  serializeEmbedMapEvent,
  type EmbedMapCommand,
  type EmbedMapCoordinate,
  type EmbedMapEvent,
  type EmbedMapSwellLayerId,
  type EmbedMapViewport,
} from "@/components/map/embed-map-bridge";
import {
  embedMapTimelineTimezone,
  forecastAtForEmbedTimelineIndex,
  LEGACY_EMBED_TIMELINE_STEPS,
  hourlyEmbedTimelineLabels,
  hourlyEmbedTimelineTimestamps,
} from "@/components/map/embed-map-timeline";

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
const LAYER_SWITCHER: ReadonlyArray<{ id: EmbedMapSwellLayerId; label: string }> = [
  { id: "s1", label: "Swell" },
  { id: "s2", label: "Swell 2" },
  { id: "wind", label: "Wind" },
  { id: "combined", label: "All" },
];
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

function clampTimelineIndex(index: number, maxTimelineIndex: number): number {
  return Math.max(0, Math.min(maxTimelineIndex, index));
}

function clampTimelineStep(index: number, maxTimelineIndex: number): number {
  return Math.round(clampTimelineIndex(index, maxTimelineIndex));
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

export function focusEmbedBeachMarker(beachId: string): boolean {
  const markers = document.querySelectorAll<HTMLElement>('[data-testid="beach-marker"]');
  const marker = Array.from(markers).find(
    (candidate) => candidate.getAttribute("data-beach-id") === beachId,
  );
  const focusTarget = marker?.querySelector<HTMLElement>('[data-marker-badge="true"]') ?? marker;
  if (!focusTarget) return false;
  focusTarget.focus({ preventScroll: true });
  return document.activeElement === focusTarget;
}

export function EmbedMapClient() {
  const searchParams = useSearchParams();
  const isHourlyTimeline = searchParams.get("timeline") === "hourly";
  const timelineTimezone = useMemo(
    () => embedMapTimelineTimezone(searchParams.get("timezone") ?? searchParams.get("timeZone")),
    [searchParams],
  );
  const timelineNow = useMemo(() => new Date(), []);
  const [hourlyTimeline, setHourlyTimeline] = useState<HourlySwellTimeline | null>(null);
  const hourlyTimestamps = useMemo(
    () => hourlyEmbedTimelineTimestamps(hourlyTimeline),
    [hourlyTimeline],
  );
  const timelineSteps = useMemo(
    () => isHourlyTimeline
      ? hourlyEmbedTimelineLabels(timelineNow, hourlyTimestamps, timelineTimezone)
      : Array.from(LEGACY_EMBED_TIMELINE_STEPS),
    [hourlyTimestamps, isHourlyTimeline, timelineNow, timelineTimezone],
  );
  const maxTimelineIndex = timelineSteps.length - 1;
  const initialCenter = useMemo<EmbedMapCoordinate>(() => {
    const lat = finiteParam(searchParams.get("lat"));
    const lon = finiteParam(searchParams.get("lon"));
    if (lat === null || lon === null) return DEFAULT_CENTER;
    return { lat, lon };
  }, [searchParams]);
  const initialZoom = finiteParam(searchParams.get("zoom")) ?? DEFAULT_ZOOM;
  const [initialBootstrapPromise] = useState<Promise<unknown> | null>(() => {
    if (typeof window === "undefined" || !window.ReactNativeWebView) return null;
    const params = new URLSearchParams({
      latitude: String(initialCenter.lat),
      longitude: String(initialCenter.lon),
    });
    return fetch(`/api/map/bootstrap?${params.toString()}`, {
      headers: { Accept: "application/json" },
    }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).catch(() => null);
  });
  const initialNearbyBeachesPromise = useMemo<Promise<unknown> | null>(() => {
    if (!initialBootstrapPromise) return null;
    return initialBootstrapPromise.then((result) => {
      if (!result || typeof result !== "object" || !("data" in result)) return null;
      const data = result.data;
      if (!data || typeof data !== "object" || !("beaches" in data)) return null;
      return { data: Array.isArray(data.beaches) ? data.beaches : [] };
    });
  }, [initialBootstrapPromise]);
  const initialForecastResponsePromise = useMemo<Promise<unknown> | null>(() => {
    if (!initialBootstrapPromise) return null;
    return initialBootstrapPromise.then((result) => {
      if (!result || typeof result !== "object" || !("data" in result)) return null;
      const data = result.data;
      if (!data || typeof data !== "object" || !("forecast" in data)) return null;
      return data.forecast;
    }).catch(() => null);
  }, [initialBootstrapPromise]);
  const [layerId, setLayerId] = useState<EmbedMapSwellLayerId>(
    layerParam(searchParams.get("layer")),
  );
  const [timelineIndex, setTimelineIndex] = useState(
    clampTimelineStep(
      finiteParam(searchParams.get("timeIndex")) ?? 0,
      maxTimelineIndex,
    ),
  );
  const [regionViewport, setRegionViewport] = useState<ReturnType<
    typeof regionViewportFromCommand
  > | null>(null);
  const [placementPoint, setPlacementPoint] = useState<EmbedMapCoordinate | null>(null);
  const [isPlacementActive, setIsPlacementActive] = useState(false);
  // The native app renders its own layer/time chrome over the WebView, so we only
  // show the web chrome when running standalone (browser) to avoid duplication.
  const [showWebChrome, setShowWebChrome] = useState(false);
  useEffect(() => {
    setShowWebChrome(typeof window !== "undefined" && !window.ReactNativeWebView);
  }, []);
  // Forecast playback: smoothly sweep the (fractional) timeline so the field
  // morphs through the day. The map interpolates between hourly steps.
  const [isPlaying, setIsPlaying] = useState(false);
  // "None" hides the swell field so users can read just the map + spots.
  const [fieldHidden, setFieldHidden] = useState(false);
  const timelineIndexRef = useRef(timelineIndex);
  useEffect(() => {
    timelineIndexRef.current = timelineIndex;
  }, [timelineIndex]);
  // Sweep at the same forecast-hours-per-second in both modes: legacy indexes
  // are 3h apart, hourly indexes 1h apart, so hourly advances 3x per tick.
  const playbackIncrement = isHourlyTimeline ? 0.18 : 0.06;
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      let next = timelineIndexRef.current + playbackIncrement;
      if (next >= maxTimelineIndex) next = 0;
      next = clampTimelineIndex(next, maxTimelineIndex);
      timelineIndexRef.current = next;
      setTimelineIndex(next);
    }, 80);
    return () => window.clearInterval(id);
  }, [isPlaying, maxTimelineIndex, playbackIncrement]);
  const nativeCommandKeyRef = useRef(0);
  const accessTokenRef = useRef<string | null>(null);
  const authGenerationRef = useRef(0);
  const [authGeneration, setAuthGeneration] = useState(0);
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
  const getAccessToken = useCallback((): string | null => accessTokenRef.current, []);
  const getAuthGeneration = useCallback((): number => authGenerationRef.current, []);
  const handleAuthTokenExpired = useCallback((): void => {
    postEvent({ type: "auth_token_expired" });
  }, [postEvent]);

  // Keep the native chrome's time label in sync while the field plays/scrubs: emit
  // the rounded forecast step whenever it changes. The play loop advances a
  // fractional index; native renders integer steps. No-op in the browser.
  const roundedStep = clampTimelineStep(timelineIndex, maxTimelineIndex);
  const lastEmittedForecastTimeRef = useRef<string | null>(null);
  useEffect(() => {
    const forecastAt = isHourlyTimeline
      ? forecastAtForEmbedTimelineIndex(hourlyTimestamps, roundedStep)
      : undefined;
    const identity = `${roundedStep}|${forecastAt ?? ""}`;
    if (lastEmittedForecastTimeRef.current === identity) return;
    lastEmittedForecastTimeRef.current = identity;
    postEvent({
      type: "forecastTimeChanged",
      payload: { index: roundedStep, ...(forecastAt ? { forecastAt } : {}) },
    });
  }, [hourlyTimestamps, isHourlyTimeline, postEvent, roundedStep]);

  const handleHourlyTimelineLoaded = useCallback((timeline: HourlySwellTimeline | null): void => {
    setHourlyTimeline(timeline);
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
    (
      bounds: { west: number; south: number; east: number; north: number },
      metadata: { interactionSource: "initial" | "programmatic" | "user" },
    ): void => {
      const viewport = viewportFromBounds(bounds);
      currentViewportRef.current = {
        ...viewport,
        zoom: currentViewportRef.current.zoom,
      };

      if (!sentReadyRef.current) {
        postReady(currentViewportRef.current);
        return;
      }

      postEvent({
        type: "viewportChanged",
        payload: {
          ...currentViewportRef.current,
          interactionSource: metadata.interactionSource,
        },
      });
    },
    [postEvent, postReady],
  );

  const handleMapReady = useCallback((): void => {
    postReady(currentViewportRef.current);
  }, [postReady]);

  const handleMapPresentationReady = useCallback((): void => {
    postEvent({ type: "presentationReady", payload: {} });
  }, [postEvent]);

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
          setTimelineIndex(clampTimelineStep(command.payload.index, maxTimelineIndex));
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
        case "focusSelectedSpot":
          focusEmbedBeachMarker(command.payload.beachId);
          return;
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
        case "setFieldVisible":
          setFieldHidden(!command.payload.visible);
          return;
        case "setForecastPlaying":
          setIsPlaying(command.payload.playing);
          return;
        case "auth_token":
          accessTokenRef.current = command.payload.accessToken;
          authGenerationRef.current += 1;
          setAuthGeneration(authGenerationRef.current);
          return;
        case "setTheme":
        case "setReducedMotion":
          return;
        default:
          return;
      }
    },
    [maxTimelineIndex, placementPoint, postEvent],
  );

  useEffect(() => {
    const parseMessage = (event: MessageEvent): EmbedMapCommand | null =>
      parseEmbedMapCommand(event.data, maxTimelineIndex);
    const receiveDocumentMessage = (event: MessageEvent): void => {
      const command = parseMessage(event);
      if (!command) return;
      if (command.type === "auth_token" && !window.ReactNativeWebView) return;
      handleCommand(command);
    };
    const receiveWindowMessage = (event: MessageEvent): void => {
      if (event.source !== window) return;
      const command = parseMessage(event);
      if (!command) return;
      if (command.type === "auth_token") return;
      handleCommand(command);
    };

    window.addEventListener("message", receiveWindowMessage);
    document.addEventListener("message", receiveDocumentMessage as EventListener);

    return () => {
      window.removeEventListener("message", receiveWindowMessage);
      document.removeEventListener("message", receiveDocumentMessage as EventListener);
    };
  }, [handleCommand, maxTimelineIndex]);

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
    (beach: Beach, conditions?: MapSpotConditions): void => {
      postEvent({
        type: "spotSelected",
        payload: {
          beachId: beach.id,
          name: beach.name,
          lat: beach.lat ?? initialCenter.lat,
          lon: beach.lon ?? initialCenter.lon,
          slug: beach.slug,
          conditionSummary: conditions?.conditionSummary ?? null,
          waterQualityHold: conditions?.waterQualityHold ?? null,
          waveHeight: conditions?.waveHeight ?? null,
          swellPeriod: conditions?.swellPeriod ?? null,
          swellDirection: conditions?.swellDirection ?? null,
          isCalibrated: conditions?.isCalibrated ?? null,
          windSpeed: conditions?.windSpeed ?? null,
          windDirection: conditions?.windDirection ?? null,
          tideState: conditions?.tideState ?? null,
          tideHeight: conditions?.tideHeight ?? null,
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
        initialNearbyBeachesPromise={initialNearbyBeachesPromise}
        initialForecastResponsePromise={initialForecastResponsePromise}
        authGeneration={authGeneration}
        getAccessToken={getAccessToken}
        getAuthGeneration={getAuthGeneration}
        autoNavigateOnMarkerClick={false}
        className="absolute inset-0 h-full w-full"
        clusterClickBehavior="expand"
        disableBeachClustering
        markerDisplay="points"
        onBoundsChange={handleBoundsChange}
        onLocationClick={handleBeachSelect}
        onMapLoadFailure={handleMapLoadFailure}
        onMapReady={handleMapReady}
        onMapPresentationReady={handleMapPresentationReady}
        onAuthTokenExpired={handleAuthTokenExpired}
        onMapClick={handleMapClick}
        onHourlyTimelineLoaded={isHourlyTimeline ? handleHourlyTimelineLoaded : undefined}
        onPlacementPinChange={handlePlacementPinChange}
        placementPin={isPlacementActive ? placementPoint : null}
        placementPinDraggable
        regionViewport={regionViewport}
        showConditionsOnTap={!isPlacementActive}
        showMapChrome={false}
        showSwellField={!fieldHidden}
        skillLevel={searchParams.get("skill") ?? undefined}
        swellLayerId={layerId as SwellLayerId}
        swellTimelineIndex={timelineIndex}
        swellTimelineMode={isHourlyTimeline ? "hourly" : undefined}
        swellTimelineSteps={timelineSteps}
      />
      {!isPlacementActive && (
        <div
          className="pointer-events-none absolute z-10 flex select-none flex-col items-start gap-2"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
            left: "calc(env(safe-area-inset-left, 0px) + 16px)",
          }}
        >
          {showWebChrome && (
            <div
              className="pointer-events-auto flex"
              style={{
                gap: 3,
                padding: 5,
                background: "rgba(13, 16, 32, 0.78)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(244, 235, 216, 0.18)",
                borderRadius: "13px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.38)",
              }}
            >
              {LAYER_SWITCHER.map((opt) => {
                const active = !fieldHidden && layerId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="embed-layer-pill focus-ring"
                    aria-pressed={active}
                    onClick={() => {
                      setFieldHidden(false);
                      setLayerId(opt.id);
                    }}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "9px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      background: active ? "#F4EBD8" : "transparent",
                      color: active ? "#0D1020" : "rgba(244, 235, 216, 0.7)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <button
                type="button"
                className="embed-layer-pill focus-ring"
                aria-pressed={fieldHidden}
                onClick={() => {
                  setFieldHidden(true);
                  setIsPlaying(false);
                }}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "9px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  background: fieldHidden ? "#F4EBD8" : "transparent",
                  color: fieldHidden ? "#0D1020" : "rgba(244, 235, 216, 0.7)",
                }}
              >
                None
              </button>
            </div>
          )}

          {showWebChrome && (
          <div
            aria-label="Conditions legend"
            style={{
              background: "rgba(13, 16, 32, 0.78)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(244, 235, 216, 0.18)",
              borderRadius: "14px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.38)",
              padding: "11px 13px 9px",
            }}
          >
            <div
              style={{
                color: "rgba(244, 235, 216, 0.6)",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Conditions
            </div>
            {[
              { label: "Swell", color: "#F78E42" },
              { label: "Swell 2", color: "#7AC74F" },
              { label: "Wind", color: "#00D4AA" },
            ].map((item) => (
              <div
                key={item.label}
                style={{ display: "flex", alignItems: "center", gap: "9px", padding: "3px 0" }}
              >
                <span
                  aria-hidden
                  style={{
                    width: "11px",
                    height: "11px",
                    borderRadius: "9999px",
                    background: item.color,
                    boxShadow: `0 0 0 2px rgba(244, 235, 216, 0.14), 0 0 9px ${item.color}66`,
                  }}
                />
                <span style={{ color: "#F4EBD8", fontSize: "12.5px", fontWeight: 600, lineHeight: 1 }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
      )}
      {showWebChrome && !isPlacementActive && !fieldHidden && (
        <>
          <style>{`
            .embed-time-slider { -webkit-appearance:none; appearance:none; height:6px; border-radius:9999px; outline:none; cursor:pointer; }
            .embed-time-slider::-webkit-slider-runnable-track { height:6px; border-radius:9999px; background:transparent; }
            .embed-time-slider::-moz-range-track { height:6px; border-radius:9999px; background:transparent; }
            .embed-time-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:18px; height:18px; margin-top:-6px; border-radius:9999px; background:#F4EBD8; border:2px solid rgba(13,16,32,0.45); box-shadow:0 2px 6px rgba(0,0,0,0.45); cursor:pointer; }
            .embed-time-slider::-moz-range-thumb { width:16px; height:16px; border-radius:9999px; background:#F4EBD8; border:2px solid rgba(13,16,32,0.45); box-shadow:0 2px 6px rgba(0,0,0,0.45); cursor:pointer; }
            .embed-layer-pill { transition: background 120ms ease, color 120ms ease; }
          `}</style>

          {/* Timeline scrubber with play */}
          <div
            className="pointer-events-auto absolute z-10 select-none"
            style={{
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(440px, calc(100vw - 32px))",
              background: "rgba(13, 16, 32, 0.78)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(244, 235, 216, 0.18)",
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.38)",
              padding: "10px 16px 13px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
              <span
                style={{
                  color: "rgba(244, 235, 216, 0.6)",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                }}
              >
                Forecast
              </span>
              <span style={{ color: "#F4EBD8", fontSize: "14px", fontWeight: 700 }}>
                {timelineSteps[roundedStep]}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                aria-label={isPlaying ? "Pause forecast playback" : "Play forecast playback"}
                onClick={() => setIsPlaying((playing) => !playing)}
                style={{
                  flex: "0 0 auto",
                  width: 32,
                  height: 32,
                  borderRadius: "9999px",
                  border: "none",
                  cursor: "pointer",
                  background: "#F4EBD8",
                  color: "#0D1020",
                  fontSize: 12,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
                }} className="focus-ring"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <input
                type="range"
                className="embed-time-slider"
                aria-label="Forecast time"
                min={0}
                max={maxTimelineIndex}
                step={0.01}
                value={clampTimelineIndex(timelineIndex, maxTimelineIndex)}
                onChange={(event) => {
                  setIsPlaying(false);
                  setTimelineIndex(
                    clampTimelineIndex(Number(event.target.value), maxTimelineIndex),
                  );
                }}
                style={{
                  flex: 1,
                  background: `linear-gradient(to right, #F78E42 0%, #F78E42 ${(clampTimelineIndex(timelineIndex, maxTimelineIndex) / maxTimelineIndex) * 100}%, rgba(244,235,216,0.22) ${(clampTimelineIndex(timelineIndex, maxTimelineIndex) / maxTimelineIndex) * 100}%, rgba(244,235,216,0.22) 100%)`,
                  borderRadius: "9999px",
                }}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
