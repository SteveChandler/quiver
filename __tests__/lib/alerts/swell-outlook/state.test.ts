import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type { OutlookSwell, StoredOutlookList } from "@/lib/services/discovery/swell-outlook-types";
import {
  advanceLists,
  loadSwellOutlookUserState,
  previousListFor,
  recordSwellOpen,
  saveSwellOutlookUserState,
  saveSwellOutlookLists,
  SwellOutlookStateConflictError,
  EMPTY_SWELL_OUTLOOK_USER_STATE,
  type SwellOutlookUserState,
} from "@/lib/alerts/swell-outlook/state";
import { applyOpen, recordSend } from "@/lib/alerts/swell-outlook/engagement";

const USER = "dddddddd-1111-4111-8111-000000000001";
const NOW = new Date("2026-10-04T18:00:00.000Z");
const list = (runDate: string): StoredOutlookList => ({ runDate, swells: [] });
type Row = Record<string, unknown>;
type QueryResult = { data: Row | null; error: { message: string } | null };

interface FakeQueryBuilder {
  select: () => FakeQueryBuilder;
  eq: (key: string, value: unknown) => FakeQueryBuilder;
  update: (value: Row) => FakeQueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
  upsert: (value: Row, options: Row) => Promise<{ error: { message: string } | null }>;
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function populatedList(runDate: string = "2026-10-04", size: number = 4, ids: string[] = ["one"]): StoredOutlookList {
  const swells: OutlookSwell[] = ids.map((id: string): OutlookSwell => ({
    id, eventKey: `${id}:W:2026-10-08:p`, tier: "on_the_radar", status: "forecast", change: "new",
    arrivalAt: "2026-10-08T07:00:00.000Z", peakAt: "2026-10-08T19:00:00.000Z", peakWindow: null,
    faceHeightFt: { min: size - 0.5, max: size + 0.5 }, periodS: 14, directionDeg: 270, directionLabel: "W",
    beach: { id: "home", name: "Home Beach" }, beachCount: 1, notable: false,
    fit: { status: "in_range", boards: ["fish"] }, source: "unknown", stormName: null,
    sizeByOrientation: { southFacing: null, westFacing: { min: size - 0.5, max: size + 0.5 } },
    history: [{ runDate, peakAt: "2026-10-08T19:00:00.000Z", faceHeightFt: size, periodS: 14 }],
  }));
  return { runDate, swells };
}

function reverseKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reverseKeys) as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reverseKeys(entry)])) as T;
}

