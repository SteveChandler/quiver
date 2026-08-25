import type { Beach } from "@/types/database";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import type { ConditionSummary } from "@/components/map/map-beach-loader";
import type {
  MapBeach,
  WaterQualityHoldKind,
} from "@/lib/services/nearby-beach-service";

/** Controls what data the map markers display */
export type MapDisplayMode = "wave-height" | "water-temp";
export type MapMarkerDisplay = "forecast" | "points";

export interface ConditionMarkerCall {
  summary: ConditionSummary;
  label:
    | "Go now!"
    | "Go surf!"
    | "Worth a look"
    | "Slim pickings"
    | "Skip it"
    | "Water quality advisory"
    | "Water quality closure"
    | "Water quality hold"
    | "No read";
  gradient: string;
}

export interface MarkerPreviewData {
  waveLabel?: string | null;
  conditionSummary?: ConditionSummary;
  conditionScore?: number;
  waterQualityHold?: WaterQualityHoldKind | null;
}

export const CONDITION_MARKER_CALLS: ReadonlyArray<{
  summary: ConditionSummary;
  label: ConditionMarkerCall["label"];
}> = [
  { summary: "EPIC", label: "Go now!" },
  { summary: "GOOD", label: "Go surf!" },
  { summary: "FAIR", label: "Worth a look" },
  { summary: "RIDEABLE", label: "Slim pickings" },
  { summary: "MEH", label: "Skip it" },
  { summary: "UNKNOWN", label: "No read" },
];

const WATER_QUALITY_HOLD_LABELS: Record<
  WaterQualityHoldKind,
  ConditionMarkerCall["label"]
> = {
  advisory: "Water quality advisory",
  closure: "Water quality closure",
  held: "Water quality hold",
};

export function getWaterQualityHold(
  beach: Beach | undefined,
): WaterQualityHoldKind | null {
  if (beach === undefined) return null;
  const hold = (beach as Partial<MapBeach>).waterQualityHold;
  return hold === "advisory" || hold === "closure" || hold === "held"
    ? hold
    : null;
}

/**
 * Get badge background color for water temperature display.
 * Uses a warm→cold color scale.
 */
export function getWaterTempBadgeColor(temp?: string | null): string {
  if (!temp) return "linear-gradient(to right, #93B4D8, #7FA3C9)"; // cold default
  const num = parseFloat(temp);
  if (isNaN(num)) return "linear-gradient(to right, #93B4D8, #7FA3C9)";
  if (num >= 75) return "linear-gradient(to right, #F78E42, #D57835)"; // warm orange
  if (num >= 65) return "linear-gradient(to right, #FDB84B, #E5A63E)"; // mild amber
  if (num >= 55) return "linear-gradient(to right, #B8C7E0, #A3B5D1)"; // cool light blue
  return "linear-gradient(to right, #93B4D8, #7FA3C9)"; // cold steel blue
}

export function getConditionMarkerGradient(
  condition: ConditionSummary | WaterQualityHoldKind = "UNKNOWN",
): string {
  // Derived from Quiver brand/score colors but darkened for white marker text
  // on light map tiles; raw native teal (#00D4AA) is too low-contrast here.
  if (condition in WATER_QUALITY_HOLD_LABELS) {
    return "linear-gradient(to right, #991B1B, #B91C1C)";
  }
  const summary = condition as ConditionSummary;
  if (summary === "EPIC") {
    return "linear-gradient(to right, #8A5A00, #B87900)";
  }
  if (summary === "GOOD") return "linear-gradient(to right, #005B52, #008F7A)";
  if (summary === "FAIR") return "linear-gradient(to right, #8A4A12, #9E5010)";
  if (summary === "RIDEABLE") {
    return "linear-gradient(to right, #475569, #64748B)";
  }
  if (summary === "MEH") return "linear-gradient(to right, #334155, #475569)";
  return "linear-gradient(to right, #5F6673, #475569)";
}

export function getConditionMarkerCall({
  conditionSummary,
  waterQualityHold,
}: {
  conditionSummary?: ConditionSummary;
  conditionScore?: number;
  waterQualityHold?: WaterQualityHoldKind | null;
}): ConditionMarkerCall {
  const summary = conditionSummary ?? "UNKNOWN";
  const label = waterQualityHold
    ? WATER_QUALITY_HOLD_LABELS[waterQualityHold]
    : CONDITION_MARKER_CALLS.find((item) => item.summary === summary)?.label ??
      "No read";

  return {
    summary,
    label,
    gradient: getConditionMarkerGradient(waterQualityHold ?? summary),
  };
}

function getWaveHeightBadgeColor(summary?: ConditionSummary): string {
  return getConditionMarkerGradient(summary ?? "UNKNOWN");
}

