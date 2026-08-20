import React from "react";
import { render, screen } from "@testing-library/react";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { ZineHero } from "@/components/beach-detail/zine/zine-hero";
import { WaterTempSummaryHero } from "@/components/beach-detail/water-temp-summary-hero";
import type { BeachSources } from "@/hooks/use-beach-detail-data";

describe("ZineHero heading level", () => {
  it("uses h1 by default for canonical beach pages", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });

    render(<ZineHero beach={beach} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Seaside Reef" }),
    ).toBeInTheDocument();
  });

  it("can demote the beach title when a subpage supplies the canonical h1", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });

    render(<ZineHero beach={beach} headingLevel="h2" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Seaside Reef" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Seaside Reef" }),
    ).not.toBeInTheDocument();
  });

  it("integrates the water-temperature guide into the beach identity hero", () => {
    const beach = createMockBeach({
      name: "Ocean Beach",
      city: "San Diego",
      state: "CA",
    });

    render(
      <ZineHero
        beach={beach}
        headingSuffix="Water Temp & Wetsuit Guide"
        summarySlot={
          <WaterTempSummaryHero
            beachName={beach.name}
            seasonalTrendsHref="/water-temp/san-diego#seasonal-trends"
            seasonalTrendsLocation="San Diego"
            waterTempData={{ tempF: 67, wetsuitRec: "3/2mm fullsuit" }}
          />
        }
      />,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ocean Beach Water Temp & Wetsuit Guide",
      }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText(
      "Current water temperature at Ocean Beach",
    );
    expect(summary).toHaveTextContent("67°F");
    expect(summary).toHaveTextContent("19°C");
    expect(summary).toHaveTextContent("Mild");
    expect(summary).toHaveTextContent("3/2mm fullsuit");
    expect(
      screen.getByRole("link", { name: /seasonal water trends for san diego/i }),
    ).toHaveAttribute("href", "/water-temp/san-diego#seasonal-trends");
  });

  it("uses the beach coordinates to render a real static location map", () => {
    const previousToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "test-map-token";
    const beach = createMockBeach({
      name: "Tourmaline Beach",
      city: "San Diego",
      state: "CA",
      lat: 32.805149,
      lon: -117.262364,
    });

    try {
      render(<ZineHero beach={beach} />);

      const map = screen.getByRole("img", {
        name: "Map showing Tourmaline Beach at its actual location",
      });
      const mapImage = map.querySelector("img");

      expect(mapImage).toHaveAttribute(
        "src",
        expect.stringContaining("-117.262364,32.805149,15,0"),
      );
    } finally {
      if (previousToken === undefined) {
        delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      } else {
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = previousToken;
      }
    }
  });

  it("renders a stored cam still in the hero when the live stream URL is unavailable", () => {
    const beach = createMockBeach({
      name: "Inches",
      city: "Patillas",
      state: "PR",
    });
    const sources = {
      camera_url: null,
      embed_allowed: false,
      cam_thumbnail_url:
        "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
    } as BeachSources;

    render(<ZineHero beach={beach} sources={sources} />);

    expect(screen.getByAltText("Live cam of Inches still frame")).toHaveAttribute(
      "src",
      "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
    );
    expect(screen.getByText(/live stream unavailable right now/i)).toBeInTheDocument();
    expect(screen.queryByText("Live now")).not.toBeInTheDocument();
  });

  it("renders structured community photo attribution as an inert profile link", () => {
    const beach = createMockBeach({ name: "Seaside Reef" });

    render(
      <ZineHero
        beach={beach}
        beachPhoto={{
          image_url: "/api/community-photos/community-1/image",
          thumb_url: null,
          source: "community",
          creator_name: "Jo",
          license_code: null,
          attribution_html: null,
          attribution: {
            kind: "profile",
            displayName: "<strong>Jo</strong>",
            profileId: "profile-1",
          },
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "<strong>Jo</strong>" }),
    ).toHaveAttribute("href", "/profile/profile-1");
    expect(document.querySelector("strong")).not.toBeInTheDocument();
  });
});