function rowFor(state: SwellOutlookUserState): Row {
  return {
    user_id: USER, consecutive_unanswered: state.consecutiveUnanswered, last_sent_at: state.lastSentAt,
    paused_since: state.pausedSince, last_answered_at: state.lastAnsweredAt, last_exception_at: state.lastExceptionAt,
    last_first_sighting_at: state.lastFirstSightingAt, outlook_list: state.outlookList, outlook_prev_list: state.outlookPrevList,
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

interface FakeClient {
  client: SupabaseClient<Database>;
  rows: Map<string, Row>;
  updates: Array<{ patch: Row; filters: Row }>;
  upserts: Array<{ row: Row; options: Row }>;
  from: jest.Mock;
  eq: jest.Mock;
  beforeUpdate: ((patch: Row) => Promise<void>) | null;
  bump: () => void;
}

function fakeClient(
  row: Row | null,
  error: { message: string } | null = null,
  writeError: { message: string } | null = null,
): FakeClient {
  const rows = new Map<string, Row>();
  if (row) rows.set(USER, { ...rowFor(EMPTY_SWELL_OUTLOOK_USER_STATE), ...copy(row) });
  const updates: FakeClient["updates"] = [];
  const upserts: FakeClient["upserts"] = [];
  const eq = jest.fn();
  const from = jest.fn(() => {
    const filters: Row = {};
    let patch: Row | null = null;
    const builder: FakeQueryBuilder = {
      select: (): typeof builder => builder,
      eq: (key: string, value: unknown): typeof builder => {
        filters[key] = value;
        eq(key, value);
        return builder;
      },
      update: (value: Row): typeof builder => {
        patch = copy(value);
        return builder;
      },
      maybeSingle: async (): Promise<QueryResult> => {
        if (!patch) {
          const current = rows.get(String(filters.user_id));
          return { data: current ? copy(current) : null, error };
        }
        updates.push({ patch: copy(patch), filters: copy(filters) });
        if (writeError) return { data: null, error: writeError };
        if (fake.beforeUpdate) await fake.beforeUpdate(patch);
        const current = rows.get(String(filters.user_id));
        if (!current || Object.entries(filters).some(([key, value]) => current[key] !== value)) {
          return { data: null, error: null };
        }
        Object.assign(current, patch);
        fake.bump();
        return { data: { user_id: filters.user_id }, error: null };
      },
      upsert: async (value: Row, options: Row): Promise<{ error: { message: string } | null }> => {
        upserts.push({ row: copy(value), options });
        if (writeError) return { error: writeError };
        const userId = String(value.user_id);
        if (!rows.has(userId)) rows.set(userId, { ...rowFor(EMPTY_SWELL_OUTLOOK_USER_STATE), ...copy(value) });
        else if (!options.ignoreDuplicates) Object.assign(rows.get(userId)!, value);
        return { error: null };
      },
    };
    return builder;
  });
  const fake: FakeClient = {
    rows, updates, upserts, from, eq, beforeUpdate: null,
    client: { from } as unknown as SupabaseClient<Database>,
    bump: (): void => {
      const current = rows.get(USER)!;
      current.updated_at = new Date(Date.parse(String(current.updated_at)) + 1).toISOString();
    },
  };
  return fake;
}

function pausedState(): SwellOutlookUserState {
  return {
    ...EMPTY_SWELL_OUTLOOK_USER_STATE, consecutiveUnanswered: 3,
    lastSentAt: "2026-09-18T16:00:00.000Z", pausedSince: "2026-09-20T16:00:00.000Z",
    lastFirstSightingAt: "2026-09-15T18:00:00.000Z",
    outlookList: list("2026-10-03"), outlookPrevList: list("2026-10-02"),
  };
}

function once(fake: FakeClient, action: () => Promise<void>): void {
  fake.beforeUpdate = async (): Promise<void> => {
    fake.beforeUpdate = null;
    await action();
  };
}

describe("list advance", () => {
  it("compares against the previous run's list, not the same run's", () => {
    const state = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: list("2026-10-03"), outlookPrevList: list("2026-10-02") };
    expect(previousListFor(state, "2026-10-04")?.runDate).toBe("2026-10-03");
    expect(previousListFor(state, "2026-10-03")?.runDate).toBe("2026-10-02");
    expect(previousListFor(EMPTY_SWELL_OUTLOOK_USER_STATE, "2026-10-04")).toBeNull();
    expect(previousListFor(state, "2026-10-02")).toBeNull();
    expect(previousListFor(state, "2026-10-01")).toBeNull();
  });

  it("rolls the list forward once per run and is idempotent within a run", () => {
    const state = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: list("2026-10-03"), outlookPrevList: list("2026-10-02") };
    const next = advanceLists(state, list("2026-10-04"));
    expect([next.outlookList?.runDate, next.outlookPrevList?.runDate]).toEqual(["2026-10-04", "2026-10-03"]);
    const again = advanceLists(next, list("2026-10-04"));
    expect([again.outlookList?.runDate, again.outlookPrevList?.runDate]).toEqual(["2026-10-04", "2026-10-03"]);
  });

  it("does not roll lists backwards for an older run", () => {
    const state = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: list("2026-10-04"), outlookPrevList: list("2026-10-03") };
    expect(advanceLists(state, list("2026-10-02"))).toEqual(state);
  });
});

