import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { ZineHeroMedia } from "@/components/beach-detail/zine/zine-hero-media";
import { CamsSection } from "@/components/beach-detail/cams-section";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { BeachSources } from "@/hooks/use-beach-detail-data";

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: jest.fn(),
}));

jest.mock("@/components/beach-detail/cams-section", () => ({
  CamsSection: jest.fn(() => <div data-testid="cam-still" />),
}));

const mediaProps = {
  beachName: "Lower Trestles",
  locationName: "San Onofre, CA",
  hasLiveCam: false,
};

describe("ZineHeroMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it("limits the explicit client entry point to the media module", () => {
    const hero = readFileSync(resolve("components/beach-detail/zine/zine-hero.tsx"), "utf8");
    const media = readFileSync(resolve("components/beach-detail/zine/zine-hero-media.tsx"), "utf8");

    expect(hero).not.toMatch(/^\s*["']use client["']/);
    expect(media).toMatch(/^\s*["']use client["']/);
  });

  it("prefers a valid photo and preserves responsive heights and attribution", () => {
    render(
      <ZineHeroMedia
        {...mediaProps}
        photoUrl="/photo.jpg"
        sources={{ diorama_url: "/trestles.mp4" }}
        attributionKind="profile"
        attributionName="Jo"
        attributionProfileId="profile-1"
      />,
    );

    expect(screen.getByAltText("Lower Trestles, San Onofre, CA")).toHaveClass(
      "h-[240px]", "w-full", "object-cover", "sm:h-[320px]", "md:h-[380px]",
    );
    expect(screen.queryByLabelText(/Illustrated scene/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jo" })).toHaveAttribute("href", "/profile/profile-1");
  });

  it("uses the labeled map when media is missing", () => {
    render(<ZineHeroMedia {...mediaProps} />);

    expect(screen.getByRole("img", { name: "Map showing Lower Trestles at its actual location" })).toBeInTheDocument();
    expect(screen.queryByText("HERO PHOTO")).not.toBeInTheDocument();
  });

  it("renders the diorama as a muted inline video with the original responsive heights", () => {
    render(<ZineHeroMedia {...mediaProps} sources={{ diorama_url: "/trestles.mp4" }} />);

    const video = screen.getByLabelText("Illustrated scene of Lower Trestles; not live conditions") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", "/trestles.mp4");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video).not.toHaveAttribute("controls");
    expect(video).toHaveClass("h-[240px]", "w-full", "object-cover", "sm:h-[320px]", "md:h-[380px]");
  });

  it("offers controls without autoplay or looping when motion is reduced", () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    render(<ZineHeroMedia {...mediaProps} sources={{ diorama_url: "/trestles.mp4" }} />);

    const video = screen.getByLabelText("Illustrated scene of Lower Trestles; not live conditions");
    expect(video).toHaveAttribute("controls");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).not.toHaveAttribute("loop");
  });

  it("falls back from a failed photo to video, then to the map without retrying failed URLs", () => {
    render(
      <ZineHeroMedia
        {...mediaProps}
        photoUrl="/missing.jpg"
        sources={{ diorama_url: "/missing.mp4" }}
        attributionHtml="Photo by Jo"
      />,
    );

    fireEvent.error(screen.getByAltText("Lower Trestles, San Onofre, CA"));
    expect(screen.queryByAltText("Lower Trestles, San Onofre, CA")).not.toBeInTheDocument();
    expect(screen.queryByText("Photo by Jo")).not.toBeInTheDocument();
    fireEvent.error(screen.getByLabelText("Illustrated scene of Lower Trestles; not live conditions"));

    expect(screen.queryByLabelText(/Illustrated scene/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Map showing Lower Trestles at its actual location" })).toBeInTheDocument();
  });

  it("delegates stored cam stills to the existing hero cam component", () => {
    const sources: BeachSources = { camera_url: null, cam_thumbnail_url: "/still.jpg" };
    render(<ZineHeroMedia {...mediaProps} sources={sources} />);

    expect(screen.getByTestId("cam-still")).toBeInTheDocument();
    expect(jest.mocked(CamsSection).mock.calls[0][0]).toEqual({
      sources,
      variant: "hero",
      beachName: "Lower Trestles",
    });
  });

  it("leads with the live cam over a photo or diorama", () => {
    const sources: BeachSources = {
      camera_url: "https://cams.example.com/tourmaline.mp4",
      diorama_url: "/trestles.mp4",
    };
    render(
      <ZineHeroMedia
        {...mediaProps}
        hasLiveCam
        photoUrl="/photo.jpg"
        sources={sources}
        attributionHtml="Photo by Jo"
      />,
    );

    expect(screen.getByTestId("cam-still")).toBeInTheDocument();
    expect(jest.mocked(CamsSection).mock.calls[0][0]).toEqual({
      sources,
      variant: "hero",
      beachName: "Lower Trestles",
    });
    expect(screen.queryByAltText("Lower Trestles, San Onofre, CA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Illustrated scene/)).not.toBeInTheDocument();
    expect(screen.queryByText("Photo by Jo")).not.toBeInTheDocument();
  });
});
