import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { joinAndroidWaitlist } from "@/actions/android-waitlist-actions";
import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import { useAuth } from "@/context/auth-context";
import {
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import { ANDROID_WAITLIST_STORAGE_KEY } from "@/lib/constants/android-waitlist";

let mockPathname = "/features";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

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

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({
    isOpen,
    source,
    returnTo,
  }: {
    isOpen: boolean;
    source: string;
    returnTo: string;
  }) =>
    isOpen ? (
      <div
        data-testid="auth-modal"
        data-source={source}
        data-return-to={returnTo}
      />
    ) : null,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockJoinAndroidWaitlist = joinAndroidWaitlist as jest.Mock;
const mockTrackAndroidWaitlistCtaClick =
  trackAndroidWaitlistCtaClick as jest.Mock;
const mockTrackAndroidWaitlistCtaView =
  trackAndroidWaitlistCtaView as jest.Mock;

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
      Android waitlist
    </AndroidWaitlistCta>,
  );
}

describe("AndroidWaitlistCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAnonymousUser();
    mockPathname = "/features";
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

  it("stores anonymous waitlist intent and opens signup", async () => {
    const user = userEvent.setup();
    renderWaitlistCta();

    await user.click(
      screen.getByRole("button", { name: /android waitlist/i }),
    );

    expect(mockTrackAndroidWaitlistCtaClick).toHaveBeenCalledWith({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
      auth_state: "anonymous",
      profile_flag_requested: true,
    });
    expect(
      JSON.parse(localStorage.getItem(ANDROID_WAITLIST_STORAGE_KEY) || "{}"),
    ).toMatchObject({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
    });
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-source",
      "features-hero-android-waitlist",
    );
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-return-to",
      "/features",
    );
    expect(mockJoinAndroidWaitlist).not.toHaveBeenCalled();
  });

  it("returns anonymous PBSC waitlist clicks to the event route", async () => {
    const user = userEvent.setup();
    mockPathname = "/pbsc";

    render(
      <AndroidWaitlistCta
        source="pbsc-event-android-waitlist"
        surface="pbsc-page"
        placement="hero_primary"
        successLabel="Android updates are set"
      >
        Join Android waitlist
      </AndroidWaitlistCta>,
    );

    await user.click(
      screen.getByRole("button", { name: /join android waitlist/i }),
    );

    expect(
      JSON.parse(localStorage.getItem(ANDROID_WAITLIST_STORAGE_KEY) || "{}"),
    ).toMatchObject({
      source: "pbsc-event-android-waitlist",
      surface: "pbsc-page",
      placement: "hero_primary",
    });
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-return-to",
      "/pbsc",
    );
    expect(mockJoinAndroidWaitlist).not.toHaveBeenCalled();
  });

  it("saves the profile flag immediately for signed-in users", async () => {
    const user = userEvent.setup();
    mockSignedInUser();
    renderWaitlistCta();

    await user.click(
      screen.getByRole("button", { name: /android waitlist/i }),
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

    const button = screen.getByRole("button", { name: /android waitlist/i });
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
        Android waitlist
      </AndroidWaitlistCta>,
    );

    await user.click(
      screen.getByRole("button", { name: /android waitlist/i }),
    );

    await waitFor(() => {
      expect(onConfirmed).toHaveBeenCalledWith({
        wants_android_access: true,
        android_waitlist_joined_at: "2026-05-25T20:00:00.000Z",
      });
    });
  });
});
