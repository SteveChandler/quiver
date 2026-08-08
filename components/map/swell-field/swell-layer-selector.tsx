"use client";

import type { ReactElement } from "react";
import {
  buildLegendRampCss,
  SWELL_LAYER_COLOR,
  SWELL_MAP_LEGEND_SURFACE,
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

// Combined reuses Primary's orange token (SWELL_LAYER_COLOR.combined === .s1), so a
// flat swatch would read as a SECOND orange chip. Render its indicator as a tri-segment
// dot of all three single-layer hues so it reads as "all layers" instead — three equal
// vertical bands clipped to the circle. Sanctioned hues only, no new color introduced.
const COMBINED_SWATCH_SEGMENTS: SwellLayerId[] = ["s1", "s2", "wind"];

function captionForLayer(activeLayer: SwellLayerId): string {
  if (activeLayer === "wind") return "flow streaks = wind speed & direction";
  return "denser = bigger · longer marks = longer period";
}

interface SwellLayerSelectorProps {
  active: SwellLayerId;
  onChange: (id: SwellLayerId) => void;
  placement?: "floating" | "legend";
}

export function SwellLayerSelector({
  active,
  onChange,
  placement = "floating",
}: SwellLayerSelectorProps): ReactElement {
  const isLegendPlacement = placement === "legend";
  const containerClassName = isLegendPlacement
    ? "pointer-events-auto flex w-full flex-col gap-1"
    : "pointer-events-auto absolute right-3 top-3 z-10 flex w-44 flex-col gap-1 p-1.5 sm:top-4 sm:w-52 sm:gap-1.5 sm:p-2";
  const containerStyle = isLegendPlacement
    ? undefined
    : {
        background: SWELL_MAP_SURFACE.panel,
        border: `1px solid ${SWELL_MAP_SURFACE.border}`,
        borderRadius: SWELL_MAP_STICKER_RADIUS,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
      };
  const groupClassName = isLegendPlacement
    ? "grid grid-cols-4 gap-1"
    : "grid grid-cols-2 gap-1 sm:gap-1.5";
  const optionClassName = isLegendPlacement
    ? "flex min-h-11 items-center justify-center gap-1 rounded-sm px-1 py-0.5 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] sm:gap-1.5 sm:px-2 sm:text-[10px]"
    : "flex min-h-11 items-center justify-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] sm:gap-1.5 sm:px-2 sm:py-1 sm:text-[11px]";
  const legendClassName = isLegendPlacement
    ? "mt-1 border-t pt-1"
    : "mt-1.5 hidden border-t border-white/15 pt-2 sm:block";
  const secondaryTextColor = isLegendPlacement
    ? SWELL_MAP_LEGEND_SURFACE.mutedInk
    : "rgba(255,255,255,0.7)";

  return (
    <div
      data-testid="swell-layer-selector"
      className={containerClassName}
      style={containerStyle}
    >
      <span
        className="font-heading text-[9px] uppercase tracking-wide sm:text-[10px]"
        style={{ color: secondaryTextColor }}
      >
        Swell field
      </span>
      <div
        role="group"
        aria-label="Swell field layer"
        className={groupClassName}
      >
        {LAYERS.map((layer) => {
          const isActive = layer.id === active;
          const isCombined = layer.id === "combined";
          return (
            <button
              key={layer.id}
              type="button"
              aria-pressed={isActive}
              data-testid={`swell-layer-${layer.id}`}
              onClick={() => onChange(layer.id)}
              className={optionClassName}
              style={{
                // Active chip: solid fill in its layer color + dark bold text, so the
                // selected field is unmistakable at a glance. Inactive: transparent.
                background: isActive ? SWELL_LAYER_COLOR[layer.id] : "transparent",
                color: isActive
                  ? "#161A40"
                  : isLegendPlacement
                    ? SWELL_MAP_LEGEND_SURFACE.ink
                    : "rgba(255,255,255,0.85)",
                fontWeight: isActive ? 800 : 600,
              }}
            >
              {isCombined ? (
                // Tri-segment composite so Combined reads as "all layers" rather than a
                // second Primary-orange chip — three equal bands of the single-layer
                // hues clipped to the dot. Identity survives selection (no active swap).
                <span
                  aria-hidden="true"
                  data-testid={`swell-layer-${layer.id}-swatch`}
                  className="flex h-2 w-2 overflow-hidden rounded-full sm:h-2.5 sm:w-2.5"
                >
                  {COMBINED_SWATCH_SEGMENTS.map((segId) => (
                    <span
                      key={segId}
                      data-testid={`swell-layer-combined-swatch-${segId}`}
                      className="h-full flex-1"
                      style={{ background: SWELL_LAYER_COLOR[segId] }}
                    />
                  ))}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  data-testid={`swell-layer-${layer.id}-swatch`}
                  className="h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                  style={{
                    background: isActive ? "#161A40" : SWELL_LAYER_COLOR[layer.id],
                  }}
                />
              )}
              {layer.label}
            </button>
          );
        })}
      </div>
      <div
        data-testid="swell-field-legend"
        className={legendClassName}
        style={
          isLegendPlacement
            ? { borderColor: SWELL_MAP_LEGEND_SURFACE.divider }
            : undefined
        }
      >
        <span
          className="font-heading text-[10px] uppercase tracking-wide"
          style={{ color: secondaryTextColor }}
        >
          Swell size
        </span>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-mono text-[9px]" style={{ color: secondaryTextColor }}>
            small
          </span>
          <span
            aria-hidden="true"
            data-testid="swell-field-legend-ramp"
            className="h-2 flex-1 rounded"
            style={{ background: buildLegendRampCss() }}
          />
          <span className="font-mono text-[9px]" style={{ color: secondaryTextColor }}>
            big
          </span>
        </div>
        <p
          data-testid="swell-field-legend-caption"
          className="mt-1 text-[9px] leading-tight sm:text-[10px]"
          style={{ color: secondaryTextColor }}
        >
          {captionForLayer(active)}
        </p>
      </div>
    </div>
  );
}
