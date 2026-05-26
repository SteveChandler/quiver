import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STARTER_MATCH_BODY,
  getPersonalizationMatchScore,
  resolveMatchScoreState,
} from "@/lib/personalization/match-score";

const forecast = {
  beachId: "beach-1",
  waveHeight: "3",
  wavePeriod: "12",
  windSpeed: "4",
  windDirection: "210",
  tideHeight: "3",
};

function makeSupabaseStub(
  entitlementRow: Record<string, unknown> | null,
  rpcResult: { data: unknown; error: Error | null },
): { supabase: SupabaseClient; rpc: jest.Mock } {
  const rpc = jest.fn(async () => rpcResult);
  const supabase = {
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: entitlementRow, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  return { supabase, rpc };
}

describe("resolveMatchScoreState", () => {
  it("returns starter state with 0 rated sessions and no numeric score", () => {
    expect(
      resolveMatchScoreState({
        eligibilitySource: "entitlement",
        forecast,
        rpcResult: {
          state: "onboarding",
          session_count: 0,
          sessions_needed: 5,
        },
      }),
    ).toMatchObject({
      state: "starter",
      score: null,
      session_count: 0,
      sessions_needed: 5,
      body: STARTER_MATCH_BODY,
      quality_band: "starter",
    });
  });

  it("adds starter reason facts without a numeric score", () => {
    const result = resolveMatchScoreState({
      eligibilitySource: "entitlement",
      forecast,
      rpcResult: {
        state: "starter",
        session_count: 2,
        sessions_needed: 3,
      },
    });

    expect(result).toMatchObject({
      state: "starter",
      score: null,
      reason_type: "starter_preferences",
      reason_facts: expect.arrayContaining([
        { kind: "session_count", value: 2 },
        { kind: "snapshot_quality", value: "sparse" },
        { kind: "wave_height", value: "3" },
        { kind: "wave_period", value: "12" },
      ]),
    });
  });

  it("returns starter state with 4 rated sessions and no numeric score", () => {
    expect(
      resolveMatchScoreState({
        eligibilitySource: "entitlement",
        forecast,
        rpcResult: {
          state: "onboarding",
          session_count: 4,
          sessions_needed: 1,
        },
      }),
    ).toMatchObject({
      state: "starter",
      score: null,
      session_count: 4,
      sessions_needed: 1,
    });
  });

  it("returns learned state with score at 5 positive qualifying sessions", () => {
    expect(
      resolveMatchScoreState({
        eligibilitySource: "entitlement",
        forecast,
        rpcResult: {
          state: "ready",
          score: 8.4,
          label: "GOOD",
          reason_bullets: ["Wave height 3 ft — profile peak 3 ft"],
          sessions_in_profile: 5,
          profile_kind: "preference_only",
        },
      }),
    ).toMatchObject({
      state: "learned",
      score: 8.4,
      fit_label: "GOOD",
      session_count: 5,
      sessions_needed: 0,
      quality_band: "session_backed",
    });
  });

  it("adds session-backed reason facts for learned matches", () => {
    const result = resolveMatchScoreState({
      eligibilitySource: "entitlement",
      forecast,
      rpcResult: {
        state: "learned",
        score: 8.4,
        label: "GOOD",
        reason_bullets: ["Light wind lines up with your better sessions"],
        sessions_in_profile: 12,
        profile_kind: "preference_only",
        aversion_sample_count: 0,
      },
    });

    expect(result).toMatchObject({
      state: "learned",
      reason_type: "session_history",
      quality_band: "session_backed",
      reason_facts: expect.arrayContaining([
        { kind: "session_count", value: 12 },
        { kind: "snapshot_quality", value: "usable" },
        { kind: "signal_balance", value: "positive" },
        { kind: "wind_speed", value: "4" },
        { kind: "tide_height", value: "3" },
      ]),
    });
  });

  it("quality-weights mixed two-sided histories instead of only counting sessions", () => {
    const result = resolveMatchScoreState({
      eligibilitySource: "entitlement",
      forecast,
      rpcResult: {
        state: "learned",
        score: 6.2,
        label: "FAIR",
        reason_bullets: ["This is close, but the match is not clean yet."],
        sessions_in_profile: 12,
        profile_kind: "two_sided",
        aversion_sample_count: 7,
      },
    });

    expect(result).toMatchObject({
      state: "learned",
      quality_band: "mixed_signal",
      reason_facts: expect.arrayContaining([
        { kind: "signal_balance", value: "mixed" },
      ]),
    });
  });

  it("returns avoidance_learned for 5 mostly neutral or negative sessions", () => {
    expect(
      resolveMatchScoreState({
        eligibilitySource: "entitlement",
        forecast,
        rpcResult: {
          state: "onboarding",
          session_count: 5,
          sessions_needed: 0,
          reason: "no_positive_sessions",
        },
      }),
    ).toMatchObject({
      state: "avoidance_learned",
      score: null,
      reason_bullets: [
        "We know what you tend to avoid. Rate a few good sessions to sharpen your match.",
      ],
      quality_band: "mixed_signal",
      reason_type: "avoidance_learning",
    });
  });

  it("does not pass through numeric scores for avoidance_learned", () => {
    expect(
      resolveMatchScoreState({
        eligibilitySource: "entitlement",
        forecast,
        rpcResult: {
          state: "avoidance_learned",
          score: 7.2,
          session_count: 5,
          sessions_needed: 0,
          reason: "no_positive_sessions",
        },
      }),
    ).toMatchObject({
      state: "avoidance_learned",
      score: null,
    });
  });

  it("degrades learned state when the RPC omits a numeric score", () => {
    expect(
      resolveMatchScoreState({
        eligibilitySource: "entitlement",
        forecast,
        rpcResult: {
          state: "learned",
          score: null,
          sessions_in_profile: 5,
          profile_kind: "preference_only",
        },
      }),
    ).toMatchObject({
      state: "degraded",
      score: null,
      session_count: 5,
    });
  });

  it("sanitizes learned reason bullets so debug copy does not leak", () => {
    const result = resolveMatchScoreState({
      eligibilitySource: "entitlement",
      forecast,
      rpcResult: {
        state: "ready",
        score: 7,
        label: "GOOD",
        reason_bullets: [
          "Wave height 3 ft — profile peak 3 ft",
          "raw score 7 confidence low",
        ],
        sessions_in_profile: 7,
      },
    });

    expect(result.reason_bullets.join(" ")).not.toMatch(
      /profile peak|raw score|confidence low/i,
    );
  });

  it("builds learned surf-call copy from facts when raw bullets are debug-only", () => {
    const result = resolveMatchScoreState({
      eligibilitySource: "entitlement",
      forecast,
      rpcResult: {
        state: "learned",
        score: 7.4,
        label: "GOOD",
        reason_bullets: [
          "Wave height 3 ft — profile peak 3 ft",
          "raw score 7 confidence low",
        ],
        sessions_in_profile: 12,
        profile_kind: "preference_only",
        board_tip: "CI Mid 7'0\"",
      },
    });

    expect(result.reason_bullets).toEqual(
      expect.arrayContaining([
        "This window sits around 3 ft at 12s with 4 mph wind.",
        "CI Mid 7'0\" has worked for your better sessions in similar surf.",
      ]),
    );
    expect(result.reason_bullets.join(" ")).not.toMatch(
      /profile peak|raw score|confidence low/i,
    );
  });

  it("uses cautious low-signal copy without exposing confidence labels", () => {
    const result = resolveMatchScoreState({
      eligibilitySource: "entitlement",
      forecast,
      rpcResult: {
        state: "learned",
        score: 6.1,
        label: "FAIR",
        reason_bullets: ["Light wind lines up, but the profile is still young."],
        sessions_in_profile: 5,
        profile_kind: "preference_only",
        confidence: "low",
      },
    });

    expect(result.reason_bullets[0]).toBe(
      "Early learned read: this uses 5 rated sessions, so keep rating after you surf.",
    );
    expect(result.reason_bullets.join(" ")).not.toMatch(/low confidence/i);
  });
});

describe("getPersonalizationMatchScore", () => {
  const originalBetaUserIds = process.env.PERSONALIZATION_BETA_USER_IDS;

  afterEach(() => {
    process.env.PERSONALIZATION_BETA_USER_IDS = originalBetaUserIds;
  });

  it("returns locked for free users and does not call raw scoring RPC", async () => {
    const { supabase, rpc } = makeSupabaseStub(null, {
      data: { state: "ready", score: 9 },
      error: null,
    });

    await expect(
      getPersonalizationMatchScore("user-free", supabase, forecast),
    ).resolves.toMatchObject({
      state: "locked",
      score: null,
      quality_band: "locked",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("attaches deterministic scoring latency to match score responses", async () => {
    const { supabase } = makeSupabaseStub(
      { is_pro: true, is_trialing: false },
      {
        data: {
          state: "learned",
          score: 8.4,
          label: "GOOD",
          reason_bullets: ["Light wind lines up with your better sessions"],
          sessions_in_profile: 5,
          profile_kind: "preference_only",
        },
        error: null,
      },
    );
    const now = jest
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(137);

    await expect(
      getPersonalizationMatchScore("user-pro", supabase, forecast, { now }),
    ).resolves.toMatchObject({
      state: "learned",
      latency_ms: 37,
    });
  });

  it("returns locked for billing_issue users even if raw scoring facts exist", async () => {
    const { supabase, rpc } = makeSupabaseStub(
      { is_pro: true, billing_issue: true },
      { data: { state: "ready", score: 9 }, error: null },
    );

    await expect(
      getPersonalizationMatchScore("user-billing", supabase, forecast),
    ).resolves.toMatchObject({
      state: "locked",
      lock_reason: "billing_issue",
      score: null,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the private core scorer for allowlisted TestFlight users without entitlement rows", async () => {
    process.env.PERSONALIZATION_BETA_USER_IDS = "user-testflight";
    const { supabase, rpc: publicRpc } = makeSupabaseStub(null, {
      data: {
        state: "locked",
        score: null,
        lock_reason: "free",
      },
      error: null,
    });
    const coreRpc = jest.fn(async () => ({
      data: {
        state: "learned",
        score: 8.8,
        label: "GOOD",
        reason_bullets: ["Wave height 3 ft"],
        sessions_in_profile: 5,
        profile_kind: "preference_only",
      },
      error: null,
    }));

    await expect(
      getPersonalizationMatchScore("user-testflight", supabase, forecast, {
        createScoringClient: () =>
          ({ rpc: coreRpc }) as unknown as Pick<SupabaseClient, "rpc">,
      }),
    ).resolves.toMatchObject({
      state: "learned",
      score: 8.8,
      fit_label: "GOOD",
      session_count: 5,
    });
    expect(publicRpc).not.toHaveBeenCalled();
    expect(coreRpc).toHaveBeenCalledWith(
      "compute_user_match_score_core",
      expect.objectContaining({ p_user_id: "user-testflight" }),
    );
  });

  it("degrades TestFlight bypass scoring if the server scoring client is unavailable", async () => {
    process.env.PERSONALIZATION_BETA_USER_IDS = "user-testflight";
    const { supabase, rpc: publicRpc } = makeSupabaseStub(null, {
      data: null,
      error: null,
    });

    await expect(
      getPersonalizationMatchScore("user-testflight", supabase, forecast, {
        createScoringClient: () => {
          throw new Error("missing service role env");
        },
      }),
    ).resolves.toMatchObject({
      state: "degraded",
      score: null,
    });
    expect(publicRpc).not.toHaveBeenCalled();
  });

  it("returns degraded when scoring fails but forecast data exists", async () => {
    const { supabase } = makeSupabaseStub(
      { is_pro: true, is_trialing: false },
      { data: null, error: new Error("rpc failed") },
    );

    await expect(
      getPersonalizationMatchScore("user-pro", supabase, forecast),
    ).resolves.toMatchObject({
      state: "degraded",
      score: null,
      reason_bullets: [
        "Forecasts are still available. Retry personal match when you are ready.",
      ],
    });
  });
});
