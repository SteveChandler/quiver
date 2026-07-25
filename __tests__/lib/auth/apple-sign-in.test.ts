/** @jest-environment jsdom */

import { createClient } from "@/lib/supabase/client";
import { signInWithApple } from "@/lib/auth/apple-sign-in";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import type { SignupMetadata } from "@/lib/analytics/acquisition-context";

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

describe("signInWithApple", () => {
  const mockSignInWithOAuth = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    (createClient as jest.Mock).mockReturnValue({
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
      },
    });
    mockSignInWithOAuth.mockResolvedValue({ error: null });
  });

  it("stores validated signup metadata before leaving for Apple", async () => {
    const metadata: SignupMetadata = {
      signup_context: {
        schema_version: 2,
        signup_surface: "web",
        method: "apple",
        entrypoint: "landing_hero",
        source_capture_status: "captured",
        captured_at: "2026-07-25T18:00:00.000Z",
      },
    };

    await signInWithApple("/sessions", metadata);

    expect(JSON.parse(sessionStorage.getItem("pending_signup_metadata") ?? "")).toEqual(
      metadata,
    );
  });

  it("clears pending signup metadata when Apple rejects the OAuth request", async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      error: { message: "provider unavailable" },
    });

    await signInWithApple("/sessions", {
      signup_context: {
        schema_version: 2,
        signup_surface: "web",
        method: "apple",
        entrypoint: "landing_hero",
        source_capture_status: "captured",
        captured_at: "2026-07-25T18:00:00.000Z",
      },
    });

    expectConsoleErrors([/\[apple-sign-in\] OAuth error/]);
    expect(sessionStorage.getItem("pending_signup_metadata")).toBeNull();
  });

  it("marks the OAuth callback as Apple while preserving returnTo", async () => {
    await signInWithApple("/sessions?tab=recent");

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: {
        redirectTo: expect.any(String),
      },
    });

    const redirectTo = mockSignInWithOAuth.mock.calls[0][0].options.redirectTo;
    const callbackUrl = new URL(redirectTo);
    expect(callbackUrl.pathname).toBe("/auth/callback");
    expect(callbackUrl.searchParams.get("provider")).toBe("apple");
    expect(callbackUrl.searchParams.get("redirect")).toBe(
      "/sessions?tab=recent"
    );
  });
});
