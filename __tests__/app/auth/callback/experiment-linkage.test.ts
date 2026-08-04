/** @jest-environment node */

import { NextRequest } from "next/server";
import { createMockSupabaseClient, createMockUser } from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();
const mockLinkExperimentEligibility = jest.fn();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/experiments/assignments", () => ({
  linkExperimentEligibility: (...args: unknown[]) => mockLinkExperimentEligibility(...args),
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "http://localhost:3000";

function request(): NextRequest {
  return new NextRequest(`${ORIGIN}/auth/callback?code=oauth-code`);
}

function mockProfile(): void {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { home_beach_id: "beach-1", onboarding_completed_at: "2026-08-04T09:00:00.000Z" },
      error: null,
    }),
  };
  mockSupabaseClient.from.mockReturnValue(chain as never);
}

function freshUser(provider: string) {
  const timestamp = new Date().toISOString();
  return createMockUser({
    id: "11111111-1111-4111-8111-111111111111",
    created_at: timestamp,
    last_sign_in_at: timestamp,
    app_metadata: { provider },
  });
}

describe("/auth/callback W-ASSIGN OAuth linkage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    (mockSupabaseClient.auth as Record<string, jest.Mock>).exchangeCodeForSession = jest
      .fn()
      .mockResolvedValue({ error: null });
    mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });
    mockProfile();
  });

  it("awaits a bounded linkage attempt for a freshly created Google OAuth user", async () => {
    let releaseLink: (() => void) | undefined;
    mockLinkExperimentEligibility.mockImplementation(
      () => new Promise<void>((resolve) => { releaseLink = resolve; }),
    );
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: freshUser("google") }, error: null });

    const responsePromise = GET(request());
    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (!mockLinkExperimentEligibility.mock.calls.length) return;
        clearInterval(interval);
        resolve();
      }, 1);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("OAuth linkage was not started"));
      }, 100);
    });

    expect(mockLinkExperimentEligibility).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "web", "web_oauth");

    releaseLink?.();
    await expect(responsePromise).resolves.toHaveProperty("status", 307);
  });

  it.each(["email", "phone", "unknown-provider"])("does not misclassify %s callbacks as OAuth", async (provider) => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: freshUser(provider) }, error: null });

    await GET(request());

    expect(mockLinkExperimentEligibility).not.toHaveBeenCalled();
  });
});
