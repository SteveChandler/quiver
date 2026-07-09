import { render, screen, within } from "@testing-library/react";

import PbscPage, { metadata } from "@/app/pbsc/page";

const mockHeadersGet = jest.fn();

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function expectPbscHandoffHref(link: HTMLElement, placement: string): void {
  const href = link.getAttribute("href");
  if (!href) {
    throw new Error("Expected PBSC handoff CTA to have an href");
  }
  expect(href).toMatch(/^\/app\?/);

  const url = new URL(href, "https://www.quiversurf.app");
  expect(url.pathname).toBe("/app");
  expect(url.searchParams.get("source")).toBe("pbsc-flyer");
  expect(url.searchParams.get("surface")).toBe("pbsc-page");
  expect(url.searchParams.get("placement")).toBe(placement);
  expect(url.searchParams.get("utm_source")).toBe("pbsc_qr");
  expect(url.searchParams.get("utm_medium")).toBe("flyer");
  expect(url.searchParams.get("utm_campaign")).toBe("pbsc_2026");
}

async function renderPbscPage(userAgent: string): Promise<void> {
  mockHeadersGet.mockReturnValue(userAgent);
  render(await PbscPage());
}

describe("PbscPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: jest.fn().mockRejectedValue(new Error("Autoplay blocked in test")),
    });
  });

  it("exports evergreen metadata for the stable /pbsc path", () => {
    expect(metadata.title).toEqual({
      absolute: "Get the Quiver Surf App | Welcome",
    });
    expect(metadata.description).toBe(
      "You found the flyer. Get the surf app that matches today's forecast against the sessions you loved.",
    );
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/pbsc");
  });

  it("renders evergreen welcome copy without stale event framing", async () => {
    await renderPbscPage(DESKTOP_UA);

    expect(
      screen.getAllByText(/Your good days, on repeat/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Quiver matches today's forecast against the sessions you loved/i,
      ),
    ).toBeInTheDocument();
    const heroWords = screen.getByLabelText("Welcome to Quiver.");
    expect(within(heroWords).getByText(/WELCOME TO/i)).toBeInTheDocument();
    expect(within(heroWords).getByText(/^QUIVER$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^YOU FOUND IT$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^MEET QUIVER$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/You found the flyer/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Pacific Beach Surf Club/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PBSC/)).not.toBeInTheDocument();
    const video = screen.getByLabelText(/Animated Quiver buoy loop preview/i);
    expect(screen.getByTestId("pbsc-video-frame")).toHaveClass("aspect-[9/16]");
    expect(video).toHaveClass("object-contain");
    const videoSource = video.querySelector("source");
    if (!videoSource) {
      throw new Error("Expected PBSC welcome video source to render");
    }
    expect(videoSource).toHaveAttribute("src", "/videos/buoy-loop.mp4");
    expect(screen.queryByText(/June 13, 2026/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Tourmaline live issue no\. 001/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/PBSC Summer Longboard Classic/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Join Android waitlist/i)).not.toBeInTheDocument();
  });

  it("labels both handoff CTAs for iOS visitors", async () => {
    await renderPbscPage(IPHONE_UA);

    const appStoreLinks = screen.getAllByRole("link", {
      name: /Get it on the App Store/i,
    });
    expect(appStoreLinks).toHaveLength(2);
    expectPbscHandoffHref(appStoreLinks[0], "hero_primary");
    expectPbscHandoffHref(appStoreLinks[1], "bottom_primary");
    expect(
      screen.queryByRole("link", { name: /Get it on Google Play/i }),
    ).not.toBeInTheDocument();
  });

  it("labels both handoff CTAs for Android visitors", async () => {
    await renderPbscPage(ANDROID_UA);

    const googlePlayLinks = screen.getAllByRole("link", {
      name: /Get it on Google Play/i,
    });
    expect(googlePlayLinks).toHaveLength(2);
    expectPbscHandoffHref(googlePlayLinks[0], "hero_primary");
    expectPbscHandoffHref(googlePlayLinks[1], "bottom_primary");
    expect(
      screen.queryByRole("link", { name: /Get it on the App Store/i }),
    ).not.toBeInTheDocument();
  });

  it("labels both handoff CTAs generically for desktop visitors", async () => {
    await renderPbscPage(DESKTOP_UA);

    const getAppLinks = screen.getAllByRole("link", {
      name: /Get the app/i,
    });
    expect(getAppLinks).toHaveLength(2);
    expectPbscHandoffHref(getAppLinks[0], "hero_primary");
    expectPbscHandoffHref(getAppLinks[1], "bottom_primary");
  });
});
