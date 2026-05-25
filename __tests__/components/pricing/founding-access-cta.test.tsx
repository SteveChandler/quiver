import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FoundingAccessCta } from "@/components/pricing/founding-access-cta";
import { useAuth } from "@/context/auth-context";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

jest.mock("next/navigation", () => ({
  usePathname: () => "/pricing",
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
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

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockTrackSignupCtaClick = trackSignupCtaClick as jest.Mock;
const mockTrackSignupCtaView = trackSignupCtaView as jest.Mock;

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

describe("FoundingAccessCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnonymousUser();
  });

  it("tracks waitlist CTA views for anonymous users", async () => {
    render(<FoundingAccessCta source="pricing-test" surface="pricing" />);

    await waitFor(() => {
      expect(mockTrackSignupCtaView).toHaveBeenCalledWith({
        source: "pricing-test",
        surface: "pricing",
        cta_type: "founding_access_waitlist",
        cta_copy_variant: "founding_access_waitlist_v1",
      });
    });
  });

  it("tracks anonymous clicks and opens signup with pricing attribution", async () => {
    const user = userEvent.setup();

    render(<FoundingAccessCta source="pricing-test" surface="pricing" />);

    await user.click(
      screen.getByRole("button", {
        name: /join the founding access waitlist/i,
      }),
    );

    expect(mockTrackSignupCtaClick).toHaveBeenCalledWith({
      source: "pricing-test",
      surface: "pricing",
      cta_type: "founding_access_waitlist",
      cta_text: "Join the founding access waitlist",
      cta_copy_variant: "founding_access_waitlist_v1",
    });
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-source",
      "pricing-test",
    );
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-return-to",
      "/pricing",
    );
  });

  it("suppresses pre-auth tracking for signed-in users", () => {
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

    render(<FoundingAccessCta source="pricing-test" surface="pricing" />);

    expect(screen.getByTestId("founding-access-signed-in-state")).toBeVisible();
    expect(
      screen.getByText(/log 5 surf sessions in quiver to qualify for pro/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /join the founding access waitlist/i,
      }),
    ).not.toBeInTheDocument();
    expect(mockTrackSignupCtaView).not.toHaveBeenCalled();
    expect(mockTrackSignupCtaClick).not.toHaveBeenCalled();
  });
});
