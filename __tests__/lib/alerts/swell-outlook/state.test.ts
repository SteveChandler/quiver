import {
  advanceLists,
  loadSwellOutlookUserState,
  previousListFor,
  recordSwellOpen,
  saveSwellOutlookUserState,
  EMPTY_SWELL_OUTLOOK_USER_STATE,
} from "@/lib/alerts/swell-outlook/state";
import type { StoredOutlookList } from "@/lib/services/discovery/swell-outlook-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

const USER = "dddddddd-1111-4111-8111-000000000001";
const list = (runDate: string): StoredOutlookList => ({ runDate, swells: [] });

interface FakeClient {
  upserts: Array<{ row: Record<string, unknown>; options: unknown }>;
  client: SupabaseClient<Database>;
  from: jest.Mock;
  eq: jest.Mock;
}

function fakeClient(
  row: Record<string, unknown> | null,
  error: { message: string } | null = null,
  writeError: { message: string } | null = null,
): FakeClient {
  const upserts: Array<{ row: Record<string, unknown>; options: unknown }> = [];
  const eq = jest.fn(() => builder);
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq,
    maybeSingle: () => Promise.resolve({ data: row, error }),
    upsert: (value: Record<string, unknown>, options: unknown) => {
      upserts.push({ row: value, options });
      return Promise.resolve({ error: writeError });
    },
  };
  const from = jest.fn(() => builder);
  return { upserts, client: { from } as unknown as SupabaseClient<Database>, from, eq };
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

  it("upserts one row per user in snake_case", async () => {
    const { client, upserts } = fakeClient(null);
    await saveSwellOutlookUserState(client, USER, { ...EMPTY_SWELL_OUTLOOK_USER_STATE, consecutiveUnanswered: 1, outlookList: list("2026-10-04") });
    expect(upserts[0].options).toEqual({ onConflict: "user_id" });
    expect(upserts[0].row).toMatchObject({ user_id: USER, consecutive_unanswered: 1, outlook_list: { runDate: "2026-10-04" }, paused_since: null });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row).toEqual({
      user_id: USER, consecutive_unanswered: 1, last_sent_at: null, paused_since: null,
      last_answered_at: null, last_exception_at: null, last_first_sighting_at: null,
      outlook_list: list("2026-10-04"), outlook_prev_list: null, updated_at: expect.any(String),
    });
  });

  it("throws on a write error", async () => {
    const { client } = fakeClient(null, null, { message: "write failed" });
    await expect(saveSwellOutlookUserState(client, USER, EMPTY_SWELL_OUTLOOK_USER_STATE)).rejects.toThrow("write failed");
  });
});

describe("recordSwellOpen", () => {
  const now = new Date("2026-10-04T18:00:00.000Z");

  it("resets the counter for an open inside 48 h of a send", async () => {
    const { client, upserts } = fakeClient({ user_id: USER, consecutive_unanswered: 2, last_sent_at: "2026-10-03T10:00:00.000Z" });
    await recordSwellOpen(client, USER, now);
    expect(upserts[0].row).toMatchObject({ consecutive_unanswered: 0, last_answered_at: now.toISOString() });
  });

  it("writes nothing for a user with no state row or nothing to change", async () => {
    const none = fakeClient(null);
    await recordSwellOpen(none.client, USER, now);
    expect(none.upserts).toEqual([]);
    const idle = fakeClient({ user_id: USER, consecutive_unanswered: 0 });
    await recordSwellOpen(idle.client, USER, now);
    expect(idle.upserts).toEqual([]);
  });

  it("leaves a late unanswered push alone before the pause threshold", async () => {
    const { client, upserts } = fakeClient({ consecutive_unanswered: 2, last_sent_at: "2026-10-01T10:00:00.000Z" });
    await recordSwellOpen(client, USER, now);
    expect(upserts).toEqual([]);
  });

  it("resumes a lapsed pause and preserves lists without marking the late push answered", async () => {
    const { client, upserts } = fakeClient({
      consecutive_unanswered: 3, last_sent_at: "2026-10-01T10:00:00.000Z",
      last_answered_at: "2026-09-20T10:00:00.000Z", outlook_list: list("2026-10-04"), outlook_prev_list: list("2026-10-03"),
    });
    await recordSwellOpen(client, USER, now);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row).toMatchObject({
      consecutive_unanswered: 0, paused_since: null, last_answered_at: "2026-09-20T10:00:00.000Z",
      outlook_list: list("2026-10-04"), outlook_prev_list: list("2026-10-03"),
    });
  });
});
