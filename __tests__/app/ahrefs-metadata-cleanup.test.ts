import { render, screen } from "@testing-library/react";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { metadata as aboutMetadata } from "@/app/about/page";
import MexicoStatePage from "@/app/beaches/mexico/[state]/page";
import { metadata as beachesUsaMetadata } from "@/app/beaches/usa/page";

jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getAllBeachLocations: jest.fn(),
}));

describe("Ahrefs metadata cleanup", () => {
  it("keeps /about meta description under Ahrefs truncation threshold", () => {
    const headline =
      "I built Quiver because I was tired of forecasts being wrong.";

    expect(aboutMetadata.title).toEqual({ absolute: headline });
    expect(aboutMetadata.description).toContain(headline);
    expect(aboutMetadata.openGraph?.title).toBe(headline);
    expect(aboutMetadata.twitter?.title).toBe(headline);
    expect(String(aboutMetadata.description).length).toBeLessThanOrEqual(160);
  });

  it("keeps /beaches/usa meta description under Ahrefs truncation threshold", () => {
    expect(beachesUsaMetadata.description).toContain("Browse surf beaches");
    expect(String(beachesUsaMetadata.description).length).toBeLessThanOrEqual(160);
  });

  it("links Mexico state hubs to the canonical short city route", async () => {
    (getAllBeachLocations as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          city: "Rosarito",
          state: "Baja California",
          country: "Mexico",
        },
      ],
    });

    render(
      await MexicoStatePage({
        params: Promise.resolve({ state: "baja-california" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Rosarito" })).toHaveAttribute(
      "href",
      "/mexico/baja-california/rosarito",
    );
  });
});
