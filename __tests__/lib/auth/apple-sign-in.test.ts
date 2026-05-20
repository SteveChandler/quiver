/** @jest-environment jsdom */

import { createClient } from "@/lib/supabase/client";
import { signInWithApple } from "@/lib/auth/apple-sign-in";

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

describe("signInWithApple", () => {
  const mockSignInWithOAuth = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue({
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
      },
    });
    mockSignInWithOAuth.mockResolvedValue({ error: null });
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
