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
import { ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import mapboxgl from "mapbox-gl";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { debounce } from "@/lib/utils/debounce";
import type { Beach } from "@/types/database";
import * as AuthContext from "@/context/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { createCachedMapFetch } from "@/lib/utils/request-cache";
import { hasViewportChanged as checkViewportChanged } from "@/lib/utils/map-utilities";
import { CACHE_TTL } from "@/lib/constants/ui";
import type { WaterQualityHoldKind } from "@/lib/services/nearby-beach-service";
import { useBeachClustering, type ClusterPoint } from "@/hooks/use-beach-clustering";
import { loadFavoriteBeaches } from "@/components/map/map-favorites-loader";
import { createCustomSpotMarkerElement } from "@/components/map/custom-spot-marker-builder";
import {
  createWaveHeightBadge,
  getConditionMarkerCall,
  getConditionMarkerGradient,
  getWaterQualityHold,
  getWaterTempBadgeColor,
  type MarkerPreviewData,
  type MarkerBuilderDeps,
  type MapDisplayMode,
  type MapMarkerDisplay,
} from "@/components/map/map-marker-builder";
import {
  loadBeachesAndWaveHeights,
  fetchBulkForecast,
  parseHourlySwellTimeline,
  type ConditionSummary,
  type BeachLoaderResult,
  type ForecastLoadStatus,
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
import { createConditionsCalloutElement, CALLOUT_FULL_WIDTH } from "@/components/map/conditions-callout";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import type {
  HourlySwellTimeline,
  SwellPartition,
} from "@/app/api/forecasts/bulk/route";
import {
  degreesToCompass,
  SWELL_FIELD_PARTICLE_COLOR,
  SWELL_MAP_LEGEND_SURFACE,
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
import { embedTimelineArrayPositionForHourOffset } from "@/components/map/embed-map-timeline";
import {
  createSwellParticleLayer,
  resolveParticleCount,
} from "@/components/map/swell-field/swell-particle-layer";
import { SwellLayerSelector } from "@/components/map/swell-field/swell-layer-selector";
import { SwellForecastTimeline } from "@/components/map/swell-field/swell-forecast-timeline";
import { SwellDayTimeline } from "@/components/map/swell-field/swell-day-timeline";
import { useExpandableSwellTimeline } from "@/hooks/use-expandable-swell-timeline";
import { calendarDayTimelineHours } from "@/components/map/hourly-swell-timeline";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { CustomSpot } from "@/hooks/use-custom-spots";
import { trackSignupCtaClick } from "@/lib/analytics/signup-conversion-tracking";
import type { ForecastDisplay } from "@/lib/services/forecast/today-headline";
import type { MapCameraCommand } from "@/components/map/map-camera-command";
import { MapPreloadPreview } from "@/components/map/map-preload-preview";
import { createTileStallWatchdog } from "@/components/map/tile-stall-watchdog";
import {
  formatSwellPeriod,
  formatWaveHeightRange,
  formatWindSpeed,
} from "@/lib/formatters/surf-data";

// Mapbox CSS is imported globally in app/globals.css

// Zoom-lock bounds for the coastal camera leash (swell field ON only): keeps the
// user hugging the coast where we have beach data instead of pulling back to
// open-ocean / continent scale. The pan corridor (maxBounds) is derived from the
// loaded-beach footprint via computeCoastalBounds (an APPROXIMATE rectangular
// coast corridor, not a pixel-perfect coastline mask).
const SWELL_FIELD_MIN_ZOOM = 9;
const SWELL_FIELD_MAX_ZOOM = 16;

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
const COMBINED_PARTICLE_COUNT = 340;
// Wind reads cleaner with a sparser field than swell - scale its particle count
// down, but keep enough strokes visible on the light-blue basemap.
const WIND_PARTICLE_SCALE = 0.4; // keep wind sparser than swell even at the higher base count
const PARTICLE_MOTION_SCALE: Record<FlowComponentId, number> = {
  s1: 0.42,
  s2: 1,
  wind: 0.25, // calm, slow wind drift (-75% movement)
};
const PARTICLE_VELOCITY_SMOOTHING: Record<FlowComponentId, number> = {
  s1: 0.04,
  s2: 0.16,
  wind: 0.06, // heavier easing -> smoother wind direction changes
};
const PARTICLE_DASH_LENGTH_SCALE: Record<FlowComponentId, number> = {
  s1: 0.75,
  s2: 1,
  wind: 1,
};
const HOUR_MS = 60 * 60 * 1000;

const EMPTY_FLOW_FIELD: FlowField = { cols: 0, rows: 0, cells: [] };

function clearMapDebugCenter(): void {
  if (
    typeof window !== "undefined" &&
    (process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === "true")
  ) {
    (
      window as Window & {
        __quiverMapDebugCenter?: { lat: number; lon: number };
      }
    ).__quiverMapDebugCenter = undefined;
  }
}

export function cameraCommandContainsCenter(
  command: MapCameraCommand,
  center: { lat: number; lon: number },
): boolean {
  if (command.bounds) {
    const [[west, south], [east, north]] = command.bounds;
    return (
      center.lon >= west &&
      center.lon <= east &&
      center.lat >= south &&
      center.lat <= north
    );
  }

  if (!command.center) return true;
  return (
    Math.abs(center.lat - command.center.lat) <= 0.05 &&
    Math.abs(center.lon - command.center.lon) <= 0.05
  );
}

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

export function partitionAtAbsoluteTimelineIndex(
  timeline: HourlySwellTimeline | null,
  beachId: string,
  index: number,
): SwellPartition | undefined {
  if (!timeline || !Number.isFinite(index)) return undefined;

  const frameIndex = Math.round(index);
  if (frameIndex < 0 || frameIndex >= timeline.timestamps.length) return undefined;
  const timestamp = timeline.timestamps[frameIndex];
  const timestampEpoch = typeof timestamp === "string" ? Date.parse(timestamp) : NaN;
  if (
    !Number.isFinite(timestampEpoch) ||
    timestampEpoch % HOUR_MS !== 0 ||
    new Date(timestampEpoch).toISOString() !== timestamp
  ) {
    return undefined;
  }

  const partitions = timeline.partitionsByBeach[beachId];
  if (!Array.isArray(partitions) || partitions.length !== timeline.timestamps.length) {
    return undefined;
  }

  return partitions[frameIndex] ?? undefined;
}

export function partitionAtAbsoluteTimelinePosition(
  timeline: HourlySwellTimeline | null,
  beachId: string,
  position: number,
): SwellPartition | undefined {
  if (!timeline || !Number.isFinite(position) || timeline.timestamps.length === 0) {
    return undefined;
  }
  const clampedPosition = Math.min(
    Math.max(position, 0),
    timeline.timestamps.length - 1,
  );
  const leftIndex = Math.floor(clampedPosition);
  const rightIndex = Math.ceil(clampedPosition);
  const progress = clampedPosition - leftIndex;
  const left = partitionAtAbsoluteTimelineIndex(timeline, beachId, leftIndex);
  const right = partitionAtAbsoluteTimelineIndex(timeline, beachId, rightIndex);

  if (left && right && progress > 0) {
    return interpolateSwellPartition(left, right, progress);
  }
  return left ?? right;
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

export interface MapSpotConditions {
  conditionSummary: string | null;
  waterQualityHold: WaterQualityHoldKind | null;
  waveHeight: string | null;
  swellPeriod: string | null;
  swellDirection: string | null;
  isCalibrated: boolean | null;
  windSpeed: string | null;
  windDirection: string | null;
  tideState: string | null;
  tideHeight: string | null;
}

interface MapSpotConditionsContext {
  beaches: Beach[];
  partitionsMap: Map<string, SwellPartition>;
  partitionsTimelineMap: Map<string, SwellPartition[]>;
  timelineIndex: number;
  waveHeightMap: Map<string, number | undefined>;
  displayForecastMap: Map<string, ForecastDisplay | undefined>;
  conditionSummaryMap: Map<string, ConditionSummary>;
  isCalibratedMap: Map<string, boolean>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mapSpotConditions(
  beachId: string,
  context: MapSpotConditionsContext,
): MapSpotConditions {
  const partition = partitionAtTimelinePosition(
    beachId,
    context.timelineIndex,
    context.partitionsTimelineMap,
    context.partitionsMap,
  );
  const waveLabel = context.displayForecastMap.get(beachId)?.label?.trim();
  const rawWaveHeight = context.waveHeightMap.get(beachId);
  const swellDirection = partition?.s1Dir ?? partition?.swellDirOm;
  const waterQualityHold = getWaterQualityHold(
    context.beaches.find((beach) => beach.id === beachId),
  );

  return {
    conditionSummary: waterQualityHold
      ? getConditionMarkerCall({ waterQualityHold }).label.toUpperCase()
      : context.conditionSummaryMap.get(beachId) ?? null,
    waterQualityHold,
    waveHeight: waveLabel || (isFiniteNumber(rawWaveHeight)
      ? formatWaveHeightRange(rawWaveHeight)
      : null),
    swellPeriod: isFiniteNumber(partition?.s1PeriodS) && partition.s1PeriodS > 0
      ? formatSwellPeriod(partition.s1PeriodS)
      : null,
    swellDirection: isFiniteNumber(swellDirection)
      ? degreesToCompass(swellDirection)
      : null,
    isCalibrated: context.isCalibratedMap.get(beachId) ?? null,
    windSpeed: isFiniteNumber(partition?.windMph) && partition.windMph >= 0
      ? formatWindSpeed(partition.windMph)
      : null,
    windDirection: isFiniteNumber(partition?.windDir)
      ? degreesToCompass(partition.windDir)
      : null,
    tideState: null,
    tideHeight: null,
  };
}

interface InteractiveMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  initialZoom?: number;
  onLocationClick?: (beach: Beach, conditions: MapSpotConditions) => void;
  onMapClick?: (latlng: mapboxgl.LngLat) => void;
  cameraCommand?: MapCameraCommand | null;
  onUserCameraInteraction?: (interaction: {
    action: "pan" | "zoom" | "rotate";
    center: { lat: number; lon: number };
    phase: "start" | "end";
  }) => void;
  onLocationMove?: (latlng: mapboxgl.LngLat, beach: Beach) => void;
  onBoundsChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  onWaveHeightsChange?: (map: Map<string, number | undefined>) => void;
  onDisplayForecastsChange?: (map: Map<string, ForecastDisplay | undefined>) => void;
  onMapReady?: () => void;
  onMapPresentationReady?: () => void;
  className?: string;
  regionViewport?: {
    region: string;
    key: string;
    center: [number, number];
    bounds?: [[number, number], [number, number]];
    zoom?: number;
  } | null;
  initialNearbyBeachesPromise?: Promise<unknown> | null;
  initialForecastResponsePromise?: Promise<unknown> | null;
  authGeneration?: number;
  skillLevel?: string;
  getAccessToken?: () => string | null;
  getAuthGeneration?: () => number;
  onAuthTokenExpired?: () => void;
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
  swellTimelineMode?: "legacy" | "hourly" | "expandable-hourly";
  onHourlyTimelineLoaded?: (timeline: HourlySwellTimeline | null) => void;
  viewTimezone?: string;
  timelineFocusBeachId?: string | null;
  showMapChrome?: boolean;
  placementPin?: { lat: number; lon: number } | null;
  placementPinDraggable?: boolean;
  onPlacementPinChange?: (latlng: mapboxgl.LngLat) => void;
  onMapLoadFailure?: (reason: string) => void;
}

const SAN_DIEGO: [number, number] = [32.7157, -117.1611];
const EMPTY_CUSTOM_SPOTS: CustomSpot[] = [];
const FULL_FORECAST_TIMELINE_HOURS = 14 * 24;
const INITIAL_EXPANDABLE_TIMELINE_HOURS = 48;
const PUBLIC_MAP_TIMELINE_HORIZON_DAYS = 10;
const MAP_LOAD_TIMEOUT_MS = 15_000;

type SwellFieldLoadStatus = "loading" | "ready" | "empty" | "unavailable";
type MapLoadFailure = "token_invalid" | "webgl_unsupported" | "timeout";
type MapFailureReason =
  | MapLoadFailure
  | "network"
  | "tile_error"
  | "unknown";

const CONDITION_LEGEND_ITEMS: Array<{
  label: ConditionSummary;
  display: string;
}> = [
  { label: "EPIC", display: "Go now!" },
  { label: "GOOD", display: "Go surf!" },
  { label: "FAIR", display: "Worth a look" },
  { label: "RIDEABLE", display: "Slim pickings" },
  { label: "MEH", display: "Skip it" },
  { label: "UNKNOWN", display: "No read" },
];

interface MapConditionLegendProps {
  controls?: ReactNode;
  timeline?: ReactNode;
  bottomOffset?: number;
}

function MapConditionLegend({
  controls,
  timeline,
  bottomOffset = 0,
}: MapConditionLegendProps): ReactElement {
  const [isMinimized, setIsMinimized] = useState(true);
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
      className="pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
      style={{
        background: "rgba(17,16,13,0.08)",
        color: SWELL_MAP_LEGEND_SURFACE.ink,
      }}
    >
      <ToggleIcon className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div
      data-testid="map-condition-legend"
      className={`pointer-events-none absolute bottom-3 left-3 z-10 px-3 py-2 ${
        isWide
          ? "w-[calc(100%-1.5rem)] max-w-[27rem] sm:w-auto"
          : ""
      }`}
      style={{
        bottom: bottomOffset > 0 ? `calc(${bottomOffset}px + 0.75rem)` : undefined,
        background: SWELL_MAP_LEGEND_SURFACE.paper,
        border: `2px solid ${SWELL_MAP_LEGEND_SURFACE.border}`,
        borderRadius: SWELL_MAP_STICKER_RADIUS,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
        color: SWELL_MAP_LEGEND_SURFACE.ink,
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
                    className="h-2.5 w-2.5 rounded-full border border-black/30"
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
            <div
              className="mt-2 flex flex-col gap-2 border-t pt-2"
              style={{ borderColor: SWELL_MAP_LEGEND_SURFACE.divider }}
            >
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
  cameraCommand,
  onUserCameraInteraction,
  onLocationMove,
  onBoundsChange,
  onWaveHeightsChange,
  onDisplayForecastsChange,
  onMapReady,
  onMapPresentationReady,
  className = "h-full w-full",
  regionViewport,
  initialNearbyBeachesPromise = null,
  initialForecastResponsePromise = null,
  authGeneration = 0,
  skillLevel,
  getAccessToken,
  getAuthGeneration,
  onAuthTokenExpired,
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
  swellTimelineMode = "legacy",
  onHourlyTimelineLoaded,
  viewTimezone,
  timelineFocusBeachId,
  showMapChrome = true,
  placementPin = null,
  placementPinDraggable = true,
  onPlacementPinChange,
  onMapLoadFailure,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRetryButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreMapFocusRef = useRef(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const markerSignatureRef = useRef<Record<string, string>>({});
  const placementMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const activeClusterPopupRef = useRef<mapboxgl.Popup | null>(null);
  const activeBeachPreviewPopupRef = useRef<mapboxgl.Popup | null>(null);
  const activeCalloutRef = useRef<{ marker: mapboxgl.Marker; beachId: string } | null>(null);
  // Last playback refresh of the open callout — used to skip fractional timeline
  // ticks that land on the same displayed step (see the refresh effect below).
  const lastCalloutRefreshRef = useRef<{
    step: number;
    partitions: Map<string, SwellPartition>;
  } | null>(null);
  const conditionsCtxRef = useRef({
    beaches: [] as Beach[],
    partitionsMap: new Map<string, SwellPartition>(),
    partitionsTimelineMap: new Map<string, SwellPartition[]>(),
    timelineIndex: 0,
    stepsLen: 0,
    bounds: { west: -118, south: 32, east: -117, north: 33 },
    waterTempMap: new Map<string, string | undefined>(),
    waveHeightMap: new Map<string, number | undefined>(),
    displayForecastMap: new Map<string, ForecastDisplay | undefined>(),
    conditionSummaryMap: new Map<string, ConditionSummary>(),
    isCalibratedMap: new Map<string, boolean>(),
  });
  const beachPreviewCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastPopulateKeyRef = useRef<string | null>(null);
  const populateRequestIdRef = useRef(0);
  const populateAbortControllerRef = useRef<AbortController | null>(null);
  const forecastUnavailableRef = useRef(false);
  const swellFieldDataInvalidatedRef = useRef(false);
  const lastViewportRef = useRef<{
    lat: number;
    lon: number;
    zoom: number;
  } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapPresentationReady, setIsMapPresentationReady] = useState(false);
  const hasNotifiedMapPresentationReadyRef = useRef(false);
  const [mapLoadFailure, setMapLoadFailure] =
    useState<MapLoadFailure | null>(null);
  const [mapRetryNonce, setMapRetryNonce] = useState(0);
  const [mapStyleRevision, setMapStyleRevision] = useState(0);
  const [leashSuspendedCommandId, setLeashSuspendedCommandId] = useState<
    number | null
  >(null);
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
  const [isCalibratedMap, setIsCalibratedMap] = useState<Map<string, boolean>>(new Map());
  const [partitionsMap, setPartitionsMap] = useState<Map<string, SwellPartition>>(new Map());
  const [partitionsTimelineMap, setPartitionsTimelineMap] = useState<
    Map<string, SwellPartition[]>
  >(new Map());
  const [hourlyTimelineSeed, setHourlyTimelineSeed] = useState<HourlySwellTimeline | null>(null);
  const waterMaskCacheRef = useRef<{
    cameraKey: string;
    verdicts: Map<string, boolean>;
  } | null>(null);
  // True when the last mask pass could not run against rendered tiles (or the
  // style reloaded), so the next `idle` owes a remask. The swell layer calls
  // triggerRepaint every animation frame without dirtying Mapbox, which makes
  // `idle` fire per frame; an unconditional idle remask re-queried every field
  // cell ~60x/s.
  const waterMaskOwedRef = useRef(true);
  const lastWaterMaskRetryAtRef = useRef<number | null>(null);
  const [maskRetryTick, setMaskRetryTick] = useState(0);
  const [hourlyTimelineBeachIds, setHourlyTimelineBeachIds] = useState<string[]>([]);
  // Loader-resolved beaches that partitionsMap is keyed by (the prop may be empty).
  const [swellFieldBeaches, setSwellFieldBeaches] = useState<Beach[]>([]);
  const [swellFieldLoadStatus, setSwellFieldLoadStatus] =
    useState<SwellFieldLoadStatus>("loading");
  const [expandableTimelineHeight, setExpandableTimelineHeight] = useState(0);
  const [expandablePlaybackPosition, setExpandablePlaybackPosition] = useState(0);
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
  // The leash bounds currently applied (rounded key). Lets the leash skip a
  // release+re-apply when the corridor hasn't meaningfully changed — re-applying on
  // every beach-list update is what made the camera bounce inland and back on load.
  const appliedLeashKeyRef = useRef<string | null>(null);
  const pendingLeashCommandRef = useRef<MapCameraCommand | null>(null);
  const swellLayerIdRef = useRef<SwellLayerId>(swellLayerId);
  // The shape of the mounted particle layer(s). Only a shape change forces a
  // teardown+re-add (which re-seeds and looks like a jitter); same-shape switches
  // (Swell <-> Swell 2) keep the layer and retarget it via refs.
  const swellLayerKeyRef = useRef<string>("none");
  const isMapReadyRef = useRef(false);
  const favoriteBeachIdsRef = useRef<Set<string>>(new Set());
  const selectedBeachIdRef = useRef<string | null>(null);
  const hoveredBeachIdRef = useRef<string | null>(null);
  const partitionsMapRef = useRef<Map<string, SwellPartition>>(new Map());
  const hourlyTimelineBeachIdsRef = useRef<string[]>([]);
  const lastRegionViewportKeyRef = useRef<string | null>(null);
  const appliedCameraCommandIdRef = useRef<number | null>(null);
  const clusterCleanupRef = useRef<Map<string, () => void>>(new Map());
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onWaveHeightsChangeRef = useRef(onWaveHeightsChange);
  const onDisplayForecastsChangeRef = useRef(onDisplayForecastsChange);
  const onMapReadyRef = useRef(onMapReady);
  const onMapPresentationReadyRef = useRef(onMapPresentationReady);
  const onPlacementPinChangeRef = useRef(onPlacementPinChange);
  const onMapLoadFailureRef = useRef(onMapLoadFailure);
  const onHourlyTimelineLoadedRef = useRef(onHourlyTimelineLoaded);
  const initialCenterRef = useRef(initialCenter);
  const onMapClickRef = useRef(onMapClick);
  const onUserCameraInteractionRef = useRef(onUserCameraInteraction);
  const activeUserCameraGestureRef = useRef<"pan" | "zoom" | "rotate" | null>(null);
  // Typed broadly; handleMoveEnd & populateLocations are assigned via sync effects below
  const handleMoveEndRef = useRef<((...args: any[]) => any) | null>(null);
  const populateLocationsRef = useRef<((lat: number, lon: number) => Promise<void>) | null>(null);
  // Instrumentation refs for pan/zoom classification and single-fire events
  const prevCenterRef = useRef<{ lat: number; lon: number } | null>(null);
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
  const userRef = useRef(user);
  const userId = showMapChrome ? user?.id : undefined;
  const { track } = useTrackEvent();
  const router = useRouter();
  const pathname = usePathname();
  const markerBeaches = beaches ?? swellFieldBeaches;

  useEffect(() => {
    isMapReadyRef.current = isMapReady;
  }, [isMapReady]);

  useEffect(() => {
    if (!mapLoadFailure) return;
    mapRetryButtonRef.current?.focus();
  }, [mapLoadFailure]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
    onMapPresentationReadyRef.current = onMapPresentationReady;
  }, [onMapPresentationReady]);

  useEffect(() => {
    onPlacementPinChangeRef.current = onPlacementPinChange;
  }, [onPlacementPinChange]);

  useEffect(() => {
    onMapLoadFailureRef.current = onMapLoadFailure;
  }, [onMapLoadFailure]);

  useEffect(() => {
    onHourlyTimelineLoadedRef.current = onHourlyTimelineLoaded;
  }, [onHourlyTimelineLoaded]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onUserCameraInteractionRef.current = onUserCameraInteraction;
  }, [onUserCameraInteraction]);

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
  const initialNearbyBeachesPromiseRef = useRef(initialNearbyBeachesPromise);
  const initialForecastResponsePromiseRef = useRef(initialForecastResponsePromise);
  const fetchNearbyBeachesWithPreload = useCallback(
    async (latitude: number, longitude: number, signal?: AbortSignal): Promise<unknown> => {
      const preloaded = initialNearbyBeachesPromiseRef.current;
      if (preloaded) {
        initialNearbyBeachesPromiseRef.current = null;
        const result = await preloaded;
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        if (result && typeof result === "object" && "data" in result) return result;
      }
      return fetchNearbyBeaches.current(latitude, longitude, signal);
    },
    [],
  );

  const timelineTimezone = viewTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const hourlyTimelineScopeKey = `${[...hourlyTimelineBeachIds].sort().join(",")}|${timelineTimezone}|${authGeneration}`;
  const loadHourlyChunk = useCallback(
    async (start: string, hours: number, signal: AbortSignal): Promise<HourlySwellTimeline> => {
      const requestAuthGeneration = getAuthGeneration?.() ?? authGeneration;
      const beachIds = hourlyTimelineBeachIdsRef.current;
      if (beachIds.length === 0) throw new Error("No beaches are available for the forecast timeline");

      const searchParams = new URLSearchParams({
        beachIds: beachIds.join(","),
        timeline: "hourly",
        timelineStart: start,
        timelineHours: String(hours),
      });
      if (skillLevel !== undefined) searchParams.set("skillLevel", skillLevel);
      const response = await fetchBulkForecast(
        `/api/forecasts/bulk?${searchParams.toString()}`,
        signal,
        getAccessToken,
        onAuthTokenExpired,
      );
      if (!response.ok) throw new Error(`Bulk forecast API returned ${response.status}`);

      const body = await response.json();
      if ((getAuthGeneration?.() ?? authGeneration) !== requestAuthGeneration) {
        throw new DOMException("Aborted", "AbortError");
      }
      const timeline = parseHourlySwellTimeline(body?.data?.hourlySwellTimeline, beachIds);
      if (!timeline) throw new Error("Bulk forecast API returned an invalid hourly timeline");
      return timeline;
    },
    [authGeneration, getAccessToken, getAuthGeneration, onAuthTokenExpired, skillLevel],
  );
  const isExpandableFramePlayable = useCallback(
    (timeline: HourlySwellTimeline, index: number): boolean => {
      const beachList = swellFieldBeaches.length > 0
        ? swellFieldBeaches
        : (beaches ?? []);
      const components = componentsForLayer(swellLayerId);

      return beachList.some((beach) => {
        if (beach.lat == null || beach.lon == null) return false;
        const lat = beach.lat;
        const lon = beach.lon;
        const partition = timeline.partitionsByBeach[beach.id]?.[index];
        if (!partition) return false;
        return components.some((component) =>
          partitionToPoint(lon, lat, partition, component) != null,
        );
      });
    },
    [beaches, swellFieldBeaches, swellLayerId],
  );
  const publicMapTimelineHorizonHours = useMemo(
    () => calendarDayTimelineHours(
      hourlyTimelineSeed?.timestamps[0],
      timelineTimezone,
      PUBLIC_MAP_TIMELINE_HORIZON_DAYS,
    ),
    [hourlyTimelineSeed?.timestamps, timelineTimezone],
  );
  const expandableTimeline = useExpandableSwellTimeline({
    scopeKey: hourlyTimelineScopeKey,
    initial: hourlyTimelineSeed,
    timezone: timelineTimezone,
    loadChunk: loadHourlyChunk,
    reducedMotion,
    prefetchHours:
      swellTimelineMode === "expandable-hourly"
        ? publicMapTimelineHorizonHours
        : 0,
    isFramePlayable: isExpandableFramePlayable,
  });
  const isExpandableTimeline = swellTimelineMode === "expandable-hourly";
  const isEmbedHourlyTimeline = swellTimelineMode === "hourly";
  const activeHourlyPartitionsMap = useMemo(() => {
    const active = new Map<string, SwellPartition>();
    for (const [beachId, partitions] of Object.entries(expandableTimeline.partitionsByBeach)) {
      const partition = partitions[expandableTimeline.index];
      if (partition) active.set(beachId, partition);
    }
    return active;
  }, [expandableTimeline.index, expandableTimeline.partitionsByBeach]);
  const activeEmbedHourlyPartitionsMap = useMemo(() => {
    const active = new Map<string, SwellPartition>();
    if (!hourlyTimelineSeed) return new Map(partitionsMap);
    const position = embedTimelineArrayPositionForHourOffset(
      hourlyTimelineSeed.timestamps,
      swellTimelineIndex,
    );
    if (position === undefined) return active;

    for (const beachId of Object.keys(hourlyTimelineSeed.partitionsByBeach)) {
      const partition = partitionAtAbsoluteTimelinePosition(
        hourlyTimelineSeed,
        beachId,
        position,
      );
      if (partition) active.set(beachId, partition);
    }
    return active;
  }, [hourlyTimelineSeed, partitionsMap, swellTimelineIndex]);

  useEffect(() => {
    const activePartitions = isExpandableTimeline
      ? activeHourlyPartitionsMap
      : isEmbedHourlyTimeline
        ? activeEmbedHourlyPartitionsMap
        : partitionsMap;
    const usesAbsoluteTimeline = isExpandableTimeline || isEmbedHourlyTimeline;
    conditionsCtxRef.current = {
      beaches: beaches ?? swellFieldBeaches,
      partitionsMap: activePartitions,
      partitionsTimelineMap: usesAbsoluteTimeline ? new Map() : partitionsTimelineMap,
      timelineIndex: usesAbsoluteTimeline ? 0 : swellTimelineIndex,
      stepsLen: usesAbsoluteTimeline ? 1 : swellTimelineSteps.length,
      bounds: mapBounds || { west: -118, south: 32, east: -117, north: 33 },
      waterTempMap,
      waveHeightMap,
      displayForecastMap,
      conditionSummaryMap,
      isCalibratedMap,
    };
  }, [
    activeHourlyPartitionsMap,
    activeEmbedHourlyPartitionsMap,
    beaches,
    isEmbedHourlyTimeline,
    isExpandableTimeline,
    mapBounds,
    conditionSummaryMap,
    displayForecastMap,
    isCalibratedMap,
    partitionsMap,
    partitionsTimelineMap,
    swellFieldBeaches,
    swellTimelineIndex,
    swellTimelineSteps.length,
    waterTempMap,
    waveHeightMap,
  ]);

  const trackTimelineAction = useCallback(
    (
      action: "timeline_scrub" | "timeline_play" | "timeline_pause" | "timeline_extend",
      timestamp: string | undefined,
      debounceMs: number,
      extensionResult?: string,
    ): void => {
      if (!timestamp) return;
      const firstTimestamp = expandableTimeline.timestamps[0];
      const lastTimestamp = expandableTimeline.timestamps.at(-1);
      const firstEpoch = Date.parse(firstTimestamp ?? "");
      const lastEpoch = Date.parse(lastTimestamp ?? "");
      const loadedHorizonHours = Number.isFinite(firstEpoch) && Number.isFinite(lastEpoch)
        ? Math.max(0, (lastEpoch - firstEpoch) / (60 * 60 * 1000) + 1)
        : 0;
      const localParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timelineTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(timestamp));
      const localPart = (type: Intl.DateTimeFormatPartTypes): string =>
        localParts.find((part) => part.type === type)?.value ?? "";
      track("map_interaction", {
        metadata: {
          action,
          active_timestamp_utc: timestamp,
          timezone: timelineTimezone,
          active_local_hour: `${localPart("year")}-${localPart("month")}-${localPart("day")}T${localPart("hour")}:00`,
          loaded_horizon_hours: loadedHorizonHours,
          ...(extensionResult ? { extension_result: extensionResult } : {}),
        } as never,
        debounceMs,
      });
    },
    [expandableTimeline.timestamps, timelineTimezone, track],
  );
  const lastTimelineLoadingRef = useRef(false);
  const pendingTimelineExtensionRef = useRef(false);
  useEffect(() => {
    pendingTimelineExtensionRef.current = false;
    lastTimelineLoadingRef.current = false;
  }, [hourlyTimelineScopeKey]);
  useEffect(() => {
    const startedLoading = expandableTimeline.isLoadingMore && !lastTimelineLoadingRef.current;
    const finishedLoading = !expandableTimeline.isLoadingMore && lastTimelineLoadingRef.current;
    lastTimelineLoadingRef.current = expandableTimeline.isLoadingMore;
    if (!isExpandableTimeline) {
      pendingTimelineExtensionRef.current = false;
      return;
    }
    if (startedLoading) {
      pendingTimelineExtensionRef.current = true;
      trackTimelineAction(
        "timeline_extend",
        expandableTimeline.timestamps[expandableTimeline.index],
        0,
        "requested",
      );
      return;
    }
    if (!finishedLoading || !pendingTimelineExtensionRef.current) return;
    pendingTimelineExtensionRef.current = false;
    trackTimelineAction(
      "timeline_extend",
      expandableTimeline.timestamps[expandableTimeline.index],
      0,
      expandableTimeline.error
        ? "failure"
        : expandableTimeline.isExhausted
          ? "exhausted"
          : "success",
    );
  }, [
    expandableTimeline.error,
    expandableTimeline.index,
    expandableTimeline.isExhausted,
    expandableTimeline.isLoadingMore,
    expandableTimeline.timestamps,
    isExpandableTimeline,
    trackTimelineAction,
  ]);

  const handleExpandableTimelineIndexChange = useCallback(
    (index: number): void => {
      expandableTimeline.setIndex(index);
      trackTimelineAction("timeline_scrub", expandableTimeline.timestamps[index], 250);
    },
    [expandableTimeline, trackTimelineAction],
  );
  const handleExpandableTimelinePlayingChange = useCallback(
    (playing: boolean): void => {
      expandableTimeline.setPlaying(playing);
      trackTimelineAction(
        playing ? "timeline_play" : "timeline_pause",
        expandableTimeline.timestamps[expandableTimeline.index],
        0,
      );
    },
    [expandableTimeline, trackTimelineAction],
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
    const waterQualityHold = getWaterQualityHold(beach);
    // Shrink the callout to fit narrow viewports: at full size the arrows run off a
    // phone screen and the ring looks oversized. Sized so the arrow span stays within
    // ~78% of the viewport, capped at 1 for desktop.
    const viewportWidthPx =
      typeof window !== "undefined" ? window.innerWidth : 1024;
    const calloutScale = Math.max(
      0.55,
      Math.min(1, (viewportWidthPx * 0.78) / CALLOUT_FULL_WIDTH)
    );
    const { element } = createConditionsCalloutElement({
      beachName: beach.name,
      tempLabel,
      components,
      beachHref,
      waterQualityHold,
      scale: calloutScale,
    });
    // An active callout is the immediate interaction target. Keep it above the
    // persistent legend so its forecast link remains tappable on narrow screens.
    element.style.zIndex = "30";
    // Stop the tap from bubbling to map.on("click"), which would treat the
    // dismiss as a fresh water tap and instantly re-open the callout.
    element.addEventListener("click", (ev) => {
      ev.stopPropagation();
      removeActiveCallout();
    });
    removeActiveCallout();
    const marker = new mapboxgl.Marker({ element, anchor: "center" }).setLngLat([beach.lon!, beach.lat!]).addTo(map);
    // Mapbox stamps a generic "Map marker" aria-label; replace it with the real
    // conditions so screen readers get the same info the arrows convey visually.
    const conditionsRead =
      components.map((c) => `${c.name} ${c.label}`).join("; ") || "no current reading";
    element.setAttribute(
      "aria-label",
      `${beach.name}${tempLabel ? `, ${tempLabel}` : ""}${
        waterQualityHold
          ? waterQualityHold === "held"
            ? ", water quality hold"
            : `, ${
                waterQualityHold === "closure" ? "closed" : "under advisory"
              } according to county water-quality data`
          : ""
      } surf conditions: ${conditionsRead}`
    );
    activeCalloutRef.current = { marker, beachId: beach.id };
    // Record what this build rendered so playback ticks that land on the same
    // displayed step can skip the rebuild (see the timeline refresh effect).
    lastCalloutRefreshRef.current = {
      step: Math.round(Number.isFinite(ctx.timelineIndex) ? ctx.timelineIndex : 0),
      partitions: ctx.partitionsMap,
    };
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
        waterQualityHold: preview.waterQualityHold,
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
    removeActiveCallout();

    // Clean up cluster event listeners
    clusterCleanupRef.current.forEach((cleanup) => cleanup());
    clusterCleanupRef.current.clear();
    activeClusterPopupRef.current?.remove();
    activeClusterPopupRef.current = null;

    // Remove all markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};
    markerSignatureRef.current = {};
  }, [closeBeachPreviewPopup, removeActiveCallout]);

  // Helper: full cleanup
  const cleanupMap = useCallback(() => {
    populateAbortControllerRef.current?.abort();
    populateAbortControllerRef.current = null;
    cleanupMarkers();
    clearMapDebugCenter();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    mapContainerRef.current?.replaceChildren();
    lastPopulateKeyRef.current = null;
    populateRequestIdRef.current += 1;
    selectedBeachIdRef.current = null;
    hoveredBeachIdRef.current = null;
    favoriteBeachIdsRef.current = new Set();
    isMapReadyRef.current = false;
    setIsMapReady(false);
  }, [cleanupMarkers]);

  const invalidateSwellForecastState = useCallback((): void => {
    populateAbortControllerRef.current?.abort();
    populateAbortControllerRef.current = null;
    populateRequestIdRef.current += 1;
    lastPopulateKeyRef.current = null;
    lastViewportRef.current = null;
    forecastUnavailableRef.current = false;
    swellFieldDataInvalidatedRef.current = true;
    partitionsMapRef.current = new Map();
    hourlyTimelineBeachIdsRef.current = [];
    flowFieldsRef.current = {
      s1: EMPTY_FLOW_FIELD,
      s2: EMPTY_FLOW_FIELD,
      wind: EMPTY_FLOW_FIELD,
    };
    setPartitionsMap(new Map());
    setPartitionsTimelineMap(new Map());
    setHourlyTimelineSeed(null);
    setHourlyTimelineBeachIds([]);
    setSwellFieldBeaches([]);
    setSwellFieldLoadStatus("loading");
    onHourlyTimelineLoadedRef.current?.(null);
    mapRef.current?.triggerRepaint();
  }, []);

  // Helper to check if viewport has significantly changed
  const hasViewportChanged = useCallback(
    (lat: number, lon: number, zoom: number): boolean => {
      return checkViewportChanged({ lat, lon, zoom }, lastViewportRef.current);
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
        const longitude = b.lon;
        if (lat == null || longitude == null) continue;
        if (lat >= south && lat <= north && longitude >= west && longitude <= east) {
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
            onLocationClick?.(
              beach,
              mapSpotConditions(beach.id, conditionsCtxRef.current),
            );
            return;
          }
          removeActiveCallout();
          onLocationClick?.(
            beach,
            mapSpotConditions(beach.id, conditionsCtxRef.current),
          );
        },
        router,
        autoNavigate: showConditionsOnTap ? false : autoNavigateOnMarkerClick,
        displayMode,
        markerDisplay,
        waterTemp: waterTempMap.get(location.id),
        waveHeightLabel: displayForecastMap.get(location.id)?.label ?? null,
        conditionScore: conditionScoreMap.get(location.id),
        conditionSummary: conditionSummaryMap.get(location.id),
        waterQualityHold: getWaterQualityHold(location),
        previewLngLat,
        // In the embed, tapping a pin opens the conditions callout (arrows + name +
        // temp + Full forecast). The marker preview popup would show the SAME numbers
        // on top of it, so suppress it there — one read per tap, not two.
        onPreviewOpen: showConditionsOnTap ? undefined : openBeachPreviewPopup,
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
      const zoom = map?.getZoom() ?? initialZoom;
      // Include beaches state in cache key: undefined vs empty array vs populated array
      const beachesKey = beaches === undefined
        ? "none"
        : beaches
          .slice(0, 20)
          .map((beach) => beach.id)
          .filter((beachId): beachId is string => Boolean(beachId))
          .sort()
          .join(",");
      const populateKey = `${latitude.toFixed(4)}-${longitude.toFixed(
        4
      )}-${zoom.toFixed(2)}-${beachesKey}-${swellTimelineMode ?? "legacy"}-${
        timelineFocusBeachId ?? "no-focus"
      }-${skillLevel ?? "no-skill"}-${authGeneration}`;

      if (lastPopulateKeyRef.current === populateKey) {
        return;
      }

      lastPopulateKeyRef.current = populateKey;
      populateAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      populateAbortControllerRef.current = abortController;
      const requestId = populateRequestIdRef.current + 1;
      populateRequestIdRef.current = requestId;
      const requestAuthGeneration = getAuthGeneration?.() ?? authGeneration;
      const isCurrentRequest = (): boolean =>
        requestId === populateRequestIdRef.current &&
        !abortController.signal.aborted &&
        (getAuthGeneration?.() ?? authGeneration) === requestAuthGeneration;
      forecastUnavailableRef.current = false;
      setSwellFieldLoadStatus("loading");
      if (swellTimelineMode === "hourly") {
        const emptyWaveHeights = new Map<string, number | undefined>();
        const emptyDisplayForecasts = new Map<string, ForecastDisplay | undefined>();
        setWaveHeightMap(emptyWaveHeights);
        setDisplayForecastMap(emptyDisplayForecasts);
        setWaterTempMap(new Map());
        setConditionScoreMap(new Map());
        setConditionSummaryMap(new Map());
        setIsCalibratedMap(new Map());
        setPartitionsMap(new Map());
        setPartitionsTimelineMap(new Map());
        setHourlyTimelineSeed(null);
        onWaveHeightsChangeRef.current?.(emptyWaveHeights);
        onDisplayForecastsChangeRef.current?.(emptyDisplayForecasts);
        onHourlyTimelineLoadedRef.current?.(null);
      }
      try {
        let committedWaveHeightMap = new Map<string, number | undefined>();
        let committedDisplayForecastMap = new Map<string, ForecastDisplay | undefined>();
        let committedWaterTempMap = new Map<string, string | undefined>();
        let committedConditionScoreMap = new Map<string, number | undefined>();
        let committedConditionSummaryMap = new Map<string, ConditionSummary>();
        let committedIsCalibratedMap = new Map<string, boolean>();
        let committedPartitionsMap = new Map<string, SwellPartition>();
        let committedPartitionsTimelineMap = new Map<string, SwellPartition[]>();
        let timelinePromise: Promise<BeachLoaderResult> | null = null;
        const startTimelineLoad = (locations: Beach[]): void => {
          if (swellTimelineMode !== "hourly" || timelinePromise) return;
          const pendingTimeline = loadBeachesAndWaveHeights(
            latitude,
            longitude,
            locations,
            { fetchNearbyBeaches: fetchNearbyBeachesWithPreload },
            {
              timeline: "hourly",
              skillLevel,
              getAccessToken,
              onAuthTokenExpired,
              timelineHours: FULL_FORECAST_TIMELINE_HOURS,
              timelineFocusBeachId,
              timelineOnly: true,
              signal: abortController.signal,
            },
          );
          void pendingTimeline.catch(() => undefined);
          timelinePromise = pendingTimeline;
        };
        const onLocationsResolved = (locations: Beach[]): void => {
          if (!isCurrentRequest()) return;
          setSwellFieldBeaches(locations);
        };
        const mergeMapEntries = <T,>(
          current: Map<string, T>,
          next: Map<string, T>,
          merge: boolean,
        ): Map<string, T> => {
          if (!merge) return next;
          return new Map([...current, ...next]);
        };
        const commitResult = (
          result: BeachLoaderResult,
          merge: boolean,
          statusOverride?: ForecastLoadStatus,
        ): void => {
          committedWaveHeightMap = mergeMapEntries(
            committedWaveHeightMap,
            result.waveHeightMap,
            merge,
          );
          committedDisplayForecastMap = mergeMapEntries(
            committedDisplayForecastMap,
            result.displayForecastMap,
            merge,
          );
          committedWaterTempMap = mergeMapEntries(
            committedWaterTempMap,
            result.waterTempMap,
            merge,
          );
          committedConditionScoreMap = mergeMapEntries(
            committedConditionScoreMap,
            result.conditionScoreMap,
            merge,
          );
          committedConditionSummaryMap = mergeMapEntries(
            committedConditionSummaryMap,
            result.conditionSummaryMap,
            merge,
          );
          committedIsCalibratedMap = mergeMapEntries(
            committedIsCalibratedMap,
            result.isCalibratedMap,
            merge,
          );
          committedPartitionsMap = mergeMapEntries(
            committedPartitionsMap,
            result.partitionsMap,
            merge,
          );
          committedPartitionsTimelineMap = mergeMapEntries(
            committedPartitionsTimelineMap,
            result.partitionsTimelineMap,
            merge,
          );

          setWaveHeightMap(committedWaveHeightMap);
          setDisplayForecastMap(committedDisplayForecastMap);
          setWaterTempMap(committedWaterTempMap);
          setConditionScoreMap(committedConditionScoreMap);
          setConditionSummaryMap(committedConditionSummaryMap);
          setIsCalibratedMap(committedIsCalibratedMap);
          setPartitionsMap(committedPartitionsMap);
          setPartitionsTimelineMap(committedPartitionsTimelineMap);
          setSwellFieldBeaches(result.locations);
          const loadStatus = statusOverride ?? result.forecastStatus;
          swellFieldDataInvalidatedRef.current = false;
          forecastUnavailableRef.current = loadStatus === "unavailable";
          setSwellFieldLoadStatus(loadStatus);
          onWaveHeightsChangeRef.current?.(committedWaveHeightMap);
          onDisplayForecastsChangeRef.current?.(committedDisplayForecastMap);
        };
        const applyTimelineResult = (result: BeachLoaderResult): void => {
          if (swellTimelineMode === "hourly") {
            setHourlyTimelineSeed(result.hourlySwellTimeline);
            onHourlyTimelineLoadedRef.current?.(result.hourlySwellTimeline);
          }
          if (swellTimelineMode === "expandable-hourly") {
            const beachIds = result.hourlyTimelineBeachIds;
            hourlyTimelineBeachIdsRef.current = beachIds;
            setHourlyTimelineBeachIds(beachIds);
            setHourlyTimelineSeed(result.hourlySwellTimeline);
          }
        };
        // Clean up existing markers when provided beaches change
        if (beaches !== undefined) {
          cleanupMarkers();
        }

        const preloadedForecast = initialForecastResponsePromiseRef.current;
        initialForecastResponsePromiseRef.current = null;
        const initialResult = await loadBeachesAndWaveHeights(
          latitude,
          longitude,
          beaches,
          { fetchNearbyBeaches: fetchNearbyBeachesWithPreload },
          swellTimelineMode === "expandable-hourly"
            ? {
                timeline: "hourly",
                skillLevel,
                getAccessToken,
                onAuthTokenExpired,
                timelineHours: INITIAL_EXPANDABLE_TIMELINE_HOURS,
                timelineFocusBeachId,
                signal: abortController.signal,
                onLocationsResolved,
              }
            : {
                skillLevel,
                getAccessToken,
                onAuthTokenExpired,
                signal: abortController.signal,
                initialForecastResponsePromise: preloadedForecast,
                onLocationsResolved,
              },
        );
        if (!isCurrentRequest()) return;
        commitResult(initialResult, false);

        if (swellTimelineMode === "hourly") {
          // Current forecasts and partitions are useful immediately. The absolute
          // timeline is loaded separately so its long horizon cannot delay pins.
          let timelineResult: BeachLoaderResult;
          try {
            startTimelineLoad(initialResult.locations);
            timelineResult = await timelinePromise!;
          } catch (error) {
            if (!isCurrentRequest()) return;
            forecastUnavailableRef.current =
              initialResult.forecastStatus === "unavailable";
            setSwellFieldLoadStatus(initialResult.forecastStatus);
            setHourlyTimelineSeed(null);
            onHourlyTimelineLoadedRef.current?.(null);
            console.warn("Failed to load hourly forecast timeline", error);
            return;
          }
          if (!isCurrentRequest()) return;
          const timelineStatus =
            timelineResult.forecastStatus === "ready"
              ? "ready"
              : initialResult.forecastStatus;
          forecastUnavailableRef.current = timelineStatus === "unavailable";
          setSwellFieldLoadStatus(timelineStatus);
          applyTimelineResult(timelineResult);
        } else {
          applyTimelineResult(initialResult);
        }
      } catch (e) {
        if (!isCurrentRequest()) return;
        lastPopulateKeyRef.current = null;
        forecastUnavailableRef.current = true;
        setSwellFieldLoadStatus("unavailable");
        console.error("Error populating locations", e);
      } finally {
        if (populateAbortControllerRef.current === abortController) {
          populateAbortControllerRef.current = null;
        }
      }
    },
    [
      beaches,
      authGeneration,
      cleanupMarkers,
      fetchNearbyBeachesWithPreload,
      initialZoom,
      getAccessToken,
      getAuthGeneration,
      onAuthTokenExpired,
      skillLevel,
      swellTimelineMode,
      timelineFocusBeachId,
    ]
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
      waterMaskOwedRef.current = true;
      return; // can't read the style yet → leave the field intact, retry on idle
    }
    if (waterLayerIds.length === 0) {
      // Nothing to query against; a style reload re-arms the idle remask.
      waterMaskOwedRef.current = false;
      return;
    }
    const bounds = map.getBounds();
    const center = map.getCenter();
    const cameraKey = JSON.stringify({
      west: bounds?.getWest() ?? null,
      south: bounds?.getSouth() ?? null,
      east: bounds?.getEast() ?? null,
      north: bounds?.getNorth() ?? null,
      centerLng: center.lng,
      centerLat: center.lat,
      zoom: map.getZoom(),
      width: map.getCanvas().clientWidth,
      height: map.getCanvas().clientHeight,
      waterLayerIds,
    });
    if (waterMaskCacheRef.current?.cameraKey !== cameraKey) {
      waterMaskCacheRef.current = { cameraKey, verdicts: new Map() };
    }
    const canvas = map.getCanvas();
    let needsRetry = false;
    for (const component of maskable) {
      const field = flowFieldsRef.current[component];
      if (field.cells.length === 0) continue;
      const applied = maskFieldToWater(
        field,
        map as unknown as Parameters<typeof maskFieldToWater>[1],
        {
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          waterLayerIds,
          waterMaskCache: waterMaskCacheRef.current.verdicts,
        }
      );
      if (!applied) needsRetry = true;
    }
    waterMaskOwedRef.current = needsRetry;
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
      return;
    }
    const hasPartitionData =
      partitionsMap.size > 0 ||
      partitionsTimelineMap.size > 0 ||
      hourlyTimelineSeed !== null ||
      Object.keys(expandableTimeline.partitionsByBeach).length > 0;
    if (
      swellFieldLoadStatus === "loading" &&
      (swellFieldDataInvalidatedRef.current || !hasPartitionData)
    ) {
      resetFields();
      return;
    }
    if (forecastUnavailableRef.current) {
      resetFields();
      setSwellFieldLoadStatus("unavailable");
      return;
    }
    const b = map.getBounds();
    if (!b) {
      resetFields();
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
    const embedTimelinePosition = isEmbedHourlyTimeline && hourlyTimelineSeed
      ? embedTimelineArrayPositionForHourOffset(
          hourlyTimelineSeed.timestamps,
          swellTimelineIndex,
        )
      : undefined;
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
        const partition = isExpandableTimeline
          ? partitionAtAbsoluteTimelinePosition(
              {
                timestamps: expandableTimeline.timestamps,
                partitionsByBeach: expandableTimeline.partitionsByBeach,
                hasMore: false,
                nextStart: null,
              },
              beach.id,
              expandablePlaybackPosition,
            )
          : isEmbedHourlyTimeline
            ? embedTimelinePosition === undefined
              ? Math.round(swellTimelineIndex) === 0
                ? partitionsMap.get(beach.id)
                : undefined
              : partitionAtAbsoluteTimelinePosition(
                  hourlyTimelineSeed,
                  beach.id,
                  embedTimelinePosition,
                )
            : partitionAtTimelinePosition(
              beach.id,
              timelinePosition,
              partitionsTimelineMap,
              partitionsMap,
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
    if (!anyPoints && expandableTimeline.isPlaying) {
      setSwellFieldLoadStatus("ready");
      return;
    }
    flowFieldsRef.current = nextFields;
    setSwellFieldLoadStatus(anyPoints ? "ready" : "empty");
    // Best-effort mask now; the idle/moveend listener re-masks once tiles render.
    applyWaterMask(map);
    // Nudge a repaint so a static (reduced-motion) frame reflects the new field.
    map.triggerRepaint();
  }, [
    applyWaterMask,
    beaches,
    expandableTimeline.index,
    expandableTimeline.isPlaying,
    expandableTimeline.partitionsByBeach,
    expandableTimeline.timestamps,
    expandablePlaybackPosition,
    hourlyTimelineSeed,
    isEmbedHourlyTimeline,
    isExpandableTimeline,
    isMapReady,
    mapBounds,
    maskRetryTick,
    partitionsMap,
    partitionsTimelineMap,
    showSwellField,
    swellFieldBeaches,
    swellFieldLoadStatus,
    swellLayerId,
    swellTimelineIndex,
    swellTimelineSteps.length,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const watchdog = createTileStallWatchdog(map);
    return watchdog.dispose;
  }, [isMapReady]);

  // Retry an owed provisional mask once tiles finish. Rebuilding restores cells
  // provisionally zeroed over tiles that were still loading.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !showSwellField) return;
    const remask = (): void => {
      waterMaskCacheRef.current = null;
      applyWaterMask(map);
      map.triggerRepaint();
    };
    const remaskWhenOwed = (): void => {
      if (!waterMaskOwedRef.current) return;
      if (typeof map.areTilesLoaded === "function" && !map.areTilesLoaded()) return;
      const now = Date.now();
      if (
        lastWaterMaskRetryAtRef.current !== null &&
        now - lastWaterMaskRetryAtRef.current < 1_000
      ) return;
      lastWaterMaskRetryAtRef.current = now;
      waterMaskOwedRef.current = false;
      setMaskRetryTick((tick) => tick + 1);
    };
    const invalidateForStyleReload = (): void => {
      waterMaskCacheRef.current = null;
      waterMaskOwedRef.current = true;
    };
    map.on("idle", remaskWhenOwed);
    map.on("data", remaskWhenOwed);
    map.on("sourcedata", remaskWhenOwed);
    map.on("moveend", remask);
    map.on("style.load", invalidateForStyleReload);
    const retryTimer = window.setInterval(remaskWhenOwed, 1_000);
    return () => {
      map.off("idle", remaskWhenOwed);
      map.off("data", remaskWhenOwed);
      map.off("sourcedata", remaskWhenOwed);
      map.off("moveend", remask);
      map.off("style.load", invalidateForStyleReload);
      window.clearInterval(retryTimer);
    };
  }, [isMapReady, showSwellField, applyWaterMask]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !showConditionsOnTap) return;
    const onTap = (e: mapboxgl.MapMouseEvent) => {
      const target = e.originalEvent?.target;
      if (
        target instanceof Element &&
        (target.closest('[data-testid="beach-marker"]') ||
          target.closest('[data-conditions-callout="true"]'))
      ) {
        return;
      }
      handleConditionsTapRef.current(e.lngLat);
    };
    map.on("click", onTap);
    return () => {
      map.off("click", onTap);
      removeActiveCallout();
    };
  }, [isMapReady, showConditionsOnTap, removeActiveCallout]);

  useEffect(() => {
    const open = activeCalloutRef.current;
    if (!open) return;
    // Playback advances a fractional index every tick (~12.5×/sec); rebuilding the
    // callout (SVG teardown + new marker + fresh animation) at that rate flickers
    // and churns GC on low-end phones. Only refresh when the displayed step
    // (rounded index) or the underlying partition data actually changes.
    const step = Math.round(
      Number.isFinite(swellTimelineIndex) ? swellTimelineIndex : 0
    );
    const last = lastCalloutRefreshRef.current;
    if (last && last.step === step && last.partitions === partitionsMap) return;
    const ctx = conditionsCtxRef.current;
    const beach = ctx.beaches.find((b) => b.id === open.beachId);
    if (beach) showCalloutForBeach(beach);
  }, [swellTimelineIndex, partitionsMap, showCalloutForBeach]);

  const releaseSwellFieldLeash = useCallback((map: mapboxgl.Map): void => {
    const captured = zoomLimitsCaptureRef.current;
    // Clear first even if the capture was already consumed. Async swell loads can
    // apply bounds between camera commands, and a stale bound must never clamp a
    // new explicit region or pin command back to the prior coast.
    map.setMaxBounds(null as unknown as mapboxgl.LngLatBoundsLike);
    if (!captured) return;
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

    // Only a SHAPE change (combined vs single, swell vs wind, or reduced-motion)
    // forces a teardown+re-add, which re-seeds particles and reads as a jitter.
    // Swell <-> Swell 2 share a shape, so we keep the layer and let its
    // getField/getColorHex/getDynamics retarget it via refs (a smooth transition).
    const shapeKey = !showSwellField
      ? "none"
      : `${
          swellLayerId === "combined"
            ? "combined"
            : swellLayerId === "wind"
              ? "wind"
              : "swell"
        }|${reducedMotion ? "rm" : "mo"}`;
    // Skip the teardown only when the shape is unchanged AND the layer is genuinely
    // still mounted (a style reload can wipe layers while the ref says otherwise).
    const mountedProbeId =
      swellLayerId === "combined"
        ? `${SWELL_FIELD_LAYER_ID}-${COMBINED_SUBLAYERS[0]}`
        : SWELL_FIELD_LAYER_ID;
    const alreadyCorrect =
      swellLayerKeyRef.current === shapeKey &&
      (shapeKey === "none" || !!map.getLayer(mountedProbeId));
    if (alreadyCorrect) return;

    teardown();
    swellLayerKeyRef.current = "none";
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
      // Single active layer. getField/getColorHex/getDynamics read the active
      // component via refs each frame, so Swell <-> Swell 2 retargets this same
      // layer without a teardown (no reseed jitter).
      map.addLayer(
        createSwellParticleLayer({
          id: SWELL_FIELD_LAYER_ID,
          getField: () =>
            flowFieldsRef.current[swellLayerIdRef.current as FlowComponentId],
          getColorHex: () => SWELL_FIELD_PARTICLE_COLOR[swellLayerIdRef.current],
          reducedMotion,
          viewportWidthPx,
          count:
            swellLayerId === "wind"
              ? Math.round(baseParticleCount * WIND_PARTICLE_SCALE)
              : undefined,
          markStyle: swellLayerId === "wind" ? "streak" : "dash",
          getDynamics: () => {
            const active = swellLayerIdRef.current as FlowComponentId;
            return {
              motionScale: PARTICLE_MOTION_SCALE[active],
              velocitySmoothing: PARTICLE_VELOCITY_SMOOTHING[active],
              dashLengthScale: PARTICLE_DASH_LENGTH_SCALE[active],
            };
          },
        })
      );
    }

    swellLayerKeyRef.current = shapeKey;
    // No cleanup teardown: the layer persists across same-shape switches and is
    // removed on the next shape change (or with the map on unmount).
  }, [showSwellField, isMapReady, reducedMotion, swellLayerId, mapStyleRevision]);

  // Leash the camera to the coastal data corridor while the swell field is ON.
  // Locks zoom (so users can't pull back to open-ocean/continent scale) and pins
  // a dynamic maxBounds to the loaded-beach footprint. Recomputes as beaches load
  // so the reachable corridor extends along the coast (along-coast travel chains:
  // the generous lat padding lets the next stretch enter the viewport and load,
  // which widens the bbox on the next pass). Fully restores the free camera on OFF.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (leashSuspendedCommandId !== null) {
      releaseSwellFieldLeash(map);
      appliedLeashKeyRef.current = null;
      return;
    }

    // Wait until beaches load before constraining; never leash an empty footprint.
    if (!showSwellField || swellFieldBeaches.length === 0) {
      releaseSwellFieldLeash(map);
      appliedLeashKeyRef.current = null;
      return;
    }

    const bounds = computeCoastalBounds(swellFieldBeaches);
    if (!bounds) {
      releaseSwellFieldLeash(map);
      appliedLeashKeyRef.current = null;
      return;
    }
    const center = map.getCenter();
    if (
      center.lng < bounds.west ||
      center.lng > bounds.east ||
      center.lat < bounds.south ||
      center.lat > bounds.north
    ) {
      releaseSwellFieldLeash(map);
      appliedLeashKeyRef.current = null;
      return;
    }

    // Re-applying setMaxBounds on every beach-list update (a new array reference
    // each load) is what bounced the camera inland and back: setMaxBounds(null) on
    // cleanup freed the camera, then the re-apply yanked it back to the corridor.
    // Skip when the corridor is materially unchanged so the leash applies once.
    const leashKey = `${bounds.west.toFixed(3)},${bounds.south.toFixed(3)},${bounds.east.toFixed(3)},${bounds.north.toFixed(3)}`;
    if (appliedLeashKeyRef.current === leashKey) return;

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
    appliedLeashKeyRef.current = leashKey;

    // No cleanup-release: the leash is released explicitly when the field turns off
    // (handled above) and torn down with the map on unmount. Releasing on every
    // re-run is what produced the inland/back bounce.
  }, [
    showSwellField,
    isMapReady,
    swellFieldBeaches,
    leashSuspendedCommandId,
    releaseSwellFieldLeash,
  ]);

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
        const { lng: longitude, lat: latitude } = center;
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
          (Math.abs(latitude - prevCenter.lat) > CENTER_EPS ||
            Math.abs(longitude - prevCenter.lon) > CENTER_EPS);
        const action: 'zoom' | 'pan' | null = zoomChanged
          ? 'zoom'
          : centerChanged
            ? 'pan'
            : null;
        prevZoomRef.current = zoom;
        prevCenterRef.current = { lat: latitude, lon: longitude };

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
        if (!hasViewportChanged(latitude, longitude, zoom)) {
          return;
        }
        lastViewportRef.current = { lat: latitude, lon: longitude, zoom };

        // Only populate locations with enhanced forecast data
        await populateLocations(latitude, longitude);
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

    clearMapDebugCenter();

    // Capture mount timestamp for load_time_ms / time_to_failure_ms metadata.
    mountedAtRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;
    hasEmittedReadyRef.current = false;
    emittedFailureTypesRef.current = new Set();
    setMapLoadFailure(null);

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [initialCenterRef.current[1], initialCenterRef.current[0]], // longitude, latitude
      zoom: initialZoom,
      attributionControl: false,
      logoPosition: "top-left",
    });
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "top-right"
    );

    mapRef.current = map;

    let readyMarked = false;
    let terminalLoadFailure = false;
    const reportMapFailure = (errorType: MapFailureReason): void => {
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
    };
    const loadTimeout = window.setTimeout(() => {
      if (readyMarked) return;
      terminalLoadFailure = true;
      reportMapFailure("timeout");
      setMapLoadFailure("timeout");
    }, MAP_LOAD_TIMEOUT_MS);
    const markMapReady = () => {
      if (terminalLoadFailure) return;
      if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) {
        return;
      }
      if (readyMarked) return;
      readyMarked = true;
      window.clearTimeout(loadTimeout);
      setMapLoadFailure(null);

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
      if (shouldRestoreMapFocusRef.current) {
        shouldRestoreMapFocusRef.current = false;
        window.requestAnimationFrame(() => mapContainerRef.current?.focus());
      }
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
    };

    map.on("load", markMapReady);
    map.on("styledata", markMapReady);
    map.on("idle", markMapReady);
    const styleLoadHandler = (): void => {
      setMapStyleRevision((current) => current + 1);
    };
    map.on("style.load", styleLoadHandler);

    const mapErrorHandler = (e: unknown): void => {
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
      reportMapFailure(errorType);
      if (
        !readyMarked &&
        (errorType === "token_invalid" || errorType === "webgl_unsupported")
      ) {
        terminalLoadFailure = true;
        window.clearTimeout(loadTimeout);
        setMapLoadFailure(errorType);
      }
    };
    map.on("error", mapErrorHandler);

    // Stable wrapper — delegates to the latest debounced handler via ref
    const moveEndHandler = () => {
      if (
        process.env.NODE_ENV !== "production" ||
        process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === "true"
      ) {
        const center = map.getCenter();
        (
          window as Window & {
            __quiverMapDebugCenter?: { lat: number; lon: number };
          }
        ).__quiverMapDebugCenter = { lat: center.lat, lon: center.lng };
      }
      const pendingLeashCommand = pendingLeashCommandRef.current;
      const { lng: longitude, lat: latitude } = map.getCenter();
      if (
        pendingLeashCommand &&
        cameraCommandContainsCenter(pendingLeashCommand, {
          lat: latitude,
          lon: longitude,
        })
      ) {
        pendingLeashCommandRef.current = null;
        appliedLeashKeyRef.current = null;
        setLeashSuspendedCommandId((current) =>
          current === pendingLeashCommand.id ? null : current,
        );
      }
      handleMoveEndRef.current?.();
      const activeUserGesture = activeUserCameraGestureRef.current;
      if (activeUserGesture) {
        activeUserCameraGestureRef.current = null;
        const center = map.getCenter();
        onUserCameraInteractionRef.current?.({
          action: activeUserGesture,
          center: { lat: center.lat, lon: center.lng },
          phase: "end",
        });
      }
    };
    map.on("moveend", moveEndHandler);

    const handleMapClick = (e: mapboxgl.MapMouseEvent): void => {
      const target = e.originalEvent?.target;
      if (
        target instanceof Element &&
        (target.closest('[data-testid="beach-marker"]') ||
          target.closest('[data-conditions-callout="true"]'))
      ) {
        return;
      }
      onMapClickRef.current?.(e.lngLat);
    };
    map.on("click", handleMapClick);

    const reportUserCameraInteraction = (
      action: "pan" | "zoom" | "rotate",
    ) => (event: unknown): void => {
      const originalEvent =
        typeof event === "object" && event !== null && "originalEvent" in event
          ? (event as { originalEvent?: unknown }).originalEvent
          : undefined;
      if (!originalEvent) return;
      const pendingLeashCommand = pendingLeashCommandRef.current;
      if (pendingLeashCommand) {
        pendingLeashCommandRef.current = null;
        appliedLeashKeyRef.current = null;
        setLeashSuspendedCommandId((current) =>
          current === pendingLeashCommand.id ? null : current,
        );
      }
      const center = map.getCenter();
      activeUserCameraGestureRef.current = action;
      onUserCameraInteractionRef.current?.({
        action,
        center: { lat: center.lat, lon: center.lng },
        phase: "start",
      });
    };
    const dragStartHandler = reportUserCameraInteraction("pan");
    const zoomStartHandler = reportUserCameraInteraction("zoom");
    const rotateStartHandler = reportUserCameraInteraction("rotate");
    map.on("dragstart", dragStartHandler);
    map.on("zoomstart", zoomStartHandler);
    map.on("rotatestart", rotateStartHandler);

    return () => {
      window.clearTimeout(loadTimeout);
      map.off("load", markMapReady);
      map.off("styledata", markMapReady);
      map.off("idle", markMapReady);
      map.off("style.load", styleLoadHandler);
      map.off("error", mapErrorHandler);
      map.off("moveend", moveEndHandler);
      map.off("click", handleMapClick);
      map.off("dragstart", dragStartHandler);
      map.off("zoomstart", zoomStartHandler);
      map.off("rotatestart", rotateStartHandler);
      (handleMoveEndRef.current as any)?.cancel?.();
      cleanupMap();
    };
  }, [initialZoom, cleanupMap, mapRetryNonce]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let resizeFrame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeFrame != null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        mapRef.current?.resize();
      });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (resizeFrame != null) window.cancelAnimationFrame(resizeFrame);
    };
  }, []);

  // Start geometry and forecast I/O while Mapbox loads its style. Marker creation
  // still waits for map readiness, but its data should already be available then.
  useEffect(() => {
    if (beaches !== undefined) return;
    const [latitude, longitude] = initialCenterRef.current;
    lastViewportRef.current = {
      lat: latitude,
      lon: longitude,
      zoom: initialZoom,
    };
    void populateLocations(latitude, longitude);
  }, [beaches, initialZoom, populateLocations]);

  // Reconcile against Mapbox's actual center when the style becomes ready.
  useEffect(() => {
    if (isMapReady && mapRef.current) {
      // The mount-time request already targets the initial camera and may carry
      // the embed's preloaded forecast response. Keep either its active or
      // completed result instead of replacing it for Mapbox's tiny center
      // normalization; a real camera move reconciles through moveend.
      if (lastPopulateKeyRef.current !== null) return;
      const center = mapRef.current.getCenter();
      const { lng: longitude, lat: latitude } = center;
      void populateLocations(latitude, longitude);
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
    const isInitialNativeViewport =
      regionViewport.region === "native" &&
      lastRegionViewportKeyRef.current === null;

    if (isInitialNativeViewport) {
      // Native may resolve its nearest-beach center just after the embed starts.
      // This first correction reuses the mount-time nearby result, so seed the
      // corrected camera as handled before easeTo's moveend can replace it.
      lastViewportRef.current = {
        lat: regionViewport.center[0],
        lon: regionViewport.center[1],
        zoom: regionViewport.zoom ?? map.getZoom(),
      };
    } else {
      invalidateSwellForecastState();
    }
    releaseSwellFieldLeash(map);

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
  }, [
    regionViewport,
    isMapReady,
    invalidateSwellForecastState,
    releaseSwellFieldLeash,
  ]);

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
            animation: ${reducedMotion ? "none" : "pulse 2s infinite"};
          `;
          element.appendChild(selectionRing);
        }

        // Update badge scale and background
        if (badge) {
          const waterQualityHold = getWaterQualityHold(
            beachesRef.current?.find((beach) => beach.id === beachId),
          );
          const gradient =
            waterQualityHold
              ? getConditionMarkerGradient(waterQualityHold)
              : displayMode === "water-temp"
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

          const waterQualityHold = getWaterQualityHold(
            beachesRef.current?.find((beach) => beach.id === beachId),
          );
          const gradient =
            waterQualityHold
              ? getConditionMarkerGradient(waterQualityHold)
              : displayMode === "water-temp"
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
    reducedMotion,
  ]);

  // Camera commands are monotonic. A command is applied once, after the map is
  // ready, and user gestures never create a replacement command.
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !cameraCommand) return;
    if (appliedCameraCommandIdRef.current === cameraCommand.id) return;

    // A command represents a new location intent. Invalidate any prior viewport
    // load before releasing its coastal leash so stale data cannot constrain the
    // camera back to the previous region when that request resolves.
    invalidateSwellForecastState();
    pendingLeashCommandRef.current = cameraCommand;
    setLeashSuspendedCommandId(cameraCommand.id);
    releaseSwellFieldLeash(map);
    if (cameraCommand.bounds) {
      map.fitBounds(cameraCommand.bounds, {
        padding: 48,
        maxZoom: cameraCommand.zoom ?? 13,
      });
    } else if (cameraCommand.center) {
      map.flyTo({
        center: [cameraCommand.center.lon, cameraCommand.center.lat],
        zoom: cameraCommand.zoom ?? map.getZoom(),
        duration: 800,
      });
    }
    appliedCameraCommandIdRef.current = cameraCommand.id;
  }, [
    cameraCommand,
    isMapReady,
    invalidateSwellForecastState,
    releaseSwellFieldLeash,
  ]);

  // Re-populate locations when beaches prop changes (filters applied)
  useEffect(() => {
    if (isMapReady && mapRef.current && beaches !== undefined) {
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
    const map = mapRef.current;
    if (!isMapReady || !map) return;

    const activeMarkerIds = new Set<string>();
    const registerVisibleMarker = (markerId: string): void => {
      activeMarkerIds.add(markerId);
    };
    const removeMarker = (markerId: string): void => {
      clusterCleanupRef.current.get(markerId)?.();
      clusterCleanupRef.current.delete(markerId);
      markersRef.current[markerId]?.remove();
      delete markersRef.current[markerId];
      delete markerSignatureRef.current[markerId];
    };
    const upsertMarker = (
      markerId: string,
      signature: string,
      lngLat: [number, number],
      createMarker: () => mapboxgl.Marker
    ): void => {
      registerVisibleMarker(markerId);
      const existingMarker = markersRef.current[markerId];
      if (existingMarker && markerSignatureRef.current[markerId] === signature) {
        existingMarker.setLngLat(lngLat);
        return;
      }

      removeMarker(markerId);
      const marker = createMarker().setLngLat(lngLat);
      if (map.getCanvasContainer()) {
        marker.addTo(map);
      }
      markersRef.current[markerId] = marker;
      markerSignatureRef.current[markerId] = signature;

      if (typeof window !== "undefined") {
        const instrumentationWindow = window as typeof window & {
          __quiverMapMarkerRebuildCount?: number;
          __quiverMapVisibleMarkerCount?: number;
        };
        instrumentationWindow.__quiverMapMarkerRebuildCount =
          (instrumentationWindow.__quiverMapMarkerRebuildCount ?? 0) + 1;
      }
    };

    clusters.forEach((cluster) => {
      if (cluster.isCluster && cluster.clusterId !== undefined) {
        const markerId = `cluster-${cluster.clusterId}`;
        const lngLat: [number, number] = [cluster.longitude, cluster.latitude];
        upsertMarker(
          markerId,
          JSON.stringify({
            type: "cluster",
            clusterId: cluster.clusterId,
            pointCount: cluster.pointCount,
            beachIds: cluster.beachIds,
            waveHeights: cluster.waveHeights,
            lngLat,
            displayMode,
            markerDisplay,
            clusterClickBehavior,
          }),
          lngLat,
          () => buildClusterMarker(cluster)
        );
      } else if (!cluster.isCluster && cluster.beach) {
        const location = cluster.beach;
        const markerId = `location-${location.id}`;
        const waveHeight = cluster.waveHeight;
        const lngLat: [number, number] = [cluster.longitude, cluster.latitude];

        upsertMarker(
          markerId,
          JSON.stringify({
            type: "location",
            id: location.id,
            waveHeight,
            waveLabel: displayForecastMap.get(location.id)?.label ?? null,
            conditionScore: conditionScoreMap.get(location.id),
            conditionSummary: conditionSummaryMap.get(location.id),
            waterQualityHold: getWaterQualityHold(location),
            waterTemp: waterTempMap.get(location.id),
            lngLat,
            displayMode,
            markerDisplay,
          }),
          lngLat,
          () => {
            const badgeElement = buildWaveHeightBadge(location, waveHeight, lngLat);
            return new mapboxgl.Marker({
              element: badgeElement,
              draggable: false,
              anchor: "center",
            });
          }
        );
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
      const lngLat: [number, number] = [spot.lon, spot.lat];

      upsertMarker(
        markerId,
        JSON.stringify({
          type: "custom",
          id: spot.id,
          name: spot.name,
          visibility: spot.visibility,
          markerData,
          lngLat,
        }),
        lngLat,
        () => {
          const element = createCustomSpotMarkerElement(spot, markerData);
          element.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!userRef.current) {
              trackSignupCtaClick({
                source: `custom-spot-${spot.id}`,
                cta_type: "custom_spot_marker",
              });
              setShowAuth(true);
              return;
            }

            router.push(`/custom-spots/${spot.id}`);
          });

          return new mapboxgl.Marker({
            element,
            anchor: "center",
          });
        }
      );
    });

    Object.keys(markersRef.current).forEach((markerId) => {
      if (markerId.startsWith("cluster-") || markerId.startsWith("location-") || markerId.startsWith("custom-")) {
        if (!activeMarkerIds.has(markerId)) {
          removeMarker(markerId);
        }
      }
    });

    if (typeof window !== "undefined") {
      const instrumentationWindow = window as typeof window & {
        __quiverMapVisibleMarkerCount?: number;
      };
      instrumentationWindow.__quiverMapVisibleMarkerCount = activeMarkerIds.size;
    }
    const presentationReady =
      activeMarkerIds.size > 0 ||
      beaches !== undefined ||
      swellFieldLoadStatus !== "loading";
    if (presentationReady && !hasNotifiedMapPresentationReadyRef.current) {
      hasNotifiedMapPresentationReadyRef.current = true;
      // Notify the native host in the same commit that attaches the first useful
      // markers. Waiting for another React effect adds a bridge/render round trip
      // before the native static preview can be removed.
      onMapPresentationReadyRef.current?.();
    }
    setIsMapPresentationReady(presentationReady);
  }, [
    clusters,
    customSpots,
    isMapReady,
    conditionScoreMap,
    conditionSummaryMap,
    displayForecastMap,
    waterTempMap,
    buildClusterMarker,
    buildWaveHeightBadge,
    displayMode,
    markerDisplay,
    clusterClickBehavior,
    router,
    beaches,
    markerBeaches.length,
    swellFieldLoadStatus,
  ]);

  const swellTimeline =
    showMapChrome &&
    showSwellField &&
    !isExpandableTimeline &&
    onSwellTimelineChange &&
    swellTimelineSteps.length > 0 ? (
      <SwellForecastTimeline
        steps={swellTimelineSteps}
        index={swellTimelineIndex}
        onIndexChange={onSwellTimelineChange}
        placement={displayMode === "wave-height" ? "legend" : "floating"}
      />
    ) : null;

  const expandableSwellTimeline =
    showMapChrome &&
    showSwellField &&
    isExpandableTimeline &&
    hourlyTimelineSeed ? (
      <SwellDayTimeline
        timestamps={expandableTimeline.timestamps}
        index={expandableTimeline.index}
        timezone={expandableTimeline.timezone}
        bubbleLabel={expandableTimeline.bubbleLabel}
        daySegments={expandableTimeline.daySegments}
        isPlaying={expandableTimeline.isPlaying}
        isLoadingMore={expandableTimeline.isLoadingMore}
        isExhausted={expandableTimeline.isExhausted}
        error={expandableTimeline.error}
        onIndexChange={handleExpandableTimelineIndexChange}
        onPlayingChange={handleExpandableTimelinePlayingChange}
        onRetry={expandableTimeline.retry}
        onHeightChange={setExpandableTimelineHeight}
        onPlaybackPositionChange={setExpandablePlaybackPosition}
      />
    ) : null;
  const swellStatusBottom = expandableSwellTimeline
    ? expandableTimelineHeight + 12
    : 12;

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
      className={`${className} mapbox-container relative overflow-hidden`}
      style={{ width: "100%", height: "100%" }}
    >
      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        role="region"
        aria-label="Interactive surf map"
        aria-hidden={!isMapReady || mapLoadFailure !== null}
        inert={!isMapReady || mapLoadFailure !== null ? true : undefined}
        tabIndex={-1}
      />
      {mapLoadFailure ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-[#80C8E2] px-4"
          data-testid="map-error-overlay"
          role="alert"
        >
          <div className="max-w-sm rounded-lg border border-white/25 bg-[#151C36]/95 px-5 py-4 text-center text-white shadow-lg">
            <p className="text-sm font-semibold">Map unavailable</p>
            <p className="mt-1 text-xs text-white/80">
              Nearby break details are still available. Retry the map when you’re ready.
            </p>
            <button
              ref={mapRetryButtonRef}
              type="button"
              className="mt-3 min-h-11 rounded-md bg-[#F78E42] px-4 py-2 text-sm font-semibold text-[#151C36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => {
                shouldRestoreMapFocusRef.current = true;
                setMapLoadFailure(null);
                setIsMapReady(false);
                setIsMapPresentationReady(false);
                hasNotifiedMapPresentationReadyRef.current = false;
                setMapRetryNonce((current) => current + 1);
              }}
            >
              Retry map
            </button>
          </div>
        </div>
      ) : !isMapPresentationReady ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-[#80C8E2] pt-3"
          data-testid="map-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <MapPreloadPreview
            beaches={markerBeaches}
            center={initialCenterRef.current}
            zoom={initialZoom}
            conditionSummaryMap={conditionSummaryMap}
            displayForecastMap={displayForecastMap}
          />
          <div className="relative flex items-center gap-2 rounded-lg border border-white/25 bg-[#151C36]/90 px-4 py-3 text-sm font-medium text-white shadow-lg">
            <LoaderCircle
              className="h-4 w-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
            Charting nearby breaks…
          </div>
        </div>
      ) : null}
      {showMapChrome && displayMode === "wave-height" && (
        <MapConditionLegend
          controls={swellLayerSelector}
          timeline={swellTimeline}
          bottomOffset={expandableSwellTimeline ? expandableTimelineHeight : 0}
        />
      )}
      {showMapChrome && displayMode !== "wave-height" && swellLayerSelector}
      {showMapChrome && displayMode !== "wave-height" && swellTimeline}
      {expandableSwellTimeline}
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
      {showMapChrome &&
        showSwellField &&
        isMapReady &&
        swellFieldLoadStatus === "loading" && (
          <div
            data-testid="swell-field-loading-note"
            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 px-3 py-1.5 text-[11px] text-white/90"
            style={{
              bottom: swellStatusBottom,
              background: SWELL_MAP_SURFACE.panel,
              border: `1px solid ${SWELL_MAP_SURFACE.border}`,
              borderRadius: SWELL_MAP_STICKER_RADIUS,
              boxShadow: SWELL_MAP_STICKER_SHADOW,
            }}
            role="status"
            aria-live="polite"
          >
            Loading local conditions…
          </div>
        )}
      {showMapChrome &&
        showSwellField &&
        swellFieldLoadStatus === "empty" && (
        <div
          data-testid="swell-field-empty-note"
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 px-3 py-1.5 text-[11px] text-white/80"
          style={{
            bottom: swellStatusBottom,
            background: SWELL_MAP_SURFACE.panel,
            border: `1px solid ${SWELL_MAP_SURFACE.border}`,
            borderRadius: SWELL_MAP_STICKER_RADIUS,
            boxShadow: SWELL_MAP_STICKER_SHADOW,
          }}
          role="status"
          aria-live="polite"
        >
          No swell data for this forecast hour
        </div>
      )}
      {showMapChrome &&
        showSwellField &&
        swellFieldLoadStatus === "unavailable" && (
          <div
            data-testid="swell-field-unavailable-note"
            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 px-3 py-1.5 text-[11px] text-white/90"
            style={{
              bottom: swellStatusBottom,
              background: SWELL_MAP_SURFACE.panel,
              border: `1px solid ${SWELL_MAP_SURFACE.border}`,
              borderRadius: SWELL_MAP_STICKER_RADIUS,
              boxShadow: SWELL_MAP_STICKER_SHADOW,
            }}
            role="status"
          >
            Conditions are unavailable. The map still works.
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
