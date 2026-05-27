/**
 * @jest-environment node
 */

import { signEmailToken } from "@/lib/utils/email-token";
import type { ReactElement } from "react";
import {
  createMockSupabaseClient,
  createMockUser,
} from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();
const mockRedirect = jest.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const mockCookies = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: (target: string) => mockRedirect(target),
}));

jest.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

import InvitePage from "@/app/invite/[token]/page";
import { InviteLandingClient } from "@/app/invite/[token]/invite-landing-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/invites/token-hash";

const TEST_SECRET = "test-secret-key-that-is-at-least-32-characters-long";

async function inviteToken(inviterId = "inviter-id"): Promise<string> {
  return signEmailToken(
    { user_id: inviterId, purpose: "invite" },
    TEST_SECRET,
  );
}

function renderInvitePage(token: string) {
  return InvitePage({ params: Promise.resolve({ token }) });
}

async function expectRedirect(
  promise: Promise<unknown>,
  target: string,
): Promise<void> {
  await expect(promise).rejects.toThrow(`NEXT_REDIRECT:${target}`);
  expect(mockRedirect).toHaveBeenCalledWith(target);
}

function mockAuthUser(userId: string | null) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: userId ? createMockUser({ id: userId }) : null },
    error: null,
  });
}

function mockAcceptInviteRpc(error: { code: string } | null = null) {
  mockSupabaseClient.rpc.mockResolvedValue({
    data: {
      follow_created: error ? false : true,
      follow_existing: error?.code === "23505",
      referral_created: error ? false : true,
      referral_existing: false,
    },
    error: null,
  });

  return mockSupabaseClient.rpc;
}

function mockInviterProfile() {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        id: "inviter-id",
        full_name: "Kai Reef",
        display_name: "Kai",
        avatar_url: "https://example.com/kai.jpg",
      },
      error: null,
    }),
  };
  mockSupabaseClient.from.mockReturnValueOnce(chain as any);
  return chain;
}

describe("/invite/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it("redirects invalid tokens to the expired fallback before reading auth", async () => {
    await expectRedirect(
      renderInvitePage("not-a-valid-token"),
      "/?invite_expired=1",
    );

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("renders signed-out valid invite links as an app install landing without mutating cookies", async () => {
    mockAuthUser(null);
    mockInviterProfile();
    const token = await inviteToken();

    const result = await renderInvitePage(token) as ReactElement;

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result.type).toBe(InviteLandingClient);
    expect(result.props).toEqual(
      expect.objectContaining({
        token,
        tokenHash: hashInviteToken(token),
        startPath: `/invite/start?token=${encodeURIComponent(token)}`,
        inviter: {
          id: "inviter-id",
          displayName: "Kai",
          avatarUrl: "https://example.com/kai.jpg",
        },
      }),
    );
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("consumes signed-in invite links and lands on the inviter profile", async () => {
    mockAuthUser("invitee-id");
    const rpc = mockAcceptInviteRpc();
    const token = await inviteToken("inviter-id");

    await expectRedirect(
      renderInvitePage(token),
      "/profile/inviter-id?invited=1",
    );

    expect(rpc).toHaveBeenCalledWith("accept_invite_for_user", {
      invitee: "invitee-id",
      inviter: "inviter-id",
    });
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("treats an existing follow as accepted and still lands on the inviter profile", async () => {
    mockAuthUser("invitee-id");
    const rpc = mockAcceptInviteRpc({ code: "23505" });
    const token = await inviteToken("inviter-id");

    await expectRedirect(
      renderInvitePage(token),
      "/profile/inviter-id?invited=1",
    );

    expect(rpc).toHaveBeenCalledWith("accept_invite_for_user", {
      invitee: "invitee-id",
      inviter: "inviter-id",
    });
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("redirects self-invites to the friends tab without inserting a follow", async () => {
    mockAuthUser("same-id");
    const token = await inviteToken("same-id");

    await expectRedirect(renderInvitePage(token), "/community?tab=friends");

    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    expect(mockCookies).not.toHaveBeenCalled();
  });
});
