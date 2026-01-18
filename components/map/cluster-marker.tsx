import {
  formatClusterWaveRange,
  getClusterColor,
} from "@/lib/utils/cluster-formatter";

interface ClusterMarkerOptions {
  waveHeights: (number | undefined)[];
  pointCount: number;
  hasFavorite: boolean;
  onHover: () => void;
  onLeave: () => void;
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
}: ClusterMarkerOptions): HTMLElement {
  const waveRange = formatClusterWaveRange(waveHeights);
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

  // Wave range text
  const rangeText = document.createElement("span");
  rangeText.textContent = waveRange;
  rangeText.style.fontWeight = "700";

  // Count badge
  const countBadge = document.createElement("span");
  countBadge.textContent = `${pointCount}`;
  countBadge.style.cssText = `
    background: rgba(255, 255, 255, 0.25);
    padding: 2px 6px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
  `;

  badge.appendChild(rangeText);
  badge.appendChild(countBadge);

  wrapper.appendChild(badge);

  // Hover effects on wrapper (includes badge)
  wrapper.addEventListener("mouseenter", () => {
    badge.style.transform = "scale(1.1)";
    badge.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.4)";
    onHover();
  });

  wrapper.addEventListener("mouseleave", () => {
    badge.style.transform = "scale(1)";
    badge.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    onLeave();
  });

  return wrapper;
}
