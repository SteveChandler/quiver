"use client";

import {
  Children,
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { debounce } from "@/lib/utils/debounce";
import type { Beach } from "@/types/database";
import * as AuthContext from "@/context/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { createCachedMapFetch } from "@/lib/utils/request-cache";
import { hasViewportChanged as checkViewportChanged } from "@/lib/utils/map-utilities";
import { CACHE_TTL } from "@/lib/constants/ui";
import { useBeachClustering, type ClusterPoint } from "@/hooks/use-beach-clustering";
import { loadFavoriteBeaches } from "@/components/map/map-favorites-loader";
import { createCustomSpotMarkerElement } from "@/components/map/custom-spot-marker-builder";
import {
  createWaveHeightBadge,
  getConditionMarkerGradient,
  getWaterTempBadgeColor,
  type MarkerPreviewData,
  type MarkerBuilderDeps,
  type MapDisplayMode,
  type MapMarkerDisplay,
} from "@/components/map/map-marker-builder";
import {
  loadBeachesAndWaveHeights,
  type ConditionSummary,
} from "@/components/map/map-beach-loader";
import { createBeachPreviewPopupContent } from "@/components/map/map-beach-preview-popup";
import {
  createClusterMapMarker,
  type ClusterClickBehavior,
  type ClusterRendererDeps,
} from "@/components/map/map-cluster-renderer";
import {
  createClusterPopupContent,
  getClusterPopupBeaches,
} from "@/components/map/map-cluster-popup";
import { useTrackEvent } from "@/hooks/use-track-event";
import {
  nearestBeachInBounds,
  resolveCalloutComponents,
  decideCalloutAction,
  formatTempLabel,
} from "@/components/map/conditions-callout-data";
import { createConditionsCalloutElement } from "@/components/map/conditions-callout";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";
import {
  SWELL_FIELD_PARTICLE_COLOR,
  SWELL_MAP_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_STICKER_RADIUS,
  type SwellLayerId,
} from "@/components/map/swell-map-theme";
import {
  buildFlowField,
  computeCoastalBounds,
  detectWaterLayerIds,
  interpolateSwellPartition,
  maskFieldToWater,
  partitionToPoint,
  waterMaskableFlowComponents,
  type BeachPartitionPoint,
  type FlowComponentId,
  type FlowField,
} from "@/components/map/swell-field/field-sampler";
import {
  createSwellParticleLayer,
  resolveParticleCount,
} from "@/components/map/swell-field/swell-particle-layer";
import { SwellLayerSelector } from "@/components/map/swell-field/swell-layer-selector";
import { SwellForecastTimeline } from "@/components/map/swell-field/swell-forecast-timeline";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { CustomSpot } from "@/hooks/use-custom-spots";
import { trackSignupCtaClick } from "@/lib/analytics/signup-conversion-tracking";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";

// Mapbox CSS is imported globally in app/globals.css

// Zoom-lock bounds for the coastal camera leash (swell field ON only): keeps the
// user hugging the coast where we have beach data instead of pulling back to
// open-ocean / continent scale. The pan corridor (maxBounds) is derived from the
// loaded-beach footprint via computeCoastalBounds (an APPROXIMATE rectangular
// coast corridor, not a pixel-perfect coastline mask).
const SWELL_FIELD_MIN_ZOOM = 9;
const SWELL_FIELD_MAX_ZOOM = 13.5;

// Base custom-layer id for the single-layer swell field.
const SWELL_FIELD_LAYER_ID = "quiver-swell-field";
// Component sub-layers overlaid for the "combined" view, each its own GL layer +
// flow field + color. Per-layer ids derive as `${SWELL_FIELD_LAYER_ID}-${id}`.
const COMBINED_SUBLAYERS: ReadonlyArray<FlowComponentId> = [
  "s1",
  "s2",
  "wind",
];
// Per-layer particle count for the combined view so three stacked layers keep the
// sparse Windy-style spacing in budget (3 × 260 = 780 total).
const COMBINED_PARTICLE_COUNT = 260;
// Wind reads cleaner with a sparser field than swell - scale its particle count
// down, but keep enough strokes visible on the light-blue basemap.
const WIND_PARTICLE_SCALE = 0.8;
const PARTICLE_MOTION_SCALE: Record<FlowComponentId, number> = {
  s1: 0.42,
  s2: 1,
  wind: 1,
};
const PARTICLE_VELOCITY_SMOOTHING: Record<FlowComponentId, number> = {
  s1: 0.04,
  s2: 0.16,
  wind: 0.12,
};
const PARTICLE_DASH_LENGTH_SCALE: Record<FlowComponentId, number> = {
  s1: 0.75,
  s2: 1,
  wind: 1,
};

const EMPTY_FLOW_FIELD: FlowField = { cols: 0, rows: 0, cells: [] };

function partitionAtTimelinePosition(
  beachId: string,
  position: number,
  timelineMap: Map<string, SwellPartition[]>,
  currentMap: Map<string, SwellPartition>
): SwellPartition | undefined {
  const fallback = currentMap.get(beachId);
  const timeline = timelineMap.get(beachId);
  if (!timeline || timeline.length === 0) return fallback;

  const safePosition = Number.isFinite(position) ? position : 0;
  const clampedPosition = Math.min(
    Math.max(safePosition, 0),
    timeline.length - 1
  );
  const leftIndex = Math.floor(clampedPosition);
  const rightIndex = Math.ceil(clampedPosition);
  const progress = clampedPosition - leftIndex;
  const left = timeline[leftIndex] ?? fallback;
  const right = timeline[rightIndex] ?? left ?? fallback;

  if (left && right && progress > 0) {
    return interpolateSwellPartition(left, right, progress);
  }

  return left ?? right ?? fallback;
}

/** Sub-layer component ids whose flow fields a given active layer needs built. */
function componentsForLayer(
  layerId: SwellLayerId
): ReadonlyArray<FlowComponentId> {
  if (layerId === "combined") return COMBINED_SUBLAYERS;
  return [layerId];
}

/** Captured zoom limits so the free camera can be restored exactly on toggle-off. */
interface CapturedZoomLimits {
  minZoom: number;
  maxZoom: number;
}

interface InteractiveMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  initialZoom?: number;
  onLocationClick?: (beach: Beach) => void;
  onMapClick?: (latlng: mapboxgl.LngLat) => void;
  onLocationMove?: (latlng: mapboxgl.LngLat, beach: Beach) => void;
  onBoundsChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  onWaveHeightsChange?: (map: Map<string, number | undefined>) => void;
  onDisplayForecastsChange?: (map: Map<string, ForecastDisplay | undefined>) => void;
  onMapReady?: () => void;
  className?: string;
  regionViewport?: {
    region: string;
    key: string;
    center: [number, number];
    bounds?: [[number, number], [number, number]];
    zoom?: number;
  } | null;
  beaches?: Beach[]; // Filtered beaches to display on map (if provided, skips API fetch)
  customSpots?: CustomSpot[];
  autoNavigateOnMarkerClick?: boolean; // Whether marker clicks auto-navigate to beach page (default: true)
  displayMode?: MapDisplayMode; // What data to show in markers: 'wave-height' (default) or 'water-temp'
  markerDisplay?: MapMarkerDisplay; // Full forecast markers (default) or compact point markers.
  disableBeachClustering?: boolean; // Render beach points directly instead of clustered count markers.
  clusterClickBehavior?: ClusterClickBehavior; // Whether clusters expand or show grouped spot details
  showSwellField?: boolean;
  showConditionsOnTap?: boolean; // Embed-only: tap open water shows a nearest-beach conditions callout.
  swellLayerId?: SwellLayerId;
  onSwellLayerChange?: (id: SwellLayerId) => void;
  /** Forecast-step labels for the timeline scrubber (e.g. ["Now","+3h"]). */
  swellTimelineSteps?: string[];
  swellTimelineIndex?: number;
  onSwellTimelineChange?: (index: number) => void;
  showMapChrome?: boolean;
  placementPin?: { lat: number; lon: number } | null;
  placementPinDraggable?: boolean;
  onPlacementPinChange?: (latlng: mapboxgl.LngLat) => void;
  onMapLoadFailure?: (reason: string) => void;
}

const SAN_DIEGO: [number, number] = [32.7157, -117.1611];
const EMPTY_CUSTOM_SPOTS: CustomSpot[] = [];

