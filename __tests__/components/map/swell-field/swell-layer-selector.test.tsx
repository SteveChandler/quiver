import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SwellLayerSelector } from "@/components/map/swell-field/swell-layer-selector";
import { SWELL_LAYER_COLOR } from "@/components/map/swell-map-theme";

describe("SwellLayerSelector — radiogroup semantics", () => {
  it("exposes a radiogroup of four mutually-exclusive radio options", () => {
    render(<SwellLayerSelector active="s1" onChange={jest.fn()} />);
    const group = screen.getByRole("radiogroup", { name: "Swell field layer" });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    // Exactly one is checked at a time (radio semantics, not switch).
    const checked = radios.filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });

  it("marks the active layer checked and the rest unchecked", () => {
    render(<SwellLayerSelector active="wind" onChange={jest.fn()} />);
    expect(screen.getByTestId("swell-layer-wind")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("swell-layer-s1")).toHaveAttribute(
      "aria-checked",
      "false"
    );
    // No switch role remains anywhere in the control.
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("calls onChange with the chosen layer id when a radio is clicked", () => {
    const onChange = jest.fn();
    render(<SwellLayerSelector active="s1" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("swell-layer-combined"));
    expect(onChange).toHaveBeenCalledWith("combined");
  });
});

describe("SwellLayerSelector — combined chip composite swatch", () => {
  // jsdom serializes a solid hex background to rgb(...), so compare via a normalized
  // rgb form rather than the raw hex.
  const hexToRgb = (hex: string): string => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  };
  const segBg = (segId: string): string =>
    screen.getByTestId(`swell-layer-combined-swatch-${segId}`).style.background;

  it("renders the Combined swatch as a composite of all three layer hues", () => {
    render(<SwellLayerSelector active="s1" onChange={jest.fn()} />);
    // The composite exposes ALL THREE single-layer hues (one solid band each) so
    // Combined reads as "all layers" rather than a second Primary-orange chip.
    expect(segBg("s1")).toBe(hexToRgb(SWELL_LAYER_COLOR.s1));
    expect(segBg("s2")).toBe(hexToRgb(SWELL_LAYER_COLOR.s2));
    expect(segBg("wind")).toBe(hexToRgb(SWELL_LAYER_COLOR.wind));
  });

  it("keeps single-layer swatches a single hue (not a composite)", () => {
    render(<SwellLayerSelector active="combined" onChange={jest.fn()} />);
    // Inactive single-layer chip shows exactly its own hue, with no composite segments.
    expect(screen.getByTestId("swell-layer-s2-swatch").style.background).toBe(
      hexToRgb(SWELL_LAYER_COLOR.s2)
    );
    expect(
      screen.queryByTestId("swell-layer-s2-swatch-wind")
    ).toBeNull();
  });

  it("keeps the Combined composite even when Combined is the active layer", () => {
    render(<SwellLayerSelector active="combined" onChange={jest.fn()} />);
    expect(segBg("s1")).toBe(hexToRgb(SWELL_LAYER_COLOR.s1));
    expect(segBg("s2")).toBe(hexToRgb(SWELL_LAYER_COLOR.s2));
    expect(segBg("wind")).toBe(hexToRgb(SWELL_LAYER_COLOR.wind));
  });
});
