import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroSection } from "@/components/landing-page/hero-section";
import { useAuth } from "@/context/auth-context";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { track } from "@/lib/analytics";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import { IOS_APP_STORE_CTA, IOS_APP_STORE_URL } from "@/lib/constants/app-store";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    alt = "",
    ...props
  }: Record<string, unknown>) => {
    return <img alt={String(alt)} {...props} />;
  },
}));

jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            initial: _initial,
            animate: _animate,
            transition: _transition,
            ...rest
          } = props;
          return <div ref={ref} {...rest} />;
        },
      ),
    },
  };
});

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: jest.fn(),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
  trackIosAppCtaView: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;
const mockTrack = track as jest.MockedFunction<typeof track>;
const mockTrackIosAppCtaClick = trackIosAppCtaClick as jest.MockedFunction<
  typeof trackIosAppCtaClick
>;
const mockTrackIosAppCtaView = trackIosAppCtaView as jest.MockedFunction<
  typeof trackIosAppCtaView
>;

function mockUnauthenticatedUser() {
  mockUseAuth.mockReturnValue({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  });
}

async function mountLazyVideo() {
  act(() => {
    window.dispatchEvent(new Event("load"));
    jest.advanceTimersByTime(2500);
  });

  return screen.findByLabelText(/quiver iphone launch video/i);
}

describe("HeroSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockUnauthenticatedUser();
    mockUseReducedMotion.mockReturnValue(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width") ? false : true,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the poster-first video hero and download link", () => {
    render(<HeroSection />);

    expect(
      screen.getByRole("heading", {
        name: /quiver surf forecast app for iphone/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(
        /quiver app launch video preview showing the iphone surf forecast experience/i,
      ),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: IOS_APP_STORE_CTA });
    expect(link).toHaveAttribute("href", IOS_APP_STORE_URL);
  });

  it("tracks the hero video overlay button view with button-specific metadata", async () => {
    render(<HeroSection />);

    await waitFor(() => {
      expect(mockTrackIosAppCtaView).toHaveBeenCalledWith({
        source: "hero-video-download-button",
        surface: "landing-page",
        placement: "hero_video_overlay",
        cta_text: IOS_APP_STORE_CTA,
        destination_url: IOS_APP_STORE_URL,
      });
    });
  });

  it("tracks the hero video overlay button click with button-specific metadata", async () => {
    const user = userEvent.setup();
    render(<HeroSection />);

    const link = screen.getByRole("link", { name: IOS_APP_STORE_CTA });
    link.addEventListener("click", (event) => event.preventDefault());

    await user.click(link);

    expect(mockTrackIosAppCtaClick).toHaveBeenCalledWith({
      source: "hero-video-download-button",
      surface: "landing-page",
      placement: "hero_video_overlay",
      cta_text: IOS_APP_STORE_CTA,
      destination_url: IOS_APP_STORE_URL,
      video_loaded: false,
    });
  });

  it("does not render the video immediately so the poster can paint first", () => {
    render(<HeroSection />);

    expect(
      screen.queryByLabelText(/quiver iphone launch video/i),
    ).not.toBeInTheDocument();
  });

  it("tracks video lifecycle analytics after lazy mount", async () => {
    jest.useFakeTimers();
    render(<HeroSection />);

    const video = await mountLazyVideo();

    fireEvent.loadedData(video);
    fireEvent.play(video);
    fireEvent.ended(video);
    fireEvent.error(video);

    expect(mockTrack).toHaveBeenCalledWith("landing_hero_video_loaded", {
      source: "landing-hero-video",
      surface: "landing-page",
      video_variant: "desktop",
    });
    expect(mockTrack).toHaveBeenCalledWith("landing_hero_video_started", {
      source: "landing-hero-video",
      surface: "landing-page",
      video_variant: "desktop",
    });
    expect(mockTrack).toHaveBeenCalledWith("landing_hero_video_ended", {
      source: "landing-hero-video",
      surface: "landing-page",
      video_variant: "desktop",
    });
    expect(mockTrack).toHaveBeenCalledWith("landing_hero_video_error", {
      source: "landing-hero-video",
      surface: "landing-page",
      video_variant: "desktop",
    });

    jest.useRealTimers();
  });
});
