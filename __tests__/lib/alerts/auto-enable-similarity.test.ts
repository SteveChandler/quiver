import { ensureSimilarityRuleForUser } from "@/lib/alerts/auto-enable-similarity";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

interface MockState {
  homeBeachId: string | null;
  profileError: { message: string } | null;
  existingSimilarityCount: number;
  countError: { message: string } | null;
  sessions: Array<{
    id: string;
    user_id: string;
    status: string | null;
    rating: number | null;
    deleted_at: string | null;
  }>;
  sessionsError: { message: string } | null;
  snapshots: Array<{
    session_id: string;
    forecast_snapshot: unknown | null;
  }>;
  snapshotsError: { message: string } | null;
  insertError: { message: string } | null;
  insertPayload: Record<string, unknown> | null;
}

function signalForUser(userId: string, ratings: number[]) {
  return {
    sessions: ratings.map((rating, idx) => ({
      id: `session-${idx + 1}`,
      user_id: userId,
      status: "completed",
      rating,
      deleted_at: null,
    })),
    snapshots: ratings.map((_rating, idx) => ({
      session_id: `session-${idx + 1}`,
      forecast_snapshot: { wave_height: "3 ft" },
    })),
  };
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

      if (table === "sessions") {
        const filters = {
          eq: {} as Record<string, unknown>,
          gte: {} as Record<string, number>,
          notNull: new Set<string>(),
          isNull: new Set<string>(),
        };
        const chain: any = {
          select: (_cols: string, _opts?: { count?: string; head?: boolean }) => chain,
          eq: (col: string, val: unknown) => {
            filters.eq[col] = val;
            return chain;
          },
          gte: (col: string, val: number) => {
            filters.gte[col] = val;
            return chain;
          },
          not: (col: string, op: string, val: unknown) => {
            if (op === "is" && val === null) filters.notNull.add(col);
            return chain;
          },
          is: (col: string, val: unknown) => {
            if (val === null) filters.isNull.add(col);
            return chain;
          },
          then: (resolve: (value: unknown) => unknown) => {
            const sessionIdsWithSnapshots = new Set(
              state.snapshots
                .filter((snapshot) => snapshot.forecast_snapshot != null)
                .map((snapshot) => snapshot.session_id),
            );
            const rows = state.sessions.filter((row) => {
              for (const [col, val] of Object.entries(filters.eq)) {
                if ((row as Record<string, unknown>)[col] !== val) return false;
              }
              for (const [col, val] of Object.entries(filters.gte)) {
                const candidate = (row as Record<string, unknown>)[col];
                if (typeof candidate !== "number" || candidate < val) return false;
              }
              for (const col of filters.notNull) {
                if (col === "session_forecast_snapshots.forecast_snapshot") {
                  if (!sessionIdsWithSnapshots.has(row.id)) return false;
                  continue;
                }
                if ((row as Record<string, unknown>)[col] == null) return false;
              }
              for (const col of filters.isNull) {
                if ((row as Record<string, unknown>)[col] !== null) return false;
              }
              return true;
            });
            return resolve({
              data: rows,
              count: rows.length,
              error: state.sessionsError ?? state.snapshotsError,
            });
          },
        };
        return chain;
      }

      if (table === "session_forecast_snapshots") {
        const filters = {
          in: {} as Record<string, unknown[]>,
          notNull: new Set<string>(),
        };
        const chain: any = {
          select: (_cols: string) => chain,
          in: (col: string, vals: unknown[]) => {
            filters.in[col] = vals;
            return chain;
          },
          not: (col: string, op: string, val: unknown) => {
            if (op === "is" && val === null) filters.notNull.add(col);
            return chain;
          },
          then: (resolve: (value: unknown) => unknown) => {
            const rows = state.snapshots.filter((row) => {
              for (const [col, vals] of Object.entries(filters.in)) {
                if (!vals.includes((row as Record<string, unknown>)[col])) return false;
              }
              for (const col of filters.notNull) {
                if ((row as Record<string, unknown>)[col] == null) return false;
              }
              return true;
            });
            return resolve({ data: rows, error: state.snapshotsError });
          },
        };
        return chain;
      }

      return {};
    },
  };

  return mock as unknown as SupabaseClient<Database>;
}

function baseState(overrides: Partial<MockState> = {}): MockState {
  const signal = signalForUser("user-1", [5, 4, 4, 3, 2]);
  return {
    homeBeachId: "beach-123",
    profileError: null,
    existingSimilarityCount: 0,
    countError: null,
    sessions: signal.sessions,
    sessionsError: null,
    snapshots: signal.snapshots,
    snapshotsError: null,
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
    expect(typeof state.insertPayload?.auto_created_at).toBe("string");
  });

  it("returns insufficient_signal with fewer than 5 completed rated sessions with snapshots", async () => {
    const signal = signalForUser("user-1", [5, 4, 3, 2]);
    const state = baseState(signal);
    const supabase = makeMockSupabase(state);

    const result = await ensureSimilarityRuleForUser(supabase, "user-1");

    expect(result).toEqual({ created: false, reason: "insufficient_signal" });
    expect(state.insertPayload).toBeNull();
  });

  it("returns insufficient_signal with fewer than 3 positive rated sessions with snapshots", async () => {
    const signal = signalForUser("user-1", [5, 4, 3, 3, 2]);
    const state = baseState(signal);
    const supabase = makeMockSupabase(state);

    const result = await ensureSimilarityRuleForUser(supabase, "user-1");

    expect(result).toEqual({ created: false, reason: "insufficient_signal" });
    expect(state.insertPayload).toBeNull();
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
