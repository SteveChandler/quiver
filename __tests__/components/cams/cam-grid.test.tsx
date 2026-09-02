import { forwardRef, type ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

import { CamGrid } from "@/components/cams/cam-grid";
import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";

type MockNextImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
};

jest.mock("next/image", () => ({
  __esModule: true,
  default: forwardRef<HTMLImageElement, MockNextImageProps>(function MockImage(
    { fill: _fill, ...props },
    ref,
  ) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img ref={ref} {...props} />;
  }),
}));

function makeBeach(index: number): CamBeachWithRegion {
  return {
    id: `beach-${index}`,
    name: `Test Beach ${index}`,
    slug: `test-beach-${index}`,
    city: "San Diego",
    state: "CA",
    camera_url: "https://www.youtube.com/watch?v=abc123",
    thumbnail_url: "https://img.youtube.com/vi/abc123/hqdefault.jpg",
    photo_url: null,
    regionSlug: "southern-california",
  };
}

describe("CamGrid", () => {
  it("keeps a space before the arrow in the region link", () => {
    render(<CamGrid beaches={[makeBeach(1), makeBeach(2)]} groupByRegion />);

    const link = screen.getByRole("link", { name: /view all/i });
    expect(link).toHaveTextContent("View all 2 cams →");
    expect(link).toHaveAttribute("href", "/cams/southern-california");
  });

  it("points a region owned by a curated surf-cams page at that owner", () => {
    const floridaBeach: CamBeachWithRegion = {
      ...makeBeach(3),
      city: "Cocoa Beach",
      state: "FL",
      regionSlug: "florida",
    };

    render(<CamGrid beaches={[floridaBeach]} groupByRegion />);

    expect(
      screen.getByRole("link", { name: /view all/i }),
    ).toHaveAttribute("href", "/surf-cams/florida");
  });

  it("keeps Hawaii on its canonical /cams directory page", () => {
    const hawaiiBeach: CamBeachWithRegion = {
      ...makeBeach(4),
      city: "Honolulu",
      state: "HI",
      regionSlug: "hawaii",
    };

    render(<CamGrid beaches={[hawaiiBeach]} groupByRegion />);

    expect(
      screen.getByRole("link", { name: /view all/i }),
    ).toHaveAttribute("href", "/cams/hawaii");
  });

  it("singularizes the region link for a single cam", () => {
    render(<CamGrid beaches={[makeBeach(1)]} groupByRegion />);

    expect(
      screen.getByRole("link", { name: /view all/i }),
    ).toHaveTextContent("View all 1 cam →");
  });
});
