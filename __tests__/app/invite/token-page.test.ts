/**
 * @jest-environment node
 */

import { signEmailToken } from "@/lib/utils/email-token";
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
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function mockFollowInsert(insertError: { code: string } | null = null) {
  const insert = jest.fn().mockResolvedValue({ error: insertError });
  mockSupabaseClient.from.mockReturnValue({ insert } as any);
  return insert;
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

  it("redirects signed-out valid invite links through /invite/start without mutating cookies", async () => {
    mockAuthUser(null);
    const token = await inviteToken();

    await expectRedirect(
      renderInvitePage(token),
      `/invite/start?token=${encodeURIComponent(token)}`,
    );

    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("consumes signed-in invite links and lands on the inviter profile", async () => {
    mockAuthUser("invitee-id");
    const insert = mockFollowInsert();
    const token = await inviteToken("inviter-id");

    await expectRedirect(
      renderInvitePage(token),
      "/profile/inviter-id?invited=1",
    );

    expect(insert).toHaveBeenCalledWith({
      follower_id: "invitee-id",
      following_id: "inviter-id",
    });
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("treats an existing follow as accepted and still lands on the inviter profile", async () => {
    mockAuthUser("invitee-id");
    const insert = mockFollowInsert({ code: "23505" });
    const token = await inviteToken("inviter-id");

    await expectRedirect(
      renderInvitePage(token),
      "/profile/inviter-id?invited=1",
    );

    expect(insert).toHaveBeenCalledWith({
      follower_id: "invitee-id",
      following_id: "inviter-id",
    });
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it("redirects self-invites to the friends tab without inserting a follow", async () => {
    mockAuthUser("same-id");
    const insert = mockFollowInsert();
    const token = await inviteToken("same-id");

    await expectRedirect(renderInvitePage(token), "/community?tab=friends");

    expect(insert).not.toHaveBeenCalled();
    expect(mockCookies).not.toHaveBeenCalled();
  });
});
