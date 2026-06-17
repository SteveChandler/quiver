import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SwellLayerSelector } from "@/components/map/swell-field/swell-layer-selector";

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
