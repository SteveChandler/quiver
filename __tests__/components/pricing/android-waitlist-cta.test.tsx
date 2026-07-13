import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { joinAndroidWaitlist } from "@/actions/android-waitlist-actions";
import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import { useAuth } from "@/context/auth-context";
import {
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import { ANDROID_WAITLIST_STORAGE_KEY } from "@/lib/constants/android-waitlist";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/actions/android-waitlist-actions", () => ({
  joinAndroidWaitlist: jest.fn(),
}));

jest.mock("@/lib/analytics/android-waitlist-tracking", () => ({
  trackAndroidWaitlistCtaClick: jest.fn(),
  trackAndroidWaitlistCtaView: jest.fn(),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockJoinAndroidWaitlist = joinAndroidWaitlist as jest.Mock;
const mockTrackAndroidWaitlistCtaClick =
  trackAndroidWaitlistCtaClick as jest.Mock;
const mockTrackAndroidWaitlistCtaView =
  trackAndroidWaitlistCtaView as jest.Mock;
const mockWindowOpen = jest.fn();

function mockAnonymousUser() {
  mockUseAuth.mockReturnValue({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  } as any);
}

function mockSignedInUser() {
  mockUseAuth.mockReturnValue({
    user: { id: "user-1" },
    session: null,
    isLoading: false,
    isAuthenticated: true,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  } as any);
}

function renderWaitlistCta() {
  return render(
    <AndroidWaitlistCta
      source="features-hero-android-waitlist"
      surface="features-page"
      placement="hero_secondary"
      successLabel="Android updates are set."
    >
      Get the Android beta
    </AndroidWaitlistCta>,
  );
}

describe("AndroidWaitlistCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAnonymousUser();
    global.window.open = mockWindowOpen;
    (global as any).fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      ),
    );
    mockJoinAndroidWaitlist.mockResolvedValue({
      success: true,
      data: { wants_android_access: true },
    });

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
    };
  });

  it("tracks visible Android waitlist CTA impressions", async () => {
    renderWaitlistCta();

    await waitFor(() => {
      expect(mockTrackAndroidWaitlistCtaView).toHaveBeenCalledWith({
        source: "features-hero-android-waitlist",
        surface: "features-page",
        placement: "hero_secondary",
        auth_state: "anonymous",
      });
    });
  });

  it("renders one-field Android beta lead capture for anonymous users", () => {
    renderWaitlistCta();

    expect(
      screen.getByLabelText(/email for android beta access/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /get the android beta/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^android waitlist$/i }),
    ).not.toBeInTheDocument();
  });

  it("surfaces invalid anonymous email responses without handoff", async () => {
    const user = userEvent.setup();
    (global as any).fetch = jest.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ success: false, error: "invalid_email" }),
          { status: 200 },
        ),
      ),
    );
    renderWaitlistCta();

    await user.type(
      screen.getByLabelText(/email for android beta access/i),
      "not-an-email",
    );
    await user.click(
      screen.getByRole("button", { name: /get the android beta/i }),
    );

    expect(
      await screen.findByText(/enter a valid email address/i),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/android-beta/leads",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it("captures anonymous beta leads before showing the tester steps", async () => {
    const user = userEvent.setup();
    renderWaitlistCta();

    await user.type(
      screen.getByLabelText(/email for android beta access/i),
      "SURFER@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /get the android beta/i }),
    );

    expect(mockTrackAndroidWaitlistCtaClick).toHaveBeenCalledWith({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
      auth_state: "anonymous",
      destination_type: "lead_capture",
      destination_status: "email_captured",
      profile_flag_requested: false,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/android-beta/leads",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "surfer@example.com",
          sessionId: "00000000-0000-4000-8000-000000000001",
          source: "features-hero-android-waitlist",
          surface: "features-page",
          placement: "hero_secondary",
        }),
      }),
    );
    expect(localStorage.getItem(ANDROID_WAITLIST_STORAGE_KEY)).toBeNull();
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("link", { name: /join tester group/i }),
    ).toHaveAttribute(
      "href",
      "https://groups.google.com/g/quiver-android-testers",
    );
    expect(screen.getByText(/test for 14 days/i)).toBeInTheDocument();
    expect(mockJoinAndroidWaitlist).not.toHaveBeenCalled();
  });

  it("captures anonymous PBSC beta leads before showing tester steps", async () => {
    const user = userEvent.setup();

    render(
      <AndroidWaitlistCta
        source="pbsc-event-android-waitlist"
        surface="pbsc-page"
        placement="hero_primary"
        successLabel="Android updates are set"
      >
        Get the Android beta
      </AndroidWaitlistCta>,
    );

    fireEvent.change(screen.getByLabelText(/email for android beta access/i), {
      target: { value: "pbsc@example.com" },
    });
    await user.click(
      screen.getByRole("button", { name: /get the android beta/i }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/android-beta/leads",
      expect.objectContaining({
        body: JSON.stringify({
          email: "pbsc@example.com",
          sessionId: "00000000-0000-4000-8000-000000000001",
          source: "pbsc-event-android-waitlist",
          surface: "pbsc-page",
          placement: "hero_primary",
        }),
      }),
    );
    expect(localStorage.getItem(ANDROID_WAITLIST_STORAGE_KEY)).toBeNull();
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("link", { name: /join tester group/i }),
    ).toHaveAttribute(
      "href",
      "https://groups.google.com/g/quiver-android-testers",
    );
    expect(mockJoinAndroidWaitlist).not.toHaveBeenCalled();
  });

  it("saves the profile flag immediately for signed-in users", async () => {
    const user = userEvent.setup();
    mockSignedInUser();
    renderWaitlistCta();

    await user.click(
      screen.getByRole("button", { name: /get the android beta/i }),
    );

    expect(mockJoinAndroidWaitlist).toHaveBeenCalledWith({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
    });
    expect(
      await screen.findByRole("button", {
        name: /android updates are set/i,
      }),
    ).toBeInTheDocument();
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("link", { name: /join tester group/i }),
    ).toHaveAttribute(
      "href",
      "https://groups.google.com/g/quiver-android-testers",
    );
  });

  it("applies a pending anonymous intent after auth resolves", async () => {
    localStorage.setItem(
      ANDROID_WAITLIST_STORAGE_KEY,
      JSON.stringify({
        source: "features-final-android-waitlist",
        surface: "features-page",
        placement: "final_secondary",
        created_at: new Date().toISOString(),
      }),
    );
    mockSignedInUser();

    renderWaitlistCta();

    await waitFor(() => {
      expect(mockJoinAndroidWaitlist).toHaveBeenCalledWith({
        source: "features-final-android-waitlist",
        surface: "features-page",
        placement: "final_secondary",
      });
    });
    await waitFor(() => {
      expect(localStorage.getItem(ANDROID_WAITLIST_STORAGE_KEY)).toBeNull();
    });
  });

  it("claims one pending anonymous intent when multiple CTAs mount after auth", async () => {
    localStorage.setItem(
      ANDROID_WAITLIST_STORAGE_KEY,
      JSON.stringify({
        source: "features-final-android-waitlist",
        surface: "features-page",
        placement: "final_secondary",
        created_at: new Date().toISOString(),
      }),
    );
    mockSignedInUser();

    render(
      <>
        <AndroidWaitlistCta
          source="features-hero-android-waitlist"
          surface="features-page"
          placement="hero_secondary"
        />
        <AndroidWaitlistCta
          source="features-final-android-waitlist"
          surface="features-page"
          placement="final_secondary"
        />
      </>,
    );

    await waitFor(() => {
      expect(mockJoinAndroidWaitlist).toHaveBeenCalledTimes(1);
    });
    expect(mockJoinAndroidWaitlist).toHaveBeenCalledWith({
      source: "features-final-android-waitlist",
      surface: "features-page",
      placement: "final_secondary",
    });
  });

  it("does not submit again after the signed-in waitlist intent is saved", async () => {
    const user = userEvent.setup();
    mockSignedInUser();
    renderWaitlistCta();

    const button = screen.getByRole("button", {
      name: /get the android beta/i,
    });
    await user.click(button);
    await screen.findByRole("button", {
      name: /android updates are set/i,
    });

    await user.click(
      screen.getByRole("button", {
        name: /android updates are set/i,
      }),
    );

    expect(mockJoinAndroidWaitlist).toHaveBeenCalledTimes(1);
  });

  it("notifies callers when the waitlist intent is confirmed", async () => {
    const user = userEvent.setup();
    const onConfirmed = jest.fn();
    mockSignedInUser();
    mockJoinAndroidWaitlist.mockResolvedValueOnce({
      success: true,
      data: {
        wants_android_access: true,
        android_waitlist_joined_at: "2026-05-25T20:00:00.000Z",
      },
    });

    render(
      <AndroidWaitlistCta
        source="features-hero-android-waitlist"
        surface="features-page"
        placement="hero_secondary"
        onConfirmed={onConfirmed}
      >
        Get the Android beta
      </AndroidWaitlistCta>,
    );

    await user.click(
      screen.getByRole("button", { name: /get the android beta/i }),
    );

    await waitFor(() => {
      expect(onConfirmed).toHaveBeenCalledWith({
        wants_android_access: true,
        android_waitlist_joined_at: "2026-05-25T20:00:00.000Z",
      });
    });
  });
});
