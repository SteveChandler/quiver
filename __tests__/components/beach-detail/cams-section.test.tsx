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

  it.each([
    ["Napili Bay Beach", "https://www.napilisunset.com/live-webcam/"],
    ["Muir Beach", "https://www.sigward.com/"],
    ["Jenkinson’s Beach", "https://video.nest.com/live/JKTTcsayyN"],
    ["Kaunaoa Beach", "https://marriott.ozolio.com/mauna-kea-beach-hotel/"],
    ["Virginia Beach Oceanfront", "https://vbbound.com/webcams/courtyard-virginia-beach-boardwalk-webcam/"],
  ])("opens the verified %s provider without embedding", (beachName, cameraUrl) => {
    const { container } = render(
      <CamsSection sources={{ camera_url: cameraUrl, embed_allowed: false }} beachName={beachName} />
    );
    expect(screen.getByRole("link", { name: /open live cam on/i })).toHaveAttribute("href", cameraUrl);
    expect(container.querySelector("iframe")).toBeNull();
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

  it("renders Surfline report cams as external click-out links instead of iframes", () => {
    const sources = {
      camera_url:
        "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67",
      embed_allowed: true,
    } as BeachSources;

    render(<CamsSection sources={sources} beachName="Inches" />);

    expect(
      screen.getByRole("link", {
        name: /live cam of inches: open live cam on surfline/i,
      })
    ).toHaveAttribute(
      "href",
      "https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67"
    );
    expect(screen.queryByTitle("Live Cam")).not.toBeInTheDocument();
    expect(screen.queryByText(/refresh for the latest frame/i)).not.toBeInTheDocument();
  });

  it("renders a stored still when the live cam URL is unavailable", () => {
    const sources = {
      camera_url: null,
      embed_allowed: false,
      cam_thumbnail_url:
        "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
    } as BeachSources;

    render(<CamsSection sources={sources} beachName="Inches" />);

    expect(screen.getByAltText("Live cam of Inches still frame")).toHaveAttribute(
      "src",
      "https://camstills.cdn-surfline.com/us-east-2/pr-inches/latest_full.jpg",
    );
    expect(screen.getByText(/live stream unavailable right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/suggest a cam/i)).not.toBeInTheDocument();
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
