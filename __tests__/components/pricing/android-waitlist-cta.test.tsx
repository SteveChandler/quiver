import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import { useAuth } from "@/context/auth-context";
import {
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import { ANDROID_BETA_LANDING_PATH } from "@/lib/constants/app-store";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/analytics/android-waitlist-tracking", () => ({
  trackAndroidWaitlistCtaClick: jest.fn(),
  trackAndroidWaitlistCtaView: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockTrackAndroidWaitlistCtaClick =
  trackAndroidWaitlistCtaClick as jest.Mock;
const mockTrackAndroidWaitlistCtaView =
  trackAndroidWaitlistCtaView as jest.Mock;

function mockAuth(user: { id: string } | null): void {
  mockUseAuth.mockReturnValue({
    user,
    session: null,
    isLoading: false,
    isAuthenticated: Boolean(user),
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  } as any);
}

function renderCta(onClickTrack = jest.fn()) {
  return {
    onClickTrack,
    ...render(
      <AndroidWaitlistCta
        source="features-hero-android-waitlist"
        surface="features-page"
        placement="hero_secondary"
        onClickTrack={onClickTrack}
      >
        Get the Android beta
      </AndroidWaitlistCta>,
    ),
  };
}

describe("AndroidWaitlistCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth(null);
    (global as any).IntersectionObserver = class {
      private callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe(): void {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }

      disconnect(): void {}

      unobserve(): void {}
    };
  });

  it("routes anonymous visitors to the canonical guided handoff", async () => {
    const user = userEvent.setup();
    const { onClickTrack } = renderCta();

    const link = screen.getByRole("link", { name: /get the android beta/i });
    expect(link).toHaveAttribute("href", ANDROID_BETA_LANDING_PATH);
    expect(
      screen.queryByLabelText(/email for android beta access/i),
    ).not.toBeInTheDocument();

    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);

    expect(onClickTrack).toHaveBeenCalledTimes(1);
    expect(mockTrackAndroidWaitlistCtaClick).toHaveBeenCalledWith({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
      auth_state: "anonymous",
      destination_type: "android_beta_handoff",
      destination_status: "guided_closed_test",
      destination_url: ANDROID_BETA_LANDING_PATH,
      profile_flag_requested: false,
    });
  });

  it("uses the same guided destination for authenticated visitors", async () => {
    const user = userEvent.setup();
    mockAuth({ id: "user-1" });
    renderCta();

    const link = screen.getByRole("link", { name: /get the android beta/i });
    expect(link).toHaveAttribute("href", ANDROID_BETA_LANDING_PATH);

    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);

    expect(mockTrackAndroidWaitlistCtaClick).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_state: "authenticated",
        destination_type: "android_beta_handoff",
        destination_url: ANDROID_BETA_LANDING_PATH,
        profile_flag_requested: false,
      }),
    );
  });

  it("tracks the guided handoff impression once", async () => {
    renderCta();

    await waitFor(() => {
      expect(mockTrackAndroidWaitlistCtaView).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackAndroidWaitlistCtaView).toHaveBeenCalledWith({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
      auth_state: "anonymous",
      destination_type: "android_beta_handoff",
      destination_status: "guided_closed_test",
      destination_url: ANDROID_BETA_LANDING_PATH,
    });
  });
});
