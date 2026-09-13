export {};

/**
 * Bracket route for the surf game: anonymous scores are appended with initials, a signed-in player keeps one
 * row that only a personal best replaces, and both get the top ten back with a rank.
 */

type Row = { id: string; user_id: string | null; initials: string; score: number; break_slug: string; created_at: string };
let rows: Row[] = [];
let mockAuthUser: { id: string } | null = null;
const inserted: Array<Record<string, unknown>> = [];
const updated: Array<{ id: string; patch: Record<string, unknown> }> = [];

/** A tiny in-memory stand-in for the PostgREST builder, covering only the calls the route makes. */
function builder() {
  const state: { filters: Array<(row: Row) => boolean>; head: boolean; count: boolean; orders: Array<[keyof Row, boolean]>; limit: number | null } = { filters: [], head: false, count: false, orders: [], limit: null };
  const api: any = {
    select: (_columns: string, options?: { count?: string; head?: boolean }) => { state.head = options?.head === true; state.count = options?.count === "exact"; return api; },
    eq: (column: keyof Row, value: unknown) => { state.filters.push((row) => row[column] === value); return api; },
    gt: (column: keyof Row, value: number) => { state.filters.push((row) => (row[column] as number) > value); return api; },
    order: (column: keyof Row, options: { ascending: boolean }) => { state.orders.push([column, options.ascending]); return api; },
    limit: (n: number) => { state.limit = n; return api; },
    insert: async (record: Record<string, unknown>) => { inserted.push(record); rows.push({ id: `row-${rows.length + 1}`, created_at: new Date(2026, 8, 13, 12, rows.length).toISOString(), ...(record as Omit<Row, "id" | "created_at">) }); return { error: null }; },
    update: (patch: Record<string, unknown>) => ({ eq: async (_column: string, id: string) => { updated.push({ id, patch }); const row = rows.find((r) => r.id === id); if (row) Object.assign(row, patch); return { error: null }; } }),
    maybeSingle: async () => { const matches = filtered(); return { data: matches[0] ?? null, error: null }; },
    then: (resolve: (value: unknown) => void) => {
      const matches = filtered();
      if (state.head) return resolve({ data: null, count: matches.length, error: null });
      return resolve({ data: state.limit ? matches.slice(0, state.limit) : matches, error: null });
    },
  };
  function filtered(): Row[] {
    let matches = rows.filter((row) => state.filters.every((f) => f(row)));
    for (const [column, ascending] of [...state.orders].reverse()) {
      matches = [...matches].sort((a, b) => (a[column]! < b[column]! ? -1 : a[column]! > b[column]! ? 1 : 0) * (ascending ? 1 : -1));
    }
    return matches;
  }
  return api;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({ from: () => builder() })),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: any) => (request: any) => handler(request, { user: mockAuthUser, params: {}, supabase: {} }),
  withBotBlockingAndRateLimit: (handler: any) => handler,
  withErrorHandler: (handler: any) => handler,
}));

jest.mock("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) },
}));

import { GET, POST } from "@/app/api/surf-game/scores/route";

function post(body: unknown) {
  return POST({ json: async () => body } as any, {} as any);
}

function get(limit?: number) {
  return GET({ nextUrl: { searchParams: new URLSearchParams(limit ? { limit: String(limit) } : {}) } } as any, {} as any);
}

describe("surf game scores", () => {
  beforeEach(() => {
    rows = [
      { id: "a", user_id: null, initials: "ACE", score: 9000, break_slug: "pier", created_at: "2026-09-13T10:00:00Z" },
      { id: "b", user_id: "user-1", initials: "STV", score: 6000, break_slug: "trestles", created_at: "2026-09-13T10:01:00Z" },
      { id: "c", user_id: null, initials: "ZED", score: 3000, break_slug: "hawaii", created_at: "2026-09-13T10:02:00Z" },
    ];
    inserted.length = 0;
    updated.length = 0;
    mockAuthUser = null;
  });

  it("rejects bad initials and out-of-range scores", async () => {
    expect((await (await post({ score: 100, initials: "toolong", break: "pier" })).json())).toEqual({ success: false, error: "invalid_initials" });
    expect((await (await post({ score: -1, initials: "AB", break: "pier" })).json())).toEqual({ success: false, error: "invalid_input" });
    expect((await (await post({ score: 100, initials: "AB", break: "Not A Slug" })).json())).toEqual({ success: false, error: "invalid_input" });
    expect(inserted).toHaveLength(0);
  });

  it("appends an anonymous score with uppercased initials and returns its rank in the bracket", async () => {
    const body = await (await post({ score: 7000, initials: "jo", break: "ocnj", waves: 2, barrels: 1 })).json();
    expect(inserted).toEqual([{ user_id: null, score: 7000, initials: "JO", break_slug: "ocnj", waves: 2, barrels: 1 }]);
    expect(body.success).toBe(true);
    expect(body.kept).toBe(true);
    expect(body.rank).toBe(2);
    expect(body.entries.map((e: any) => [e.rank, e.initials, e.score])).toEqual([[1, "ACE", 9000], [2, "JO", 7000], [3, "STV", 6000], [4, "ZED", 3000]]);
  });

  it("keeps one row per signed-in player and only a personal best replaces it", async () => {
    mockAuthUser = { id: "user-1" };
    const lower = await (await post({ score: 5000, initials: "STV", break: "pier" })).json();
    expect(lower.kept).toBe(false);
    expect(updated).toHaveLength(0);
    expect(inserted).toHaveLength(0);

    const higher = await (await post({ score: 9500, initials: "STV", break: "kdh" })).json();
    expect(higher.kept).toBe(true);
    expect(higher.rank).toBe(1);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe("b");
    expect(updated[0].patch).toMatchObject({ score: 9500, break_slug: "kdh" });
    expect(higher.entries[0]).toMatchObject({ rank: 1, initials: "STV", score: 9500, you: true });
    expect(higher.entries[1]).toMatchObject({ rank: 2, initials: "ACE", you: false });
  });

  it("inserts a first row for a signed-in player without one", async () => {
    mockAuthUser = { id: "user-2" };
    const body = await (await post({ score: 100, initials: "NEW", break: "pier" })).json();
    expect(inserted).toEqual([{ user_id: "user-2", score: 100, initials: "NEW", break_slug: "pier", waves: 0, barrels: 0 }]);
    expect(body.rank).toBe(4);
  });

  it("returns the bracket with no personal line for anonymous readers", async () => {
    const body = await (await get()).json();
    expect(body.success).toBe(true);
    expect(body.you).toBeNull();
    expect(body.entries.map((e: any) => e.initials)).toEqual(["ACE", "STV", "ZED"]);
    expect(body.entries.every((e: any) => e.you === false)).toBe(true);
  });

  it("marks the signed-in player's row and reports their best and rank", async () => {
    mockAuthUser = { id: "user-1" };
    const body = await (await get(2)).json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[1]).toMatchObject({ initials: "STV", you: true });
    expect(body.you).toEqual({ best: 6000, rank: 2, initials: "STV" });
  });
});