describe("persistence", () => {
  it("reads a row into camelCase state and tolerates a malformed list", async () => {
    const { client, from, eq } = fakeClient({
      user_id: USER, consecutive_unanswered: 2, last_sent_at: "2026-10-01T10:00:00.000Z", paused_since: null,
      last_answered_at: null, last_exception_at: null, last_first_sighting_at: "2026-10-01T10:00:00.000Z",
      outlook_list: { runDate: "2026-10-03", swells: [] }, outlook_prev_list: "garbage",
    });
    expect(await loadSwellOutlookUserState(client, USER)).toMatchObject({
      consecutiveUnanswered: 2, lastFirstSightingAt: "2026-10-01T10:00:00.000Z", outlookList: { runDate: "2026-10-03" }, outlookPrevList: null,
    });
    expect(from).toHaveBeenCalledWith("swell_outlook_user_state");
    expect(eq).toHaveBeenCalledWith("user_id", USER);
  });

  it("returns null without a row and throws on a read error", async () => {
    expect(await loadSwellOutlookUserState(fakeClient(null).client, USER)).toBeNull();
    await expect(loadSwellOutlookUserState(fakeClient(null, { message: "boom" }).client, USER)).rejects.toThrow("boom");
  });

  it("inserts only the user key if absent, then conditionally writes intended snake_case changes", async () => {
    const fake = fakeClient(null);
    await saveSwellOutlookUserState(fake.client, USER, (state) => advanceLists(recordSend(state, NOW, "first_sighting", false), list("2026-10-04")));
    expect(fake.upserts).toEqual([{ row: { user_id: USER }, options: { onConflict: "user_id", ignoreDuplicates: true } }]);
    expect(fake.updates).toEqual([{
      patch: { consecutive_unanswered: 1, last_sent_at: NOW.toISOString(), last_first_sighting_at: NOW.toISOString(), outlook_list: list("2026-10-04") },
      filters: { user_id: USER, updated_at: "2026-10-01T00:00:00.000Z" },
    }]);
    expect(await loadSwellOutlookUserState(fake.client, USER)).toEqual(advanceLists(recordSend(EMPTY_SWELL_OUTLOOK_USER_STATE, NOW, "first_sighting", false), list("2026-10-04")));
  });

  it("throws on a creation error and on a conditional-write error", async () => {
    const transition = (state: SwellOutlookUserState): SwellOutlookUserState => recordSend(state, NOW, "followup", false);
    await expect(saveSwellOutlookUserState(fakeClient(null, null, { message: "create failed" }).client, USER, transition)).rejects.toThrow("create failed");
    await expect(saveSwellOutlookUserState(fakeClient(rowFor(EMPTY_SWELL_OUTLOOK_USER_STATE), null, { message: "write failed" }).client, USER, transition)).rejects.toThrow("write failed");
  });

  it("refuses writes without a comparison token", async () => {
    const fake = fakeClient({ ...rowFor(EMPTY_SWELL_OUTLOOK_USER_STATE), updated_at: null });
    await expect(saveSwellOutlookUserState(fake.client, USER, (state) => recordSend(state, NOW, "followup", false))).rejects.toThrow("missing updated_at");
    expect(fake.updates).toEqual([]);
  });

  it("writes an identical list only once and leaves the comparison token unchanged on repeat", async () => {
    const fake = fakeClient(rowFor(EMPTY_SWELL_OUTLOOK_USER_STATE));
    const outlook = populatedList();
    await saveSwellOutlookLists(fake.client, USER, outlook);
    expect(fake.updates).toHaveLength(1);
    const updatedAt = fake.rows.get(USER)?.updated_at;
    expect(updatedAt).toBe("2026-10-01T00:00:00.001Z");
    fake.beforeUpdate = async (): Promise<void> => fake.bump();
    await expect(saveSwellOutlookLists(fake.client, USER, reverseKeys(copy(outlook)))).resolves.toBeUndefined();
    expect(fake.updates).toHaveLength(1);
    expect(fake.rows.get(USER)?.updated_at).toBe(updatedAt);
  });

  it("compares both list columns by value for general transitions", async () => {
    const initial = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: populatedList(), outlookPrevList: populatedList("2026-10-03") };
    const fake = fakeClient(rowFor(initial));
    const updatedAt = fake.rows.get(USER)?.updated_at;
    await saveSwellOutlookUserState(fake.client, USER, (fresh) => ({
      ...fresh, outlookList: reverseKeys(copy(fresh.outlookList)), outlookPrevList: reverseKeys(copy(fresh.outlookPrevList)),
    }));
    expect(fake.updates).toEqual([]);
    expect(fake.rows.get(USER)?.updated_at).toBe(updatedAt);
    expect(await loadSwellOutlookUserState(fake.client, USER)).toEqual(initial);
  });

  it.each([
    ["a new swell", populatedList("2026-10-04", 4, ["one", "two"])],
    ["a changed size", populatedList("2026-10-04", 5)],
    ["a new run date", populatedList("2026-10-05")],
  ])("writes exactly once for %s", async (_label: string, next: StoredOutlookList) => {
    const initial = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: populatedList() };
    const fake = fakeClient(rowFor(initial));
    await saveSwellOutlookLists(fake.client, USER, next);
    expect(fake.updates).toHaveLength(1);
    expect(fake.rows.get(USER)?.updated_at).toBe("2026-10-01T00:00:00.001Z");
    expect(await loadSwellOutlookUserState(fake.client, USER)).toEqual(advanceLists(initial, next));
    await saveSwellOutlookLists(fake.client, USER, copy(next));
    expect(fake.updates).toHaveLength(1);
    expect(fake.rows.get(USER)?.updated_at).toBe("2026-10-01T00:00:00.001Z");
  });

  it("writes only list columns for a list-only save and ignores an older run", async () => {
    const fake = fakeClient(rowFor(pausedState()));
    await saveSwellOutlookLists(fake.client, USER, list("2026-10-04"));
    expect(fake.updates[0].patch).toEqual({ outlook_list: list("2026-10-04"), outlook_prev_list: list("2026-10-03") });
    const next = await loadSwellOutlookUserState(fake.client, USER);
    expect(next).toEqual(advanceLists(pausedState(), list("2026-10-04")));
    await saveSwellOutlookLists(fake.client, USER, list("2026-10-02"));
    expect(fake.updates).toHaveLength(1);
  });
});

