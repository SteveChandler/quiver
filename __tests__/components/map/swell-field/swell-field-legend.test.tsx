import { render, screen } from "@testing-library/react";
import { SwellFieldLegend } from "@/components/map/swell-field/swell-field-legend";
import { buildLegendRampCss } from "@/components/map/swell-map-theme";

describe("SwellFieldLegend", () => {
  it("renders the wave-height ramp and small/big end labels", () => {
    render(<SwellFieldLegend activeLayer="s1" />);

    expect(screen.getByText("Swell size")).toBeInTheDocument();
    expect(screen.getByText("small")).toBeInTheDocument();
    expect(screen.getByText("big")).toBeInTheDocument();

    const ramp = screen.getByTestId("swell-field-legend-ramp");
    expect(ramp).toHaveStyle({ background: buildLegendRampCss() });
  });

  it("shows the density/period key for swell layers", () => {
    render(<SwellFieldLegend activeLayer="s1" />);
    expect(screen.getByTestId("swell-field-legend-caption")).toHaveTextContent(
      "denser = bigger · longer marks = longer period"
    );
  });

  it("shows the secondary-swell layer caption (density/period, not wind)", () => {
    render(<SwellFieldLegend activeLayer="s2" />);
    expect(screen.getByTestId("swell-field-legend-caption")).toHaveTextContent(
      "denser = bigger · longer marks = longer period"
    );
  });

  it("shows the combined layer caption (density/period, not wind)", () => {
    render(<SwellFieldLegend activeLayer="combined" />);
    expect(screen.getByTestId("swell-field-legend-caption")).toHaveTextContent(
      "denser = bigger · longer marks = longer period"
    );
  });

  it("switches to the wind key for the wind layer", () => {
    render(<SwellFieldLegend activeLayer="wind" />);
    expect(screen.getByTestId("swell-field-legend-caption")).toHaveTextContent(
      "dots + tails = wind speed & direction"
    );
  });
});
