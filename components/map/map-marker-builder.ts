import type { Beach } from "@/types/database";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import { formatWaterTemp } from "@/lib/utils/wave-formatters";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import type { ConditionSummary } from "@/components/map/map-beach-loader";

/** Controls what data the map markers display */
export type MapDisplayMode = "wave-height" | "water-temp";

export interface ConditionMarkerCall {
  summary: ConditionSummary;
  label: "Worth it" | "Maybe" | "Scout it" | "No read";
  gradient: string;
}

export interface MarkerPreviewData {
  waveLabel?: string | null;
  conditionSummary?: ConditionSummary;
  conditionScore?: number;
}

export const CONDITION_MARKER_CALLS: ReadonlyArray<{
  summary: ConditionSummary;
  label: ConditionMarkerCall["label"];
}> = [
  { summary: "GOOD", label: "Worth it" },
  { summary: "FAIR", label: "Maybe" },
  { summary: "CHECK", label: "Scout it" },
  { summary: "UNKNOWN", label: "No read" },
];

function conditionSummaryFromScore(score?: number): ConditionSummary {
  if (typeof score !== "number" || !Number.isFinite(score)) return "UNKNOWN";
  if (score >= 70) return "GOOD";
  if (score >= 40) return "FAIR";
  return "CHECK";
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
  summary: ConditionSummary = "UNKNOWN"
): string {
  // Derived from Quiver brand/score colors but darkened for white marker text
  // on light map tiles; raw native teal (#00D4AA) is too low-contrast here.
  if (summary === "GOOD") return "linear-gradient(to right, #005B52, #008F7A)";
  if (summary === "FAIR") return "linear-gradient(to right, #8A4A12, #9E5010)";
  if (summary === "CHECK") return "linear-gradient(to right, #334155, #475569)";
  return "linear-gradient(to right, #5F6673, #475569)";
}

export function getConditionMarkerCall({
  conditionSummary,
  conditionScore,
}: {
  conditionSummary?: ConditionSummary;
  conditionScore?: number;
}): ConditionMarkerCall {
  const summary = conditionSummary ?? conditionSummaryFromScore(conditionScore);
  const label =
    CONDITION_MARKER_CALLS.find((item) => item.summary === summary)?.label ??
    "No read";

  return {
    summary,
    label,
    gradient: getConditionMarkerGradient(summary),
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
 * - Styled pill badge with wave height text
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
    const conditionSummary = deps.conditionSummary ?? "UNKNOWN";
    const badgeText = displayMode === "water-temp"
      ? formatWaterTemp(deps.waterTemp)
      : deps.waveHeightLabel ?? formatFallbackWaveHeight(waveHeight);
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

    // Create wrapper element that Mapbox will position
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-testid", "beach-marker");
    wrapper.setAttribute("data-beach-id", location.id);
    wrapper.setAttribute("data-condition-summary", conditionSummary);
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
        animation: pulse 2s infinite;
      `;
      wrapper.appendChild(selectionRing);
    }

    // Create the actual badge element as a child
    const badge = document.createElement("div");
    const markerGradient =
      displayMode === "water-temp"
        ? getWaterTempBadgeColor(deps.waterTemp)
        : getWaveHeightBadgeColor(conditionSummary);
    badge.setAttribute("data-marker-badge", "true");
    badge.setAttribute("data-marker-gradient", markerGradient);
    badge.style.cssText = `
      padding: 6px 14px;
      border-radius: 9999px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      min-width: 70px;
      text-align: center;
      border: 2px solid white;
      user-select: none;
      transform-origin: center;
      transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
      transform: scale(${isSelected ? "1.4" : isHovered ? "1.2" : "1"});
      background: ${markerGradient};
      box-shadow: ${
        isSelected
          ? "0 0 20px rgba(247, 142, 66,0.4), 0 8px 25px rgba(0, 0, 0, 0.3)"
          : isHovered
          ? "0 8px 20px rgba(0, 0, 0, 0.4)"
          : "0 4px 12px rgba(0, 0, 0, 0.3)"
      };
    `;
    if (isFavorite) {
      badge.style.borderColor = "#FDB84B";
    }
    badge.textContent = badgeText;

    // Enhanced hover effects with motion
    badge.addEventListener("mouseenter", () => {
      deps.onHoverChange(location.id);
      if (canHover && deps.previewLngLat && deps.onPreviewOpen) {
        deps.onPreviewHold?.();
        deps.onPreviewOpen(location, deps.previewLngLat, {
          waveLabel: hasPreviewWaveLabel,
          conditionSummary,
          conditionScore: deps.conditionScore,
        });
      }
    });

    badge.addEventListener("mouseleave", () => {
      deps.onHoverChange(null);
      if (canHover) {
        deps.onPreviewClose?.();
      }
    });

    // Enhanced click handler with selection animation
    badge.addEventListener("click", async (e) => {
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
    });

    // Prevent any dragging or selection on the badge
    badge.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    badge.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });
    // Prevent touchend from bubbling to Mapbox map container,
    // which would fire map.on("click") and deselect the beach
    badge.addEventListener("touchend", (e) => {
      e.stopPropagation();
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
