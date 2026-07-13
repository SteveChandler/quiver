import { render } from "@testing-library/react";

// Stub next/dynamic to synchronously render a marker so we can assert the branch.
jest.mock("next/dynamic", () => () => function Stub() {
  return <div data-testid="figure-mount" />;
});

import { LearnFigure } from "@/components/learn/figures/learn-figure";

describe("LearnFigure", () => {
  it("mounts a figure for a registered key", () => {
    const { getByTestId } = render(<LearnFigure figureKey={"swell-period-morph" as never} />);
    expect(getByTestId("figure-mount")).toBeInTheDocument();
  });

  it("renders nothing for an unknown key", () => {
    const { container } = render(<LearnFigure figureKey={"bogus" as never} />);
    expect(container).toBeEmptyDOMElement();
  });
});
