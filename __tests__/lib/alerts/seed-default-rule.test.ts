import { seedDefaultRulesForUser } from "@/lib/alerts/seed-default-rule";
import type { SupabaseServerClient } from "@/types/supabase";

type BeachRow = {
  id: string;
  name: string;
  slug: string | null;
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  aspect_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  break_type: string | null;
  skill_level: string | null;
  features: unknown;
  preference_model: unknown;
  wind_onshore_bad_kt: number | null;
};

interface MockState {
  existingRuleCount: number;
  countError: { message: string } | null;
  beachRow: BeachRow | null;
  beachError: { message: string } | null;
  insertError: { message: string } | null;
  insertPayload: Array<Record<string, unknown>> | null;
  selectedBeachColumns: string | null;
}

function makeMockSupabase(state: MockState): SupabaseServerClient {
  const mock = {
    from: (table: string) => {
      if (table === "alert_rules") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts.head === true) {
              return {
                eq: (_col: string, _val: string) =>
                  Promise.resolve({
                    data: null,
                    count: state.existingRuleCount,
                    error: state.countError,
                  }),
              };
            }

            return {};
          },
          insert: (payload: Array<Record<string, unknown>>) => {
            state.insertPayload = payload;
            return {
              select: (_cols: string) =>
                Promise.resolve({
                  data: state.insertError
                    ? null
                    : payload.map((row, index) => ({
                        id: `rule-${index + 1}`,
                        preset_type: row.preset_type as string,
                      })),
                  error: state.insertError,
                }),
            };
          },
        };
      }

      if (table === "beaches") {
        return {
          select: (cols: string) => {
            state.selectedBeachColumns = cols;
            return {
              eq: (_col: string, _val: string) => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: state.beachRow,
                    error: state.beachError,
                  }),
              }),
            };
          },
        };
      }

      return {};
    },
  };

  return mock as unknown as SupabaseServerClient;
}

function baseState(overrides: Partial<MockState> = {}): MockState {
  return {
    existingRuleCount: 0,
    countError: null,
    beachRow: {
      id: "beach-123",
      name: "Ocean Beach",
      slug: "ocean-beach",
      lat: 37.77,
      lon: -122.51,
      timezone: "America/Los_Angeles",
      wind_offshore_deg: 90,
      wind_offshore_tol_deg: 45,
      aspect_deg: 270,
      preferred_tide_ft_min: 2,
      preferred_tide_ft_max: 5,
      preferred_tide_direction: "rising",
      swell_window_center_deg: 270,
      swell_window_halfwidth_deg: 60,
      break_type: null,
      skill_level: null,
      features: null,
      preference_model: null,
      wind_onshore_bad_kt: null,
    },
    beachError: null,
    insertError: null,
    insertPayload: null,
    selectedBeachColumns: null,
    ...overrides,
  };
}

describe("seedDefaultRulesForUser", () => {
  it("seeds mellow_session plus dawn_patrol for beginner dawn users", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      preferredTimeBucket: "dawn",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({
      seeded: true,
      rules: [
        { ruleId: "rule-1", presetType: "mellow_session" },
        { ruleId: "rule-2", presetType: "dawn_patrol" },
      ],
    });
    expect(state.insertPayload?.map((row) => row.preset_type)).toEqual([
      "mellow_session",
      "dawn_patrol",
    ]);
    expect(state.insertPayload?.map((row) => row.name)).toEqual([
      "Mellow session at your home break",
      "Dawn patrol at your home break",
    ]);
  });

  it("seeds clean_groundswell plus after_work for advanced evening users", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "advanced",
      preferredTimeBucket: "evening",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({
      seeded: true,
      rules: [
        { ruleId: "rule-1", presetType: "clean_groundswell" },
        { ruleId: "rule-2", presetType: "after_work" },
      ],
    });
    expect(state.insertPayload?.map((row) => row.preset_type)).toEqual([
      "clean_groundswell",
      "after_work",
    ]);
  });

  it("seeds mellow_session plus weekend_warrior for intermediate users with no bucket", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "intermediate",
      preferredTimeBucket: null,
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({
      seeded: true,
      rules: [
        { ruleId: "rule-1", presetType: "mellow_session" },
        { ruleId: "rule-2", presetType: "weekend_warrior" },
      ],
    });
    expect(state.insertPayload?.map((row) => row.name)).toContain(
      "Weekend windows at your home break",
    );
  });

  it("recognizes native preferredTime literals", async () => {
    const dawnState = baseState();
    await seedDefaultRulesForUser({
      supabase: makeMockSupabase(dawnState),
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      preferredTimeBucket: "dawn_patrol",
      notifyEmail: true,
      notifyPush: false,
    });

    const middayState = baseState();
    await seedDefaultRulesForUser({
      supabase: makeMockSupabase(middayState),
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      preferredTimeBucket: "midday",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(dawnState.insertPayload?.map((row) => row.preset_type)).toContain(
      "dawn_patrol",
    );
    expect(middayState.insertPayload?.map((row) => row.preset_type)).toContain(
      "weekend_warrior",
    );
  });

  it("returns already_has_rules when user has any existing rule", async () => {
    const state = baseState({ existingRuleCount: 1 });
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      preferredTimeBucket: "dawn",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({ seeded: false, reason: "already_has_rules" });
    expect(state.insertPayload).toBeNull();
  });

  it("returns beach_not_found when the beach row is missing", async () => {
    const state = baseState({ beachRow: null });
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-missing",
      experienceLevel: "beginner",
      preferredTimeBucket: "dawn",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({ seeded: false, reason: "beach_not_found" });
    expect(state.insertPayload).toBeNull();
  });

  it("passes notify_email and notify_push through to both insert rows", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      preferredTimeBucket: "dawn",
      notifyEmail: false,
      notifyPush: true,
    });

    expect(state.insertPayload).toHaveLength(2);
    expect(
      state.insertPayload?.every(
        (row) => row.notify_email === false && row.notify_push === true,
      ),
    ).toBe(true);
  });

  it("returns error reason with message on insert failure", async () => {
    const state = baseState({
      insertError: { message: "constraint violation" },
    });
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      preferredTimeBucket: "dawn",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({
      seeded: false,
      reason: "error",
      error: "constraint violation",
    });
  });

  it("uses beach preferred_tide fields when building mellow_session conditions", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    await seedDefaultRulesForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      preferredTimeBucket: "dawn",
      notifyEmail: true,
      notifyPush: false,
    });

    const mellowRule = state.insertPayload?.find(
      (row) => row.preset_type === "mellow_session",
    );
    const conditions = mellowRule?.conditions as Record<string, number>;
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.swell_height_min).toBe(1.5);
    expect(conditions.swell_height_max).toBe(4);
    expect(conditions.wind_speed_max_kt).toBe(8);
  });
});
