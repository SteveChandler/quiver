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
      className="pointer-events-auto absolute right-3 top-3 z-10 flex flex-col gap-1.5 p-2"
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
      <div className="grid grid-cols-2 gap-1.5">
        {LAYERS.map((layer) => {
          const isActive = layer.id === active;
          return (
            <button
              key={layer.id}
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-current={isActive ? "true" : undefined}
              data-testid={`swell-layer-${layer.id}`}
              onClick={() => onChange(layer.id)}
              className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              style={{
                background: isActive
                  ? SWELL_MAP_SURFACE.panelDeep
                  : "transparent",
              }}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: SWELL_LAYER_COLOR[layer.id] }}
              />
              {layer.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
