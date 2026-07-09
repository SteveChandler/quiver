import { render, screen } from "@testing-library/react";
import { FigurePoster } from "@/components/learn/figures/figure-poster";

describe("FigurePoster", () => {
  it("renders a static period-morph poster with an accessible summary", () => {
    render(<FigurePoster kind="period-morph" />);
    expect(screen.getByText(/groundswell/i)).toBeInTheDocument();
    // static: no canvas element
    expect(document.querySelector("canvas")).toBeNull();
    // accessible summary present
    expect(screen.getByText(/period/i)).toBeInTheDocument();
  });

  it("renders an origin-fetch poster", () => {
    render(<FigurePoster kind="origin-fetch" />);
    expect(document.querySelector("svg")).not.toBeNull();
    expect(document.querySelector("canvas")).toBeNull();
  });
});