function formatFallbackWaveHeight(waveHeight?: number | string | null): string {
  const parsed =
    typeof waveHeight === "number"
      ? waveHeight
      : Number.parseFloat(String(waveHeight ?? ""));
  return Number.isFinite(parsed) ? formatWaveHeightRange(parsed) : "—";
}

/**
 * Dependencies injected into createWaveHeightBadge so that the function
 * remains pure and testable — no closure capture of component state.
 */
export interface MarkerBuilderDeps {
  /** Current set of favorite beach IDs (read from ref) */
  favoriteBeachIds: Set<string>;
  /** Currently selected beach ID (read from ref) */
  selectedBeachId: string | null;
  /** Currently hovered beach ID (read from ref) */
  hoveredBeachId: string | null;
  /** Callback when a marker is hovered / unhovered */
  onHoverChange: (beachId: string | null) => void;
  /** Callback when a marker is selected */
  onSelectChange: (beachId: string | null) => void;
  /** Optional callback when a beach marker is clicked */
  onLocationClick?: (beach: Beach) => void;
  /** Router for navigation after click */
  router: { push: (url: string) => void };
  /** Whether to auto-navigate to beach page after marker click */
  autoNavigate: boolean;
  /** Display mode: wave-height (default) or water-temp */
  displayMode?: MapDisplayMode;
  /** Water temperature string for this beach (used when displayMode is water-temp) */
  waterTemp?: string | null;
  /** Canonical API-provided wave label for wave-height mode */
  waveHeightLabel?: string | null;
  /** Native-aligned condition summary for wave-height mode marker color */
  conditionSummary?: ConditionSummary;
  /** 0-100 condition score, reserved for tooltips/analytics */
  conditionScore?: number;
  /** Map visibility warning; does not make the beach recommendation-eligible. */
  waterQualityHold?: WaterQualityHoldKind | null;
  /** Marker shape mode: forecast keeps the default map; points keeps embed markers compact. */
  markerDisplay?: MapMarkerDisplay;
  /** Marker coordinate used to anchor the preview popup */
  previewLngLat?: [number, number];
  /** Opens the single-beach marker preview popup */
  onPreviewOpen?: (
    beach: Beach,
    lngLat: [number, number],
    preview: MarkerPreviewData
  ) => void;
  /** Cancels any delayed preview close */
  onPreviewHold?: () => void;
  /** Requests preview close; caller decides whether to delay */
  onPreviewClose?: () => void;
}

/**
 * Creates an enhanced wave height badge DOM element for a beach marker.
 *
 * The element includes:
 * - Styled dot colored by condition or water temperature
 * - Favorite / selected / hovered visual states
 * - Selection ring animation for the selected state
 * - Click handler that navigates to the beach page
 * - Hover handlers for interactive feedback
 *
 * @param location - The beach to create the marker for
 * @param waveHeight - Wave height value (number or string)
 * @param deps - Injected dependencies (state refs, callbacks, router)
 * @returns The wrapper HTMLElement ready to be used as a Mapbox marker element
 */
