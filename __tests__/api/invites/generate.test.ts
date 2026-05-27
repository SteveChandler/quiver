/**
 * @jest-environment node
 */

import { verifyEmailToken } from "@/lib/utils/email-token";
import { hashInviteToken } from "@/lib/invites/token-hash";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockRequest,
  expectSuccessResponse,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
} from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();

// Phase 4.5 test-mock template: mock the api-wrappers module directly and
// wire the auth check through the shared mock Supabase client.
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
    methodNotAllowed: (allowed: string[]) =>
      NextResponse.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: allowed.join(", ") } },
      ),
    // Pass-through: the rate-limit behavior is covered by the shared
    // rate-limit tests; here we just need the wrapper to not block.
    withRateLimit: (handler: any, _key: any) => handler,
  };
});

const TEST_SECRET = "test-secret-key-that-is-at-least-32-characters-long";

describe("POST /api/invites/generate", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_SITE_URL = "https://dev.quiversurf.app";
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
    delete process.env.EMAIL_TOKEN_SECRET;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticatedUser(mockSupabaseClient);
    const { POST } = require("@/app/api/invites/generate/route");
    const request = createMockRequest(
      "POST",
      "http://localhost:3000/api/invites/generate",
    );
    const response = await POST(request, { params: {} });
    expect(response.status).toBe(401);
  });

  it("returns { token, url, token_hash } for an authenticated user", async () => {
    const user = createMockUser({ id: "inviter-uuid-123" });
    mockAuthenticatedUser(mockSupabaseClient, user);

    const { POST } = require("@/app/api/invites/generate/route");
    const request = createMockRequest(
      "POST",
      "http://localhost:3000/api/invites/generate",
    );
    const response = await POST(request, { params: {} });
    const data = await expectSuccessResponse<{
      token: string;
      url: string;
      token_hash: string;
    }>(
      response,
      200,
    );

    expect(typeof data.data.token).toBe("string");
    expect(data.data.token.length).toBeGreaterThan(20);
    expect(data.data.url).toBe(
      `https://dev.quiversurf.app/invite/${data.data.token}`,
    );
    expect(data.data.token_hash).toBe(hashInviteToken(data.data.token));
    expect(data.data.token_hash).toHaveLength(64);
  });

  it("generated token verifies back to the inviter user_id + invite purpose", async () => {
    const user = createMockUser({ id: "verifiable-inviter" });
    mockAuthenticatedUser(mockSupabaseClient, user);

    const { POST } = require("@/app/api/invites/generate/route");
    const request = createMockRequest(
      "POST",
      "http://localhost:3000/api/invites/generate",
    );
    const response = await POST(request, { params: {} });
    const data = await expectSuccessResponse<{ token: string; url: string }>(
      response,
      200,
    );

    const payload = await verifyEmailToken(data.data.token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.user_id).toBe("verifiable-inviter");
    expect(payload?.purpose).toBe("invite");
  });

  it("falls back to localhost URL when NEXT_PUBLIC_SITE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const user = createMockUser({ id: "inviter" });
    mockAuthenticatedUser(mockSupabaseClient, user);

    const { POST } = require("@/app/api/invites/generate/route");
    const request = createMockRequest(
      "POST",
      "http://localhost:3000/api/invites/generate",
    );
    const response = await POST(request, { params: {} });
    const data = await expectSuccessResponse<{ token: string; url: string }>(
      response,
      200,
    );

    expect(data.data.url).toMatch(/^http:\/\/localhost:3000\/invite\//);
  });

  it("returns a stable token_hash for the generated token", async () => {
    const user = createMockUser({ id: "hash-inviter" });
    mockAuthenticatedUser(mockSupabaseClient, user);

    const { POST } = require("@/app/api/invites/generate/route");
    const request = createMockRequest(
      "POST",
      "http://localhost:3000/api/invites/generate",
    );
    const response = await POST(request, { params: {} });
    const data = await expectSuccessResponse<{
      token: string;
      token_hash: string;
    }>(response, 200);

    expect(data.data.token_hash).toBe(hashInviteToken(data.data.token));
  });
});
