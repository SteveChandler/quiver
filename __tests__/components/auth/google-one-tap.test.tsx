import { act, render } from "@testing-library/react";

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import { GoogleOneTap } from "@/components/auth/google-one-tap";
import { useAuth } from "@/context/auth-context";
import {
  trackSignupStarted,
  trackSignupSuccess,
  trackSignupFailed,
  trackLoginSuccess,
  clearSignupFlow,
} from "@/lib/analytics/auth-events";
import { createClient } from "@/lib/supabase/client";
import { safeGetItem } from "@/lib/utils/safe-storage";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthMethodSelected: jest.fn(),
  trackAuthProviderSelected: jest.fn(),
  trackSignupStarted: jest.fn(),
  trackSignupSuccess: jest.fn(),
  trackSignupFailed: jest.fn(),
  trackLoginSuccess: jest.fn(),
  clearSignupFlow: jest.fn(),
}));

jest.mock("@/lib/utils/safe-storage", () => ({
  safeGetItem: jest.fn(),
  safeSetItem: jest.fn(),
}));

type GoogleCredentialResponse = {
  credential: string;
  select_by: string;
};

type GoogleCredentialCallback = (
  response: GoogleCredentialResponse,
) => void | Promise<void>;

type GoogleOneTapConfig = {
  callback: GoogleCredentialCallback;
};

describe("GoogleOneTap", () => {
  let originalGoogle: Window["google"];
  let originalClientId: string | undefined;
  let originalLocalhostOverride: string | undefined;
  let credentialCallback: GoogleCredentialCallback | undefined;
  let initialize: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    originalGoogle = window.google;
    originalClientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    originalLocalhostOverride =
      process.env.NEXT_PUBLIC_ENABLE_GOOGLE_ONE_TAP_LOCALHOST;
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-google-client-id";
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_ONE_TAP_LOCALHOST = "true";

    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    (safeGetItem as jest.Mock).mockReturnValue(null);
    (trackSignupStarted as jest.Mock).mockReturnValue({
      flow_id: "test-flow-id",
      provider: "google",
      source: "google_one_tap",
      redirect_state: "inline",
      started_at: Date.now(),
    });

    initialize = jest.fn((config: GoogleOneTapConfig) => {
      credentialCallback = config.callback;
    });
    window.google = {
      accounts: {
        id: {
          initialize,
          prompt: jest.fn(),
          cancel: jest.fn(),
          disableAutoSelect: jest.fn(),
        },
      },
    };

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    document.head.appendChild(script);
  });

  afterEach(() => {
    document.head.innerHTML = "";
    window.google = originalGoogle;

    if (originalClientId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalClientId;
    }
    if (originalLocalhostOverride === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_GOOGLE_ONE_TAP_LOCALHOST;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_GOOGLE_ONE_TAP_LOCALHOST =
        originalLocalhostOverride;
    }

    jest.useRealTimers();
  });

  it("does not request a Google credential on localhost by default", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_GOOGLE_ONE_TAP_LOCALHOST;

    render(<GoogleOneTap />);

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(initialize).not.toHaveBeenCalled();
    expect(window.google?.accounts.id.prompt).not.toHaveBeenCalled();
  });

  it("uses a stable error code for persisted One Tap token exchange failures", async () => {
    const signInWithIdToken = jest.fn().mockResolvedValue({
      data: {},
      error: new Error("raw provider failure details"),
    });
    (createClient as jest.Mock).mockReturnValue({
      auth: { signInWithIdToken },
    });

    render(<GoogleOneTap />);

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    const callback = credentialCallback;
    if (!callback) {
      throw new Error("Google One Tap credential callback was not initialized");
    }

    await act(async () => {
      await callback({
        credential: "mock-google-jwt",
        select_by: "user",
      });
    });
    expectConsoleErrors([/\[google-one-tap\] signInWithIdToken error/]);

    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: "mock-google-jwt",
    });
    expect(trackSignupFailed).toHaveBeenCalledWith({
      method: "google",
      error_type: "token_exchange_failed",
      source: "google_one_tap",
      flow_id: "test-flow-id",
      started_at: expect.any(Number),
    });
    expect(JSON.stringify((trackSignupFailed as jest.Mock).mock.calls)).not.toContain(
      "raw provider failure",
    );
  });

  it("emits the canonical signup outcome for a new One Tap user", async () => {
    const signInWithIdToken = jest.fn().mockResolvedValue({
      data: { user: { created_at: new Date().toISOString() } },
      error: null,
    });
    (createClient as jest.Mock).mockReturnValue({
      auth: { signInWithIdToken },
    });

    render(<GoogleOneTap />);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    if (!credentialCallback) {
      throw new Error("Google One Tap credential callback was not initialized");
    }

    await act(async () => {
      await credentialCallback?.({ credential: "mock-google-jwt", select_by: "user" });
    });

    expect(trackSignupSuccess).toHaveBeenCalledWith({
      method: "google",
      requires_verification: false,
      source: "google_one_tap",
      flow_id: "test-flow-id",
      started_at: expect.any(Number),
    });
  });

  it("records unexpected One Tap failures as signup failures", async () => {
    const signInWithIdToken = jest.fn().mockRejectedValue(new Error("network down"));
    (createClient as jest.Mock).mockReturnValue({
      auth: { signInWithIdToken },
    });

    render(<GoogleOneTap />);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    if (!credentialCallback) {
      throw new Error("Google One Tap credential callback was not initialized");
    }

    await act(async () => {
      await credentialCallback?.({ credential: "mock-google-jwt", select_by: "user" });
    });
    expectConsoleErrors([/\[google-one-tap\] Unexpected error/]);

    expect(trackSignupFailed).toHaveBeenCalledWith({
      method: "google",
      error_type: "unexpected_error",
      source: "google_one_tap",
      flow_id: "test-flow-id",
      started_at: expect.any(Number),
    });
  });

  it("reconciles a returning One Tap user as login with the correlated flow", async () => {
    const signInWithIdToken = jest.fn().mockResolvedValue({
      data: { user: { created_at: "2020-01-01T00:00:00.000Z" } },
      error: null,
    });
    (createClient as jest.Mock).mockReturnValue({
      auth: { signInWithIdToken },
    });

    render(<GoogleOneTap />);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    if (!credentialCallback) {
      throw new Error("Google One Tap credential callback was not initialized");
    }

    await act(async () => {
      await credentialCallback?.({ credential: "mock-google-jwt", select_by: "user" });
    });

    expect(trackSignupStarted).toHaveBeenCalledWith("google", expect.objectContaining({
      source: "google_one_tap",
      redirect_state: "inline",
    }));
    expect(trackLoginSuccess).toHaveBeenCalledWith({
      method: "google",
      duration_ms: expect.any(Number),
      source: "google_one_tap",
      flow_id: "test-flow-id",
      redirect_state: "completed",
      started_at: expect.any(Number),
    });
    expect(clearSignupFlow).toHaveBeenCalledTimes(1);
    expect(clearSignupFlow).toHaveBeenCalledWith("test-flow-id");
  });
});
