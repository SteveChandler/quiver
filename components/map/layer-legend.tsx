/**
 * LayerLegend — compact 5-toggle map layer panel. Rows: swell, spots, drops,
 * amenities, businesses. Toggle state persists to
 * `localStorage['quiver.map.layers.v1']` so returning users see the same
 * layer set they enabled last time.
 *
 * The `businesses` row is only enabled when the current bbox returns at least
 * one activated venue (Codex-side there is no public directory yet). When
 * disabled we surface a "QR-activated only" tooltip so users know why the row
 * is greyed out rather than assuming a bug.
 *
 * `swell` and `spots` are real map controls: owners pass the persisted state
 * down to MapView so the swell field and spot markers actually mount/unmount.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

export type LayerId =
  | "swell"
  | "spots"
  | "drops"
  | "amenities"
  | "businesses";

export type LayerState = Record<LayerId, boolean>;

export const DEFAULT_LAYERS: LayerState = {
  swell: true,
  spots: true,
  drops: true,
  amenities: false,
  businesses: false,
};

const STORAGE_KEY = "quiver.map.layers.v1";

const ROWS: Array<{ id: LayerId; label: string; dot: string }> = [
  { id: "swell", label: "Swell", dot: "#7FA7B8" },
  { id: "spots", label: "Surf Spots", dot: "#F78E42" },
  { id: "drops", label: "Surf Drops", dot: "#00D4AA" },
  { id: "amenities", label: "Amenities", dot: "#FDB84B" },
  { id: "businesses", label: "Businesses", dot: "#B91C1C" },
];

export function loadPersistedLayers(): LayerState {
  if (typeof window === "undefined") return { ...DEFAULT_LAYERS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYERS };
    const parsed = JSON.parse(raw) as Partial<LayerState>;
    return { ...DEFAULT_LAYERS, ...parsed };
  } catch {
    return { ...DEFAULT_LAYERS };
  }
}

export function persistLayers(state: LayerState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy-mode errors — legend state is not load-bearing.
  }
}

interface LayerLegendProps {
  value: LayerState;
  onChange: (next: LayerState) => void;
  /** When 0, the businesses row is disabled + tooltip is shown. */
  businessesCount?: number;
  className?: string;
  embedded?: boolean;
  showDrops?: boolean;
}

export function LayerLegend({
  value,
  onChange,
  businessesCount = 0,
  className,
  embedded = false,
  showDrops = true,
}: LayerLegendProps): ReactElement {
  const businessesEnabled = businessesCount > 0;
  const rows = showDrops ? ROWS : ROWS.filter((row) => row.id !== "drops");
  return (
    <div
      data-testid="layer-legend"
      className={
        className ??
        "pointer-events-auto absolute bottom-3 left-3 z-20 flex flex-col gap-1 rounded-md border p-2"
      }
      style={{
        background: embedded ? "transparent" : "rgba(37, 45, 107, 0.92)",
        borderColor: embedded ? "transparent" : "rgba(255, 255, 255, 0.18)",
        boxShadow: embedded ? "none" : "0 6px 18px rgba(17, 16, 13, 0.32)",
        color: "#F4EBD8",
        minWidth: 168,
      }}
    >
      <div
        className="mb-1 text-[10px] uppercase tracking-wider"
        style={{ color: "rgba(244, 235, 216, 0.7)" }}
      >
        Layers
      </div>
      {rows.map((row) => {
        const isBusiness = row.id === "businesses";
        const disabled = isBusiness && !businessesEnabled;
        const checked = value[row.id];
        const title = disabled
          ? "QR-activated only. No public directory."
          : undefined;
        return (
          <label
            key={row.id}
            data-testid={`layer-legend-row-${row.id}`}
            data-disabled={disabled ? "true" : "false"}
            title={title}
            className={`flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[12px] ${
              disabled ? "opacity-50" : "cursor-pointer"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ background: row.dot }}
              />
              <span>
                {row.label}
                {isBusiness && (
                  <span
                    className="ml-1 text-[9px] uppercase tracking-wider"
                    style={{ color: "rgba(244, 235, 216, 0.55)" }}
                  >
                    {businessesEnabled ? "" : "QR-only"}
                  </span>
                )}
              </span>
            </span>
            <input
              type="checkbox"
              data-testid={`layer-legend-toggle-${row.id}`}
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...value, [row.id]: event.target.checked });
              }}
              className="h-3 w-3 accent-[#F78E42]"
            />
          </label>
        );
      })}
    </div>
  );
}

/**
 * Convenience hook: reads persisted state on mount, writes on change. Owners
 * of the legend can bind their `value` / `onChange` directly to this.
 */
export function usePersistedLayerState(): {
  layers: LayerState;
  setLayers: (next: LayerState) => void;
} {
  const [layers, setLayersState] = useState<LayerState>(() => ({
    ...DEFAULT_LAYERS,
  }));

  useEffect(() => {
    setLayersState(loadPersistedLayers());
  }, []);

  const setLayers = useMemo(
    () => (next: LayerState) => {
      setLayersState(next);
      persistLayers(next);
    },
    [],
  );

  return { layers, setLayers };
}
