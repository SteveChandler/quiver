import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CTASection } from "@/components/landing-page/cta-section";
import { useAuth } from "@/context/auth-context";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

jest.mock("@/context/auth-context");

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
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
      cta: "Set up your home break",
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

    await user.click(
      screen.getByRole("button", { name: /set up your home break/i }),
    );

    expect(mockTrackSignupCtaClick).toHaveBeenCalledWith({
      source: "landing-final-cta",
      cta_type: "bottom-cta",
      cta_text: "Set up your home break",
      cta_copy_variant: "landing_final_v1",
    });
    expect(screen.getAllByTestId("auth-modal")).toHaveLength(1);
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-source",
      "landing-final-cta",
    );
  });
});
