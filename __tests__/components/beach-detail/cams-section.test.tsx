import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { CamsSection } from "@/components/beach-detail/cams-section";
import type { BeachSources } from "@/hooks/use-beach-detail-data";

jest.mock("@/components/beach-detail/hls-video-player", () => ({
  __esModule: true,
  default: function MockHLSVideoPlayer({
    src,
    title,
  }: {
    src: string;
    title?: string;
  }) {
    return React.createElement("video", {
      "data-testid": "hls-video-player",
      src,
      title,
    });
  },
}));

describe("CamsSection", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

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

  it("renders Surfers View cams as external click-out links instead of iframes", () => {
    const sources = {
      camera_url:
        "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/",
      embed_allowed: false,
      cam_thumbnail_url:
        "https://ccn-media.coastalcameranetwork.com/New_Jersey/easternlinesbelmar.stream/latest.jpg",
    } as BeachSources;

    render(<CamsSection sources={sources} beachName="Belmar" />);

    expect(
      screen.getByRole("link", {
        name: /live cam of belmar: open live cam on the surfers view/i,
      })
    ).toHaveAttribute(
      "href",
      "https://thesurfersview.com/live-cams/new-jersey/belmar-beach-cam-and-surf-report/"
    );
    expect(screen.queryByTitle("Live Cam")).not.toBeInTheDocument();
    expect(screen.queryByText(/refresh for the latest frame/i)).not.toBeInTheDocument();
  });

  it("renders authorized OB Hotel cams as in-app HLS video", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        hlsUrl:
          "https://b16.hdrelay.com/camera/1549b2bd-baa9-4eb6-a6bf-c7500a22dc90/relay/playlist.m3u8",
      }),
    } as Response);
    const sources: BeachSources = {
      camera_url: "https://www.obhotel.com/Webcam-Oceanbeach.php",
      embed_allowed: false,
    };

    render(<CamsSection sources={sources} beachName="Ocean Beach" />);

    await waitFor(() => {
      expect(screen.getByTestId("hls-video-player")).toHaveAttribute(
        "src",
        "https://b16.hdrelay.com/camera/1549b2bd-baa9-4eb6-a6bf-c7500a22dc90/relay/playlist.m3u8"
      );
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/cam-resolve?url=https%3A%2F%2Fwww.obhotel.com%2FWebcam-Oceanbeach.php"
    );
    expect(screen.queryByRole("link", { name: /open live cam/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open cam/i })).not.toBeInTheDocument();
  });

  it("renders the authorized Surfers View Ocean Beach page as in-app HLS video", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        hlsUrl:
          "https://b16.hdrelay.com/camera/1549b2bd-baa9-4eb6-a6bf-c7500a22dc90/relay/playlist.m3u8",
      }),
    } as Response);
    const sources: BeachSources = {
      camera_url:
        "https://thesurfersview.com/live-cams/california/ocean-beach-san-diego-webcam-and-surf-report/",
      embed_allowed: false,
    };

    render(<CamsSection sources={sources} beachName="Ocean Beach" />);

    await waitFor(() => {
      expect(screen.getByTestId("hls-video-player")).toHaveAttribute(
        "src",
        "https://b16.hdrelay.com/camera/1549b2bd-baa9-4eb6-a6bf-c7500a22dc90/relay/playlist.m3u8"
      );
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/cam-resolve?url=https%3A%2F%2Fwww.obhotel.com%2FWebcam-Oceanbeach.php"
    );
    expect(
      screen.queryByRole("link", {
        name: /open live cam on the surfers view/i,
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open cam/i })).not.toBeInTheDocument();
  });
});
