"use client";

import type { ReactElement } from "react";
import {
  SWELL_LAYER_COLOR,
  SWELL_MAP_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_STICKER_RADIUS,
  type SwellLayerId,
} from "@/components/map/swell-map-theme";

const LAYERS: Array<{ id: SwellLayerId; label: string }> = [
  { id: "s1", label: "Primary" },
  { id: "s2", label: "Secondary" },
  { id: "wind", label: "Wind" },
  { id: "combined", label: "Combined" },
];

interface SwellLayerSelectorProps {
  active: SwellLayerId;
  onChange: (id: SwellLayerId) => void;
}

export function SwellLayerSelector({
  active,
  onChange,
}: SwellLayerSelectorProps): ReactElement {
  return (
    <div
      data-testid="swell-layer-selector"
      // top-16 (64px) clears the "Use My Actual Location" control above it
      // (absolute top-4 right-4, an h-10/40px button spanning 16–56px) on both
      // desktop and mobile, so the two no longer overlap in the top-right corner.
      className="pointer-events-auto absolute right-3 top-16 z-10 flex flex-col gap-1.5 p-2"
      style={{
        background: SWELL_MAP_SURFACE.panel,
        border: `1px solid ${SWELL_MAP_SURFACE.border}`,
        borderRadius: SWELL_MAP_STICKER_RADIUS,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
      }}
    >
      <span className="font-heading text-[10px] uppercase tracking-wide text-white/70">
        Swell field
      </span>
      {/* The four layers are mutually exclusive, so this is a radio group (exactly one
          checked), not a set of independent switches. */}
      <div
        role="radiogroup"
        aria-label="Swell field layer"
        className="grid grid-cols-2 gap-1.5"
      >
        {LAYERS.map((layer) => {
          const isActive = layer.id === active;
          return (
            <button
              key={layer.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              data-testid={`swell-layer-${layer.id}`}
              onClick={() => onChange(layer.id)}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              style={{
                // Active chip: solid fill in its layer color + dark bold text, so the
                // selected field is unmistakable at a glance. Inactive: transparent.
                background: isActive ? SWELL_LAYER_COLOR[layer.id] : "transparent",
                color: isActive ? "#161A40" : "rgba(255,255,255,0.85)",
                fontWeight: isActive ? 800 : 600,
              }}
            >
              <span
                aria-hidden="true"
                data-testid={`swell-layer-${layer.id}-swatch`}
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: isActive ? "#161A40" : SWELL_LAYER_COLOR[layer.id],
                }}
              />
              {layer.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
