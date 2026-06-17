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
import { trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";

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

jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffView: jest.fn(),
}));

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({
    platform,
    source,
    surface,
    placement,
    className,
    desktopClassName,
  }: {
    platform: string;
    source: string;
    surface: string;
    placement: string;
    className?: string;
    desktopClassName?: string;
  }) => (
    <div
      data-testid="native-app-funnel-cta"
      data-platform={platform}
      data-source={source}
      data-surface={surface}
      data-placement={placement}
      data-class-name={className}
      data-desktop-class-name={desktopClassName}
    >
      {platform === "desktop" ? "Get Quiver on your phone" : IOS_APP_STORE_CTA}
    </div>
  ),
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
const mockTrackAppHandoffView = trackAppHandoffView as jest.MockedFunction<
  typeof trackAppHandoffView
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

function setMediaState(
  video: HTMLElement,
  overrides: {
    error?: Partial<MediaError> | null;
    readyState?: number;
    networkState?: number;
    currentSrc?: string;
  } = {}
) {
  Object.defineProperty(video, "error", {
    configurable: true,
    value:
      overrides.error === null
        ? null
        : {
            code: 4,
            message: "No supported source was found",
            ...overrides.error,
          },
  });
  Object.defineProperty(video, "readyState", {
    configurable: true,
    value: overrides.readyState ?? 0,
  });
  Object.defineProperty(video, "networkState", {
    configurable: true,
    value: overrides.networkState ?? 3,
  });
  Object.defineProperty(video, "currentSrc", {
    configurable: true,
    value:
      overrides.currentSrc ?? "/videos/quiver-landing-hero-1280.mp4",
  });
}

function setDocumentVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: visibilityState,
  });
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
    setDocumentVisibility("visible");
  });

  it("renders the app-first hero with a visible headline and desktop handoff CTA", async () => {
    render(<HeroSection initialPlatform="desktop" appFirst />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /know where to paddle out\. get quiver on your phone\./i,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/surf call, beach context, and session log/i),
    ).toBeInTheDocument();

    const cta = screen.getByTestId("native-app-funnel-cta");
    expect(cta).toHaveAttribute("data-platform", "desktop");
    expect(cta).toHaveAttribute("data-source", "landing_hero");
    expect(cta).toHaveAttribute("data-surface", "landing-page");
    expect(cta).toHaveAttribute("data-placement", "hero_primary");
    expect(screen.getByRole("link", { name: /see how it works/i })).toHaveAttribute(
      "href",
      "#proof",
    );

    await waitFor(() => {
      expect(mockTrackAppHandoffView).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "landing_hero",
          surface: "landing-page",
          placement: "hero_primary",
          platform: "desktop",
          cohort: "app_first",
        }),
      );
    });
  });

  it("uses the server-resolved mobile platform for the app-first primary CTA", () => {
    render(<HeroSection initialPlatform="ios" appFirst />);

    expect(screen.getByTestId("native-app-funnel-cta")).toHaveAttribute(
      "data-platform",
      "ios",
    );
    expect(
      screen.queryByTestId("hero-video-app-store-cta"),
    ).not.toBeInTheDocument();
  });

  it("renders the poster-first video hero and keeps the download link hidden during playback", async () => {
    jest.useFakeTimers();
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

    expect(
      screen.queryByRole("link", { name: IOS_APP_STORE_CTA }),
    ).not.toBeInTheDocument();

    const video = await mountLazyVideo();
    expect(
      screen.queryByRole("link", { name: IOS_APP_STORE_CTA }),
    ).not.toBeInTheDocument();

    fireEvent.ended(video);

    const link = await screen.findByRole("link", { name: IOS_APP_STORE_CTA });
    expect(link).toHaveAttribute("href", IOS_APP_STORE_URL);
  });

  it("tracks the hero video overlay button view after the video ends", async () => {
    jest.useFakeTimers();
    render(<HeroSection />);

    expect(mockTrackIosAppCtaView).not.toHaveBeenCalled();

    const video = await mountLazyVideo();
    fireEvent.ended(video);

    await waitFor(() => {
      expect(mockTrackIosAppCtaView).toHaveBeenCalledWith({
        source: "hero-video-download-button",
        surface: "landing-page",
        placement: "hero_video_overlay",
        cta_text: IOS_APP_STORE_CTA,
        destination_url: IOS_APP_STORE_URL,
        video_loaded: true,
        video_completed: true,
      });
    });
  });

  it("tracks the hero video overlay button click with button-specific metadata", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<HeroSection />);

    const video = await mountLazyVideo();
    fireEvent.ended(video);

    const link = await screen.findByRole("link", { name: IOS_APP_STORE_CTA });
    link.addEventListener("click", (event) => event.preventDefault());

    await user.click(link);

    expect(mockTrackIosAppCtaClick).toHaveBeenCalledWith({
      source: "hero-video-download-button",
      surface: "landing-page",
      placement: "hero_video_overlay",
      cta_text: IOS_APP_STORE_CTA,
      destination_url: IOS_APP_STORE_URL,
      video_loaded: true,
      video_completed: true,
    });
  });

  it("renders the download link immediately for reduced-motion users", async () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(<HeroSection />);

    const link = await screen.findByRole("link", { name: IOS_APP_STORE_CTA });
    expect(link).toHaveAttribute("href", IOS_APP_STORE_URL);
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
    setMediaState(video, {
      readyState: 4,
      networkState: 1,
      currentSrc: "/videos/quiver-landing-hero-1280.mp4",
    });
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
      media_error_code: 4,
      media_error_message: "No supported source was found",
      ready_state: 4,
      network_state: 1,
      current_src: "/videos/quiver-landing-hero-1280.mp4",
      has_loaded: true,
      has_started: true,
      has_ended: true,
      visibility_state: "visible",
    });
    expect(mockTrack).not.toHaveBeenCalledWith(
      "landing_hero_video_failed_to_start",
      expect.anything()
    );

    jest.useRealTimers();
  });

  it("tracks failed-to-start when the video errors before loading or playing", async () => {
    jest.useFakeTimers();
    render(<HeroSection />);

    const video = await mountLazyVideo();
    setMediaState(video, {
      readyState: 0,
      networkState: 3,
      currentSrc: "/videos/quiver-landing-hero-1280.mp4",
    });
    fireEvent.error(video);

    const expectedMetadata = {
      source: "landing-hero-video",
      surface: "landing-page",
      video_variant: "desktop",
      media_error_code: 4,
      media_error_message: "No supported source was found",
      ready_state: 0,
      network_state: 3,
      current_src: "/videos/quiver-landing-hero-1280.mp4",
      has_loaded: false,
      has_started: false,
      has_ended: false,
      visibility_state: "visible",
    };

    expect(mockTrack).toHaveBeenCalledWith(
      "landing_hero_video_error",
      expectedMetadata
    );
    expect(mockTrack).toHaveBeenCalledWith(
      "landing_hero_video_failed_to_start",
      expectedMetadata
    );
  });

  it("dedupes repeated video error events", async () => {
    jest.useFakeTimers();
    render(<HeroSection />);

    const video = await mountLazyVideo();
    setMediaState(video);
    fireEvent.error(video);
    fireEvent.error(video);

    expect(
      mockTrack.mock.calls.filter(([event]) => event === "landing_hero_video_error")
    ).toHaveLength(1);
    expect(
      mockTrack.mock.calls.filter(
        ([event]) => event === "landing_hero_video_failed_to_start"
      )
    ).toHaveLength(1);
  });

  it("tracks a visible-page failed start timeout and reveals the CTA", async () => {
    jest.useFakeTimers();
    render(<HeroSection />);

    await mountLazyVideo();

    expect(
      screen.queryByRole("link", { name: IOS_APP_STORE_CTA })
    ).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(mockTrack).toHaveBeenCalledWith(
      "landing_hero_video_failed_to_start",
      expect.objectContaining({
        source: "landing-hero-video",
        surface: "landing-page",
        video_variant: "desktop",
        has_loaded: false,
        has_started: false,
        visibility_state: "visible",
      })
    );
    expect(
      screen.getByRole("link", { name: IOS_APP_STORE_CTA })
    ).toBeInTheDocument();
  });

  it("does not track a failed start timeout while the document is hidden", async () => {
    jest.useFakeTimers();
    setDocumentVisibility("hidden");
    render(<HeroSection />);

    await mountLazyVideo();

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(mockTrack).not.toHaveBeenCalledWith(
      "landing_hero_video_failed_to_start",
      expect.anything()
    );
  });

  it("reveals the CTA on visible recovery after a hidden-page stall and delays failed-start tracking", async () => {
    jest.useFakeTimers();
    setDocumentVisibility("hidden");
    render(<HeroSection />);

    await mountLazyVideo();

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(
      screen.queryByRole("link", { name: IOS_APP_STORE_CTA })
    ).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalledWith(
      "landing_hero_video_failed_to_start",
      expect.anything()
    );

    act(() => {
      setDocumentVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(
      screen.getByRole("link", { name: IOS_APP_STORE_CTA })
    ).toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalledWith(
      "landing_hero_video_failed_to_start",
      expect.anything()
    );

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockTrack).toHaveBeenCalledWith(
      "landing_hero_video_failed_to_start",
      expect.objectContaining({
        source: "landing-hero-video",
        surface: "landing-page",
        video_variant: "desktop",
        has_loaded: false,
        has_started: false,
        visibility_state: "visible",
      })
    );
  });

  it("uses one computed desktop video source", async () => {
    jest.useFakeTimers();
    render(<HeroSection />);

    const video = await mountLazyVideo();

    expect(video).toHaveAttribute(
      "src",
      "/videos/quiver-landing-hero-1280.mp4"
    );
    expect(video.querySelector("source")).not.toBeInTheDocument();
  });

  it("uses one computed mobile video source", async () => {
    jest.useFakeTimers();
    (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    render(<HeroSection />);

    const video = await mountLazyVideo();

    expect(video).toHaveAttribute(
      "src",
      "/videos/quiver-landing-hero-720.mp4"
    );
  });
});
