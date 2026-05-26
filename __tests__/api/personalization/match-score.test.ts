/** @jest-environment node */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/personalization/match-score/route";

const mockUser = { id: "user-1" };
const rpc = jest.fn();
const mockServiceRpc = jest.fn();
let entitlementRow: Record<string, unknown> | null = { is_pro: true };

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc: mockServiceRpc }),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth:
      (handler: any) =>
      async (request: NextRequest): Promise<Response> =>
        handler(request, {
          user: mockUser,
          supabase: {
            rpc,
            from: () => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: entitlementRow, error: null }),
                }),
              }),
            }),
          },
          params: {},
        }),
  };
});

function makeRequest(search = ""): NextRequest {
  return new NextRequest(
    `https://www.quiversurf.app/api/personalization/match-score?beach_id=beach-1&wave_height=3&wave_period=12&wind_speed=4&wind_direction=210&tide_height=3${search}`,
  );
}

describe("GET /api/personalization/match-score", () => {
  const originalBetaUserIds = process.env.PERSONALIZATION_BETA_USER_IDS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PERSONALIZATION_BETA_USER_IDS = originalBetaUserIds;
    entitlementRow = { is_pro: true };
    rpc.mockResolvedValue({
      data: {
        state: "ready",
        score: 8.4,
        label: "GOOD",
        reason_bullets: ["Wave height 3 ft — profile peak 3 ft"],
        sessions_in_profile: 5,
        profile_kind: "preference_only",
      },
      error: null,
    });
    mockServiceRpc.mockResolvedValue({
      data: {
        state: "learned",
        score: 8.4,
        label: "GOOD",
        reason_bullets: ["Wave height 3 ft — profile peak 3 ft"],
        sessions_in_profile: 5,
        profile_kind: "preference_only",
      },
      error: null,
    });
  });

  afterEach(() => {
    process.env.PERSONALIZATION_BETA_USER_IDS = originalBetaUserIds;
  });

  it("returns learned state through the authenticated route", async () => {
    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      state: "learned",
      score: 8.4,
      fit_label: "GOOD",
      session_count: 5,
      sessions_needed: 0,
      quality_band: "session_backed",
      reason_type: "session_history",
      reason_facts: expect.arrayContaining([
        { kind: "session_count", value: 5 },
        { kind: "wave_height", value: "3" },
      ]),
    });
    expect(json.data.latency_ms).toEqual(expect.any(Number));
    expect(json.data.reason_bullets.join(" ")).not.toMatch(/profile peak/i);
  });

  it("returns locked for free users even if raw scoring facts exist", async () => {
    entitlementRow = null;

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      state: "locked",
      score: null,
      source: "entitlement",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockServiceRpc).not.toHaveBeenCalled();
  });

  it("returns learned through the server core scorer for TestFlight bypass users", async () => {
    process.env.PERSONALIZATION_BETA_USER_IDS = "user-1";
    entitlementRow = null;
    rpc.mockResolvedValue({
      data: { state: "locked", score: null, lock_reason: "free" },
      error: null,
    });

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      state: "learned",
      score: 8.4,
      source: "session_history",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockServiceRpc).toHaveBeenCalledWith(
      "compute_user_match_score_core",
      expect.objectContaining({ p_user_id: "user-1" }),
    );
  });

  it("returns degraded when scoring fails but forecast data exists", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("rpc failed") });

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      state: "degraded",
      score: null,
      fit_label: "Personal match did not load",
    });
  });

  it("rejects missing beach id", async () => {
    const response = await GET(
      new NextRequest(
        "https://www.quiversurf.app/api/personalization/match-score?wave_height=3",
      ),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/beach_id is required/i);
  });
});
