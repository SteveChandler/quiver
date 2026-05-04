import { ensureSimilarityRuleForUser } from "@/lib/alerts/auto-enable-similarity";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

interface MockState {
  homeBeachId: string | null;
  profileError: { message: string } | null;
  existingSimilarityCount: number;
  countError: { message: string } | null;
  insertError: { message: string } | null;
  insertPayload: Record<string, unknown> | null;
}

function makeMockSupabase(state: MockState): SupabaseClient<Database> {
  const mock = {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: state.profileError
                    ? null
                    : { home_beach_id: state.homeBeachId },
                  error: state.profileError,
                }),
            }),
          }),
        };
      }

      if (table === "alert_rules") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact" && opts.head === true) {
              return {
                eq: (_col1: string, _val1: string) => ({
                  eq: (_col2: string, _val2: string) =>
                    Promise.resolve({
                      data: null,
                      count: state.existingSimilarityCount,
                      error: state.countError,
                    }),
                }),
              };
            }
            return {};
          },
          insert: (payload: Record<string, unknown>) => {
            state.insertPayload = payload;
            return Promise.resolve({
              data: null,
              error: state.insertError,
            });
          },
        };
      }

      return {};
    },
  };

  return mock as unknown as SupabaseClient<Database>;
}

function baseState(overrides: Partial<MockState> = {}): MockState {
  return {
    homeBeachId: "beach-123",
    profileError: null,
    existingSimilarityCount: 0,
    countError: null,
    insertError: null,
    insertPayload: null,
    ...overrides,
  };
}

describe("ensureSimilarityRuleForUser", () => {
  it("returns no_home_beach when the user has no home_beach_id", async () => {
    const state = baseState({ homeBeachId: null });
    const supabase = makeMockSupabase(state);

    const result = await ensureSimilarityRuleForUser(supabase, "user-1");

    expect(result).toEqual({ created: false, reason: "no_home_beach" });
    expect(state.insertPayload).toBeNull();
  });

  it("inserts a rule when the user has a home beach and no existing similarity rule", async () => {
    const state = baseState();
    const supabase = makeMockSupabase(state);

    const result = await ensureSimilarityRuleForUser(supabase, "user-1");

    expect(result).toEqual({ created: true });
    expect(state.insertPayload).toMatchObject({
      user_id: "user-1",
      beach_id: "beach-123",
      preset_type: "similarity_match",
      name: "Conditions like your best sessions",
      enabled: true,
      notify_push: true,
      notify_email: false,
      conditions: {},
    });
    expect(state.insertPayload?.auto_created_at).toBeDefined();
  });

  it("returns already_exists when the user already has any similarity_match row", async () => {
    const state = baseState({ existingSimilarityCount: 1 });
    const supabase = makeMockSupabase(state);

    const result = await ensureSimilarityRuleForUser(supabase, "user-1");

    expect(result).toEqual({ created: false, reason: "already_exists" });
    expect(state.insertPayload).toBeNull();
  });

  it("returns insert_failed without throwing when the insert errors", async () => {
    const state = baseState({
      insertError: { message: "constraint violation" },
    });
    const supabase = makeMockSupabase(state);

    const result = await ensureSimilarityRuleForUser(supabase, "user-1");

    expect(result).toEqual({
      created: false,
      reason: "insert_failed",
      error: "constraint violation",
    });
  });
});
