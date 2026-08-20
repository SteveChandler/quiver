import { forwardRef, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { CamCard } from "@/components/cams/cam-card";
import { CAM_CARD_FALLBACK_IMAGE_URL } from "@/lib/media/cam-thumbnail";
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

const baseBeach: CamBeachWithRegion = {
  id: "beach-1",
  name: "Test Beach",
  slug: "test-beach",
  city: "San Diego",
  state: "CA",
  camera_url: "https://www.youtube.com/watch?v=abc123",
  thumbnail_url: "https://img.youtube.com/vi/abc123/hqdefault.jpg",
  photo_url: "https://photos.example/test-beach.jpg",
  regionSlug: "southern-california",
};

describe("CamCard", () => {
  it("falls back from a cached thumbnail to a provider thumbnail when the image fails", () => {
    render(<CamCard beach={baseBeach} />);

    const image = screen.getByAltText("Test Beach live camera");
    expect(image).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/abc123/hqdefault.jpg",
    );

    fireEvent.error(image);

    expect(screen.getByAltText("Test Beach live camera")).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    );
  });

  it("uses the beach photo before the generic fallback when no thumbnail exists", () => {
    render(
      <CamCard
        beach={{
          ...baseBeach,
          camera_url: "https://example.com/some-cam",
          thumbnail_url: null,
        }}
      />,
    );

    expect(screen.getByAltText("Test Beach live camera")).toHaveAttribute(
      "src",
      "https://photos.example/test-beach.jpg",
    );
    expect(screen.queryByText("Preview unavailable")).not.toBeInTheDocument();
  });

  it("uses the generic fallback only when no camera thumbnail or beach photo exists", () => {
    render(
      <CamCard
        beach={{
          ...baseBeach,
          camera_url: "https://example.com/some-cam",
          thumbnail_url: null,
          photo_url: null,
        }}
      />,
    );

    expect(screen.getByAltText("Test Beach live camera")).toHaveAttribute(
      "src",
      CAM_CARD_FALLBACK_IMAGE_URL,
    );
  });

  it("keeps a space before the arrow in the hover label", () => {
    render(<CamCard beach={baseBeach} />);

    expect(screen.getByText("Watch live cam →")).toBeInTheDocument();
  });

  it("keeps a space before the arrow when no preview is available", () => {
    render(
      <CamCard
        beach={{
          ...baseBeach,
          camera_url: "https://example.com/some-cam",
          thumbnail_url: null,
          photo_url: null,
        }}
      />,
    );

    fireEvent.error(screen.getByAltText("Test Beach live camera"));

    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    expect(screen.getByText("Open cam page →")).toBeInTheDocument();
  });
});
