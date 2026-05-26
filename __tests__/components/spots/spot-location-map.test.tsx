import type { ImgHTMLAttributes } from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { SpotLocationMap } from "@/components/spots/spot-location-map";

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

jest.mock("@/lib/map-utils", () => ({
  getStaticMapImageUrl: () => "map://image",
}));

describe("SpotLocationMap", () => {
  it("renders generated location iconography around the map card", async () => {
    render(
      <SpotLocationMap
        latitude={33.655}
        longitude={-117.998}
        spotName="Huntington Beach Pier"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByAltText("Map showing Huntington Beach Pier location")
      ).toHaveAttribute("src", "map://image");
    });

    expect(screen.getAllByAltText("").some((image) =>
      image.getAttribute("src") === "/images/spot-icons/location.png"
    )).toBe(true);
    expect(screen.getByText("Huntington Beach Pier")).toBeInTheDocument();
  });
});
