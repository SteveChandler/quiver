import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { FoundingAccessCta } from "@/components/pricing/founding-access-cta";
import { useAuth } from "@/context/auth-context";
import { useProfileContext } from "@/context/profile-context";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/context/profile-context", () => ({
  useProfileContext: jest.fn(),
}));

jest.mock("@/components/pricing/android-waitlist-cta", () => ({
  AndroidWaitlistCta: ({
    children,
    source,
    surface,
    placement,
    onConfirmed,
  }: {
    children: ReactNode;
    source: string;
    surface: string;
    placement: string;
    onConfirmed?: () => void;
  }) => (
    <button
      type="button"
      data-testid="android-waitlist-cta"
      data-source={source}
      data-surface={surface}
      data-placement={placement}
      onClick={onConfirmed}
    >
      {children}
    </button>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseProfileContext = useProfileContext as jest.MockedFunction<
  typeof useProfileContext
>;
const mockRefreshProfile = jest.fn();

function mockProfileContext(profile: Record<string, unknown> | null = null) {
  mockUseProfileContext.mockReturnValue({
    profile: profile as any,
    homeBeach: null,
    isLoading: false,
    error: null,
    updateProfile: jest.fn(),
    refreshProfile: mockRefreshProfile,
  });
}

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

describe("FoundingAccessCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnonymousUser();
    mockProfileContext();
  });

  it("renders an action-backed Android waitlist CTA for anonymous users", () => {
    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    expect(
      screen.getByRole("button", {
        name: /join android waitlist/i,
      }),
    ).toHaveAttribute("data-placement", "plans_primary");
    expect(screen.getByTestId("android-waitlist-cta")).toHaveAttribute(
      "data-source",
      "plans-test",
    );
    expect(screen.getByTestId("android-waitlist-cta")).toHaveAttribute(
      "data-surface",
      "plans",
    );
    expect(
      screen.getByText(/we'll send android launch updates/i),
    ).toBeInTheDocument();
  });

  it("asks signed-in users to confirm Android waitlist intent", () => {
    mockSignedInUser();

    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    expect(screen.getByTestId("founding-access-signed-in-state")).toBeVisible();
    expect(
      screen.getByText(/confirm this account for android launch updates/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /join android waitlist/i,
      }),
    ).toHaveAttribute("data-placement", "plans_signed_in");
    expect(
      screen.getByRole("link", {
        name: /open quiver/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders a compact signed-in Android status without the app button", () => {
    mockSignedInUser();

    render(<FoundingAccessCta variant="compact" />);

    expect(screen.getByTestId("founding-access-signed-in-state")).toBeVisible();
    expect(screen.getByText(/you're signed in/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /join android waitlist/i,
      }),
    ).toHaveAttribute("data-placement", "plans_compact_signed_in");
    expect(
      screen.queryByRole("link", {
        name: /open quiver/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows persisted Android waitlist status for signed-in users who already joined", () => {
    mockSignedInUser();
    mockProfileContext({
      id: "user-1",
      wants_android_access: true,
      android_waitlist_joined_at: "2026-05-25T20:00:00.000Z",
    });

    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    expect(screen.getByTestId("founding-access-signed-in-state")).toBeVisible();
    expect(screen.getByText(/android updates are set/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /join android waitlist/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /open quiver/i,
      }),
    ).toBeInTheDocument();
  });

  it("refreshes the cached profile when signed-in waitlist confirmation succeeds", async () => {
    const user = userEvent.setup();
    mockSignedInUser();
    mockProfileContext({ id: "user-1", wants_android_access: false });

    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    await user.click(
      screen.getByRole("button", {
        name: /join android waitlist/i,
      }),
    );

    expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
  });
});
