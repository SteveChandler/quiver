import { render, screen, within } from "@testing-library/react";

import { FieldGuideFeatures } from "@/components/landing-page/field-guide/field-guide-features";

// jsdom has no HTMLMediaElement.play; the inside-app panel's recording renders
// as a plain <video> here.
jest.mock("@/components/landing-page/field-guide/autoplay-video", () => ({
  AutoplayVideo: ({
    src,
    poster,
    ariaLabel,
  }: {
    src: string;
    poster?: string;
    ariaLabel: string;
  }) => <video src={src} poster={poster} aria-label={ariaLabel} />,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt = "" }: { alt?: string }) => <img alt={alt} />,
}));

describe("FieldGuideFeatures badged grid", () => {
  const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  it("shows 2 FREE and 4 PRO feature cards", () => {
    render(<FieldGuideFeatures />);
    expect(screen.getAllByText("Free")).toHaveLength(2);
    expect(screen.getAllByText("Pro")).toHaveLength(4);
  });

  it("badges pro feature cards", () => {
    render(<FieldGuideFeatures />);
    for (const title of [
      "Personal forecasting",
      "Best spot + paddle window",
      "Custom spots",
    ]) {
      const heading = screen.getByRole("heading", {
        name: new RegExp(escapeRegExp(title), "i"),
      });
      const card = heading.closest("div");
      expect(within(card as HTMLElement).getByText("Pro")).toBeInTheDocument();
    }
  });

  it("places forecast basics after personalized and pro cards", () => {
    render(<FieldGuideFeatures />);

    const features = screen.getByTestId("field-guide-features");
    const headings = within(features)
      .getAllByRole("heading", { level: 3 })
      .slice(-6);

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Personal forecasting",
      "Board-aware picks",
      "Best spot + paddle window",
      "Custom spots",
      "Honest forecasts",
      "Wind & tide reads",
    ]);
    expect(
      within(features).getByText(
        "Saved beaches and session feedback help Quiver tune the call around how you surf.",
      ),
    ).toBeInTheDocument();
    expect(
      within(features).getByText(
        "See the nearby move and the timing that looks most worth chasing.",
      ),
    ).toBeInTheDocument();
  });
});
