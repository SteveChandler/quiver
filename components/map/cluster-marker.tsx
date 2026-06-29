import {
  formatClusterWaveRange,
  formatClusterWaterTempRange,
  getClusterColor,
} from "@/lib/utils/cluster-formatter";
import type { MapDisplayMode } from "@/components/map/map-marker-builder";

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
  // Store the color for testing (jsdom doesn't support linear-gradient)
  badge.setAttribute("data-cluster-color", bgColor);
  badge.style.cssText = `
    padding: 8px 16px;
    border-radius: 9999px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    min-width: 90px;
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

  // Combined label: "1-2ft - 2x" or just "2x" if no wave data
  const label = document.createElement("span");
  label.style.fontWeight = "700";
  if (waveRange !== "—") {
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
