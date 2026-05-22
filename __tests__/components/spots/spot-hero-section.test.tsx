import type { ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

import { SpotHeroSection } from "@/components/spots/spot-hero-section";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    unoptimized: _unoptimized,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
    priority?: boolean;
  }) => <img alt={alt} {...props} />,
}));

jest.mock("@/lib/image-proxy", () => ({
  getOptimizedImageUrl: (url: string) => `optimized:${url}`,
}));

jest.mock("@/lib/map-utils", () => ({
  getStaticMapImageUrl: () => "map://image",
}));

describe("SpotHeroSection", () => {
  it("uses generated photo iconography in the photo hero state", () => {
    render(
      <SpotHeroSection
        spotName="Huntington Beach Pier"
        latitude={33.65}
        longitude={-118}
        featuredPhotoUrl="https://example.com/photo.jpg"
        eyebrow="Live surf intel"
        subtitle="Fast, punchy beachbreak."
        metadata="Updated now"
        badges={["Jetty"]}
      />
    );

    expect(screen.getByAltText("Huntington Beach Pier surf photo")).toHaveAttribute(
      "src",
      "optimized:https://example.com/photo.jpg"
    );
    expect(screen.getAllByAltText("").some((image) =>
      image.getAttribute("src") === "/images/spot-icons/photo.png"
    )).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Huntington Beach Pier" })
    ).toBeInTheDocument();
  });
});
