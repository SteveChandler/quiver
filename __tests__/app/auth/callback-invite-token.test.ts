/**
 * @jest-environment node
 *
 * Tests for the invite-token handoff in `app/auth/callback/route.ts`.
 * The callback exchanges the auth code and preserves the `invite_token`
 * cookie. `/invite/consume` is the canonical web post-auth consumer.
 */

import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  createMockUser,
} from "@/test-utils/api-test-helpers";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "http://localhost:3000";

interface MockInsertCall {
  table: string;
  payload: unknown;
}

type PrimeProfileMockResult = string[] & {
  inserts: MockInsertCall[];
};

function buildCallbackRequest(
  searchParams: Record<string, string>,
  cookies?: Record<string, string>,
): NextRequest {
  const params = new URLSearchParams(searchParams);
  const headers: Record<string, string> = {};
  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
  return new NextRequest(`${ORIGIN}/auth/callback?${params.toString()}`, {
    headers,
  });
}

function primeProfileMock(): PrimeProfileMockResult {
  const tables: string[] = [];
  const inserts: MockInsertCall[] = [];
  mockSupabaseClient.from.mockImplementation(((table: string) => {
    tables.push(table);
    if (table === "profiles") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            home_beach_id: "beach-1",
            onboarding_completed_at: "2026-04-01T00:00:00Z",
          },
          error: null,
        }),
      };
    }

    return {
      insert: jest.fn().mockImplementation((payload: unknown) => {
        inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  }) as any);
  return Object.assign(tables, { inserts });
}

function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) throw new Error("No Location header on redirect response");
  return new URL(location);
}

function getSetCookie(response: Response): string {
  return response.headers.get("set-cookie") || "";
}

describe("/auth/callback invite_token handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    (mockSupabaseClient.auth as Record<string, unknown>).exchangeCodeForSession = jest
      .fn()
      .mockResolvedValue({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "new-user-id" }) },
      error: null,
    });
  });

  it("preserves invite_token when redirecting to /invite/consume", async () => {
    const tables = primeProfileMock();

    const response = await GET(
      buildCallbackRequest(
        { code: "abc", redirect: "/invite/consume" },
        { invite_token: "opaque-invite-token" },
      ),
    );

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/invite/consume");
    expect(tables).not.toContain("user_follows");
    expect(getSetCookie(response)).not.toMatch(/invite_token=/);
  });

  it("does not consume or delete invite_token on non-consume redirects", async () => {
    const tables = primeProfileMock();

    const response = await GET(
      buildCallbackRequest(
        { code: "abc", redirect: "/" },
        { invite_token: "opaque-invite-token" },
      ),
    );

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("invited")).toBeNull();
    expect(tables).not.toContain("user_follows");
    expect(getSetCookie(response)).not.toMatch(/invite_token=/);
  });

  it("continues to complete callback normally when no invite_token cookie is present", async () => {
    const tables = primeProfileMock();

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/profile" }),
    );

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/profile");
    expect(tables).not.toContain("user_follows");
    expect(getSetCookie(response)).not.toMatch(/invite_token=/);
  });

  it("does not set a beta handoff cookie for Apple callbacks", async () => {
    const tables = primeProfileMock();

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/", provider: "apple" }),
    );

    expect(getSetCookie(response)).not.toContain("quiver_ios_beta_prompt=");
    expect(tables.inserts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "user_events",
          payload: expect.objectContaining({
            event_type: "apple_beta_prompt_eligible",
          }),
        }),
      ])
    );
  });

  it("does not set a beta handoff cookie when an Apple session exchange fails", async () => {
    (mockSupabaseClient.auth as Record<string, unknown>).exchangeCodeForSession = jest
      .fn()
      .mockResolvedValue({ error: new Error("bad code") });

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/", provider: "apple" }),
    );

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/auth/sign-in");
    expect(getSetCookie(response)).not.toContain("quiver_ios_beta_prompt=");
    expectConsoleErrors([/\[Auth Callback\] Session exchange failed/]);
  });
});
