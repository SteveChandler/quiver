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
        data: {
          kind: "hls",
          stream_url:
            "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999",
        },
      }),
    } as Response);
    const sources: BeachSources = {
      camera_url: "https://www.obhotel.com/Webcam-Oceanbeach.php",
      cam_stream_endpoint: "/api/beaches/ocean-beach/stream",
      embed_allowed: false,
    };

    render(<CamsSection sources={sources} beachName="Ocean Beach" />);

    await waitFor(() => {
      expect(screen.getByTestId("hls-video-player")).toHaveAttribute(
        "src",
        "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999"
      );
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/beaches/ocean-beach/stream"
    );
    expect(screen.queryByRole("link", { name: /open live cam/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open cam/i })).not.toBeInTheDocument();
  });

  it("renders the authorized Surfers View Ocean Beach page as in-app HLS video", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          kind: "hls",
          stream_url:
            "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999",
        },
      }),
    } as Response);
    const sources: BeachSources = {
      camera_url:
        "https://thesurfersview.com/live-cams/california/ocean-beach-san-diego-webcam-and-surf-report/",
      cam_stream_endpoint: "/api/beaches/ocean-beach/stream",
      embed_allowed: false,
    };

    render(<CamsSection sources={sources} beachName="Ocean Beach" />);

    await waitFor(() => {
      expect(screen.getByTestId("hls-video-player")).toHaveAttribute(
        "src",
        "/api/hls-proxy/live.hdontap.com/hls/hosb1/stream.stream/playlist.m3u8?t=abc123&e=9999999999"
      );
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/beaches/ocean-beach/stream"
    );
    expect(
      screen.queryByRole("link", {
        name: /open live cam on the surfers view/i,
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open cam/i })).not.toBeInTheDocument();
  });

  it("renders direct image cams inline with a cache-busting refresh token", () => {
    const sources: BeachSources = {
      camera_url: "https://cams.example.com/belmar/latest.jpg",
      embed_allowed: false,
    };

    render(<CamsSection sources={sources} beachName="Belmar" />);

    const image = screen.getByRole("img", { name: /live cam of belmar/i });
    expect(image).toHaveAttribute(
      "src",
      expect.stringMatching(/^https:\/\/cams\.example\.com\/belmar\/latest\.jpg\?t=\d+$/)
    );
  });
});