describe("recordSwellOpen", () => {
  it("resets the counter inside 48 h and changes only engagement fields", async () => {
    const fake = fakeClient({ consecutive_unanswered: 2, last_sent_at: "2026-10-03T10:00:00.000Z" });
    await recordSwellOpen(fake.client, USER, NOW);
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0].patch).toEqual({ consecutive_unanswered: 0, last_answered_at: NOW.toISOString() });
    expect(fake.upserts).toEqual([]);
  });

  it("writes nothing for a user with no state row or nothing to change", async () => {
    const none = fakeClient(null);
    await recordSwellOpen(none.client, USER, NOW);
    expect(none.updates).toEqual([]);
    expect(none.upserts).toEqual([]);
    const idle = fakeClient({ consecutive_unanswered: 0 });
    await recordSwellOpen(idle.client, USER, NOW);
    expect(idle.updates).toEqual([]);
  });

  it("leaves a late unanswered push alone before the pause threshold", async () => {
    const fake = fakeClient({ consecutive_unanswered: 2, last_sent_at: "2026-10-01T10:00:00.000Z" });
    await recordSwellOpen(fake.client, USER, NOW);
    expect(fake.updates).toEqual([]);
  });

  it("resumes a lapsed pause and preserves lists without marking the late push answered", async () => {
    const fake = fakeClient({
      consecutive_unanswered: 3, last_sent_at: "2026-10-01T10:00:00.000Z",
      last_answered_at: "2026-09-20T10:00:00.000Z", outlook_list: list("2026-10-04"), outlook_prev_list: list("2026-10-03"),
    });
    await recordSwellOpen(fake.client, USER, NOW);
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0].patch).toEqual({ consecutive_unanswered: 0 });
    expect(fake.rows.get(USER)).toMatchObject({
      paused_since: null, last_answered_at: "2026-09-20T10:00:00.000Z",
      outlook_list: list("2026-10-04"), outlook_prev_list: list("2026-10-03"),
    });
  });
});

