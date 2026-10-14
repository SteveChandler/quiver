/**
 * @jest-environment node
 */

import {
  HOGQL_NOT_BOT,
  HOGQL_NOT_EMULATOR,
  INTERNAL_ANALYTICS_PROFILE_IDS,
  POSTHOG_INTERNAL_COHORT_ID,
  createReadOnlySupabaseFromEnv,
  hogqlInternalPersonExclusion,
  loadProfileExclusions,
  localDate,
  profileExclusionReason,
  readOnlySupabase,
  resolveCompleteDayWindow,
  runHogQL,
  selectAllPages,
} from "@/lib/analytics/report-guards";

describe("profile exclusions", () => {
  it("preserves the internal account reasons and overrides a real-user flag", () => {
    expect([...INTERNAL_ANALYTICS_PROFILE_IDS.values()]).toEqual([
      "founder_primary", "founder_android", "founder_or_maestro", "system_poster",
    ]);
    for (const id of INTERNAL_ANALYTICS_PROFILE_IDS.keys()) {
      expect(profileExclusionReason({ id, analytics_is_real_user: true }, id)).toBe("internal_account");
    }
    expect(profileExclusionReason(
      { id: "73040cff-afe9-4fa0-a874-2016203fc015", analytics_is_real_user: true },
      "73040cff-afe9-4fa0-a874-2016203fc015",
    )).toBe("internal_account");
  });

  it.each([
    [undefined, "missing_profile"],
    [{ id: "user", deleted_at: "2026-01-01T00:00:00Z" }, "deleted_profile"],
    [{ id: "user", is_mock: true }, "mock_profile"],
    [{ id: "user", is_system_account: true }, "system_account"],
    [{ id: "user", analytics_is_real_user: false }, "not_real_user"],
    [{ id: "user", analytics_is_real_user: true }, null],
  ] as const)("classifies profile %#", (profile, expected) => {
    expect(profileExclusionReason(profile, "user")).toBe(expected);
  });

  it("loads profiles in chunks of 200 and marks absent rows missing", async () => {
    const ids = Array.from({ length: 201 }, (_, index) => `user-${index}`);
    const inQuery = jest.fn(async (_column: string, chunk: string[]) => ({
      data: chunk.filter((id) => id !== "user-200").map((id) => ({ id })),
      error: null,
    }));
    const select = jest.fn(() => ({
      in: inQuery,
    }));
    const from = jest.fn(() => ({ select }));
    const results = await loadProfileExclusions(readOnlySupabase({ from }), ids);
    expect(from).toHaveBeenCalledTimes(2);
    expect(select).toHaveBeenCalledWith("id,deleted_at,is_mock,is_system_account,analytics_is_real_user");
    expect(inQuery.mock.calls).toEqual([
      ["id", ids.slice(0, 200)],
      ["id", ids.slice(200)],
    ]);
    expect(results.get("user-0")).toBeNull();
    expect(results.get("user-200")).toBe("missing_profile");
  });

  it("keeps internal IDs excluded even without a profile row and propagates query errors", async () => {
    const id = "73040cff-afe9-4fa0-a874-2016203fc015";
    const absent = readOnlySupabase({ from: () => ({ select: () => ({
      in: async () => ({ data: [], error: null }),
    }) }) });
    expect((await loadProfileExclusions(absent, [id])).get(id)).toBe("internal_account");
    const failing = readOnlySupabase({ from: () => ({ select: () => ({
      in: async () => ({ data: null, error: { message: "profile lookup failed" } }),
    }) }) });
    await expect(loadProfileExclusions(failing, ["user"])).rejects.toThrow("profile lookup failed");
  });
});

