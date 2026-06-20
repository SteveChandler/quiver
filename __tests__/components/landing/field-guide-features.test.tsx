import { render, screen, within } from "@testing-library/react";

import { FieldGuideFeatures } from "@/components/landing-page/field-guide/field-guide-features";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "" }: { alt?: string }) => <img alt={alt} />,
}));

describe("FieldGuideFeatures badged grid", () => {
  it("shows 3 FREE and 3 PRO feature cards", () => {
    render(<FieldGuideFeatures />);
    expect(screen.getAllByText("Free")).toHaveLength(3);
    expect(screen.getAllByText("Pro")).toHaveLength(3);
  });

  it("badges Smart alerts and Custom spots as Pro", () => {
    render(<FieldGuideFeatures />);
    for (const title of ["Smart alerts", "Custom spots"]) {
      const heading = screen.getByRole("heading", {
        name: new RegExp(title, "i"),
      });
      const card = heading.closest("div");
      expect(within(card as HTMLElement).getByText("Pro")).toBeInTheDocument();
    }
  });
});
