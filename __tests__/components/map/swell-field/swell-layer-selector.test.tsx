import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SwellLayerSelector } from "@/components/map/swell-field/swell-layer-selector";
import { SWELL_LAYER_COLOR } from "@/components/map/swell-map-theme";

describe("SwellLayerSelector — pressed-button semantics", () => {
  it("exposes a labelled group of four keyboard-native buttons", () => {
    render(<SwellLayerSelector active="s1" onChange={jest.fn()} />);
    const group = screen.getByRole("group", { name: "Swell field layer" });
    expect(group).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons.every((button) => button.className.includes("min-h-11"))).toBe(true);
    const pressed = buttons.filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });

  it("marks the active layer pressed and the rest unpressed", () => {
    render(<SwellLayerSelector active="wind" onChange={jest.fn()} />);
    expect(screen.getByTestId("swell-layer-wind")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("swell-layer-s1")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    // No switch role remains anywhere in the control.
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("calls onChange with the chosen layer id when a button is clicked", () => {
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

describe("SwellLayerSelector — integrated legend", () => {
  it("keeps the swell-size key inside the layer panel", () => {
    render(<SwellLayerSelector active="wind" onChange={jest.fn()} />);

    const panel = screen.getByTestId("swell-layer-selector");
    const legend = screen.getByTestId("swell-field-legend");

    expect(panel).toContainElement(legend);
    expect(screen.getByTestId("swell-field-legend-caption")).toHaveTextContent(
      "flow streaks = wind speed & direction"
    );
  });

  it("keeps the mobile selector compact while preserving the desktop legend", () => {
    render(<SwellLayerSelector active="s1" onChange={jest.fn()} />);

    const panel = screen.getByTestId("swell-layer-selector");
    const legend = screen.getByTestId("swell-field-legend");

    expect(panel).toHaveClass("w-44");
    expect(panel).toHaveClass("sm:w-52");
    expect(legend).toHaveClass("hidden");
    expect(legend).toHaveClass("sm:block");
  });

  it("renders as an embedded bottom-legend control without its own panel chrome", () => {
    render(
      <SwellLayerSelector
        active="s1"
        onChange={jest.fn()}
        placement="legend"
      />,
    );

    const panel = screen.getByTestId("swell-layer-selector");

    expect(panel.className).not.toContain("absolute");
    expect(panel.className).not.toContain("top-3");
    expect(panel).toHaveClass("w-full");
    expect(panel).toContainElement(screen.getByTestId("swell-field-legend"));
    expect(screen.getByTestId("swell-field-legend-caption")).toHaveTextContent(
      "denser = bigger · longer marks = longer period"
    );
  });
});
