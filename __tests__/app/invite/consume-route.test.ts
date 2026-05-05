/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { signEmailToken } from "@/lib/utils/email-token";
import {
  createMockSupabaseClient,
  createMockUser,
} from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

import { GET } from "@/app/invite/consume/route";

const ORIGIN = "http://localhost:3000";
const TEST_SECRET = "test-secret-key-that-is-at-least-32-characters-long";

function buildRequest(cookies?: Record<string, string>): NextRequest {
  const headers: Record<string, string> = {};
  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
  return new NextRequest(`${ORIGIN}/invite/consume`, { headers });
}

function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) throw new Error("No Location header on redirect response");
  return new URL(location);
}

async function inviteToken(inviterId = "inviter-id"): Promise<string> {
  return signEmailToken(
    { user_id: inviterId, purpose: "invite" },
    TEST_SECRET,
  );
}

function mockAuthUser(userId: string | null) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: userId ? createMockUser({ id: userId }) : null },
    error: null,
  });
}

function mockFollowInsert(insertError: { code: string } | null = null) {
  const insert = jest.fn().mockResolvedValue({ error: insertError });
  mockSupabaseClient.from.mockReturnValue({ insert } as any);
  return insert;
}

function expectInviteCookieCleared(response: Response) {
  const setCookie = response.headers.get("set-cookie") || "";
  expect(setCookie).toMatch(/invite_token=/);
  expect(setCookie.toLowerCase()).toMatch(
    /max-age=0|expires=thu, 01 jan 1970/,
  );
}

describe("GET /invite/consume", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it("redirects unauthenticated users to sign-in while preserving the invite cookie", async () => {
    mockAuthUser(null);
    const token = await inviteToken();

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/auth/sign-in");
    expect(location.searchParams.get("redirectTo")).toBe("/invite/consume");
    expect(response.headers.get("set-cookie") || "").not.toMatch(
      /invite_token=/,
    );
  });

  it("redirects home when the invite cookie is missing", async () => {
    mockAuthUser("invitee-id");

    const response = await GET(buildRequest());

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/");
    expect(response.headers.get("set-cookie") || "").not.toMatch(
      /invite_token=/,
    );
  });

  it("clears invalid invite cookies and redirects to the expired fallback", async () => {
    mockAuthUser("invitee-id");

    const response = await GET(
      buildRequest({ invite_token: "not-a-valid-token" }),
    );

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("invite_expired")).toBe("1");
    expectInviteCookieCleared(response);
  });

  it("inserts user_follows, clears the cookie, and redirects to the inviter profile", async () => {
    mockAuthUser("invitee-id");
    const insert = mockFollowInsert();
    const token = await inviteToken("inviter-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/profile/inviter-id");
    expect(location.searchParams.get("invited")).toBe("1");
    expect(insert).toHaveBeenCalledWith({
      follower_id: "invitee-id",
      following_id: "inviter-id",
    });
    expectInviteCookieCleared(response);
  });

  it("treats 23505 as success, clears the cookie, and redirects to the inviter profile", async () => {
    mockAuthUser("invitee-id");
    mockFollowInsert({ code: "23505" });
    const token = await inviteToken("inviter-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/profile/inviter-id");
    expect(location.searchParams.get("invited")).toBe("1");
    expectInviteCookieCleared(response);
  });

  it("handles self-invites without inserting and clears the cookie", async () => {
    mockAuthUser("same-id");
    const insert = mockFollowInsert();
    const token = await inviteToken("same-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/community");
    expect(location.searchParams.get("tab")).toBe("friends");
    expect(insert).not.toHaveBeenCalled();
    expectInviteCookieCleared(response);
  });
});