export function createWaveHeightBadge(
  location: Beach,
  waveHeight: number | string | undefined,
  deps: MarkerBuilderDeps
): HTMLElement {
  try {
    const isFavorite = deps.favoriteBeachIds.has(location.id);
    const displayMode = deps.displayMode ?? "wave-height";
    const markerDisplay = deps.markerDisplay ?? "forecast";
    const conditionSummary = deps.conditionSummary ?? "UNKNOWN";
    const previewWaveLabel =
      deps.waveHeightLabel ??
      (displayMode === "wave-height" ? formatFallbackWaveHeight(waveHeight) : null);
    const hasPreviewWaveLabel =
      previewWaveLabel && previewWaveLabel !== "—" ? previewWaveLabel : null;
    const isSelected = deps.selectedBeachId === location.id;
    const isHovered = deps.hoveredBeachId === location.id;
    const canHover =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover)").matches;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conditionMarkerCall = getConditionMarkerCall({
      conditionSummary,
      conditionScore: deps.conditionScore,
      waterQualityHold: deps.waterQualityHold,
    });

    // Create wrapper element that Mapbox will position
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-testid", "beach-marker");
    wrapper.setAttribute("data-beach-id", location.id);
    wrapper.setAttribute("data-condition-summary", conditionSummary);
    wrapper.setAttribute(
      "data-water-quality-hold",
      deps.waterQualityHold ?? "none",
    );
    if (typeof deps.conditionScore === "number") {
      wrapper.setAttribute("data-condition-score", String(deps.conditionScore));
    }
    wrapper.style.cssText = `
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create selection ring for selected state
    if (isSelected) {
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
      wrapper.appendChild(selectionRing);
    }

    // Create the actual badge element as a child
    const badge = document.createElement("button");
    badge.type = "button";
    badge.setAttribute(
      "aria-label",
      deps.waterQualityHold
        ? `${location.name} ${conditionMarkerCall.label.toLowerCase()}`
        : `View ${location.name} conditions`,
    );
    const markerGradient =
      deps.waterQualityHold
        ? getConditionMarkerGradient(deps.waterQualityHold)
        : displayMode === "water-temp"
        ? getWaterTempBadgeColor(deps.waterTemp)
        : getWaveHeightBadgeColor(conditionSummary);
    badge.setAttribute("data-marker-badge", "true");
    badge.setAttribute("data-marker-gradient", markerGradient);
    badge.style.cssText = `
      width: 44px;
      height: 44px;
      border-radius: 50%;
      padding: 0;
      cursor: pointer;
      min-width: 0;
      border: 0;
      appearance: none;
      background: transparent;
      user-select: none;
      touch-action: manipulation;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    const visual = document.createElement("span");
    visual.setAttribute("data-marker-visual", "true");
    visual.style.cssText = `
      display: block;
      width: ${markerDisplay === "points" ? "18px" : "15px"};
      height: ${markerDisplay === "points" ? "18px" : "15px"};
      border-radius: 50%;
      border: 2.5px solid #ffffff;
      background: ${markerGradient};
      pointer-events: none;
      transform-origin: center;
      transition: ${reducedMotion ? "none" : "all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)"};
      transform: scale(${isSelected ? "1.7" : isHovered ? "1.45" : "1"});
      box-shadow: ${
        isSelected
          ? "0 0 20px rgba(247, 142, 66,0.4), 0 8px 25px rgba(0, 0, 0, 0.3)"
          : isHovered
          ? "0 8px 20px rgba(0, 0, 0, 0.4)"
          : "0 2px 6px rgba(0, 0, 0, 0.45)"
      };
    `;
    if (isFavorite) {
      visual.style.borderColor = "#FDB84B";
    }
    badge.appendChild(visual);

    // Enhanced hover effects with motion
    badge.addEventListener("mouseenter", () => {
      deps.onHoverChange(location.id);
      if (canHover && deps.previewLngLat && deps.onPreviewOpen) {
        deps.onPreviewHold?.();
        deps.onPreviewOpen(location, deps.previewLngLat, {
          waveLabel: hasPreviewWaveLabel,
          conditionSummary,
          conditionScore: deps.conditionScore,
          waterQualityHold: deps.waterQualityHold,
        });
      }
    });

    badge.addEventListener("mouseleave", () => {
      deps.onHoverChange(null);
      if (canHover) {
        deps.onPreviewClose?.();
      }
    });

    let suppressSyntheticClick = false;
    const activateMarker = (e: Event): void => {
      e.stopPropagation();
      e.preventDefault();

      // Set selection state for animation
      deps.onSelectChange(location.id);

      // Track marker click
      try {
        track("map_marker_click", {
          beach_slug: slugify(location.name),
          region: location.region || undefined,
        });
      } catch {}

      // Trigger location click callback if provided
      if (deps.onLocationClick) {
        deps.onLocationClick(location);
      }

      if (!canHover) {
        if (deps.previewLngLat && deps.onPreviewOpen) {
          deps.onPreviewHold?.();
          deps.onPreviewOpen(location, deps.previewLngLat, {
            waveLabel: hasPreviewWaveLabel,
            conditionSummary,
            conditionScore: deps.conditionScore,
            waterQualityHold: deps.waterQualityHold,
          });
        }
        return;
      }

      // Animate selection and navigate after slight delay using hierarchical URL
      if (deps.autoNavigate) {
        setTimeout(() => {
          const beachUrl = getBeachHrefSafe(location);
          if (beachUrl) deps.router.push(beachUrl);
        }, 400);
      }
    };

    badge.addEventListener("click", (e) => {
      if (suppressSyntheticClick) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      activateMarker(e);
    });
    badge.addEventListener("touchstart", (e) => {
      e.stopPropagation();
    });
    badge.addEventListener("touchend", (e) => {
      suppressSyntheticClick = true;
      activateMarker(e);
      window.setTimeout(() => {
        suppressSyntheticClick = false;
      }, 500);
    });

    // Prevent any dragging or selection on the badge
    badge.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    badge.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });
    // Append badge to wrapper
    wrapper.appendChild(badge);

    return wrapper;
  } catch (e) {
    console.error("Error creating wave height badge:", e);
    // Fallback to simple wrapper with basic badge
    const fallbackWrapper = document.createElement("div");
    fallbackWrapper.style.cssText = "pointer-events: auto;";
    const fallbackBadge = document.createElement("div");
    fallbackBadge.style.cssText =
      "width: 20px; height: 20px; background: orange; border-radius: 50%; border: 2px solid white;";
    fallbackWrapper.appendChild(fallbackBadge);
    return fallbackWrapper;
  }
}
