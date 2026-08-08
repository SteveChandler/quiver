import React from "react";
import { render, screen } from "@testing-library/react";
import {
  WaveHeightDisplay,
  UNCALIBRATED_TOOLTIP_COPY,
} from "@/components/ui/wave-height-display";

function renderDisplay(
  overrides: Partial<React.ComponentProps<typeof WaveHeightDisplay>> = {}
) {
  return render(
    <WaveHeightDisplay height="3.0" showTooltip={true} {...overrides} />
  );
}

describe("WaveHeightDisplay", () => {
  describe("baseline rendering", () => {
    it("renders a displayed wave height range when height is provided", () => {
      renderDisplay({ height: "3.0", showTooltip: false });
      // 3.0 ft → "3-4 ft" (SET_WAVE_VARIANCE produces a range)
      expect(screen.getByText(/3.*ft/i)).toBeInTheDocument();
    });

    it("renders an em-dash placeholder when height is null", () => {
      render(<WaveHeightDisplay height={null} showTooltip={false} />);
      expect(screen.getByText("--")).toBeInTheDocument();
    });
  });

  describe("isCalibrated === undefined (backward compatibility)", () => {
    it("does not prepend a tilde", () => {
      renderDisplay({ showTooltip: false });
      expect(screen.queryByText("~")).toBeNull();
    });

    it("does not apply the dotted underline class", () => {
      const { container } = renderDisplay({ showTooltip: false });
      expect(container.querySelector(".border-dotted")).toBeNull();
    });

    it("renders no Face height / Forecast height label", () => {
      renderDisplay({ showTooltip: false });
      expect(screen.queryByText("Face height")).toBeNull();
      expect(screen.queryByText("Forecast height")).toBeNull();
      expect(screen.queryByTestId("wave-height-label")).toBeNull();
    });
  });

  describe("isCalibrated === true (happy path)", () => {
    it("does not prepend a tilde", () => {
      renderDisplay({ isCalibrated: true, showTooltip: false });
      expect(screen.queryByText("~")).toBeNull();
    });

    it("does not apply the dotted underline class", () => {
      const { container } = renderDisplay({
        isCalibrated: true,
        showTooltip: false,
      });
      expect(container.querySelector(".border-dotted")).toBeNull();
    });

    it("renders the primary-wave-height testid anchor", () => {
      renderDisplay({ isCalibrated: true, showTooltip: false });
      expect(screen.getByTestId("primary-wave-height")).toBeInTheDocument();
    });

    it("auto-renders the 'Face height' label below the number", () => {
      renderDisplay({ isCalibrated: true, showTooltip: false });
      const label = screen.getByTestId("wave-height-label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("Face height");
      expect(label).toHaveClass("text-[#3F382E]");
      expect(label).toHaveClass("font-medium");
      // 'Forecast height' must NOT be present
      expect(screen.queryByText("Forecast height")).toBeNull();
    });
  });

  describe("isCalibrated === false (honesty layer)", () => {
    it("prepends a tilde as a separate aria-hidden node", () => {
      const { container } = renderDisplay({
        isCalibrated: false,
        showTooltip: false,
      });
      const tilde = container.querySelector('[aria-hidden="true"]');
      expect(tilde).not.toBeNull();
      expect(tilde?.textContent).toBe("~");
    });

    it("applies the dotted underline classes to the digits span", () => {
      const { container } = renderDisplay({
        isCalibrated: false,
        showTooltip: false,
      });
      const underlinedSpan = container.querySelector(
        ".border-dotted"
      ) as HTMLElement | null;
      expect(underlinedSpan).not.toBeNull();
      expect(underlinedSpan).toHaveClass("border-b");
      expect(underlinedSpan).toHaveClass("border-dotted");
      expect(underlinedSpan?.className).toMatch(/border-muted-foreground/);
    });

    it("uses an inline-flex items-baseline container with gap", () => {
      renderDisplay({ isCalibrated: false, showTooltip: false });
      const wrapper = screen.getByTestId("primary-wave-height");
      expect(wrapper).toHaveClass("inline-flex");
      expect(wrapper).toHaveClass("items-baseline");
      // `gap-[0.5em]` is an arbitrary Tailwind value — assert substring
      expect(wrapper.className).toMatch(/gap-\[0\.5em\]/);
    });

    it("tilde is outside the dotted-underline span", () => {
      const { container } = renderDisplay({
        isCalibrated: false,
        showTooltip: false,
      });
      const underlinedSpan = container.querySelector(".border-dotted");
      expect(underlinedSpan?.textContent).not.toContain("~");
    });

    it("renders the primary-wave-height testid anchor on the wrapper", () => {
      renderDisplay({ isCalibrated: false, showTooltip: false });
      const wrapper = screen.getByTestId("primary-wave-height");
      // wrapper is the span containing both the tilde and the digits
      expect(wrapper.textContent).toContain("~");
    });

    it("with showTooltip=false suppresses the tooltip but keeps the visual marker", () => {
      const { container } = renderDisplay({
        isCalibrated: false,
        showTooltip: false,
      });
      // No tooltip trigger / content should be present
      expect(container.querySelector("[role='tooltip']")).toBeNull();
      // But the honesty marker remains
      expect(container.querySelector(".border-dotted")).not.toBeNull();
      expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });

    it("with showTooltip=true renders a Radix tooltip trigger carrying the microcopy", () => {
      renderDisplay({ isCalibrated: false, showTooltip: true });
      // The Radix TooltipContent mounts into a portal on open; we cannot
      // reliably open it in jsdom. Instead, assert that the tooltip
      // microcopy constant exported by the component matches the final
      // marketer-approved copy — this is the contract the rendered
      // tooltip body uses via {UNCALIBRATED_TOOLTIP_COPY}.
      expect(UNCALIBRATED_TOOLTIP_COPY).toBe(
        "Buoy forecast. Haven't surfed this one enough to call face height."
      );
      // And the trigger wrapper is still present
      expect(screen.getByTestId("primary-wave-height")).toBeInTheDocument();
    });

    it("auto-renders the 'Forecast height' label below the number", () => {
      renderDisplay({ isCalibrated: false, showTooltip: false });
      const label = screen.getByTestId("wave-height-label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("Forecast height");
      // 'Face height' must NOT be present
      expect(screen.queryByText("Face height")).toBeNull();
    });
  });
});
