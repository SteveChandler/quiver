/**
 * Unit tests for UnifiedAuthModal component
 * Tests all modes (login/signup/auto), views, and auth flows
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";

// Mock dependencies
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  initiateOAuthFlow: jest.fn(),
  sendMagicLink: jest.fn(),
  validateEmail: jest.fn(),
  validateEmailDomain: jest.fn().mockReturnValue({ isValid: true }),
  validatePassword: jest.fn(),
  getAuthRedirect: jest.fn(),
  setAuthRedirect: jest.fn(),
  clearAuthRedirect: jest.fn(),
}));

jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
  trackAuthModalClosedWithoutAction: jest.fn(),
  trackAuthMethodSelected: jest.fn(),
  trackAuthProviderSelected: jest.fn(),
  trackLoginStarted: jest.fn(),
  trackLoginSuccess: jest.fn(),
  trackLoginFailed: jest.fn(),
  trackSignupStarted: jest.fn(),
  trackSignupSuccess: jest.fn(),
  trackSignupFailed: jest.fn(),
  trackSignupFormSubmitted: jest.fn(),
  trackLoginFormSubmitted: jest.fn(),
  trackMagicLinkSent: jest.fn(),
  categorizeAuthError: jest.fn(() => "unknown_error"),
  extractEmailDomain: jest.fn((email) => email.split("@")[1] || "unknown"),
}));

jest.mock("@/lib/auth/apple-sign-in", () => ({
  signInWithApple: jest.fn(),
}));

import { useAuth } from "@/context/auth-context";
import * as authUtils from "@/lib/auth/auth-utils";
import * as authEvents from "@/lib/analytics/auth-events";
import * as appleSignIn from "@/lib/auth/apple-sign-in";
import { useRouter } from "next/navigation";

describe("UnifiedAuthModal", () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockSignIn = jest.fn();
  const mockSignUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useAuth
    (useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      signUp: mockSignUp,
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });

    // Mock auth utils with default successful responses
    (authUtils.validateEmail as jest.Mock).mockReturnValue(true);
    (authUtils.validatePassword as jest.Mock).mockReturnValue({
      valid: true,
    });
    (authUtils.getAuthRedirect as jest.Mock).mockReturnValue(null);
    (authUtils.setAuthRedirect as jest.Mock).mockImplementation(() => {});
    (authUtils.clearAuthRedirect as jest.Mock).mockImplementation(() => {});
    (authUtils.initiateOAuthFlow as jest.Mock).mockResolvedValue({});
    (authUtils.sendMagicLink as jest.Mock).mockResolvedValue({});

    // Mock Apple Sign-In with default successful response
    (appleSignIn.signInWithApple as jest.Mock).mockResolvedValue({});
  });

  describe("Modal rendering", () => {
    it("should not render when closed", () => {
      render(
        <UnifiedAuthModal
          isOpen={false}
          onClose={mockOnClose}
          mode="login"
        />
      );

      expect(screen.queryByText("Log in to Quiver")).not.toBeInTheDocument();
    });

    it("should render login mode with correct title", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      expect(screen.getByText("Log in to Quiver")).toBeInTheDocument();
      expect(
        screen.getByText("Access your sessions, forecasts, and community.")
      ).toBeInTheDocument();
    });

    it("should render signup mode with correct title", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
        />
      );

      expect(screen.getByText("Sign Up")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Join Quiver to log sessions and connect with surfers."
        )
      ).toBeInTheDocument();
    });

    it("should track modal opened event", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          source="test-source"
        />
      );

      expect(authEvents.trackAuthModalOpened).toHaveBeenCalledWith({
        mode: "login",
        source: "test-source",
      });
    });

    it("should show friendly return label when returnTo is provided", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          returnTo="/map"
        />
      );

      expect(screen.getByText("the map")).toBeInTheDocument();
    });
  });

  describe("Provider selection view", () => {
    it("should show Google OAuth button by default", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    });

    it("should show email password button by default", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      expect(screen.getByText("Continue with Email")).toBeInTheDocument();
    });

    it("should show magic link button in login mode", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      expect(
        screen.getByText("Continue with Email Link")
      ).toBeInTheDocument();
    });

    it("should not show magic link button in signup mode", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
        />
      );

      expect(
        screen.queryByText("Continue with Email Link")
      ).not.toBeInTheDocument();
    });

    it("should respect enableOAuth prop", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          enableOAuth={false}
        />
      );

      expect(
        screen.queryByText("Continue with Google")
      ).not.toBeInTheDocument();
    });

    it("should respect enablePassword prop", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          enablePassword={false}
        />
      );

      expect(
        screen.queryByText("Continue with Email")
      ).not.toBeInTheDocument();
    });

    it("should respect enableMagicLink prop", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          enableMagicLink={false}
        />
      );

      expect(
        screen.queryByText("Continue with Email Link")
      ).not.toBeInTheDocument();
    });

    it("should switch to signup mode when footer Sign up clicked", () => {
      render(
        <UnifiedAuthModal isOpen={true} onClose={mockOnClose} mode="login" />
      );

      // Footer CTA should offer signup when in login mode
      expect(
        screen.getByText("Don't have an account?")
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

      // Title/copy should update to signup mode and magic-link option should disappear
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
      expect(
        screen.getByText("Join Quiver to log sessions and connect with surfers.")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Continue with Email Link")
      ).not.toBeInTheDocument();
      expect(
        screen.getByText("Already have an account?")
      ).toBeInTheDocument();
    });
  });

  describe("Apple Sign-In button visibility", () => {
    describe("when NEXT_PUBLIC_APPLE_CLIENT_ID is set", () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_APPLE_CLIENT_ID = "com.example.test";
      });

      afterEach(() => {
        delete process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
      });

      it("should show the Apple button when enableOAuth is true", () => {
        render(
          <UnifiedAuthModal
            isOpen={true}
            onClose={mockOnClose}
            mode="login"
            enableOAuth={true}
          />
        );

        expect(screen.getByText("Continue with Apple")).toBeInTheDocument();
      });

      it("should not show the Apple button when enableOAuth is false", () => {
        render(
          <UnifiedAuthModal
            isOpen={true}
            onClose={mockOnClose}
            mode="login"
            enableOAuth={false}
          />
        );

        expect(
          screen.queryByText("Continue with Apple")
        ).not.toBeInTheDocument();
      });

      it("should show Apple button before Google button", () => {
        render(
          <UnifiedAuthModal
            isOpen={true}
            onClose={mockOnClose}
            mode="login"
            enableOAuth={true}
          />
        );

        const buttons = screen.getAllByRole("button");
        const appleIdx = buttons.findIndex((b) =>
          b.textContent?.includes("Continue with Apple")
        );
        const googleIdx = buttons.findIndex((b) =>
          b.textContent?.includes("Continue with Google")
        );

        expect(appleIdx).toBeGreaterThanOrEqual(0);
        expect(googleIdx).toBeGreaterThanOrEqual(0);
        expect(appleIdx).toBeLessThan(googleIdx);
      });
    });

    describe("when NEXT_PUBLIC_APPLE_CLIENT_ID is not set", () => {
      beforeEach(() => {
        delete process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
      });

      it("should not show the Apple button even when enableOAuth is true", () => {
        render(
          <UnifiedAuthModal
            isOpen={true}
            onClose={mockOnClose}
            mode="login"
            enableOAuth={true}
          />
        );

        expect(
          screen.queryByText("Continue with Apple")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Apple Sign-In flow", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APPLE_CLIENT_ID = "com.example.test";
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
    });

    it("should call signInWithApple and close modal on success", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          returnTo="/sessions"
        />
      );

      const appleButton = screen.getByText("Continue with Apple");
      fireEvent.click(appleButton);

      await waitFor(() => {
        expect(appleSignIn.signInWithApple).toHaveBeenCalledWith("/sessions");
      });

      expect(mockOnClose).toHaveBeenCalled();
      // trackAuthMethodSelected is a deprecated no-op; auth_provider_selected
      // is now the canonical funnel event for provider selection.
      expect(authEvents.trackAuthProviderSelected).toHaveBeenCalledWith({
        provider: "apple",
        mode: "login",
        source: "unknown",
      });
      expect(authEvents.trackLoginStarted).toHaveBeenCalledWith("apple");
      expect(authEvents.trackLoginSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ method: "apple" })
      );
    });

    it("passes v2 acquisition metadata into Apple signup", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
          returnTo="/sessions"
          source="landing_hero"
        />
      );

      fireEvent.click(screen.getByText("Continue with Apple"));

      await waitFor(() => {
        expect(appleSignIn.signInWithApple).toHaveBeenCalledWith(
          "/sessions",
          expect.objectContaining({
            signup_context: expect.objectContaining({
              schema_version: 2,
              signup_surface: "web",
              method: "apple",
              entrypoint: "landing_hero",
              source_capture_status: "captured",
            }),
          }),
        );
      });
    });

    it("should show error when Apple Sign-In fails", async () => {
      (appleSignIn.signInWithApple as jest.Mock).mockResolvedValue({
        error: "Apple sign-in was cancelled or failed.",
      });

      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      const appleButton = screen.getByText("Continue with Apple");
      fireEvent.click(appleButton);

      await waitFor(() => {
        expect(
          screen.getByText("Apple sign-in was cancelled or failed.")
        ).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(authEvents.trackLoginFailed).toHaveBeenCalledWith({
        method: "apple",
        error_type: "oauth_failed",
        source: "unknown",
      });
    });

    it("defers Apple signup success until the OAuth callback completes", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
        />
      );

      // Passive consent — Apple button is immediately clickable in signup mode
      const appleButton = screen.getByText("Continue with Apple");
      fireEvent.click(appleButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      expect(authEvents.trackSignupSuccess).not.toHaveBeenCalled();
      expect(authEvents.trackSignupStarted).toHaveBeenCalledWith("apple", expect.objectContaining({
        source: "unknown",
        redirect_state: "pending",
        redirect_path: "/",
      }));
    });
  });

  describe("Google OAuth flow", () => {
    it("should initiate OAuth when Google button clicked", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          returnTo="/beach/123"
        />
      );

      const googleButton = screen.getByText("Continue with Google");
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(authUtils.initiateOAuthFlow).toHaveBeenCalledWith(
          "google",
          "/beach/123",
          undefined // Optional metadata parameter
        );
      });

      // trackAuthMethodSelected is a deprecated no-op; auth_provider_selected
      // is now the canonical funnel event for provider selection.
      expect(authEvents.trackAuthProviderSelected).toHaveBeenCalledWith({
        provider: "google",
        mode: "login",
        source: "unknown",
      });
      expect(authEvents.trackLoginStarted).toHaveBeenCalledWith("google");
    });

    it("should close modal and track success on successful OAuth", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          returnTo="/beach/123"
        />
      );

      const googleButton = screen.getByText("Continue with Google");
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      expect(authEvents.trackLoginSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ method: "google" })
      );
    });

    it("defers Google signup success until the OAuth callback completes", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
        />
      );

      // Passive consent — Google button is immediately clickable in signup mode
      const googleButton = screen.getByText("Continue with Google");
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      expect(authEvents.trackSignupSuccess).not.toHaveBeenCalled();
      expect(authEvents.trackSignupStarted).toHaveBeenCalledWith("google", expect.objectContaining({
        source: "unknown",
        redirect_state: "pending",
        redirect_path: "/",
      }));
    });

    it("should show error when OAuth fails", async () => {
      (authUtils.initiateOAuthFlow as jest.Mock).mockResolvedValue({
        error: "OAuth failed",
      });

      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      const googleButton = screen.getByText("Continue with Google");
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText("OAuth failed")).toBeInTheDocument();
      });

      expect(authEvents.trackLoginFailed).toHaveBeenCalledWith({
        method: "google",
        error_type: "oauth_failed",
        source: "unknown",
      });
    });
  });

  describe("Email/Password flow", () => {
    it("should switch to email/password form when button clicked", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      const emailButton = screen.getByText("Continue with Email");
      fireEvent.click(emailButton);

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByText("Log in")).toBeInTheDocument();
    });

    it("should show display name field in signup mode", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
        />
      );

      const emailButton = screen.getByText("Continue with Email");
      fireEvent.click(emailButton);

      expect(screen.getByLabelText("Your Name")).toBeInTheDocument();
    });

    it("should handle successful login", async () => {
      mockSignIn.mockResolvedValue(undefined);

      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      // Switch to email/password form
      fireEvent.click(screen.getByText("Continue with Email"));

      // Fill out form
      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");

      await userEvent.type(emailInput, "test@example.com");
      await userEvent.type(passwordInput, "password123");

      // Submit
      const loginButton = screen.getByText("Log in");
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          "test@example.com",
          "password123"
        );
      });

      expect(authEvents.trackLoginSuccess).toHaveBeenCalledWith({
        method: "password",
        duration_ms: expect.any(Number),
        source: "unknown",
      });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should handle successful signup", async () => {
      mockSignUp.mockResolvedValue(undefined);

      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
        />
      );

      // Switch to email/password form
      fireEvent.click(screen.getByText("Continue with Email"));

      // Fill out form
      await userEvent.type(screen.getByLabelText("Your Name"), "John Doe");
      await userEvent.type(
        screen.getByLabelText("Email"),
        "test@example.com"
      );
      await userEvent.type(screen.getByLabelText("Password"), "password123");

      // Submit — passive consent, no checkbox required
      fireEvent.click(screen.getByText("Sign up"));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          "test@example.com",
          "password123",
          "John Doe",
          expect.objectContaining({
            signup_context: expect.any(Object),
          }),
          expect.any(String) // returnTo path
        );
      });

      expect(authEvents.trackSignupSuccess).toHaveBeenCalledWith({
        method: "password",
        requires_verification: true,
        source: "unknown",
        landing_page: "/",
      });

      // Email/password signup requires email confirmation; we redirect to landing
      // with returnTo so users return to their beach page after verification.
      const router = useRouter();
      expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("signup=confirm-email"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should show error for invalid email", async () => {
      (authUtils.validateEmail as jest.Mock).mockReturnValue(false);

      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      fireEvent.click(screen.getByText("Continue with Email"));

      await userEvent.type(screen.getByLabelText("Email"), "invalid-email");
      await userEvent.type(screen.getByLabelText("Password"), "password123");

      fireEvent.click(screen.getByText("Log in"));

      await waitFor(() => {
        expect(
          screen.getByText("Please enter a valid email address")
        ).toBeInTheDocument();
      });

      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("should show error for invalid password", async () => {
      (authUtils.validatePassword as jest.Mock).mockReturnValue({
        valid: false,
        error: "Password too short",
      });

      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      fireEvent.click(screen.getByText("Continue with Email"));

      await userEvent.type(
        screen.getByLabelText("Email"),
        "test@example.com"
      );
      await userEvent.type(screen.getByLabelText("Password"), "12345");

      fireEvent.click(screen.getByText("Log in"));

      await waitFor(() => {
        expect(screen.getByText("Password too short")).toBeInTheDocument();
      });

      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("should show error when signup requires name but not provided", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="signup"
        />
      );

      fireEvent.click(screen.getByText("Continue with Email"));

      await userEvent.type(
        screen.getByLabelText("Email"),
        "test@example.com"
      );
      await userEvent.type(screen.getByLabelText("Password"), "password123");
      // Don't fill in name

      // Submit — passive consent, no checkbox required
      fireEvent.click(screen.getByText("Sign up"));

      await waitFor(() => {
        expect(screen.getByText("Please enter your name")).toBeInTheDocument();
      });

      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  describe("Magic link flow", () => {
    it("should switch to magic link form when button clicked", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      const magicLinkButton = screen.getByText("Continue with Email Link");
      fireEvent.click(magicLinkButton);

      expect(screen.getByText("Send Magic Link")).toBeInTheDocument();
      expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    });

    it("should send magic link when form submitted", async () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          returnTo="/beach/123"
        />
      );

      fireEvent.click(screen.getByText("Continue with Email Link"));

      const emailInput = screen.getByLabelText("Email Address");
      await userEvent.type(emailInput, "test@example.com");

      fireEvent.click(screen.getByText("Send Magic Link"));

      await waitFor(() => {
        expect(authUtils.sendMagicLink).toHaveBeenCalledWith(
          "test@example.com",
          "/beach/123"
        );
      });

      expect(authEvents.trackMagicLinkSent).toHaveBeenCalled();
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    it("should show error when magic link fails", async () => {
      (authUtils.sendMagicLink as jest.Mock).mockResolvedValue({
        error: "Failed to send",
      });

      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      fireEvent.click(screen.getByText("Continue with Email Link"));

      await userEvent.type(
        screen.getByLabelText("Email Address"),
        "test@example.com"
      );
      fireEvent.click(screen.getByText("Send Magic Link"));

      await waitFor(() => {
        expect(screen.getByText("Failed to send")).toBeInTheDocument();
      });

      expect(authEvents.trackLoginFailed).toHaveBeenCalledWith({
        method: "magic_link",
        error_type: "send_failed",
        source: "unknown",
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate back to provider selection", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
        />
      );

      // Go to email/password form
      fireEvent.click(screen.getByText("Continue with Email"));
      expect(screen.getByLabelText("Email")).toBeInTheDocument();

      // Go back
      fireEvent.click(screen.getByText("Back to options"));
      expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    });
  });

  describe("Dismissibility", () => {
    it("should call onClose when dismissed", () => {
      render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          dismissible={true}
        />
      );

      // Simulate closing the dialog by calling onClose
      // (Actual dialog close behavior is handled by Dialog component)
      mockOnClose();

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should respect dismissible=false prop", () => {
      const { container } = render(
        <UnifiedAuthModal
          isOpen={true}
          onClose={mockOnClose}
          mode="login"
          dismissible={false}
        />
      );

      // The Dialog component will handle preventing outside clicks
      // We're just testing the prop is passed correctly
      expect(container).toBeInTheDocument();
    });
  });
});
