import { forwardRef, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { CamsHeroContactSheet } from "@/components/cams/cams-hero-contact-sheet";
import { CamCard } from "@/components/cams/cam-card";
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
  playback: { kind: "inline" },
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

    fireEvent.error(screen.getByAltText("Test Beach live camera"));
    expect(screen.getByAltText("Test Beach beach photo")).toHaveAttribute(
      "src",
      "/api/image-proxy?url=https%3A%2F%2Fphotos.example%2Ftest-beach.jpg",
    );

    fireEvent.error(screen.getByAltText("Test Beach beach photo"));
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
  });

  it("uses an actual beach photo when no camera thumbnail exists", () => {
    render(
      <CamCard
        beach={{
          ...baseBeach,
          camera_url: "https://example.com/some-cam",
          thumbnail_url: null,
        }}
      />,
    );

    expect(screen.getByAltText("Test Beach beach photo")).toHaveAttribute(
      "src",
      "/api/image-proxy?url=https%3A%2F%2Fphotos.example%2Ftest-beach.jpg",
    );
    expect(screen.queryByText("Preview unavailable")).not.toBeInTheDocument();
  });

  it("shows no image when neither a camera thumbnail nor beach photo exists", () => {
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

    expect(screen.queryByAltText("Test Beach live camera")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
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

    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    // A failed preview does not change what the click gives (quiver#1477).
    expect(screen.getByText("Watch live cam →")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("does not show LIVE for a spot with only a fallback photo and no player", () => {
    render(
      <CamCard
        beach={{
          ...baseBeach,
          name: "Cannon Beach (Ecola/Indian)",
          slug: "cannon-beach-ecolaindian",
          city: "Cannon Beach",
          state: "OR",
          camera_url: "https://cbccstaff.net/whats-new/webcam/",
          thumbnail_url: null,
          playback: { kind: "none" },
        }}
      />,
    );

    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.queryByText(/Watch/)).not.toBeInTheDocument();
    expect(screen.getByText("View forecast →")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/or/cannon-beach/cannon-beach-ecolaindian",
    );
  });

  it("sends a provider-only cam to the named provider instead of promising a player", () => {
    render(
      <CamCard
        beach={{
          ...baseBeach,
          name: "Muir Beach",
          camera_url: "https://www.sigward.com/",
          thumbnail_url: null,
          playback: {
            kind: "external",
            provider: "Muir Beach Webcam",
            pageUrl: "https://www.sigward.com/",
          },
        }}
      />,
    );

    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.getByText("Live on Muir Beach Webcam ↗")).toBeInTheDocument();
    expect(screen.getByText("Watch on Muir Beach Webcam ↗")).toBeInTheDocument();
    expect(screen.getByText("Plays on sigward.com")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.sigward.com/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

 it("routes untrusted hero photos through the proxy and shows no stock fallback when rejected", () => {
   render(<CamsHeroContactSheet beaches={[{ ...baseBeach, camera_url: "https://example.com/cam", thumbnail_url: null, photo_url: "https://untrusted.example/photo.jpg" }]} label="Featured cameras" />);
   const image = screen.getByAltText("Test Beach surf cam preview");
   expect(image).toHaveAttribute("src", "/api/image-proxy?url=https%3A%2F%2Funtrusted.example%2Fphoto.jpg");
   fireEvent.error(image);
   expect(image).not.toBeInTheDocument();
   expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
 });

 it("omits beaches without playback from the hero roll", () => {
   render(<CamsHeroContactSheet beaches={[{ ...baseBeach, name: "Cannon Beach", playback: { kind: "none" } }, baseBeach]} label="Featured cameras" />);

   expect(screen.queryByText("Cannon Beach")).not.toBeInTheDocument();
   expect(screen.getByText("Test Beach")).toBeInTheDocument();
 });

it("walks the hero image chain to the beach photo before showing no preview", () => {
  render(<CamsHeroContactSheet beaches={[{ ...baseBeach, thumbnail_url: null }]} label="Featured cameras" />);
  fireEvent.error(screen.getByAltText("Test Beach surf cam preview"));
  expect(screen.getByAltText("Test Beach surf cam preview")).toHaveAttribute(
    "src",
    "/api/image-proxy?url=https%3A%2F%2Fphotos.example%2Ftest-beach.jpg",
  );
  fireEvent.error(screen.getByAltText("Test Beach surf cam preview"));
  expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
});
