import { getClusterColor } from "@/lib/utils/cluster-formatter";
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
  pointCount,
  hasFavorite,
  onHover,
  onLeave,
}: ClusterMarkerOptions): ClusterMarkerResult {
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
    width: 26px;
    height: 26px;
    border-radius: 50%;
    padding: 0;
    min-width: 0;
    color: white;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2.5px solid #ffffff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.45);
    cursor: pointer;
    user-select: none;
    transform-origin: center;
    transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
    background: ${bgColor};
  `;

  const label = document.createElement("span");
  label.style.fontWeight = "700";
  label.textContent = String(pointCount);

  badge.appendChild(label);

  wrapper.appendChild(badge);

  // Store handlers for cleanup
  const handleMouseEnter = () => {
    badge.style.transform = "scale(1.15)";
    badge.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.4)";
    onHover();
  };

  const handleMouseLeave = () => {
    badge.style.transform = "scale(1)";
    badge.style.boxShadow = "0 2px 6px rgba(0,0,0,0.45)";
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
