import React from "react";
import { render, screen } from "@testing-library/react";
import { CamsSection } from "@/components/beach-detail/cams-section";
import type { BeachSources } from "@/hooks/use-beach-detail-data";

describe("CamsSection", () => {
  it("renders YouTube cams as a click-out fallback instead of an iframe", () => {
    const sources: BeachSources = {
      camera_url: "https://www.youtube.com/watch?v=abc123",
      embed_allowed: true,
    };

    render(<CamsSection sources={sources} variant="hero" beachName="Higgins Beach" />);

    const link = screen.getByRole("link", {
      name: /live cam of higgins beach: open live cam on youtube/i,
    });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123");
    expect(screen.queryByTitle("Live Cam")).not.toBeInTheDocument();
  });

  it("normalizes YouTube embed URLs to watch links", () => {
    const sources: BeachSources = {
      camera_url: "https://www.youtube.com/embed/abc123",
      embed_allowed: true,
    };

    render(<CamsSection sources={sources} beachName="Higgins Beach" />);

    expect(
      screen.getByRole("link", {
        name: /live cam of higgins beach: open live cam on youtube/i,
      })
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123");
    expect(screen.queryByText(/refresh for the latest frame/i)).not.toBeInTheDocument();
  });
});
