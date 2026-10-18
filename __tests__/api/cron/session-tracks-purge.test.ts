/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

type Row = Record<string, string | null>;
type Table = "session_tracks" | "session_imports" | "session_waves" | "session_wave_corrections" | "watch_uploads" | "watch_link_codes";
type Order = { column: string; ascending: boolean; nullsFirst: boolean };

const mockRows: Record<Table, Row[]> = {
  session_tracks: [],
  session_imports: [],
  session_waves: [],
  session_wave_corrections: [],
  watch_uploads: [],
  watch_link_codes: [],
};
const mockList = jest.fn();
let mockMissingWatchTables = false;
const mockSessions: Record<string, string | null> = {};
const mockEvents: string[] = [];
const mockSelections: Array<{ table: Table; orders: Order[] }> = [];
const mockRemove = jest.fn(async (paths: string[]) => {
  mockEvents.push(`storage:${paths[0]}`);
  return { data: [], error: null as { message: string } | null };
});
let mockSelectError: { code: string; message: string } | null = null;
const mockOutcome = jest.fn((_options: unknown, run: () => Promise<unknown>) => run());
const mockValidateCronRequest = jest.fn(() => true);

function mockQuery(table: Table) {
  let action: "select" | "delete" = "select";
  const filters: Array<(row: Row) => boolean> = [];
  const orders: Order[] = [];
  let columns = "";
  let max = Infinity;
  const query = {
    select: (value: string) => { columns = value; return query; },
    delete: () => { action = "delete"; return query; },
    eq: (column: string, value: string) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    is: (column: string, value: null) => { filters.push((row) => row[column] === value); return query; },
    not: (column: string, _operator: string, _value: null) => {
      filters.push((row) => row[column] !== null);
      return query;
    },
    in: (column: string, values: string[]) => {
      filters.push((row) => values.includes(row[column] ?? ""));
      return query;
    },
    lt: (column: string, value: string) => {
      filters.push((row) => {
        const actual = column === "sessions.deleted_at"
          ? mockSessions[row.session_id ?? ""]
          : row[column];
        return actual != null && actual < value;
      });
      return query;
    },
    order: (column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) => {
      orders.push({ column, ascending: options.ascending ?? true, nullsFirst: options.nullsFirst ?? false });
      return query;
    },
    limit: (value: number) => { max = value; return query; },
    then: (resolve: (value: { data: object[] | null; error: { code: string; message: string } | null }) => unknown) => {
      if (mockMissingWatchTables && table.startsWith("watch_")) return Promise.resolve(resolve({ data: null, error: { code: "42P01", message: "missing table" } }));
      if (mockSelectError) { const error = mockSelectError; mockSelectError = null; return Promise.resolve(resolve({ data: null, error })); }
      const matching = mockRows[table].filter((row) => filters.every((filter) => filter(row)));
      if (action === "delete") {
        if (table !== "watch_link_codes" || matching.length > 0) mockEvents.push(`delete:${table}:${matching.map((row) => row.session_id ?? row.id).join(",")}`);
        mockRows[table] = mockRows[table].filter((row) => !matching.includes(row));
        if (table === "session_imports") {
          for (const track of mockRows.session_tracks) {
            if (matching.some((row) => row.id === track.import_id)) track.import_id = null;
          }
        }
      } else {
        mockSelections.push({ table, orders: [...orders] });
        matching.sort((left, right) => {
          for (const order of orders) {
            const a = left[order.column];
            const b = right[order.column];
            if (a === b) continue;
            if (a == null) return order.nullsFirst ? -1 : 1;
            if (b == null) return order.nullsFirst ? 1 : -1;
            return (a < b ? -1 : 1) * (order.ascending ? 1 : -1);
          }
          return 0;
        });
      }
      const data = matching.slice(0, max).map((row) => columns.includes("sessions")
        ? { ...row, sessions: row.session_id ? { deleted_at: mockSessions[row.session_id] ?? null } : null }
        : { ...row });
      return Promise.resolve(resolve({ data, error: null }));
    },
  };
  return query;
}

const mockClient = {
  from: (table: Table) => mockQuery(table),
  storage: { from: (_bucket: string) => ({ remove: mockRemove, list: mockList }) },
};

