/**
 * @jest-environment node
 *
 * Tests for the invite-token bridge added to `app/auth/callback/route.ts`.
 * After exchangeCodeForSession succeeds, the route must:
 *   1. Read the `invite_token` cookie set at sign-up time.
 *   2. Verify the JWT, insert a `user_follows` row (idempotent on 23505).
 *   3. Delete the cookie from the response.
 *   4. Append `?invited=1` to the final redirect.
 */

import { NextRequest } from "next/server";
import { createMockSupabaseClient, createMockUser } from "@/test-utils/api-test-helpers";
import { signEmailToken } from "@/lib/utils/email-token";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "http://localhost:3000";
const TEST_SECRET = "test-secret-key-that-is-at-least-32-characters-long";

function buildCallbackRequest(
  searchParams: Record<string, string>,
  cookies?: Record<string, string>,
): NextRequest {
  const params = new URLSearchParams(searchParams);
  const headers: Record<string, string> = {};
  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  return new NextRequest(`${ORIGIN}/auth/callback?${params.toString()}`, {
    headers,
  });
}

interface CapturedInsert {
  args: unknown[];
}

/**
 * Prime the mock Supabase client so the route's two table calls both resolve:
 * - `from('profiles').select().eq().maybeSingle()` → returns a completed profile
 * - `from('user_follows').insert({...})` → returns either null or an error code
 */
function primeMocks({
  profile = {
    home_beach_id: "beach-1",
    onboarding_completed_at: "2026-04-01T00:00:00Z",
  },
  insertError = null as { code: string } | null,
}: {
  profile?: { home_beach_id: string | null; onboarding_completed_at: string | null } | null;
  insertError?: { code: string } | null;
} = {}): { captures: CapturedInsert[] } {
  const captures: CapturedInsert[] = [];
  (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: profile, error: null }),
      };
    }
    if (table === "user_follows") {
      return {
        insert: jest.fn((...args: unknown[]) => {
          captures.push({ args });
          return Promise.resolve({ error: insertError });
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
  return { captures };
}

function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) throw new Error("No Location header on redirect response");
  return new URL(location);
}

function getCookie(response: Response, name: string): string | null {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;
  // Multiple Set-Cookie values may be joined by ", " in a combined header —
  // in Next.js NextResponse they're usually separate, but split on common name=.
  const match = setCookie.match(new RegExp(`${name}=([^;,]*)`));
  return match ? match[1] : null;
}

describe("/auth/callback — invite_token bridge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;

    (mockSupabaseClient.auth as Record<string, unknown>).exchangeCodeForSession = jest
      .fn()
      .mockResolvedValue({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: createMockUser({ id: "new-user-id" }) },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it("inserts user_follows row and appends ?invited=1 when invite_token cookie is valid", async () => {
    const { captures } = primeMocks();

    const token = await signEmailToken(
      { user_id: "inviter-id", purpose: "invite" },
      TEST_SECRET,
    );

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/" }, { invite_token: token }),
    );

    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("invited")).toBe("1");

    expect(captures).toHaveLength(1);
    expect(captures[0].args[0]).toEqual({
      follower_id: "new-user-id",
      following_id: "inviter-id",
    });
  });

  it("clears the invite_token cookie after consumption", async () => {
    primeMocks();

    const token = await signEmailToken(
      { user_id: "inviter-id", purpose: "invite" },
      TEST_SECRET,
    );

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/" }, { invite_token: token }),
    );

    // NextResponse.cookies.delete sets a Max-Age=0 or past-date cookie.
    const setCookie = response.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/invite_token=/);
    expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
  });

  it("does NOT insert when follower === inviter", async () => {
    const { captures } = primeMocks();

    const token = await signEmailToken(
      { user_id: "new-user-id", purpose: "invite" },
      TEST_SECRET,
    );

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/" }, { invite_token: token }),
    );

    expect(captures).toHaveLength(0);
    const url = getRedirectLocation(response);
    // Cookie still cleared, but no invited flag because no row was written.
    expect(url.searchParams.get("invited")).toBeNull();
  });

  it("swallows 23505 unique-violation and still appends invited=1", async () => {
    const { captures } = primeMocks({ insertError: { code: "23505" } });

    const token = await signEmailToken(
      { user_id: "inviter-id", purpose: "invite" },
      TEST_SECRET,
    );

    const response = await GET(
      buildCallbackRequest({ code: "abc", redirect: "/" }, { invite_token: token }),
    );

    expect(captures).toHaveLength(1);
    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("invited")).toBe("1");
  });

  it("ignores an invalid/expired invite_token and still completes callback", async () => {
    const { captures } = primeMocks();

    const response = await GET(
      buildCallbackRequest(
        { code: "abc", redirect: "/" },
        { invite_token: "not-a-valid-jwt" },
      ),
    );

    expect(captures).toHaveLength(0);
    const url = getRedirectLocation(response);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("invited")).toBeNull();
  });

  it("is a no-op when no invite_token cookie is present", async () => {
    const { captures } = primeMocks();

    const response = await GET(buildCallbackRequest({ code: "abc", redirect: "/" }));

    expect(captures).toHaveLength(0);
    const url = getRedirectLocation(response);
    expect(url.searchParams.get("invited")).toBeNull();
    // No invite_token cookie should be set on the response.
    expect(getCookie(response, "invite_token")).toBeNull();
  });
});
