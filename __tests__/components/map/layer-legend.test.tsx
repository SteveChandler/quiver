import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  DEFAULT_LAYERS,
  LayerLegend,
  loadPersistedLayers,
  persistLayers,
  type LayerState,
} from "@/components/map/layer-legend";

function Harness({
  initial,
  businessesCount,
}: {
  initial?: LayerState;
  businessesCount?: number;
}) {
  const [layers, setLayers] = useState<LayerState>(initial ?? { ...DEFAULT_LAYERS });
  return (
    <LayerLegend
      value={layers}
      onChange={(next) => {
        setLayers(next);
        persistLayers(next);
      }}
      businessesCount={businessesCount ?? 0}
    />
  );
}

describe("LayerLegend", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders five rows including the dormant businesses row", () => {
    render(<Harness />);
    expect(screen.getByTestId("layer-legend-row-swell")).toBeInTheDocument();
    expect(screen.getByTestId("layer-legend-row-spots")).toBeInTheDocument();
    expect(screen.getByTestId("layer-legend-row-drops")).toBeInTheDocument();
    expect(screen.getByTestId("layer-legend-row-amenities")).toBeInTheDocument();
    const businesses = screen.getByTestId("layer-legend-row-businesses");
    expect(businesses).toHaveAttribute("data-disabled", "true");
    expect(businesses).toHaveAttribute(
      "title",
      "QR-activated only. No public directory.",
    );
  });

  it("enables the businesses row when the bbox has activated venues", () => {
    render(<Harness businessesCount={2} />);
    const businesses = screen.getByTestId("layer-legend-row-businesses");
    expect(businesses).toHaveAttribute("data-disabled", "false");
    const toggle = screen.getByTestId(
      "layer-legend-toggle-businesses",
    ) as HTMLInputElement;
    expect(toggle.disabled).toBe(false);
  });

  it("toggles a row and persists the state to localStorage", () => {
    render(<Harness />);
    const dropsToggle = screen.getByTestId(
      "layer-legend-toggle-drops",
    ) as HTMLInputElement;
    expect(dropsToggle.checked).toBe(true);
    fireEvent.click(dropsToggle);
    expect(dropsToggle.checked).toBe(false);
    const persisted = loadPersistedLayers();
    expect(persisted.drops).toBe(false);
    // Other defaults preserved.
    expect(persisted.swell).toBe(true);
    expect(persisted.spots).toBe(true);
  });

  it("loadPersistedLayers merges with defaults for partial payloads", () => {
    localStorage.setItem(
      "quiver.map.layers.v1",
      JSON.stringify({ amenities: true }),
    );
    const state = loadPersistedLayers();
    expect(state.amenities).toBe(true);
    expect(state.drops).toBe(true);
  });
});