jest.mock("@/lib/cron/observability", () => ({ withObservedCron: (_route: string, handler: unknown) => handler }));
jest.mock("@/lib/cron/outcome", () => ({ withCronOutcome: (...args: Parameters<typeof mockOutcome>) => mockOutcome(...args) }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: mockValidateCronRequest,
  createSuccessResponse: (data: unknown) => Response.json({ success: true, data }),
  createErrorResponse: (error: string, details: string, status: number) => Response.json({ success: false, error, details }, { status }),
  handleApiError: (error: unknown) => Response.json({ success: false, error: String(error) }, { status: 500 }),
}));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: () => mockClient }));

const NOW = new Date("2026-10-17T12:00:00.000Z");
const old = new Date(NOW.getTime() - 31 * 86400000).toISOString();
const recent = new Date(NOW.getTime() - 29 * 86400000).toISOString();

function track(sessionId: string, purgeRequestedAt: string | null = null, importId: string | null = null): Row {
  return { session_id: sessionId, import_id: importId, storage_path: `${sessionId}.fit`, purge_requested_at: purgeRequestedAt, created_at: recent };
}

function addImport(id: string, status: string, createdAt: string, purgeRequestedAt: string | null = null, sessionId: string | null = null): void {
  mockRows.session_imports.push({ id, status, created_at: createdAt, purge_requested_at: purgeRequestedAt, storage_path: `${id}.fit`, session_id: sessionId });
}

async function run() {
  const { GET } = await import("@/app/api/cron/session-tracks-purge/route");
  const response = await GET(new Request("https://quiversurf.app/api/cron/session-tracks-purge"));
  return { status: response.status, body: await response.json() };
}