describe("read-only Supabase", () => {
  it("passes select chains through to the underlying client", () => {
    const eq = jest.fn().mockReturnValue("query result");
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    const client = readOnlySupabase({ from });
    expect(client.from("profiles").select("id").eq("id", "user")).toBe("query result");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("id", "user");
  });

  it("rejects mutation and service surfaces before touching the underlying client", () => {
    const insert = jest.fn();
    const update = jest.fn();
    const upsert = jest.fn();
    const remove = jest.fn();
    const rpc = jest.fn();
    const channel = jest.fn();
    const schema = jest.fn();
    const from = jest.fn(() => ({ insert, update, upsert, delete: remove }));
    const underlying = { from, rpc, channel, schema, storage: {}, functions: {} };
    const client = readOnlySupabase(underlying);
    const table = client.from("profiles") as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const method of ["insert", "update", "upsert", "delete"]) {
      expect(() => table[method]({ id: "user" })).toThrow("read-only");
    }
    const services = client as unknown as Record<string, unknown>;
    for (const property of ["rpc", "storage", "functions", "channel", "schema"]) {
      expect(() => services[property]).toThrow("read-only");
    }
    expect(from).not.toHaveBeenCalled();
    for (const method of [insert, update, upsert, remove, rpc, channel, schema]) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it("requires Supabase env vars before constructing a client", () => {
    expect(() => createReadOnlySupabaseFromEnv({ NODE_ENV: "test" })).toThrow("SUPABASE_URL");
    expect(() => createReadOnlySupabaseFromEnv({ NODE_ENV: "test", SUPABASE_URL: "https://example.supabase.co" }))
      .toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});

describe("selectAllPages", () => {
  it("creates a fresh query for each range and stops after a short page", async () => {
    const range = jest.fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3], error: null });
    const makeQuery = jest.fn(() => ({ range }));
    await expect(selectAllPages<number>(makeQuery, 2)).resolves.toEqual([1, 2, 3]);
    expect(makeQuery).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(1, 0, 1);
    expect(range).toHaveBeenNthCalledWith(2, 2, 3);
  });

  it("throws a query error", async () => {
    await expect(selectAllPages(() => ({ range: async () => ({
      data: null, error: { message: "read failed" },
    }) }))).rejects.toThrow("read failed");
  });
});

describe("complete local days", () => {
  it("defaults to seven days ending at today's Los Angeles midnight", () => {
    const window = resolveCompleteDayWindow({ now: new Date("2026-10-14T15:00:00Z") });
    expect(window).toEqual({
      start: new Date("2026-10-07T07:00:00Z"),
      end: new Date("2026-10-14T07:00:00Z"),
      timeZone: "America/Los_Angeles",
      startDate: "2026-10-07",
      endDate: "2026-10-14",
      days: 7,
    });
  });

  it("uses explicit exclusive end dates", () => {
    const window = resolveCompleteDayWindow({
      startDate: "2026-06-01", endDate: "2026-06-04", timeZone: "UTC",
    });
    expect(window.start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-06-04T00:00:00.000Z");
    expect(window.days).toBe(3);
    expect(localDate(new Date("2026-06-03T23:00:00Z"), "UTC")).toBe("2026-06-03");
  });

  it("resolves the November 2026 DST change using each local midnight", () => {
    const window = resolveCompleteDayWindow({
      startDate: "2026-10-31", endDate: "2026-11-02", timeZone: "America/Los_Angeles",
    });
    expect(window.start.toISOString()).toBe("2026-10-31T07:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect(window.days).toBe(2);
  });
});

describe("HogQL guards", () => {
  it("excludes the internal cohort and every internal distinct ID", () => {
    const clause = hogqlInternalPersonExclusion("e.person_id");
    expect(clause).toContain(`e.person_id NOT IN COHORT ${POSTHOG_INTERNAL_COHORT_ID}`);
    expect(clause).toContain("e.person_id NOT IN (SELECT person_id FROM person_distinct_ids");
    for (const id of INTERNAL_ANALYTICS_PROFILE_IDS.keys()) expect(clause).toContain(`'${id}'`);
    expect(hogqlInternalPersonExclusion()).toContain("person_id NOT IN COHORT");
    expect(HOGQL_NOT_BOT).toBe("NOT coalesce(properties.$virt_is_bot, false)");
    expect(HOGQL_NOT_EMULATOR).toBe("coalesce(properties.$is_emulator, false) = false");
  });

  it("rejects unbounded queries without making a request", async () => {
    const fetchImpl = jest.fn();
    for (const query of [
      "SELECT * FROM events",
      "SELECT 'LIMIT 10' FROM events",
      "SELECT * FROM events -- LIMIT 10",
    ]) {
      await expect(runHogQL(query, {
        env: { NODE_ENV: "test", POSTHOG_API_KEY: "secret" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })).rejects.toThrow("LIMIT");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries a 503 and returns the query result", async () => {
    const query = "SELECT event FROM events LIMIT 10";
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: { get: () => null } })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ columns: ["event"], results: [["session_created"]] }),
      });
    const sleep = jest.fn(async (_ms: number) => undefined);
    await expect(runHogQL(query, {
      env: { NODE_ENV: "test", POSTHOG_API_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    })).resolves.toEqual({ columns: ["event"], results: [["session_created"]] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith("https://us.posthog.com/api/projects/424662/query/", {
      method: "POST",
      headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });
    expect(sleep).toHaveBeenCalledWith(1000);
  });
});
