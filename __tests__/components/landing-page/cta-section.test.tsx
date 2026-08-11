import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CTASection } from "@/components/landing-page/cta-section";
import { useAuth } from "@/context/auth-context";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

jest.mock("@/context/auth-context");

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
}));

jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
  trackIosAppCtaView: jest.fn(),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({
    isOpen,
    mode,
    source,
  }: {
    isOpen: boolean;
    mode: string;
    source: string;
  }) =>
    isOpen ? (
      <div data-testid="auth-modal" data-mode={mode} data-source={source} />
    ) : null,
}));

jest.mock("@/lib/constants/features", () => ({
  CONTENT: {
    hero: {
      cta: "Get my surf call",
    },
    sections: {
      cta: {
        title: "Ready to surf smarter?",
        subtitle: "Get your home break forecast.",
      },
    },
  },
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  useInView: () => true,
  useReducedMotion: () => false,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockTrackSignupCtaClick = trackSignupCtaClick as jest.Mock;
const mockTrackSignupCtaView = trackSignupCtaView as jest.Mock;
const mockTrackIosAppCtaClick = trackIosAppCtaClick as jest.Mock;
const mockTrackIosAppCtaView = trackIosAppCtaView as jest.Mock;

describe("CTASection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      session: null as any,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);
  });

  it("tracks the landing final CTA view with source-level metadata", async () => {
    render(
      <CTASection
        source="landing-final-cta"
        ctaType="bottom-cta"
        ctaCopyVariant="landing_final_v1"
      />,
    );

    await waitFor(() => {
      expect(mockTrackSignupCtaView).toHaveBeenCalledWith({
        source: "landing-final-cta",
        cta_type: "bottom-cta",
        cta_copy_variant: "landing_final_v1",
      });
    });
  });

  it("tracks click metadata and opens one signup modal", async () => {
    const user = userEvent.setup();

    render(
      <CTASection
        source="landing-final-cta"
        ctaType="bottom-cta"
        ctaCopyVariant="landing_final_v1"
      />,
    );

    await user.click(screen.getByRole("button", { name: /get my surf call/i }));

    expect(mockTrackSignupCtaClick).toHaveBeenCalledWith({
      source: "landing-final-cta",
      cta_type: "bottom-cta",
      cta_text: "Get my surf call",
      cta_copy_variant: "landing_final_v1",
    });
    expect(screen.getAllByTestId("auth-modal")).toHaveLength(1);
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-source",
      "landing-final-cta",
    );
  });

  it("renders and tracks the App Store CTA variant", async () => {
    const user = userEvent.setup();

    render(<CTASection source="landing-final-cta" variant="app-store" />);

    await waitFor(() => {
      expect(mockTrackIosAppCtaView).toHaveBeenCalledWith({
        source: "landing-final-cta",
        surface: "landing-page",
        placement: "landing_final_cta",
      });
    });

    const link = screen.getByRole("link", {
      name: new RegExp(IOS_APP_STORE_CTA, "i"),
    });
    link.addEventListener("click", (event) => event.preventDefault());

    expect(link).toHaveAttribute("href", IOS_APP_STORE_WEB_REDIRECT_PATH);
    expect(
      screen.getByText("Opens the current iPhone App Store listing."),
    ).toBeInTheDocument();

    await user.click(link);

    expect(mockTrackIosAppCtaClick).toHaveBeenCalledWith({
      source: "landing-final-cta",
      surface: "landing-page",
      placement: "landing_final_cta",
      cta_text: IOS_APP_STORE_CTA,
      destination_url: IOS_APP_STORE_WEB_REDIRECT_PATH,
    });
    expect(mockTrackSignupCtaClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
  });
});
