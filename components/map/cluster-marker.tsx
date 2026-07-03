import {
  formatClusterWaveRange,
  formatClusterWaterTempRange,
  getClusterColor,
} from "@/lib/utils/cluster-formatter";
import type {
  MapDisplayMode,
  MapMarkerDisplay,
} from "@/components/map/map-marker-builder";

interface ClusterMarkerOptions {
  waveHeights: (number | undefined)[];
  pointCount: number;
  hasFavorite: boolean;
  onHover: () => void;
  onLeave: () => void;
  /** Display mode: wave-height (default) or water-temp */
  displayMode?: MapDisplayMode;
  /** Water temperature strings for beaches in this cluster */
  waterTemps?: (string | undefined | null)[];
  /** Marker shape mode: forecast keeps range pills; points keeps embed clusters compact. */
  markerDisplay?: MapMarkerDisplay;
}

interface ClusterMarkerResult {
  element: HTMLElement;
  cleanup: () => void;
}

/**
 * Creates a DOM element for a cluster marker
 * Used with Mapbox GL custom markers
 */
export function createClusterMarkerElement({
  waveHeights,
  pointCount,
  hasFavorite,
  onHover,
  onLeave,
  displayMode = "wave-height",
  waterTemps,
  markerDisplay = "forecast",
}: ClusterMarkerOptions): ClusterMarkerResult {
  const waveRange = displayMode === "water-temp"
    ? formatClusterWaterTempRange(waterTemps || [])
    : formatClusterWaveRange(waveHeights);
  const bgColor = getClusterColor(hasFavorite);

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-testid", "cluster-marker");
  wrapper.style.cssText = `
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Create badge
  const badge = document.createElement("div");
  badge.setAttribute("data-cluster-badge", "true");
  badge.setAttribute("data-marker-display", markerDisplay);
  // Store the color for testing (jsdom doesn't support linear-gradient)
  badge.setAttribute("data-cluster-color", bgColor);
  badge.style.cssText = `
    ${markerDisplay === "points" ? "width: 34px; height: 34px; padding: 0;" : "padding: 8px 16px;"}
    border-radius: 9999px;
    color: white;
    font-size: ${markerDisplay === "points" ? "13px" : "14px"};
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    min-width: ${markerDisplay === "points" ? "34px" : "90px"};
    text-align: center;
    border: 2px solid white;
    user-select: none;
    transform-origin: center;
    transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: ${bgColor};
  `;

  // Forecast mode: "1-2ft - 2x". Points mode: compact count-only cluster.
  const label = document.createElement("span");
  label.style.fontWeight = "700";
  if (markerDisplay === "points") {
    label.textContent = String(pointCount);
  } else if (waveRange !== "—") {
    label.textContent = `${waveRange} - ${pointCount}x`;
  } else {
    label.textContent = `${pointCount}x`;
  }

  badge.appendChild(label);

  wrapper.appendChild(badge);

  // Store handlers for cleanup
  const handleMouseEnter = () => {
    badge.style.transform = "scale(1.1)";
    badge.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.4)";
    onHover();
  };

  const handleMouseLeave = () => {
    badge.style.transform = "scale(1)";
    badge.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    onLeave();
  };

  // Hover effects on wrapper (includes badge)
  wrapper.addEventListener("mouseenter", handleMouseEnter);
  wrapper.addEventListener("mouseleave", handleMouseLeave);

  // Return element and cleanup function
  return {
    element: wrapper,
    cleanup: () => {
      wrapper.removeEventListener("mouseenter", handleMouseEnter);
      wrapper.removeEventListener("mouseleave", handleMouseLeave);
    },
  };
}
