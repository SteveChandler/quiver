import { act, render } from "@testing-library/react";

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import { GoogleOneTap } from "@/components/auth/google-one-tap";
import { useAuth } from "@/context/auth-context";
import { trackLoginFailed } from "@/lib/analytics/auth-events";
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
  trackLoginSuccess: jest.fn(),
  trackLoginFailed: jest.fn(),
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
    expect(trackLoginFailed).toHaveBeenCalledWith({
      method: "google_one_tap",
      error_type: "token_exchange_failed",
      source: "google_one_tap",
    });
    expect(JSON.stringify((trackLoginFailed as jest.Mock).mock.calls)).not.toContain(
      "raw provider failure",
    );
  });
});
