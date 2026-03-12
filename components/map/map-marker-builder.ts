import type { Beach } from "@/types/database";
import { formatWaveHeightBucket as formatWaveHeight } from "@/lib/utils/wave-formatters";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";

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
    const waveText = formatWaveHeight(waveHeight);
    const isSelected = deps.selectedBeachId === location.id;
    const isHovered = deps.hoveredBeachId === location.id;

    // Create wrapper element that Mapbox will position
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-testid", "beach-marker");
    wrapper.setAttribute("data-beach-id", location.id);
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
      background: ${
        isFavorite
          ? "linear-gradient(to right, #3b82f6, #2563eb)"
          : isSelected
          ? "linear-gradient(to right, #F78E42, #D57835)"
          : "linear-gradient(to right, #fbbf24, #f59e0b)"
      };
      box-shadow: ${
        isSelected
          ? "0 0 20px rgba(247, 142, 66,0.4), 0 8px 25px rgba(0, 0, 0, 0.3)"
          : isHovered
          ? "0 8px 20px rgba(0, 0, 0, 0.4)"
          : "0 4px 12px rgba(0, 0, 0, 0.3)"
      };
    `;
    badge.innerHTML = waveText;

    // Enhanced hover effects with motion
    badge.addEventListener("mouseenter", () => {
      deps.onHoverChange(location.id);
    });

    badge.addEventListener("mouseleave", () => {
      deps.onHoverChange(null);
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
