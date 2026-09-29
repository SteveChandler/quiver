/** @jest-environment node */

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/personalization/match-score/route";

const mockUser = { id: "user-1" };
const rpc = jest.fn();
const mockServiceRpc = jest.fn();
const mockFetchUserBoardContext = jest.fn();
const mockGetProfileExperienceLevel = jest.fn();
const mockRecommendBoard = jest.fn();
let entitlementRow: Record<string, unknown> | null = { is_pro: true };

jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  fetchUserBoardContext: (...args: unknown[]) => mockFetchUserBoardContext(...args),
}));
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) => mockGetProfileExperienceLevel(...args),
}));
jest.mock("@/lib/scoring/personal-board", () => ({
  recommendBoard: (...args: unknown[]) => mockRecommendBoard(...args),
}));

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
            from: (table: string) => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: table === "beaches"
                    ? { id: "beach-1", break_type: "beach", preferred_tide_ft_min: 1, preferred_tide_ft_max: 5 }
                    : entitlementRow, error: null }),
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
    mockFetchUserBoardContext.mockResolvedValue({ boardsForPicks: [{ id: "board-1", name: "Twin pin", board_type: "shortboard" }] });
    mockGetProfileExperienceLevel.mockResolvedValue("advanced");
    mockRecommendBoard.mockReturnValue(null);
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
    expect(json.data).toMatchObject({ board_pick: null, board_tip: null });
  });

  it("attaches the picker board and its reason, ignoring a legacy RPC tip", async () => {
    const pick = { id: "board-1", name: "Twin pin", type: "shortboard", boardClass: "shortboard",
      reason: "Twin pin fits these conditions; limited similar session history", alternates: [] };
    mockRecommendBoard.mockReturnValue(pick);
    rpc.mockResolvedValue({ data: { state: "learned", score: 8.4, sessions_in_profile: 15,
      board_tip: "Legacy board", reason_bullets: ["Wave height 3 ft — profile peak 3 ft"] }, error: null });

    const response = await GET(makeRequest("&forecast_at=2026-09-28T15%3A00%3A00Z&tide_status=rising"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.board_pick).toEqual({ id: pick.id, name: pick.name, type: pick.type,
      board_class: pick.boardClass, reason: pick.reason });
    expect(json.data.board_tip).toBe("Twin pin");
    expect(json.data.reason_facts).toContainEqual({ kind: "board_fit", value: "Twin pin" });
    expect(json.data.reason_bullets).toContain(pick.reason);
    expect(mockFetchUserBoardContext).toHaveBeenCalledWith(expect.anything(), "user-1", true);
    expect(mockRecommendBoard).toHaveBeenCalledWith(expect.any(Array),
      expect.objectContaining({ forecast_at: "2026-09-28T15:00:00.000Z", wind_direction_deg: 210, tide_status: "rising" }),
      expect.objectContaining({ id: "beach-1" }), "advanced");
  });

  it("passes the optional source keys to the board pick and sends nothing extra without them", async () => {
    rpc.mockResolvedValue({ data: { state: "learned", score: 8.4, sessions_in_profile: 15, reason_bullets: [] }, error: null });

    await GET(makeRequest("&data_source=OPEN_METEO&wave_period_om=9.9"));
    expect(mockRecommendBoard.mock.calls[0][1]).toMatchObject({ wave_period: "12", data_source: "OPEN_METEO", wave_period_om: 9.9 });

    mockRecommendBoard.mockClear();
    await GET(makeRequest("&wave_period_om=abc"));
    expect(mockRecommendBoard.mock.calls[0][1]).not.toHaveProperty("data_source");
    expect(mockRecommendBoard.mock.calls[0][1]).not.toHaveProperty("wave_period_om");
    // The single-slot RPC has a fixed argument list; installed clients keep calling it unchanged.
    expect(rpc).toHaveBeenLastCalledWith("compute_user_match_score", {
      p_user_id: "user-1", p_beach_id: "beach-1", p_wave_height: "3", p_wave_period: "12",
      p_wind_speed: "4", p_wind_direction: "210", p_tide_height: "3",
    });
  });

  it("keeps a learned response successful when board loading rejects", async () => {
    mockFetchUserBoardContext.mockRejectedValue(new Error("board read failed"));
    rpc.mockResolvedValue({ data: { state: "learned", score: 8.4, sessions_in_profile: 15,
      board_tip: "Legacy board", reason_bullets: [] }, error: null });

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ state: "learned", board_pick: null, board_tip: null });
    expect(json.data.reason_facts).not.toContainEqual({ kind: "board_fit", value: "Legacy board" });
  });

  it("attaches a pick for avoidance learned state", async () => {
    mockRecommendBoard.mockReturnValue({ id: "board-1", name: "Twin pin", type: "shortboard",
      boardClass: "shortboard", reason: "Fits these conditions", alternates: [] });
    rpc.mockResolvedValue({ data: { state: "avoidance_learned", score: null,
      sessions_in_profile: 5, profile_kind: "neutral" }, error: null });

    const json = await (await GET(makeRequest())).json();
    expect(json.data).toMatchObject({ state: "avoidance_learned", board_tip: "Twin pin",
      board_pick: { name: "Twin pin" } });
  });

  it("returns starter prior scores through the authenticated route", async () => {
    const body =
      "A starter read from your skill and this spot's setup. It gets more personal as you rate sessions.";
    rpc.mockResolvedValue({
      data: {
        state: "starter",
        score: 7.1,
        fit_label: "Based on your skill + this spot",
        body,
        session_count: 2,
        sessions_needed: 3,
        skill_used: "intermediate",
        skill_source: "profile",
        prior_dimensions: ["skill_wave", "spot_wind_direction"],
      },
      error: null,
    });

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      state: "starter",
      score: 7.1,
      fit_label: "Based on your skill + this spot",
      body,
      session_count: 2,
      sessions_needed: 3,
      quality_band: "starter",
      reason_type: "starter_preferences",
      reason_facts: expect.arrayContaining([
        { kind: "skill_used", value: "intermediate" },
        { kind: "skill_source", value: "profile" },
        { kind: "prior_dimension", value: "skill_wave" },
      ]),
    });
    expect(json.data.reason_bullets[0]).toBe(body);
    expect(json.data).toMatchObject({ board_pick: null, board_tip: null });
    expect(mockFetchUserBoardContext).not.toHaveBeenCalled();
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
    expect(mockFetchUserBoardContext).not.toHaveBeenCalled();
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

  it("rejects an invalid forecast timestamp", async () => {
    const response = await GET(makeRequest("&forecast_at=not-a-date"));
    expect(response.status).toBe(400);
    expect(mockFetchUserBoardContext).not.toHaveBeenCalled();
  });
});
