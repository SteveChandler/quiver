import { forwardRef, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";
import { LiveCamCard } from "@/app/vs/surfline/free/live-cam-card";

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
  camera_url: "https://example.com/live-cam",
  thumbnail_url: "https://images.example/test-beach-cam.jpg",
  photo_url: "https://photos.example/test-beach.jpg",
  regionSlug: "southern-california",
};

describe("LiveCamCard", () => {
  it("renders a proxied camera thumbnail with meaningful alt text", () => {
    render(<LiveCamCard beach={baseBeach} />);

    const image = screen.getByRole("img", {
      name: "Test Beach live surf cam preview",
    });

    expect(image).toHaveAttribute(
      "src",
      "/api/image-proxy?url=https%3A%2F%2Fimages.example%2Ftest-beach-cam.jpg",
    );
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1280px) 25vw, 304px",
    );
    expect(screen.getByText("Test Beach")).toBeInTheDocument();
    expect(screen.getByText("San Diego, CA")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Watch the Test Beach live cam in San Diego, CA",
      }),
    ).toHaveAttribute("href", "/ca/san-diego/test-beach");
  });

  it("renders the intentional fallback when no imagery is available", () => {
    render(
      <LiveCamCard
        beach={{
          ...baseBeach,
          thumbnail_url: null,
          photo_url: null,
        }}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("live-cam-image-fallback")).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("replaces failed imagery with the intentional fallback", () => {
    render(
      <LiveCamCard
        beach={{
          ...baseBeach,
          photo_url: null,
        }}
      />,
    );

    fireEvent.error(
      screen.getByRole("img", {
        name: "Test Beach live surf cam preview",
      }),
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("live-cam-image-fallback")).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
