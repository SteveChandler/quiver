/**
 * Unit tests for auth-events.ts
 * Tests that all analytics events are tracked correctly with proper parameters
 */

import {
  trackAuthModalOpened,
  trackAuthModalClosedWithoutAction,
  trackAuthMethodSelected,
  trackAuthProviderSelected,
  trackLoginStarted,
  trackLoginSuccess,
  trackLoginFailed,
  trackSignupStarted,
  trackSignupSuccess,
  trackSignupFailed,
  trackMagicLinkSent,
  trackMagicLinkClicked,
  trackAuthRedirectCompleted,
  trackAuthWallShown,
  trackAuthWallDismissed,
  trackSignupFormSubmitted,
  categorizeAuthError,
  extractEmailDomain,
} from "@/lib/analytics/auth-events";

// Mock the analytics track function
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

// Mock visitor-id so fireToUserEvents doesn't throw in tests
jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "test-visitor-id"),
}));

import { track } from "@/lib/analytics";

// Silence fetch calls from fireToUserEvents in tests
const mockFetch = jest.fn(() => Promise.resolve({ ok: true }));
global.fetch = mockFetch as any;

describe("auth-events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("Modal events", () => {
    describe("trackAuthModalOpened", () => {
      it("should track modal opened with mode and source", () => {
        trackAuthModalOpened({ mode: "login", source: "landing-navbar" });

        expect(track).toHaveBeenCalledWith("auth_modal_opened", {
          mode: "login",
          source: "landing-navbar",
          context: undefined,
        });
      });

      it("should track modal opened with context", () => {
        trackAuthModalOpened({
          mode: "signup",
          source: "auth-gate",
          context: "beach-detail",
        });

        expect(track).toHaveBeenCalledWith("auth_modal_opened", {
          mode: "signup",
          source: "auth-gate",
          context: "beach-detail",
        });
      });

      it("should track auto mode", () => {
        trackAuthModalOpened({ mode: "auto", source: "content-gate" });

        expect(track).toHaveBeenCalledWith("auth_modal_opened", {
          mode: "auto",
          source: "content-gate",
          context: undefined,
        });
      });
    });

    describe("trackAuthModalClosedWithoutAction", () => {
      it("should track modal closed without action with mode and source", () => {
        trackAuthModalClosedWithoutAction({ mode: "signup", source: "landing-cta" });

        expect(track).toHaveBeenCalledWith("auth_modal_closed_without_action", {
          mode: "signup",
          source: "landing-cta",
        });
      });

      it("should dual-fire to /api/events", () => {
        trackAuthModalClosedWithoutAction({ mode: "login", source: "content-gate" });

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/events",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("auth_modal_closed_without_action"),
          })
        );
      });
    });

    describe("trackAuthProviderSelected", () => {
      it("should track provider selected with provider, mode, and source", () => {
        trackAuthProviderSelected({ provider: "google", mode: "signup", source: "landing-cta" });

        expect(track).toHaveBeenCalledWith("auth_provider_selected", {
          provider: "google",
          mode: "signup",
          source: "landing-cta",
        });
      });

      it("should dual-fire to /api/events", () => {
        trackAuthProviderSelected({ provider: "apple", mode: "login", source: "auth-gate" });

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/events",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("auth_provider_selected"),
          })
        );
      });
    });

    describe("trackSignupFormSubmitted", () => {
      it("should track form submission with mode and source", () => {
        trackSignupFormSubmitted({ mode: "signup", source: "landing-cta" });

        expect(track).toHaveBeenCalledWith("signup_form_submitted", {
          mode: "signup",
          source: "landing-cta",
        });
      });

      it("should dual-fire to /api/events", () => {
        trackSignupFormSubmitted({ mode: "login", source: "auth-gate" });

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/events",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("signup_form_submitted"),
          })
        );
      });
    });

    describe("trackAuthModalOpened dual-fire", () => {
      it("should dual-fire to /api/events", () => {
        trackAuthModalOpened({ mode: "signup", source: "landing-cta" });

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/events",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("auth_modal_opened"),
          })
        );
      });
    });

    describe("trackAuthMethodSelected", () => {
      it("should track Google OAuth selection", () => {
        trackAuthMethodSelected({ method: "google", mode: "login" });

        expect(track).toHaveBeenCalledWith("auth_method_selected", {
          method: "google",
          mode: "login",
        });
      });

      it("should track password selection", () => {
        trackAuthMethodSelected({ method: "password", mode: "signup" });

        expect(track).toHaveBeenCalledWith("auth_method_selected", {
          method: "password",
          mode: "signup",
        });
      });

      it("should track magic link selection", () => {
        trackAuthMethodSelected({ method: "magic_link", mode: "login" });

        expect(track).toHaveBeenCalledWith("auth_method_selected", {
          method: "magic_link",
          mode: "login",
        });
      });
    });
  });

  describe("Login events", () => {
    describe("trackLoginStarted", () => {
      it("should track login started with method and timestamp", () => {
        trackLoginStarted("google");

        expect(track).toHaveBeenCalledWith("login_started", {
          method: "google",
          timestamp: expect.any(Number),
        });
      });
    });

    describe("trackLoginSuccess", () => {
      it("should track successful login with duration", () => {
        trackLoginSuccess({ method: "password", duration_ms: 1234 });

        expect(track).toHaveBeenCalledWith("login_success", {
          method: "password",
          duration_ms: 1234,
        });
      });
    });

    describe("trackLoginFailed", () => {
      it("should track failed login with error type", () => {
        trackLoginFailed({
          method: "google",
          error_type: "oauth_failed",
        });

        expect(track).toHaveBeenCalledWith("login_failed", {
          method: "google",
          error_type: "oauth_failed",
        });
      });
    });
  });

  describe("Signup events", () => {
    describe("trackSignupStarted", () => {
      it("should track signup started with method and timestamp", () => {
        trackSignupStarted("password");

        expect(track).toHaveBeenCalledWith("signup_started", {
          method: "password",
          timestamp: expect.any(Number),
        });
      });
    });

    describe("trackSignupSuccess", () => {
      it("should track successful signup with verification flag", () => {
        trackSignupSuccess({
          method: "password",
          requires_verification: true,
        });

        expect(track).toHaveBeenCalledWith("signup_success", {
          method: "password",
          requires_verification: true,
        });
      });

      it("should track signup without verification", () => {
        trackSignupSuccess({
          method: "google",
          requires_verification: false,
        });

        expect(track).toHaveBeenCalledWith("signup_success", {
          method: "google",
          requires_verification: false,
        });
      });
    });

    describe("trackSignupFailed", () => {
      it("should track failed signup with error type", () => {
        trackSignupFailed({
          method: "password",
          error_type: "email_exists",
        });

        expect(track).toHaveBeenCalledWith("signup_failed", {
          method: "password",
          error_type: "email_exists",
        });
      });
    });
  });

  describe("Magic link events", () => {
    describe("trackMagicLinkSent", () => {
      it("should track magic link sent with email domain", () => {
        trackMagicLinkSent("gmail.com");

        expect(track).toHaveBeenCalledWith("magic_link_sent", {
          email_domain: "gmail.com",
        });
      });
    });

    describe("trackMagicLinkClicked", () => {
      it("should track magic link clicked with timestamp", () => {
        trackMagicLinkClicked();

        expect(track).toHaveBeenCalledWith("magic_link_clicked", {
          timestamp: expect.any(Number),
        });
      });
    });
  });

  describe("Redirect events", () => {
    describe("trackAuthRedirectCompleted", () => {
      it("should track redirect completed with return path", () => {
        trackAuthRedirectCompleted("/beach/123");

        expect(track).toHaveBeenCalledWith("auth_redirect_completed", {
          return_path: "/beach/123",
        });
      });
    });
  });

  describe("Auth wall events", () => {
    describe("trackAuthWallShown", () => {
      it("should track auth wall shown with delay", () => {
        trackAuthWallShown(5000);

        expect(track).toHaveBeenCalledWith("auth_wall_shown", {
          delay_ms: 5000,
        });
      });
    });

    describe("trackAuthWallDismissed", () => {
      it("should track auth wall dismissed with timestamp", () => {
        trackAuthWallDismissed();

        expect(track).toHaveBeenCalledWith("auth_wall_dismissed", {
          timestamp: expect.any(Number),
        });
      });
    });
  });

  describe("Utility functions", () => {
    describe("categorizeAuthError", () => {
      it("should categorize invalid credentials error", () => {
        const result = categorizeAuthError("invalid_credentials");
        expect(result).toBe("invalid_credentials");
      });

      it("should categorize email not confirmed error", () => {
        const result = categorizeAuthError("email not confirmed");
        expect(result).toBe("email_not_confirmed");
      });

      it("should categorize weak password error", () => {
        const result = categorizeAuthError("weak_password");
        expect(result).toBe("weak_password");
      });

      it("should categorize email exists error", () => {
        const result = categorizeAuthError("email already exists");
        expect(result).toBe("email_exists");
      });

      it("should categorize network error", () => {
        const result = categorizeAuthError("network timeout");
        expect(result).toBe("network_error");
      });

      it("should categorize unknown string error", () => {
        const result = categorizeAuthError("something went wrong");
        expect(result).toBe("unknown_error");
      });

      it("should handle Error objects", () => {
        const error = new Error("invalid_credentials");
        const result = categorizeAuthError(error);
        expect(result).toBe("invalid_credentials");
      });

      it("should handle unknown error types", () => {
        const result = categorizeAuthError({ code: "unknown" });
        expect(result).toBe("unknown_error");
      });
    });

    describe("extractEmailDomain", () => {
      it("should extract domain from email", () => {
        const result = extractEmailDomain("user@gmail.com");
        expect(result).toBe("gmail.com");
      });

      it("should extract domain from subdomain email", () => {
        const result = extractEmailDomain("user@mail.example.com");
        expect(result).toBe("mail.example.com");
      });

      it("should handle invalid email", () => {
        const result = extractEmailDomain("notanemail");
        expect(result).toBe("unknown");
      });

      it("should handle empty string", () => {
        const result = extractEmailDomain("");
        expect(result).toBe("unknown");
      });

      it("should handle email without domain", () => {
        const result = extractEmailDomain("user@");
        expect(result).toBe("");
      });
    });
  });
});
