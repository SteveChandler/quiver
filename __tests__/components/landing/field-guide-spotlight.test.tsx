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
    // eslint-disable-next-line jsx-a11y/alt-text -- mirrors the project-level next/image test mock
    <img alt={alt} {...props} />
  ),
}));

describe("FieldGuideSpotlight", () => {
  it("renders the Swell View launch copy, free chip, CTA, and image", () => {
    render(<FieldGuideSpotlight platform="ios" />);

    expect(
      screen.getByRole("heading", { name: /swell view is here/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("FREE · NEW IN THE APP")).toBeInTheDocument();
    expect(screen.getByText(/free, in the app/i)).toBeInTheDocument();
    expect(screen.getByText(/318 breaks · 73 cams/i)).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: /get the app/i });
    expect(cta).toHaveAttribute(
      "href",
      "/download?source=landing_swell_view&placement=spotlight&platform=ios",
    );
    expect(screen.getByRole("img", { name: /swell view/i })).toHaveAttribute(
      "src",
      "/images/landing/swell-view-preview.png",
    );
  });
});
