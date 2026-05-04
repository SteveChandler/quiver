/**
 * @jest-environment node
 *
 * Tests for /api/surf/discover entitlement resolution (Plan V4 / Fix Agent F1).
 *
 * Pin invariants:
 *   - The route resolves user_entitlements before calling discoverSurfSpots
 *   - Active Pro/trial → isPro:true reaches the orchestrator
 *   - Expired/missing/free → isPro:false
 *   - Billing-issue carve-out preserves Pro through Apple/Google retry windows
 *
 * Auth + rate-limit wrappers are stripped so the inner handler runs with a
 * synthesized AuthenticatedContext (matches the me-profile.route.test pattern).
 */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

// Strip the auth + rate-limit wrappers so the inner handler is reachable.
// withAuth is normally responsible for resolving user/supabase from cookies +
// returning 401 on failure; those paths are covered by withAuth's own tests.
// Here we synthesize an AuthenticatedContext directly.
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any) => handler,
    withRateLimit: (handler: any) => handler,
  };
});

const mockDiscoverSurfSpots = jest.fn();
jest.mock("@/lib/services/surf-discovery-service", () => ({
  discoverSurfSpots: (...args: unknown[]) => mockDiscoverSurfSpots(...args),
}));

import { NextRequest } from "next/server";

// Build a fake supabase client that returns a configurable user_entitlements
// row from .from("user_entitlements").select(...).eq(...).maybeSingle().
function makeSupabaseStub(entitlementRow: Record<string, unknown> | null) {
  // beaches.in() is consulted by the calibration-stamp block. Stub it to
  // succeed with empty rows so the handler reaches the response stage.
  return {
    from: jest.fn((table: string) => {
      if (table === "user_entitlements") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: entitlementRow,
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "beaches") {
        return {
          select: jest.fn(() => ({
            in: jest.fn(async () => ({ data: [], error: null })),
          })),
        };
      }
      return {};
    }),
  };
}

function makeRequest(): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/surf/discover?lat=32.7157&lon=-117.1611",
  );
}

describe("/api/surf/discover entitlement resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default discovery response: empty but well-formed.
    mockDiscoverSurfSpots.mockResolvedValue({
      recommendations: [],
      searchCriteria: { maxResults: 5 },
      metadata: {
        totalBeachesConsidered: 0,
        successfulForecasts: 0,
        partialSuccess: false,
        failedBeaches: 0,
        staleBeaches: 0,
        generated_at: new Date().toISOString(),
      },
      regionalCall: "",
    });
  });

  it("active Pro user (is_pro=true, no expiry) → isPro:true reaches orchestrator", async () => {
    const supabase = makeSupabaseStub({
      is_pro: true,
      is_trialing: false,
      billing_issue: false,
      expires_at: null,
    });

    const { GET } = await import("@/app/api/surf/discover/route");
    await GET(makeRequest(), {
      user: { id: "user-pro" } as any,
      supabase: supabase as any,
      params: {},
    } as any);

    expect(mockDiscoverSurfSpots).toHaveBeenCalledTimes(1);
    const [, opts] = mockDiscoverSurfSpots.mock.calls[0];
    expect(opts).toMatchObject({ isPro: true });
  });

  it("trialing user with future expires_at → isPro:true", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = makeSupabaseStub({
      is_pro: false,
      is_trialing: true,
      billing_issue: false,
      expires_at: future,
    });

    const { GET } = await import("@/app/api/surf/discover/route");
    await GET(makeRequest(), {
      user: { id: "user-trial" } as any,
      supabase: supabase as any,
      params: {},
    } as any);

    expect(mockDiscoverSurfSpots.mock.calls[0][1]).toMatchObject({ isPro: true });
  });

  it("expired Pro (no billing_issue) → isPro:false (stale mirror)", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const supabase = makeSupabaseStub({
      is_pro: true,
      is_trialing: false,
      billing_issue: false,
      expires_at: past,
    });

    const { GET } = await import("@/app/api/surf/discover/route");
    await GET(makeRequest(), {
      user: { id: "user-expired" } as any,
      supabase: supabase as any,
      params: {},
    } as any);

    expect(mockDiscoverSurfSpots.mock.calls[0][1]).toMatchObject({ isPro: false });
  });

  it("no entitlement row → isPro:false (free)", async () => {
    const supabase = makeSupabaseStub(null);

    const { GET } = await import("@/app/api/surf/discover/route");
    await GET(makeRequest(), {
      user: { id: "user-free" } as any,
      supabase: supabase as any,
      params: {},
    } as any);

    expect(mockDiscoverSurfSpots.mock.calls[0][1]).toMatchObject({ isPro: false });
  });

  it("billing-issue carve-out: expired AND billing_issue=true → isPro:true", async () => {
    // Apple's ≤60d / Google's ≤30d retry window: the mirror legitimately
    // keeps is_pro=true with expires_at in the past while billing_issue=true.
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = makeSupabaseStub({
      is_pro: true,
      is_trialing: false,
      billing_issue: true,
      expires_at: past,
    });

    const { GET } = await import("@/app/api/surf/discover/route");
    await GET(makeRequest(), {
      user: { id: "user-billing-issue" } as any,
      supabase: supabase as any,
      params: {},
    } as any);

    expect(mockDiscoverSurfSpots.mock.calls[0][1]).toMatchObject({ isPro: true });
  });
});
