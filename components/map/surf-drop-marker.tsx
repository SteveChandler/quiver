/**
 * Surf Drop map marker — a cream sticker card with the creator's avatar (or
 * their initial) tilted at ±3deg, surrounded by pulsing sonar rings. Rendered
 * imperatively into a Mapbox `Marker` (see surf-drops-layer.tsx) because it
 * needs to attach directly to the map canvas rather than mount through React's
 * DOM tree.
 *
 * Exports:
 *  - `buildSurfDropMarkerElement(drop, opts)` — pure DOM factory (Jest-safe).
 *  - `SurfDropMarker` — React wrapper for storybook / preview surfaces.
 *
 * The pure factory is what SurfDropsLayer actually calls; the React wrapper is
 * exported only so the marker can be exercised in tests / previews without
 * requiring a live Mapbox instance.
 */
"use client";

import type { ReactElement } from "react";

export interface SurfDropMarkerData {
  id: string;
  share_slug: string;
  lat: number;
  lon: number;
  spot_name: string | null;
  general_area: string | null;
  starts_at: string;
  ends_at: string;
  creator: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface BuildSurfDropMarkerOptions {
  /** If true, skip the CSS animation and render a single static ring. */
  reducedMotion?: boolean;
  /** Handler invoked when the marker is clicked. */
  onClick?: (drop: SurfDropMarkerData) => void;
}

const AVATAR_FALLBACK_COLORS = [
  "#F78E42",
  "#FDB84B",
  "#00D4AA",
  "#7FA7B8",
  "#B91C1C",
] as const;

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_FALLBACK_COLORS[hash % AVATAR_FALLBACK_COLORS.length];
}

function initialFor(displayName: string | null | undefined): string {
  if (!displayName) return "?";
  const trimmed = displayName.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function tiltDeg(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 17 + seed.charCodeAt(i)) >>> 0;
  }
  // Bucket into -3, -2, -1, 1, 2, 3 (skip 0 to keep the sticker feel).
  const buckets = [-3, -2, -1, 1, 2, 3];
  return buckets[hash % buckets.length];
}

/**
 * Pure DOM factory for the Surf Drop map marker. No React, no Mapbox — testable
 * with `document.createElement` in Jest.
 */
export function buildSurfDropMarkerElement(
  drop: SurfDropMarkerData,
  opts: BuildSurfDropMarkerOptions = {},
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-testid", "surf-drop-marker");
  wrapper.setAttribute("data-drop-id", drop.id);
  wrapper.setAttribute("data-share-slug", drop.share_slug);
  wrapper.className = "quiver-surf-drop-marker";
  wrapper.style.cssText = `
    position: relative;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    cursor: pointer;
    transform: rotate(${tiltDeg(drop.id)}deg);
    transform-origin: center;
  `;

  const reduced = Boolean(opts.reducedMotion);
  const ringCount = reduced ? 1 : 2;
  for (let i = 0; i < ringCount; i += 1) {
    const ring = document.createElement("span");
    ring.setAttribute("aria-hidden", "true");
    ring.setAttribute("data-testid", "surf-drop-sonar-ring");
    ring.style.cssText = `
      position: absolute;
      inset: -6px;
      border-radius: 999px;
      border: 2px solid rgba(247, 142, 66, 0.55);
      pointer-events: none;
      ${
        reduced
          ? "opacity: 0.55;"
          : `animation: sonar-pulse 2.4s ease-out ${i * 0.8}s infinite;`
      }
    `;
    wrapper.appendChild(ring);
  }

  // Cream sticker card — the container the avatar sits on.
  const card = document.createElement("div");
  card.style.cssText = `
    position: relative;
    z-index: 2;
    width: 40px;
    height: 40px;
    border-radius: 12px 10px 14px 8px;
    background: #F4EBD8;
    border: 1.5px solid #11100D;
    box-shadow: 0 4px 10px rgba(17, 16, 13, 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  `;

  // Orange avatar dot (or the initial when no avatar_url is present).
  const avatar = document.createElement("div");
  avatar.setAttribute("data-testid", "surf-drop-avatar");
  const fallbackColor = pickColor(drop.creator.id || drop.id);
  avatar.style.cssText = `
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: ${drop.creator.avatar_url ? "#F78E42" : fallbackColor};
    color: #FFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 700;
    font-size: 13px;
    line-height: 1;
    border: 2px solid #FFF;
    box-shadow: 0 1px 3px rgba(17, 16, 13, 0.35);
  `;

  if (drop.creator.avatar_url) {
    const img = document.createElement("img");
    img.src = drop.creator.avatar_url;
    img.alt = "";
    img.style.cssText =
      "width: 100%; height: 100%; object-fit: cover; border-radius: 999px;";
    avatar.appendChild(img);
  } else {
    avatar.textContent = initialFor(drop.creator.display_name);
  }

  card.appendChild(avatar);
  wrapper.appendChild(card);

  if (opts.onClick) {
    wrapper.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      opts.onClick?.(drop);
    });
    // Prevent the click from bubbling to the map canvas and dismissing the popup.
    wrapper.addEventListener("touchend", (event) => {
      event.stopPropagation();
    });
  }

  return wrapper;
}

interface SurfDropMarkerProps {
  drop: SurfDropMarkerData;
  reducedMotion?: boolean;
  onClick?: (drop: SurfDropMarkerData) => void;
}

/**
 * Storybook / preview-only React wrapper. In production the marker is inserted
 * imperatively via `buildSurfDropMarkerElement` from SurfDropsLayer.
 */
export function SurfDropMarker({
  drop,
  reducedMotion,
  onClick,
}: SurfDropMarkerProps): ReactElement {
  return (
    <div
      data-testid="surf-drop-marker-preview"
      // Wrapper only — the marker itself is inserted via effect on the client.
      ref={(node) => {
        if (!node) return;
        node.innerHTML = "";
        node.appendChild(
          buildSurfDropMarkerElement(drop, { reducedMotion, onClick }),
        );
      }}
    />
  );
}
