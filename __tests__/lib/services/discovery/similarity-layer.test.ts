/**
 * Unit tests for similarity-layer.ts
 *
 * Covers the contract from Plan V4 Agent 1 (locked formula post-Fix Agent F1):
 *   1. Free users: no RPC, every rec gets similarity: null.
 *   2. Onboarding: RPC returns state=onboarding → onboarding object, score unchanged.
 *   3. Ready below threshold (< 5.0): bonus = 0, score unchanged.
 *   4. Ready above threshold: additive bonus = (score - 5) * 4, capped at +20.
 *   5. Ready at cap (score = 10): bonus = 20.
 *   6. Bulk RPC call shape: p_user_id, p_beach_id, p_slots jsonb array.
 *   7. Missing beach.id: rec is preserved, gets similarity: null, no RPC for it.
 */

jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

import {
  applySimilarityLayer,
  computeSimilarityBonus,
} from "@/lib/services/discovery/similarity-layer";

// ============================================================================
// Fixtures
// ============================================================================

function makeRec(
  overrides: Partial<SurfDiscoveryRecommendation> & {
    beachId?: string;
    score?: number;
  } = {},
): SurfDiscoveryRecommendation {
  const beachId = overrides.beachId ?? "beach-1";
  const score = overrides.score ?? 60;

  const beach = {
    id: beachId,
    name: "Test Beach",
    slug: "test-beach",
    lat: 32.7,
    lon: -117.1,
  } as unknown as Beach;

  const forecast = {
    beach_id: beachId,
    forecast_at: "2026-05-04T15:00:00Z",
    wave_height: "3.5",
    wave_period: "12s",
    wind_speed: "8",
    wind_direction_deg: 270,
    tide_height: "2.1",
  } as unknown as EnhancedForecastEntity;

  return {
    beach,
    window: {
      start: new Date("2026-05-04T15:00:00Z"),
      end: new Date("2026-05-04T18:00:00Z"),
      tide: "Rising",
      wind: "8 mph W",
      waveHeight: "3-4 ft",
      wavePeriod: "12s",
      dataSource: "CDIP",
      confidence: 85,
      timezone: "America/Los_Angeles",
    },
    forecast,
    score,
    matchQuality: "good",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 10,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: "summary",
    reasons: [],
    warnings: [],
    similarity: null,
    generated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSupabase(rpcImpl: jest.Mock) {
  return {
    rpc: rpcImpl,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("computeSimilarityBonus (formula)", () => {
  it("returns 0 below the 5.0 threshold", () => {
    expect(computeSimilarityBonus(0)).toBe(0);
    expect(computeSimilarityBonus(3)).toBe(0);
    expect(computeSimilarityBonus(4.99)).toBe(0);
  });

  it("returns 0 at exactly 5.0", () => {
    expect(computeSimilarityBonus(5)).toBe(0);
  });

  it("scales (score - 5) * 4 between 5 and 10", () => {
    expect(computeSimilarityBonus(6)).toBeCloseTo(4);
    expect(computeSimilarityBonus(7)).toBeCloseTo(8);
    expect(computeSimilarityBonus(7.5)).toBeCloseTo(10);
    expect(computeSimilarityBonus(8)).toBeCloseTo(12);
    expect(computeSimilarityBonus(9)).toBeCloseTo(16);
  });

  it("caps at +20 (score 10)", () => {
    expect(computeSimilarityBonus(10)).toBe(20);
    expect(computeSimilarityBonus(11)).toBe(20);
    expect(computeSimilarityBonus(99)).toBe(20);
  });

  it("treats non-finite input as 0 bonus (NaN/Infinity defensive)", () => {
    expect(computeSimilarityBonus(Number.NaN)).toBe(0);
    expect(computeSimilarityBonus(Number.POSITIVE_INFINITY)).toBe(0);
    expect(computeSimilarityBonus(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("applySimilarityLayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("free user: stamps similarity:null on every rec and never calls RPC", async () => {
    const rpc = jest.fn();
    const supabase = makeSupabase(rpc);
    const recs = [makeRec({ score: 60 }), makeRec({ score: 50, beachId: "beach-2" })];

    const out = await applySimilarityLayer({
      recommendations: recs,
      userId: "user-1",
      isPro: false,
      supabase,
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(out.recommendations).toHaveLength(2);
    out.recommendations.forEach((r, idx) => {
      expect(r.similarity).toBeNull();
      // Score is unchanged from input.
      expect(r.score).toBe(recs[idx].score);
    });
  });

  it("null userId: same as free (no RPC, all null)", async () => {
    const rpc = jest.fn();
    const supabase = makeSupabase(rpc);
    const recs = [makeRec({ score: 60 })];

    const out = await applySimilarityLayer({
      recommendations: recs,
      userId: null,
      isPro: true,
      supabase,
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(out.recommendations[0].similarity).toBeNull();
    expect(out.recommendations[0].score).toBe(60);
  });

  it("onboarding: stamps onboarding state, sessionCount/sessionsNeeded, score unchanged", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "onboarding",
            session_count: 2,
            sessions_needed: 5,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 60 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(out.recommendations[0].similarity).toEqual({
      state: "onboarding",
      sessionCount: 2,
      sessionsNeeded: 5,
    });
    expect(out.recommendations[0].score).toBe(60); // unchanged
  });

  it("ready below threshold (4.5): bonusApplied = 0, score unchanged", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 4.5,
            label: "MEH",
            reason_bullets: ["Conditions are okay"],
            sessions_in_profile: 12,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 60 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    const sim = out.recommendations[0].similarity;
    expect(sim).not.toBeNull();
    expect(sim).toMatchObject({
      state: "ready",
      score: 4.5,
      label: "MEH",
      bonusApplied: 0,
      reason: "Conditions are okay",
      sessionCount: 12,
    });
    expect(out.recommendations[0].score).toBe(60); // unchanged
  });

  it("ready above threshold (7.5): bonusApplied = 10, score = original + 10", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 7.5,
            label: "GOOD",
            reason_bullets: ["Strong match"],
            sessions_in_profile: 20,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 60 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    const sim = out.recommendations[0].similarity;
    expect(sim).not.toBeNull();
    expect(sim).toMatchObject({
      state: "ready",
      score: 7.5,
      label: "GOOD",
      bonusApplied: 10,
    });
    expect(out.recommendations[0].score).toBeCloseTo(70);
  });

  it("ready exactly at threshold (5.0): bonusApplied = 0, score unchanged", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 5.0,
            label: "RIDEABLE",
            reason_bullets: ["Border match"],
            sessions_in_profile: 14,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 60 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    const sim = out.recommendations[0].similarity;
    expect(sim).toMatchObject({
      state: "ready",
      score: 5.0,
      bonusApplied: 0,
    });
    expect(out.recommendations[0].score).toBe(60);
  });

  it("ready at score 6.0: bonusApplied = 4, score = original + 4", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 6.0,
            label: "FAIR",
            reason_bullets: ["Decent match"],
            sessions_in_profile: 15,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 60 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    expect(out.recommendations[0].similarity).toMatchObject({
      state: "ready",
      score: 6.0,
      bonusApplied: 4,
    });
    expect(out.recommendations[0].score).toBeCloseTo(64);
  });

  it("ready at cap (10.0): bonusApplied = 20, score = original + 20 (capped at 100)", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 10.0,
            label: "EPIC",
            reason_bullets: ["Perfect match for your style"],
            sessions_in_profile: 30,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 60 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    const sim = out.recommendations[0].similarity;
    expect(sim).not.toBeNull();
    if (sim && sim.state === "ready") {
      expect(sim.bonusApplied).toBe(20);
    }
    expect(out.recommendations[0].score).toBe(80);
  });

  it("ready at score 10 with high base score caps at 100", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 10.0,
            label: "EPIC",
            reason_bullets: ["bull1"],
            sessions_in_profile: 30,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 95 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    // 95 + 20 = 115 → capped at 100
    expect(out.recommendations[0].score).toBe(100);
  });

  it("bulk RPC is called with p_user_id, p_beach_id, p_slots jsonb array", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 7.5,
            label: "GOOD",
            reason_bullets: ["ok"],
            sessions_in_profile: 12,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ beachId: "beach-7", score: 60 });

    await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-42",
      isPro: true,
      supabase,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const call = rpc.mock.calls[0] as unknown as [
      string,
      { p_user_id: string; p_beach_id: string; p_slots: Array<Record<string, string>> },
    ];
    const fnName = call[0];
    const payload = call[1];
    expect(fnName).toBe("compute_user_match_score_batch");
    expect(payload).toMatchObject({
      p_user_id: "user-42",
      p_beach_id: "beach-7",
    });
    expect(Array.isArray(payload.p_slots)).toBe(true);
    expect(payload.p_slots).toHaveLength(1);
    const slot = payload.p_slots[0];
    expect(slot).toMatchObject({
      forecast_at: "2026-05-04T15:00:00Z",
      wave_height: "3.5",
      // wave_period stripped of trailing 's'
      wave_period: "12",
      wind_speed: "8",
      wind_direction: "270",
      tide_height: "2.1",
    });
  });

  it("missing beach.id: rec preserved with similarity:null, RPC not called for it", async () => {
    const rpc = jest.fn(async () => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: 8,
            label: "GOOD",
            reason_bullets: ["yes"],
            sessions_in_profile: 10,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);

    const recWithBeach = makeRec({ beachId: "beach-A", score: 60 });
    const recNoBeach = makeRec({ beachId: "beach-B", score: 50 });
    // Strip beach.id to simulate missing
    (recNoBeach.beach as { id?: string | null }).id = "";

    const out = await applySimilarityLayer({
      recommendations: [recWithBeach, recNoBeach],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    // Only one RPC call (for the one with a beach.id).
    expect(rpc).toHaveBeenCalledTimes(1);
    const noBeachCall = rpc.mock.calls[0] as unknown as [
      string,
      { p_beach_id: string },
    ];
    expect(noBeachCall[1].p_beach_id).toBe("beach-A");

    // Output preserves array length.
    expect(out.recommendations).toHaveLength(2);
    expect(out.recommendations[1].similarity).toBeNull();
    // Score unchanged on the no-beach rec.
    expect(out.recommendations[1].score).toBe(50);
  });

  it("RPC error: similarity:null, score unchanged, no throw", async () => {
    const rpc = jest.fn(async () => ({
      data: null,
      error: { message: "boom" },
    }));
    const supabase = makeSupabase(rpc);
    const rec = makeRec({ score: 60 });

    const out = await applySimilarityLayer({
      recommendations: [rec],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    expect(out.recommendations[0].similarity).toBeNull();
    expect(out.recommendations[0].score).toBe(60);
  });

  it("multiple recs across multiple beaches: one RPC per beach (parallel)", async () => {
    const rpc = jest.fn(async (_fn: string, args: { p_beach_id: string }) => ({
      data: [
        {
          slot_idx: 0,
          forecast_at: "2026-05-04T15:00:00Z",
          result: {
            state: "ready",
            score: args.p_beach_id === "beach-A" ? 8.0 : 4.0,
            label: "GOOD",
            reason_bullets: ["x"],
            sessions_in_profile: 10,
          },
        },
      ],
      error: null,
    }));
    const supabase = makeSupabase(rpc);

    const recA = makeRec({ beachId: "beach-A", score: 60 });
    const recB = makeRec({ beachId: "beach-B", score: 70 });

    const out = await applySimilarityLayer({
      recommendations: [recA, recB],
      userId: "user-1",
      isPro: true,
      supabase,
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    // beach-A: 8.0 → bonus = (8-5)*4 = 12 → score 72
    expect(out.recommendations[0].score).toBeCloseTo(72);
    // beach-B: 4.0 → below threshold (5.0) → bonus = 0 → score 70
    expect(out.recommendations[1].score).toBe(70);
  });

  it("empty recommendations: no RPC, returns empty array", async () => {
    const rpc = jest.fn();
    const supabase = makeSupabase(rpc);
    const out = await applySimilarityLayer({
      recommendations: [],
      userId: "user-1",
      isPro: true,
      supabase,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(out.recommendations).toHaveLength(0);
  });
});