describe("session tracks purge cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    for (const table of Object.keys(mockRows) as Table[]) mockRows[table] = [];
    for (const key of Object.keys(mockSessions)) delete mockSessions[key];
    mockSelectError = null;
    mockMissingWatchTables = false;
    mockList.mockReset().mockResolvedValue({ data: [], error: null });
    mockEvents.length = 0;
    mockSelections.length = 0;
    mockRemove.mockReset().mockImplementation(async (paths: string[]) => {
      mockEvents.push(`storage:${paths[0]}`);
      return { data: [], error: null };
    });
    mockValidateCronRequest.mockReturnValue(true);
  });

  afterEach(() => jest.useRealTimers());

  it("immediately purges completed imports detached by hard deletion", async () => {
    addImport("hard-deleted", "completed", NOW.toISOString());
    const result = await run();
    expect(result.status).toBe(200);
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 1, errors: 0 });
    expect(mockRows.session_imports).toHaveLength(0);
    expect(mockEvents).toEqual(["storage:hard-deleted.fit", "delete:session_imports:hard-deleted"]);
  });

  it.each(["PGRST205", "42P01"])("cleanly skips missing tables (%s)", async (code) => {
    mockSelectError = { code, message: "missing table" };
    const result = await run();
    expect(result.status).toBe(200);
    const options = mockOutcome.mock.calls[0][0] as { legitimatelyZero: (value: unknown) => unknown };
    expect(options.legitimatelyZero(result.body.data.result)).toEqual({ reason: "session waves tables not present" });
    expect(mockSelections).toHaveLength(0);
    expect(mockEvents).toHaveLength(0);
  });

  it("does not hide other select failures", async () => {
    mockSelectError = { code: "42501", message: "permission denied" };
    expect((await run()).status).toBe(500);
    expectConsoleErrors([/\[session-tracks-purge\] cron error:/]);
  });

  it("purges a track 31 days after session deletion in storage-first order", async () => {
    mockRows.session_tracks.push(track("old", null, "import-old"));
    mockSessions.old = old;
    mockRows.session_waves.push({ id: "wave", session_id: "old" });
    mockRows.session_wave_corrections.push({ id: "correction", session_id: "old" });
    addImport("import-old", "completed", recent, null, "old");

    const result = await run();
    expect(result.status).toBe(200);
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 1, purgedImports: 1, errors: 0 });
    expect(mockEvents.slice(0, 5)).toEqual([
      "storage:old.fit", "storage:import-old.fit", "delete:session_waves:old",
      "delete:session_wave_corrections:old", "delete:session_tracks:old",
    ]);
    expect(mockEvents[5]).toBe("delete:session_imports:old");
  });

  it("keeps a track whose session was deleted 29 days ago", async () => {
    mockRows.session_tracks.push(track("recent"));
    mockSessions.recent = recent;
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 0, errors: 0 });
    expect(mockRows.session_tracks).toHaveLength(1);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("purges account-requested tracks and imports immediately", async () => {
    mockRows.session_tracks.push(track("requested", NOW.toISOString()));
    addImport("requested-import", "completed", recent, NOW.toISOString());
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 1, purgedImports: 1, errors: 0 });
    expect(mockRemove).toHaveBeenCalledWith(["requested.fit"]);
    expect(mockRemove).toHaveBeenCalledWith(["requested-import.fit"]);
  });

  it("retains rows and counts a storage failure", async () => {
    mockRows.session_tracks.push(track("failed", NOW.toISOString()));
    mockRemove.mockImplementation(async (paths: string[]) => {
      mockEvents.push(`storage:${paths[0]}`);
      return { data: [], error: { message: "storage down" } };
    });
    const result = await run();
    expectConsoleErrors([/\[session-tracks-purge\] track failed: failed/]);
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 0, errors: 1 });
    expect(mockRows.session_tracks).toHaveLength(1);
    expect(mockEvents).toEqual(["storage:failed.fit"]);
  });

  it("purges stale unfinished imports and keeps recent ones", async () => {
    addImport("old-upload", "uploaded", old);
    addImport("recent-upload", "uploaded", recent);
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 1, errors: 0 });
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["recent-upload"]);
  });

  it.each([
    { status: "uploaded", sessionId: "live" },
    { status: "uploaded", sessionId: null },
    { status: "failed", sessionId: "live" },
    { status: "failed", sessionId: null },
    { status: "needs_beach", sessionId: "live" },
    { status: "needs_beach", sessionId: null },
  ])("keeps a live track's linked $status import with session_id $sessionId", async ({ status, sessionId }) => {
    const liveTrack = track("live", null, "stale-import");
    mockRows.session_tracks.push(liveTrack);
    mockRows.session_waves.push({ id: "live-wave", session_id: "live" });
    mockRows.session_wave_corrections.push({ id: "live-correction", session_id: "live" });
    mockSessions.live = null;
    addImport("stale-import", status, old, null, sessionId);

    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 0, errors: 0 });
    expect(mockRows.session_tracks).toEqual([liveTrack]);
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["stale-import"]);
    expect(mockRows.session_waves).toEqual([{ id: "live-wave", session_id: "live" }]);
    expect(mockRows.session_wave_corrections).toEqual([{ id: "live-correction", session_id: "live" }]);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("keeps live session data when a stale failed duplicate import references that session", async () => {
    const liveTrack = track("live", null, "original-import");
    mockRows.session_tracks.push(liveTrack);
    mockRows.session_waves.push({ id: "live-wave", session_id: "live" });
    mockSessions.live = null;
    addImport("duplicate", "failed", old, null, "live");

    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 1, errors: 0 });
    expect(mockRows.session_tracks).toEqual([liveTrack]);
    expect(mockRows.session_waves).toEqual([{ id: "live-wave", session_id: "live" }]);
    expect(mockRemove.mock.calls).toEqual([[["duplicate.fit"]]]);
  });

  it.each(["live", null])("keeps an unfinished uploaded import sharing its live track's object with session_id %s", async (sessionId) => {
    const liveTrack = track("live", null, "stale-import");
    liveTrack.storage_path = "stale-import.fit";
    mockRows.session_tracks.push(liveTrack);
    mockRows.session_waves.push({ id: "live-wave", session_id: "live" });
    mockSessions.live = null;
    addImport("stale-import", "uploaded", old, null, sessionId);

    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 0, errors: 0 });
    expect(mockRows.session_tracks).toEqual([liveTrack]);
    expect(mockRows.session_waves).toEqual([{ id: "live-wave", session_id: "live" }]);
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["stale-import"]);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it.each(["live", null])("deletes only the expired import row when a track shares its path but not its import_id, with session_id %s", async (sessionId) => {
    const liveTrack = track("live", null, "original-import");
    liveTrack.storage_path = "duplicate.fit";
    mockRows.session_tracks.push(liveTrack);
    mockRows.session_waves.push({ id: "live-wave", session_id: "live" });
    mockSessions.live = null;
    addImport("duplicate", "uploaded", old, null, sessionId);

    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 1, errors: 0 });
    expect(mockRows.session_tracks).toEqual([liveTrack]);
    expect(mockRows.session_waves).toEqual([{ id: "live-wave", session_id: "live" }]);
    expect(mockRows.session_imports).toHaveLength(0);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("keeps a completed import older than 30 days when its session is live", async () => {
    addImport("completed", "completed", old, null, "live");
    mockSessions.live = null;
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 0, errors: 0 });
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["completed"]);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("keeps a linked import reassigned to another session when purging the old track", async () => {
    mockRows.session_tracks.push(track("deleted", null, "reassigned"));
    mockSessions.deleted = old;
    mockSessions.live = null;
    addImport("reassigned", "completed", old, null, "live");

    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 1, purgedImports: 0, errors: 0 });
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["reassigned"]);
    expect(mockRemove.mock.calls).toEqual([[["deleted.fit"]]]);
  });

  it("keeps a reassigned import's shared object when purging the old track", async () => {
    const deletedTrack = track("deleted", null, "reassigned");
    deletedTrack.storage_path = "reassigned.fit";
    mockRows.session_tracks.push(deletedTrack);
    mockSessions.deleted = old;
    mockSessions.live = null;
    addImport("reassigned", "completed", old, null, "live");

    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 1, purgedImports: 0, errors: 0 });
    expect(mockRows.session_tracks).toHaveLength(0);
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["reassigned"]);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("still removes an import with no session when purging its linked track", async () => {
    mockRows.session_tracks.push(track("deleted", null, "unassigned"));
    mockSessions.deleted = old;
    addImport("unassigned", "completed", recent);
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 1, purgedImports: 1, errors: 0 });
    expect(mockRows.session_imports).toHaveLength(0);
  });

  it("retries a completed import left after its deleted session track was removed", async () => {
    addImport("orphan-completed", "completed", recent, null, "deleted-session");
    mockSessions["deleted-session"] = old;
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 1, errors: 0 });
    expect(mockRows.session_imports).toHaveLength(0);
  });

  it("purges a linked track when only its import has a purge request", async () => {
    mockRows.session_tracks.push(track("linked", null, "linked-import"));
    addImport("linked-import", "completed", recent, NOW.toISOString(), "linked");
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 1, purgedImports: 1, errors: 0 });
    expect(mockEvents.slice(0, 2)).toEqual(["storage:linked.fit", "storage:linked-import.fit"]);
    expect(mockRows.session_tracks).toHaveLength(0);
    expect(mockRows.session_imports).toHaveLength(0);
  });

  it("finds a purge-requested import's track by session id even when import_id is null", async () => {
    mockRows.session_tracks.push(track("requested-session"));
    addImport("requested-import", "completed", recent, NOW.toISOString(), "requested-session");
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 1, purgedImports: 1, errors: 0 });
    expect(mockRows.session_tracks).toHaveLength(0);
    expect(mockRows.session_imports).toHaveLength(0);
    expect(mockRemove).toHaveBeenCalledWith(["requested-session.fit"]);
    expect(mockRemove).toHaveBeenCalledWith(["requested-import.fit"]);
  });

  it("retains a requested import and its track when delegated storage removal fails", async () => {
    mockRows.session_tracks.push(track("requested-session"));
    addImport("requested-import", "completed", recent, NOW.toISOString(), "requested-session");
    mockRemove.mockImplementation(async (paths: string[]) => {
      mockEvents.push(`storage:${paths[0]}`);
      return { data: [], error: paths[0] === "requested-session.fit" ? { message: "storage down" } : null };
    });

    const result = await run();
    expectConsoleErrors([/\[session-tracks-purge\] track failed: requested-session/]);
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 0, purgedImports: 0, errors: 1 });
    expect(mockRows.session_tracks).toHaveLength(1);
    expect(mockRows.session_imports).toHaveLength(1);
    expect(mockEvents.filter((event) => event.startsWith("delete:"))).toEqual([]);
  });

  it("keeps a deleted session's import and track objects until track batch capacity is available", async () => {
    for (let index = 0; index < 100; index += 1) {
      mockRows.session_tracks.push(track(`requested-${index}`, NOW.toISOString()));
    }
    mockRows.session_tracks.push(track("waiting"));
    mockSessions.waiting = old;
    addImport("waiting-import", "completed", old, null, "waiting");

    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 100, purgedImports: 0, errors: 0 });
    expect(mockRows.session_tracks.map((row) => row.session_id)).toEqual(["waiting"]);
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["waiting-import"]);
    expect(mockRemove).not.toHaveBeenCalledWith(["waiting.fit"]);
    expect(mockRemove).not.toHaveBeenCalledWith(["waiting-import.fit"]);
  });

  it("orders every batch selector by purge request with nulls last, then creation time", async () => {
    await run();
    const selections = mockSelections.filter(selection => selection.table !== "watch_link_codes");
    expect(selections).toHaveLength(8);
    for (const selection of selections) {
      expect(selection.orders).toEqual([
        { column: "purge_requested_at", ascending: true, nullsFirst: false },
        { column: "created_at", ascending: true, nullsFirst: false },
      ]);
    }
  });

  it("processes at most 100 tracks and 100 imports per run", async () => {
    for (let index = 0; index < 101; index += 1) {
      const createdAt = new Date(Date.parse(old) - index * 86400000).toISOString();
      mockRows.session_tracks.push({ ...track(`track-${index}`, NOW.toISOString()), created_at: createdAt });
      addImport(`import-${index}`, "failed", createdAt);
    }
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedUploads: 0, purgedLinkCodes: 0, purgedTracks: 100, purgedImports: 100, errors: 0 });
    expect(mockRows.session_tracks.map((row) => row.session_id)).toEqual(["track-0"]);
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["import-0"]);
  });

  it("purges requested uploads immediately and all uploads older than seven days, preserving recent rows and samples", async () => {
    const sevenDays = new Date(NOW.getTime() - 7 * 86400000).toISOString();
    mockRows.watch_uploads = [
      { id: "requested", user_id: "owner", created_at: NOW.toISOString(), purge_requested_at: NOW.toISOString(), import_id: null },
      { id: "abandoned", user_id: "owner", created_at: old, purge_requested_at: null, import_id: null },
      { id: "completed", user_id: "owner", created_at: old, purge_requested_at: null, import_id: "kept-import" },
      { id: "recent", user_id: "owner", created_at: sevenDays, purge_requested_at: null, import_id: null },
    ];
    addImport("kept-import", "completed", old, null, "live-session");
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ name: `${i}.json` }));
    mockList.mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ name: "100.json" }], error: null });
    const result = await run();
    expect(result.status).toBe(200);
    expect(result.body.data.result).toMatchObject({ purgedUploads: 3, errors: 0 });
    expect(mockRows.watch_uploads.map(row => row.id)).toEqual(["recent"]);
    expect(mockRows.session_imports.map(row => row.id)).toEqual(["kept-import"]);
    expect(mockList).toHaveBeenNthCalledWith(1, "requested/owner/chunks", { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
    expect(mockList).toHaveBeenNthCalledWith(2, "requested/owner/chunks", expect.objectContaining({ offset: 0 }));
    expect(mockRemove).toHaveBeenNthCalledWith(1, firstPage.map(row => `requested/owner/chunks/${row.name}`));
    expect(mockRemove).toHaveBeenNthCalledWith(2, ["requested/owner/chunks/100.json"]);
    expect(mockEvents.indexOf("storage:requested/owner/chunks/100.json")).toBeLessThan(mockEvents.indexOf("delete:watch_uploads:requested"));
    expect(mockRemove).not.toHaveBeenCalledWith(expect.arrayContaining(["kept-import.fit"]));
  });

  it("caps watch upload work at 100 rows and prioritizes deletion requests", async () => {
    mockRows.watch_uploads = Array.from({ length: 101 }, (_, index) => ({
      id: `surf-${index}`, user_id: "owner", created_at: old, purge_requested_at: null,
    }));
    mockRows.watch_uploads.push({ id: "requested", user_id: "owner", created_at: NOW.toISOString(), purge_requested_at: NOW.toISOString() });
    expect((await run()).body.data.result).toMatchObject({ purgedUploads: 100, errors: 0 });
    expect(mockRows.watch_uploads.map(row => row.id)).toEqual(["surf-99", "surf-100"]);
    expect(mockList).toHaveBeenNthCalledWith(1, "requested/owner/chunks", expect.anything());
  });

  it("leaves the upload retryable after twenty pages when storage removal makes no progress", async () => {
    mockRows.watch_uploads = [{ id: "surf", user_id: "owner", created_at: old, purge_requested_at: null }];
    const page = Array.from({ length: 100 }, (_, i) => ({ name: `${i}.json` }));
    for (let i = 0; i < 21; i++) mockList.mockResolvedValueOnce({ data: page, error: null });
    expect((await run()).body.data.result).toMatchObject({ purgedUploads: 0, errors: 0 });
    expect(mockList).toHaveBeenCalledTimes(20);
    expect(mockRemove).toHaveBeenCalledTimes(20);
    expect(mockRows.watch_uploads.map(row => row.id)).toEqual(["surf"]);
    expect(mockEvents).not.toContain("delete:watch_uploads:surf");
    expect((await run()).body.data.result).toMatchObject({ purgedUploads: 1, errors: 0 });
    expect(mockRows.watch_uploads).toHaveLength(0);
  });

  it("bounds confirmed and expired link-code deletion to one hundred ids each", async () => {
    mockRows.watch_link_codes = Array.from({ length: 105 }, (_, i) => [
      { id: `confirmed-${i}`, confirmed_at: old, expires_at: old },
      { id: `expired-${i}`, confirmed_at: null, expires_at: old },
    ]).flat();
    expect((await run()).body.data.result).toMatchObject({ purgedLinkCodes: 200, errors: 0 });
    expect(mockRows.watch_link_codes).toHaveLength(10);
    expect((await run()).body.data.result).toMatchObject({ purgedLinkCodes: 10, errors: 0 });
    expect(mockRows.watch_link_codes).toHaveLength(0);
  });

  it.each(["list", "remove"])("retains upload rows when storage %s fails and retries later", async failure => {
    mockRows.watch_uploads = [{ id: "surf", user_id: "owner", created_at: old, purge_requested_at: null }];
    mockList.mockResolvedValue({ data: [{ name: "0.json" }], error: null });
    if (failure === "list") mockList.mockResolvedValueOnce({ data: null, error: { message: "storage down" } });
    else mockRemove.mockResolvedValueOnce({ data: [], error: { message: "storage down" } });
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await run()).body.data.result).toMatchObject({ purgedUploads: 0, errors: 1 });
      expect(mockRows.watch_uploads).toHaveLength(1);
      expect((await run()).body.data.result).toMatchObject({ purgedUploads: 1, errors: 0 });
      expect(mockRows.watch_uploads).toHaveLength(0);
    } finally { errorLog.mockRestore(); }
  });

  it("expires confirmed link codes after 30 days and unconfirmed codes a day after expiry", async () => {
    const dayAgo = new Date(NOW.getTime() - 86400000).toISOString();
    const monthAgo = new Date(NOW.getTime() - 30 * 86400000).toISOString();
    mockRows.watch_link_codes = [
      { id: "old-confirmed", confirmed_at: old, expires_at: old },
      { id: "old-unconfirmed", confirmed_at: null, expires_at: old },
      { id: "recent-confirmed", confirmed_at: monthAgo, expires_at: old },
      { id: "recent-expired", confirmed_at: null, expires_at: dayAgo },
      { id: "active", confirmed_at: null, expires_at: new Date(NOW.getTime() + 60000).toISOString() },
    ];
    expect((await run()).body.data.result).toMatchObject({ purgedLinkCodes: 2, errors: 0 });
    expect(mockRows.watch_link_codes.map(row => row.id)).toEqual(["recent-confirmed", "recent-expired", "active"]);
  });

  it("still purges file imports while watch tables are not present", async () => {
    mockMissingWatchTables = true;
    addImport("expired", "failed", old);
    const result = await run();
    expect(result.status).toBe(200);
    expect(result.body.data.result).toMatchObject({ purgedImports: 1, purgedUploads: 0, errors: 0, skipped: "watch tables not present" });
    expect(mockList).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    mockValidateCronRequest.mockReturnValue(false);
    expect((await run()).status).toBe(401);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("is scheduled at 09:40 UTC", () => {
    const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons;
    expect(crons).toContainEqual({ path: "/api/cron/session-tracks-purge", schedule: "40 9 * * *" });
  });
});
