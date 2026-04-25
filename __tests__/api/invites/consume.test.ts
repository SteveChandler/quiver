/**
 * @jest-environment node
 */

import { signEmailToken } from "@/lib/utils/email-token";
import {
  createMockSupabaseClient,
  createMockUser,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
} from "@/test-utils/api-test-helpers";
import { NextRequest } from "next/server";

const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@/lib/middleware/api-wrappers", () => {
  const { NextResponse } = require("next/server");
  return {
    withAuth:
      (handler: any, options: any = {}) =>
      async (request: any, context: any) => {
        try {
          const { data, error } = await mockSupabaseClient.auth.getUser();
          const user = error ? null : data?.user ?? null;
          if (!options.optional && !user) {
            return NextResponse.json(
              { error: options.authErrorMessage ?? "Authentication required" },
              { status: 401 },
            );
          }
          const resolvedParams = context?.params
            ? typeof context.params === "object" && "then" in context.params
              ? await context.params
              : context.params
            : {};
          return await handler(request, {
            params: resolvedParams,
            user,
            supabase: mockSupabaseClient,
          });
        } catch (err: any) {
          return NextResponse.json(
            {
              success: false,
              error: options.errorMessage ?? err?.message ?? "Internal error",
              timestamp: Date.now(),
            },
            { status: 500 },
          );
        }
      },
    createSuccessResponse: (data: any) =>
      NextResponse.json({ success: true, data, timestamp: Date.now() }),
    createErrorResponse: (error: string, status = 400) =>
      NextResponse.json(
        { success: false, error, timestamp: Date.now() },
        { status },
      ),
    methodNotAllowed: (allowed: string[]) =>
      NextResponse.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: allowed.join(", ") } },
      ),
  };
});

const TEST_SECRET = "test-secret-key-that-is-at-least-32-characters-long";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/invites/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Helper to prime the mock `supabase.from('user_follows').insert(...)` chain
// to return a given response.
function mockInsertResult(result: { error: { code: string } | null }) {
  const insertFn = jest.fn().mockResolvedValue(result);
  mockSupabaseClient.from.mockReturnValue({
    // Only insert is used by the consume route.
    insert: insertFn,
  } as any);
  return insertFn;
}

describe("POST /api/invites/consume", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticatedUser(mockSupabaseClient);
    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(buildRequest({ token: "whatever" }), {
      params: {},
    });
    expect(response.status).toBe(401);
  });

  it("returns 400 when token is missing", async () => {
    mockAuthenticatedUser(
      mockSupabaseClient,
      createMockUser({ id: "follower" }),
    );
    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(buildRequest({}), { params: {} });
    expect(response.status).toBe(400);
    await expectErrorResponse(response, 400, "Missing token");
  });

  it("returns 400 when token is invalid", async () => {
    mockAuthenticatedUser(
      mockSupabaseClient,
      createMockUser({ id: "follower" }),
    );
    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(
      buildRequest({ token: "not-a-valid-jwt" }),
      { params: {} },
    );
    expect(response.status).toBe(400);
    await expectErrorResponse(response, 400, "Invalid or expired invite");
  });

  it("returns 400 when token has the wrong purpose", async () => {
    mockAuthenticatedUser(
      mockSupabaseClient,
      createMockUser({ id: "follower" }),
    );
    const wrongPurposeToken = await signEmailToken(
      { user_id: "inviter-id", purpose: "prefs" },
      TEST_SECRET,
    );
    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(
      buildRequest({ token: wrongPurposeToken }),
      { params: {} },
    );
    expect(response.status).toBe(400);
    await expectErrorResponse(response, 400, "Invalid or expired invite");
  });

  it("inserts user_follows row and returns success", async () => {
    const follower = createMockUser({ id: "follower-uuid" });
    mockAuthenticatedUser(mockSupabaseClient, follower);

    const insertFn = mockInsertResult({ error: null });

    const token = await signEmailToken(
      { user_id: "inviter-uuid", purpose: "invite" },
      TEST_SECRET,
    );

    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(buildRequest({ token }), { params: {} });
    const data = await expectSuccessResponse<{
      success: boolean;
      inviter_id: string;
    }>(response, 200);

    expect(data.data.inviter_id).toBe("inviter-uuid");
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("user_follows");
    expect(insertFn).toHaveBeenCalledWith({
      follower_id: "follower-uuid",
      following_id: "inviter-uuid",
    });
  });

  it("treats 23505 unique-violation as success (idempotent double-tap)", async () => {
    const follower = createMockUser({ id: "follower-uuid" });
    mockAuthenticatedUser(mockSupabaseClient, follower);

    mockInsertResult({ error: { code: "23505" } });

    const token = await signEmailToken(
      { user_id: "inviter-uuid", purpose: "invite" },
      TEST_SECRET,
    );

    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(buildRequest({ token }), { params: {} });
    const data = await expectSuccessResponse<{
      success: boolean;
      inviter_id: string;
    }>(response, 200);

    expect(data.data.inviter_id).toBe("inviter-uuid");
  });

  it("skips insert and flags self_invite when follower === inviter", async () => {
    const sameUser = createMockUser({ id: "same-id" });
    mockAuthenticatedUser(mockSupabaseClient, sameUser);

    const insertFn = mockInsertResult({ error: null });

    const token = await signEmailToken(
      { user_id: "same-id", purpose: "invite" },
      TEST_SECRET,
    );

    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(buildRequest({ token }), { params: {} });
    const data = await expectSuccessResponse<{
      success: boolean;
      inviter_id: string;
      self_invite?: boolean;
    }>(response, 200);

    expect(data.data.self_invite).toBe(true);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("bubbles up non-23505 insert errors as 500", async () => {
    const follower = createMockUser({ id: "follower-uuid" });
    mockAuthenticatedUser(mockSupabaseClient, follower);

    mockInsertResult({ error: { code: "23503" } as any });

    const token = await signEmailToken(
      { user_id: "inviter-uuid", purpose: "invite" },
      TEST_SECRET,
    );

    const { POST } = require("@/app/api/invites/consume/route");
    const response = await POST(buildRequest({ token }), { params: {} });
    expect(response.status).toBe(500);
  });
});
