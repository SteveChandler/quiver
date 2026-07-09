import { render, screen } from "@testing-library/react";
import SwellOriginFetch from "@/components/learn/figures/swell-origin-fetch";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});

describe("SwellOriginFetch", () => {
  it("renders framed with an accessible origin/fetch summary", () => {
    render(<SwellOriginFetch />);
    expect(screen.getByText(/distant storm/i)).toBeInTheDocument();
  });
});
