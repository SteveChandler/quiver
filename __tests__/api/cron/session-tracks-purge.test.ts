/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

type Row = Record<string, string | null>;
type Table = "session_tracks" | "session_imports" | "session_waves" | "session_wave_corrections";

const mockRows: Record<Table, Row[]> = {
  session_tracks: [],
  session_imports: [],
  session_waves: [],
  session_wave_corrections: [],
};
const mockSessions: Record<string, string | null> = {};
const mockEvents: string[] = [];
const mockRemove = jest.fn(async (paths: string[]) => {
  mockEvents.push(`storage:${paths[0]}`);
  return { data: [], error: null as { message: string } | null };
});
const mockValidateCronRequest = jest.fn(() => true);

function mockQuery(table: Table) {
  let action: "select" | "delete" = "select";
  let filters: Array<(row: Row) => boolean> = [];
  let max = Infinity;
  const query = {
    select: (_columns: string) => query,
    delete: () => { action = "delete"; return query; },
    eq: (column: string, value: string) => {
      filters.push((row) => row[column] === value);
      return query;
    },
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
    limit: (value: number) => { max = value; return query; },
    then: (resolve: (value: { data: Row[] | null; error: null }) => unknown) => {
      const matching = mockRows[table].filter((row) => filters.every((filter) => filter(row)));
      if (action === "delete") {
        mockEvents.push(`delete:${table}:${matching.map((row) => row.session_id ?? row.id).join(",")}`);
        mockRows[table] = mockRows[table].filter((row) => !matching.includes(row));
      }
      return Promise.resolve(resolve({ data: matching.slice(0, max), error: null }));
    },
  };
  return query;
}

const mockClient = {
  from: (table: Table) => mockQuery(table),
  storage: { from: (_bucket: string) => ({ remove: mockRemove }) },
};

jest.mock("@/lib/cron/observability", () => ({ withObservedCron: (_route: string, handler: unknown) => handler }));
jest.mock("@/lib/cron/outcome", () => ({ withCronOutcome: (_options: unknown, run: () => Promise<unknown>) => run() }));
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
  return { session_id: sessionId, import_id: importId, storage_path: `${sessionId}.fit`, purge_requested_at: purgeRequestedAt };
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
    mockEvents.length = 0;
    mockRemove.mockImplementation(async (paths: string[]) => {
      mockEvents.push(`storage:${paths[0]}`);
      return { data: [], error: null };
    });
    mockValidateCronRequest.mockReturnValue(true);
  });

  afterEach(() => jest.useRealTimers());

  it("purges a track 31 days after session deletion in storage-first order", async () => {
    mockRows.session_tracks.push(track("old", null, "import-old"));
    mockSessions.old = old;
    mockRows.session_waves.push({ id: "wave", session_id: "old" });
    mockRows.session_wave_corrections.push({ id: "correction", session_id: "old" });
    addImport("import-old", "completed", recent, null, "old");

    const result = await run();
    expect(result.status).toBe(200);
    expect(result.body.data.result).toEqual({ purgedTracks: 1, purgedImports: 1, errors: 0 });
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
    expect(result.body.data.result).toEqual({ purgedTracks: 0, purgedImports: 0, errors: 0 });
    expect(mockRows.session_tracks).toHaveLength(1);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("purges account-requested tracks and imports immediately", async () => {
    mockRows.session_tracks.push(track("requested", NOW.toISOString()));
    addImport("requested-import", "completed", recent, NOW.toISOString());
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedTracks: 1, purgedImports: 1, errors: 0 });
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
    expect(result.body.data.result).toEqual({ purgedTracks: 0, purgedImports: 0, errors: 1 });
    expect(mockRows.session_tracks).toHaveLength(1);
    expect(mockEvents).toEqual(["storage:failed.fit"]);
  });

  it("purges stale unfinished imports and keeps recent ones", async () => {
    addImport("old-upload", "uploaded", old);
    addImport("recent-upload", "uploaded", recent);
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedTracks: 0, purgedImports: 1, errors: 0 });
    expect(mockRows.session_imports.map((row) => row.id)).toEqual(["recent-upload"]);
  });

  it("retries a completed import left after its deleted session track was removed", async () => {
    addImport("orphan-completed", "completed", recent, null, "deleted-session");
    mockSessions["deleted-session"] = old;
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedTracks: 0, purgedImports: 1, errors: 0 });
    expect(mockRows.session_imports).toHaveLength(0);
  });

  it("purges a linked track when only its import has a purge request", async () => {
    mockRows.session_tracks.push(track("linked", null, "linked-import"));
    addImport("linked-import", "completed", recent, NOW.toISOString(), "linked");
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedTracks: 1, purgedImports: 1, errors: 0 });
    expect(mockEvents.slice(0, 2)).toEqual(["storage:linked.fit", "storage:linked-import.fit"]);
    expect(mockRows.session_tracks).toHaveLength(0);
    expect(mockRows.session_imports).toHaveLength(0);
  });

  it("processes at most 100 tracks and 100 imports per run", async () => {
    for (let index = 0; index < 101; index += 1) {
      mockRows.session_tracks.push(track(`track-${index}`, NOW.toISOString()));
      addImport(`import-${index}`, "failed", old);
    }
    const result = await run();
    expect(result.body.data.result).toEqual({ purgedTracks: 100, purgedImports: 100, errors: 0 });
    expect(mockRows.session_tracks).toHaveLength(1);
    expect(mockRows.session_imports).toHaveLength(1);
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
