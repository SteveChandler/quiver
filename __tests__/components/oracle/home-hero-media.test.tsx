import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HomeHeroMedia } from "@/components/oracle/zine/home-hero-media";

const mockGetStaticMapImageUrl = jest.fn();
jest.mock("@/lib/map-utils", () => ({
  getStaticMapImageUrl: (...args: unknown[]) => mockGetStaticMapImageUrl(...args),
}));

jest.mock("@/components/beach-detail/cams-section", () => ({
  CamsSection: ({ beachName }: { beachName: string }) => (
    <div data-testid="hero-cam">Live cam of {beachName}</div>
  ),
}));

// jsdom has no canvas 2d context — stub it so the swell field no-ops.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});

beforeEach(() => {
  window.localStorage.clear();
  mockGetStaticMapImageUrl.mockImplementation(
    (_lat: number, _lon: number, options: { style: string }) =>
      `https://api.mapbox.com/styles/v1/${options.style}/static/map.png`,
  );
});

function renderMedia(overrides: Partial<Parameters<typeof HomeHeroMedia>[0]> = {}) {
  return render(
    <HomeHeroMedia
      beachName="Ocean Beach Pier"
      lat={32.7497}
      lon={-117.2556}
      photoUrl="/images/ob.jpg"
      swell={{ directionDeg: 250, periodS: 13, heightFt: 4 }}
      {...overrides}
    >
      <p>Overlay</p>
    </HomeHeroMedia>,
  );
}

describe("HomeHeroMedia", () => {
  it("offers native's viewpoints in native's order and opens on swell", () => {
    renderMedia({ sources: { camera_url: "https://example.com/cam.m3u8" } });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Swell",
      "Sat",
      "Photo",
      "Cam",
    ]);
    expect(screen.getByRole("tab", { name: "Swell" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByAltText("Map of Ocean Beach Pier")).toBeInTheDocument();
    expect(screen.getByText("Overlay")).toBeInTheDocument();
  });

  it("draws /map's swell field over its streets basemap, with a readable image", () => {
    renderMedia();

    const map = screen.getByAltText("Map of Ocean Beach Pier");
    expect(map).toHaveAttribute("src", expect.stringContaining("mapbox/streets-v11"));
    // The field reads the map's pixels to find the water.
    expect(map).toHaveAttribute("crossorigin", "anonymous");
    expect(screen.getByTestId("hero-swell-field")).toBeInTheDocument();
  });

  it("shows the map alone when there is no swell to draw", () => {
    renderMedia({ swell: null });

    expect(screen.getByAltText("Map of Ocean Beach Pier")).toBeInTheDocument();
    expect(screen.queryByTestId("hero-swell-field")).not.toBeInTheDocument();
  });

  it("switches viewpoints and remembers the choice", async () => {
    const user = userEvent.setup();
    const { unmount } = renderMedia();

    await user.click(screen.getByRole("tab", { name: "Photo" }));
    expect(screen.getByAltText("Photo of Ocean Beach Pier")).toBeInTheDocument();
    unmount();

    renderMedia();
    expect(await screen.findByAltText("Photo of Ocean Beach Pier")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Photo" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the cam only when the beach has one", async () => {
    const user = userEvent.setup();
    renderMedia({ sources: { camera_url: "https://example.com/cam.m3u8" } });

    await user.click(screen.getByRole("tab", { name: "Cam" }));
    expect(await screen.findByTestId("hero-cam")).toHaveTextContent("Live cam of Ocean Beach Pier");
  });

  it("never offers a photo it does not have, or a map without a provider", () => {
    mockGetStaticMapImageUrl.mockReturnValue("data:image/svg+xml;base64,placeholder");
    renderMedia({ photoUrl: null });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-hero-media")).toHaveAttribute("data-viewpoint", "none");
  });

  it("falls back to the first available viewpoint when the remembered one is gone", () => {
    window.localStorage.setItem("quiver:home-hero-viewpoint", "cam");
    renderMedia();

    expect(screen.getByTestId("home-hero-media")).toHaveAttribute("data-viewpoint", "swell");
  });

  it("hides the switcher for the recheck state", () => {
    renderMedia({ showViewpoints: false });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
