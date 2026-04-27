import { seedDefaultRuleForUser } from "@/lib/alerts/seed-default-rule";
import type { SupabaseServerClient } from "@/types/supabase";

type BeachRow = {
  id: string;
  name: string;
  slug: string | null;
  lat: number;
  lon: number;
  timezone: string | null;
  wind_offshore_deg: number | null;
  wind_offshore_tol_deg: number | null;
  aspect_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  preferred_tide_direction: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
};

interface MockState {
  existingRuleCount: number;
  countError: { message: string } | null;
  beachRow: BeachRow | null;
  beachError: { message: string } | null;
  insertError: { message: string } | null;
  insertedId: string;
  insertPayload: Record<string, unknown> | null;
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
            // Insert path uses .select("id").single()
            return {
              single: () =>
                Promise.resolve({
                  data: state.insertError ? null : { id: state.insertedId },
                  error: state.insertError,
                }),
            };
          },
          insert: (payload: Record<string, unknown>) => {
            state.insertPayload = payload;
            return {
              select: (_cols: string) => ({
                single: () =>
                  Promise.resolve({
                    data: state.insertError ? null : { id: state.insertedId },
                    error: state.insertError,
                  }),
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
    },
    beachError: null,
    insertError: null,
    insertedId: "rule-abc",
    insertPayload: null,
    selectedBeachColumns: null,
    ...overrides,
  };
}

describe("seedDefaultRuleForUser", () => {
  it("returns no_experience_level when level is null", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: null,
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({ seeded: false, reason: "no_experience_level" });
    expect(state.insertPayload).toBeNull();
  });

  it("returns no_experience_level when level is undefined", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: undefined,
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({ seeded: false, reason: "no_experience_level" });
  });

  it("inserts mellow_session for beginner", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({
      seeded: true,
      ruleId: "rule-abc",
      presetType: "mellow_session",
    });
    expect(state.insertPayload).toMatchObject({
      user_id: "user-1",
      beach_id: "beach-123",
      preset_type: "mellow_session",
      name: "Mellow session at your home break",
      enabled: true,
    });
  });

  it("inserts mellow_session for intermediate", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "intermediate",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toMatchObject({
      seeded: true,
      presetType: "mellow_session",
    });
    expect(state.insertPayload?.preset_type).toBe("mellow_session");
  });

  it("inserts clean_groundswell for advanced", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "advanced",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toMatchObject({
      seeded: true,
      presetType: "clean_groundswell",
    });
    expect(state.insertPayload).toMatchObject({
      preset_type: "clean_groundswell",
      name: "Clean groundswell at your home break",
    });
  });

  it("inserts clean_groundswell for expert", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "expert",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toMatchObject({
      seeded: true,
      presetType: "clean_groundswell",
    });
    expect(state.insertPayload?.preset_type).toBe("clean_groundswell");
  });

  it("returns already_has_rules when user has any existing rule", async () => {
    const state = baseState({ existingRuleCount: 1 });
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({ seeded: false, reason: "already_has_rules" });
    expect(state.insertPayload).toBeNull();
  });

  it("returns beach_not_found when the beach row is missing", async () => {
    const state = baseState({ beachRow: null });
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-missing",
      experienceLevel: "beginner",
      notifyEmail: true,
      notifyPush: false,
    });

    expect(result).toEqual({ seeded: false, reason: "beach_not_found" });
    expect(state.insertPayload).toBeNull();
  });

  it("passes notify_email and notify_push through to the insert payload", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      notifyEmail: false,
      notifyPush: true,
    });

    expect(state.insertPayload).toMatchObject({
      notify_email: false,
      notify_push: true,
    });
  });

  it("returns error reason with message on insert failure", async () => {
    const state = baseState({
      insertError: { message: "constraint violation" },
    });
    const supabase = makeMockSupabase(state);

    const result = await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
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

    await seedDefaultRuleForUser({
      supabase,
      userId: "user-1",
      beachId: "beach-123",
      experienceLevel: "beginner",
      notifyEmail: true,
      notifyPush: false,
    });

    const conditions = state.insertPayload?.conditions as Record<string, number>;
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.swell_height_min).toBe(1.5);
    expect(conditions.swell_height_max).toBe(4);
    expect(conditions.wind_speed_max_kt).toBe(8);
  });
});
