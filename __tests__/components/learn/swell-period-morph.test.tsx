import { render, screen, fireEvent } from "@testing-library/react";
import SwellPeriodMorph from "@/components/learn/figures/swell-period-morph";

// jsdom has no canvas 2d context — stub it so the effect no-ops safely.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});

describe("SwellPeriodMorph", () => {
  it("renders a period slider and readouts, and updates them on change", () => {
    render(<SwellPeriodMorph />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "6" } });
    expect(screen.getByText("WIND SWELL")).toBeInTheDocument();
    expect(screen.getByText("Choppy & weak")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "16" } });
    expect(screen.getByText("GROUNDSWELL")).toBeInTheDocument();
    expect(screen.getByText("Powerful & lined-up")).toBeInTheDocument();
  });
});
