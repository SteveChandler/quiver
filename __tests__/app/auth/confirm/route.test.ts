/**
 * @jest-environment node
 *
 * Pins the contract for `app/auth/confirm/route.ts`. Plan: F1 of the
 * post-signup activation collapse fix — when a user opens the email
 * confirmation link in a different browser/device than the one they signed
 * up from, `verifyOtp` confirms the email at the DB level but no session
 * cookies end up on the response. The route MUST detect that case and
 * redirect to `/auth/sign-in?just_confirmed=1&...` instead of dropping
 * the user as a ghost on the destination page.
 *
 * Symptom in production: David Fisher (2surftheworld@gmail.com) signed up
 * from /ca/oceanside/the-rock-oceanside, clicked the confirmation link
 * 24h later, never authenticated, bounced. auth.users showed
 * email_confirmed_at SET, last_sign_in_at NULL.
 */

import { NextRequest } from "next/server";
import { createMockSupabaseClient, createMockUser } from "@/test-utils/api-test-helpers";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(undefined),
  }),
}));

jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
}));

import { GET } from "@/app/auth/confirm/route";

const ORIGIN = "http://localhost:3000";

function buildConfirmRequest(searchParams: Record<string, string>): NextRequest {
  const params = new URLSearchParams(searchParams);
  return new NextRequest(`${ORIGIN}/auth/confirm?${params.toString()}`);
}

function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) throw new Error("No Location header on redirect response");
  return new URL(location);
}

describe("/auth/confirm — session-cookie aware redirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    (mockSupabaseClient.auth as Record<string, unknown>).verifyOtp = jest.fn();
  });

  it("redirects to /auth/sign-in?just_confirmed=1 when no session results", async () => {
    // Token exchange succeeds but session is null (cross-browser confirmation)
    (mockSupabaseClient.auth as any).verifyOtp.mockResolvedValue({
      data: {
        user: createMockUser({ id: "user-1", email: "ghost@example.com" }),
        session: null,
      },
      error: null,
    });

    const response = await GET(
      buildConfirmRequest({
        token_hash: "abc",
        type: "signup",
        next: "/ca/oceanside/the-rock-oceanside",
      })
    );
    expectConsoleWarnings([/\[confirm_session_lost\]/]);

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/auth/sign-in");
    expect(url.searchParams.get("just_confirmed")).toBe("1");
    expect(url.searchParams.get("email")).toBe("ghost@example.com");
    expect(url.searchParams.get("next")).toBe("/ca/oceanside/the-rock-oceanside");
  });

  it("does not include email param when verifyOtp returns no user", async () => {
    (mockSupabaseClient.auth as any).verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const response = await GET(
      buildConfirmRequest({ token_hash: "abc", type: "signup" })
    );
    expectConsoleWarnings([/\[confirm_session_lost\]/]);

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/auth/sign-in");
    expect(url.searchParams.get("just_confirmed")).toBe("1");
    expect(url.searchParams.has("email")).toBe(false);
  });

  it("redirects to the original next destination when session IS established", async () => {
    (mockSupabaseClient.auth as any).verifyOtp.mockResolvedValue({
      data: {
        user: createMockUser({ id: "user-1", email: "alive@example.com" }),
        session: { access_token: "tok", refresh_token: "ref" },
      },
      error: null,
    });

    const response = await GET(
      buildConfirmRequest({
        token_hash: "abc",
        type: "signup",
        next: "/ca/oceanside/the-rock-oceanside",
      })
    );

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/ca/oceanside/the-rock-oceanside");
    expect(url.searchParams.has("just_confirmed")).toBe(false);
  });

  it("omits next when it is the default '/'", async () => {
    (mockSupabaseClient.auth as any).verifyOtp.mockResolvedValue({
      data: {
        user: createMockUser({ id: "user-1", email: "ghost@example.com" }),
        session: null,
      },
      error: null,
    });

    const response = await GET(
      buildConfirmRequest({ token_hash: "abc", type: "signup" })
    );
    expectConsoleWarnings([/\[confirm_session_lost\]/]);

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/auth/sign-in");
    expect(url.searchParams.has("next")).toBe(false);
  });
});