describe("concurrent writers", () => {
  it("a no-op list save does not conflict with or disturb a pending sender write", async () => {
    const initial = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: populatedList() };
    const fake = fakeClient(rowFor(initial));
    once(fake, async (): Promise<void> => {
      const updatedAt = fake.rows.get(USER)?.updated_at;
      await saveSwellOutlookLists(fake.client, USER, reverseKeys(copy(initial.outlookList)));
      expect(fake.rows.get(USER)?.updated_at).toBe(updatedAt);
      expect(fake.updates).toHaveLength(1);
    });
    await saveSwellOutlookUserState(fake.client, USER, (fresh) => recordSend(fresh, NOW, "followup", false));
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0].patch).toEqual({ consecutive_unanswered: 1, last_sent_at: NOW.toISOString() });
    expect(await loadSwellOutlookUserState(fake.client, USER)).toEqual(recordSend(initial, NOW, "followup", false));
  });

  it("(a) replays an open after a cron exception send and list advance without erasing the send", async () => {
    const initial = pausedState();
    const fake = fakeClient(rowFor(initial));
    const sendAt = new Date(NOW.getTime() - 3_600_000);
    const send = (state: SwellOutlookUserState): SwellOutlookUserState => advanceLists(recordSend(state, sendAt, "first_sighting", true), list("2026-10-04"));
    once(fake, async () => saveSwellOutlookUserState(fake.client, USER, send));
    await recordSwellOpen(fake.client, USER, NOW);
    const result = await loadSwellOutlookUserState(fake.client, USER);
    expect([applyOpen(send(initial), NOW), send(applyOpen(initial, NOW))]).toContainEqual(result);
    expect(result).toEqual(applyOpen(send(initial), NOW));
    expect(result).toMatchObject({ lastSentAt: sendAt.toISOString(), lastFirstSightingAt: sendAt.toISOString(), lastExceptionAt: sendAt.toISOString() });
    expect(fake.updates).toHaveLength(3);
    expect(fake.updates[0].patch).toEqual({ consecutive_unanswered: 0, paused_since: null });
    expect(fake.updates[2].patch).toEqual({ consecutive_unanswered: 0, paused_since: null, last_answered_at: NOW.toISOString() });
  });

  it("(b) replays a cron send after an open clears a pause without restoring the pause or stale counter", async () => {
    const initial = pausedState();
    const fake = fakeClient(rowFor(initial));
    const send = jest.fn((state: SwellOutlookUserState): SwellOutlookUserState => recordSend(state, NOW, "first_sighting", true));
    once(fake, async () => recordSwellOpen(fake.client, USER, NOW));
    await saveSwellOutlookUserState(fake.client, USER, send);
    const result = await loadSwellOutlookUserState(fake.client, USER);
    const transition = (state: SwellOutlookUserState): SwellOutlookUserState => recordSend(state, NOW, "first_sighting", true);
    expect([applyOpen(transition(initial), NOW), transition(applyOpen(initial, NOW))]).toContainEqual(result);
    expect(result).toEqual(transition(applyOpen(initial, NOW)));
    expect(result).toMatchObject({ consecutiveUnanswered: 1, pausedSince: null, outlookList: initial.outlookList, outlookPrevList: initial.outlookPrevList });
    expect(send).toHaveBeenCalledTimes(2);
    expect(fake.updates).toHaveLength(3);
  });

  it("(c) retries a stale open after a list-only advance and never writes or reverts either list", async () => {
    const initial = { ...pausedState(), consecutiveUnanswered: 2, pausedSince: null, lastSentAt: NOW.toISOString() };
    const fake = fakeClient(rowFor(initial));
    once(fake, async () => saveSwellOutlookLists(fake.client, USER, list("2026-10-04")));
    await recordSwellOpen(fake.client, USER, NOW);
    const result = await loadSwellOutlookUserState(fake.client, USER);
    expect([advanceLists(applyOpen(initial, NOW), list("2026-10-04")), applyOpen(advanceLists(initial, list("2026-10-04")), NOW)]).toContainEqual(result);
    expect(result).toEqual(applyOpen(advanceLists(initial, list("2026-10-04")), NOW));
    expect(fake.updates.map(({ patch }) => Object.keys(patch))).toEqual([
      ["consecutive_unanswered", "last_answered_at"], ["outlook_list", "outlook_prev_list"], ["consecutive_unanswered", "last_answered_at"],
    ]);
  });

  it("stops an open after three conflicts without throwing or overwriting the row", async () => {
    const initial = pausedState();
    const fake = fakeClient(rowFor(initial));
    fake.beforeUpdate = async (): Promise<void> => fake.bump();
    await expect(recordSwellOpen(fake.client, USER, NOW)).resolves.toBeUndefined();
    expect(fake.updates).toHaveLength(3);
    expect(fake.updates.map(({ filters }) => filters.updated_at)).toEqual([
      "2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.001Z", "2026-10-01T00:00:00.002Z",
    ]);
    expect(await loadSwellOutlookUserState(fake.client, USER)).toEqual(initial);
  });

  it("surfaces a typed cron failure after three conflicts, reapplying the same transition each time", async () => {
    const fake = fakeClient(rowFor(EMPTY_SWELL_OUTLOOK_USER_STATE));
    const transition = jest.fn((state: SwellOutlookUserState): SwellOutlookUserState => recordSend(state, NOW, "followup", false));
    fake.beforeUpdate = async (): Promise<void> => fake.bump();
    await expect(saveSwellOutlookUserState(fake.client, USER, transition)).rejects.toBeInstanceOf(SwellOutlookStateConflictError);
    expect(transition).toHaveBeenCalledTimes(3);
    expect(fake.updates).toHaveLength(3);
    expect(await loadSwellOutlookUserState(fake.client, USER)).toEqual(EMPTY_SWELL_OUTLOOK_USER_STATE);
  });

  it("creates one row when two new-user creators race and preserves both transitions", async () => {
    const fake = fakeClient(null);
    const send = (state: SwellOutlookUserState): SwellOutlookUserState => recordSend(state, NOW, "followup", false);
    await Promise.all([saveSwellOutlookUserState(fake.client, USER, send), saveSwellOutlookUserState(fake.client, USER, send)]);
    expect(fake.rows.size).toBe(1);
    expect(fake.upserts).toHaveLength(2);
    expect(fake.upserts.map(({ options }) => options)).toEqual([
      { onConflict: "user_id", ignoreDuplicates: true }, { onConflict: "user_id", ignoreDuplicates: true },
    ]);
    expect(await loadSwellOutlookUserState(fake.client, USER)).toEqual(send(send(EMPTY_SWELL_OUTLOOK_USER_STATE)));
  });
});
