/**
 * Unit tests for AuthProviders component
 * Verifies passive consent behavior (no checkbox friction on OAuth buttons)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { AuthProviders } from "@/components/auth/auth-modal/AuthProviders";

const defaultProps = {
  mode: "signup" as const,
  enableOAuth: true,
  enablePassword: true,
  enableMagicLink: true,
  loading: false,
  onGoogleClick: jest.fn(),
  onEmailPasswordClick: jest.fn(),
  onMagicLinkClick: jest.fn(),
};

describe("AuthProviders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("OAuth buttons in signup mode", () => {
    it("Google button is NOT disabled in signup mode", () => {
      render(<AuthProviders {...defaultProps} />);

      const googleButton = screen.getByRole("button", {
        name: /Continue with Google/i,
      });
      expect(googleButton).not.toBeDisabled();
    });

    it("Google button is NOT disabled in login mode", () => {
      render(<AuthProviders {...defaultProps} mode="login" />);

      const googleButton = screen.getByRole("button", {
        name: /Continue with Google/i,
      });
      expect(googleButton).not.toBeDisabled();
    });

    it("Apple button is NOT disabled in signup mode when provided", () => {
      const onAppleClick = jest.fn();
      render(<AuthProviders {...defaultProps} onAppleClick={onAppleClick} />);

      const appleButton = screen.getByRole("button", {
        name: /Continue with Apple/i,
      });
      expect(appleButton).not.toBeDisabled();
    });

    it("Apple button is NOT disabled in login mode when provided", () => {
      const onAppleClick = jest.fn();
      render(
        <AuthProviders
          {...defaultProps}
          mode="login"
          onAppleClick={onAppleClick}
        />
      );

      const appleButton = screen.getByRole("button", {
        name: /Continue with Apple/i,
      });
      expect(appleButton).not.toBeDisabled();
    });

    it("Google button is clickable immediately in signup mode (no checkbox required)", () => {
      const onGoogleClick = jest.fn();
      render(<AuthProviders {...defaultProps} onGoogleClick={onGoogleClick} />);

      const googleButton = screen.getByRole("button", {
        name: /Continue with Google/i,
      });
      fireEvent.click(googleButton);

      expect(onGoogleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Terms checkbox is removed", () => {
    it("does not render a terms checkbox in signup mode", () => {
      render(<AuthProviders {...defaultProps} />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("does not render a terms checkbox in login mode", () => {
      render(<AuthProviders {...defaultProps} mode="login" />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it('does not render "I agree to the" text', () => {
      render(<AuthProviders {...defaultProps} />);

      expect(screen.queryByText(/I agree to the/i)).not.toBeInTheDocument();
    });
  });

  describe("Passive consent text in signup mode", () => {
    it('displays passive consent text: "By signing up, you agree to our"', () => {
      render(<AuthProviders {...defaultProps} />);

      expect(
        screen.getByText(/By signing up, you agree to our/i)
      ).toBeInTheDocument();
    });

    it("shows Terms link pointing to /terms", () => {
      render(<AuthProviders {...defaultProps} />);

      const termsLink = screen.getByRole("link", { name: /Terms/i });
      expect(termsLink).toHaveAttribute("href", "/terms");
    });

    it("shows Privacy Policy link pointing to /privacy", () => {
      render(<AuthProviders {...defaultProps} />);

      const privacyLink = screen.getByRole("link", { name: /Privacy Policy/i });
      expect(privacyLink).toHaveAttribute("href", "/privacy");
    });

    it("Terms link opens in new tab with noopener noreferrer", () => {
      render(<AuthProviders {...defaultProps} />);

      const termsLink = screen.getByRole("link", { name: /Terms/i });
      expect(termsLink).toHaveAttribute("target", "_blank");
      expect(termsLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("Privacy Policy link opens in new tab with noopener noreferrer", () => {
      render(<AuthProviders {...defaultProps} />);

      const privacyLink = screen.getByRole("link", { name: /Privacy Policy/i });
      expect(privacyLink).toHaveAttribute("target", "_blank");
      expect(privacyLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does NOT show passive consent text in login mode", () => {
      render(<AuthProviders {...defaultProps} mode="login" />);

      expect(
        screen.queryByText(/By signing up, you agree to our/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("Google button is disabled when loading (regardless of mode)", () => {
      render(<AuthProviders {...defaultProps} loading={true} />);

      const googleButton = screen.getByRole("button", {
        name: /Continue with Google/i,
      });
      expect(googleButton).toBeDisabled();
    });

    it("Email button is disabled when loading", () => {
      render(<AuthProviders {...defaultProps} loading={true} />);

      const emailButton = screen.getByRole("button", {
        name: /Continue with Email/i,
      });
      expect(emailButton).toBeDisabled();
    });
  });

  describe("OAuth provider visibility", () => {
    it("does not show OAuth buttons when enableOAuth is false", () => {
      render(<AuthProviders {...defaultProps} enableOAuth={false} />);

      expect(
        screen.queryByRole("button", { name: /Continue with Google/i })
      ).not.toBeInTheDocument();
    });

    it("does not show Apple button when onAppleClick is not provided", () => {
      render(<AuthProviders {...defaultProps} onAppleClick={undefined} />);

      expect(
        screen.queryByRole("button", { name: /Continue with Apple/i })
      ).not.toBeInTheDocument();
    });
  });
});