const CONDITION_LEGEND_ITEMS: Array<{
  label: ConditionSummary;
  display: string;
}> = [
  { label: "GOOD", display: "Worth it" },
  { label: "FAIR", display: "Maybe" },
  { label: "CHECK", display: "Scout it" },
  { label: "UNKNOWN", display: "No read" },
];

interface MapConditionLegendProps {
  controls?: ReactNode;
  timeline?: ReactNode;
}

function MapConditionLegend({
  controls,
  timeline,
}: MapConditionLegendProps): ReactElement {
  const [isMinimized, setIsMinimized] = useState(false);
  const embeddedControls = Children.toArray(controls);
  const hasEmbeddedControls = embeddedControls.length > 0;
  const hasTimeline = Boolean(timeline);
  const isWide = hasTimeline || (!isMinimized && hasEmbeddedControls);
  const toggleLabel = isMinimized ? "Expand map legend" : "Minimize map legend";
  const ToggleIcon = isMinimized ? ChevronUp : ChevronDown;
  const toggleButton = (
    <button
      type="button"
      aria-label={toggleLabel}
      title={toggleLabel}
      data-testid="map-legend-toggle"
      onClick={() => setIsMinimized((current) => !current)}
      className="pointer-events-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-white/10 text-white/90 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
    >
      <ToggleIcon className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div
      data-testid="map-condition-legend"
      className={`pointer-events-none absolute bottom-3 left-3 z-10 px-3 py-2 text-white ${
        isWide
          ? "w-[calc(100%-1.5rem)] max-w-[27rem] sm:w-auto"
          : ""
      }`}
      style={{
        background: SWELL_MAP_SURFACE.panelDeep,
        border: `1px solid ${SWELL_MAP_SURFACE.border}`,
        borderRadius: SWELL_MAP_STICKER_RADIUS,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
      }}
    >
      {isMinimized ? (
        <div className="flex items-center gap-2">
          {toggleButton}
          {hasTimeline && <div className="min-w-0 flex-1">{timeline}</div>}
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
              {CONDITION_LEGEND_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full border border-white/35"
                    style={{ background: getConditionMarkerGradient(item.label) }}
                  />
                  <span className="text-[10px] font-semibold leading-none tracking-normal">
                    {item.display}
                  </span>
                </div>
              ))}
            </div>
            {toggleButton}
          </div>
          {(hasEmbeddedControls || hasTimeline) && (
            <div className="mt-2 flex flex-col gap-2 border-t border-white/15 pt-2">
              {embeddedControls}
              {timeline}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function InteractiveMap({
  initialCenter = SAN_DIEGO,
  initialZoom = 13,
  onLocationClick,
  onMapClick,
  onLocationMove,
  onBoundsChange,
  onWaveHeightsChange,
  onDisplayForecastsChange,
  onMapReady,
  className = "h-full w-full",
  regionViewport,
  beaches,
  customSpots = EMPTY_CUSTOM_SPOTS,
  autoNavigateOnMarkerClick = true,
  displayMode = "wave-height",
  markerDisplay = "forecast",
  disableBeachClustering = false,
  clusterClickBehavior = "expand",
  showSwellField = false,
  showConditionsOnTap = false,
  swellLayerId = "s1",
  onSwellLayerChange,
  swellTimelineSteps = [],
  swellTimelineIndex = 0,
  onSwellTimelineChange,
  showMapChrome = true,
  placementPin = null,
  placementPinDraggable = true,
  onPlacementPinChange,
  onMapLoadFailure,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const placementMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const activeClusterPopupRef = useRef<mapboxgl.Popup | null>(null);
  const activeBeachPreviewPopupRef = useRef<mapboxgl.Popup | null>(null);
  const activeCalloutRef = useRef<{ marker: mapboxgl.Marker; beachId: string } | null>(null);
  const conditionsCtxRef = useRef({
    beaches: [] as Beach[],
    partitionsMap: new Map<string, SwellPartition>(),
    partitionsTimelineMap: new Map<string, SwellPartition[]>(),
    timelineIndex: 0,
    stepsLen: 0,
    bounds: { west: -118, south: 32, east: -117, north: 33 },
    waterTempMap: new Map<string, string | undefined>(),
  });
  const beachPreviewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastPopulateKeyRef = useRef<string | null>(null);
  const lastViewportRef = useRef<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [favoriteBeachIds, setFavoriteBeachIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);
  const [hoveredBeachId, setHoveredBeachId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [waveHeightMap, setWaveHeightMap] = useState<Map<string, number | undefined>>(new Map());
  const [displayForecastMap, setDisplayForecastMap] = useState<Map<string, ForecastDisplay | undefined>>(new Map());
  const [waterTempMap, setWaterTempMap] = useState<Map<string, string | undefined>>(new Map());
  const [conditionScoreMap, setConditionScoreMap] = useState<Map<string, number | undefined>>(new Map());
  const [conditionSummaryMap, setConditionSummaryMap] = useState<Map<string, ConditionSummary>>(new Map());
  const [partitionsMap, setPartitionsMap] = useState<Map<string, SwellPartition>>(new Map());
  const [partitionsTimelineMap, setPartitionsTimelineMap] = useState<
    Map<string, SwellPartition[]>
  >(new Map());
  // Loader-resolved beaches that partitionsMap is keyed by (the prop may be empty).
  const [swellFieldBeaches, setSwellFieldBeaches] = useState<Beach[]>([]);
  // Whether the last flow-field build resolved ANY field points. False → the
  // field is ON but no beach partitions drew (blank water looks like a bug),
  // so we surface a small "no swell data" sticker. Defaults true to avoid a
  // flash before the first build.
  const [hasSwellData, setHasSwellData] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  // One-time coastal-leash hint: the camera silently loses zoom-out when the
  // field's leash applies, so we flash a one-shot note the FIRST time it locks
  // per mount. Ref guards "shown once"; `showLeashHint` mounts it, `leashHintFading`
  // drives the opacity transition out (skipped under reduced motion).
  const [showLeashHint, setShowLeashHint] = useState(false);
  const [leashHintFading, setLeashHintFading] = useState(false);
  const leashHintShownRef = useRef(false);
  const reducedMotion = useReducedMotion();
  // Live per-component flow fields read by the GL layers each frame (avoids re-adding
  // a layer on scrub). Keyed by component id: a single active layer populates just its
  // own key; the "combined" view populates s1/s2/wind so three layers can overlay.
  const flowFieldsRef = useRef<Record<"s1" | "s2" | "wind", FlowField>>({
    s1: EMPTY_FLOW_FIELD,
    s2: EMPTY_FLOW_FIELD,
    wind: EMPTY_FLOW_FIELD,
  });
  // Free-camera zoom limits captured before the swell-field leash, for exact restore.
  // Non-null only while the leash is applied — also gates the release path so we
  // never touch the camera constraint API when it was never set.
  const zoomLimitsCaptureRef = useRef<CapturedZoomLimits | null>(null);
  const swellLayerIdRef = useRef<SwellLayerId>(swellLayerId);
  const isMapReadyRef = useRef(false);
  const favoriteBeachIdsRef = useRef<Set<string>>(new Set());
  const selectedBeachIdRef = useRef<string | null>(null);
  const hoveredBeachIdRef = useRef<string | null>(null);
  const partitionsMapRef = useRef<Map<string, SwellPartition>>(new Map());
  const lastRegionViewportKeyRef = useRef<string | null>(null);
  const clusterCleanupRef = useRef<Map<string, () => void>>(new Map());
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onWaveHeightsChangeRef = useRef(onWaveHeightsChange);
  const onDisplayForecastsChangeRef = useRef(onDisplayForecastsChange);
  const onMapReadyRef = useRef(onMapReady);
  const onPlacementPinChangeRef = useRef(onPlacementPinChange);
  const onMapLoadFailureRef = useRef(onMapLoadFailure);
  const initialCenterRef = useRef(initialCenter);
  const onMapClickRef = useRef(onMapClick);
  // Typed broadly; handleMoveEnd & populateLocations are assigned via sync effects below
  const handleMoveEndRef = useRef<((...args: any[]) => any) | null>(null);
  const populateLocationsRef = useRef<((lat: number, lng: number) => Promise<void>) | null>(null);
  // Instrumentation refs for pan/zoom classification and single-fire events
  const prevCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const prevZoomRef = useRef<number | null>(null);
  const mountedAtRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0
  );
  const hasEmittedReadyRef = useRef(false);
  const emittedFailureTypesRef = useRef<Set<string>>(new Set());
  const lastEmptyStateKeyRef = useRef<string | null>(null);
  // Mirror latest clusters/beaches so emission helpers can read them synchronously
  const clustersRef = useRef<ClusterPoint[]>([]);
  const beachesRef = useRef<Beach[] | undefined>(beaches);

  const useAuthForMap = AuthContext.useOptionalAuth ?? AuthContext.useAuth;
  const auth = useAuthForMap();
  const user = auth?.user ?? null;
  const userId = showMapChrome ? user?.id : undefined;
  const { track } = useTrackEvent();
  const router = useRouter();
  const pathname = usePathname();
  const markerBeaches = beaches ?? swellFieldBeaches;

  useEffect(() => {
    isMapReadyRef.current = isMapReady;
  }, [isMapReady]);

  useEffect(() => {
    favoriteBeachIdsRef.current = new Set(favoriteBeachIds);
  }, [favoriteBeachIds]);

  useEffect(() => {
    selectedBeachIdRef.current = selectedBeachId;
  }, [selectedBeachId]);

  useEffect(() => {
    hoveredBeachIdRef.current = hoveredBeachId;
  }, [hoveredBeachId]);

  useEffect(() => {
    partitionsMapRef.current = partitionsMap;
  }, [partitionsMap]);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onWaveHeightsChangeRef.current = onWaveHeightsChange;
  }, [onWaveHeightsChange]);

  useEffect(() => {
    onDisplayForecastsChangeRef.current = onDisplayForecastsChange;
  }, [onDisplayForecastsChange]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onPlacementPinChangeRef.current = onPlacementPinChange;
  }, [onPlacementPinChange]);

  useEffect(() => {
    onMapLoadFailureRef.current = onMapLoadFailure;
  }, [onMapLoadFailure]);

  useEffect(() => {
    initialCenterRef.current = initialCenter;
  }, [initialCenter]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    conditionsCtxRef.current = {
      beaches: beaches ?? swellFieldBeaches,
      partitionsMap,
      partitionsTimelineMap,
      timelineIndex: swellTimelineIndex,
      stepsLen: swellTimelineSteps.length,
      bounds: mapBounds || { west: -118, south: 32, east: -117, north: 33 },
      waterTempMap,
    };
  }, [beaches, swellFieldBeaches, partitionsMap, partitionsTimelineMap, swellTimelineIndex, swellTimelineSteps.length, mapBounds, waterTempMap]);

  useEffect(() => {
    beachesRef.current = markerBeaches;
  }, [markerBeaches]);

  // Use clustering hook
  const { clusters, getExpansionZoom } = useBeachClustering({
    beaches: markerBeaches,
    waveHeights: waveHeightMap,
    bounds: mapBounds || { west: -118, south: 32, east: -117, north: 33 },
    zoom: currentZoom,
    favoriteBeachIds,
    disableClustering: disableBeachClustering,
  });

  // Mirror the latest cluster output so instrumentation can read counts
  // synchronously inside debounced handlers and marker callbacks.
  useEffect(() => {
    clustersRef.current = clusters;
  }, [clusters]);

  // Create cached fetch functions for map APIs
  const fetchNearbyBeaches = useRef(
    createCachedMapFetch<Beach[]>(
      "/api/beaches/nearby",
      CACHE_TTL.MAP_NEARBY_BEACHES
    )
  );

  const clearBeachPreviewCloseTimer = useCallback((): void => {
    if (!beachPreviewCloseTimerRef.current) return;
    clearTimeout(beachPreviewCloseTimerRef.current);
    beachPreviewCloseTimerRef.current = null;
  }, []);

  const closeBeachPreviewPopup = useCallback((): void => {
    clearBeachPreviewCloseTimer();
    activeBeachPreviewPopupRef.current?.remove();
    activeBeachPreviewPopupRef.current = null;
  }, [clearBeachPreviewCloseTimer]);

  const removeActiveCallout = useCallback((): void => {
    activeCalloutRef.current?.marker.remove();
    activeCalloutRef.current = null;
  }, []);

  const showCalloutForBeach = useCallback((beach: Beach): void => {
    const map = mapRef.current;
    if (!map) return;
    const ctx = conditionsCtxRef.current;
    const clampedIndex = Math.min(Math.max(ctx.timelineIndex, 0), Math.max(0, ctx.stepsLen - 1));
    const partition = partitionAtTimelinePosition(beach.id, clampedIndex, ctx.partitionsTimelineMap, ctx.partitionsMap);
    const components = partition ? resolveCalloutComponents(partition) : [];
    const tempLabel = formatTempLabel(ctx.waterTempMap.get(beach.id));
    const beachHref = getBeachHrefSafe(beach) ?? undefined;
    const { element } = createConditionsCalloutElement({
      beachName: beach.name,
      tempLabel,
      components,
      beachHref,
    });
    element.addEventListener("click", () => removeActiveCallout());
    removeActiveCallout();
    const marker = new mapboxgl.Marker({ element, anchor: "center" }).setLngLat([beach.lon!, beach.lat!]).addTo(map);
    // Mapbox stamps a generic "Map marker" aria-label; replace it with the real
    // conditions so screen readers get the same info the arrows convey visually.
    const conditionsRead =
      components.map((c) => `${c.name} ${c.label}`).join("; ") || "no current reading";
    element.setAttribute(
      "aria-label",
      `${beach.name}${tempLabel ? `, ${tempLabel}` : ""} surf conditions: ${conditionsRead}`
    );
    activeCalloutRef.current = { marker, beachId: beach.id };
  }, [removeActiveCallout]);

  const handleConditionsTap = useCallback((lngLat: mapboxgl.LngLat): void => {
    const ctx = conditionsCtxRef.current;
    const nearest = nearestBeachInBounds(lngLat.lng, lngLat.lat, ctx.beaches, ctx.bounds);
    if (!nearest) return;
    const action = decideCalloutAction(activeCalloutRef.current?.beachId ?? null, nearest.id);
    if (action === "toggle-off") {
      removeActiveCallout();
      return;
    }
    showCalloutForBeach(nearest);
  }, [removeActiveCallout, showCalloutForBeach]);

  const handleConditionsTapRef = useRef(handleConditionsTap);
  useEffect(() => { handleConditionsTapRef.current = handleConditionsTap; }, [handleConditionsTap]);

  const scheduleBeachPreviewClose = useCallback((): void => {
    clearBeachPreviewCloseTimer();
    beachPreviewCloseTimerRef.current = setTimeout(() => {
      closeBeachPreviewPopup();
    }, 120);
  }, [clearBeachPreviewCloseTimer, closeBeachPreviewPopup]);

  const openBeachPreviewPopup = useCallback(
    (
      location: Beach,
      lngLat: [number, number],
      preview: MarkerPreviewData
    ): void => {
      const map = mapRef.current;
      if (!map) return;

      clearBeachPreviewCloseTimer();
      activeBeachPreviewPopupRef.current?.remove();

      const content = createBeachPreviewPopupContent({
        location,
        waveLabel: preview.waveLabel,
        conditionSummary: preview.conditionSummary,
        conditionScore: preview.conditionScore,
        partition: partitionsMapRef.current.get(location.id),
      });
      content.addEventListener("mouseenter", clearBeachPreviewCloseTimer);
      content.addEventListener("mouseleave", scheduleBeachPreviewClose);

      const canHover =
        typeof window !== "undefined" &&
        window.matchMedia("(hover: hover)").matches;
      const popup = new mapboxgl.Popup({
        closeButton: !canHover,
        closeOnClick: true,
        closeOnMove: false,
        className: "quiver-map-beach-preview-popup",
        maxWidth: "240px",
        offset: 18,
      })
        .setLngLat(lngLat)
        .setDOMContent(content)
        .addTo(map);

      activeBeachPreviewPopupRef.current = popup;
    },
    [clearBeachPreviewCloseTimer, scheduleBeachPreviewClose]
  );

  // Helper: remove all markers
  const cleanupMarkers = useCallback(() => {
    closeBeachPreviewPopup();

    // Clean up cluster event listeners
    clusterCleanupRef.current.forEach((cleanup) => cleanup());
    clusterCleanupRef.current.clear();
    activeClusterPopupRef.current?.remove();
    activeClusterPopupRef.current = null;

    // Remove all markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};
  }, [closeBeachPreviewPopup]);

  // Helper: full cleanup
  const cleanupMap = useCallback(() => {
    cleanupMarkers();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    lastPopulateKeyRef.current = null;
    selectedBeachIdRef.current = null;
    hoveredBeachIdRef.current = null;
    favoriteBeachIdsRef.current = new Set();
    isMapReadyRef.current = false;
    setIsMapReady(false);
  }, [cleanupMarkers]);

  // Helper to check if viewport has significantly changed
  const hasViewportChanged = useCallback(
    (lat: number, lng: number, zoom: number): boolean => {
      return checkViewportChanged({ lat, lng, zoom }, lastViewportRef.current);
    },
    []
  );

  // Load user's favorite beaches (delegated to pure module)
  const loadFavorites = useCallback(async () => {
    const ids = await loadFavoriteBeaches(userId);
    setFavoriteBeachIds(ids);
  }, [userId]);

  // Load favorites when user changes
  useEffect(() => {
    if (userId) {
      loadFavorites();
    } else {
      setFavoriteBeachIds(new Set());
    }
  }, [userId, loadFavorites]);

  // Ensure access token
  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }, []);

  // Capture current viewport (center + bounds + visible counts) for
  // map_interaction metadata. Returns empty object when map ref is not yet
  // ready, so callers can spread safely.
  const getMapViewportMetadata = useCallback((): {
    latitude: number;
    longitude: number;
    bounds_west?: number;
    bounds_south?: number;
    bounds_east?: number;
    bounds_north?: number;
    beaches_in_viewport?: number;
    visible_cluster_count?: number;
  } | Record<string, never> => {
    const map = mapRef.current;
    if (!map) return {};
    const center = map.getCenter();
    const bounds = map.getBounds();
    const meta: {
      latitude: number;
      longitude: number;
      bounds_west?: number;
      bounds_south?: number;
      bounds_east?: number;
      bounds_north?: number;
      beaches_in_viewport?: number;
      visible_cluster_count?: number;
    } = {
      // 2 decimals (~1.1km) deliberately defeats home-address inference from
      // accumulated center points. Bounds retain 4-decimal precision below
      // because viewport shape is less personally identifying than the
      // exact point a user centers on.
      latitude: Number(center.lat.toFixed(2)),
      longitude: Number(center.lng.toFixed(2)),
    };
    if (bounds) {
      meta.bounds_west = Number(bounds.getWest().toFixed(4));
      meta.bounds_south = Number(bounds.getSouth().toFixed(4));
      meta.bounds_east = Number(bounds.getEast().toFixed(4));
      meta.bounds_north = Number(bounds.getNorth().toFixed(4));
    }
    // Derive visible counts from the latest clustering output. `clusters`
    // already reflects current bounds + zoom, so individual-beach entries
    // are the in-viewport beaches and cluster entries contribute both to
    // the visible cluster count and (via point_count) to beaches_in_viewport.
    const currentClusters = clustersRef.current;
    if (currentClusters && currentClusters.length > 0) {
      let clusterCount = 0;
      let beachCount = 0;
      for (const c of currentClusters) {
        if (c.isCluster) {
          clusterCount += 1;
          beachCount += c.pointCount ?? 0;
        } else {
          beachCount += 1;
        }
      }
      meta.visible_cluster_count = clusterCount;
      meta.beaches_in_viewport = beachCount;
    } else if (bounds && beachesRef.current) {
      // Fallback: clustering hasn't run yet (e.g., first pin_click before
      // the first moveend) — filter beaches by bounds directly.
      const west = bounds.getWest();
      const east = bounds.getEast();
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      let beachCount = 0;
      for (const b of beachesRef.current) {
        const lat = b.lat;
        const lng = b.lon;
        if (lat == null || lng == null) continue;
        if (lat >= south && lat <= north && lng >= west && lng <= east) {
          beachCount += 1;
        }
      }
      meta.beaches_in_viewport = beachCount;
      meta.visible_cluster_count = 0;
    }
    return meta;
  }, []);

  // Create wave height badge using extracted module with deps from refs
  const buildWaveHeightBadge = useCallback(
    (
      location: Beach,
      waveHeight: number | string | undefined,
      previewLngLat: [number, number]
    ): HTMLElement => {
      const deps: MarkerBuilderDeps = {
        favoriteBeachIds: favoriteBeachIdsRef.current,
        selectedBeachId: selectedBeachIdRef.current,
        hoveredBeachId: hoveredBeachIdRef.current,
        onHoverChange: setHoveredBeachId,
        onSelectChange: setSelectedBeachId,
        onLocationClick: (beach: Beach) => {
          track('map_interaction', {
            beachId: beach.id,
            metadata: {
              action: 'pin_click',
              ...getMapViewportMetadata(),
            },
            debounceMs: 500,
          });
          // When the conditions callout is enabled (embed), tapping a pin opens
          // the merged arrows + info view for that beach instead of navigating —
          // same toggle behavior as a water tap. The callout's "Full forecast"
          // link is the path to the full page.
          if (showConditionsOnTap) {
            if (decideCalloutAction(activeCalloutRef.current?.beachId ?? null, beach.id) === "toggle-off") {
              removeActiveCallout();
              return;
            }
            showCalloutForBeach(beach);
            return;
          }
          removeActiveCallout();
          onLocationClick?.(beach);
        },
        router,
        autoNavigate: autoNavigateOnMarkerClick,
        displayMode,
        markerDisplay,
        waterTemp: waterTempMap.get(location.id),
        waveHeightLabel: displayForecastMap.get(location.id)?.label ?? null,
        conditionScore: conditionScoreMap.get(location.id),
        conditionSummary: conditionSummaryMap.get(location.id),
        previewLngLat,
        onPreviewOpen: openBeachPreviewPopup,
        onPreviewHold: clearBeachPreviewCloseTimer,
        onPreviewClose: scheduleBeachPreviewClose,
      };
      return createWaveHeightBadge(location, waveHeight, deps);
    },
    [
      onLocationClick,
      removeActiveCallout,
      showConditionsOnTap,
      showCalloutForBeach,
      router,
      autoNavigateOnMarkerClick,
      track,
      displayMode,
      waterTempMap,
      displayForecastMap,
      conditionScoreMap,
      conditionSummaryMap,
      markerDisplay,
      getMapViewportMetadata,
      openBeachPreviewPopup,
      clearBeachPreviewCloseTimer,
      scheduleBeachPreviewClose,
    ]
  );

  const openClusterDetailsPopup = useCallback(
    (cluster: ClusterPoint): void => {
      const map = mapRef.current;
      const allBeaches = beachesRef.current ?? [];
      const clusterBeaches = getClusterPopupBeaches(cluster, allBeaches);
      if (!map || !clusterBeaches.length) return;

      activeClusterPopupRef.current?.remove();

      const content = createClusterPopupContent({
        cluster,
        beaches: clusterBeaches,
        waveHeightMap,
        displayForecastMap,
        waterTempMap,
        displayMode,
      });

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        closeOnMove: false,
        className: "quiver-map-cluster-popup",
        maxWidth: "320px",
        offset: 18,
      })
        .setLngLat([cluster.longitude, cluster.latitude])
        .setDOMContent(content)
        .addTo(map);

      activeClusterPopupRef.current = popup;
    },
    [displayMode, displayForecastMap, waterTempMap, waveHeightMap]
  );

  // Create cluster marker using extracted module with deps from refs
  const buildClusterMarker = useCallback(
    (cluster: ClusterPoint): mapboxgl.Marker => {
      const deps: ClusterRendererDeps = {
        favoriteBeachIds: favoriteBeachIdsRef.current,
        clusterCleanupMap: clusterCleanupRef.current,
        getExpansionZoom,
        getMaxZoom: () => mapRef.current?.getMaxZoom() ?? Infinity,
        flyTo: (center, zoom) => {
          mapRef.current?.flyTo({ center, zoom, duration: 500 });
        },
        displayMode,
        waterTempMap,
        markerDisplay,
        clusterClickBehavior,
        onClusterClick: openClusterDetailsPopup,
      };
      return createClusterMapMarker(cluster, deps);
    },
    [
      getExpansionZoom,
      displayMode,
      waterTempMap,
      markerDisplay,
      clusterClickBehavior,
      openClusterDetailsPopup,
    ]
  );

  /** Populate beach markers with enhanced forecast data */
  const populateLocations = useCallback(
    async (latitude: number, longitude: number) => {
      const map = mapRef.current;
      if (!map || !isMapReadyRef.current) return;
      const zoom = map.getZoom();
      // Include beaches state in cache key: undefined vs empty array vs populated array
      const beachesKey = beaches === undefined ? "none" : `${beaches.length}`;
      const populateKey = `${latitude.toFixed(4)}-${longitude.toFixed(
        4
      )}-${zoom.toFixed(2)}-${beachesKey}`;

      if (lastPopulateKeyRef.current === populateKey) {
        return;
      }

      lastPopulateKeyRef.current = populateKey;
      try {
        // Clean up existing markers when provided beaches change
        if (beaches && beaches.length > 0) {
          cleanupMarkers();
        }

        const result = await loadBeachesAndWaveHeights(
          latitude,
          longitude,
          beaches,
          { fetchNearbyBeaches: fetchNearbyBeaches.current }
        );

        // Store wave heights and water temps for clustering
        setWaveHeightMap(result.waveHeightMap);
        setDisplayForecastMap(result.displayForecastMap);
        setWaterTempMap(result.waterTempMap);
        setConditionScoreMap(result.conditionScoreMap);
        setConditionSummaryMap(result.conditionSummaryMap);
        setPartitionsMap(result.partitionsMap);
        setPartitionsTimelineMap(result.partitionsTimelineMap);
        setSwellFieldBeaches(result.locations);
        onWaveHeightsChangeRef.current?.(result.waveHeightMap);
        onDisplayForecastsChangeRef.current?.(result.displayForecastMap);
      } catch (e) {
        lastPopulateKeyRef.current = null;
        console.error("Error populating locations", e);
      }
    },
    [beaches, cleanupMarkers]
  );

  useEffect(() => {
    populateLocationsRef.current = populateLocations;
  }, [populateLocations]);

  useEffect(() => {
    swellLayerIdRef.current = swellLayerId;
  }, [swellLayerId]);

  // Mask the live swell flow fields to water IN PLACE. Native lets wind advect
  // across the viewport, so only swell components are maskable. Robust against the
  // timing pitfall that blanked an earlier attempt: only
  // zeroes in-viewport cells that miss the basemap water layer, never touches
  // off-screen cells, treats a throw as water, and no-ops when no water layers are
  // detected.
  const applyWaterMask = useCallback((map: mapboxgl.Map): void => {
    const components = componentsForLayer(swellLayerIdRef.current);
    const maskable = waterMaskableFlowComponents(components);
    if (maskable.length === 0) return;
    let waterLayerIds: string[] = [];
    try {
      const style = map.getStyle();
      waterLayerIds = detectWaterLayerIds(style?.layers ?? []);
    } catch {
      return; // can't read the style yet → leave the field intact
    }
    if (waterLayerIds.length === 0) return;
    const canvas = map.getCanvas();
    for (const component of maskable) {
      const field = flowFieldsRef.current[component];
      if (field.cells.length === 0) continue;
      maskFieldToWater(
        field,
        map as unknown as Parameters<typeof maskFieldToWater>[1],
        {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          waterLayerIds,
        }
      );
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const resetFields = (): void => {
      flowFieldsRef.current = {
        s1: EMPTY_FLOW_FIELD,
        s2: EMPTY_FLOW_FIELD,
        wind: EMPTY_FLOW_FIELD,
      };
    };
    if (!map || !isMapReady || !showSwellField) {
      resetFields();
      // Field is off → reset to the optimistic default so the empty-state note
      // never lingers after toggling the field back on.
      setHasSwellData(true);
      return;
    }
    const b = map.getBounds();
    if (!b) {
      resetFields();
      setHasSwellData(true);
      return;
    }
    const bounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };
    const beachList =
      swellFieldBeaches.length > 0 ? swellFieldBeaches : (beaches ?? []);
    const components = componentsForLayer(swellLayerId);
    const timelinePosition = Math.min(
      Math.max(Number.isFinite(swellTimelineIndex) ? swellTimelineIndex : 0, 0),
      Math.max(0, swellTimelineSteps.length - 1)
    );
    // Build a flow field per active component (one for a single layer, three for
    // combined); leave the rest empty so stale fields never render.
    const nextFields: Record<"s1" | "s2" | "wind", FlowField> = {
      s1: EMPTY_FLOW_FIELD,
      s2: EMPTY_FLOW_FIELD,
      wind: EMPTY_FLOW_FIELD,
    };
    let anyPoints = false;
    for (const component of components) {
      const points: BeachPartitionPoint[] = [];
      for (const beach of beachList) {
        const partition = partitionAtTimelinePosition(
          beach.id,
          timelinePosition,
          partitionsTimelineMap,
          partitionsMap
        );
        if (!partition || beach.lat == null || beach.lon == null) continue;
        const point = partitionToPoint(beach.lon, beach.lat, partition, component);
        if (point) points.push(point);
      }
      if (points.length > 0) anyPoints = true;
      // A regional swell layer should move in UNISON (one direction), but per-beach
      // readings vary ~45° (e.g. SD primary is SW/SSW/WSW), which would fan the marks
      // out. Collapse to the circular-mean direction so every mark shares one heading;
      // per-beach period/height still vary (so speed/density read locally).
      if (points.length > 0) {
        let sumX = 0;
        let sumY = 0;
        for (const p of points) {
          const rad = (p.dir * Math.PI) / 180;
          sumX += Math.cos(rad);
          sumY += Math.sin(rad);
        }
        const meanDeg = ((Math.atan2(sumY, sumX) * 180) / Math.PI + 360) % 360;
        for (const p of points) p.dir = meanDeg;
      }
      nextFields[component] = buildFlowField(points, bounds, 12);
    }
    flowFieldsRef.current = nextFields;
    setHasSwellData(anyPoints);
    // Best-effort mask now; the idle/moveend listener re-masks once tiles render.
    applyWaterMask(map);
    // Nudge a repaint so a static (reduced-motion) frame reflects the new field.
    map.triggerRepaint();
  }, [partitionsMap, partitionsTimelineMap, swellFieldBeaches, swellLayerId, swellTimelineIndex, swellTimelineSteps.length, isMapReady, showSwellField, beaches, mapBounds, applyWaterMask]);

  // Re-mask the field to water once the map has actually rendered tiles. Running on
  // `idle` (fired after tiles finish loading) and `moveend` is what makes the mask
  // robust — querying rendered features before tiles paint returns nothing and would
  // blank the field. Re-masks the existing field in place (cheap) and repaints.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !showSwellField) return;
    const remask = (): void => {
      applyWaterMask(map);
      map.triggerRepaint();
    };
    map.on("idle", remask);
    map.on("moveend", remask);
    return () => {
      map.off("idle", remask);
      map.off("moveend", remask);
    };
  }, [isMapReady, showSwellField, applyWaterMask]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !showConditionsOnTap) return;
    const onTap = (e: mapboxgl.MapMouseEvent) => handleConditionsTapRef.current(e.lngLat);
    map.on("click", onTap);
    return () => {
      map.off("click", onTap);
      removeActiveCallout();
    };
  }, [isMapReady, showConditionsOnTap, removeActiveCallout]);

  useEffect(() => {
    const open = activeCalloutRef.current;
    if (!open) return;
    const ctx = conditionsCtxRef.current;
    const beach = ctx.beaches.find((b) => b.id === open.beachId);
    if (beach) showCalloutForBeach(beach);
  }, [swellTimelineIndex, partitionsMap, showCalloutForBeach]);

  const releaseSwellFieldLeash = useCallback((map: mapboxgl.Map): void => {
    const captured = zoomLimitsCaptureRef.current;
    // Nothing was ever leashed — leave the free camera untouched.
    if (!captured) return;
    // Runtime accepts null to clear; the public typings only expose the setter.
    map.setMaxBounds(null as unknown as mapboxgl.LngLatBoundsLike);
    map.setMinZoom(captured.minZoom);
    map.setMaxZoom(captured.maxZoom);
    zoomLimitsCaptureRef.current = null;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) {
      return;
    }

    // Every swell GL layer id this component can mount: the single-layer id plus the
    // three combined sub-layer ids. Removing the full set before (re)adding the active
    // set guarantees no layer leaks when switching between combined and a single layer.
    const allLayerIds = [
      SWELL_FIELD_LAYER_ID,
      ...COMBINED_SUBLAYERS.map((c) => `${SWELL_FIELD_LAYER_ID}-${c}`),
    ];
    const teardown = (): void => {
      for (const id of allLayerIds) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
    };

    teardown();
    if (!showSwellField) return;

    const viewportWidthPx =
      typeof window !== "undefined" ? window.innerWidth : 1024;
    const baseParticleCount = resolveParticleCount(viewportWidthPx);

    if (swellLayerId === "combined") {
      // Overlay the three components, each its own colored layer + flow field. Cap
      // per-layer particle count so three stacked layers stay in budget.
      for (const component of COMBINED_SUBLAYERS) {
        map.addLayer(
          createSwellParticleLayer({
            id: `${SWELL_FIELD_LAYER_ID}-${component}`,
            getField: () => flowFieldsRef.current[component],
            getColorHex: () => SWELL_FIELD_PARTICLE_COLOR[component],
            reducedMotion,
            viewportWidthPx,
            count:
              component === "wind"
                ? Math.round(COMBINED_PARTICLE_COUNT * WIND_PARTICLE_SCALE)
                : COMBINED_PARTICLE_COUNT,
            markStyle: component === "wind" ? "streak" : "dash",
            motionScale: PARTICLE_MOTION_SCALE[component],
            velocitySmoothing: PARTICLE_VELOCITY_SMOOTHING[component],
            dashLengthScale: PARTICLE_DASH_LENGTH_SCALE[component],
          })
        );
      }
    } else {
      // Single active layer. getField/getColorHex read refs each frame so a timeline
      // scrub or layer recolor applies without re-adding the layer.
      const activeComponent = swellLayerId;
      map.addLayer(
        createSwellParticleLayer({
          id: SWELL_FIELD_LAYER_ID,
          getField: () => flowFieldsRef.current[activeComponent],
          getColorHex: () => SWELL_FIELD_PARTICLE_COLOR[swellLayerIdRef.current],
          reducedMotion,
          viewportWidthPx,
          count:
            activeComponent === "wind"
              ? Math.round(baseParticleCount * WIND_PARTICLE_SCALE)
              : undefined,
          markStyle: activeComponent === "wind" ? "streak" : "dash",
          motionScale: PARTICLE_MOTION_SCALE[activeComponent],
          velocitySmoothing: PARTICLE_VELOCITY_SMOOTHING[activeComponent],
          dashLengthScale: PARTICLE_DASH_LENGTH_SCALE[activeComponent],
        })
      );
    }

    return teardown;
    // Re-add when toggled, the active layer changes (the layer SET differs between
    // combined and single), motion preference flips, or the map (re)mounts.
  }, [showSwellField, isMapReady, reducedMotion, swellLayerId]);

  // Leash the camera to the coastal data corridor while the swell field is ON.
  // Locks zoom (so users can't pull back to open-ocean/continent scale) and pins
  // a dynamic maxBounds to the loaded-beach footprint. Recomputes as beaches load
  // so the reachable corridor extends along the coast (along-coast travel chains:
  // the generous lat padding lets the next stretch enter the viewport and load,
  // which widens the bbox on the next pass). Fully restores the free camera on OFF.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Wait until beaches load before constraining; never leash an empty footprint.
    if (!showSwellField || swellFieldBeaches.length === 0) {
      releaseSwellFieldLeash(map);
      return;
    }

    const bounds = computeCoastalBounds(swellFieldBeaches);
    if (!bounds) {
      releaseSwellFieldLeash(map);
      return;
    }

    // Capture the free-camera zoom limits once, before the first lock. Presence of
    // this capture also marks the leash as applied (gates the release path).
    if (!zoomLimitsCaptureRef.current) {
      zoomLimitsCaptureRef.current = {
        minZoom: map.getMinZoom(),
        maxZoom: map.getMaxZoom(),
      };
      // First time the leash locks this mount → flash the one-time zoom hint.
      if (!leashHintShownRef.current) {
        leashHintShownRef.current = true;
        setShowLeashHint(true);
      }
    }
    map.setMinZoom(SWELL_FIELD_MIN_ZOOM);
    map.setMaxZoom(SWELL_FIELD_MAX_ZOOM);
    map.setMaxBounds([
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ]);

    return () => releaseSwellFieldLeash(map);
  }, [showSwellField, isMapReady, swellFieldBeaches, releaseSwellFieldLeash]);

  // Auto-dismiss the one-time coastal-leash hint ~4s after it appears. With
  // motion, kick a CSS opacity fade ~500ms before unmount; under reduced motion
  // just remove it (no fade), honoring prefers-reduced-motion.
  useEffect(() => {
    if (!showLeashHint) return;
    if (reducedMotion) {
      const remove = setTimeout(() => setShowLeashHint(false), 4000);
      return () => clearTimeout(remove);
    }
    const fade = setTimeout(() => setLeashHintFading(true), 3500);
    const remove = setTimeout(() => {
      setShowLeashHint(false);
      setLeashHintFading(false);
    }, 4000);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [showLeashHint, reducedMotion]);

  // Stable ref to track so the debounced handler can always access the latest version
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Optimized and debounced map move handler with viewport change detection
  const handleMoveEnd = useMemo(
    () =>
      debounce(async () => {
        if (!mapRef.current) return;
        const center = mapRef.current.getCenter();
        const zoom = mapRef.current.getZoom();
        const bounds = mapRef.current.getBounds();

        // Update bounds and zoom for clustering
        if (bounds) {
          const boundsObj = {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          };
          setMapBounds(boundsObj);
          onBoundsChangeRef.current?.(boundsObj);
        }
        setCurrentZoom(zoom);

        // Classify interaction: compare against previously tracked center/zoom.
        // Zoom dominates — pinch-zoom can also pan, but we only want to count
        // it once and zoom is the more informative signal.
        const prevZoom = prevZoomRef.current;
        const prevCenter = prevCenterRef.current;
        // First idle after mount has no prior tracked state — seed the refs
        // and skip emission so we don't fire a spurious zoom event for a
        // viewport the user never actually moved.
        const isInitialIdle = prevZoom == null && prevCenter == null;
        const ZOOM_EPS = 0.01;
        const CENTER_EPS = 0.0001; // ~11m at the equator
        const zoomChanged =
          !isInitialIdle && Math.abs(zoom - (prevZoom as number)) > ZOOM_EPS;
        const centerChanged =
          !isInitialIdle &&
          prevCenter != null &&
          (Math.abs(center.lat - prevCenter.lat) > CENTER_EPS ||
            Math.abs(center.lng - prevCenter.lng) > CENTER_EPS);
        const action: 'zoom' | 'pan' | null = zoomChanged
          ? 'zoom'
          : centerChanged
            ? 'pan'
            : null;
        prevZoomRef.current = zoom;
        prevCenterRef.current = { lat: center.lat, lng: center.lng };

        // Track zoom/pan (include viewport center, bounds, and visible counts
        // for geographic cohort analysis). Skip if nothing meaningful changed
        // (e.g., first idle after mount with no movement).
        if (action) {
          trackRef.current('map_interaction', {
            metadata: {
              action,
              zoom_level: Math.round(zoom),
              ...getMapViewportMetadata(),
            },
            debounceMs: 3000,
          });
        }

        // Emit empty_state_shown when user has zoomed in past the threshold
        // and the current viewport contains zero beaches. Dedupe on a rounded
        // viewport key so we don't fire repeatedly for tiny nudges. Skip on
        // the first idle so we don't fire for a viewport the user hasn't
        // actually engaged with yet.
        const currentBeaches = beachesRef.current;
        if (!isInitialIdle && currentBeaches !== undefined && zoom >= 9) {
          const meta = getMapViewportMetadata();
          const beachesInViewport =
            'beaches_in_viewport' in meta ? meta.beaches_in_viewport : undefined;
          if (beachesInViewport === 0) {
            const key = `${center.lat.toFixed(2)}:${center.lng.toFixed(2)}:${Math.round(zoom)}`;
            if (lastEmptyStateKeyRef.current !== key) {
              lastEmptyStateKeyRef.current = key;
              trackRef.current('empty_state_shown', {
                metadata: {
                  surface: 'map_no_beaches_in_viewport',
                },
              });
            }
          } else {
            // Non-empty viewport — reset so the next empty viewport fires.
            lastEmptyStateKeyRef.current = null;
          }
        }

        // Only fetch if viewport has significantly changed
        if (!hasViewportChanged(center.lat, center.lng, zoom)) {
          return;
        }
        lastViewportRef.current = { lat: center.lat, lng: center.lng, zoom };

        // Only populate locations with enhanced forecast data
        await populateLocations(center.lat, center.lng);
      }, 1500), // Increased debounce time since we're caching aggressively
    [populateLocations, hasViewportChanged, getMapViewportMetadata]
  );

  useEffect(() => {
    handleMoveEndRef.current = handleMoveEnd;
  }, [handleMoveEnd]);

  // Initialize map — runs once. Uses refs for values that change over time
  // so the effect never re-fires and the map is never destroyed/recreated.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Capture mount timestamp for load_time_ms / time_to_failure_ms metadata.
    mountedAtRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;
    hasEmittedReadyRef.current = false;
    emittedFailureTypesRef.current = new Set();

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [initialCenterRef.current[1], initialCenterRef.current[0]], // lng, lat
      zoom: initialZoom,
      attributionControl: false,
      logoPosition: "top-left",
    });
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "top-right"
    );

    mapRef.current = map;

    map.on("load", async () => {
      // Emit map_ready exactly once per mount.
      if (!hasEmittedReadyRef.current) {
        hasEmittedReadyRef.current = true;
        const loadTimeMs =
          typeof performance !== "undefined"
            ? Math.round(performance.now() - mountedAtRef.current)
            : 0;
        trackRef.current('map_ready', {
          metadata: {
            load_time_ms: loadTimeMs,
          },
        });
      }
      setIsMapReady(true);
      onMapReadyRef.current?.();
      // Expose map instance in dev and Playwright builds for E2E map assertions.
      if (
        process.env.NODE_ENV !== "production" ||
        process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === "true"
      ) {
        (window as any).__quiverMapInstance = mapRef.current;
      }
      // Initialize bounds for clustering
      const bounds = map.getBounds();
      if (bounds) {
        const boundsObj = {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        };
        setMapBounds(boundsObj);
        onBoundsChangeRef.current?.(boundsObj);
      }
      setCurrentZoom(map.getZoom());
    });

    map.on("error", (e) => {
      console.error("Map error:", e);

      // Classify the error into a coarse category. We intentionally do NOT
      // forward the raw message (PII + payload bloat) — only the bucket.
      // Mapbox's error event exposes `error` (Error) and optionally
      // `sourceId`/`tile`, so we inspect the Error to decide.
      const err: unknown = (e as { error?: unknown })?.error;
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : '';
      const lower = message.toLowerCase();

      let errorType:
        | 'token_invalid'
        | 'network'
        | 'webgl_unsupported'
        | 'tile_error'
        | 'unknown' = 'unknown';
      if (
        lower.includes('access token') ||
        lower.includes('accesstoken') ||
        lower.includes('unauthorized') ||
        lower.includes('401')
      ) {
        errorType = 'token_invalid';
      } else if (lower.includes('webgl')) {
        errorType = 'webgl_unsupported';
      } else if (
        // Mapbox signals tile failures via a `tile` or `source` field on the
        // event — plus the message often mentions tile/source/sprite/glyph.
        (e as { tile?: unknown })?.tile !== undefined ||
        (e as { sourceId?: unknown })?.sourceId !== undefined ||
        lower.includes('tile') ||
        lower.includes('sprite') ||
        lower.includes('glyph')
      ) {
        errorType = 'tile_error';
      } else if (
        lower.includes('network') ||
        lower.includes('fetch') ||
        lower.includes('cors') ||
        lower.includes('failed to load') ||
        lower.includes('load failed')
      ) {
        errorType = 'network';
      }

      // Dedupe: one emission per category per mount.
      if (emittedFailureTypesRef.current.has(errorType)) return;
      emittedFailureTypesRef.current.add(errorType);

      const timeToFailureMs =
        typeof performance !== "undefined"
          ? Math.round(performance.now() - mountedAtRef.current)
          : undefined;

      trackRef.current('map_load_failed', {
        metadata: {
          error_type: errorType,
          ...(timeToFailureMs !== undefined
            ? { time_to_failure_ms: timeToFailureMs }
            : {}),
        },
      });
      onMapLoadFailureRef.current?.(errorType);
    });

    // Stable wrapper — delegates to the latest debounced handler via ref
    const moveEndHandler = () => handleMoveEndRef.current?.();
    map.on("moveend", moveEndHandler);

    // Map click — delegates to the latest onMapClick via ref
    map.on("click", (e) => {
      onMapClickRef.current?.(e.lngLat);
    });

    return () => {
      map.off("moveend", moveEndHandler);
      (handleMoveEndRef.current as any)?.cancel?.();
      cleanupMap();
    };
  }, [initialZoom, cleanupMap]);

  // Initial population when map becomes ready
  useEffect(() => {
    if (isMapReady && mapRef.current) {
      const center = mapRef.current.getCenter();
      populateLocations(center.lat, center.lng);
    }
  }, [isMapReady, populateLocations]);

  // Apply region viewport focus when provided
  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    if (!regionViewport) {
      lastRegionViewportKeyRef.current = null;
      return;
    }

    if (lastRegionViewportKeyRef.current === regionViewport.key) {
      return;
    }

    const map = mapRef.current;

    if (regionViewport.bounds) {
      map.fitBounds(regionViewport.bounds, {
        padding: 48,
        animate: true,
        maxZoom: regionViewport.zoom ?? 13,
      });
    } else {
      map.easeTo({
        center: [regionViewport.center[1], regionViewport.center[0]],
        zoom: regionViewport.zoom ?? Math.min(map.getZoom(), 13),
        duration: 800,
      });
    }

    lastRegionViewportKeyRef.current = regionViewport.key;
  }, [regionViewport, isMapReady]);

  // Update markers when selection state changes
  useEffect(() => {
    if (!isMapReady) return;

    // Update all markers to reflect current selection state
    Object.entries(markersRef.current).forEach(([markerId, marker]) => {
      if (typeof marker.getElement !== "function") return;
      const beachId = markerId.replace("location-", "");
      const element = marker.getElement();
      const badge = element.querySelector("[data-marker-badge='true']");
      const existingRing = element.querySelector(
        '[data-testid="selection-ring"]'
      );

      if (selectedBeachId === beachId) {
        // Add selection ring if not present
        if (!existingRing && badge) {
          const selectionRing = document.createElement("div");
          selectionRing.setAttribute("data-testid", "selection-ring");
          selectionRing.style.cssText = `
            position: absolute;
            top: -8px;
            left: -8px;
            right: -8px;
            bottom: -8px;
            border: 3px solid #F78E42;
            border-radius: 50%;
            pointer-events: none;
            animation: pulse 2s infinite;
          `;
          element.appendChild(selectionRing);
        }

        // Update badge scale and background
        if (badge) {
          const gradient =
            displayMode === "water-temp"
              ? getWaterTempBadgeColor(waterTempMap.get(beachId))
              : getConditionMarkerGradient(
                  conditionSummaryMap.get(beachId) ?? "UNKNOWN"
                );
          (badge as HTMLElement).style.transform = "scale(1.4)";
          (badge as HTMLElement).style.background = gradient;
          badge.setAttribute("data-marker-gradient", gradient);
        }
      } else {
        // Remove selection ring if present
        if (existingRing) {
          existingRing.remove();
        }

        // Reset badge scale and background
        if (badge) {
          const isHovered = hoveredBeachId === beachId;
          (badge as HTMLElement).style.transform = isHovered
            ? "scale(1.2)"
            : "scale(1)";

          const gradient =
            displayMode === "water-temp"
              ? getWaterTempBadgeColor(waterTempMap.get(beachId))
              : getConditionMarkerGradient(
                  conditionSummaryMap.get(beachId) ?? "UNKNOWN"
                );
          (badge as HTMLElement).style.background = gradient;
          badge.setAttribute("data-marker-gradient", gradient);
        }
      }
    });
  }, [
    selectedBeachId,
    hoveredBeachId,
    favoriteBeachIds,
    isMapReady,
    displayMode,
    waterTempMap,
    conditionSummaryMap,
  ]);

  // Update map center when initialCenter prop changes
  useEffect(() => {
    if (isMapReady && mapRef.current && initialCenter) {
      const currentCenter = mapRef.current.getCenter();
      const [newLat, newLng] = initialCenter;

      // Only update if the center has actually changed significantly (avoid unnecessary updates)
      const threshold = 0.001; // ~100 meters
      const latDiff = Math.abs(currentCenter.lat - newLat);
      const lngDiff = Math.abs(currentCenter.lng - newLng);

      if (latDiff > threshold || lngDiff > threshold) {
        const map = mapRef.current;
        releaseSwellFieldLeash(map);
        map.flyTo({
          center: [newLng, newLat],
          zoom: map.getZoom(),
          duration: 1000,
        });

        // Also populate locations for the new center
        populateLocationsRef.current?.(newLat, newLng);
      }
    }
  }, [isMapReady, initialCenter, releaseSwellFieldLeash]);

  // Re-populate locations when beaches prop changes (filters applied)
  useEffect(() => {
    if (isMapReady && mapRef.current && beaches && beaches.length > 0) {
      const center = mapRef.current.getCenter();
      populateLocations(center.lat, center.lng);
    }
  }, [isMapReady, beaches, populateLocations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !placementPin) {
      placementMarkerRef.current?.remove();
      placementMarkerRef.current = null;
      return;
    }

    const element = document.createElement("div");
    element.setAttribute("data-testid", "map-placement-pin");
    element.style.cssText = `
      width: 26px;
      height: 26px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: #FDB84B;
      border: 3px solid #FFFFFF;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
      cursor: grab;
    `;
    const centerDot = document.createElement("div");
    centerDot.style.cssText = `
      position: absolute;
      inset: 6px;
      border-radius: 9999px;
      background: #252D6B;
    `;
    element.appendChild(centerDot);

    const marker = new mapboxgl.Marker({
      element,
      anchor: "bottom",
      draggable: placementPinDraggable,
    })
      .setLngLat([placementPin.lon, placementPin.lat])
      .addTo(map);

    const handleDragStart = (): void => {
      element.style.cursor = "grabbing";
    };
    const handleDragEnd = (): void => {
      element.style.cursor = "grab";
      onPlacementPinChangeRef.current?.(marker.getLngLat());
    };

    marker.on("dragstart", handleDragStart);
    marker.on("dragend", handleDragEnd);
    placementMarkerRef.current = marker;

    return () => {
      marker.off("dragstart", handleDragStart);
      marker.off("dragend", handleDragEnd);
      marker.remove();
      if (placementMarkerRef.current === marker) {
        placementMarkerRef.current = null;
      }
    };
  }, [isMapReady, placementPin, placementPinDraggable]);

  // Render clusters and individual markers
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    // Clean up existing markers
    cleanupMarkers();

    clusters.forEach((cluster) => {
      if (cluster.isCluster && cluster.clusterId !== undefined) {
        // Render cluster marker
        const marker = buildClusterMarker(cluster);
        const markerId = `cluster-${cluster.clusterId}`;
        if (mapRef.current?.getCanvasContainer()) {
          marker.addTo(mapRef.current);
        }
        markersRef.current[markerId] = marker;
      } else if (!cluster.isCluster && cluster.beach) {
        // Render individual beach marker
        const location = cluster.beach;
        const markerId = `location-${location.id}`;
        const waveHeight = cluster.waveHeight;

        const badgeElement = buildWaveHeightBadge(location, waveHeight, [
          cluster.longitude,
          cluster.latitude,
        ]);

        const marker = new mapboxgl.Marker({
          element: badgeElement,
          draggable: false,
          anchor: "center",
        }).setLngLat([cluster.longitude, cluster.latitude]);

        if (mapRef.current?.getCanvasContainer()) {
          marker.addTo(mapRef.current);
        }
        markersRef.current[markerId] = marker;
      }
    });

    customSpots.forEach((spot) => {
      if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lon)) {
        return;
      }

      const markerId = `custom-${spot.id}`;
      const nearestBeachId = spot.nearestBeachId;
      const markerData = nearestBeachId
        ? {
            conditionSummary: conditionSummaryMap.get(nearestBeachId),
            conditionScore: conditionScoreMap.get(nearestBeachId),
            waveLabel: displayForecastMap.get(nearestBeachId)?.label ?? null,
          }
        : undefined;
      const element = createCustomSpotMarkerElement(spot, markerData);
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!user) {
          trackSignupCtaClick({
            source: `custom-spot-${spot.id}`,
            cta_type: "custom_spot_marker",
          });
          setShowAuth(true);
          return;
        }

        router.push(`/custom-spots/${spot.id}`);
      });

      const marker = new mapboxgl.Marker({
        element,
        anchor: "center",
      }).setLngLat([spot.lon, spot.lat]);

      if (mapRef.current?.getCanvasContainer()) {
        marker.addTo(mapRef.current);
      }
      markersRef.current[markerId] = marker;
    });
  }, [
    clusters,
    customSpots,
    isMapReady,
    conditionScoreMap,
    conditionSummaryMap,
    displayForecastMap,
    buildClusterMarker,
    buildWaveHeightBadge,
    cleanupMarkers,
    router,
    user,
  ]);

  const swellTimeline =
    showMapChrome &&
    showSwellField &&
    onSwellTimelineChange &&
    swellTimelineSteps.length > 0 ? (
      <SwellForecastTimeline
        steps={swellTimelineSteps}
        index={swellTimelineIndex}
        onIndexChange={onSwellTimelineChange}
        placement={displayMode === "wave-height" ? "legend" : "floating"}
      />
    ) : null;

  const swellLayerSelector =
    showMapChrome && showSwellField && onSwellLayerChange ? (
      <SwellLayerSelector
        active={swellLayerId}
        onChange={onSwellLayerChange}
        placement={displayMode === "wave-height" ? "legend" : "floating"}
      />
    ) : null;

  return (
    <div
      ref={mapContainerRef}
      className={`${className} mapbox-container relative overflow-hidden`}
      style={{ width: "100%", height: "100%" }}
    >
      {showMapChrome && displayMode === "wave-height" && (
        <MapConditionLegend
          controls={swellLayerSelector}
          timeline={swellTimeline}
        />
      )}
      {showMapChrome && displayMode !== "wave-height" && swellLayerSelector}
      {showMapChrome && displayMode !== "wave-height" && swellTimeline}
      {showMapChrome && showLeashHint && (
        // One-time, auto-dismissing hint that the field locked the camera to the
        // coast (zoom-out is gone). Top-center, fades out under motion.
        <div
          data-testid="swell-field-leash-hint"
          className={`pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 px-3 py-1.5 text-[11px] text-white/90 ${
            reducedMotion ? "" : "transition-opacity duration-500"
          }`}
          style={{
            background: SWELL_MAP_SURFACE.panel,
            border: `1px solid ${SWELL_MAP_SURFACE.border}`,
            borderRadius: SWELL_MAP_STICKER_RADIUS,
            boxShadow: SWELL_MAP_STICKER_SHADOW,
            opacity: leashHintFading ? 0 : 1,
          }}
        >
          Zoomed to your coast for swell detail
        </div>
      )}
      {showMapChrome && showSwellField && !hasSwellData && (
        // Field is ON but no beach partitions resolved into points — say so
        // instead of leaving blank water look broken. Subtle sticker note.
        <div
          data-testid="swell-field-empty-note"
          className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 px-3 py-1.5 text-[11px] text-white/80"
          style={{
            background: SWELL_MAP_SURFACE.panel,
            border: `1px solid ${SWELL_MAP_SURFACE.border}`,
            borderRadius: SWELL_MAP_STICKER_RADIUS,
            boxShadow: SWELL_MAP_STICKER_SHADOW,
          }}
        >
          No swell data for this stretch
        </div>
      )}
      {showAuth && (
        <UnifiedAuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          mode="signup"
          contextMessage={{
            title: "Save Custom Spots",
            description: "Create an account to open and save custom surf spots.",
          }}
          source="custom-spot-marker"
          returnTo={pathname ?? undefined}
        />
      )}
    </div>
  );
}
