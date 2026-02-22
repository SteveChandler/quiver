/**
 * Unit tests for auth-utils.ts
 * Tests redirect handling, OAuth flows, validation, and loop prevention
 */

import {
  setAuthRedirect,
  getAuthRedirect,
  clearAuthRedirect,
  buildAuthUrl,
  initiateOAuthFlow,
  sendMagicLink,
  validatePassword,
  validateEmail,
  checkUserExists,
  incrementRedirectAttempt,
  clearRedirectAttempts,
  isRedirectLoopDetected,
  AUTH_CONSTANTS,
} from "@/lib/auth/auth-utils";

// Mock the Supabase browser client
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

// Mock the platform detection module
jest.mock("@/lib/mobile/platform", () => ({
  isNativeApp: jest.fn(() => false),
}));

// Mock the social login initialization gate
jest.mock("@/lib/mobile/social-login", () => ({
  ensureSocialLoginReady: jest.fn(() => Promise.resolve()),
}));

// Mock the Capacitor social login plugin (dynamic import)
const mockSocialLoginLogin = jest.fn();
jest.mock("@capgo/capacitor-social-login", () => ({
  SocialLogin: {
    login: mockSocialLoginLogin,
  },
}));

import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/mobile/platform";

describe("auth-utils", () => {
  let localStorageMock: { [key: string]: string };
  let mockSupabaseClient: any;
  let getItemSpy: jest.SpyInstance;
  let setItemSpy: jest.SpyInstance;
  let removeItemSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};

    getItemSpy = jest.fn((key: string) => localStorageMock[key] || null);
    setItemSpy = jest.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    removeItemSpy = jest.fn((key: string) => {
      delete localStorageMock[key];
    });

    // Create a proper Storage mock
    const storageMock = {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: removeItemSpy,
      clear: jest.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: jest.fn(),
    };

    // Mock both global.localStorage and window.localStorage
    Object.defineProperty(global, 'localStorage', {
      value: storageMock,
      writable: true,
    });
    
    // Ensure window.localStorage is also set
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: storageMock,
        writable: true,
      });
    }

    // Mock window.location
    delete (global as any).window;
    (global as any).window = {
      location: {
        origin: "http://localhost:3000",
        search: "",
        pathname: "/",
      },
    };

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        signInWithOAuth: jest.fn(),
        signInWithOtp: jest.fn(),
      },
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Mock console methods
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear localStorage mock state
    localStorageMock = {};
    // Reset spy call counts
    getItemSpy.mockClear();
    setItemSpy.mockClear();
    removeItemSpy.mockClear();
    // Clear the actual localStorage mock implementation
    if (global.localStorage && typeof global.localStorage.clear === 'function') {
      global.localStorage.clear();
    }
  });

  describe("Redirect handling", () => {
    describe("setAuthRedirect", () => {
      it("should store valid redirect path", () => {
        setAuthRedirect("/beach/123");
        expect(setItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_STORAGE_KEY,
          "/beach/123"
        );
      });

      it("should not store root path", () => {
        setAuthRedirect("/");
        expect(setItemSpy).not.toHaveBeenCalled();
      });

      it("should not store empty path", () => {
        setAuthRedirect("");
        expect(setItemSpy).not.toHaveBeenCalled();
      });

      it("should warn about invalid paths not starting with /", () => {
        setAuthRedirect("beach/123");
        expect(console.warn).toHaveBeenCalled();
        expect(setItemSpy).not.toHaveBeenCalled();
      });
    });

    describe("getAuthRedirect", () => {
      it("should return null when no redirect is stored", () => {
        const result = getAuthRedirect();
        expect(result).toBeNull();
      });

      it("should retrieve stored redirect from localStorage", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_STORAGE_KEY] = "/beach/123";
        const result = getAuthRedirect();
        expect(result).toBe("/beach/123");
      });

      it("should prioritize URL param over localStorage", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_STORAGE_KEY] = "/beach/123";
        (global as any).window.location.search = "?redirectTo=/beach/456";

        const result = getAuthRedirect();
        expect(result).toBe("/beach/456");
      });

      it("should return null for root path in localStorage", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_STORAGE_KEY] = "/";
        const result = getAuthRedirect();
        expect(result).toBeNull();
      });

      it("should return null in non-browser environment", () => {
        delete (global as any).window;
        const result = getAuthRedirect();
        expect(result).toBeNull();
      });
    });

    describe("clearAuthRedirect", () => {
      it("should remove redirect from localStorage", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_STORAGE_KEY] = "/beach/123";
        clearAuthRedirect();
        expect(removeItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_STORAGE_KEY
        );
      });
    });

    describe("buildAuthUrl", () => {
      it("should return base path when no redirect", () => {
        const result = buildAuthUrl("/auth/sign-in");
        expect(result).toBe("/auth/sign-in");
      });

      it("should add redirect parameter from localStorage", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_STORAGE_KEY] = "/beach/123";
        const result = buildAuthUrl("/auth/sign-in");
        expect(result).toBe("/auth/sign-in?redirectTo=%2Fbeach%2F123");
      });

      it("should use explicit returnTo parameter", () => {
        const result = buildAuthUrl("/auth/sign-in", "/custom/path");
        expect(result).toBe("/auth/sign-in?redirectTo=%2Fcustom%2Fpath");
      });

      it("should prioritize explicit returnTo over localStorage", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_STORAGE_KEY] = "/beach/123";
        const result = buildAuthUrl("/auth/sign-in", "/custom/path");
        expect(result).toBe("/auth/sign-in?redirectTo=%2Fcustom%2Fpath");
      });
    });
  });

  describe("OAuth flow", () => {
    describe("initiateOAuthFlow", () => {
      it("should successfully initiate OAuth flow", async () => {
        mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
          error: null,
        });

        const result = await initiateOAuthFlow("google", "/beach/123");

        expect(result.error).toBeUndefined();
        expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: "google",
          options: {
            redirectTo: expect.stringContaining("/auth/callback?redirect="),
          },
        });
        expect(setItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_STORAGE_KEY,
          "/beach/123"
        );
      });

      it("should handle OAuth error", async () => {
        const oauthError = { message: "OAuth failed" };
        mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
          error: oauthError,
        });

        const result = await initiateOAuthFlow("google", "/beach/123");

        expect(result.error).toBeDefined();
        expect(removeItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_STORAGE_KEY
        );
      });

      it("should handle OAuth exception", async () => {
        mockSupabaseClient.auth.signInWithOAuth.mockRejectedValue(
          new Error("Network error")
        );

        const result = await initiateOAuthFlow("google", "/beach/123");

        expect(result.error).toBeDefined();
        expect(removeItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_STORAGE_KEY
        );
      });
    });
  });

  describe("Native OAuth flow (Capacitor)", () => {
    let sessionStorageMock: { [key: string]: string };
    let sessionGetItemSpy: jest.SpyInstance;
    let sessionSetItemSpy: jest.SpyInstance;
    let sessionRemoveItemSpy: jest.SpyInstance;

    beforeEach(() => {
      // Enable native path
      (isNativeApp as jest.Mock).mockReturnValue(true);

      // Mock sessionStorage
      sessionStorageMock = {};
      sessionGetItemSpy = jest.fn(
        (key: string) => sessionStorageMock[key] || null
      );
      sessionSetItemSpy = jest.fn((key: string, value: string) => {
        sessionStorageMock[key] = value;
      });
      sessionRemoveItemSpy = jest.fn((key: string) => {
        delete sessionStorageMock[key];
      });

      Object.defineProperty(global, "sessionStorage", {
        value: {
          getItem: sessionGetItemSpy,
          setItem: sessionSetItemSpy,
          removeItem: sessionRemoveItemSpy,
          clear: jest.fn(),
          length: 0,
          key: jest.fn(),
        },
        writable: true,
      });
    });

    afterEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      mockSocialLoginLogin.mockReset();
    });

    it("should complete native sign-in with idToken", async () => {
      mockSocialLoginLogin.mockResolvedValue({
        provider: "google",
        result: {
          idToken: "mock-id-token",
          accessToken: null,
          profile: { email: "test@example.com", name: "Test" },
          responseType: "online",
        },
      });
      mockSupabaseClient.auth.signInWithIdToken = jest
        .fn()
        .mockResolvedValue({ error: null });

      const result = await initiateOAuthFlow("google", "/beach/123");

      expect(result.error).toBeUndefined();
      expect(mockSocialLoginLogin).toHaveBeenCalledWith({
        provider: "google",
        options: { scopes: ["email", "profile"] },
      });
      expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: "google",
        token: "mock-id-token",
      });
    });

    it("should handle user cancellation (no idToken)", async () => {
      mockSocialLoginLogin.mockResolvedValue({
        provider: "google",
        result: {
          serverAuthCode: "mock-code",
          responseType: "offline",
        },
      });

      const result = await initiateOAuthFlow("google", "/beach/123");

      expect(result.error).toBe("Google sign-in was cancelled or failed.");
      expect(removeItemSpy).toHaveBeenCalledWith(
        AUTH_CONSTANTS.REDIRECT_STORAGE_KEY
      );
      expect(sessionRemoveItemSpy).toHaveBeenCalledWith(
        "pending_signup_metadata"
      );
    });

    it("should handle signInWithIdToken error", async () => {
      mockSocialLoginLogin.mockResolvedValue({
        provider: "google",
        result: {
          idToken: "mock-id-token",
          accessToken: null,
          profile: { email: "test@example.com" },
          responseType: "online",
        },
      });
      mockSupabaseClient.auth.signInWithIdToken = jest
        .fn()
        .mockResolvedValue({ error: { message: "Invalid token" } });

      const result = await initiateOAuthFlow("google", "/beach/123");

      expect(result.error).toBe(
        "Unable to sign in with Google. Please try another method."
      );
      expect(removeItemSpy).toHaveBeenCalledWith(
        AUTH_CONSTANTS.REDIRECT_STORAGE_KEY
      );
    });

    it("should handle native plugin exception", async () => {
      mockSocialLoginLogin.mockRejectedValue(
        new Error("Plugin not available")
      );

      const result = await initiateOAuthFlow("google", "/beach/123");

      expect(result.error).toBe(
        "Google sign-in failed. Please try another method."
      );
      expect(removeItemSpy).toHaveBeenCalledWith(
        AUTH_CONSTANTS.REDIRECT_STORAGE_KEY
      );
    });

    it("should not call web OAuth when on native", async () => {
      mockSocialLoginLogin.mockResolvedValue({
        provider: "google",
        result: {
          idToken: "mock-id-token",
          accessToken: null,
          profile: { email: "test@example.com" },
          responseType: "online",
        },
      });
      mockSupabaseClient.auth.signInWithIdToken = jest
        .fn()
        .mockResolvedValue({ error: null });

      await initiateOAuthFlow("google", "/beach/123");

      expect(mockSupabaseClient.auth.signInWithOAuth).not.toHaveBeenCalled();
    });
  });

  describe("Magic link flow", () => {
    describe("sendMagicLink", () => {
      it("should successfully send magic link", async () => {
        mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({
          error: null,
        });

        const result = await sendMagicLink("test@example.com", "/beach/123");

        expect(result.error).toBeUndefined();
        expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith({
          email: "test@example.com",
          options: {
            emailRedirectTo: expect.stringContaining("/auth/callback?redirect="),
          },
        });
        expect(setItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_STORAGE_KEY,
          "/beach/123"
        );
      });

      it("should validate email before sending", async () => {
        const result = await sendMagicLink("invalid-email", "/beach/123");

        expect(result.error).toBe("Please enter a valid email address.");
        expect(mockSupabaseClient.auth.signInWithOtp).not.toHaveBeenCalled();
      });

      it("should handle send error", async () => {
        const sendError = { message: "Failed to send email" };
        mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({
          error: sendError,
        });

        const result = await sendMagicLink("test@example.com", "/beach/123");

        expect(result.error).toBeDefined();
        expect(removeItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_STORAGE_KEY
        );
      });

      it("should handle send exception", async () => {
        mockSupabaseClient.auth.signInWithOtp.mockRejectedValue(
          new Error("Network error")
        );

        const result = await sendMagicLink("test@example.com", "/beach/123");

        expect(result.error).toBeDefined();
      });
    });
  });

  describe("Validation", () => {
    describe("validatePassword", () => {
      it("should accept valid password", () => {
        const result = validatePassword("password123");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should reject empty password", () => {
        const result = validatePassword("");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Password is required");
      });

      it("should reject short password (less than 8 chars)", () => {
        const result = validatePassword("1234567");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Password must be at least 8 characters");
      });

      it("should accept exactly 8 characters", () => {
        const result = validatePassword("12345678");
        expect(result.valid).toBe(true);
      });
    });

    describe("validateEmail", () => {
      it("should accept valid email", () => {
        expect(validateEmail("test@example.com")).toBe(true);
      });

      it("should accept email with subdomain", () => {
        expect(validateEmail("user@mail.example.com")).toBe(true);
      });

      it("should reject empty email", () => {
        expect(validateEmail("")).toBe(false);
      });

      it("should reject email without @", () => {
        expect(validateEmail("testexample.com")).toBe(false);
      });

      it("should reject email without domain", () => {
        expect(validateEmail("test@")).toBe(false);
      });

      it("should reject email without user", () => {
        expect(validateEmail("@example.com")).toBe(false);
      });

      it("should reject email with spaces", () => {
        expect(validateEmail("test @example.com")).toBe(false);
      });
    });

    describe("checkUserExists", () => {
      it("should return false (not yet implemented)", async () => {
        const result = await checkUserExists("test@example.com");
        expect(result).toBe(false);
      });
    });
  });

  describe("Loop prevention", () => {
    describe("incrementRedirectAttempt", () => {
      it("should start at 1 for first attempt", () => {
        const result = incrementRedirectAttempt();
        expect(result).toBe(1);
        expect(setItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY,
          "1"
        );
      });

      it("should increment existing counter", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY] = "2";
        const result = incrementRedirectAttempt();
        expect(result).toBe(3);
      });

      it("should handle non-numeric values", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY] = "invalid";
        const result = incrementRedirectAttempt();
        expect(result).toBe(1); // NaN converts to 0, +1 = 1
      });
    });

    describe("clearRedirectAttempts", () => {
      it("should remove attempts counter", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY] = "3";
        clearRedirectAttempts();
        expect(removeItemSpy).toHaveBeenCalledWith(
          AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY
        );
      });
    });

    describe("isRedirectLoopDetected", () => {
      it("should return false when no attempts", () => {
        const result = isRedirectLoopDetected();
        expect(result).toBe(false);
      });

      it("should return false below threshold", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY] = "2";
        const result = isRedirectLoopDetected();
        expect(result).toBe(false);
      });

      it("should return true at threshold", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY] = "3";
        const result = isRedirectLoopDetected();
        expect(result).toBe(true);
      });

      it("should return true above threshold", () => {
        localStorageMock[AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY] = "5";
        const result = isRedirectLoopDetected();
        expect(result).toBe(true);
      });
    });
  });

  describe("AUTH_CONSTANTS", () => {
    it("should export all constants", () => {
      expect(AUTH_CONSTANTS.REDIRECT_STORAGE_KEY).toBe("auth_redirect_path");
      expect(AUTH_CONSTANTS.REDIRECT_ATTEMPTS_KEY).toBe("redirectAttempts");
      expect(AUTH_CONSTANTS.MAX_REDIRECT_ATTEMPTS).toBe(3);
      expect(AUTH_CONSTANTS.REDIRECT_URL_PARAM).toBe("redirectTo");
    });
  });
});
