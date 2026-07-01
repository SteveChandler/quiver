import { render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";

import { FieldGuideSpotlight } from "@/components/landing-page/field-guide/field-guide-spotlight";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    <img alt={alt} {...props} />
  ),
}));

describe("FieldGuideSpotlight", () => {
  it("renders the Swell View launch copy, free chip, and image", () => {
    render(<FieldGuideSpotlight />);

    expect(
      screen.getByRole("heading", { name: /swell view is here/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("FREE · NEW IN THE APP")).toBeInTheDocument();
    expect(screen.getByText(/free, in the app/i)).toBeInTheDocument();
    expect(screen.getByText(/318 breaks · 73 cams/i)).toBeInTheDocument();

    // The spotlight no longer carries its own CTA — a single hero "Get the app"
    // primary avoids the double-CTA "desperate" read.
    expect(
      screen.queryByRole("link", { name: /get the app/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /swell view/i })).toHaveAttribute(
      "src",
      "/images/landing/swell-view-preview-v2.png",
    );
  });
});
