import { render } from "@testing-library/react";

jest.mock("next/navigation", () => ({ notFound: jest.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
jest.mock("@/components/learn/figures/learn-figure", () => ({
  LearnFigure: ({ figureKey }: { figureKey: string }) => <div data-testid="fig">{figureKey}</div>,
}));
jest.mock("@/components/learn/figures/learn-embed-footer", () => ({
  LearnEmbedFooter: () => <div data-testid="footer" />,
}));

import LearnFigureEmbedPage from "@/app/embed/learn/[figureKey]/page";
import { notFound } from "next/navigation";

describe("learn figure embed page", () => {
  it("renders the figure + footer for a valid key", async () => {
    const ui = await LearnFigureEmbedPage({ params: Promise.resolve({ figureKey: "swell-period-morph" }) });
    const { getByTestId } = render(ui);
    expect(getByTestId("fig")).toHaveTextContent("swell-period-morph");
    expect(getByTestId("footer")).toBeInTheDocument();
  });

  it("calls notFound for an invalid key", async () => {
    await expect(
      LearnFigureEmbedPage({ params: Promise.resolve({ figureKey: "nope" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
