import React from "react";
import { render, screen } from "@testing-library/react";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { ZineHero } from "@/components/beach-detail/zine/zine-hero";
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
});
