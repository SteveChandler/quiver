/**
 * Unit tests for lib/mobile/apple-sign-in.ts
 *
 * Covers the web OAuth path, the native iOS path via the Capacitor plugin,
 * and all error cases for each path.
 */

import { signInWithApple } from "@/lib/mobile/apple-sign-in";

// Mock the Supabase browser client
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

// Mock the platform detection module (default to web)
jest.mock("@/lib/mobile/platform", () => ({
  isNativeApp: jest.fn(() => false),
}));

// Mock Sentry to prevent real error reporting during tests
jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

// Mock the Capacitor Apple Sign-In plugin (dynamic import)
const mockAuthorize = jest.fn();
jest.mock("@capacitor-community/apple-sign-in", () => ({
  SignInWithApple: {
    authorize: mockAuthorize,
  },
}));

import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/mobile/platform";
import * as Sentry from "@sentry/nextjs";

describe("signInWithApple", () => {
  let mockSupabaseClient: {
    auth: {
      signInWithOAuth: jest.Mock;
      signInWithIdToken: jest.Mock;
    };
  };

  beforeEach(() => {
    // Default to web (non-native) platform
    (isNativeApp as jest.Mock).mockReturnValue(false);

    // Set up a mock Supabase client with auth methods
    mockSupabaseClient = {
      auth: {
        signInWithOAuth: jest.fn(),
        signInWithIdToken: jest.fn(),
      },
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Mock window.location for web path tests
    delete (global as any).window;
    (global as any).window = {
      location: {
        origin: "http://localhost:3000",
      },
    };

    // Suppress console noise in tests
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Web path
  // ---------------------------------------------------------------------------

  describe("web path (isNativeApp = false)", () => {
    it("calls signInWithOAuth with provider 'apple' and correct redirectTo", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ error: null });

      const result = await signInWithApple("/dashboard");

      expect(result.error).toBeUndefined();
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "apple",
        options: {
          redirectTo:
            "http://localhost:3000/auth/callback?redirect=%2Fdashboard",
        },
      });
    });

    it("uses the default returnTo '/' when no argument is provided", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ error: null });

      await signInWithApple();

      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "apple",
        options: {
          redirectTo: "http://localhost:3000/auth/callback?redirect=%2F",
        },
      });
    });

    it("returns an error when signInWithOAuth reports an error", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        error: { message: "OAuth provider unavailable" },
      });

      const result = await signInWithApple("/");

      expect(result.error).toBe(
        "Unable to sign in with Apple. Please try another method."
      );
    });

    it("returns an error when signInWithOAuth throws an exception", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockRejectedValue(
        new Error("Network failure")
      );

      const result = await signInWithApple("/");

      expect(result.error).toBe(
        "An unexpected error occurred during Apple sign in."
      );
    });

    it("does not call signInWithIdToken on the web path", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ error: null });

      await signInWithApple("/");

      expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Native path
  // ---------------------------------------------------------------------------

  describe("native path (isNativeApp = true)", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(true);
    });

    it("calls signInWithIdToken with provider 'apple' and the identity token", async () => {
      mockAuthorize.mockResolvedValue({
        response: { identityToken: "mock-identity-token" },
      });
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        error: null,
      });

      const result = await signInWithApple("/home");

      expect(result.error).toBeUndefined();
      expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: "apple",
        token: "mock-identity-token",
      });
    });

    it("returns an error when the plugin returns no identity token (user cancelled)", async () => {
      mockAuthorize.mockResolvedValue({
        response: { identityToken: null },
      });

      const result = await signInWithApple("/");

      expect(result.error).toBe("Apple sign-in was cancelled or failed.");
      expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
    });

    it("returns an error when the plugin returns an empty response object", async () => {
      mockAuthorize.mockResolvedValue({ response: {} });

      const result = await signInWithApple("/");

      expect(result.error).toBe("Apple sign-in was cancelled or failed.");
    });

    it("returns an error when signInWithIdToken reports an error", async () => {
      mockAuthorize.mockResolvedValue({
        response: { identityToken: "mock-identity-token" },
      });
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        error: { message: "Invalid identity token" },
      });

      const result = await signInWithApple("/");

      expect(result.error).toBe(
        "Unable to sign in with Apple. Please try another method."
      );
    });

    it("returns an error with the exception message when the plugin throws", async () => {
      mockAuthorize.mockRejectedValue(new Error("Plugin not available"));

      const result = await signInWithApple("/");

      expect(result.error).toBe("Apple sign-in failed: Plugin not available");
    });

    it("captures the exception in Sentry when the plugin throws", async () => {
      const thrownError = new Error("Plugin not available");
      mockAuthorize.mockRejectedValue(thrownError);

      await signInWithApple("/");

      expect(Sentry.captureException).toHaveBeenCalledWith(thrownError, {
        tags: { context: "native_apple_signin" },
      });
    });

    it("does not call signInWithOAuth on the native path", async () => {
      mockAuthorize.mockResolvedValue({
        response: { identityToken: "mock-identity-token" },
      });
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        error: null,
      });

      await signInWithApple("/");

      expect(mockSupabaseClient.auth.signInWithOAuth).not.toHaveBeenCalled();
    });
  });
});
