/**
 * Unit tests for UnifiedAuthModal Terms of Service consent functionality
 * Tests passive consent behavior (no checkbox friction on OAuth buttons)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";

// Mock dependencies
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    signIn: jest.fn(),
    signUp: jest.fn(),
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
}));

jest.mock("@/context/location-context", () => ({
  useLocationSafe: () => null,
}));

jest.mock("@/lib/attribution", () => ({
  getAttributionFromCookies: () => ({}),
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  initiateOAuthFlow: jest.fn(),
  sendMagicLink: jest.fn(),
  validateEmail: (email: string) => email.includes("@"),
  validatePassword: () => ({ valid: true }),
  getAuthRedirect: () => null,
  setAuthRedirect: jest.fn(),
  clearAuthRedirect: jest.fn(),
}));

jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
  trackAuthMethodSelected: jest.fn(),
  trackAuthProviderSelected: jest.fn(),
  trackLoginStarted: jest.fn(),
  trackLoginSuccess: jest.fn(),
  trackLoginFailed: jest.fn(),
  trackSignupStarted: jest.fn(),
  trackSignupSuccess: jest.fn(),
  trackSignupFailed: jest.fn(),
  trackMagicLinkSent: jest.fn(),
  trackSignupFormSubmitted: jest.fn(),
  trackAuthModalClosedWithoutAction: jest.fn(),
  categorizeAuthError: jest.fn(),
  extractEmailDomain: jest.fn(),
}));

jest.mock("@/lib/mobile/apple-sign-in", () => ({
  signInWithApple: jest.fn(),
}));

describe("UnifiedAuthModal Terms Consent — Passive Model", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    mode: "signup" as const,
    source: "test",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("No checkbox in signup mode", () => {
    it("does not show a terms checkbox on the providers view", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it('does not render "I agree to the" text', () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      expect(screen.queryByText(/I agree to the/i)).not.toBeInTheDocument();
    });
  });

  describe("Passive consent text in signup mode", () => {
    it('shows passive consent text "By signing up, you agree to our"', () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      expect(
        screen.getByText(/By signing up, you agree to our/i)
      ).toBeInTheDocument();
    });

    it("shows Terms link pointing to /terms", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      const termsLink = screen.getByRole("link", { name: /Terms/i });
      expect(termsLink).toHaveAttribute("href", "/terms");
    });

    it("shows Privacy Policy link pointing to /privacy", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      const privacyLink = screen.getByRole("link", { name: /Privacy Policy/i });
      expect(privacyLink).toHaveAttribute("href", "/privacy");
    });

    it("Terms link opens in new tab with noopener noreferrer", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      const termsLink = screen.getByRole("link", { name: /Terms/i });
      expect(termsLink).toHaveAttribute("target", "_blank");
      expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("Privacy Policy link opens in new tab with noopener noreferrer", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      const privacyLink = screen.getByRole("link", { name: /Privacy Policy/i });
      expect(privacyLink).toHaveAttribute("target", "_blank");
      expect(privacyLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("OAuth buttons are always enabled in signup mode", () => {
    it("Google OAuth button is NOT disabled in signup mode", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      const googleButton = screen.getByRole("button", {
        name: /Continue with Google/i,
      });
      expect(googleButton).not.toBeDisabled();
    });

    it("Google OAuth button is NOT disabled in login mode", () => {
      render(<UnifiedAuthModal {...defaultProps} mode="login" />);

      const googleButton = screen.getByRole("button", {
        name: /Continue with Google/i,
      });
      expect(googleButton).not.toBeDisabled();
    });

    it("Google OAuth button is immediately clickable without any prior interaction", () => {
      const mockInitiateOAuthFlow = require("@/lib/auth/auth-utils").initiateOAuthFlow;
      mockInitiateOAuthFlow.mockResolvedValue({});

      render(<UnifiedAuthModal {...defaultProps} />);

      const googleButton = screen.getByRole("button", {
        name: /Continue with Google/i,
      });
      fireEvent.click(googleButton);

      expect(mockInitiateOAuthFlow).toHaveBeenCalled();
    });
  });

  describe("No passive consent text in login mode", () => {
    it("does not show passive consent text in login mode", () => {
      render(<UnifiedAuthModal {...defaultProps} mode="login" />);

      expect(
        screen.queryByText(/By signing up, you agree to our/i)
      ).not.toBeInTheDocument();
    });

    it("does not show a terms checkbox in login mode", () => {
      render(<UnifiedAuthModal {...defaultProps} mode="login" />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });
  });

  describe("Email/password form in signup mode", () => {
    it("does not show a terms checkbox on the email/password form", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      // Navigate to email form
      const emailButton = screen.getByRole("button", {
        name: /Continue with Email/i,
      });
      fireEvent.click(emailButton);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows passive consent text on the email/password signup form", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      fireEvent.click(
        screen.getByRole("button", { name: /Continue with Email/i })
      );

      expect(
        screen.getByText(/By signing up, you agree to our/i)
      ).toBeInTheDocument();
    });

    it("Sign up button is enabled without needing to check any box", () => {
      render(<UnifiedAuthModal {...defaultProps} />);

      fireEvent.click(
        screen.getByRole("button", { name: /Continue with Email/i })
      );

      const signupButton = screen.getByRole("button", { name: /Sign up/i });
      expect(signupButton).not.toBeDisabled();
    });
  });
});
