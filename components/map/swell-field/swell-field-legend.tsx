"use client";

import type { ReactElement } from "react";
import {
  buildLegendRampCss,
  SWELL_MAP_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_STICKER_RADIUS,
  type SwellLayerId,
} from "@/components/map/swell-map-theme";

interface SwellFieldLegendProps {
  activeLayer: SwellLayerId;
}

// Wind reads as dots + tails (speed + direction); swell layers read as a
// flowing density/period field, so the key copy switches per layer.
function captionForLayer(activeLayer: SwellLayerId): string {
  if (activeLayer === "wind") return "dots + tails = wind speed & direction";
  return "denser = bigger · longer marks = longer period";
}

/**
 * On-brand sticker card that makes the swell flow field interpretable: a
 * wave-height ramp (small → big) plus a one-line key. Opaque navy panel, hard
 * offset shadow, asymmetric radius, NO backdrop-blur (brand law).
 */
export function SwellFieldLegend({
  activeLayer,
}: SwellFieldLegendProps): ReactElement {
  return (
    <div
      data-testid="swell-field-legend"
      className="pointer-events-none w-44 p-2 text-white"
      style={{
        background: SWELL_MAP_SURFACE.panel,
        border: `1px solid ${SWELL_MAP_SURFACE.border}`,
        borderRadius: SWELL_MAP_STICKER_RADIUS,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
      }}
    >
      <span className="font-heading text-[10px] uppercase tracking-wide text-white/70">
        Swell size
      </span>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="font-mono text-[9px] text-white/70">small</span>
        <span
          aria-hidden="true"
          data-testid="swell-field-legend-ramp"
          className="h-2 flex-1 rounded"
          style={{ background: buildLegendRampCss() }}
        />
        <span className="font-mono text-[9px] text-white/70">big</span>
      </div>
      <p
        data-testid="swell-field-legend-caption"
        className="mt-1.5 text-[10px] leading-tight text-white/70"
      >
        {captionForLayer(activeLayer)}
      </p>
    </div>
  );
}
