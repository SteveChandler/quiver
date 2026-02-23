/**
 * Tests for lib/mobile/social-login.ts
 *
 * Verifies SocialLogin.initialize() is called with correct Google client IDs
 * for both Android (webClientId only) and iOS (webClientId + iOSClientId).
 */

import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock("@capgo/capacitor-social-login", () => ({
  SocialLogin: {
    initialize: mockInitialize,
  },
}));

// We need to re-import fresh for each test to reset the singleton
let initializeSocialLogin: typeof import("@/lib/mobile/social-login").initializeSocialLogin;
let ensureSocialLoginReady: typeof import("@/lib/mobile/social-login").ensureSocialLoginReady;

beforeEach(() => {
  jest.resetModules();
  mockInitialize.mockClear();
  mockInitialize.mockResolvedValue(undefined);

  // Fresh import to reset the module-level initPromise
  const mod = jest.requireActual("@/lib/mobile/social-login") as typeof import("@/lib/mobile/social-login");
  // Re-require to get fresh module state
  jest.isolateModules(() => {
    const fresh = require("@/lib/mobile/social-login");
    initializeSocialLogin = fresh.initializeSocialLogin;
    ensureSocialLoginReady = fresh.ensureSocialLoginReady;
  });
});

describe("initializeSocialLogin", () => {
  it("passes webClientId and falls back iOSClientId to webClientId when iosClientId is not provided", async () => {
    await initializeSocialLogin("web-client-id");

    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledWith({
      google: {
        webClientId: "web-client-id",
        iOSClientId: "web-client-id",
        iOSServerClientId: "web-client-id",
      },
    });
  });

  it("passes separate iOSClientId and uses webClientId as iOSServerClientId", async () => {
    await initializeSocialLogin("web-client-id", "ios-client-id");

    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledWith({
      google: {
        webClientId: "web-client-id",
        iOSClientId: "ios-client-id",
        iOSServerClientId: "web-client-id",
      },
    });
  });

  it("returns the same promise on subsequent calls (singleton)", async () => {
    const promise1 = initializeSocialLogin("web-client-id");
    const promise2 = initializeSocialLogin("web-client-id");

    expect(promise1).toBe(promise2);
    await promise1;

    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it("resets initPromise on failure so retries are possible", async () => {
    mockInitialize.mockRejectedValueOnce(new Error("init failed"));

    await expect(initializeSocialLogin("web-client-id")).rejects.toThrow(
      "init failed"
    );

    // After failure, a new call should retry
    mockInitialize.mockResolvedValueOnce(undefined);
    await initializeSocialLogin("web-client-id");

    expect(mockInitialize).toHaveBeenCalledTimes(2);
  });
});

describe("ensureSocialLoginReady", () => {
  it("resolves immediately if initPromise is null and no env var is set", async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    await ensureSocialLoginReady();

    expect(mockInitialize).not.toHaveBeenCalled();
    expectConsoleWarnings([/NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing/]);
  });
});
