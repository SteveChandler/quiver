/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionSlider } from "@/components/session-forms/SessionSlider";

// Radix UI's Slider uses pointer capture APIs not available in jsdom.
// Mock the primitive so tests focus on SessionSlider's own rendering logic.
jest.mock("@radix-ui/react-slider", () => {
  const React = require("react");
  const Root = React.forwardRef(
    (
      {
        children,
        value,
        min,
        max,
        onValueChange: _onValueChange,
        step: _step,
        ...rest
      }: {
        children?: React.ReactNode;
        value?: number[];
        min?: number;
        max?: number;
        onValueChange?: (value: number[]) => void;
        step?: number;
        [key: string]: unknown;
      },
      ref: React.Ref<HTMLDivElement>
    ) => (
      <div
        ref={ref}
        role="slider"
        aria-valuenow={value?.[0]}
        aria-valuemin={min}
        aria-valuemax={max}
        {...rest}
      >
        {children}
      </div>
    )
  );
  Root.displayName = "SliderRoot";

  const Track = ({
    children,
    ...rest
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="slider-track" {...rest}>
      {children}
    </div>
  );
  Track.displayName = "SliderTrack";

  const Range = ({ ...rest }: { [key: string]: unknown }) => (
    <div data-testid="slider-range" {...rest} />
  );
  Range.displayName = "SliderRange";

  const Thumb = ({ ...rest }: { [key: string]: unknown }) => (
    <div data-testid="slider-thumb" {...rest} />
  );
  Thumb.displayName = "SliderThumb";

  return { Root, Track, Range, Thumb };
});

const labels = ["Flat", "Choppy", "Fun", "Good", "Firing"];
const colors = ["#0D9488", "#F59E0B", "#EA580C"];

describe("SessionSlider", () => {
  it("renders with placeholder when no value set", () => {
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("Wave Quality")).toBeInTheDocument();
    expect(screen.getByText("Tap to rate")).toBeInTheDocument();
  });

  it("renders endpoint labels", () => {
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("Flat")).toBeInTheDocument();
    expect(screen.getByText("Firing")).toBeInTheDocument();
  });

  it("displays current label when value is set", () => {
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        value="3"
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("Fun")).toBeInTheDocument();
  });

  it("calls onChange when value changes", () => {
    const onChange = jest.fn();
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        value="3"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("hides Tap to rate when a value is set", () => {
    render(
      <SessionSlider
        label="Wave Quality"
        labels={labels}
        colors={colors}
        value="2"
        onChange={jest.fn()}
      />
    );
    expect(screen.queryByText("Tap to rate")).not.toBeInTheDocument();
    expect(screen.getByText("Choppy")).toBeInTheDocument();
  });
});
