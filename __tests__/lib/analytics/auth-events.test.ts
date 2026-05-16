/**
 * Unit tests for auth-events.ts
 * Tests that all analytics events are tracked correctly with proper parameters,
 * and that key auth funnel events dual-fire to the internal user_events table.
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
  trackLoginFormSubmitted,
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

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    capture: jest.fn(),
  },
}));

import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";
import posthog from "posthog-js";

const mockFetch = jest.fn(() => Promise.resolve({ ok: true } as Response));
global.fetch = mockFetch as any;

describe("auth-events", () => {
  const originalPostHogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    global.fetch = mockFetch;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true } as Response);
    Object.defineProperty(window, "innerWidth", { value: 375, writable: true });
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalPostHogToken;
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
      it("should track form submission with hardcoded signup mode and source", () => {
        trackSignupFormSubmitted({ source: "landing-cta" });

        expect(track).toHaveBeenCalledWith("signup_form_submitted", {
          mode: "signup",
          source: "landing-cta",
        });
      });

      it("should dual-fire to /api/events", () => {
        trackSignupFormSubmitted({ source: "auth-gate" });

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/events",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("signup_form_submitted"),
          })
        );
      });
    });

    describe("trackLoginFormSubmitted", () => {
      it("should track form submission with hardcoded login mode and source", () => {
        trackLoginFormSubmitted({ source: "landing-navbar" });

        expect(track).toHaveBeenCalledWith("login_form_submitted", {
          mode: "login",
          source: "landing-navbar",
        });
      });

      it("should dual-fire to /api/events", () => {
        trackLoginFormSubmitted({ source: "app-header" });

        expect(mockFetch).toHaveBeenCalledWith(
          "/api/events",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("login_form_submitted"),
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

    describe("trackAuthMethodSelected (deprecated no-op)", () => {
      let warnSpy: jest.SpyInstance;
      let originalNodeEnv: string | undefined;

      beforeEach(() => {
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        originalNodeEnv = process.env.NODE_ENV;
      });

      afterEach(() => {
        warnSpy.mockRestore();
        if (originalNodeEnv === undefined) {
          delete (process.env as Record<string, string | undefined>).NODE_ENV;
        } else {
          (process.env as Record<string, string | undefined>).NODE_ENV =
            originalNodeEnv;
        }
      });

      it("should not call track() or fetch (no-op)", () => {
        trackAuthMethodSelected({ method: "google", mode: "login" });
        trackAuthMethodSelected({ method: "password", mode: "signup" });
        trackAuthMethodSelected({ method: "magic_link", mode: "login" });
        trackAuthMethodSelected({ method: "apple", mode: "signup" });

        expect(track).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should warn in development", () => {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          "development";

        trackAuthMethodSelected({ method: "google", mode: "login" });

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("[deprecated] trackAuthMethodSelected")
        );
      });

      it("should not warn outside development", () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = "test";

        trackAuthMethodSelected({ method: "google", mode: "login" });

        expect(warnSpy).not.toHaveBeenCalled();
      });
    });

    describe("trackAuthProviderSelected (covers former trackAuthMethodSelected provider paths)", () => {
      it("should track Google provider selection", () => {
        trackAuthProviderSelected({
          provider: "google",
          mode: "login",
          source: "auth-modal",
        });

        expect(track).toHaveBeenCalledWith("auth_provider_selected", {
          provider: "google",
          mode: "login",
          source: "auth-modal",
        });
      });

      it("should track Apple provider selection", () => {
        trackAuthProviderSelected({
          provider: "apple",
          mode: "signup",
          source: "auth-modal",
        });

        expect(track).toHaveBeenCalledWith("auth_provider_selected", {
          provider: "apple",
          mode: "signup",
          source: "auth-modal",
        });
      });

      it("should track email/password provider selection", () => {
        trackAuthProviderSelected({
          provider: "email",
          mode: "signup",
          source: "auth-modal",
          email_method: "password",
        });

        expect(track).toHaveBeenCalledWith("auth_provider_selected", {
          provider: "email",
          mode: "signup",
          source: "auth-modal",
          email_method: "password",
        });
      });

      it("should track email/magic-link provider selection", () => {
        trackAuthProviderSelected({
          provider: "email",
          mode: "login",
          source: "auth-modal",
          email_method: "magic_link",
        });

        expect(track).toHaveBeenCalledWith("auth_provider_selected", {
          provider: "email",
          mode: "login",
          source: "auth-modal",
          email_method: "magic_link",
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
        expect(posthog.capture).toHaveBeenCalledWith("user_signed_in", {
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

      it("should include source and landing_page when provided", () => {
        trackSignupStarted("google", {
          source: "intent-longboard-torrance",
          landing_page: "/longboard/torrance/torrance-beach",
        });

        expect(track).toHaveBeenCalledWith("signup_started", {
          method: "google",
          timestamp: expect.any(Number),
          source: "intent-longboard-torrance",
          landing_page: "/longboard/torrance/torrance-beach",
        });
      });

      it("should omit source and landing_page when not provided", () => {
        trackSignupStarted("password");

        const callArgs = (track as jest.Mock).mock.calls[0][1];
        expect(callArgs).not.toHaveProperty("source");
        expect(callArgs).not.toHaveProperty("landing_page");
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

      it("should include source and landing_page when provided", () => {
        trackSignupSuccess({
          method: "google",
          requires_verification: false,
          source: "beach-detail-blacks",
          landing_page: "/ca/san-diego/blacks-beach",
        });

        expect(track).toHaveBeenCalledWith("signup_success", {
          method: "google",
          requires_verification: false,
          source: "beach-detail-blacks",
          landing_page: "/ca/san-diego/blacks-beach",
        });
      });

      it("should omit source and landing_page when not provided", () => {
        trackSignupSuccess({
          method: "password",
          requires_verification: true,
        });

        const callArgs = (track as jest.Mock).mock.calls[0][1];
        expect(callArgs).not.toHaveProperty("source");
        expect(callArgs).not.toHaveProperty("landing_page");
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

  describe("Dual-fire to user_events (internal DB)", () => {
    describe("trackAuthModalOpened", () => {
      it("calls both track() and fetch('/api/events')", () => {
        trackAuthModalOpened({ mode: "signup", source: "landing-navbar" });

        expect(track).toHaveBeenCalledWith("auth_modal_opened", {
          mode: "signup",
          source: "landing-navbar",
          context: undefined,
        });
        expect(mockFetch).toHaveBeenCalledWith("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "auth_modal_opened",
            metadata: { mode: "signup", source: "landing-navbar", context: undefined },
            sessionId: "test-visitor-id",
            viewportWidth: 375,
          }),
          keepalive: true,
        });
      });

      it("fetch body includes eventType, metadata, sessionId, viewportWidth", () => {
        trackAuthModalOpened({ mode: "login", source: "auth-gate", context: "beach-detail" });

        const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body).toMatchObject({
          eventType: "auth_modal_opened",
          metadata: { mode: "login", source: "auth-gate", context: "beach-detail" },
          sessionId: "test-visitor-id",
          viewportWidth: 375,
        });
      });
    });

    describe("trackAuthProviderSelected dual-fire", () => {
      it("calls both track() and fetch('/api/events')", () => {
        trackAuthProviderSelected({
          provider: "google",
          mode: "signup",
          source: "landing-cta",
        });

        expect(track).toHaveBeenCalledWith("auth_provider_selected", {
          provider: "google",
          mode: "signup",
          source: "landing-cta",
        });
        expect(mockFetch).toHaveBeenCalledWith("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "auth_provider_selected",
            metadata: {
              provider: "google",
              mode: "signup",
              source: "landing-cta",
            },
            sessionId: "test-visitor-id",
            viewportWidth: 375,
          }),
          keepalive: true,
        });
      });
    });

    describe("trackSignupStarted", () => {
      it("calls both track() and fetch('/api/events')", () => {
        jest.spyOn(Date, "now").mockReturnValue(1741827600000);
        trackSignupStarted("password");

        expect(track).toHaveBeenCalledWith("signup_started", {
          method: "password",
          timestamp: 1741827600000,
        });
        expect(mockFetch).toHaveBeenCalledWith("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "signup_started",
            metadata: { method: "password", timestamp: 1741827600000 },
            sessionId: "test-visitor-id",
            viewportWidth: 375,
          }),
          keepalive: true,
        });
        jest.spyOn(Date, "now").mockRestore();
      });

      it("dual-fires source and landing_page when provided", () => {
        jest.spyOn(Date, "now").mockReturnValue(1741827600000);
        trackSignupStarted("google", {
          source: "hero-cta",
          landing_page: "/",
        });

        const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body.metadata).toMatchObject({
          method: "google",
          source: "hero-cta",
          landing_page: "/",
        });
        jest.spyOn(Date, "now").mockRestore();
      });
    });

    describe("trackSignupSuccess", () => {
      it("calls both track() and fetch('/api/events')", () => {
        trackSignupSuccess({ method: "google", requires_verification: false });

        expect(track).toHaveBeenCalledWith("signup_success", {
          method: "google",
          requires_verification: false,
        });
        expect(mockFetch).toHaveBeenCalledWith("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "signup_success",
            metadata: { method: "google", requires_verification: false },
            sessionId: "test-visitor-id",
            viewportWidth: 375,
          }),
          keepalive: true,
        });
      });

      it("fetch body includes all required fields", () => {
        trackSignupSuccess({ method: "password", requires_verification: true });

        const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body).toMatchObject({
          eventType: "signup_success",
          metadata: { method: "password", requires_verification: true },
          sessionId: "test-visitor-id",
          viewportWidth: expect.any(Number),
        });
      });

      it("dual-fires source and landing_page when provided", () => {
        trackSignupSuccess({
          method: "google",
          requires_verification: false,
          source: "intent-longboard-torrance",
          landing_page: "/longboard/torrance/torrance-beach",
        });

        const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body.metadata).toMatchObject({
          method: "google",
          requires_verification: false,
          source: "intent-longboard-torrance",
          landing_page: "/longboard/torrance/torrance-beach",
        });
      });
    });

    describe("trackLoginSuccess", () => {
      it("calls both track() and fetch('/api/events')", () => {
        trackLoginSuccess({ method: "apple", duration_ms: 800 });

        expect(track).toHaveBeenCalledWith("login_success", {
          method: "apple",
          duration_ms: 800,
        });
        expect(mockFetch).toHaveBeenCalledWith("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "login_success",
            metadata: { method: "apple", duration_ms: 800 },
            sessionId: "test-visitor-id",
            viewportWidth: 375,
          }),
          keepalive: true,
        });
      });
    });

    describe("sessionId comes from getVisitorId()", () => {
      it("uses visitor id from getVisitorId()", () => {
        (getVisitorId as jest.Mock).mockReturnValue("custom-visitor-xyz");
        trackSignupSuccess({ method: "google", requires_verification: false });

        const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body.sessionId).toBe("custom-visitor-xyz");
      });
    });

    describe("SSR safety", () => {
      it("does not call fetch when window is undefined", () => {
        const origWindow = global.window;
        // @ts-expect-error -- simulating SSR
        delete global.window;

        trackSignupSuccess({ method: "google", requires_verification: false });

        // track() is still called (it has its own SSR guard)
        expect(track).toHaveBeenCalled();
        // but fetch should not be called
        expect(mockFetch).not.toHaveBeenCalled();

        global.window = origWindow;
      });
    });

    describe("error handling", () => {
      it("swallows fetch errors silently", () => {
        mockFetch.mockImplementationOnce(() => Promise.reject(new Error("network")));
        expect(() => trackSignupSuccess({ method: "google", requires_verification: false })).not.toThrow();
      });

      it("swallows synchronous fetch errors silently", () => {
        mockFetch.mockImplementationOnce(() => {
          throw new Error("sync error");
        });
        expect(() => trackSignupSuccess({ method: "google", requires_verification: false })).not.toThrow();
      });
    });

    describe("GA4-only events do NOT dual-fire", () => {
      it("trackLoginStarted does not call fetch", () => {
        trackLoginStarted("password");
        expect(track).toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("trackLoginFailed does not call fetch", () => {
        trackLoginFailed({ method: "password", error_type: "invalid_credentials" });
        expect(track).toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("trackSignupFailed does not call fetch", () => {
        trackSignupFailed({ method: "password", error_type: "email_exists" });
        expect(track).toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
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
