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
const mockUserEventInsert = jest.fn();
const mockTrackingPreferenceMaybeSingle = jest.fn();

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

function mockAcceptInviteResult(result?: {
  data?: Record<string, boolean>;
  error?: { code?: string; message?: string } | null;
}) {
  mockSupabaseClient.rpc.mockResolvedValue({
    data: result?.data ?? {
      follow_created: true,
      follow_existing: false,
      referral_created: true,
      referral_existing: false,
    },
    error: result?.error ?? null,
  });
}

function mockTrackingPreference(allowImplicitTracking: boolean | null = true) {
  mockTrackingPreferenceMaybeSingle.mockResolvedValue({
    data:
      allowImplicitTracking === null
        ? null
        : { allow_implicit_tracking: allowImplicitTracking },
    error: null,
  });
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
    mockUserEventInsert.mockResolvedValue({ error: null });
    mockTrackingPreference();
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: mockTrackingPreferenceMaybeSingle,
            })),
          })),
        } as any;
      }
      return { insert: mockUserEventInsert } as any;
    });
    mockAcceptInviteResult();
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

  it("creates follow and referral attribution, clears the cookie, and redirects to the inviter profile", async () => {
    mockAuthUser("invitee-id");
    const token = await inviteToken("inviter-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/profile/inviter-id");
    expect(location.searchParams.get("invited")).toBe("1");
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      "accept_invite_for_user",
      {
        inviter: "inviter-id",
        invitee: "invitee-id",
      },
    );
    expect(mockUserEventInsert).toHaveBeenCalledWith({
      user_id: "invitee-id",
      event_type: "invite_consumed",
      beach_id: null,
      metadata: expect.objectContaining({
        token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        inviter_id: "inviter-id",
        surface: "web",
        follow_created: true,
        referral_created: true,
        self_invite: false,
      }),
    });
    expectInviteCookieCleared(response);
  });

  it("skips invite telemetry when product telemetry is disabled", async () => {
    mockAuthUser("invitee-id");
    mockTrackingPreference(false);
    const token = await inviteToken("inviter-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/profile/inviter-id");
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      "accept_invite_for_user",
      {
        inviter: "inviter-id",
        invitee: "invitee-id",
      },
    );
    expect(mockUserEventInsert).not.toHaveBeenCalled();
  });

  it("treats duplicate follows as success, clears the cookie, and redirects to the inviter profile", async () => {
    mockAuthUser("invitee-id");
    mockAcceptInviteResult({
      data: {
        follow_created: false,
        follow_existing: true,
        referral_created: true,
        referral_existing: false,
      },
    });
    const token = await inviteToken("inviter-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/profile/inviter-id");
    expect(location.searchParams.get("invited")).toBe("1");
    expectInviteCookieCleared(response);
  });

  it("preserves existing referral attribution and still redirects to the inviter profile", async () => {
    mockAuthUser("invitee-id");
    mockAcceptInviteResult({
      data: {
        follow_created: true,
        follow_existing: false,
        referral_created: false,
        referral_existing: true,
      },
    });
    const token = await inviteToken("inviter-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/profile/inviter-id");
    expect(location.searchParams.get("invited")).toBe("1");
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      "accept_invite_for_user",
      {
        inviter: "inviter-id",
        invitee: "invitee-id",
      },
    );
    expectInviteCookieCleared(response);
  });

  it("handles self-invites without RPC writes and clears the cookie", async () => {
    mockAuthUser("same-id");
    const token = await inviteToken("same-id");

    const response = await GET(buildRequest({ invite_token: token }));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/community");
    expect(location.searchParams.get("tab")).toBe("friends");
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    expect(mockUserEventInsert).toHaveBeenCalledWith({
      user_id: "same-id",
      event_type: "invite_consumed",
      beach_id: null,
      metadata: expect.objectContaining({
        inviter_id: "same-id",
        surface: "web",
        self_invite: true,
      }),
    });
    expectInviteCookieCleared(response);
  });
});
