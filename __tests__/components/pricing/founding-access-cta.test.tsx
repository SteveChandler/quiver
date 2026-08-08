import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { FoundingAccessCta } from "@/components/pricing/founding-access-cta";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { ANDROID_BETA_LANDING_PATH } from "@/lib/constants/app-store";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/components/pricing/android-waitlist-cta", () => ({
  AndroidWaitlistCta: ({
    children,
    source,
    surface,
    placement,
  }: {
    children: ReactNode;
    source: string;
    surface: string;
    placement: string;
  }) => (
    <a
      href={ANDROID_BETA_LANDING_PATH}
      data-testid="android-waitlist-cta"
      data-source={source}
      data-surface={surface}
      data-placement={placement}
    >
      {children}
    </a>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;

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
    mockUseDataFetcher.mockReturnValue({
      data: false,
      loading: false,
      error: null,
      refetch: jest.fn(),
      retry: jest.fn(),
      reset: jest.fn(),
      invalidateCache: jest.fn(),
    });
  });

  it("renders the guided Android beta handoff for anonymous users", () => {
    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    expect(
      screen.getByRole("link", {
        name: /get the android beta/i,
      }),
    ).toHaveAttribute("data-placement", "plans_primary");
    expect(screen.getByTestId("android-waitlist-cta")).toHaveAttribute(
      "href",
      ANDROID_BETA_LANDING_PATH,
    );
    expect(screen.getByTestId("android-waitlist-cta")).toHaveAttribute(
      "data-source",
      "plans-test",
    );
    expect(screen.getByTestId("android-waitlist-cta")).toHaveAttribute(
      "data-surface",
      "plans",
    );
    expect(
      screen.getByText(/personalized surf decisions.*session logging/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/free year|year of pro/i)).not.toBeInTheDocument();
  });

  it("routes signed-in users to the same guided handoff", () => {
    mockSignedInUser();

    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    expect(screen.getByTestId("founding-access-signed-in-state")).toBeVisible();
    expect(
      screen.getByText(/open the android beta instructions to get started/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /view android beta steps/i,
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
      screen.getByRole("link", {
        name: /view android beta steps/i,
      }),
    ).toHaveAttribute("data-placement", "plans_compact_signed_in");
    expect(
      screen.queryByRole("link", {
        name: /open quiver/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows persisted Android beta status for signed-in users who already joined", () => {
    mockSignedInUser();
    mockUseDataFetcher.mockReturnValue({
      data: true,
      loading: false,
      error: null,
      refetch: jest.fn(),
      retry: jest.fn(),
      reset: jest.fn(),
      invalidateCache: jest.fn(),
    });

    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    expect(screen.getByTestId("founding-access-signed-in-state")).toBeVisible();
    expect(
      screen.getByText(/earlier android beta signup is recorded/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /view android beta steps/i,
      }),
    ).toHaveAttribute("href", ANDROID_BETA_LANDING_PATH);
    expect(
      screen.getByRole("link", {
        name: /open quiver/i,
      }),
    ).toBeInTheDocument();
  });

  it("loads canonical status only for signed-in users", () => {
    mockSignedInUser();

    render(<FoundingAccessCta source="plans-test" surface="plans" />);

    expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
      skip: false,
      initialData: false,
    });
  });
});
