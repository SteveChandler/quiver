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
import { generateETag } from "@/lib/utils/cache-headers";

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

const INCLUDED_BEACH_ID_A = "11111111-1111-4111-8111-111111111111";
const INCLUDED_BEACH_ID_B = "22222222-2222-4222-8222-222222222222";

function makeRequest(query = "lat=32.7157&lon=-117.1611"): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/surf/discover?${query}`,
  );
}

function makeDiscoveryResponse() {
  return {
    recommendations: [
      {
        kind: "custom_spot",
        customSpotId: "custom-spot-contract-id",
        visibility: "public",
        isOwn: false,
        beach: {
          id: "beach-secret-id",
          name: "Ocean Beach Pier",
          slug: "ocean-beach-pier",
          city: "San Diego",
          state: "CA",
          region: "San Diego",
          lat: 32.749,
          lon: -117.254,
          photo_url: "https://cdn.quiver.test/ob.jpg",
          webcam_url: "https://cams.quiver.test/ob",
          skill_level: "intermediate",
        },
        window: {
          start: new Date("2026-05-06T14:00:00.000Z"),
          end: new Date("2026-05-06T17:00:00.000Z"),
          tide: "Rising",
          wind: "5 mph E",
          waveHeight: "3-4 ft",
          wavePeriod: "12s",
          dataSource: "CDIP",
          confidence: 82,
          timezone: "America/Los_Angeles",
          score: 86,
        },
        forecast: {
          forecast_at: "2026-05-06T14:00:00.000Z",
          wave_height: "3.5",
          wave_period: "12s",
          wind_speed: "5",
          wind_direction: "E",
          tide_status: "Rising",
        },
        score: 86,
        matchQuality: "excellent",
        subscores: {
          waveHeightFit: 22,
          periodEnergyScore: 18,
          windAlignment: 19,
          tideFit: 14,
          affinityBonus: 8,
          personalizationBonus: 10,
          distancePenalty: -5,
        },
        summary: "Best window around late morning",
        reasons: [
          "Wave size matches your sweet spot",
          "Wind matches your usual sessions",
          "Matches your surfing patterns",
        ],
        warnings: [],
        conditionBadges: [
          { label: "Light Offshore", contribution: 19 },
          { label: "Clean Swell", contribution: 18 },
        ],
        waveHeightBadge: "3-4ft",
        distanceMiles: 9.4,
        drivingTimeMinutes: 14,
        similarity: {
          state: "ready",
          score: 8.4,
          label: "GOOD",
          bonusApplied: 7,
          reason: "Similar to your high-rated sessions at beach breaks.",
          sessionCount: 8,
        },
        generated_at: "2026-05-06T13:00:00.000Z",
      },
    ],
    includedRecommendations: [
      {
        kind: "beach",
        customSpotId: null,
        visibility: null,
        isOwn: false,
        beach: {
          id: "included-secret-id",
          name: "Saved Secret Beach",
          slug: "saved-secret-beach",
          city: "San Diego",
          state: "CA",
          region: "San Diego",
          lat: 32.8,
          lon: -117.25,
          photo_url: "https://cdn.quiver.test/saved.jpg",
          webcam_url: "https://cams.quiver.test/saved",
          skill_level: "intermediate",
        },
        window: {
          start: new Date("2026-05-06T15:00:00.000Z"),
          end: new Date("2026-05-06T18:00:00.000Z"),
          tide: "Rising",
          wind: "6 mph E",
          waveHeight: "2-3 ft",
          wavePeriod: "11s",
          dataSource: "CDIP",
          confidence: 75,
          timezone: "America/Los_Angeles",
          score: 74,
        },
        forecast: {
          forecast_at: "2026-05-06T15:00:00.000Z",
          wave_height: "2.5",
          wave_period: "11s",
          wind_speed: "6",
          wind_direction: "E",
          tide_status: "Rising",
        },
        score: 74,
        matchQuality: "good",
        subscores: {
          waveHeightFit: 19,
          periodEnergyScore: 16,
          windAlignment: 17,
          tideFit: 12,
          affinityBonus: 5,
          personalizationBonus: 5,
          distancePenalty: -5,
        },
        summary: "Saved spot has a decent window",
        reasons: ["Clean enough for your saved list"],
        warnings: [],
        conditionBadges: [{ label: "Light Offshore", contribution: 17 }],
        waveHeightBadge: "2-3ft",
        distanceMiles: 10.2,
        drivingTimeMinutes: 15,
        similarity: null,
        generated_at: "2026-05-06T13:00:00.000Z",
      },
    ],
    searchCriteria: {
      userLocation: { lat: 32.7157, lon: -117.1611 },
      maxResults: 5,
    },
    metadata: {
      totalBeachesConsidered: 1,
      successfulForecasts: 1,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: "2026-05-06T13:00:00.000Z",
    },
    regionalCall: "Cleanest window is before lunch.",
    eveningTransition: {
      active: true,
      restOfToday: {
        summary: "Morning session",
        conditions: "lighter wind, easing tide",
        waveHeight: "3-4 ft",
      },
      tomorrowRegionalCall: "Tomorrow morning has another clean regional window.",
    },
  };
}

async function callDiscoverRoute(entitlementRow: Record<string, unknown> | null) {
  const supabase = makeSupabaseStub(entitlementRow);
  const { GET } = await import("@/app/api/surf/discover/route");
  const response = await GET(makeRequest(), {
    user: { id: "user-contract" } as any,
    supabase: supabase as any,
    params: {},
  } as any);
  return response;
}

describe("/api/surf/discover entitlement resolution", () => {
  const originalBestSpotGate = process.env.SURF_DISCOVERY_BEST_SPOT_GATE;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SURF_DISCOVERY_BEST_SPOT_GATE;
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

  afterAll(() => {
    if (originalBestSpotGate === undefined) {
      delete process.env.SURF_DISCOVERY_BEST_SPOT_GATE;
    } else {
      process.env.SURF_DISCOVERY_BEST_SPOT_GATE = originalBestSpotGate;
    }
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

  it("passes de-duped includeBeachIds through to the discovery orchestrator", async () => {
    const supabase = makeSupabaseStub(null);
    const { GET } = await import("@/app/api/surf/discover/route");

    await GET(
      makeRequest(
        `lat=32.7157&lon=-117.1611&includeBeachIds=${INCLUDED_BEACH_ID_A},${INCLUDED_BEACH_ID_B},${INCLUDED_BEACH_ID_A}`,
      ),
      {
        user: { id: "user-with-saved-spots" } as any,
        supabase: supabase as any,
        params: {},
      } as any,
    );

    expect(mockDiscoverSurfSpots).toHaveBeenCalledTimes(1);
    expect(mockDiscoverSurfSpots.mock.calls[0][1]).toMatchObject({
      includeBeachIds: [INCLUDED_BEACH_ID_A, INCLUDED_BEACH_ID_B],
    });
  });

  it("passes now discovery mode through to the discovery orchestrator", async () => {
    const supabase = makeSupabaseStub(null);
    const { GET } = await import("@/app/api/surf/discover/route");

    await GET(makeRequest("lat=32.7157&lon=-117.1611&mode=now"), {
      user: { id: "user-now-mode" } as any,
      supabase: supabase as any,
      params: {},
    } as any);

    expect(mockDiscoverSurfSpots).toHaveBeenCalledTimes(1);
    expect(mockDiscoverSurfSpots.mock.calls[0][1]).toMatchObject({
      discoveryMode: "now",
    });
  });

  it("rejects malformed includeBeachIds before calling discovery", async () => {
    const supabase = makeSupabaseStub(null);
    const { GET } = await import("@/app/api/surf/discover/route");

    const response = await GET(
      makeRequest("lat=32.7157&lon=-117.1611&includeBeachIds=not-a-uuid"),
      {
        user: { id: "user-bad-include" } as any,
        supabase: supabase as any,
        params: {},
      } as any,
    );

    expect(response.status).toBe(400);
    expect(mockDiscoverSurfSpots).not.toHaveBeenCalled();
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

  it("paid/trial users receive full recommendations with a conservative personalExplanation", async () => {
    mockDiscoverSurfSpots.mockResolvedValue(makeDiscoveryResponse());

    const response = await callDiscoverRoute({
      is_pro: true,
      is_trialing: false,
      billing_issue: false,
      expires_at: null,
    });
    const body = await response.json();

    expect(body.data.entitlement).toMatchObject({
      tier: "premium",
      hasPaidAccess: true,
      canSeeBestSpot: true,
    });
    expect(body.data.lockedBestSpotTeaser).toBeNull();
    expect(body.data.recommendations).toHaveLength(1);
    expect(body.data.includedRecommendations).toHaveLength(1);
    expect(body.data.recommendations[0].beach).toMatchObject({
      id: "beach-secret-id",
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
      photo_url: "https://cdn.quiver.test/ob.jpg",
    });
    expect(body.data.recommendations[0].personalExplanation).toEqual(
      expect.stringContaining("Wave size matches your sweet spot")
    );
    expect(body.data.recommendations[0].personalExplanation).toEqual(
      expect.stringContaining("Wind matches your usual sessions")
    );
    expect(body.data.recommendations[0].personalExplanation).not.toEqual(
      expect.stringContaining("Matches your surfing patterns")
    );
  });

  it("preserves recommendation discriminator metadata in the route response", async () => {
    mockDiscoverSurfSpots.mockResolvedValue(makeDiscoveryResponse());

    const response = await callDiscoverRoute({
      is_pro: true,
      is_trialing: false,
      billing_issue: false,
      expires_at: null,
    });
    const body = await response.json();

    expect(body.data.recommendations[0]).toMatchObject({
      kind: "custom_spot",
      customSpotId: "custom-spot-contract-id",
      visibility: "public",
      isOwn: false,
    });
    expect(body.data.includedRecommendations[0]).toMatchObject({
      kind: "beach",
      customSpotId: null,
      visibility: null,
      isOwn: false,
    });
  });

  it("free users receive recommendations when the best-spot gate is not enabled", async () => {
    mockDiscoverSurfSpots.mockResolvedValue(makeDiscoveryResponse());

    const response = await callDiscoverRoute(null);
    const body = await response.json();

    expect(body.data.entitlement).toMatchObject({
      tier: "free",
      hasPaidAccess: false,
      canSeeBestSpot: false,
    });
    expect(body.data.lockedBestSpotTeaser).toBeNull();
    expect(body.data.recommendations).toHaveLength(1);
    expect(body.data.includedRecommendations).toHaveLength(1);
    expect(body.data.recommendations[0].beach).toMatchObject({
      id: "beach-secret-id",
      name: "Ocean Beach Pier",
      slug: "ocean-beach-pier",
    });
    expect(body.data.recommendations[0].personalExplanation).toBeUndefined();
  });

  it("free users receive teaser-safe regional context when the best-spot gate is enabled", async () => {
    process.env.SURF_DISCOVERY_BEST_SPOT_GATE = "1";
    mockDiscoverSurfSpots.mockResolvedValue(makeDiscoveryResponse());

    const response = await callDiscoverRoute(null);
    const body = await response.json();
    const responseText = JSON.stringify(body.data);

    expect(body.data.entitlement).toMatchObject({
      tier: "free",
      hasPaidAccess: false,
      canSeeBestSpot: false,
    });
    expect(body.data.recommendations).toEqual([]);
    expect(body.data.includedRecommendations).toEqual([]);
    expect(body.data.regionalCall).toBe("Cleanest window is before lunch.");
    expect(body.data.eveningTransition).toMatchObject({
      active: true,
      restOfToday: {
        summary: "Morning session",
        conditions: "lighter wind, easing tide",
        waveHeight: "3-4 ft",
      },
      tomorrowRegionalCall: "Tomorrow morning has another clean regional window.",
    });
    expect(body.data.lockedBestSpotTeaser).toMatchObject({
      title: expect.any(String),
      subtitle: expect.stringContaining("Unlock Pro"),
      approximateArea: expect.any(String),
      approximateTime: expect.any(String),
      confidence: expect.any(Number),
      scoreBand: "80-89",
      conditionSummary: expect.any(String),
    });
    expect(responseText).not.toContain("beach-secret-id");
    expect(responseText).not.toContain("Ocean Beach Pier");
    expect(responseText).not.toContain("ocean-beach-pier");
    expect(responseText).not.toContain("https://cdn.quiver.test/ob.jpg");
    expect(responseText).not.toContain("https://cams.quiver.test/ob");
    expect(responseText).not.toContain("included-secret-id");
    expect(responseText).not.toContain("Saved Secret Beach");
    expect(responseText).not.toContain("https://cdn.quiver.test/saved.jpg");
  });

  it("generates ETag from the opt-in gated free response rather than the ungated discovery object", async () => {
    process.env.SURF_DISCOVERY_BEST_SPOT_GATE = "1";
    const ungatedDiscovery = makeDiscoveryResponse();
    mockDiscoverSurfSpots.mockResolvedValue(ungatedDiscovery);

    const response = await callDiscoverRoute(null);
    const body = await response.json();
    const actualEtag = response.headers.get("ETag")?.replace(/"/g, "");
    const gatedEtag = await generateETag({ success: true, data: body.data });
    const ungatedEtag = await generateETag({ success: true, data: ungatedDiscovery });

    expect(actualEtag).toBe(gatedEtag);
    expect(actualEtag).not.toBe(ungatedEtag);
  });
});
