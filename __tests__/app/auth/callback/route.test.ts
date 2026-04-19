/**
 * @jest-environment node
 *
 * Pins the contract for the `?onboarding=required` redirect rewrite in
 * `app/auth/callback/route.ts`. Plan: F2 of the post-signup activation
 * collapse fix — the rewrite must apply to ANY redirect target (not just
 * `/`) so users signing up from a gated beach page hit the OnboardingDialog.
 */

import { NextRequest } from "next/server";
import { createMockSupabaseClient, createMockUser } from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "http://localhost:3000";

function buildCallbackRequest(searchParams: Record<string, string>): NextRequest {
  const params = new URLSearchParams(searchParams);
  return new NextRequest(`${ORIGIN}/auth/callback?${params.toString()}`);
}

function mockProfile(profile: { home_beach_id: string | null; onboarding_completed_at: string | null } | null) {
  // The route calls supabase.from('profiles').select(...).eq(...).maybeSingle()
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: profile, error: null }),
  };
  (mockSupabaseClient.from as jest.Mock).mockReturnValue(chain);
}

function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) throw new Error("No Location header on redirect response");
  return new URL(location);
}

describe("/auth/callback — onboarding=required rewrite", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    (mockSupabaseClient.auth as Record<string, unknown>).exchangeCodeForSession = jest
      .fn()
      .mockResolvedValue({ error: null });
  });

  it("appends onboarding=required when fresh signup redirects to '/'", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "user-1" }) },
      error: null,
    });
    mockProfile({ home_beach_id: null, onboarding_completed_at: null });

    const response = await GET(buildCallbackRequest({ code: "abc", redirect: "/" }));
    const url = getRedirectLocation(response);

    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("onboarding")).toBe("required");
  });

  it("appends onboarding=required when fresh signup redirects to a deep beach page", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "user-1" }) },
      error: null,
    });
    mockProfile({ home_beach_id: null, onboarding_completed_at: null });

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/ca/oceanside/the-rock-oceanside" })
    );
    const url = getRedirectLocation(response);

    expect(url.pathname).toBe("/ca/oceanside/the-rock-oceanside");
    expect(url.searchParams.get("onboarding")).toBe("required");
  });

  it("does NOT append onboarding=required when profile is already activated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "user-1" }) },
      error: null,
    });
    mockProfile({ home_beach_id: "beach-1", onboarding_completed_at: "2026-04-01T00:00:00Z" });

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/ca/oceanside/the-rock-oceanside" })
    );
    const url = getRedirectLocation(response);

    expect(url.pathname).toBe("/ca/oceanside/the-rock-oceanside");
    expect(url.searchParams.get("onboarding")).toBeNull();
  });

  it("preserves existing query params on the redirect target", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "user-1" }) },
      error: null,
    });
    mockProfile({ home_beach_id: null, onboarding_completed_at: null });

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/ca/oceanside/the-rock-oceanside?utm_source=email" })
    );
    const url = getRedirectLocation(response);

    expect(url.pathname).toBe("/ca/oceanside/the-rock-oceanside");
    expect(url.searchParams.get("utm_source")).toBe("email");
    expect(url.searchParams.get("onboarding")).toBe("required");
  });

  it("does not double-append onboarding=required if already present", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "user-1" }) },
      error: null,
    });
    mockProfile({ home_beach_id: null, onboarding_completed_at: null });

    const response = await GET(buildCallbackRequest({ code: "abc", redirect: "/?onboarding=required" }));
    const url = getRedirectLocation(response);

    expect(url.pathname).toBe("/");
    expect(url.searchParams.getAll("onboarding")).toEqual(["required"]);
  });

  it("preserves the hash fragment on the redirect target", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "user-1" }) },
      error: null,
    });
    mockProfile({ home_beach_id: null, onboarding_completed_at: null });

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/ca/oceanside/the-rock-oceanside#forecast" })
    );
    const url = getRedirectLocation(response);

    expect(url.pathname).toBe("/ca/oceanside/the-rock-oceanside");
    expect(url.hash).toBe("#forecast");
    expect(url.searchParams.get("onboarding")).toBe("required");
  });

  it("falls back to '/?onboarding=required' when redirect is invalid (open-redirect blocked)", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "user-1" }) },
      error: null,
    });
    mockProfile({ home_beach_id: null, onboarding_completed_at: null });

    // Protocol-relative URL is blocked by the open-redirect guard; redirectUrl stays '/'
    const response = await GET(buildCallbackRequest({ code: "abc", redirect: "//evil.com/steal" }));
    const url = getRedirectLocation(response);

    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("onboarding")).toBe("required");
  });
});
