import { render, screen } from "@testing-library/react";
import { FigurePoster } from "@/components/learn/figures/figure-poster";

describe("FigurePoster", () => {
  it("renders a static period-morph poster with an accessible summary", () => {
    render(<FigurePoster kind="period-morph" />);
    expect(
      screen.getByRole("img", {
        name: /groundswell has long, evenly spaced, clean wave lines/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("GROUNDSWELL vs WIND SWELL"),
    ).toBeInTheDocument();
    // static: no canvas element
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("renders an origin-fetch poster", () => {
    render(<FigurePoster kind="origin-fetch" />);
    expect(document.querySelector("svg")).not.toBeNull();
    expect(document.querySelector("canvas")).toBeNull();
  });

  it.each([
    ["wave-height-reference", /three-foot significant wave-height forecast/i],
    ["tide-window", /static tide curve rises from low to high/i],
  ] as const)("renders an accessible %s poster", (kind, name) => {
    render(<FigurePoster kind={kind} />);
    expect(screen.getByRole("img", { name })).toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeNull();
  });
});
